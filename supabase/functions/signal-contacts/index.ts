// signal-contacts: who to contact at each Credit / BDC / UCC target, and how (10 Oct 2026).
// Ingest (header x-fund-ingest = FUND_INGEST_SECRET, from scripts/officers.py on GitHub):
//   kind 'officers_todo' → credit targets whose SEC officers are missing or older than 30 days
//   kind 'officers' {items: [{cik, company_name, people, phone, website, officer_change}]} → stored (SEC = exact names)
// Cron (header x-outerhaven-cron = LINKEDIN_CRON_SECRET, every 30 min): action 'cron' looks up the next targets (DAILY_CAP a day).
// Admin (user JWT): action 'lookup' {kind, key} = Find contacts now; 'email' {kind, key, name} = Hunter email finder;
//   'mark' {kind, key, name, status: 'confirmed'|'wrong'|null}.
// Keys (pasted in HQ, write-only): BRAVE_SEARCH_KEY (LinkedIn + website), HUNTER_API_KEY (work email). Missing key = that step is skipped.
import { createClient } from "npm:@supabase/supabase-js@2";
import { brand, profileFrom, websiteFrom, mergePeople } from "./parse.js";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!, SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-fund-ingest, x-outerhaven-cron", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "content-type": "application/json" } });
const DAILY_CAP = 120;   // companies looked up per day by the cron (~2-3 Brave queries each)
const PER_RUN = 6;       // per 30-min cron run: ~3 queries x 1.1 s each, well inside the function time limit
const TABLE: Record<string, string> = { credit: "credit_signals", bdc: "bdc_signals", ucc: "ucc_signals" };
const KEYCOL: Record<string, string> = { credit: "cik", bdc: "company_key", ucc: "company_key" };

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
const getRow = async (kind: string, key: string) => (await sb.from("signal_contacts").select("*").eq("kind", kind).eq("key", key).maybeSingle()).data;
async function save(kind: string, key: string, patch: Record<string, unknown>) {
  const r = await sb.from("signal_contacts").upsert({ kind, key, ...patch, updated_at: new Date().toISOString() }, { onConflict: "kind,key" });
  if (r.error) throw new Error(r.error.message);
}

// Brave's free plan allows 1 query per second: space calls 1.1 s apart and retry a 429 once.
let lastBrave = 0;
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
async function brave(q: string, key: string) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const wait = 1100 - (Date.now() - lastBrave); if (wait > 0) await sleep(wait);
    lastBrave = Date.now();
    const r = await fetch(`https://api.search.brave.com/res/v1/web/search?count=10&q=${encodeURIComponent(q)}`, { headers: { Accept: "application/json", "X-Subscription-Token": key } });
    if (r.status === 429 && attempt === 0) { await sleep(1600); continue; }
    if (r.status === 429) throw new Error("Brave rate limit");
    if (!r.ok) throw new Error(`Brave HTTP ${r.status}`);
    return ((await r.json())?.web?.results || []) as any[];
  }
  return [];
}

