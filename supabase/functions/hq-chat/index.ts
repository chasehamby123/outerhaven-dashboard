// hq-chat: the HQ chat button. Stores the message, then fires the "OuterHaven resource builder" Claude Code routine with a
// job row (resource_jobs.payload.type = 'chat'). The routine follows routines/chat.md: it answers questions read-only, and any
// change it makes goes to a review branch, never to main. It writes its answer into the assistant placeholder row in chat_messages.
// Same routine URL/token as resource-request (integration_secrets).
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!, SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "content-type": "application/json" } });
const text = (v: unknown, max = 20000) => typeof v === "string" ? v.trim().slice(0, max) : "";
const FIRE_PREFIX = "https://api.anthropic.com/v1/claude_code/routines/";
const MAX_BODY = 4000, MAX_BUSY = 3;

async function caller(req: Request) {
  const auth = req.headers.get("authorization") || "";
  if (!auth.toLowerCase().startsWith("bearer ")) return null;
  const userSb = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
  const { data: { user } } = await userSb.auth.getUser();
  if (!user) return null;
  const role = await userSb.rpc("dashboard_role");
  if (role.error || !["admin", "ops"].includes(role.data)) return null;
  return { id: user.id, email: user.email || "", role: role.data as string };
}

async function fire(jobId: string) {
  const { data } = await sb.from("integration_secrets").select("key,secret_value").in("key", ["ROUTINE_FIRE_URL", "ROUTINE_FIRE_TOKEN"]);
  const m = Object.fromEntries((data || []).map((r: any) => [r.key, r.secret_value]));
  if (!m.ROUTINE_FIRE_URL || !m.ROUTINE_FIRE_TOKEN) throw new Error("Chat isn't connected yet. An admin needs to paste the routine URL and token in Resources → Generate → Settings.");
  if (!m.ROUTINE_FIRE_URL.startsWith(FIRE_PREFIX) || !m.ROUTINE_FIRE_URL.endsWith("/fire")) throw new Error("The saved routine URL doesn't look right.");
  const res = await fetch(m.ROUTINE_FIRE_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${m.ROUTINE_FIRE_TOKEN}`, "anthropic-beta": "experimental-cc-routine-2026-04-01", "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ text: `resource_job_id: ${jobId}` }),
  });
  const body = await res.text();
  if (!res.ok) {
    let msg = body.slice(0, 300); try { msg = JSON.parse(body)?.error?.message || msg; } catch { /* keep raw */ }
    throw new Error(res.status === 401 ? "Claude rejected the routine token. An admin needs to paste a new one in Settings." : res.status === 429 ? "Claude's daily routine limit is used up. Try again tomorrow." : `Claude returned ${res.status}: ${msg}`);
  }
  return JSON.parse(body).claude_code_session_url as string | undefined;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);
  const who = await caller(req); if (!who) return json({ ok: false, error: "Not signed in." }, 401);
  let b: any = {}; try { b = await req.json(); } catch { return json({ ok: false, error: "bad request" }, 400); }
  if (b.action !== "send") return json({ ok: false, error: "unknown action" }, 400);

  const body = text(b.body, MAX_BODY + 1);
  if (!body) return json({ ok: false, error: "Type a message first." }, 400);
  if (body.length > MAX_BODY) return json({ ok: false, error: `Messages are limited to ${MAX_BODY} characters.` }, 400);

  // Thread: an existing one of yours, or a new tab.
  let threadId = text(b.thread_id, 60);
  if (threadId) {
    const t = await sb.from("chat_threads").select("id,owner_id").eq("id", threadId).maybeSingle();
    if (!t.data || t.data.owner_id !== who.id) return json({ ok: false, error: "That chat isn't yours." }, 403);
  }

  // Limits: one answer at a time per tab, a few at once overall, a daily cap per person.
  const since = new Date(Date.now() - 20 * 60e3).toISOString();
  if (threadId) {
    const busy = await sb.from("chat_messages").select("id", { count: "exact", head: true }).eq("thread_id", threadId).eq("status", "working").gte("created_at", since);
    if (busy.count) return json({ ok: false, error: "Claude is still working on your last message in this tab." }, 409);
  }
  const all = await sb.from("chat_messages").select("id", { count: "exact", head: true }).eq("status", "working").gte("created_at", since);
  if ((all.count || 0) >= MAX_BUSY) return json({ ok: false, error: "Claude is busy with other chats. Try again in a minute." }, 429);
  const { data: cs } = await sb.from("growth_settings").select("chat_daily_cap").eq("id", 1).single();
  const cap = Number(cs?.chat_daily_cap ?? 40);
  const myt = new Date(Date.now() + 8 * 3600e3), dayStart = new Date(Date.UTC(myt.getUTCFullYear(), myt.getUTCMonth(), myt.getUTCDate()) - 8 * 3600e3).toISOString();
  const used = await sb.from("chat_messages").select("id", { count: "exact", head: true }).eq("role", "user").eq("author_email", who.email).gte("created_at", dayStart);
  if ((used.count || 0) >= cap) return json({ ok: false, error: `You've reached today's limit of ${cap} chat messages.` }, 429);

  if (!threadId) {
    const t = await sb.from("chat_threads").insert({ owner_id: who.id, owner_email: who.email, title: body.replace(/\s+/g, " ").slice(0, 40) }).select("id").single();
    if (t.error) return json({ ok: false, error: t.error.message }, 500);
    threadId = t.data.id;
  }
  const page = text(b.page, 120) || null;
  const um = await sb.from("chat_messages").insert({ thread_id: threadId, role: "user", body, author_email: who.email, page }).select("id").single();
  if (um.error) return json({ ok: false, error: um.error.message }, 500);
  const am = await sb.from("chat_messages").insert({ thread_id: threadId, role: "assistant", body: "", status: "working", progress: "Waiting for Claude to start", author_email: who.email }).select("id").single();
  if (am.error) return json({ ok: false, error: am.error.message }, 500);
  await sb.from("chat_threads").update({ updated_at: new Date().toISOString(), archived: false }).eq("id", threadId);

  // The routine only knows resource_job_id, so the chat rides on a job row (hidden from the Resources page).
  const job = await sb.from("resource_jobs").insert({
    created_by: who.id, requested_by: who.email, kind: "resource", format: "other", brand: "OuterHaven Advisory", source: "generated", status: "queued",
    topic: `HQ chat: ${body.slice(0, 80)}`, caption: body, progress: "Waiting for Claude to start",
    payload: { type: "chat", thread_id: threadId, assistant_message_id: am.data.id, user_message_id: um.data.id, user_email: who.email, page, access: who.role === "admin" ? "branch" : "ask" },
  }).select("id").single();
  const fail = async (msg: string) => {
    await sb.from("chat_messages").update({ status: "error", body: msg, progress: null, updated_at: new Date().toISOString() }).eq("id", am.data.id);
    if (job.data) await sb.from("resource_jobs").update({ status: "failed", error: msg, finished_at: new Date().toISOString() }).eq("id", job.data.id);
    return json({ ok: false, thread_id: threadId, error: msg });
  };
  if (job.error) return await fail(job.error.message);
  try {
    const session = await fire(job.data.id);
    await sb.from("resource_jobs").update({ session_url: session || null }).eq("id", job.data.id);
    await sb.from("chat_messages").update({ job_id: job.data.id }).eq("id", am.data.id);
  } catch (e) { return await fail(e instanceof Error ? e.message : String(e)); }
  return json({ ok: true, thread_id: threadId, message_id: um.data.id, reply_id: am.data.id });
});
