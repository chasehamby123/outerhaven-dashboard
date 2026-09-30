// daily-ops-linkedin-auto · v9 (Outerhaven HQ)
// Changes from v1:
//  1. FIX: posts are matched by the same key the database trigger stores (derived from the post URL),
//     not the scraper's activity id. Reshared posts no longer crash the run with a duplicate-key error
//     (every "posts" run since 17 Sept failed this way while still spending Apify credit).
//  2. One bad post no longer aborts the whole run; per-post errors are collected and logged.
//  3. Obeys growth_settings: on/off switch and monthly budget, both editable in HQ.
//  4. Admins can trigger a run from HQ ("Run now") with their normal login; cron still uses the secret.
//  6. (v4) Posts pass: own posts identified by author==profile (not the unreliable repost flag); last 7 days tracked.
//  7. (v5) Every posts pass (automatic or Run now) saves each original post's creative to storage, so HQ can
//     show it after LinkedIn's image links expire.
//  8. (v6) Comments from our own accounts don't count: unreplied/audience counts come from recount_post_comments().
//  9. (v7) Comment threads: one Apify run per post inside a 120 s budget; unfinished runs are aborted and the post stays pending.
// 10. (v8) Comment runs log their real cost (from the Apify run) and stop before the monthly budget: a thread costs ~$0.6-1.3.
//     Automatic comment passes are paced: at most (remaining budget / days left), minimum one thread, per pass.
// 11. (v9) Account pool: APIFY_TOKEN + APIFY_TOKEN_2..9 (added in HQ). Each run goes to the account with the most credit left.
//  5. (v3) Daily mode (default): one scrape a day at scrape_hour Malaysia time: posts, then comment threads.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const DEFAULT_BUDGET_USD = 19.00;
const RUN_ESTIMATE_USD = 0.06;
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-outerhaven-cron",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "content-type": "application/json" } });
const clean = (v: unknown) => typeof v === "string" ? v.trim() : "";
const num = (v: unknown) => Number.isFinite(Number(v)) ? Math.max(0, Math.floor(Number(v))) : 0;

