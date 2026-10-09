// reply-assist: the extension's "Draft a reply" button. Same engine as the HQ chat button: no Claude API key. It stores the open
// LinkedIn conversation (read by the extension when someone clicks) plus where the lead came from (the post they commented on and its
// lead magnet, the outreach campaign they replied to, their profile) as a `reply_drafts` row (status 'working'), adds a
// `resource_jobs` row (payload.type = 'reply') and fires the "OuterHaven resource builder" Claude Code routine, which follows
// routines/reply.md and writes the draft back into the reply_drafts row. The extension polls action 'status'. Drafts take 1-2 min.
// It NEVER sends or types anything on LinkedIn: a person reads, edits and sends.
// Auth: header x-capture-key (the same team key as dm-capture). Routine URL/token: integration_secrets (same as hq-chat).
import { createClient } from "npm:@supabase/supabase-js@2";
import { clipMessages, exampleFrom, pickResources } from "./prompt.js";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-capture-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "content-type": "application/json" } });
const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const TEAM = ["Tengku", "Chase", "Anaz", "Peter", "Razeen"];
const FIRE_PREFIX = "https://api.anthropic.com/v1/claude_code/routines/";
const MAX_BUSY = 4;

async function secrets(keys: string[]) {
  const { data } = await sb.from("integration_secrets").select("key,secret_value").in("key", keys);
  return Object.fromEntries((data || []).map((r: any) => [r.key, r.secret_value as string]));
}

