// reply-assist: the extension's "Draft a reply" button. Receives the open LinkedIn conversation (read by the extension when
// someone clicks), adds the account's persona, any matching lead-magnet resource and a few past threads that booked a meeting,
// asks Claude for a draft, logs it and returns it. It NEVER sends or types anything: a person reads, edits and sends.
// Auth: header x-capture-key (the same team key as dm-capture). The Claude API key is integration_secrets.ANTHROPIC_API_KEY,
// pasted by an admin in HQ -> Growth -> Reply assist. Pure helpers live in prompt.js (tested in Node).
import { createClient } from "npm:@supabase/supabase-js@2";
import { MODEL, buildSystem, buildUser, clipMessages, exampleFrom, parseDraft, pickResources } from "./prompt.js";

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

async function secret(key: string) {
  const r = await sb.from("integration_secrets").select("secret_value").eq("key", key).maybeSingle();
  return (r.data?.secret_value as string) || "";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);

  const k = req.headers.get("x-capture-key") || "";
  const real = await secret("EXT_CAPTURE_KEY");
  if (!k || !real || k !== real) return json({ ok: false, error: "This copy of the extension isn't connected to HQ. Download a fresh one from HQ → Growth → DM tests." }, 401);

  let b: any = {};
  try { b = await req.json(); } catch { return json({ ok: false, error: "bad request" }, 400); }

  const by = TEAM.find((n) => n.toLowerCase() === str(b.booked_by, 40).toLowerCase());
  if (!by) return json({ ok: false, error: "Pick who you are first (top of the HQ panel)." }, 400);
  const { data: accts } = await sb.from("daily_ops_accounts").select("owner_name");
  const account = (accts || []).map((a: any) => a.owner_name).find((n: string) => n && n.toLowerCase() === str(b.account, 80).toLowerCase());
  if (!account) return json({ ok: false, error: "Pick which LinkedIn account this is." }, 400);

  const messages = clipMessages(b.messages);
  if (!messages.length) return json({ ok: false, error: "Couldn't read any messages in this chat. Open the conversation first." }, 400);

  // Daily cap per person (Malaysia day).
  const { data: gs } = await sb.from("growth_settings").select("reply_daily_cap").eq("id", 1).maybeSingle();
  const cap = Number(gs?.reply_daily_cap ?? 60);
  const myt = new Date(Date.now() + 8 * 3600e3);
  const dayStart = new Date(Date.UTC(myt.getUTCFullYear(), myt.getUTCMonth(), myt.getUTCDate()) - 8 * 3600e3).toISOString();
  const used = await sb.from("reply_drafts").select("id", { count: "exact", head: true }).eq("requested_by", by).gte("created_at", dayStart);
  if ((used.count || 0) >= cap) return json({ ok: false, error: `You've used today's ${cap} drafts. It resets at midnight Malaysia time.` }, 429);

  const apiKey = await secret("ANTHROPIC_API_KEY");
  if (!apiKey) return json({ ok: false, error: "Reply drafting isn't switched on yet. An admin needs to paste the Claude API key in HQ → Growth → Reply assist." }, 503);

  // Context: persona, matching resources, and our side of up to 3 threads that booked a meeting (same account first).
  const [pr, rj, ex] = await Promise.all([
    sb.from("reply_personas").select("*").eq("account_name", account).maybeSingle(),
    sb.from("resource_jobs").select("topic,output_title,output_url,caption,payload").eq("kind", "resource").eq("status", "ready").not("output_url", "is", null).order("created_at", { ascending: false }).limit(60),
    sb.from("dm_conversations").select("account_name,messages").eq("meeting_booked", true).order("updated_at", { ascending: false }).limit(12),
  ]);
  const persona = pr.data || null;
  const resources = pickResources(
    messages,
    (rj.data || []).filter((r: any) => !["chat", "teaser"].includes(r.payload?.type)).map((r: any) => ({ title: r.output_title, topic: r.topic, caption: r.caption, url: r.output_url })),
  );
  const rows = (ex.data || []) as any[];
  const examples = [...rows.filter((r) => r.account_name === account), ...rows.filter((r) => r.account_name !== account)].map(exampleFrom).filter(Boolean).slice(0, 3);

  const prospect = { name: str(b.prospect?.name, 120), headline: str(b.prospect?.headline, 300) };
  const system = buildSystem(account, persona);
  const user = buildUser({ prospect, messages, resources, examples, tweak: str(b.tweak, 200) });

  let res: Response;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 45000);
  try {
    res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: MODEL, max_tokens: 900, system, messages: [{ role: "user", content: user }] }),
      signal: ctl.signal,
    });
  } catch {
    return json({ ok: false, error: "Claude took too long to answer. Try again." }, 504);
  } finally { clearTimeout(timer); }

  const raw = await res.text();
  if (!res.ok) {
    let msg = raw.slice(0, 200); try { msg = JSON.parse(raw)?.error?.message || msg; } catch { /* keep raw */ }
    const friendly = res.status === 401 ? "The saved Claude API key was rejected. An admin needs to paste a new one in HQ → Growth → Reply assist."
      : res.status === 429 ? "Claude is rate-limiting us. Try again in a minute."
      : res.status === 529 ? "Claude is overloaded right now. Try again in a minute."
      : `Claude returned ${res.status}: ${msg}`;
    return json({ ok: false, error: friendly }, 502);
  }
  let out: any; try { out = JSON.parse(raw); } catch { return json({ ok: false, error: "Claude's answer couldn't be read. Try again." }, 502); }
  const text = (out.content || []).filter((c: any) => c.type === "text").map((c: any) => c.text).join("");
  const d = parseDraft(text);
  if (!d) return json({ ok: false, error: "Claude's draft came back in an unexpected shape. Try again." }, 502);

  const persona_missing = !(persona && (persona.who_they_are || persona.voice || persona.offer));
  if (persona_missing && !d.flags.includes("persona_missing")) d.flags.unshift("persona_missing");
  await sb.from("reply_drafts").insert({
    account_name: account, requested_by: by, thread_key: str(b.thread_key, 200) || null, prospect_name: prospect.name || null, prospect_headline: prospect.headline || null,
    intent: d.intent, needs_human: d.needs_human, flags: d.flags, draft: d.reply, model: MODEL,
    input_tokens: out.usage?.input_tokens ?? null, output_tokens: out.usage?.output_tokens ?? null, persona_missing,
  });
  return json({ ok: true, ...d, persona_missing, resources: resources.map((r) => r.title || r.topic), remaining_today: Math.max(0, cap - (used.count || 0) - 1) });
});