function canon(v: string) {
  const s = clean(v);
  if (!s) return "";
  try {
    const u = new URL(s.startsWith("http") ? s : `https://${s}`);
    u.search = ""; u.hash = "";
    return `${u.hostname.toLowerCase().replace(/^www\./, "")}${u.pathname.replace(/\/+$/, "").toLowerCase()}`;
  } catch { return s.replace(/\/+$/, "").toLowerCase(); }
}
function cleanUrl(v: string) {
  const s = clean(v);
  if (!s) return "";
  try { const u = new URL(s); u.search = ""; u.hash = ""; return u.toString().replace(/\/$/, ""); }
  catch { return s.replace(/[?#].*$/, "").replace(/\/$/, ""); }
}
function sourceActivityId(row: any) {
  return clean(row?._metadata?.post_id) || clean(row?.latest_post_id) || clean(row?.post_id) || clean(row?.activityId);
}
// Same rule as public.linkedin_post_key(), which the set_daily_ops_post_key trigger applies on every write.
const keyCache = new Map<string, string>();
async function postKeyFor(url: string): Promise<string> {
  const s = clean(url); if (!s) return "";
  const m = s.match(/activity[-:]([0-9]+)/i);
  if (m) return `activity:${m[1]}`;
  if (keyCache.has(s)) return keyCache.get(s)!;
  const r = await sb.rpc("linkedin_post_key", { input_url: s });
  const k = r.error ? "" : String(r.data || "");
  keyCache.set(s, k);
  return k;
}
function sgDate(value?: string) {
  const d = value ? new Date(value) : new Date();
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Singapore", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(d);
  const o: Record<string, string> = {}; for (const x of p) o[x.type] = x.value;
  return `${o.year}-${o.month}-${o.day}`;
}
function titleFor(text: string, posted: string, owner: string) {
  const line = text.split(/\r?\n/).map(x => x.trim()).find(Boolean) || "";
  if (line) return line.length > 84 ? `${line.slice(0, 81)}...` : line;
  const d = posted ? new Date(posted) : new Date();
  return `${owner} · ${d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "Asia/Singapore" })}`;
}
function mediaFor(row: any) {
  if (Array.isArray(row?.images) && row.images[0]) return clean(row.images[0]);
  if (clean(row?.video_url)) return clean(row.video_url);
  if (clean(row?.doc?.pdf_url)) return clean(row.doc.pdf_url);
  return null;
}
function contentType(row: any) {
  if (row?.is_repost === true) return "repost";
  if (clean(row?.video_url)) return "video";
  if (row?.doc) return "document";
  if (Array.isArray(row?.images) && row.images.length) return "image";
  if (row?.article) return "article";
  return "text";
}
function commentId(row: any) { return clean(row?._metadata?.comment_id) || clean(row?.comment_id) || clean(row?.commentId) || clean(row?.id); }
function parentId(row: any) { return clean(row?._metadata?.parent_comment_id) || clean(row?.parent_comment_id) || clean(row?.parentCommentId) || null; }
function commentAuthor(row: any) {
  const a = row?.author || {};
  return { name: clean(a.name) || clean(row?.author_name), url: clean(a.linkedinUrl) || clean(a.linkedin_url) || clean(row?.author_url), headline: clean(a.headline) || clean(row?.author_headline) };
}
async function getSecret(key: string) {
  const r = await sb.from("integration_secrets").select("secret_value").eq("key", key).maybeSingle();
  if (r.error || !r.data?.secret_value) throw new Error(`${key} missing`);
  return r.data.secret_value as string;
}
async function getSettings() {
  const r = await sb.from("growth_settings").select("*").eq("id", 1).maybeSingle();
  if (r.error || !r.data) return { enabled: true, budget: DEFAULT_BUDGET_USD, mode: "daily", hour: 9, fromTable: false };
  return { enabled: r.data.scrape_enabled !== false, budget: Number(r.data.monthly_budget) || DEFAULT_BUDGET_USD, mode: r.data.scrape_mode === "paced" ? "paced" : "daily", hour: Number.isFinite(Number(r.data.scrape_hour)) ? Number(r.data.scrape_hour) : 9, fromTable: true };
}
async function apifyUsage(token: string) {
  const r = await fetch("https://api.apify.com/v2/users/me/usage/monthly", { headers: { authorization: `Bearer ${token}` } });
  const raw = await r.text(); let data: any = null; try { data = raw ? JSON.parse(raw) : null; } catch { }
  if (!r.ok || !data?.data) throw new Error(`Apify usage returned ${r.status}: ${raw.slice(0, 600)}`);
  return data.data;
}
// v9: several Apify accounts. Slot 1 is APIFY_TOKEN (capped by the HQ budget); slots 2-9 are APIFY_TOKEN_2.. added in HQ.
// Every Apify call goes to the account with the most credit left; an account is used up to its own plan limit.
type Acct = { slot: number; name: string; token: string; used: number; limit: number; remaining: number; primary: boolean; error?: string };
async function loadPool(budget: number): Promise<Acct[]> {
  const r = await sb.from("integration_secrets").select("key,secret_value").like("key", "APIFY_TOKEN%");
  const rows = (r.data || []).filter((x: any) => /^APIFY_TOKEN(_\d+)?$/.test(x.key) && x.secret_value);
  const out = await Promise.all(rows.map(async (x: any): Promise<Acct> => {
    const slot = x.key === "APIFY_TOKEN" ? 1 : Number(x.key.split("_")[2]), primary = slot === 1, headers = { authorization: `Bearer ${x.secret_value}` };
    const base = { slot, name: `account ${slot}`, token: x.secret_value as string, used: 0, limit: 0, remaining: 0, primary };
    try {
      const [lr, mr] = await Promise.all([fetch("https://api.apify.com/v2/users/me/limits", { headers }), fetch("https://api.apify.com/v2/users/me", { headers })]);
      const l: any = (await lr.json().catch(() => null))?.data, m: any = (await mr.json().catch(() => null))?.data;
      if (!lr.ok || !l?.limits) throw new Error(`Apify returned ${lr.status} (bad token?)`);
      const max = Number(l.limits.maxMonthlyUsageUsd) || 0, used = Number(l.current?.monthlyUsageUsd) || 0;
      const limit = primary ? (max ? Math.min(max, budget) : budget) - 0.01 : max - 0.25; // spare change so a run can't overshoot a small plan
      return { ...base, name: clean(m?.username) || base.name, used, limit, remaining: Math.max(0, limit - used) };
    } catch (e) { return { ...base, error: e instanceof Error ? e.message : String(e) }; }
  }));
  return out.sort((a, b) => a.slot - b.slot);
}
const pick = (pool: Acct[], need: number) => pool.filter(a => !a.error && a.remaining >= need).sort((a, b) => b.remaining - a.remaining)[0] || null;
const charge = (a: Acct, cost: number) => { a.used += cost; a.remaining = Math.max(0, a.remaining - cost); };

// v7: start the actor run, poll it, and abort it if our time budget runs out (a fetch that just gives up leaves the
// run going and billed on Apify). Used for comment threads, where one big post can take minutes.
async function runApifyBudgeted(token: string, actor: string, input: unknown, deadline: number) {
  const id = actor.replace("/", "~"), headers = { "content-type": "application/json", authorization: `Bearer ${token}` };
  const start = await fetch(`https://api.apify.com/v2/acts/${id}/runs`, { method: "POST", headers, body: JSON.stringify(input) });
  const sraw = await start.text(); let sdata: any = null; try { sdata = JSON.parse(sraw); } catch { }
  if (!start.ok || !sdata?.data?.id) throw new Error(`Apify ${actor} start returned ${start.status}: ${sraw.slice(0, 600)}`);
  const runId = sdata.data.id as string, dataset = sdata.data.defaultDatasetId as string;
  let status = "RUNNING", cost = 0;
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 3000));
    const r = await fetch(`https://api.apify.com/v2/actor-runs/${runId}`, { headers });
    const d: any = await r.json().catch(() => null); status = d?.data?.status || status; cost = Number(d?.data?.usageTotalUsd || cost);
    if (["SUCCEEDED", "FAILED", "ABORTED", "TIMED-OUT"].includes(status)) break;
  }
  if (status !== "SUCCEEDED") {
    if (!["FAILED", "ABORTED", "TIMED-OUT"].includes(status)) { try { await fetch(`https://api.apify.com/v2/actor-runs/${runId}/abort`, { method: "POST", headers }); } catch { } }
    throw new Error(status === "RUNNING" || status === "READY" ? `Apify ${actor} still running when the time budget ran out; run stopped, post left pending` : `Apify ${actor} run ${status}`);
  }
  const items = await fetch(`https://api.apify.com/v2/datasets/${dataset}/items?clean=true&format=json`, { headers });
  const data: any = await items.json().catch(() => []);
  if (!items.ok) throw new Error(`Apify dataset returned ${items.status}`);
  return { items: Array.isArray(data) ? data : [], cost };
}