async function fire(jobId: string) {
  const m = await secrets(["ROUTINE_FIRE_URL", "ROUTINE_FIRE_TOKEN"]);
  if (!m.ROUTINE_FIRE_URL || !m.ROUTINE_FIRE_TOKEN) throw new Error("Claude isn't connected yet. An admin needs to paste the routine URL and token in HQ → Resources → Generate → Settings.");
  if (!m.ROUTINE_FIRE_URL.startsWith(FIRE_PREFIX) || !m.ROUTINE_FIRE_URL.endsWith("/fire")) throw new Error("The saved routine URL doesn't look right.");
  const res = await fetch(m.ROUTINE_FIRE_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${m.ROUTINE_FIRE_TOKEN}`, "anthropic-beta": "experimental-cc-routine-2026-04-01", "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ text: `resource_job_id: ${jobId}` }),
  });
  const body = await res.text();
  if (!res.ok) {
    let msg = body.slice(0, 300); try { msg = JSON.parse(body)?.error?.message || msg; } catch { /* keep raw */ }
    throw new Error(res.status === 401 ? "Claude rejected the routine token. An admin needs to paste a new one in HQ → Resources → Generate → Settings." : res.status === 429 ? "Claude's daily routine limit is used up. Reply by hand today." : `Claude returned ${res.status}: ${msg}`);
  }
  try { return JSON.parse(body).claude_code_session_url as string | undefined; } catch { return undefined; }
}

const slugOf = (u: unknown) => (String(u || "").match(/linkedin\.com\/in\/([^/?#]+)/i) || [])[1]?.toLowerCase() || "";

// Where this lead came from: a comment on one of our posts (which post, which lead magnet) and/or a reply to an outreach campaign
// (Prosp sends their profile bio), plus our opening message and the DM test version it matches. The routine ties the reply to it.
async function sourceOf(prospect: { name: string; headline: string; url: string }, messages: { from: string; text: string }[]) {
  const slug = slugOf(prospect.url), name = prospect.name;
  const cBase = () => sb.from("daily_ops_post_comments").select("post_id,author_headline,body,posted_at").eq("is_team", false).order("posted_at", { ascending: false }).limit(5);
  const lBase = () => sb.from("lead_intake").select("campaign_name,source_account,headline,company_name,reply_text,raw_payload,created_at").order("created_at", { ascending: false }).limit(3);
  const none = { data: [] as any[] };
  // Profile slug first (exact person); the chat sometimes links an internal id instead, so fall back to the exact name.
  const okSlug = /^[a-z0-9%_-]+$/i.test(slug);
  let [c, l]: any[] = okSlug ? await Promise.all([
    cBase().or(`author_url.ilike.%/in/${slug},author_url.ilike.%/in/${slug}/`),
    lBase().or(`linkedin_url.ilike.%/in/${slug},linkedin_url.ilike.%/in/${slug}/`),
  ]) : [none, none];
  if (!(c.data || []).length && name) c = await cBase().ilike("author_name", name);
  if (!(l.data || []).length && name) l = await lBase().ilike("name", name);
  const comments = (c.data || []) as any[];
  const postIds = [...new Set(comments.map((x) => x.post_id))];
  const [posts, res] = postIds.length ? await Promise.all([
    sb.from("daily_ops_posts").select("id,post_name,post_text,linkedin_post_url,posted_at,account_id").in("id", postIds),
    sb.from("resource_jobs").select("post_id,output_title,output_url").in("post_id", postIds).eq("status", "ready").not("output_url", "is", null),
  ]) : [{ data: [] }, { data: [] }];
  const P = Object.fromEntries(((posts as any).data || []).map((p: any) => [p.id, p]));
  const R = Object.fromEntries(((res as any).data || []).map((r: any) => [r.post_id, r]));
  const acctIds = [...new Set(Object.values(P).map((p: any) => p.account_id).filter(Boolean))];
  const A = acctIds.length ? Object.fromEntries(((await sb.from("daily_ops_accounts").select("id,owner_name").in("id", acctIds)).data || []).map((a: any) => [a.id, a.owner_name])) : {};
  const leads = (l.data || []) as any[];
  const prof = leads.map((x) => x.raw_payload?.eventData?.profileInfo).find(Boolean) || {};
  const opener = messages.find((m) => m.from === "us")?.text || "";
  let variant = null;
  if (opener) {
    const mv = await sb.rpc("match_dm_variant", { p_text: opener });
    const best = (mv.data || [])[0];
    if (best?.variant_id && best.score >= 0.5) {
      const v = await sb.from("dm_variants").select("label,message,dm_tests(name,context)").eq("id", best.variant_id).maybeSingle();
      if (v.data) variant = { test: (v.data as any).dm_tests?.name, context: (v.data as any).dm_tests?.context, label: v.data.label, message: String(v.data.message).slice(0, 600) };
    }
  }
  return {
    comments: comments.map((x) => { const p = P[x.post_id] || {}; const r = R[x.post_id]; return {
      on_account: A[p.account_id] || null, post_name: p.post_name || null, post_url: p.linkedin_post_url || null,
      post_caption: String(p.post_text || "").slice(0, 900), comment: String(x.body || "").slice(0, 400), commented_at: x.posted_at,
      resource: r ? { title: r.output_title, url: r.output_url } : null }; }),
    outreach: leads.map((x) => ({ campaign: x.campaign_name, sender: x.source_account, their_reply: String(x.reply_text || "").replace(/^A lead has replied\s*Re:/i, "").trim().slice(0, 400), at: x.created_at })),
    lead_profile: {
      headline: prospect.headline || prof.headline || comments[0]?.author_headline || leads[0]?.headline || "",
      company: prof.company || leads[0]?.company_name || "",
      bio: String(prof.bio || "").slice(0, 1500),
    },
    opener: opener.slice(0, 800), dm_variant: variant,
  };
}

const myDayStart = () => { const t = new Date(Date.now() + 8 * 3600e3); return new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate()) - 8 * 3600e3).toISOString(); };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);

  const k = req.headers.get("x-capture-key") || "";
  const real = (await secrets(["EXT_CAPTURE_KEY"])).EXT_CAPTURE_KEY || "";
  if (!k || !real || k !== real) return json({ ok: false, error: "This copy of the extension isn't connected to HQ. Download a fresh one from HQ → Growth → DM tests." }, 401);

  let b: any = {};
  try { b = await req.json(); } catch { return json({ ok: false, error: "bad request" }, 400); }

  // ---- poll ----
  if (b.action === "status") {
    const id = str(b.id, 60);
    const r = await sb.from("reply_drafts").select("id,status,progress,draft,intent,approach,lead_type,background,next_step,needs_human,flags,persona_missing,error,created_at").eq("id", id).maybeSingle();
    if (!r.data) return json({ ok: false, error: "Draft not found." }, 404);
    if (r.data.status === "working" && Date.now() - new Date(r.data.created_at).getTime() > 15 * 60e3) await sb.rpc("reply_sweep");
    const d = r.data;
    return json({ ok: true, id: d.id, status: d.status, progress: d.progress, reply: d.draft, intent: d.intent, approach: d.approach, lead_type: d.lead_type, background: d.background, next_step: d.next_step, needs_human: d.needs_human, flags: d.flags || [], persona_missing: d.persona_missing, error: d.error });
  }

  // ---- new draft ----
  const by = TEAM.find((n) => n.toLowerCase() === str(b.booked_by, 40).toLowerCase());
  if (!by) return json({ ok: false, error: "Pick who you are first (top of the HQ panel)." }, 400);
  const { data: accts } = await sb.from("daily_ops_accounts").select("owner_name");
  const account = (accts || []).map((a: any) => a.owner_name).find((n: string) => n && n.toLowerCase() === str(b.account, 80).toLowerCase());
  if (!account) return json({ ok: false, error: "Pick which LinkedIn account this is." }, 400);
  const messages = clipMessages(b.messages);
  if (!messages.length) return json({ ok: false, error: "Couldn't read any messages in this chat. Open the conversation first." }, 400);

  const { data: gs } = await sb.from("growth_settings").select("reply_daily_cap").eq("id", 1).maybeSingle();
  const cap = Number(gs?.reply_daily_cap ?? 60);
  const used = await sb.from("reply_drafts").select("id", { count: "exact", head: true }).eq("requested_by", by).gte("created_at", myDayStart());
  if ((used.count || 0) >= cap) return json({ ok: false, error: `You've used today's ${cap} drafts. It resets at midnight Malaysia time.` }, 429);
  await sb.rpc("reply_sweep");
  const busy = await sb.from("reply_drafts").select("id", { count: "exact", head: true }).eq("status", "working");
  if ((busy.count || 0) >= MAX_BUSY) return json({ ok: false, error: "Claude is already writing a few drafts. Try again in a minute." }, 429);

  // Pre-picked context so the routine starts fast: lead magnets that match the chat + our side of threads that booked a meeting.
  const [rj, ex, pr] = await Promise.all([
    sb.from("resource_jobs").select("topic,output_title,output_url,caption,payload").eq("kind", "resource").eq("status", "ready").not("output_url", "is", null).order("created_at", { ascending: false }).limit(60),
    sb.from("dm_conversations").select("account_name,messages").eq("meeting_booked", true).order("updated_at", { ascending: false }).limit(12),
    sb.from("reply_personas").select("who_they_are,voice,offer").eq("account_name", account).maybeSingle(),
  ]);
  const resources = pickResources(messages, (rj.data || []).filter((r: any) => !["chat", "teaser", "reply"].includes(r.payload?.type)).map((r: any) => ({ title: r.output_title, topic: r.topic, caption: r.caption, url: r.output_url })));
  const rows = (ex.data || []) as any[];
  const examples = [...rows.filter((r) => r.account_name === account), ...rows.filter((r) => r.account_name !== account)].map(exampleFrom).filter(Boolean).slice(0, 3);
  const prospect = { name: str(b.prospect?.name, 120), headline: str(b.prospect?.headline, 300), url: str(b.prospect?.url, 300) };
  let source: unknown = null;
  try { source = await sourceOf(prospect, messages); } catch (e) { source = { error: String(e).slice(0, 200) }; }
  const persona_missing = !(pr.data && (pr.data.who_they_are || pr.data.voice || pr.data.offer));

  const d = await sb.from("reply_drafts").insert({
    account_name: account, requested_by: by, thread_key: str(b.thread_key, 200) || null, prospect_name: prospect.name || null, prospect_headline: prospect.headline || null, prospect_url: prospect.url || null,
    status: "working", progress: "Waiting for Claude to start", persona_missing, model: "routine",
    input: { prospect, source, messages, resources, examples, tweak: str(b.tweak, 200) },
  }).select("id").single();
  if (d.error) return json({ ok: false, error: d.error.message }, 500);

  const job = await sb.from("resource_jobs").insert({
    requested_by: by, kind: "resource", format: "other", brand: "OuterHaven Advisory", source: "generated", status: "queued", poster: account,
    topic: `Reply draft: ${account} → ${prospect.name || "lead"}`.slice(0, 120), caption: messages.at(-1)?.text?.slice(0, 500) || "", progress: "Waiting for Claude to start",
    payload: { type: "reply", reply_draft_id: d.data.id, account, requested_by: by },
  }).select("id").single();
  const failWith = async (msg: string) => {
    await sb.from("reply_drafts").update({ status: "error", error: msg, progress: null, updated_at: new Date().toISOString() }).eq("id", d.data.id);
    if (job.data) await sb.from("resource_jobs").update({ status: "failed", error: msg, finished_at: new Date().toISOString() }).eq("id", job.data.id);
    return json({ ok: false, error: msg }, 502);
  };
  if (job.error) return await failWith(job.error.message);
  await sb.from("reply_drafts").update({ job_id: job.data.id }).eq("id", d.data.id);
  try {
    const session = await fire(job.data.id);
    await sb.from("resource_jobs").update({ session_url: session || null }).eq("id", job.data.id);
  } catch (e) { return await failWith(e instanceof Error ? e.message : String(e)); }
  return json({ ok: true, id: d.data.id, status: "working", remaining_today: Math.max(0, cap - (used.count || 0) - 1) });
});
