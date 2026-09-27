// Data store for HQ. One load, one realtime channel, shared by every view.
import { sb, state } from './core.js';
import { loadWeekly } from './sheet.js';
import { toPost } from './insights.js';

export const store = {
  accounts: [], rawPosts: [], experiments: [], meetings: [], sheet: null, sheetError: null, settings: null, scrapeLog: [], scrapeLatest: null,
  missing: new Set(), // tables/columns that need the migration
  posts: [], // engine-shaped posts
};

const listeners = new Set();
export const onChange = fn => (listeners.add(fn), () => listeners.delete(fn));
const emit = () => listeners.forEach(fn => { try { fn(); } catch (e) { console.error(e); } });

export const accountName = id => store.accounts.find(a => a.id === id)?.owner_name || '—';

function rebuildPosts() {
  const counts = {};
  for (const m of store.meetings) if (m.post_id && m.status !== 'cancelled') counts[m.post_id] = (counts[m.post_id] || 0) + 1;
  // Reshares are stored as separate rows sharing the original's post_key: they are the "boosts".
  const sharers = {};
  for (const r of store.rawPosts) if (r.is_repost && r.post_key) (sharers[r.post_key] ||= new Set()).add(accountName(r.account_id));
  store.posts = store.rawPosts.filter(r => !r.is_repost).map(r => toPost(r, accountName(r.account_id), counts[r.id] || 0, [...(sharers[r.post_key] || [])]));
}

export async function loadSheet() {
  try { store.sheet = await loadWeekly(); store.sheetError = null; }
  catch (e) { store.sheetError = e.message || String(e); }
  emit();
}

export async function load() {
  const [a, p, e, m, st, rn, lt] = await Promise.all([
    sb.from('daily_ops_accounts').select('*').order('sort_order'),
    sb.from('daily_ops_posts').select('*').order('posted_at', { ascending: false }).limit(500),
    sb.from('daily_ops_experiments').select('*').order('started_at', { ascending: false }),
    sb.from('growth_meetings').select('*').order('meeting_date', { ascending: false }).limit(1000),
    sb.from('growth_settings').select('*').eq('id', 1).maybeSingle(),
    sb.from('daily_ops_linkedin_auto_log').select('*').neq('run_mode', 'skip_pace').order('created_at', { ascending: false }).limit(200),
    sb.from('daily_ops_linkedin_auto_log').select('*').order('created_at', { ascending: false }).limit(1).maybeSingle(),
  ]);
  store.missing.clear();
  if (m.error) store.missing.add('growth_meetings');
  if (st.error) store.missing.add('scraper_settings');
  store.settings = st.data || null; store.scrapeLog = rn.data || []; store.scrapeLatest = lt.data || null;
  if (p.data?.length && !('tags' in p.data[0])) store.missing.add('post_tags');
  if (e.data?.length && !('assets' in e.data[0])) store.missing.add('experiment_assets');
  [a, p, e].forEach(x => x.error && console.error(x.error));
  store.accounts = a.data || []; store.rawPosts = p.data || []; store.experiments = e.data || []; store.meetings = m.data || [];
  rebuildPosts(); emit();
}

let channel = null, timer = null;
export function subscribe() {
  if (channel) return;
  const soon = () => { clearTimeout(timer); timer = setTimeout(load, 400); };
  channel = sb.channel('hq-live');
  ['daily_ops_posts', 'daily_ops_experiments', 'growth_meetings', 'daily_ops_accounts', 'growth_settings', 'daily_ops_linkedin_auto_log'].forEach(t => channel.on('postgres_changes', { event: '*', schema: 'public', table: t }, soon));
  channel.subscribe();
}

// ---- writes ----
export const uid = () => state.user?.id || null;
export async function savePost(id, patch) { return sb.from('daily_ops_posts').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id); }
export async function saveExperiment(id, patch) {
  const row = { ...patch, updated_at: new Date().toISOString(), updated_by: uid() };
  return id ? sb.from('daily_ops_experiments').update(row).eq('id', id).select().single() : sb.from('daily_ops_experiments').insert({ ...row, created_by: uid() }).select().single();
}
export async function deleteExperiment(id) { return sb.from('daily_ops_experiments').delete().eq('id', id); }
export async function saveMeeting(id, patch) {
  const row = { ...patch, updated_at: new Date().toISOString() };
  return id ? sb.from('growth_meetings').update(row).eq('id', id) : sb.from('growth_meetings').insert(row);
}
export async function deleteMeeting(id) { return sb.from('growth_meetings').delete().eq('id', id); }

// ---- creative assets (private bucket, signed URLs) ----
const BUCKET = 'growth-assets';
const urlCache = new Map();
export async function uploadAsset(expId, variant, file) {
  const safe = file.name.replace(/[^\w.-]+/g, '-').slice(-80);
  const path = `experiments/${expId}/${variant}/${Date.now()}-${safe}`;
  const r = await sb.storage.from(BUCKET).upload(path, file, { contentType: file.type, upsert: false });
  if (r.error) return { error: r.error };
  return { asset: { variant, path, name: file.name, type: file.type, size: file.size, uploaded_at: new Date().toISOString() } };
}
export async function assetUrl(path, download) {
  const key = path + (download ? '#d' : '');
  const hit = urlCache.get(key); if (hit && hit.exp > Date.now()) return hit.url;
  const r = await sb.storage.from(BUCKET).createSignedUrl(path, 3600, download ? { download } : undefined);
  if (r.error) return null;
  urlCache.set(key, { url: r.data.signedUrl, exp: Date.now() + 50 * 60 * 1000 });
  return r.data.signedUrl;
}
export async function removeAsset(path) { return sb.storage.from(BUCKET).remove([path]); }
