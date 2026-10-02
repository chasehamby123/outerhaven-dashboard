// Fund signals: finds US funds raising money right now (Form D filings) and Fund I managers due to raise Fund II.
// Data comes from EDGAR through the Apify actor logiover/sec-edgar-form-d-scraper (pay per result, each run capped).
// Actions (admin JWT): scan {list}, check {ids}, poll, reclassify. Cron (x-outerhaven-cron): poll + the weekly scan
// when growth_settings.fund_scan_enabled is on. Rules live in rules.js; every verdict stores its reasons.
import { createClient } from "npm:@supabase/supabase-js@2";
import { normalize, classify, readCheck, money, RULES_VERSION } from "./rules.js";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
const ACTOR = "logiover~sec-edgar-form-d-scraper";
const APIFY = "https://api.apify.com/v2";
const DAY = 864e5;

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "content-type": "application/json" } });
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);

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
  const role = await u.rpc("dashboard_role");
  return role.data === "admin" ? user : null;
}
async function settings() {
  const r = await sb.from("growth_settings").select("fund_scan_enabled,fund_monthly_budget").eq("id", 1).maybeSingle();
  return { enabled: r.data?.fund_scan_enabled === true, budget: Number(r.data?.fund_monthly_budget) || 10 };
}
// Spent this month = real cost of finished runs + the cap of runs still going (worst case).
async function spend() {
  const start = new Date(); start.setUTCDate(1); start.setUTCHours(0, 0, 0, 0);
  const r = await sb.from("fund_signal_runs").select("status,cost_usd,cap_usd").gte("created_at", start.toISOString());
  return (r.data || []).reduce((n, x: any) => n + (x.status === "running" ? Number(x.cap_usd) || 0 : Number(x.cost_usd) || 0), 0);
}

async function apify(path: string, init: RequestInit = {}) {
  const token = await secret("APIFY_TOKEN");
  if (!token) throw new Error("No Apify token saved (HQ → Growth → Scraper).");
  const res = await fetch(`${APIFY}${path}${path.includes("?") ? "&" : "?"}token=${encodeURIComponent(token)}`, init);
  const body = await res.text();
  if (!res.ok) throw new Error(`Apify ${res.status}: ${body.slice(0, 200)}`);
  return JSON.parse(body);
}
async function startRun(kind: string, input: Record<string, unknown>, cap: number, params: Record<string, unknown>, by: string | null) {
  const r = await apify(`/acts/${ACTOR}/runs?maxTotalChargeUsd=${cap}&timeout=3600`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ formType: "D", proxyConfiguration: { useApifyProxy: true }, ...input }) });
  const ins = await sb.from("fund_signal_runs").insert({ kind, apify_run_id: r.data.id, dataset_id: r.data.defaultDatasetId, params: { ...params, input }, cap_usd: cap, created_by: by }).select("id").single();
  if (ins.error) throw new Error(ins.error.message);
  return ins.data.id;
}

// ---- Scans ----
// live: funds that filed in the window with II or III in the name. fund1: Fund I filings from 3–4 years ago, split
// into 3-month windows so one slow run can't cut the list short.
async function scan(list: string, from: string | undefined, to: string | undefined, by: string | null) {
  const s = await settings(), now = Date.now();
  const plan: { input: Record<string, unknown>; cap: number }[] = [];
  if (list === "live") {
    const f = from || iso(now - 30 * DAY), t = to || iso(now);
    for (const keyword of ["II", "III"]) plan.push({ input: { dateFrom: f, dateTo: t, keyword, industry: "Banking & Financial Services", minAmount: 25000000, maxResults: 300 }, cap: 1.2 });
  } else if (list === "fund1") {
    const t0 = from ? Date.parse(from) : now - 48 * 30.44 * DAY, t1 = to ? Date.parse(to) : now - 36 * 30.44 * DAY;
    for (let a = t0; a < t1; a += 91 * DAY) plan.push({ input: { dateFrom: iso(a), dateTo: iso(Math.min(a + 90 * DAY, t1)), keyword: "I", industry: "Banking & Financial Services", minAmount: 10000000, maxResults: 250 }, cap: 1 });
  } else throw new Error("Unknown list");
  const need = plan.reduce((n, p) => n + p.cap, 0), used = await spend();
  if (used + need > s.budget) throw new Error(`This scan can cost up to $${need.toFixed(2)} and only $${Math.max(0, s.budget - used).toFixed(2)} of the $${s.budget} monthly fund-signals budget is left. Raise it in the tab's settings.`);
  const ids = [];
  for (const p of plan) ids.push(await startRun(list === "live" ? "scan_live" : "scan_fund1", p.input, p.cap, { list }, by));
  return { started: ids.length, max_cost: need };
}

