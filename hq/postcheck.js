// Overview → "Did the posts go out?": every scheduled post for the ops day, checked two ways.
//   Ticked   = someone marked the post task done on Today (a claim).
//   Verified = the scraper found that account's own post on LinkedIn for that day (proof).
// Before tonight's first post has started we show last night's run, since that's the one that can have gone wrong.
// If posts that should be out can't be verified (scraper off, or it hasn't run since they went out), a popup says so.
import { sb, esc, $, toast, avatar } from './core.js';
import { store, load as reloadStore } from './data.js';
import { opsDate } from './today.js';
import { loadFormats, loadPlans, fmtChip, checkHtml } from './formats.js';

const TZ = 'Asia/Singapore';
const toMin = t => { const [h, m] = String(t || '0:0').split(':').map(Number); const n = h * 60 + (m || 0); return n < 120 ? n + 1440 : n; };
const nowMin = () => { const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date()).map(x => [x.type, x.value])); const n = +p.hour * 60 + +p.minute; return n < 120 ? n + 1440 : n; };
const label12 = n => { n %= 1440; const h = Math.floor(n / 60), m = n % 60; return `${((h + 11) % 12) + 1}${m ? ':' + String(m).padStart(2, '0') : ''} ${h >= 12 ? 'PM' : 'AM'}`; };
const addDays = (iso, n) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const dayName = iso => new Date(iso + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'long' });
// Ops day D runs 02:00 D → 02:00 D+1 MYT. Convert a slot (minutes on that ops day) to a real timestamp.
const slotTs = (iso, min) => Date.parse(iso + 'T00:00:00+08:00') + min * 60000;

let rows = [], day = null, label = '', checking = false, lastHtml = '', weeklyFmt = new Map(), plans = new Map();

async function fetchDay(d) {
  const r = await sb.from('daily_ops_schedule').select('id,work_date,start_time,end_time,task,status,account_id,auto_key,completed_by_name').eq('work_date', d).order('start_time');
  return (r.data || []).filter(x => /^post:/.test(x.auto_key || '') || /· post\b/i.test(x.task || ''));
}

function lastPostsRun() {
  const r = store.scrapeLog.find(x => /posts/.test(x.run_mode || '') && !/error/.test(x.run_mode || ''));
  return r ? Date.parse(r.created_at) : 0;
}

function evaluate() {
  const isToday = day === opsDate(), nm = nowMin(), lastRun = lastPostsRun();
  const found = {}; // account_id → own posts on that day
  for (const p of store.rawPosts) if (!p.is_repost && p.work_date === day) (found[p.account_id] ||= []).push(p);
  // The scraper ties each post to the slot it filled (slot_weekly_id + slot_date); posts it couldn't place fall back to order.
  const wid = r => (r.auto_key || '').startsWith('post:') ? r.auto_key.slice(5) : null;
  const bySlot = new Map(store.rawPosts.filter(p => !p.is_repost && p.slot_date === day && p.slot_weekly_id).map(p => [p.slot_weekly_id, p]));
  const claimed = new Set([...bySlot.values()].map(p => p.id)), used = {};
  return rows.map(r => {
    const s = toMin(r.start_time), end = s + 60, acct = store.accounts.find(a => a.id === r.account_id);
    const name = acct?.owner_name || r.task.split('·')[0].trim();
    const k = r.account_id;
    let post = bySlot.get(wid(r)) || null;
    if (!post) { const rest = (found[k] || []).filter(p => !claimed.has(p.id) && !p.slot_weekly_id).sort((a, b) => String(a.posted_at).localeCompare(String(b.posted_at))); const idx = used[k] = (used[k] || 0) + 1; post = rest[idx - 1] || null; }
    const planned = plans.get(`${wid(r)}|${day}`)?.format_key || weeklyFmt.get(wid(r)) || null;
    const started = !isToday || nm >= s, over = !isToday || nm >= end;
    const ticked = r.status === 'done';
    const checkable = lastRun >= slotTs(day, end); // the scraper has looked since this slot ended
    let st;
    if (post) st = 'verified';
    else if (!started) st = 'upcoming';
    else if (!over) st = ticked ? 'ticked' : 'now';
    else if (checkable) st = ticked ? 'missing_ticked' : 'missing';
    else st = ticked ? 'ticked' : 'unknown';
    return { r, name, s, post, st, ticked, checkable, over, planned };
  });
}

