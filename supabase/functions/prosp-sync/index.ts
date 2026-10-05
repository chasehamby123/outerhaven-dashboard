// prosp-sync: pulls the outbound funnel for the Prosp accounts (Peter, Chase, Tengku) into prosp_stats.
// Auth: HQ admin JWT, or header x-outerhaven-cron = LINKEDIN_CRON_SECRET (pg_cron every 6h).
// Prosp's response shapes are not documented to us, so everything is read defensively and the raw status values are stored
// (prosp_stats.statuses) so HQ can show them and the stage mapping below can be tuned.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!, ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!, SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PROSP_BASE = "https://prosp.ai/api/v1", WORKSPACE_ID = "6a2822a4-0427-40cc-acd3-217da45ce2e5";
const BUDGET_MS = 100_000, MAX_PAGES = 40, PAGE_SIZE = 100;
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "content-type": "application/json" } });
const txt = (v: any) => (typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : "");
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
function walk(v: any, cb: (k: string, v: any) => void) { if (!v || typeof v !== "object") return; if (Array.isArray(v)) { for (const x of v) walk(x, cb); return; } for (const [k, x] of Object.entries(v)) { cb(k, x); if (x && typeof x === "object") walk(x, cb); } }
function local(o: any, keys: string[]) { if (!o || typeof o !== "object" || Array.isArray(o)) return ""; const w = new Set(keys.map(norm)); for (const [k, v] of Object.entries(o)) if (w.has(norm(k)) && txt(v)) return txt(v); return ""; }
function deep(o: any, keys: string[]) { const w = new Set(keys.map(norm)); let out = ""; walk(o, (k, v) => { if (!out && w.has(norm(k)) && txt(v)) out = txt(v); }); return out; }
function bestArray(o: any, hints: string[]) {
  const arrs: any[][] = []; walk(o, (_k, v) => { if (Array.isArray(v) && v.some((x) => x && typeof x === "object")) arrs.push(v); });
  if (Array.isArray(o) && o.some((x) => x && typeof x === "object")) arrs.push(o);
  const w = new Set(hints.map(norm));
  const score = (a: any[]) => { let s = a.length; for (const x of a.slice(0, 8)) if (x && typeof x === "object") for (const k of Object.keys(x)) if (w.has(norm(k))) s += 12; return s; };
  return arrs.sort((a, b) => score(b) - score(a))[0] || [];
}
async function prosp(key: string, path: string, payload: any, timeout = 8000) {
  const c = new AbortController(), t = setTimeout(() => c.abort(), timeout);
  try {
    const r = await fetch(`${PROSP_BASE}/${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ api_key: key, ...payload }), signal: c.signal });
    const raw = await r.text(); let data: any = null; try { data = raw ? JSON.parse(raw) : null; } catch { data = { raw: raw.slice(0, 500) }; }
    return { ok: r.ok, status: r.status, data };
  } catch (e) { return { ok: false, status: 0, data: { error: String(e) } }; } finally { clearTimeout(t); }
}
async function firstOk(key: string, path: string, tries: any[]) { let last: any = null; for (const p of tries) { last = await prosp(key, path, p); if (last.ok) return last; } return last; }

// Stage of a lead from the status/stage words Prosp gives it. Most advanced stage wins.
const STAGES: [string, RegExp][] = [
  ["replied", /repl|respon|interested|meeting|booked|positive/],
  ["messaged", /messag|dm\b|follow.?up|sent.?msg|contacted/],
  ["connected", /connected|accepted|connection.?(accepted|made)|first.?degree/],
  ["invited", /invit|pending|request.?sent|connection.?(sent|request)/],
  ["queued", /queue|new|added|imported|waiting|scheduled|not.?started|todo|pending.?start/],
];
function leadStatus(l: any): string {
  const vals: string[] = [];
  walk(l, (k, v) => { const nk = norm(k); if ((nk.includes("status") || nk.includes("stage") || nk.includes("state")) && (typeof v === "string") && v.trim()) vals.push(v.trim().toLowerCase()); else if ((nk.includes("repl") || nk.includes("respond")) && v === true) vals.push("replied"); });
  return vals.join(" | ").slice(0, 80) || "(none)";
}
function stageOf(status: string) { for (const [s, re] of STAGES) if (re.test(status)) return s; return "other"; }
function slugOf(url: string) { const m = url.toLowerCase().match(/linkedin\.com\/in\/([^/?#]+)/); return m ? m[1] : ""; }

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const cronHdr = req.headers.get("x-outerhaven-cron") || "";
  let allowed = false;
  if (cronHdr) { const { data } = await sb.from("integration_secrets").select("secret_value").eq("key", "LINKEDIN_CRON_SECRET").maybeSingle(); allowed = !!data && data.secret_value === cronHdr; }
  if (!allowed) {
    const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: req.headers.get("authorization") || "" } }, auth: { persistSession: false } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user?.email) return json({ error: "unauthorized" }, 401);
    const { data: acc } = await sb.from("dashboard_access").select("email").ilike("email", user.email).maybeSingle();
    if (!acc) return json({ error: "forbidden" }, 403);
  }

  const started = Date.now();
  const run = await sb.from("prosp_sync_runs").insert({ ok: false }).select("id").single();
  const finish = async (ok: boolean, f: any) => { if (run.data) await sb.from("prosp_sync_runs").update({ ok, ...f }).eq("id", run.data.id); };
  const { data: ks } = await sb.from("integration_secrets").select("secret_value").eq("key", "PROSP_API_KEY").maybeSingle();
  const key = ks?.secret_value;
  if (!key) { await finish(false, { error: "PROSP_API_KEY not set" }); return json({ ok: false, error: "Paste the Prosp API key in HQ → Growth → Outbound first." }); }

  const cr = await firstOk(key, "campaigns/lists", [{ workspace_id: WORKSPACE_ID }, { workspaceId: WORKSPACE_ID }, {}]);
  if (!cr?.ok) { await finish(false, { error: `campaigns/lists ${cr?.status}`, detail: { body: cr?.data } }); return json({ ok: false, error: `Prosp refused the campaign list (HTTP ${cr?.status}). Check the API key.`, prosp: cr?.data }); }
  const campaigns = bestArray(cr.data, ["campaign_id", "campaignId", "name", "campaign_name"]);

  const { data: accts } = await sb.from("daily_ops_accounts").select("owner_name,linkedin_url").eq("active", true);
  const bySlug = new Map((accts || []).map((a: any) => [slugOf(a.linkedin_url || ""), a.owner_name]).filter((x: any) => x[0]));
  const { data: li } = await sb.from("lead_intake").select("campaign_id,source_account").eq("source", "Prosp").not("campaign_id", "is", null).not("source_account", "is", null).limit(2000);
  const fromIntake = new Map<string, string>(); for (const r of li || []) if (!fromIntake.has(r.campaign_id)) fromIntake.set(r.campaign_id, r.source_account);
  const accountFor = (s: string) => { const sl = slugOf(s) || s.toLowerCase(); for (const [k, v] of bySlug) if (k && (sl === k || sl.includes(k) || k.includes(sl))) return v as string; return null; };

  let leadsTotal = 0, truncatedAny = false; const rows: any[] = []; const errors: any[] = [];
  for (const c of campaigns) {
    const cid = local(c, ["campaign_id", "campaignId", "id", "_id"]); if (!cid) continue;
    if (Date.now() - started > BUDGET_MS) { truncatedAny = true; break; }
    const seen = new Set<string>(); const counts: Record<string, number> = { queued: 0, invited: 0, connected: 0, messaged: 0, replied: 0, other: 0 }; const statuses: Record<string, number> = {};
    let truncated = false, firstFail: any = null;
    for (let page = 1; page <= MAX_PAGES; page++) {
      if (Date.now() - started > BUDGET_MS) { truncated = true; break; }
      const r = await firstOk(key, "campaigns/leads", [{ campaign_id: cid, page, limit: PAGE_SIZE }, { campaignId: cid, page, limit: PAGE_SIZE }, { workspace_id: WORKSPACE_ID, campaign_id: cid, page, limit: PAGE_SIZE }]);
      if (!r?.ok) { if (page === 1) firstFail = r?.status; break; }
      const leads = bestArray(r.data, ["lead_id", "leadId", "linkedin_url", "linkedinUrl", "name", "status", "stage"]);
      let added = 0;
      for (const l of leads) {
        const id = local(l, ["lead_id", "leadId", "id", "_id"]) || deep(l, ["linkedin_url", "linkedinUrl", "profile_url", "profileUrl"]) || JSON.stringify(l).slice(0, 200);
        if (seen.has(id)) continue; seen.add(id); added++;
        const st = leadStatus(l); statuses[st] = (statuses[st] || 0) + 1; counts[stageOf(st)]++;
      }
      if (!added || leads.length < PAGE_SIZE && page > 1) break;   // no new leads: done (or the API ignores paging and repeats page 1)
      if (page === MAX_PAGES) truncated = true;
    }
    if (firstFail) { errors.push({ campaign: cid, status: firstFail }); continue; }
    leadsTotal += seen.size; truncatedAny ||= truncated;
    const sender = deep(c, ["sender", "sender_url", "senderUrl", "linkedin_sender", "account_url", "sender_linkedin_url"]);
    const account = (sender && accountFor(sender)) || (fromIntake.get(cid) ? accountFor(fromIntake.get(cid)!) : null);
    rows.push({ campaign_id: cid, campaign_name: local(c, ["campaign_name", "campaignName", "name", "title"]) || null, sender: sender || null, account_name: account,
      leads: seen.size, ...counts, statuses, truncated });
  }
  if (rows.length) { const ins = await sb.from("prosp_stats").insert(rows); if (ins.error) { await finish(false, { error: ins.error.message }); return json({ ok: false, error: ins.error.message }); } }
  await finish(true, { campaigns: rows.length, leads: leadsTotal, detail: { errors, truncated: truncatedAny, ms: Date.now() - started, campaigns_seen: campaigns.length } });
  return json({ ok: true, campaigns: rows.length, campaigns_seen: campaigns.length, leads: leadsTotal, truncated: truncatedAny, errors, statuses: Object.fromEntries(rows.map((r) => [r.campaign_name || r.campaign_id, r.statuses])) });
});