// ---- Fund II checks: every later filing (D and D/A) under the manager's name since the original filing ----
async function check(ids: string[], by: string | null) {
  const r = await sb.from("fund_signals").select("*").in("id", ids.slice(0, 40));
  const byMgr = new Map<string, any[]>();
  for (const s of r.data || []) { if (!s.check_keyword) continue; const k = s.manager_key; byMgr.set(k, [...(byMgr.get(k) || []), s]); }
  const cap = 0.3, need = byMgr.size * cap, used = await spend(), { budget } = await settings();
  if (used + need > budget) throw new Error(`Checks can cost up to $${need.toFixed(2)}; only $${Math.max(0, budget - used).toFixed(2)} of the monthly budget is left.`);
  let started = 0;
  for (const [, group] of byMgr) {
    const s = group[0], from = s.filing_date ? iso(Date.parse(s.filing_date) + DAY) : iso(Date.now() - 4 * 365 * DAY);
    try {
      await startRun("check", { dateFrom: from, dateTo: iso(Date.now()), keyword: s.check_keyword, formType: "D_AND_DA", maxResults: 80 }, cap, { keyword: s.check_keyword, manager_key: s.manager_key, signal_ids: group.map((x: any) => x.id) }, by);
      await sb.from("fund_signals").update({ check_status: "checking", updated_at: new Date().toISOString() }).in("id", group.map((x: any) => x.id));
      started++;
    } catch (e) { await sb.from("fund_signals").update({ check_status: "error", check_note: String(e instanceof Error ? e.message : e).slice(0, 300) }).in("id", group.map((x: any) => x.id)); }
  }
  return { started };
}

async function judge(rows: any[]) {
  for (let i = 0; i < rows.length; i += 20) await Promise.all(rows.slice(i, i + 20).map(s => {
    const c = classify(s);
    return sb.from("fund_signals").update({ verdict: c.verdict, score: c.score, reasons: c.reasons, rules_version: RULES_VERSION, updated_at: new Date().toISOString() }).eq("id", s.id);
  }));
}

// ---- Poll: collect finished runs, store, judge ----
async function poll() {
  const runs = (await sb.from("fund_signal_runs").select("*").eq("status", "running").order("created_at").limit(20)).data || [];
  let finished = 0;
  for (const run of runs) {
    let info: any;
    try { info = (await apify(`/actor-runs/${run.apify_run_id}`)).data; } catch (e) { continue; }
    const age = Date.now() - Date.parse(run.created_at);
    if (["READY", "RUNNING"].includes(info.status)) {
      if (age < 2 * 3600e3) continue;
      try { await apify(`/actor-runs/${run.apify_run_id}/abort`, { method: "POST" }); } catch { }
    }
    let items: any[] = [];
    try { items = await apify(`/datasets/${run.dataset_id}/items?clean=true&format=json&limit=1000`); } catch { }
    const ok = info.status === "SUCCEEDED" || items.length > 0;
    const out: any = { status: ok ? "done" : "failed", items: items.length, cost_usd: Number(info.usageTotalUsd) || 0, finished_at: new Date().toISOString(), error: ok ? (info.status === "SUCCEEDED" ? null : `Run ${info.status}; kept the ${items.length} results it found`) : `Run ${info.status}` };
    if (run.kind === "check") {
      const ids = run.params?.signal_ids || [];
      const sigs = (await sb.from("fund_signals").select("*").in("id", ids)).data || [];
      for (const s of sigs) {
        if (!ok) { await sb.from("fund_signals").update({ check_status: "error", check_note: out.error, checked_at: out.finished_at }).eq("id", s.id); continue; }
        const c = readCheck(s, items), patch: any = { check_status: c.status, check_note: c.note, later: c.later, checked_at: out.finished_at };
        if (c.latest) {
          if (c.latest.sold != null) patch.sold = c.latest.sold;
          if (c.latest.offering != null) patch.offering = c.latest.offering;
          const off = patch.offering ?? s.offering, sold = patch.sold ?? s.sold;
          if (Date.now() - Date.parse(c.latest.date) < 400 * DAY && (!off || sold / off < 0.6)) patch.still_raising = `${money(sold)}${off ? ` of ${money(off)}` : ''} as of ${c.latest.date}`;
        }
        await sb.from("fund_signals").update(patch).eq("id", s.id);
      }
      await judge((await sb.from("fund_signals").select("*").in("id", ids)).data || []);
    } else if (ok) {
      const list = run.kind === "scan_live" ? "live" : "fund1";
      const seen = new Set<string>();
      const rows = items.filter(it => it.companyName).map(it => normalize(it, list)).filter(r => !seen.has(r.accession) && seen.add(r.accession));
      const accs = rows.map(r => r.accession);
      const existing = new Set(((await sb.from("fund_signals").select("accession").in("accession", accs)).data || []).map((x: any) => x.accession));
      // New filings are inserted; known ones get fresh numbers but keep their status, check and notes.
      for (let i = 0; i < rows.length; i += 200) {
        const chunk = rows.slice(i, i + 200);
        const fresh = chunk.filter(r => !existing.has(r.accession)), known = chunk.filter(r => existing.has(r.accession));
        if (fresh.length) await sb.from("fund_signals").insert(fresh);
        await Promise.all(known.map(r => { const { accession, list: _l, ...rest } = r; return sb.from("fund_signals").update({ ...rest, updated_at: new Date().toISOString() }).eq("accession", accession); }));
      }
      out.added = rows.filter(r => !existing.has(r.accession)).length;
      await judge((await sb.from("fund_signals").select("*").in("accession", accs)).data || []);
    }
    await sb.from("fund_signal_runs").update(out).eq("id", run.id);
    finished++;
  }
  return { checked: runs.length, finished };
}