// v7: one Apify run per post (a 4-post batch with replies blew the 95 s limit), inside a shared time budget.
// Whatever doesn't finish stays "comments_pending" and is picked up by the next run.
const COMMENTS_BUDGET_MS = 120000;
const COMMENT_RUN_RESERVE_USD = 1.0; // a 250-comment thread with replies costs ~$0.6-1.3 (measured 30 Sept), not the $0.06 pass estimate
async function syncComments(pool: Acct[], roomUsd: number) {
  const postsRes = await sb.from("daily_ops_posts").select("*").eq("is_repost", false).gt("commenter_count", 0)
    .in("scrape_status", ["comments_pending", "comments_capped"]).order("posted_at", { ascending: false }).limit(8);
  if (postsRes.error) throw new Error(`comment targets: ${postsRes.error.message}`);
  const targets = postsRes.data || [];
  if (!targets.length) return { mode: "comments", actor_runs_estimate: 0, comment_posts_processed: 0, comment_records_saved: 0, unreplied_total: 0 };
  const deadline = Date.now() + COMMENTS_BUDGET_MS;
  let processed = 0, stored = 0, unrepliedTotal = 0, runs = 0, spent = 0, stopped = ""; const errors: string[] = [], usedAccts = new Set<string>();
  for (const post of targets) {
    if (deadline - Date.now() < 20000) { stopped = "time_budget"; break; }
    if (spent + COMMENT_RUN_RESERVE_USD > roomUsd) { stopped = "monthly_budget"; break; }
    const acct = pick(pool, COMMENT_RUN_RESERVE_USD);
    if (!acct) { stopped = "no_account_has_credit"; break; }
    try {
      runs++; usedAccts.add(acct.name);
      const run = await runApifyBudgeted(acct.token, "atomus/linkedin-comments-scraper-pro", {
        postUrls: [post.linkedin_post_url], maxComments: 250, sortBy: "date", metadataOnly: false, includeReplies: true, maxRepliesPerComment: 50,
      }, deadline);
      spent += run.cost; charge(acct, run.cost); const rows = run.items;
      const pr = rows.filter((r: any) => {
        if (r?.type === "summary" || r?.type === "metadata") return false;
        const inputUrl = canon(clean(r?._metadata?.post_url) || clean(r?.post_url) || clean(r?.postUrl));
        return inputUrl && inputUrl === canon(post.linkedin_post_url);
      });
      const flat: any[] = [];
      for (const r of pr) {
        const cid = commentId(r); if (!cid) continue; const a = commentAuthor(r);
        flat.push({ post_id: post.id, comment_id: cid, parent_comment_id: parentId(r), comment_type: clean(r.comment_type) || "comment", author_name: a.name || null, author_url: a.url || null, author_headline: a.headline || null, body: clean(r.text) || null, is_post_author: r.is_author === true, posted_at: clean(r?.posted_at?.date) || null, reaction_count: num(r?.stats?.total_reactions), raw_payload: r, scraped_at: new Date().toISOString() });
        if (Array.isArray(r.replies)) for (const reply of r.replies) {
          const rcid = commentId(reply); if (!rcid) continue; const ra = commentAuthor(reply);
          flat.push({ post_id: post.id, comment_id: rcid, parent_comment_id: parentId(reply) || cid, comment_type: "reply", author_name: ra.name || null, author_url: ra.url || null, author_headline: ra.headline || null, body: clean(reply.text) || null, is_post_author: reply.is_author === true, posted_at: clean(reply?.posted_at?.date) || null, reaction_count: num(reply?.stats?.total_reactions), raw_payload: reply, scraped_at: new Date().toISOString() });
        }
      }
      const unique = new Map<string, any>(); for (const x of flat) if (!unique.has(x.comment_id)) unique.set(x.comment_id, x);
      const rowsToStore = [...unique.values()];
      const del = await sb.from("daily_ops_post_comments").delete().eq("post_id", post.id);
      if (del.error) throw new Error(`clear comments: ${del.error.message}`);
      if (rowsToStore.length) { const ins = await sb.from("daily_ops_post_comments").upsert(rowsToStore, { onConflict: "post_id,comment_id" }); if (ins.error) throw new Error(`store comments: ${ins.error.message}`); }
      // Team comments (our own accounts) are excluded: the database flags them and recounts audience comments and
      // unreplied ones (replied = any of our accounts answered) whenever comments change.
      const rc = await sb.rpc("recount_post_comments", { p_post: post.id });
      const unreplied = rc.error ? 0 : Number(rc.data || 0);
      const up = await sb.from("daily_ops_posts").update({ scrape_status: num(post.commenter_count) > 250 ? "comments_capped" : "ok", last_scraped_at: new Date().toISOString(), source_actor: "atomus/linkedin-comments-scraper-pro", updated_at: new Date().toISOString() }).eq("id", post.id);
      if (up.error) throw new Error(`update unreplied: ${up.error.message}`);
      processed++; stored += rowsToStore.length; unrepliedTotal += unreplied;
    } catch (e) { errors.push(`${post.post_name || post.id}: ${e instanceof Error ? e.message : String(e)}`); if (/time budget/.test(String(e))) break; }
  }
  if (!processed && errors.length) throw new Error(errors[0]); // nothing saved: surface the real reason in HQ
  return { mode: "comments", actor_runs_estimate: runs, apify_cost_usd: Number(spent.toFixed(4)), stopped_reason: stopped || null, accounts_used: [...usedAccts], comment_posts_processed: processed, comment_posts_queued: targets.length, comment_records_saved: stored, unreplied_total: unrepliedTotal, errors };
}

