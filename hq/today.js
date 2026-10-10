// Today: the daily task checklist. This is the only screen the ops role (Anaz) sees.
import { sb, state, esc, $, $$, toast, fail, modal, acIdx, avatar, firstName } from './core.js';
import { loadDms, dmCardHtml, bindDmCard, meetingModal } from './dms.js';
import { leadHeat } from './pipeline.js';
import { renderNeedsReply } from './inbox.js';
import { taskModal, openTaskById, me, TEAM, syncTeamTasks } from './tasks.js';
import { renderDaily3 } from './daily3.js';

const TZ = 'Asia/Singapore';
// Ops day rolls over at 2am GMT+8, matching the server's schedule builder.
export function opsDate(at = Date.now()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(at - 2 * 3600e3)).map(x => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}`;
}
const fmtTime = v => { if (!v) return ''; const [h, m] = String(v).split(':').map(Number); return `${((h + 11) % 12) + 1}:${String(m || 0).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`; };
const opMin = v => { const [h, m] = String(v || '00:00').split(':').map(Number); const n = h * 60 + (m || 0); return n < 120 ? n + 1440 : n; };
const nowMin = () => { const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date()).map(x => [x.type, x.value])); const n = +p.hour * 60 + +p.minute; return n < 120 ? n + 1440 : n; };

// Links that save a click: the post(s) whose comments need replies, or the profile to post from.
const linkify = t => esc(t).replace(/https?:\/\/[^\s<]+/g, u => `<a href="${u}" target="_blank" rel="noopener">${u.length > 48 ? u.slice(0, 47) + '…' : u}</a>`);
const REPLY_CAP = 20; // LinkedIn comments per account per day (30+ is possible but risky)
function taskLinks(r) {
  const a = accounts.find(x => x.id === r.account_id); if (!a) return '';
  const link = (href, text, sub = '') => `<a class="tLink" href="${esc(href)}" target="_blank" rel="noopener">${esc(text)} ↗${sub ? `<em>${esc(sub)}</em>` : ''}</a>`;
  if (/inbox/i.test(r.task)) {
    const slug = u => String(u || '').replace(/[?#].*$/, '').replace(/\/+$/, '').split('/').pop().toLowerCase();
    const mine = leads.filter(l => slug(l.source_account) && slug(l.source_account) === slug(a.linkedin_url)), hot = mine.filter(l => leadHeat(l).label === 'Wants to talk');
    const waiting = mine.length ? `<a class="quota${hot.length ? ' hot' : ''}" href="#/pipeline">${mine.length} outreach repl${mine.length === 1 ? 'y' : 'ies'} not answered${hot.length ? ` · ${hot.length} want${hot.length === 1 ? 's' : ''} a call` : ''} →</a>` : '';
    return `<span class="tLinks">${waiting}${link('https://www.linkedin.com/messaging/', `${firstName(a.owner_name)}'s inbox`)}</span>`;
  }
  if (/respond|comment|repl/i.test(r.task)) {
    const mine = posts.filter(p => p.account_id === a.id && p.work_date < date);
    const recent = mine.filter(p => p.work_date >= new Date(Date.parse(date) - 14 * 864e5).toISOString().slice(0, 10));
    const pick = [...new Map([mine[0], ...recent.filter(p => p.unreplied_count > 0)].filter(Boolean).map(p => [p.id, p])).values()].slice(0, 3);
    if (!pick.length) return `<span class="tLinks"><span class="s muted">No scraped posts for ${esc(a.owner_name)} yet</span></span>`;
    // LinkedIn tolerates roughly 20 comments a day per account, so work through a big backlog 20 at a time.
    const waiting = recent.reduce((n, p) => n + (p.unreplied_count || 0), 0);
    const quota = waiting ? `<span class="quota">Reply to ${Math.min(REPLY_CAP, waiting)} today${waiting > REPLY_CAP ? ` · ${waiting} waiting, about ${Math.ceil(waiting / REPLY_CAP)} days at ${REPLY_CAP}/day` : ''}</span>` : '';
    return `<span class="tLinks">${quota}${pick.map((p, i) => link(p.linkedin_post_url, i === 0 ? `Last post · ${new Date(p.work_date + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` : (p.post_name || 'Older post').slice(0, 40), p.unreplied_count > 0 ? `${p.unreplied_count} unreplied` : `${p.external_comment_count ?? p.commenter_count ?? 0} comments`)).join('')}</span>`;
  }
  if (/· post/i.test(r.task) && a.linkedin_url) return `<span class="tLinks">${link(a.linkedin_url, `${a.owner_name}'s LinkedIn`)}</span>`;
  return '';
}

const addDays = (iso, n) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const dayLabel = (iso, long) => new Date(iso + 'T12:00:00').toLocaleDateString('en-GB', long ? { weekday: 'long', day: 'numeric', month: 'short' } : { weekday: 'short', day: 'numeric' });
const OPEN = r => r.status !== 'done' && r.status !== 'skipped';
const lateDone = r => r.status === 'done' && r.completed_at && opsDate(Date.parse(r.completed_at)) > r.work_date;
function outcome(r) {
  if (r.status === 'done') return lateDone(r) ? ['Done late', 'warn'] : ['Done', 'good'];
  if (r.status === 'skipped') return ['Skipped', ''];
  return ['Missed', 'bad'];
}
// The ops week runs Monday to Sunday and starts fresh every Monday (2 AM Malaysia time).
export const weekStart = d => addDays(d, -((new Date(d + 'T12:00:00Z').getUTCDay() + 6) % 7));
function weekDays(today, todayRows, earlier) {
  const days = []; for (let i = 0; i < 7; i++) days.push(addDays(weekStart(today), i));
  return days.map(d => { const list = d === today ? todayRows : d > today ? [] : earlier.filter(r => r.work_date === d); return { d, future: d > today, list, total: list.length, done: list.filter(r => r.status === 'done').length }; });
}
const week = () => weekDays(date, rows, past);

let leads = [];
let rows = [], past = [], accounts = [], posts = [], date = '', channel = null, loading = false, root = null, lastLoad = 0;
// Whose tasks Today shows: a person, or 'Everyone'. Remembered per browser; defaults to whoever is signed in.
let who = (() => { try { return localStorage.getItem('hq-today-who'); } catch { return null; } })();
const assigneeOf = r => r.assignee || 'Anaz'; // posting / reply / creation blocks are the operator's
const viewing = () => who || me();
const mineOnly = list => list.filter(r => assigneeOf(r) === me());

async function load() {
  if (loading) return; loading = true; lastLoad = Date.now();
  try {
    date = opsDate();
    const sync = await sb.rpc('sync_daily_ops_today'); // server builds today's recurring blocks
    if (sync.error) console.warn('sync_daily_ops_today', sync.error.message);
    await syncTeamTasks(); // everyone's own tasks (team_tasks) for today
    const [s, a, p, h] = await Promise.all([
      sb.from('daily_ops_schedule').select('*').eq('work_date', date),
      sb.from('daily_ops_accounts').select('id,owner_name,linkedin_url'),
      sb.from('daily_ops_posts').select('id,account_id,linkedin_post_url,work_date,post_name,commenter_count,external_comment_count,unreplied_count,is_repost').or('is_repost.is.null,is_repost.eq.false').not('linkedin_post_url', 'is', null).order('work_date', { ascending: false }).limit(200),
      sb.from('daily_ops_schedule').select('*').gte('work_date', weekStart(date)).lt('work_date', date),
      loadDms().catch(e => console.warn('dms', e)),
      sb.from('lead_intake').select('name,reply_text,decision,created_at,source_account').is('person_id', null).is('reviewed_at', null).neq('decision', 'not_qualified').limit(500).then(r => { leads = r.data || []; }, () => {}),
    ]);
    if (fail(s, 'Load tasks')) return;
    rows = (s.data || []).sort((x, y) => opMin(x.start_time) - opMin(y.start_time));
    accounts = a.data || []; posts = p.data || [];
    past = (h.data || []).sort((x, y) => x.work_date.localeCompare(y.work_date) || opMin(x.start_time) - opMin(y.start_time));
    draw();
  } finally { loading = false; }
  checkWhip();
}

// Which account a task belongs to: its account_id, or the name before the "·" in the task.
const acctOf = r => accounts.find(a => a.id === r.account_id)?.owner_name || (/·/.test(r.task || '') ? firstName(r.task.split('·')[0]) : '');
const endMin = r => r.end_time ? opMin(r.end_time) : opMin(r.start_time) + 45;
const dur = m => { m = Math.max(0, Math.round(m)); const h = Math.floor(m / 60); return h ? `${h} h${m % 60 ? ` ${m % 60} min` : ''}` : `${m} min`; };
// Today's open tasks whose slot has already ended, plus anything still open from earlier this week.
const lateToday = (list = rows) => { const now = nowMin(); return list.filter(r => OPEN(r) && endMin(r) <= now); };
export const overdueNow = () => lateToday(mineOnly(rows)).map(r => ({ r, when: fmtTime(r.start_time) || 'Today' }));

function itemHtml(r) {
  const now = nowMin(), acct = acctOf(r) || (r.auto_key?.startsWith('task:') ? assigneeOf(r) : '');
  const isNow = r.status !== 'done' && r.start_time && opMin(r.start_time) <= now && now <= endMin(r), isLate = OPEN(r) && endMin(r) <= now;
  const fresh = justDone.has(r.id) && Date.now() - justDone.get(r.id) < 1200, isTask = r.auto_key?.startsWith('task:');
  return `<li ${acct ? `data-ac="${acIdx(acct)}"` : ''} data-row="${r.id}" class="${r.status === 'done' ? 'done' : ''} ${isNow ? 'now' : ''} ${isLate ? 'late' : ''} ${fresh ? 'pop' : ''}"><label>
    <input type="checkbox" data-t="${r.id}" ${r.status === 'done' ? 'checked' : ''} aria-label="${esc(r.task)}">
    <span class="time">${r.start_time ? fmtTime(r.start_time) : '<em class="anytime">Any time</em>'}</span>
    <span class="what"><span class="t">${acct ? avatar(acct) : ''}<b>${esc(r.task)}</b>${isNow ? '<span class="nowTag">Now</span>' : isLate ? '<span class="lateTag">Late</span>' : ''}${isTask ? `<button type="button" class="tEdit" data-edittask="${esc(r.auto_key.slice(5))}" title="Edit this task">Edit</button>` : ''}</span>${r.notes ? `<small>${linkify(r.notes)}</small>` : ''}${taskLinks(r)}${r.status === 'done' && r.completed_by_name ? `<small class="up">Done by ${esc(r.completed_by_name)}</small>` : ''}</span>
  </label></li>`;
}

let d3Html = ''; // last Daily 3 render, so redraws don't flash
const justDone = new Map(); // task id → time ticked, so only that row animates
function draw() {
  if (!root || !root.isConnected || root.dataset.page !== 'today') return; // user has moved to another page
  if (!date) { root.innerHTML = '<div class="empty">Loading…</div>'; return; }
  const W = viewing(), vr = W === 'Everyone' ? rows : rows.filter(r => assigneeOf(r) === W);
  const done = vr.filter(r => r.status === 'done').length, total = vr.length, left = total - done;
  const now = nowMin();
  const current = vr.find(r => r.status !== 'done' && r.start_time && opMin(r.start_time) <= now && now <= endMin(r));
  const pending = vr.filter(r => r.status !== 'done'), next = current || pending.find(r => opMin(r.start_time) >= now) || pending[0];
  const late = new Set(lateToday(vr).map(r => r.id));
  const dayName = new Date(date + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  const headline = !total ? 'Nothing scheduled yet' : !left ? 'All done for today' : `${left} task${left === 1 ? '' : 's'} left today`;
  const whoLabel = W === 'Everyone' ? 'Whole team' : W === me() ? 'Your day' : `${W}'s day`;
  let whenTxt = '';
  if (next && !next.start_time) whenTxt = 'Any time today';
  else if (next) {
    const st = opMin(next.start_time), en = endMin(next);
    whenTxt = current ? `${fmtTime(next.start_time)}${next.end_time ? ' – ' + fmtTime(next.end_time) : ''} · ${dur(en - now)} left`
      : st > now ? `${fmtTime(next.start_time)} · starts in ${dur(st - now)}` : `${fmtTime(next.start_time)} · ${dur(now - en)} overdue`;
  }
  const fresh = [...justDone].filter(([, t]) => Date.now() - t < 1200).map(([id]) => id);
  const upcoming = vr.filter(r => r.status !== 'done' && !late.has(r.id) && !(current && current.id === r.id) && !(next && !current && next.id === r.id)).slice(0, 5);
  const comingHtml = upcoming.length ? `<section class="card comingUp"><header><div><h2>Coming up</h2><p>${upcoming.length === 5 ? 'Next 5 tasks' : `${upcoming.length} more after this`}</p></div></header>
    <ul>${upcoming.map(r => { const acct = acctOf(r); return `<li ${acct ? `data-ac="${acIdx(acct)}"` : ''}>${acct ? avatar(acct) : ''}<span class="t">${esc(r.task)}</span><time>${fmtTime(r.start_time) || 'Any time'}</time></li>`; }).join('')}</ul></section>` : '';

  const people = [...new Set([...TEAM, ...rows.map(assigneeOf)])];
  const stat = p => { const l = p === 'Everyone' ? rows : rows.filter(r => assigneeOf(r) === p); return { n: l.length, d: l.filter(r => r.status === 'done').length, late: lateToday(l).length }; };
  const teamCard = cls => `<section class="card tTeam ${cls}"><header><div><h2>Team today</h2><p>Tap a person to see their tasks</p></div></header><ul>${['Everyone', ...people].map(p => { const x = stat(p), pc = x.n ? Math.round(x.d / x.n * 100) : 0;
    return `<li><button type="button" class="${p === W ? 'on' : ''}" data-who="${esc(p)}" ${p !== 'Everyone' ? `data-ac="${acIdx(p)}"` : ''}>${p === 'Everyone' ? '<span class="tWhoAll">All</span>' : avatar(p)}<span class="nm">${esc(p === 'Everyone' ? 'Everyone' : p === me() ? p + ' (you)' : p)}</span><span class="bar"><i style="width:${pc}%"></i></span><em class="${x.late ? 'late' : x.n && x.d === x.n ? 'ok' : ''}">${x.n ? `${x.d}/${x.n}` : '—'}</em></button></li>`; }).join('')}</ul></section>`;
  const asideHtml = teamCard('wide') + comingHtml + dmCardHtml();
  root.innerHTML = `
  <div class="tPage${asideHtml ? ' hasAside' : ''}"><div class="tMain">
  <section class="tHero">
    <div>
      <span class="date"><b class="tWhoLbl">${esc(whoLabel)}</b> · ${esc(dayName)} · Malaysia time</span>
      <h1>${esc(headline)}</h1>
      <div class="tRing"><svg viewBox="0 0 100 100"><circle class="trk" cx="50" cy="50" r="42"/><circle class="val" cx="50" cy="50" r="42" stroke-dasharray="263.9" stroke-dashoffset="${263.9 * (1 - (total ? done / total : 0))}"/></svg>
        <div><b>${total ? Math.round(done / total * 100) : 0}%</b><span>${done} of ${total} tasks done${late.size ? ` · <em>${late.size} late</em>` : ''}</span></div></div>
    </div>
    <div class="tNow">
      <label>${current ? 'Now' : next ? 'Up next' : 'Done'}</label>
      ${next ? `<b>${esc(next.task)}</b><span class="when">${esc(whenTxt)}</span>` : '<b>Nothing left today</b><span class="when">Booked a call? Log it so it counts.</span>'}
      <div class="row"><button class="btn brass sm" id="tMtg">Meeting booked</button><button class="btn sm" id="tAdd">Add task</button></div>
    </div>
  </section>
  ${state.role === 'admin' ? '<div id="tDaily3"></div>' : ''}
  ${teamCard('narrow')}
  ${unfinishedHtml()}
  <div id="tNeeds"></div>
  <div class="today">
    <div>${total ? `<ul class="checklist">${W === 'Everyone' ? people.filter(p => vr.some(r => assigneeOf(r) === p)).map(p => { const l = vr.filter(r => assigneeOf(r) === p); return `<li class="grpHead">${avatar(p)}<b>${esc(p)}</b><span>${l.filter(r => r.status === 'done').length} of ${l.length} done</span></li>` + l.map(itemHtml).join(''); }).join('') : vr.map(itemHtml).join('')}</ul>` : `<div class="card"><div class="empty">${W === 'Everyone' || W === me() ? 'No tasks for today yet.' : `No tasks for ${esc(W)} today.`} <button class="link" id="tAdd2">Add one</button></div></div>`}
    </div>
  </div></div>${asideHtml ? `<aside class="todayAside">${asideHtml}</aside>` : ''}</div>`;
  $$('[data-t]', root).forEach(cb => cb.onchange = () => toggle(cb.dataset.t, cb.checked, cb));
  $$('.checklist a', root).forEach(a => a.addEventListener('click', e => e.stopPropagation())); // open the link, don't tick the task
  const add = () => taskModal(null, { assignee: W === 'Everyone' ? me() : W, on_date: date }, load);
  $('#tAdd', root)?.addEventListener('click', add); $('#tAdd2', root)?.addEventListener('click', add);
  $$('[data-who]', root).forEach(b => b.onclick = () => { who = b.dataset.who; try { localStorage.setItem('hq-today-who', who); } catch { } draw(); });
  $$('[data-edittask]', root).forEach(b => b.onclick = e => { e.preventDefault(); e.stopPropagation(); openTaskById(b.dataset.edittask, load); });
  $('#tMtg', root)?.addEventListener('click', () => meetingModal());
  const needs = $('#tNeeds', root); if (needs) renderNeedsReply(needs, W);
  const d3 = $('#tDaily3', root); if (d3) { if (d3Html) d3.innerHTML = d3Html; renderDaily3(d3, date).then(() => { d3Html = d3.innerHTML; }); }
  bindDmCard(root, draw);
  $$('[data-late]', root).forEach(b => b.onclick = () => settle(b.dataset.late, 'done'));
  $$('[data-skip]', root).forEach(b => b.onclick = () => settle(b.dataset.skip, 'skipped'));
  { const m = mineOnly(rows), md = m.filter(r => r.status === 'done').length; setBadge(m.length - md, lateToday(m).length, m.length); }
}