const STATUS = {
  verified: ['good', 'Posted', 'Found on LinkedIn'],
  ticked: ['warn', 'Ticked', 'Marked done, not verified yet'],
  missing_ticked: ['bad', 'Not found', 'Ticked as done, but no post on LinkedIn'],
  missing: ['bad', 'Not posted', 'Not ticked and not on LinkedIn'],
  unknown: ['bad', 'Not ticked', "Not marked done; can't verify"],
  now: ['warn', 'Posting now', 'Slot in progress'],
  upcoming: ['', 'Upcoming', ''],
};

export async function renderPostCheck(el) {
  if (lastHtml && !el.innerHTML) el.innerHTML = lastHtml; // no flash while re-fetching
  const today = opsDate(), nm = nowMin();
  let list = await fetchDay(today);
  const firstToday = list.length ? Math.min(...list.map(r => toMin(r.start_time))) : null;
  // Nothing started yet tonight → the run that matters is last night's.
  if (!list.length || nm < firstToday) { const y = addDays(today, -1), yl = await fetchDay(y); if (yl.length) { day = y; rows = yl; label = `Last night (${dayName(y)})`; } else { day = today; rows = list; label = 'Today'; } }
  else { day = today; rows = list; label = 'Today'; }
  // Planned format per slot (one-off plan / format test ?? weekly default).
  const [, w, pl] = await Promise.all([loadFormats(), sb.from('daily_ops_weekly_posts').select('id,format_key'), loadPlans(day, day).catch(() => new Map())]);
  weeklyFmt = new Map((w.data || []).map(x => [x.id, x.format_key])); plans = pl;
  if (!el.isConnected) return;
  const items = evaluate();
  const n = k => items.filter(i => k.includes(i.st)).length;
  const due = items.filter(i => i.st !== 'upcoming');
  const good = n(['verified']), bad = n(['missing', 'missing_ticked', 'unknown']), pending = n(['ticked', 'now']);
  const tonight = day !== today && list.length ? `Tonight: ${list.length} post${list.length === 1 ? '' : 's'} from ${label12(firstToday)}` : '';
  const verdict = !items.length ? 'No posts scheduled' : !due.length ? 'Nothing due yet' : good === due.length ? 'All posted' : bad ? `${bad} of ${due.length} not confirmed` : `${good} of ${due.length} verified`;
  const tone = !due.length ? '' : good === due.length ? 'good' : bad ? 'bad' : 'warn';
  const blind = items.some(i => i.over && !i.checkable && ['ticked', 'unknown'].includes(i.st));
  const lr = lastPostsRun();

  el.innerHTML = `<section class="card pcCard"><header><div><h2>Did the posts go out? <span class="pcWhen">${esc(label)}</span></h2>
      <p>${blind ? `<b class="pcBlind">Can't verify: ${store.settings?.scrape_enabled === false ? 'scraper is off' : 'scraper hasn\'t run since these went out'}.</b> Showing ticks from Today only.` : 'Verified against LinkedIn by the scraper.'} ${lr ? `Last LinkedIn check ${new Date(lr).toLocaleString('en-GB', { weekday: 'short', hour: 'numeric', minute: '2-digit' })}.` : ''}</p></div>
      <div class="row"><span class="pcVerdict ${tone}">${esc(verdict)}</span><button class="btn sm" id="pcCheck">Check LinkedIn now</button></div></header>
    ${items.length ? `<div class="pcGrid">${items.map(i => { const [t, l, sub] = STATUS[i.st]; return `<div class="pcItem" data-tone="${t}">
      <div class="pcTop">${avatar(i.name, 'sm')}<b>${esc(i.name)}</b><span class="pcTime">${label12(i.s)}</span></div>
      <div class="pcState">${l}</div>${i.post?.format_check && i.post.format_check !== 'unplanned' ? `<div class="pcFmt">${checkHtml(i.post, { short: i.post.format_check === 'match' })}</div>` : i.planned ? `<div class="pcFmt">${fmtChip(i.planned)}</div>` : ''}<div class="pxSub">${i.post?.linkedin_post_url ? `<a href="${esc(i.post.linkedin_post_url)}" target="_blank" rel="noopener">Open post ↗</a>` : esc(sub)}${i.ticked && i.st !== 'verified' && i.r.completed_by_name ? ` · by ${esc(i.r.completed_by_name)}` : ''}</div></div>`; }).join('')}</div>` : '<div class="empty">No posts on the schedule for this day.</div>'}
    ${tonight ? `<div class="pxTonight s muted">${esc(tonight)}</div>` : ''}</section>`;

  lastHtml = el.innerHTML;
  $('#pcCheck', el).onclick = () => checkNow(el);
  maybePopup(items, blind);
}

