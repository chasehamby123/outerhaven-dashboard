// outreach: omnichannel sends for Credit / BDC / UCC targets (10 Oct 2026).
// Admin (user JWT):
//   action 'campaigns' → Prosp campaigns (POST https://prosp.ai/api/v1/campaigns/lists)
//   action 'send' {items: [{kind, key, person, owner, variant?}]} → per company: best contact from signal_contacts → people + task
//     (like "Add to pipeline") → Prosp POST /api/v1/leads (LinkedIn, campaign of the owner's account) and PlusVibe
//     POST /api/v1/lead/add (email, only when Hunter says valid / score >= min_email_score). Copy lives in the campaigns.
//     (11 Oct) Prosp gets its STANDARD fields (firstName, lastName, name, jobTitle, company, email, phoneNumber, websiteUrl: the
//     template's {{First name}} reads firstName; custom first_name left it blank) + one custom field, deadline. No opener.
//     Variant: a lead with a dated trigger goes to the account's dated campaign or, for test_split of them, its plain campaign
//     (same message without the deadline line); a lead with no date goes plain, or email only if there is no plain campaign.
// Webhook: ?hook=plusvibe&token=PLUSVIBE_WEBHOOK_TOKEN (Email Replies event) → lead_intake row + stop LinkedIn (Prosp delete
//   from campaign). Prosp replies arrive via the existing prosp-reply webhook into lead_intake; the cron stops their email.
// Cron (x-outerhaven-cron, every 20 min): replied on LinkedIn → PlusVibe lead COMPLETED; once a day Prosp analytics → outreach_daily.
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!, SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-outerhaven-cron", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "content-type": "application/json" } });
const TABLE: Record<string, string> = { credit: "credit_signals", bdc: "bdc_signals", ucc: "ucc_signals" };
const KEYCOL: Record<string, string> = { credit: "cik", bdc: "company_key", ucc: "company_key" };
const SOURCE: Record<string, string> = { credit: "SEC credit signal", bdc: "BDC loan signal", ucc: "UCC signal" };
const PROSP = "https://prosp.ai/api/v1", PV = "https://api.plusvibe.ai/api/v1";

async function secret(key: string) {
  const r = await sb.from("integration_secrets").select("secret_value").eq("key", key).maybeSingle();
  return (r.data?.secret_value as string) || "";
}
async function admin(req: Request) {
  const auth = req.headers.get("authorization") || "";
  if (!auth.toLowerCase().startsWith("bearer ")) return null;
  const u = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
  const { data: { user } } = await u.auth.getUser();
  if (!user) return null;
  return (await u.rpc("dashboard_role")).data === "admin" ? user : null;
}
async function post(url: string, body: unknown, headers: Record<string, string> = {}) {
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.message || j?.error || `HTTP ${r.status}`);
  return j;
}
const settings = async () => (await sb.from("outreach_settings").select("*").eq("id", 1).maybeSingle()).data || { prosp: [] };
const live = (c: any) => (c?.people || []).filter((p: any) => p.status !== "wrong");
const okEmail = (p: any, min: number) => p?.email && (p.email_status === "valid" || (p.email_score ?? 0) >= min);

// The name a person would write in an email: "HYDROFARM HOLDINGS GROUP, INC." → "Hydrofarm", "Boxlight Corp" → "Boxlight".
// ALL-CAPS SEC names are title-cased; short all-caps words (XCF, ORL) stay as acronyms. {{company}} in both campaigns uses this.
export function cleanName(n: string) {
  let s = String(n || "").replace(/\s*\/[A-Z]{2}\/?\s*$/, "").replace(/\s*\(.*?\)\s*/g, " ");
  const SUF = /,?\s+(incorporated|inc|corp|corporation|co|company|ltd|llc|l\.l\.c|plc|lp|l\.p|holdings?|holding corp|group|buyer|midco|bidco|topco|holdco|parent|intermediate|acquisition|borrower|finco|us|usa)\.?$/i;
  for (let i = 0; i < 6 && SUF.test(s.trim()) && s.trim().split(/\s+/).length > 1; i++) s = s.trim().replace(SUF, "");
  s = s.replace(/[,.\s]+$/, "").replace(/\s+/g, " ").trim();
  if (s === s.toUpperCase()) s = s.split(" ").map(w => w.length <= 3 && /^[A-Z]+$/.test(w) ? w : w.charAt(0) + w.slice(1).toLowerCase()).join(" ");
  return s || String(n || "");
}

