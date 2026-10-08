// bdc-signals: stores and judges BDC-financed private companies (scripts/bdc_signals.py on GitHub, SEC BDC data sets).
// Ingest (header x-fund-ingest = FUND_INGEST_SECRET, same as fund-signals): kind 'bdc' {items, run}, kind 'bdc_done' {run, complete, stats}.
// Admin (user JWT): action 'rejudge' re-scores every row with the current rules.js. Rules live in rules.js.
import { createClient } from "npm:@supabase/supabase-js@2";
import { classifyBdc, BDC_RULES_VERSION } from "./rules.js";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!, SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-fund-ingest", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "content-type": "application/json" } });
const COLS = ["company_key", "company_name", "industry", "country", "facility", "fair", "mark", "prev_mark", "maturity", "earliest_maturity", "spread",
  "pik", "nonaccrual", "controlled", "affiliated", "equity_held", "lenders", "holders", "period", "sample", "public_ticker"];
const BOOL = new Set(["pik", "nonaccrual", "controlled", "affiliated", "equity_held"]);

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
async function judge(rows: any[]) {
  for (let i = 0; i < rows.length; i += 25) await Promise.all(rows.slice(i, i + 25).map(s => {
    const c = classifyBdc(s);
    return sb.from("bdc_signals").update({ verdict: c.verdict, score: c.score, reasons: c.reasons, rules_version: BDC_RULES_VERSION }).eq("id", s.id);
  }));
}
async function pageAll(build: (from: number) => any) {
  const out: any[] = [];
  for (let from = 0; ; from += 1000) { const r = await build(from); if (r.error) throw new Error(r.error.message); out.push(...(r.data || [])); if ((r.data || []).length < 1000) return out; }
}

async function ingest(body: any) {
  if (body.kind === "bdc") {
    const seen = new Set<string>();
    const rows = (Array.isArray(body.items) ? body.items.slice(0, 500) : []).filter((it: any) => it?.company_key && it?.company_name && !seen.has(it.company_key) && seen.add(it.company_key))
      .map((it: any) => ({ ...Object.fromEntries(COLS.map(k => [k, BOOL.has(k) ? !!it[k] : it[k] ?? null])), holders: it.holders || [], lenders: it.lenders || 0,
        last_run: body.run || null, on_latest: true, updated_at: new Date().toISOString() }));
    if (!rows.length) return { added: 0 };
    const keys = rows.map((r: any) => r.company_key);
    const before = new Set(((await sb.from("bdc_signals").select("company_key").in("company_key", keys)).data || []).map((x: any) => x.company_key));
    const up = await sb.from("bdc_signals").upsert(rows, { onConflict: "company_key" }); // status / person / notes / marks untouched
    if (up.error) throw new Error(up.error.message);
    await judge((await sb.from("bdc_signals").select("*").in("company_key", keys)).data || []);
    return { added: keys.filter((k: string) => !before.has(k)).length };
  }
  if (body.kind === "bdc_done") {
    if (!body.run) throw new Error("run missing");
    let dropped = 0;
    // Only a complete run (100+ BDCs read) may drop companies that dropped out of the filings or no longer qualify.
    if (body.complete) {
      const gone = await pageAll(from => sb.from("bdc_signals").select("*").or(`last_run.is.null,last_run.neq."${body.run}"`).eq("on_latest", true).range(from, from + 999));
      if (gone.length) { await sb.from("bdc_signals").update({ on_latest: false }).in("id", gone.map((g: any) => g.id)); await judge(gone.map((g: any) => ({ ...g, on_latest: false }))); }
      dropped = gone.length;
    }
    const stale = await pageAll(from => sb.from("bdc_signals").select("*").lt("rules_version", BDC_RULES_VERSION).range(from, from + 999));
    if (stale.length) await judge(stale);
    await sb.from("bdc_signal_runs").insert({ run: body.run, items: body.items || 0, stats: { ...(body.stats || {}), complete: !!body.complete, dropped } });
    return { dropped };
  }
  throw new Error("Unknown ingest kind");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const body = await req.json().catch(() => ({}));
    const key = req.headers.get("x-fund-ingest");
    if (key) {
      const want = await secret("FUND_INGEST_SECRET");
      if (!want || key !== want) return json({ ok: false, error: "Bad ingest key." }, 401);
      return json({ ok: true, ...(await ingest(body)) });
    }
    if (!(await admin(req))) return json({ ok: false, error: "Admins only." }, 403);
    if (body.action === "rejudge") { const rows = await pageAll(from => sb.from("bdc_signals").select("*").range(from, from + 999)); await judge(rows); return json({ ok: true, judged: rows.length }); }
    return json({ ok: false, error: "Unknown action" }, 400);
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : String(e) }, 200);
  }
});
