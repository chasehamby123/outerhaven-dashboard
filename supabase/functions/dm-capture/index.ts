// Receives a LinkedIn conversation from the "OuterHaven HQ" browser extension (a team member clicked Save).
// Stores it in dm_conversations (one row per thread), matches our opening message to a DM test version,
// and logs a meeting when the team member ticked "Meeting booked".
// Also receives a whole-inbox snapshot (action "inbox_sync"): who is waiting on us, who we are waiting on, per LinkedIn account.
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-capture-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "content-type": "application/json" } });
const str = (v: unknown, max: number) => typeof v === "string" ? v.trim().slice(0, max) : "";
const iso = (v: unknown) => { const s = str(v, 40); const t = s ? Date.parse(s) : NaN; return Number.isFinite(t) ? new Date(t).toISOString() : null; };
const MATCH_MIN = 0.35;

const TEAM = ["Tengku", "Chase", "Anaz", "Peter", "Razeen"];
// No-sign-in mode (extension v2): the extension carries a team capture key, baked in when an admin downloads it from HQ.
// The person and LinkedIn account are chosen in the extension instead of coming from a login.
let keyCache: { v: string; at: number } | null = null;
async function captureKey() {
  if (keyCache && Date.now() - keyCache.at < 300000) return keyCache.v;
  const { data } = await sb.from("integration_secrets").select("secret_value").eq("key", "EXT_CAPTURE_KEY").maybeSingle();
  keyCache = { v: data?.secret_value || "", at: Date.now() }; return keyCache.v;
}
async function caller(req: Request) {
  const k = req.headers.get("x-capture-key") || "";
  if (k) { const real = await captureKey(); return real && k === real ? { id: null as string | null, email: "", key: true } : null; }
  const auth = req.headers.get("authorization") || "";
  if (!auth.toLowerCase().startsWith("bearer ")) return null;
  const userSb = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
  const { data: { user } } = await userSb.auth.getUser();
  if (!user) return null;
  const role = await userSb.rpc("dashboard_role");
  if (role.error || !["admin", "ops"].includes(role.data)) return null;
  return { id: user.id as string | null, email: user.email || "", key: false };
}