// Weekly (cron, switch on): last week's live filings, the Fund I week that just turned 3.5 years old, and a Fund II
// check on new Fund I targets.
async function weekly() {
  const s = await settings(); if (!s.enabled) return { weekly: "off" };
  const last = await sb.from("fund_signal_runs").select("created_at").in("kind", ["scan_live"]).is("created_by", null).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (last.data && Date.now() - Date.parse(last.data.created_at) < 6.5 * DAY) return { weekly: "not due" };
  const now = Date.now(), out: any = {};
  try { out.live = await scan("live", iso(now - 8 * DAY), iso(now), null); } catch (e) { out.live = String(e); }
  const c = now - 42 * 30.44 * DAY;
  try { out.fund1 = await scan("fund1", iso(c - 7 * DAY), iso(c), null); } catch (e) { out.fund1 = String(e); }
  const todo = (await sb.from("fund_signals").select("id").eq("list", "fund1").eq("verdict", "target").is("check_status", null).limit(20)).data || [];
  if (todo.length) { try { out.checks = await check(todo.map((x: any) => x.id), null); } catch (e) { out.checks = String(e); } }
  return out;
}

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const body = await req.json().catch(() => ({}));
    const cron = req.headers.get("x-outerhaven-cron");
    if (cron) {
      if (cron !== await secret("FUND_CRON_SECRET")) return json({ ok: false, error: "bad cron secret" }, 401);
      const p = await poll();
      const stale = (await sb.from("fund_signals").select("*").lt("rules_version", RULES_VERSION).limit(500)).data || [];
      if (stale.length) await judge(stale);
      return json({ ok: true, poll: p, rejudged: stale.length, weekly: await weekly() });
    }
    const user = await admin(req);
    if (!user) return json({ ok: false, error: "Admins only." }, 403);
    if (body.action === "scan") return json({ ok: true, ...(await scan(body.list, body.from, body.to, user.id)) });
    if (body.action === "check") return json({ ok: true, ...(await check(body.ids || [], user.id)) });
    if (body.action === "poll") return json({ ok: true, ...(await poll()) });
    if (body.action === "reclassify") {
      const rows = (await sb.from("fund_signals").select("*").limit(5000)).data || [];
      await judge(rows); return json({ ok: true, judged: rows.length });
    }
    if (body.action === "status") { const s = await settings(); return json({ ok: true, ...s, spent: await spend() }); }
    return json({ ok: false, error: "Unknown action" }, 400);
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : String(e) }, 200);
  }
});