// {{deadline}}: the date that makes the message specific. "a loan maturing in March 2027" (BDC), "debt coming due by June 2027"
// (public: debt due within 12 months of the last balance sheet). No date = null: "Noticed X has debt that will need refinancing"
// is vague enough to read as a mail merge, so those leads get the plain message instead.
const MON = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const monthYear = (d: Date) => `${MON[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
export function deadlineOf(kind: string, sig: any, now = Date.now()) {
  if (kind === "bdc" && sig.earliest_maturity) { const d = new Date(sig.earliest_maturity); if (d.getTime() > now) return `a loan maturing in ${monthYear(d)}`; }
  if (kind === "credit" && Number(sig.debt_current) > 0 && sig.period_end) { const d = new Date(sig.period_end); d.setUTCFullYear(d.getUTCFullYear() + 1); if (d.getTime() > now) return `debt coming due by ${monthYear(d)}`; }
  return null;
}

// Send one company on both channels. Returns the enrollment row.
async function sendOne(it: any, st: any, keys: { prosp: string; pv: string }, who: string) {
  const kind = String(it.kind), key = String(it.key);
  if (!TABLE[kind]) throw new Error("bad kind");
  const already = (await sb.from("outreach_enrollments").select("id,status").eq("kind", kind).eq("key", key).neq("status", "stopped").limit(1)).data?.[0];
  if (already) return { kind, key, skipped: "already sent" };
  const c = (await sb.from("signal_contacts").select("*").eq("kind", kind).eq("key", key).maybeSingle()).data;
  const sig = (await sb.from(TABLE[kind]).select("*").eq(KEYCOL[kind], key).maybeSingle()).data;
  if (!sig) return { kind, key, skipped: "company not found" };
  // The person the sender saw in HQ's batch window (same name), else the best stored contact.
  const p = live(c).find((x: any) => it.person && x.name === it.person) || live(c)[0];
  if (!p) return { kind, key, skipped: "no contact person yet" };
  const email = okEmail(p, st.min_email_score ?? 90) ? p.email : null;
  if (!p.linkedin && !email) return { kind, key, skipped: "no LinkedIn or valid email" };
  const company = sig.company_name, short = cleanName(company), parts = String(p.name).trim().split(/\s+/), first = parts[0], last = parts.slice(1).join(" ");
  const deadline = deadlineOf(kind, sig);
  // Which LinkedIn account sends it: the requested owner, else round-robin over accounts with a campaign.
  const accounts = (st.prosp || []).filter((a: any) => a.campaign_id && a.list_id);
  const acct = accounts.find((a: any) => a.owner === it.owner) || accounts[Number(it.slot || 0) % Math.max(accounts.length, 1)] || null;
  const owner = acct?.owner || it.owner || "Peter";
  const now = new Date().toISOString();

  // Pipeline person + task (same as "Add to pipeline"), so the Daily 3 / Scoreboard count it.
  let personId = sig.person_id || null;
  if (!personId) {
    const facts = `${company}: ${(sig.reasons || []).filter((x: any) => x.tone === "good").map((x: any) => x.text).join(". ")}`;
    const pr = await sb.from("people").insert({ name: p.name, primary_side: "Sell Side", relationship_type: "Sell-side Relationship", pipeline_stage: "New Relationship", pipeline_active: true,
      waiting_on: "them", waiting_on_since: now, company_name: company, headline: p.title || (p.role === "ceo" ? "CEO" : "CFO"), linkedin_url: p.linkedin || null, has_linkedin: !!p.linkedin,
      source: SOURCE[kind], last_inbound_message: facts }).select().single();
    if (pr.error) throw new Error(pr.error.message);
    personId = pr.data.id;
    await sb.from("tasks").insert({ person_id: personId, action: "Outreach sent (LinkedIn + email). Watch for a reply.", owner_name: owner, due_date: now.slice(0, 10) });
    await sb.from(TABLE[kind]).update({ status: "added", person_id: personId, updated_at: now }).eq(KEYCOL[kind], key);
  }

  const variant = pickVariant(deadline, acct, st, it.variant);
  const campaign = variant === "dated" ? acct?.campaign_id : variant === "plain" ? acct?.plain_campaign_id : null;
  const row: any = { kind, key, company_name: company, person_name: p.name, title: p.title || null, linkedin_url: p.linkedin || null, email, owner, person_id: personId, approved_by: who, variant, deadline };
  // LinkedIn via Prosp: standard fields so the row is complete and {{First name}} works; deadline only on the dated campaign.
  if (p.linkedin && acct && keys.prosp && campaign) {
    try {
      const data = [["firstName", first], ["lastName", last], ["name", p.name], ["jobTitle", p.title || (p.role === "ceo" ? "CEO" : p.role === "cfo" ? "CFO" : "")],
        ["company", short], ["email", email || ""], ["phoneNumber", c?.phone || ""], ["websiteUrl", c?.website || ""], ...(variant === "dated" ? [["deadline", deadline]] : [])]
        .filter(([, v]) => v).map(([property, value]) => ({ property, value }));
      await post(`${PROSP}/leads`, { api_key: keys.prosp, linkedin_url: p.linkedin, list_id: acct.list_id, campaign_id: campaign, data });
      row.prosp_status = "added"; row.prosp_campaign_id = campaign;
    } catch (e) { row.prosp_status = "failed"; row.prosp_error = String((e as Error).message || e); }
  } else row.prosp_status = !p.linkedin ? "skipped: no LinkedIn" : !keys.prosp ? "skipped: no Prosp key" : !acct ? "skipped: no Prosp campaign for this account"
    : "skipped: no date to cite and no plain campaign";
  // Email via PlusVibe. LinkedIn first: if the LinkedIn step went out, the email waits email_delay_days and the cron sends it
  // only if they haven't replied on LinkedIn. No LinkedIn = email now.
  const lead = { email, first_name: first, last_name: last, company_name: short, company_website: c?.website || undefined, linkedin_person_url: p.linkedin || undefined,
    phone_number: c?.phone || undefined, custom_variables: { deadline: deadline || "", title: p.title || "" } };
  if (email && keys.pv && st.plusvibe_workspace_id && st.plusvibe_campaign_id) {
    if (row.prosp_status === "added") {
      row.plusvibe_status = "scheduled"; row.email_payload = lead;
      row.email_due_at = new Date(Date.now() + (st.email_delay_days ?? 3) * 864e5).toISOString();
    } else Object.assign(row, await addEmail(lead, st, keys.pv));
  } else row.plusvibe_status = !email ? "skipped: no valid email" : !keys.pv ? "skipped: no PlusVibe key" : "skipped: no PlusVibe campaign set";
  if (row.prosp_status !== "added" && row.variant !== "email_only") row.variant = "email_only";
  row.status = row.prosp_status === "added" || row.plusvibe_status === "added" || row.plusvibe_status === "scheduled" ? "sent" : "failed";
  // A stopped enrollment (test sends, wrong person: status "stopped") is replaced, not duplicated.
  const ins = await sb.from("outreach_enrollments").upsert({ ...row, status: row.status, replied_at: null, reply_channel: null, created_at: new Date().toISOString() }, { onConflict: "kind,key" });
  if (ins.error) throw new Error(ins.error.message);
  return row;
}

// Dated trigger → dated campaign, except test_split of them go plain (when the account has a plain campaign) so we learn whether
// the date actually earns replies. No date → plain, else email only. HQ can force a variant (it.variant) after showing the preview.
export function pickVariant(deadline: string | null, acct: any, st: any, forced?: string) {
  const plain = !!acct?.plain_campaign_id, dated = !!acct?.campaign_id;
  if (forced === "plain" && plain) return "plain";
  if (forced === "dated" && dated && deadline) return "dated";
  if (deadline && dated) return plain && Math.random() >= Number(st.test_split ?? 0.5) ? "plain" : "dated";
  return plain ? "plain" : "email_only";
}

async function addEmail(lead: any, st: any, pvKey: string) {
  try {
    const r = await post(`${PV}/lead/add`, { workspace_id: st.plusvibe_workspace_id, campaign_id: st.plusvibe_campaign_id, skip_lead_in_active_pause_camp: true, leads: [lead] }, { "x-api-key": pvKey });
    return { plusvibe_status: (r?.leads_uploaded ?? 1) > 0 ? "added" : `skipped: ${r?.already_in_campaign ? "already in campaign" : r?.invalid_email_count ? "invalid email" : "not uploaded"}` };
  } catch (e) { return { plusvibe_status: "failed", plusvibe_error: String((e as Error).message || e) }; }
}

async function stopEmail(e: any, st: any, pvKey: string) {
  if (!e.email || e.plusvibe_status !== "added" || !pvKey || !st.plusvibe_workspace_id) return;
  try { await post(`${PV}/lead/update/status`, { workspace_id: st.plusvibe_workspace_id, campaign_id: st.plusvibe_campaign_id, email: e.email, new_status: "COMPLETED" }, { "x-api-key": pvKey }); } catch (_) { /* keep going */ }
}
async function stopLinkedIn(e: any, prospKey: string) {
  if (!e.linkedin_url || e.prosp_status !== "added" || !prospKey) return;
  try { await post(`${PROSP}/leads/campaign/delete`, { api_key: prospKey, linkedin_url: e.linkedin_url }); } catch (_) { /* keep going */ }
}
const slug = (u: string) => String(u || "").toLowerCase().replace(/[?#].*$/, "").replace(/\/+$/, "").split("/").pop() || "";

async function plusvibeReply(b: any) {
  const st = await settings(), email = String(b.email || b.from_email || "").toLowerCase();
  const e = email ? (await sb.from("outreach_enrollments").select("*").ilike("email", email).maybeSingle()).data : null;
  const hash = `plusvibe:${b.message_id || b.source_message_id || b.thread_id || email + ":" + (b.created_at || Date.now())}`;
  const positive = String(b.label || "").toUpperCase() === "INTERESTED" || String(b.sentiment || "").toUpperCase() === "POSITIVE";
  await sb.from("lead_intake").upsert({ source: "plusvibe", external_lead_id: b.lead_id || null, linkedin_url: b.linkedin_person_url || e?.linkedin_url || null,
    name: [b.first_name, b.last_name].filter(Boolean).join(" ") || e?.person_name || email, headline: b.job_title || e?.title || null, company_name: b.company_name || e?.company_name || null,
    reply_text: String(b.text_body || b.snippet || "").slice(0, 4000), campaign_id: b.campaign_id || null, campaign_name: b.campaign_name || "PlusVibe email",
    source_account: b.from_email ? `email:${b.to_email || b.email_account_name || ""}` : null, decision: positive ? "qualified_sell_side" : "needs_review",
    reason: `Email reply (${b.label || "no label"}, ${b.sentiment || "no sentiment"})`, person_id: null, payload_hash: hash, raw_payload: b }, { onConflict: "payload_hash", ignoreDuplicates: true });
  if (e && e.status === "sent") {
    await sb.from("outreach_enrollments").update({ status: "replied", reply_channel: "email", replied_at: new Date().toISOString() }).eq("id", e.id);
    await stopLinkedIn(e, await secret("PROSP_API_KEY"));
    if (e.person_id) await sb.from("people").update({ waiting_on: "us", waiting_on_since: new Date().toISOString() }).eq("id", e.person_id);
  }
  return { stored: true, matched: !!e };
}

async function cron() {
  const st = await settings(), pv = await secret("PLUSVIBE_API_KEY"), pk = await secret("PROSP_API_KEY");
  // 1. LinkedIn replies (Prosp → lead_intake) stop the email sequence.
  const open = (await sb.from("outreach_enrollments").select("*").eq("status", "sent").not("linkedin_url", "is", null).limit(1000)).data || [];
  let stopped = 0;
  if (open.length) {
    const since = open.reduce((m: string, e: any) => e.created_at < m ? e.created_at : m, open[0].created_at);
    const replies = (await sb.from("lead_intake").select("linkedin_url,created_at,source").gte("created_at", since).neq("source", "plusvibe").limit(5000)).data || [];
    for (const e of open as any[]) {
      const hit = (replies as any[]).find(r => slug(r.linkedin_url) && slug(r.linkedin_url) === slug(e.linkedin_url) && r.created_at > e.created_at);
      if (!hit) continue;
      await sb.from("outreach_enrollments").update({ status: "replied", reply_channel: "linkedin", replied_at: hit.created_at }).eq("id", e.id);
      await stopEmail(e, st, pv); stopped++;
      if (e.plusvibe_status === "scheduled") await sb.from("outreach_enrollments").update({ plusvibe_status: "skipped: replied on LinkedIn" }).eq("id", e.id);
    }
  }
  // 1b. Emails waiting behind LinkedIn: due and still no reply → PlusVibe now.
  let emailed = 0;
  const due = (await sb.from("outreach_enrollments").select("*").eq("status", "sent").eq("plusvibe_status", "scheduled").lte("email_due_at", new Date().toISOString()).limit(50)).data || [];
  for (const e of due as any[]) {
    if (!pv || !st.plusvibe_workspace_id || !st.plusvibe_campaign_id || !e.email_payload) continue;
    const res = await addEmail(e.email_payload, st, pv);
    await sb.from("outreach_enrollments").update(res).eq("id", e.id);
    if (res.plusvibe_status === "added") emailed++;
  }
  // 2. Once a day: Prosp analytics per campaign → outreach_daily.
  const last = (await sb.from("outreach_daily").select("day").eq("channel", "linkedin").order("day", { ascending: false }).limit(1)).data?.[0]?.day;
  const today = new Date().toISOString().slice(0, 10);
  let pulled = 0;
  if (pk && last !== today) {
    const d = (x: Date) => `${String(x.getUTCDate()).padStart(2, "0")}-${String(x.getUTCMonth() + 1).padStart(2, "0")}-${x.getUTCFullYear()}`;
    const end = new Date(), start = new Date(Date.now() - 7 * 864e5), totals = new Map<string, number>();
    for (const a of (st.prosp || []).filter((x: any) => x.campaign_id)) {
      try {
        const j = await post(`${PROSP}/campaigns/analytics`, { api_key: pk, campaign_id: a.campaign_id, start_date: d(start), end_date: d(end) });
        for (const r of j?.data || []) { const k = `${String(r.date).slice(0, 10)}|${String(r.action || "other").toLowerCase().replace(/\s+/g, "_")}`; totals.set(k, (totals.get(k) || 0) + (Number(r.count) || 0)); }
      } catch (_) { /* next campaign */ }
    }
    const rows = [...totals].map(([k, n]) => { const [day, action] = k.split("|"); return { day: /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : today, channel: "linkedin", action, count: n }; });
    if (rows.length) { await sb.from("outreach_daily").upsert(rows, { onConflict: "day,channel,action" }); pulled = rows.length; }
  }
  return { stopped, emailed, pulled };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const url = new URL(req.url);
    const body = await req.json().catch(() => ({}));
    if (url.searchParams.get("hook") === "plusvibe") {
      const want = await secret("PLUSVIBE_WEBHOOK_TOKEN");
      if (!want || url.searchParams.get("token") !== want) return json({ ok: false, error: "Bad token" }, 401);
      const ev = String(body.webhook_event || body.event || "").toUpperCase();
      if (ev && !ev.includes("REPL")) return json({ ok: true, ignored: ev });
      return json({ ok: true, ...(await plusvibeReply(body)) });
    }
    const cronKey = req.headers.get("x-outerhaven-cron");
    if (cronKey) {
      const want = await secret("LINKEDIN_CRON_SECRET");
      if (!want || cronKey !== want) return json({ ok: false, error: "Bad cron key." }, 401);
      return json({ ok: true, ...(await cron()) });
    }
    const user = await admin(req);
    if (!user) return json({ ok: false, error: "Admins only." }, 403);
    if (body.action === "campaigns") {
      const pk = await secret("PROSP_API_KEY");
      if (!pk) return json({ ok: false, error: "No Prosp key yet." }, 400);
      const j = await post(`${PROSP}/campaigns/lists`, { api_key: pk });
      return json({ ok: true, prosp: j?.data || [] });
    }
    if (body.action === "send") {
      const st = await settings(), keys = { prosp: await secret("PROSP_API_KEY"), pv: await secret("PLUSVIBE_API_KEY") };
      const who = (user.email || "").split("@")[0], out: any[] = [];
      for (const [i, it] of (Array.isArray(body.items) ? body.items : []).slice(0, 40).entries()) {
        try { out.push(await sendOne({ ...it, slot: i }, st, keys, who)); } catch (e) { out.push({ kind: it.kind, key: it.key, error: String((e as Error).message || e) }); }
      }
      return json({ ok: true, results: out });
    }
    return json({ ok: false, error: "Unknown action" }, 400);
  } catch (e) {
    return json({ ok: false, error: String((e as Error)?.message || e) }, 500);
  }
});