// ---- Inbox snapshot ----
// The extension reads the LinkedIn conversation list (name, last message, who sent it, time): never opens or changes anything.
// Each sync upserts one row per conversation and one inbox_syncs row (the accountability trail: who synced which account, when).
async function inboxSync(b: any, by: string) {
  const { data: accts } = await sb.from("daily_ops_accounts").select("owner_name");
  const picked = str(b.account, 80).toLowerCase();
  const account_name = (accts || []).map((a: any) => a.owner_name).find((n: string) => n && n.toLowerCase() === picked) || null;
  if (!account_name) return json({ ok: false, error: "Pick which LinkedIn account this is." }, 400);

  const seen = new Set<string>();
  const threads = (Array.isArray(b.threads) ? b.threads : []).slice(0, 700).map((t: any) => ({
    thread_key: str(t?.thread_key, 200), thread_url: str(t?.thread_url, 500) || null, participant: str(t?.name, 200),
    last_sender: t?.last_from === "us" ? "us" : t?.last_from === "them" ? "them" : "unknown",
    last_snippet: str(t?.snippet, 400), last_at: iso(t?.ts), unread: t?.unread === true,
  })).filter((t: any) => t.thread_key && !seen.has(t.thread_key) && seen.add(t.thread_key));
  if (!threads.length) return json({ ok: false, error: "Couldn't read any conversations. Open linkedin.com/messaging, keep the conversation list visible, and try again." }, 400);

  const now = new Date().toISOString();
  const prior = await sb.from("inbox_syncs").select("id", { count: "exact", head: true }).eq("account_name", account_name);
  if (prior.error) return json({ ok: false, error: prior.error.message }, 500);
  const baseline = !prior.count;
  const { data: existing } = await sb.from("inbox_threads").select("thread_key,last_sender,last_snippet,last_at,first_seen_at,first_seen_baseline").eq("account_name", account_name).limit(5000);
  const have = new Map((existing || []).map((e: any) => [e.thread_key, e]));

  let fresh = 0;
  const rows = threads.map((t: any) => {
    const e: any = have.get(t.thread_key); if (!e) fresh++;
    // LinkedIn's list only shows "Mon" or "6:21 PM", so keep the stored time while the last message is unchanged.
    const same = e && e.last_sender === t.last_sender && e.last_snippet === t.last_snippet;
    return { account_name, ...t, last_at: same ? e.last_at : (t.last_at || e?.last_at || null), first_seen_at: e?.first_seen_at ?? now,
      first_seen_baseline: e ? e.first_seen_baseline : baseline, last_seen_at: now, gone: false };
  });
  for (let i = 0; i < rows.length; i += 200) {
    const r = await sb.from("inbox_threads").upsert(rows.slice(i, i + 200), { onConflict: "account_name,thread_key" });
    if (r.error) return json({ ok: false, error: r.error.message }, 500);
  }

  // Conversations newer than the oldest one we loaded, but missing now: archived, deleted or filtered out. Stop counting them.
  const stamps = rows.map((r: any) => r.last_at).filter(Boolean).sort();
  const oldest = stamps[0] || null;
  if (oldest) {
    const cut = new Date(Date.parse(oldest) + 864e5).toISOString();
    await sb.from("inbox_threads").update({ gone: true }).eq("account_name", account_name).eq("gone", false).lt("last_seen_at", now).gte("last_at", cut);
  }

  const us = rows.filter((r: any) => r.last_sender === "them").length, them = rows.filter((r: any) => r.last_sender === "us").length;
  const unread = rows.filter((r: any) => r.unread).length;
  const log = await sb.from("inbox_syncs").insert({
    account_name, synced_by: by, synced_at: now, thread_count: rows.length, awaiting_us: us, awaiting_them: them, unread,
    oldest_loaded_at: oldest, is_baseline: baseline, strategy: str(b.strategy, 30) || null,
    notes: { loaded: rows.length, new: fresh, scrolls: Number(b.scrolls) || 0, version: str(b.version, 20) },
  });
  if (log.error) return json({ ok: false, error: log.error.message }, 500);
  return json({ ok: true, account_name, threads: rows.length, awaiting_us: us, awaiting_them: them, unread, new: fresh, baseline, at: now });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);
  const who = await caller(req);
  if (!who) return json({ ok: false, error: "This copy of the extension isn't connected to HQ. Download a fresh one from HQ → Growth → DM tests." }, 401);
  let b: any = {}; try { b = await req.json(); } catch { return json({ ok: false, error: "bad request" }, 400); }

  if (b.action === "whoami") return json({ ok: true, email: who.email });
  if (b.action === "config") {
    const { data } = await sb.from("daily_ops_accounts").select("owner_name,active,sort_order").order("sort_order");
    return json({ ok: true, team: TEAM, accounts: (data || []).filter((a: any) => a.active !== false).map((a: any) => a.owner_name) });
  }
  const booked_by = TEAM.find(n => n.toLowerCase() === str(b.booked_by, 40).toLowerCase()) || null;
  if (who.key && !booked_by) return json({ ok: false, error: "Pick who you are first (top of the HQ panel)." }, 400);
  if (who.key) who.email = "extension · " + booked_by;
  if (b.action === "inbox_sync") return await inboxSync(b, booked_by || who.email);

  const thread_key = str(b.thread_key, 200);
  if (!thread_key) return json({ ok: false, error: "Open a LinkedIn conversation first." }, 400);
  const messages = (Array.isArray(b.messages) ? b.messages : []).slice(0, 800).map((m: any) => ({
    from: m?.from === "us" ? "us" : "them", name: str(m?.name, 120), at: str(m?.at, 60), ts: iso(m?.ts), text: str(m?.text, 6000),
  })).filter((m: any) => m.text);
  const raw_text = str(b.raw_text, 120000);
  if (!messages.length && !raw_text) return json({ ok: false, error: "Couldn't read any messages on this page." }, 400);

  // Who sent first, and did they answer us?
  const firstUs = messages.findIndex((m: any) => m.from === "us");
  const firstThemAfter = firstUs >= 0 ? messages.findIndex((m: any, i: number) => i > firstUs && m.from === "them") : -1;
  const inbound = messages.length > 0 && messages[0].from === "them";
  // Our opening = every message we sent before they first answered (people often split one DM into 2–3 bubbles).
  const opening: string[] = [];
  if (firstUs >= 0) for (let i = firstUs; i < messages.length && messages[i].from === "us"; i++) opening.push(messages[i].text);
  const our_first_message = opening.length ? opening.join("\n") : null;

  // Which of our accounts is this? Match the logged-in LinkedIn name to the account list by first name.
  const our_name = str(b.our_name, 120);
  const { data: accts } = await sb.from("daily_ops_accounts").select("owner_name");
  const first = (s: string) => s.toLowerCase().split(/\s+/)[0] || "";
  const names = (accts || []).map((a: any) => a.owner_name);
  const picked = str(b.account, 80);
  const account_name = names.find((n: string) => n && n.toLowerCase() === picked.toLowerCase()) || names.find((n: string) => n && first(n) === first(our_name)) || null;

  let dm_variant_id: string | null = null, variant_match: number | null = null;
  if (our_first_message) {
    const m = await sb.rpc("match_dm_variant", { p_text: our_first_message });
    const hit = Array.isArray(m.data) ? m.data[0] : null;
    if (hit && Number(hit.score) >= MATCH_MIN) { dm_variant_id = hit.variant_id; variant_match = Number(hit.score); }
  }

  const { data: existing } = await sb.from("dm_conversations").select("id,meeting_booked,meeting_id").eq("thread_key", thread_key).maybeSingle();
  const meeting_booked = b.meeting_booked === true || !!existing?.meeting_booked;
  const row: any = {
    thread_key, thread_url: str(b.thread_url, 500) || null, account_name, our_name: our_name || null,
    prospect_name: str(b.prospect_name, 200) || null, prospect_url: str(b.prospect_url, 500) || null, prospect_headline: str(b.prospect_headline, 400) || null,
    messages, raw_text: raw_text || null, message_count: messages.length, our_first_message,
    first_outbound_at: firstUs >= 0 ? messages[firstUs].ts : null, first_reply_at: firstThemAfter >= 0 ? messages[firstThemAfter].ts : null,
    replied: firstThemAfter >= 0, dm_variant_id, variant_match, meeting_booked,
    captured_by: who.id, captured_by_email: who.email, updated_at: new Date().toISOString(),
  };
  const up = await sb.from("dm_conversations").upsert(row, { onConflict: "thread_key" }).select("id,meeting_id").single();
  if (up.error) return json({ ok: false, error: up.error.message }, 500);
  let meeting_id = up.data.meeting_id;

  if (meeting_booked && !meeting_id) {
    const today = new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10);
    const m = await sb.from("growth_meetings").insert({
      meeting_date: today, account_name, lead_name: row.prospect_name, source: inbound ? "inbound_dm" : "outbound_dm", dm_variant_id,
      status: "booked", notes: `Logged from a captured LinkedIn conversation${booked_by ? ` · booked by ${booked_by}` : ""}`, created_by: who.id,
    }).select("id").single();
    if (!m.error) { meeting_id = m.data.id; await sb.from("dm_conversations").update({ meeting_id }).eq("id", up.data.id); }
  }

  let variant: any = null;
  if (dm_variant_id) {
    const { data: v } = await sb.from("dm_variants").select("label,test_id,dm_tests(name)").eq("id", dm_variant_id).single();
    variant = v ? { label: v.label, test: (v as any).dm_tests?.name || null, match: variant_match } : null;
  }
  return json({ ok: true, id: up.data.id, account_name, messages: messages.length, replied: row.replied, inbound, variant, meeting_logged: !!meeting_id, updated: !!existing });
});