// Earlier this week, never finished: one red line so he knows, collapsed so today stays the focus.
// Opens to settle each one (done late or skipped). Resets every Monday.
function unfinishedHtml() {
  const W = viewing(), open = past.filter(r => OPEN(r) && (W === 'Everyone' || assigneeOf(r) === W)); if (!open.length) return '';
  const days = [...new Set(open.map(r => dayLabel(r.work_date)))];
  return `<details class="overdue"><summary><b>You didn't finish ${open.length} task${open.length === 1 ? '' : 's'} earlier this week</b><span class="muted" style="color:inherit;opacity:.8">${esc(days.join(', '))}</span><span class="s">Sort them out</span></summary>
    <ul class="odList">${open.slice().reverse().map(r => `<li><span class="s muted">${esc(dayLabel(r.work_date))} · ${fmtTime(r.start_time)}</span><b>${esc(r.task)}</b>
      <span class="row" style="gap:6px"><button class="btn sm primary" data-late="${r.id}">Done now</button><button class="btn sm ghost" data-skip="${r.id}">Skip</button></span></li>`).join('')}</ul></details>`;
}

// ---- Nav badge: tasks left today, red when something is late ----
function setBadge(left, lateCount, total) {
  const a = document.querySelector('.nav a[data-page="today"]'); if (!a) return;
  let b = a.querySelector('.badge'); if (!b) { b = document.createElement('span'); a.appendChild(b); }
  b.className = 'badge' + (lateCount ? ' hot' : !left && total ? ' ok' : '');
  b.textContent = lateCount ? lateCount : left ? left : total ? '✓' : '';
  b.title = lateCount ? `${lateCount} overdue` : left ? `${left} left today` : '';
  if (!b.textContent) b.remove();
}
export async function refreshBadge() {
  if (root?.dataset.page === 'today' && date) return; // Today keeps it current itself
  const d = opsDate();
  const t = await sb.from('daily_ops_schedule').select('id,status,start_time,end_time,assignee').eq('work_date', d);
  if (t.error) return;
  const all = mineOnly(t.data || []), now = nowMin(), open = all.filter(OPEN);
  setBadge(open.length, open.filter(r => endMin(r) <= now).length, all.length);
}