// Posts pass (v4). One Apify call per run: each profile's 10 most recent items. We decide ourselves what is an
// original: the scraper's own is_repost flag is unreliable (it marks some originals as reposts), so an item is
// the account's own post only when its author profile == the profile we scraped. Originals from the last 7 days
// are all updated (not just the newest), so a post keeps getting fresh numbers for a week even after the team
// reshares other posts on top of it. Reshares are still stored (flagged is_repost) because HQ uses them as boosts.
const RECENT_ITEMS = 10, TRACK_DAYS = 7;
// People rename their LinkedIn URL (e.g. /in/tengku-harris-shah-05ab06164 vs /in/tengku-harris-05ab06164) but the
// trailing id stays, so match on that id when it exists, else on the full normalised URL.
function profileSlug(u: string) { const m = canon(u).match(/linkedin\.com\/in\/([^/]+)/); return m ? decodeURIComponent(m[1]) : ""; }
function profileId(u: string) { const t = profileSlug(u).split("-").pop() || ""; return /\d/.test(t) && t.length >= 6 ? t : ""; }
function sameProfile(a: string, b: string) {
  if (!a || !b) return false;
  if (canon(a) === canon(b)) return true;
  const ia = profileId(a), ib = profileId(b);
  return !!ia && ia === ib;
}
async function syncPosts(pool: Acct[], _allowDetail: boolean) {
  const acctRes = await sb.from("daily_ops_accounts").select("id,owner_name,linkedin_url").eq("active", true).not("linkedin_url", "is", null).order("sort_order");
  if (acctRes.error) throw new Error(`accounts: ${acctRes.error.message}`);
  const accounts = acctRes.data || [];
  const profiles = accounts.map((a: any) => a.linkedin_url).filter(Boolean);
  if (!profiles.length) return { mode: "posts", actor_runs_estimate: 0, profiles_checked: 0, posts_saved: 0 };
  const acctByUrl = new Map(accounts.map((a: any) => [canon(a.linkedin_url), a]));
  const acct = pick(pool, 0.3);
  if (!acct) throw new Error("No Apify account has credit left for a posts run. Add an account or raise the budget in HQ.");
  const run = await runApifyBudgeted(acct.token, "atomus/linkedin-posts-scraper-pro", { profiles, maxPosts: RECENT_ITEMS, postedLimit: "month", sortBy: "date", latestPostOnly: false, includeReposts: true, includeSharedPosts: true }, Date.now() + 140000);
  charge(acct, run.cost); const rows = run.items;

  const existingRes = await sb.from("daily_ops_posts").select("*").order("posted_at", { ascending: false }).limit(1500);
  if (existingRes.error) throw new Error(`existing posts: ${existingRes.error.message}`);
  const byKey = new Map<string, any>();
  for (const p of existingRes.data || []) if (p.post_key) byKey.set(`${p.account_id}|${p.post_key}`, p);

  const cutoff = Date.now() - TRACK_DAYS * 864e5;
  const ownByAccount = new Map<string, number>();
  let saved = 0, originals = 0, reposts = 0, skippedOld = 0, unmatched = 0; const errors: string[] = [];
  for (const r of rows) {
    if (r?.type && r.type !== "post") continue;
    const source = clean(r?._metadata?.source_url) || clean(r?.source_url);
    const account = acctByUrl.get(canon(source)); const sid = sourceActivityId(r);
    const publicUrl = cleanUrl(clean(r?.post_url) || clean(r?.share_url));
    if (!account || !sid || !publicUrl) { unmatched++; continue; }
    const authorUrl = clean(r?.author?.linkedinUrl) || clean(r?.author?.linkedin_url);
    const isOwn = sameProfile(authorUrl, account.linkedin_url);
    const postedAt = clean(r?.posted_at) || new Date().toISOString();
    if (Date.parse(postedAt) < cutoff) { skippedOld++; continue; }
    try {
      const key = await postKeyFor(publicUrl);
      const old = (key && byKey.get(`${account.id}|${key}`)) || byKey.get(`${account.id}|activity:${sid}`) || null;
      const comments = num(r?.engagement?.comments), reactions = num(r?.engagement?.total_reactions);
      const changed = !old || num(old.commenter_count) !== comments;
      const payload: any = {
        account_id: account.id, work_date: sgDate(postedAt), linkedin_post_url: publicUrl, posted_at: postedAt, post_key: key || `activity:${sid}`,
        post_name: old?.post_name && old.post_name !== "" ? old.post_name : titleFor(clean(r?.content), postedAt, account.owner_name),
        commenter_count: comments, unreplied_count: isOwn ? (old?.unreplied_count || 0) : 0, post_text: clean(r?.content) || old?.post_text || null,
        reaction_count: reactions, repost_count: num(r?.engagement?.shares),
        content_type: isOwn ? contentType({ ...r, is_repost: false }) : "repost", media_url: mediaFor(r) || old?.media_url || null,
        activity_id: sid, last_scraped_at: new Date().toISOString(), source_actor: "atomus/linkedin-posts-scraper-pro",
        scrape_status: !isOwn ? "repost_no_thread" : (comments > 0 && changed ? "comments_pending" : (old?.scrape_status || "ok")),
        is_repost: !isOwn, source_profile_url: source,
        author_name: clean(r?.author?.name) || clean(r?.author_name) || old?.author_name || null,
        author_profile_url: isOwn ? account.linkedin_url : (authorUrl || old?.author_profile_url || null),
        raw_payload: r, updated_at: new Date().toISOString(),
      };
      if (old) {
        const up = await sb.from("daily_ops_posts").update(payload).eq("id", old.id);
        if (up.error) throw new Error(`update post: ${up.error.message}`);
      } else {
        const ins = await sb.from("daily_ops_posts").insert(payload).select("*").single();
        if (ins.error?.code === "23505") {
          const hit = await sb.from("daily_ops_posts").select("id").eq("account_id", account.id).eq("post_key", key).maybeSingle();
          if (hit.error || !hit.data) throw new Error(`insert post: ${ins.error.message}`);
          const up = await sb.from("daily_ops_posts").update(payload).eq("id", hit.data.id);
          if (up.error) throw new Error(`update post: ${up.error.message}`);
        } else if (ins.error) throw new Error(`insert post: ${ins.error.message}`);
        else if (ins.data?.post_key) byKey.set(`${account.id}|${ins.data.post_key}`, ins.data);
      }
      saved++; if (isOwn) { originals++; ownByAccount.set(account.id, (ownByAccount.get(account.id) || 0) + 1); } else reposts++;
    } catch (e) { errors.push(`${account.owner_name}: ${e instanceof Error ? e.message : String(e)}`); }
  }
  const no_own_post = accounts.filter((a: any) => !ownByAccount.has(a.id)).map((a: any) => a.owner_name);
  const creatives = await saveCreatives();
  return { mode: "posts", actor_runs_estimate: 1, apify_cost_usd: Number(run.cost.toFixed(4)), accounts_used: [acct.name], ...creatives, profiles_checked: profiles.length, rows_returned: rows.length, posts_saved: saved, original_posts: originals, reposts, skipped_older_than_7d: skippedOld, unmatched_post_rows: unmatched, no_own_post_last_7d: no_own_post, missing_profiles: [], errors };
}

