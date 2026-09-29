// Today: the daily task checklist. This is the only screen the ops role (Anaz) sees.
import { sb, state, esc, $, $$, toast, fail, modal } from './core.js';

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
function taskLinks(r) {
  const a = accounts.find(x => x.id === r.account_id); if (!a) return '';
  const link = (href, text, sub = '') => `<a class="tLink" href="${esc(href)}" target="_blank" rel="noopener">${esc(text)} ↗${sub ? `<em>${esc(sub)}</em>` : ''}</a>`;
  if (/respond|comment|repl/i.test(r.task)) {
    const mine = posts.filter(p => p.account_id === a.id && p.work_date < date);
    const recent = mine.filter(p => p.work_date >= new Date(Date.parse(date) - 14 * 864e5).toISOString().slice(0, 10));
    const pick = [...new Map([mine[0], ...recent.filter(p => p.unreplied_count > 0)].filter(Boolean).map(p => [p.id, p])).values()].slice(0, 3);
    if (!pick.length) return `<span class="tLinks"><span class="s muted">No scraped posts for ${esc(a.owner_name)} yet</span></span>`;
    return `<span class="tLinks">${pick.map((p, i) => link(p.linkedin_post_url, i === 0 ? `Last post · ${new Date(p.work_date + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` : (p.post_name || 'Older post').slice(0, 40), p.unreplied_count > 0 ? `${p.unreplied_count} unreplied` : `${p.commenter_count ?? 0} comments`)).join('')}</span>`;
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
// Last 7 ops days including today: done / total per day.
function week() {
  const days = []; for (let i = 6; i >= 0; i--) days.push(addDays(date, -i));
  return days.map(d => { const list = d === date ? rows : past.filter(r => r.work_date === d); return { d, list, total: list.length, done: list.filter(r => r.status === 'done').length, skipped: list.filter(r => r.status === 'skipped').length }; });
}

let rows = [], past = [], accounts = [], posts = [], date = '', histDay = null, showAllOverdue = false, channel = null, loading = false, root = null, lastLoad = 0;

async function load() {
  if (loading) return; loading = true; lastLoad = Date.now();
  try {
    date = opsDate();
    const sync = await sb.rpc('sync_daily_ops_today'); // server builds today's recurring blocks
    if (sync.error) console.warn('sync_daily_ops_today', sync.error.message);
    const [s, a, p, h] = await Promise.all([
      sb.from('daily_ops_schedule').select('*').eq('work_date', date),
      sb.from('daily_ops_accounts').select('id,owner_name,linkedin_url'),
      sb.from('daily_ops_posts').select('id,account_id,linkedin_post_url,work_date,post_name,commenter_count,unreplied_count,is_repost').or('is_repost.is.null,is_repost.eq.false').not('linkedin_post_url', 'is', null).order('work_date', { ascending: false }).limit(200),
      sb.from('daily_ops_schedule').select('*').gte('work_date', addDays(date, -13)).lt('work_date', date),
    ]);
    if (fail(s, 'Load tasks')) return;
    rows = (s.data || []).sort((x, y) => opMin(x.start_time) - opMin(y.start_time));
    accounts = a.data || []; posts = p.data || [];
    past = (h.data || []).sort((x, y) => x.work_date.localeCompare(y.work_date) || opMin(x.start_time) - opMin(y.start_time));
    draw();
  } finally { loading = false; }
}

function draw() {
  if (!root || !root.isConnected || root.dataset.page !== 'today') return; // user has moved to another page
  if (!date) { root.innerHTML = '<div class="empty">Loading…</div>'; return; }
  const done = rows.filter(r => r.status === 'done').length, total = rows.length, pctDone = total ? Math.round(done / total * 100) : 0;
  const now = nowMin();
  const current = rows.find(r => r.status !== 'done' && opMin(r.start_time) <= now && now <= (r.end_time ? opMin(r.end_time) : opMin(r.start_time) + 45));
  const pending = rows.filter(r => r.status !== 'done'), next = current || pending.find(r => opMin(r.start_time) >= now) || pending[0], last = pending.at(-1);
  const dayName = new Date(date + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  root.innerHTML = `
  <div class="head"><div><h1>Today</h1><p>${esc(dayName)} · Malaysia time</p></div>
    <div class="row">${state.role === 'admin' ? '<button class="btn sm" id="tAdd">Add task</button>' : ''}</div></div>
  ${overdueHtml()}
  <div class="today">
    <div>${total ? `<ul class="checklist">${rows.map(r => {
      const acct = accounts.find(a => a.id === r.account_id)?.owner_name;
      const isNow = current && current.id === r.id;
      return `<li class="${r.status === 'done' ? 'done' : ''} ${isNow ? 'now' : ''}"><label>
        <input type="checkbox" data-t="${r.id}" ${r.status === 'done' ? 'checked' : ''}>
        <span class="time">${fmtTime(r.start_time)}</span>
        <span class="what"><b>${esc(r.task)}</b>${r.notes ? `<small>${linkify(r.notes)}</small>` : ''}${taskLinks(r)}${r.status === 'done' && r.completed_by_name ? `<small class="up">Done by ${esc(r.completed_by_name)}</small>` : ''}</span>
        <span class="who">${isNow ? '<span class="tag warn">Now</span>' : acct ? `<span class="tag">${esc(acct)}</span>` : ''}</span>
      </label></li>`;
    }).join('')}</ul>` : '<div class="card"><div class="empty">No tasks for today yet.</div></div>'}
    ${historyHtml()}</div>
    <aside class="todayAside">
      <div class="ring"><svg viewBox="0 0 100 100"><circle class="trk" cx="50" cy="50" r="42"/><circle class="val" cx="50" cy="50" r="42" stroke-dasharray="263.9" stroke-dashoffset="${263.9 * (1 - pctDone / 100)}"/></svg>
        <div><b>${pctDone}%</b><span>${done} of ${total} tasks done</span></div></div>
      ${weekRingHtml()}
      <div class="card">
        <div class="nowCard"><label>${current ? 'Now' : 'Up next'}</label>${next ? `<b>${esc(next.task)}</b><span class="s muted">${fmtTime(next.start_time)}${next.end_time ? ' – ' + fmtTime(next.end_time) : ''}</span>` : '<b>Nothing left today</b><span class="s muted">All caught up.</span>'}</div>
        <div class="nowCard"><label>Remaining</label><b>${total - done} task${total - done === 1 ? '' : 's'}</b><span class="s muted">${last ? `Last one at ${fmtTime(last.start_time)}` : ''}</span></div>
      </div>
      ${total && done === total ? '<div class="card"><div class="empty up strong">All done for today. Nice work.</div></div>' : ''}
    </aside>
  </div>`;
  $$('[data-t]', root).forEach(cb => cb.onchange = () => toggle(cb.dataset.t, cb.checked, cb));
  $$('.checklist a', root).forEach(a => a.addEventListener('click', e => e.stopPropagation())); // open the link, don't tick the task
  $('#tAdd', root)?.addEventListener('click', addTask);
  $$('[data-late]', root).forEach(b => b.onclick = () => settle(b.dataset.late, 'done'));
  $$('[data-skip]', root).forEach(b => b.onclick = () => settle(b.dataset.skip, 'skipped'));
  $$('[data-hday]', root).forEach(b => b.onclick = () => { histDay = b.dataset.hday; draw(); });
  $('#tMore', root)?.addEventListener('click', () => { showAllOverdue = true; draw(); });
}

function overdueHtml() {
  const open = past.filter(OPEN); if (!open.length) return '';
  const list = (showAllOverdue ? open : open.slice(-6)).slice().reverse();
  const days = new Set(open.map(r => r.work_date)).size;
  return `<section class="card overdue"><header><div><h2>${open.length} unfinished task${open.length === 1 ? '' : 's'} from ${days > 1 ? `the last ${days} days` : open[0].work_date === addDays(date, -1) ? 'yesterday' : esc(dayLabel(open[0].work_date, true))}</h2>
      <p>Finish them now, or mark them skipped if they no longer matter. They count against the week until you do.</p></div></header>
    <ul class="odList">${list.map(r => `<li><span class="s muted">${esc(dayLabel(r.work_date))} · ${fmtTime(r.start_time)}</span><b>${esc(r.task)}</b>${taskLinks(r)}
      <span class="row" style="gap:6px"><button class="btn sm primary" data-late="${r.id}">Done now</button><button class="btn sm ghost" data-skip="${r.id}">Skip</button></span></li>`).join('')}</ul>
    ${open.length > list.length ? `<div class="body" style="padding-top:0"><button class="link s" id="tMore">Show all ${open.length}</button></div>` : ''}</section>`;
}

function weekRingHtml() {
  const w = week(), total = w.reduce((n, x) => n + x.total, 0), done = w.reduce((n, x) => n + x.done, 0), pct = total ? Math.round(done / total * 100) : 0;
  const missed = w.filter(x => x.d !== date).reduce((n, x) => n + x.list.filter(OPEN).length, 0);
  return `<div class="card weekRing"><div class="ring sm"><svg viewBox="0 0 100 100"><circle class="trk" cx="50" cy="50" r="42"/><circle class="val" cx="50" cy="50" r="42" stroke-dasharray="263.9" stroke-dashoffset="${263.9 * (1 - pct / 100)}"/></svg>
    <div><b>${pct}%</b><span>Last 7 days · ${done} of ${total} done${missed ? ` · ${missed} missed` : ''}</span></div></div></div>`;
}

function historyHtml() {
  const w = week(), sel = histDay && w.some(x => x.d === histDay) ? histDay : addDays(date, -1), day = w.find(x => x.d === sel);
  return `<section class="card" style="margin-top:24px"><header><div><h2>This week</h2><p>What got done each day. Click a day to see its tasks.</p></div></header>
    <div class="wkDays">${w.map(x => { const p = x.total ? Math.round(x.done / x.total * 100) : null; return `<button type="button" class="wkDay${x.d === sel ? ' on' : ''}${x.d === date ? ' isToday' : ''}" data-hday="${x.d}">
      <span>${esc(dayLabel(x.d))}</span><b>${p == null ? '—' : p + '%'}</b><i><em style="width:${p || 0}%"></em></i><small>${x.total ? `${x.done}/${x.total}` : 'No tasks'}</small></button>`; }).join('')}</div>
    <div class="body flush">${day && day.total ? `<table class="tbl"><tbody>${day.list.map(r => { const [l, t] = sel === date && OPEN(r) ? ['To do', ''] : outcome(r); return `<tr><td class="muted" style="white-space:nowrap;width:90px">${fmtTime(r.start_time)}</td><td>${esc(r.task)}</td><td class="muted s">${r.status === 'done' && r.completed_by_name ? esc(r.completed_by_name) : ''}</td><td style="text-align:right"><span class="tag ${t}">${l}</span></td></tr>`; }).join('')}</tbody></table>` : '<div class="empty">No tasks that day.</div>'}</div></section>`;
}

async function settle(id, status) {
  const res = await sb.from('daily_ops_schedule').update({ status, updated_at: new Date().toISOString(), updated_by: state.user?.id || null }).eq('id', id);
  if (fail(res, 'Update task')) return;
  toast(status === 'done' ? 'Marked done (late)' : 'Marked skipped'); await load();
}

async function toggle(id, checked, cb) {
  const r = rows.find(x => x.id === id); if (!r) return;
  r.status = checked ? 'done' : 'due'; cb.closest('li').classList.toggle('done', checked); // instant feedback
  const res = await sb.from('daily_ops_schedule').update({ status: r.status, updated_at: new Date().toISOString(), updated_by: state.user?.id || null }).eq('id', id);
  if (fail(res, 'Update task')) { r.status = checked ? 'due' : 'done'; cb.checked = !checked; }
  await load();
}

function addTask() {
  modal({ title: 'Add a task for today', submit: 'Add', body: `<div class="form">
    <label class="field full">Task<input class="input" name="task" required placeholder="Reply to comments on Peter's post"></label>
    <label class="field">Time<input class="input" type="time" name="time" required value="12:00"></label>
    <label class="field">Priority<select class="select" name="priority"><option value="normal">Normal</option><option value="high">High</option></select></label></div>`,
    onSubmit: async fd => {
      const r = await sb.from('daily_ops_schedule').insert({ work_date: date, start_time: fd.get('time'), task: String(fd.get('task')).trim(), priority: fd.get('priority'), status: 'due', auto_generated: false, created_by: state.user?.id || null, updated_by: state.user?.id || null });
      if (fail(r, 'Add task')) return false; toast('Task added'); await load();
    } });
}

export function renderToday(el) {
  root = el; draw(); if (Date.now() - lastLoad > 20000) load();
  if (!channel) {
    channel = sb.channel('hq-today').on('postgres_changes', { event: '*', schema: 'public', table: 'daily_ops_schedule' }, () => setTimeout(load, 150)).subscribe();
    setInterval(() => { if (opsDate() !== date) load(); else draw(); }, 60000);
  }
}
