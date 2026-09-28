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

let rows = [], accounts = [], date = '', channel = null, loading = false, root = null, lastLoad = 0;

async function load() {
  if (loading) return; loading = true; lastLoad = Date.now();
  try {
    date = opsDate();
    const sync = await sb.rpc('sync_daily_ops_today'); // server builds today's recurring blocks
    if (sync.error) console.warn('sync_daily_ops_today', sync.error.message);
    const [s, a] = await Promise.all([
      sb.from('daily_ops_schedule').select('*').eq('work_date', date),
      sb.from('daily_ops_accounts').select('id,owner_name'),
    ]);
    if (fail(s, 'Load tasks')) return;
    rows = (s.data || []).sort((x, y) => opMin(x.start_time) - opMin(y.start_time));
    accounts = a.data || [];
    draw();
  } finally { loading = false; }
}

function draw() {
  if (!root || !root.isConnected || root.dataset.page !== 'today') return; // user has moved to another page
  const done = rows.filter(r => r.status === 'done').length, total = rows.length, pctDone = total ? Math.round(done / total * 100) : 0;
  const now = nowMin();
  const current = rows.find(r => r.status !== 'done' && opMin(r.start_time) <= now && now <= (r.end_time ? opMin(r.end_time) : opMin(r.start_time) + 45));
  const pending = rows.filter(r => r.status !== 'done'), next = current || pending.find(r => opMin(r.start_time) >= now) || pending[0], last = pending.at(-1);
  const dayName = new Date(date + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  root.innerHTML = `
  <div class="head"><div><h1>Today</h1><p>${esc(dayName)} · Malaysia time</p></div>
    <div class="row">${state.role === 'admin' ? '<button class="btn sm" id="tAdd">Add task</button>' : ''}</div></div>
  <div class="today">
    <div>${total ? `<ul class="checklist">${rows.map(r => {
      const acct = accounts.find(a => a.id === r.account_id)?.owner_name;
      const isNow = current && current.id === r.id;
      return `<li class="${r.status === 'done' ? 'done' : ''} ${isNow ? 'now' : ''}"><label>
        <input type="checkbox" data-t="${r.id}" ${r.status === 'done' ? 'checked' : ''}>
        <span class="time">${fmtTime(r.start_time)}</span>
        <span class="what"><b>${esc(r.task)}</b>${r.notes ? `<small>${esc(r.notes)}</small>` : ''}${r.status === 'done' && r.completed_by_name ? `<small class="up">Done by ${esc(r.completed_by_name)}</small>` : ''}</span>
        <span class="who">${isNow ? '<span class="tag warn">Now</span>' : acct ? `<span class="tag">${esc(acct)}</span>` : ''}</span>
      </label></li>`;
    }).join('')}</ul>` : '<div class="card"><div class="empty">No tasks for today yet.</div></div>'}</div>
    <aside class="todayAside">
      <div class="ring"><svg viewBox="0 0 100 100"><circle class="trk" cx="50" cy="50" r="42"/><circle class="val" cx="50" cy="50" r="42" stroke-dasharray="263.9" stroke-dashoffset="${263.9 * (1 - pctDone / 100)}"/></svg>
        <div><b>${pctDone}%</b><span>${done} of ${total} tasks done</span></div></div>
      <div class="card">
        <div class="nowCard"><label>${current ? 'Now' : 'Up next'}</label>${next ? `<b>${esc(next.task)}</b><span class="s muted">${fmtTime(next.start_time)}${next.end_time ? ' – ' + fmtTime(next.end_time) : ''}</span>` : '<b>Nothing left today</b><span class="s muted">All caught up.</span>'}</div>
        <div class="nowCard"><label>Remaining</label><b>${total - done} task${total - done === 1 ? '' : 's'}</b><span class="s muted">${last ? `Last one at ${fmtTime(last.start_time)}` : ''}</span></div>
      </div>
      ${total && done === total ? '<div class="card"><div class="empty up strong">All done for today. Nice work.</div></div>' : ''}
    </aside>
  </div>`;
  $$('[data-t]', root).forEach(cb => cb.onchange = () => toggle(cb.dataset.t, cb.checked, cb));
  $('#tAdd', root)?.addEventListener('click', addTask);
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