// Find contacts for one company: LinkedIn profiles of the CFO / CEO and the company website.
async function lookup(kind: string, key: string, name?: string) {
  const bk = await secret("BRAVE_SEARCH_KEY");
  const row = await getRow(kind, key);
  let company = name || row?.company_name;
  if (!company) company = (await sb.from(TABLE[kind]).select("company_name").eq(KEYCOL[kind], key).maybeSingle()).data?.company_name;
  if (!company) throw new Error("Company not found");
  if (!bk) { await save(kind, key, { company_name: company, lookup_note: "No Brave Search key yet (HQ → Contacts setup)." }); return { ok: false, note: "no key" }; }
  // A new search replaces earlier unconfirmed search finds; SEC names and anyone the team marked stay.
  const b = brand(company), people = (row?.people || []).filter((p: any) => p.source === "sec" || p.status);
  const found: any[] = [];
  // Named officers (SEC): search each by name for their LinkedIn. Otherwise search the company for finance / top roles.
  const named = people.filter((p: any) => p.source === "sec" && !p.linkedin).slice(0, 2);
  for (const p of named) {
    const hit = (await brave(`"${p.name}" "${b}" site:linkedin.com/in`, bk)).map(r => profileFrom(r, company, true)).find(x => x && x.name.split(" ").pop()!.toLowerCase() === String(p.name).split(" ").pop()!.toLowerCase());
    if (hit) found.push({ ...p, linkedin: hit.linkedin });
  }
  if (!named.length) {
    const res = await brave(`"${b}" (CFO OR "Chief Financial Officer" OR "VP Finance" OR CEO OR President) site:linkedin.com/in`, bk);
    const seen = new Set<string>();
    for (const r of res) { const p = profileFrom(r, company); if (p && !seen.has(p.name)) { seen.add(p.name); found.push({ ...p, source: "search", source_url: p.linkedin }); } }
  }
  let site = row?.domain ? null : websiteFrom(await brave(`"${b}" official website`, bk), company);
  const note = found.length ? null : named.length ? "SEC officers found, no LinkedIn match." : "No CFO / CEO profile found in search.";
  await save(kind, key, { company_name: company, people: mergePeople(people, found.slice(0, 4)), ...(site ? { website: site.website, domain: site.domain } : {}), looked_up_at: new Date().toISOString(), lookup_note: note });
  return { ok: true, found: found.length, domain: site?.domain || row?.domain || null };
}

// Hunter email finder for one named person at the company's domain (on demand, it uses paid credits).
async function email(kind: string, key: string, name: string) {
  const hk = await secret("HUNTER_API_KEY");
  if (!hk) throw new Error("No Hunter key yet (HQ → Contacts setup).");
  const row = await getRow(kind, key);
  if (!row?.domain) throw new Error("No company website found yet. Run Find contacts first.");
  const parts = String(name).trim().split(/\s+/), first = parts[0], last = parts[parts.length - 1];
  const r = await fetch(`https://api.hunter.io/v2/email-finder?domain=${encodeURIComponent(row.domain)}&first_name=${encodeURIComponent(first)}&last_name=${encodeURIComponent(last)}&api_key=${hk}`);
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.errors?.[0]?.details || `Hunter HTTP ${r.status}`);
  const d = j?.data || {};
  const people = (row.people || []).map((p: any) => p.name === name ? { ...p, email: d.email || null, email_score: d.score ?? null, email_status: d.verification?.status || null, email_checked: new Date().toISOString() } : p);
  await save(kind, key, { people });
  return { ok: true, email: d.email || null, score: d.score ?? null, status: d.verification?.status || null };
}

async function cron() {
  const bk = await secret("BRAVE_SEARCH_KEY");
  if (!bk) return { skipped: "no Brave key" };
  const since = new Date(Date.now() - 864e5).toISOString();
  const today = (await sb.from("signal_contacts").select("key", { count: "exact", head: true }).gte("looked_up_at", since)).count || 0;
  if (today >= DAILY_CAP) return { skipped: "daily cap" };
  const done = new Set(((await sb.from("signal_contacts").select("kind,key,looked_up_at").not("looked_up_at", "is", null)).data || []).map((r: any) => `${r.kind}:${r.key}`));
  // Order: BDC and credit targets alternately (best first in each, so both outreach lanes fill), then UCC; nothing already looked up.
  const lists: Record<string, [string, string, string][]> = {};
  for (const kind of ["bdc", "credit", "ucc"]) {
    const rows = (await sb.from(TABLE[kind]).select(`${KEYCOL[kind]},company_name,score`).eq("verdict", "target").in("status", ["new", "added"]).order("score", { ascending: false }).limit(1000)).data || [];
    lists[kind] = (rows as any[]).map(r => [kind, String(r[KEYCOL[kind]]), r.company_name] as [string, string, string]).filter(([k, key]) => !done.has(`${k}:${key}`));
  }
  const todo: [string, string, string][] = [];
  for (let i = 0; i < Math.max(lists.bdc.length, lists.credit.length); i++) { if (lists.bdc[i]) todo.push(lists.bdc[i]); if (lists.credit[i]) todo.push(lists.credit[i]); }
  todo.push(...lists.ucc);
  let n = 0;
  for (const [kind, key, name] of todo.slice(0, Math.min(PER_RUN, DAILY_CAP - today))) {
    try { await lookup(kind, key, name); n++; } catch (e) { if (String(e).includes("rate limit")) break; await save(kind, key, { company_name: name, looked_up_at: new Date().toISOString(), lookup_note: String((e as Error).message || e) }); }
  }
  return { looked_up: n, left: Math.max(0, todo.length - n) };
}