async function checkNow(el) {
  if (checking) return; checking = true;
  const b = $('#pcCheck', el); if (b) { b.disabled = true; b.textContent = 'Checking LinkedIn…'; }
  try {
    const { data, error } = await sb.functions.invoke('daily-ops-linkedin-auto', { body: { mode: 'posts' } });
    if (error || data?.ok === false || data?.ran === false) throw new Error(data?.detail || data?.reason || error?.message || 'Scraper error');
    toast('Checked LinkedIn'); await reloadStore();
  } catch (e) { toast('Check failed: ' + e.message); }
  finally { checking = false; if (el.isConnected) renderPostCheck(el); }
}

// The popup: once per ops day per browser, only when posts that should be out can't be confirmed.
function maybePopup(items, blind) {
  const unconfirmed = items.filter(i => i.over && ['ticked', 'unknown'].includes(i.st));
  if (!blind || !unconfirmed.length || document.querySelector('.pcPop')) return;
  const key = 'hq-postcheck-' + day;
  try { if (localStorage.getItem(key)) return; } catch { }
  const off = store.settings?.scrape_enabled === false, notTicked = items.filter(i => i.st === 'unknown');
  const d = document.createElement('div'); d.className = 'pcPop';
  d.innerHTML = `<div class="pcPopCard" role="alertdialog" aria-labelledby="pcPopT">
    <h3 id="pcPopT">Can't confirm ${label === 'Today' ? 'today' : 'last night'}'s posts</h3>
    <p>${off ? 'The scraper is <b>off</b>, so HQ can\'t see LinkedIn.' : 'The scraper hasn\'t checked LinkedIn since these went out.'} ${notTicked.length ? `<b>${notTicked.length}</b> ${notTicked.length === 1 ? 'post wasn\'t' : 'posts weren\'t'} even ticked as done: ${esc(notTicked.map(i => i.name).join(', '))}.` : 'They were all ticked as done, but nothing has checked.'}</p>
    <p class="s muted">One check reads each account's latest posts (about $0.18 of Apify credit). It doesn't turn the scraper back on.</p>
    <div class="row" style="justify-content:flex-end"><button class="btn ghost" data-pc="later">Not today</button><a class="btn" href="#/growth/scraper" data-pc="go">Scraper settings</a><button class="btn primary" data-pc="check">Check LinkedIn now</button></div></div>`;
  document.body.appendChild(d);
  const close = () => { try { localStorage.setItem(key, '1'); } catch { } d.remove(); };
  d.onclick = e => { if (e.target === d) close(); };
  d.querySelector('[data-pc=later]').onclick = close;
  d.querySelector('[data-pc=go]').onclick = close;
  d.querySelector('[data-pc=check]').onclick = () => { close(); const el = document.querySelector('#ovPosts'); if (el) checkNow(el); };
}