// Creatives: LinkedIn media links expire, so keep our own copy in the private growth-assets bucket.
// Images (first image of a carousel) and document PDFs are saved; videos are skipped.
const CREATIVE_MAX_BYTES = 15 * 1024 * 1024;
async function saveCreatives(limit = 40) {
  const res = await sb.from("daily_ops_posts").select("id,media_url,content_type").eq("is_repost", false).not("media_url", "is", null).is("creative_path", null).neq("content_type", "video").order("posted_at", { ascending: false }).limit(limit);
  if (res.error) return { creatives_saved: 0, creative_errors: [`creatives: ${res.error.message}`] };
  let saved = 0; const errs: string[] = [];
  for (const p of res.data || []) {
    try {
      const r = await fetch(p.media_url);
      if (!r.ok) { errs.push(`${p.id}: image link returned ${r.status} (expired?)`); await sb.from("daily_ops_posts").update({ creative_path: "unavailable" }).eq("id", p.id); continue; }
      const type = (r.headers.get("content-type") || "").split(";")[0] || "application/octet-stream";
      const buf = new Uint8Array(await r.arrayBuffer());
      if (buf.byteLength > CREATIVE_MAX_BYTES) { errs.push(`${p.id}: creative too large`); continue; }
      const ext = type.includes("pdf") ? "pdf" : type.includes("png") ? "png" : type.includes("webp") ? "webp" : type.includes("gif") ? "gif" : "jpg";
      const path = `creatives/${p.id}.${ext}`;
      const up = await sb.storage.from("growth-assets").upload(path, buf, { contentType: type, upsert: true });
      if (up.error) { errs.push(`${p.id}: ${up.error.message}`); continue; }
      await sb.from("daily_ops_posts").update({ creative_path: path, creative_type: type, creative_saved_at: new Date().toISOString() }).eq("id", p.id);
      saved++;
    } catch (e) { errs.push(`${p.id}: ${e instanceof Error ? e.message : String(e)}`); }
  }
  return { creatives_saved: saved, creative_errors: errs };
}