async function ingest(body: any) {
  if (body.kind === "officers_todo") {
    const rows = (await sb.from("credit_signals").select("cik,company_name").in("verdict", ["target", "maybe"]).in("status", ["new", "added"]).limit(2000)).data || [];
    const cut = Date.now() - 30 * 864e5;
    const have = new Map(((await sb.from("signal_contacts").select("key,sec_checked_at").eq("kind", "credit")).data || []).map((r: any) => [r.key, r.sec_checked_at]));
    return { items: (rows as any[]).filter(r => { const t = have.get(String(r.cik)); return !t || Date.parse(t) < cut; }).map(r => ({ cik: String(r.cik), company_name: r.company_name })) };
  }
  if (body.kind === "officers") {
    let n = 0;
    for (const it of (Array.isArray(body.items) ? body.items : []).slice(0, 300)) {
      if (!it?.cik) continue;
      const key = String(Number(it.cik)), row = await getRow("credit", key);
      const sec = (it.people || []).filter((p: any) => p?.name).map((p: any) => ({ ...p, source: "sec" }));
      // SEC names replace older SEC names (officers change); people found by search or marked by the team stay.
      const kept = (row?.people || []).filter((p: any) => p.source !== "sec" || p.status || sec.some((s: any) => s.name === p.name));
      await save("credit", key, { company_name: it.company_name || row?.company_name || null, people: mergePeople(kept, sec), phone: it.phone || row?.phone || null,
        website: it.website || row?.website || null, domain: it.domain || row?.domain || null, officer_change: it.officer_change || null, sec_checked_at: new Date().toISOString() });
      n++;
    }
    return { stored: n };
  }
  throw new Error("Unknown ingest kind");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const body = await req.json().catch(() => ({}));
    const ingestKey = req.headers.get("x-fund-ingest"), cronKey = req.headers.get("x-outerhaven-cron");
    if (ingestKey) {
      const want = await secret("FUND_INGEST_SECRET");
      if (!want || ingestKey !== want) return json({ ok: false, error: "Bad ingest key." }, 401);
      return json({ ok: true, ...(await ingest(body)) });
    }
    if (cronKey) {
      const want = await secret("LINKEDIN_CRON_SECRET");
      if (!want || cronKey !== want) return json({ ok: false, error: "Bad cron key." }, 401);
      return json({ ok: true, ...(await cron()) });
    }
    const user = await admin(req);
    if (!user) return json({ ok: false, error: "Admins only." }, 403);
    const kind = String(body.kind || ""), key = String(body.key || "");
    if (!TABLE[kind] || !key) return json({ ok: false, error: "kind and key needed" }, 400);
    if (body.action === "lookup") return json(await lookup(kind, key));
    if (body.action === "email") return json(await email(kind, key, String(body.name || "")));
    if (body.action === "mark") {
      const row = await getRow(kind, key); if (!row) return json({ ok: false, error: "No contacts stored" }, 404);
      const who = (user.email || "").split("@")[0];
      await save(kind, key, { people: (row.people || []).map((p: any) => p.name === body.name ? { ...p, status: body.status || null, by: who, at: new Date().toISOString() } : p) });
      return json({ ok: true });
    }
    return json({ ok: false, error: "Unknown action" }, 400);
  } catch (e) {
    return json({ ok: false, error: String((e as Error)?.message || e) }, 500);
  }
});