// ---- The whip: armed when someone navigates to Today, fired once the data is fresh ----
let armed = false;
export function armWhip() { armed = true; }
async function checkWhip() {
  if (!armed || !date || root?.dataset.page !== 'today') return;
  armed = false;
  const list = overdueNow(); if (!list.length) return;
  // Once per ops day per browser: the whip is a wake-up call, not a toll booth on the Today tab.
  try { if (localStorage.getItem('hq-whip-day') === date) return; localStorage.setItem('hq-whip-day', date); } catch { /* no storage: fall through and show */ }
  const { showWhip } = await import('./whip.js');
  showWhip(list.map(x => ({ when: x.when, task: x.r.task })), () => {
    const firstToday = list.find(x => x.r.work_date === date);
    if (firstToday) { const li = root.querySelector(`[data-row="${firstToday.r.id}"]`); li?.scrollIntoView({ behavior: 'smooth', block: 'center' }); li?.classList.add('flash'); return; }
  });
}

function confetti() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const c = document.createElement('div'); c.className = 'confetti';
  const cols = ['var(--brass)', 'var(--c1)', 'var(--c2)', 'var(--c3)', 'var(--c4)', 'var(--c6)', 'var(--c7)'];
  c.innerHTML = Array.from({ length: 70 }, (_, i) => `<i style="left:${Math.random() * 100}%;background:${cols[i % cols.length]};--dx:${(Math.random() * 2 - 1) * 160}px;--rot:${Math.random() * 720 - 360}deg;animation-delay:${Math.random() * .35}s;animation-duration:${1.2 + Math.random() * .9}s"></i>`).join('');
  document.body.appendChild(c); setTimeout(() => c.remove(), 2600);
}