async function logRun(payload: any) { try { await sb.from("daily_ops_linkedin_auto_log").insert(payload); } catch { } }

// Who is calling: the pg_cron job (shared secret) or an admin from HQ (their login token).
async function caller(req: Request, cronSecret: string) {
  if (req.headers.get("x-outerhaven-cron") === cronSecret) return { kind: "cron" as const, email: null };
  const auth = req.headers.get("authorization") || "";
  if (!auth.toLowerCase().startsWith("bearer ")) return null;
  const userSb = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
  const { data: { user } } = await userSb.auth.getUser();
  if (!user) return null;
  const role = await userSb.rpc("dashboard_role");
  if (role.error || role.data !== "admin") return null;
  return { kind: "manual" as const, email: user.email };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  let body: any = {}; try { body = await req.json(); } catch { }

  let cronSecret: string, apifyToken: string;
  try { [cronSecret, apifyToken] = await Promise.all([getSecret("LINKEDIN_CRON_SECRET"), getSecret("APIFY_TOKEN")]); }
  catch (e) { return json({ ok: false, error: "secret_missing", detail: e instanceof Error ? e.message : String(e) }, 500); }

  const who = await caller(req, cronSecret);
  if (!who) return json({ ok: false, error: "unauthorized", detail: "Admin login or cron secret required" }, 401);
  const manual = who.kind === "manual";
  const settings = await getSettings();
  const ceiling = Math.max(0, settings.budget - 0.01);

  let usage: any;
  try { usage = await apifyUsage(apifyToken); }
  catch (e) { return json({ ok: false, error: "usage_check_failed", detail: e instanceof Error ? e.message : String(e) }, 502); }

  const pool = await loadPool(settings.budget);
  const poolRemaining = pool.reduce((t, a) => t + (a.error ? 0 : a.remaining), 0);
  const used = Math.max(Number(usage.totalUsageCreditsUsdAfterVolumeDiscount || 0), pool.find(a => a.primary && !a.error)?.used || 0);
  const cycleStart = new Date(usage.usageCycle?.startAt || Date.now()), cycleEnd = new Date(usage.usageCycle?.endAt || Date.now()), now = new Date();
  const totalMs = Math.max(1, cycleEnd.getTime() - cycleStart.getTime());
  const progress = Math.min(totalMs, Math.max(0, now.getTime() - cycleStart.getTime())) / totalMs;
  const targetNow = ceiling * progress, remaining = Math.max(0, ceiling - used);
  const remainingRunsApprox = Math.max(0, Math.floor((remaining + 1e-9) / RUN_ESTIMATE_USD));
  const remainingMinutes = Math.max(0, (cycleEnd.getTime() - now.getTime()) / 60000);
  const pendingRes = await sb.from("daily_ops_posts").select("id", { count: "exact", head: true }).eq("is_repost", false).gt("commenter_count", 0).in("scrape_status", ["comments_pending", "comments_capped"]);
  const pendingComments = pendingRes.count || 0;
  const status = {
    ok: true, enabled: settings.enabled, budget_usd: settings.budget, hard_ceiling_usd: ceiling, estimated_actor_run_usd: RUN_ESTIMATE_USD, usage_usd: used,
    remaining_to_ceiling_usd: Number(remaining.toFixed(4)), usage_cycle_start: cycleStart.toISOString(), usage_cycle_end: cycleEnd.toISOString(),
    cycle_progress: Number(progress.toFixed(6)), paced_target_now_usd: Number(targetNow.toFixed(4)), remaining_runs_approx: remainingRunsApprox,
    recommended_average_interval_minutes: remainingRunsApprox > 0 ? Number((remainingMinutes / remainingRunsApprox).toFixed(1)) : null,
    pending_comment_posts: pendingComments, pool_remaining_usd: Number(poolRemaining.toFixed(4)),
    accounts: pool.map(a => ({ slot: a.slot, name: a.name, used: Number(a.used.toFixed(4)), limit: Number(a.limit.toFixed(2)), remaining: Number(a.remaining.toFixed(4)), error: a.error || null })),
    trigger: who.kind, by: who.email, schedule_mode: settings.mode, scrape_hour_myt: settings.hour,
  };
  if (body.status_only === true) return json(status);
  if (body.action === "save_creatives") return json({ ok: true, ...(await saveCreatives(100)) }); // free: no Apify call

  if (!manual && !settings.enabled) {
    // Log at most one "off" row per 6 hours so the switch state is visible without flooding the log.
    const recent = await sb.from("daily_ops_linkedin_auto_log").select("id").eq("run_mode", "skip_disabled").gte("created_at", new Date(Date.now() - 6 * 3600e3).toISOString()).limit(1);
    if (!recent.data?.length) await logRun({ run_mode: "skip_disabled", usage_before: used, target_usage: targetNow, detail: status });
    return json({ ...status, ran: false, reason: "auto_scrape_disabled" });
  }
  // Daily mode: the cron ticks every 30 min, but only does work once a day after scrape_hour (Malaysia time):
  // first the posts pass, then comment passes until no threads are pending (max 3 so a bad day can't run away).
  let dailyMode: string | null = null;
  if (!manual && settings.mode === "daily") {
    const myt = new Date(Date.now() + 8 * 3600e3), day = myt.toISOString().slice(0, 10);
    if (myt.getUTCHours() < settings.hour) return json({ ...status, ran: false, reason: "before_daily_hour" });
    const since = new Date(Date.parse(`${day}T00:00:00Z`) - 8 * 3600e3).toISOString();
    const todays = await sb.from("daily_ops_linkedin_auto_log").select("run_mode").gte("created_at", since).in("run_mode", ["posts", "posts_partial", "error_posts", "comments", "comments_partial", "error_comments"]);
    const modes = (todays.data || []).map((r: any) => r.run_mode as string);
    const postsDone = modes.some(m => m.startsWith("posts")), postsFails = modes.filter(m => m === "error_posts").length;
    const commentRuns = modes.filter(m => m.includes("comments")).length;
    if (!postsDone && postsFails < 2) dailyMode = "posts";
    else if (postsDone && pendingComments > 0 && commentRuns < 3) dailyMode = "comments";
    else return json({ ...status, ran: false, reason: postsDone ? "done_for_today" : "posts_failed_twice_today" });
  }
  if (!manual && settings.mode === "paced" && (targetNow - used) < (RUN_ESTIMATE_USD - 0.005)) {
    await logRun({ run_mode: "skip_pace", usage_before: used, target_usage: targetNow, detail: status });
    return json({ ...status, ran: false, reason: "ahead_of_budget_pace" });
  }
  if (poolRemaining < RUN_ESTIMATE_USD && !(manual && body.allow_over_budget === true)) {
    await logRun({ run_mode: "skip_budget", usage_before: used, target_usage: targetNow, detail: status });
    return json({ ...status, ok: !manual, ran: false, reason: "monthly_budget_ceiling_reached", detail: `No Apify account has budget left this month (${pool.length} account${pool.length === 1 ? "" : "s"}; $${used.toFixed(2)} used on the main one)` });
  }

  const requested = clean(body.mode);
  const mode = dailyMode || (requested === "posts" || requested === "comments" ? requested : (pendingComments > 0 ? "comments" : "posts"));
  const allowDetail = mode === "posts" && (remaining >= (RUN_ESTIMATE_USD * 2 - 0.001));
  const started = new Date().toISOString();
  const tag = manual ? `manual_${mode}` : mode;
  try {
    const result: any = mode === "comments" ? await syncComments(pool, manual ? poolRemaining : Math.min(poolRemaining, Math.max(COMMENT_RUN_RESERVE_USD, poolRemaining / Math.max(1, remainingMinutes / 1440)))) : await syncPosts(pool, allowDetail);
    let usageAfter = used;
    // Apify's monthly usage lags a finished run (and may belong to another account), so trust the per-run cost read from the runs.
    if (typeof result.apify_cost_usd === "number") usageAfter = used + result.apify_cost_usd;
    else try { await new Promise(r => setTimeout(r, 1200)); const after = await apifyUsage(apifyToken); usageAfter = Number(after.totalUsageCreditsUsdAfterVolumeDiscount || used); } catch { }
    await logRun({ run_mode: result.errors?.length ? `${tag}_partial` : tag, usage_before: used, usage_after: usageAfter, target_usage: targetNow, detail: { ...status, allow_detail: allowDetail, result, started_at: started } });
    return json({ ...status, ran: true, mode, allow_detail: allowDetail, usage_after_usd: usageAfter, result });
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    await logRun({ run_mode: `error_${tag}`, usage_before: used, target_usage: targetNow, detail: { ...status, error: detail, started_at: started } });
    return json({ ...status, ok: false, ran: false, mode, error: "sync_failed", detail }, 500);
  }
});