// Week history for the Overview page: loads its own data so Overview doesn't depend on Today being open.
let histSel = null, histHtml = '';
export async function renderWeekHistory(el) {
  if (histHtml && !el.innerHTML) el.innerHTML = histHtml; // no flash while it reloads
  const today = opsDate();
  const res = await sb.from('daily_ops_schedule').select('*').gte('work_date', weekStart(today)).lte('work_date', today);
  if (res.error || !el.isConnected) return;
  const all = (res.data || []).sort((x, y) => opMin(x.start_time) - opMin(y.start_time));
  const w = weekDays(today, all.filter(r => r.work_date === today), all.filter(r => r.work_date < today));
  const sel = histSel && w.some(x => x.d === histSel && !x.future) ? histSel : today, day = w.find(x => x.d === sel);
  const total = w.reduce((n, x) => n + x.total, 0), done = w.reduce((n, x) => n + x.done, 0);
  el.innerHTML = `<section class="card"><header><div><h2>Team tasks this week</h2><p>Monday to today · ${total ? Math.round(done / total * 100) : 0}% done (${done} of ${total}). Resets every Monday. Click a day to see its tasks.</p></div></header>
    <div class="wkDays">${w.map(x => { const p = x.total ? Math.round(x.done / x.total * 100) : null; return `<button type="button" class="wkDay${x.d === sel ? ' on' : ''}${x.d === today ? ' isToday' : ''}" data-hday="${x.d}" ${x.future ? 'disabled' : ''}>
      <span>${esc(dayLabel(x.d))}</span><b>${x.future ? '' : p == null ? '—' : p + '%'}</b><i><em style="width:${p || 0}%"></em></i><small>${x.future ? 'Later' : x.total ? `${x.done}/${x.total}` : 'No tasks'}</small></button>`; }).join('')}</div>
    <div class="body flush">${day && day.total ? `<table class="tbl"><tbody>${day.list.map(r => { const [l, t] = sel === today && OPEN(r) ? ['To do', ''] : outcome(r); return `<tr><td class="muted" style="white-space:nowrap;width:90px">${fmtTime(r.start_time)}</td><td>${esc(r.task)}</td><td class="muted s">${r.status === 'done' && r.completed_by_name ? esc(r.completed_by_name) : ''}</td><td style="text-align:right"><span class="tag ${t}">${l}</span></td></tr>`; }).join('')}</tbody></table>` : '<div class="empty">No tasks that day.</div>'}</div></section>`;
  histHtml = el.innerHTML;
  $$('[data-hday]', el).forEach(b => b.onclick = () => { histSel = b.dataset.hday; renderWeekHistory(el); });
}

async function settle(id, status) {
  const res = await sb.from('daily_ops_schedule').update({ status, updated_at: new Date().toISOString(), updated_by: state.user?.id || null }).eq('id', id);
  if (fail(res, 'Update task')) return;
  toast(status === 'done' ? 'Marked done (late)' : 'Marked skipped'); await load();
}

async function toggle(id, checked, cb) {
  const r = rows.find(x => x.id === id); if (!r) return;
  r.status = checked ? 'done' : 'due'; cb.closest('li').classList.toggle('done', checked); // instant feedback
  if (checked) { justDone.set(id, Date.now()); cb.closest('li').classList.add('pop'); if (rows.every(x => x.status === 'done')) confetti(); }
  const res = await sb.from('daily_ops_schedule').update({ status: r.status, updated_at: new Date().toISOString(), updated_by: state.user?.id || null }).eq('id', id);
  if (fail(res, 'Update task')) { r.status = checked ? 'due' : 'done'; cb.checked = !checked; }
  await load();
}

export function renderToday(el) {
  root = el; draw();
  if (Date.now() - lastLoad > 20000) load(); else if (!loading) checkWhip();
  if (!channel) {
    channel = sb.channel('hq-today').on('postgres_changes', { event: '*', schema: 'public', table: 'daily_ops_schedule' }, () => setTimeout(load, 150)).subscribe();
    setInterval(() => { if (opsDate() !== date) load(); else draw(); }, 60000);
  }
}
