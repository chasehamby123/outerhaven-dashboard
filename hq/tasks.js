// Team tasks: everyone's own one-off / daily / weekday / weekly tasks (team_tasks). The server (sync_team_tasks, called by
// sync_daily_ops_today) puts each day's occurrences on Today, where they're ticked like any other task.
// This module has the add/edit modal (used by Today) and the "Team tasks" list under Schedule.
import { sb, state, esc, $, $$, toast, fail, modal, opts, avatar, firstName } from './core.js';
import { opsDate } from './today.js';

export const TEAM = ['Tengku', 'Chase', 'Anaz', 'Peter', 'Razeen'];
// Who is signed in, as a team first name (emails aren't always first.last).
export function me() {
  const local = String(state.user?.email || '').split('@')[0].toLowerCase();
  return TEAM.find(n => local.startsWith(n.toLowerCase())) || firstName(local.replace(/[._-]+/g, ' ')).replace(/^./, c => c.toUpperCase()) || 'Me';
}
const DOW = [[1, 'Mon'], [2, 'Tue'], [3, 'Wed'], [4, 'Thu'], [5, 'Fri'], [6, 'Sat'], [0, 'Sun']];
const label12 = t => { if (!t) return ''; const [h, m] = String(t).split(':').map(Number); return `${((h + 11) % 12) + 1}${m ? ':' + String(m).padStart(2, '0') : ''} ${h >= 12 ? 'PM' : 'AM'}`; };
export function repeatText(t) {
  const when = t.start_time ? ` at ${label12(t.start_time)}` : '';
  if (t.repeat === 'daily') return 'Every day' + when;
  if (t.repeat === 'weekdays') return 'Weekdays' + when;
  if (t.repeat === 'weekly') return 'Every ' + (DOW.filter(([d]) => (t.days || []).includes(d)).map(([, n]) => n).join(', ') || '—') + when;
  return (t.on_date ? new Date(t.on_date + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) : 'Once') + when;
}

let accounts = null;
async function accountNames() {
  if (!accounts) { const r = await sb.from('daily_ops_accounts').select('owner_name,active').order('sort_order'); accounts = (r.data || []).filter(a => a.active !== false).map(a => a.owner_name); }
  return accounts;
}
// Does a definition put a task on this ops day?
export function applies(t, day) {
  if (!t.active) return false;
  if (t.repeat === 'once') return t.on_date === day;
  if (t.on_date && t.on_date > day) return false;
  if (t.until_date && t.until_date < day) return false;
  const dow = new Date(day + 'T12:00:00Z').getUTCDay();
  return t.repeat === 'daily' || (t.repeat === 'weekdays' && dow >= 1 && dow <= 5) || (t.repeat === 'weekly' && (t.days || []).includes(dow));
}
// Server adds/updates today's occurrences; here we drop untouched ones whose task was deleted or no longer falls today.
export async function syncTeamTasks() {
  const day = opsDate();
  const s = await sb.rpc('sync_team_tasks'); if (s.error) { console.warn('sync_team_tasks', s.error.message); return; }
  const [t, r] = await Promise.all([sb.from('team_tasks').select('id,active,repeat,days,on_date,until_date'), sb.from('daily_ops_schedule').select('id,auto_key,status').eq('work_date', day).like('auto_key', 'task:%')]);
  if (t.error || r.error) return;
  const byId = Object.fromEntries((t.data || []).map(x => [x.id, x]));
  const stale = (r.data || []).filter(x => x.status === 'due' && !applies(byId[x.auto_key.slice(5)] || { active: false }, day)).map(x => x.id);
  if (stale.length) await sb.from('daily_ops_schedule').delete().in('id', stale);
}
export const syncToday = async () => { await sb.rpc('sync_daily_ops_today').then(() => {}, () => {}); await syncTeamTasks(); };

// def = existing team_tasks row (edit) or null (new). defaults = { assignee, on_date }.
export async function taskModal(def, defaults = {}, onDone = () => {}) {
  const isNew = !def, accts = await accountNames();
  const t = def || { title: '', assignee: defaults.assignee || me(), repeat: 'once', days: [], on_date: defaults.on_date || opsDate(), start_time: null, duration_min: null, notes: '', account: '' };
  const people = [...new Set([...TEAM, t.assignee].filter(Boolean))];
  const { el } = modal({
    title: isNew ? 'New task' : 'Edit task', submit: isNew ? 'Add task' : 'Save',
    body: `<div class="form pForm tkForm">
      <label class="field" style="grid-column:1/-1">Task<input class="input" name="title" required value="${esc(t.title)}" placeholder="Reply in Sara's inbox"></label>
      <label class="field">Who<select class="select" name="assignee">${opts(people, t.assignee)}</select></label>
      <label class="field">Repeat<select class="select" name="repeat">${opts([['once', 'Once'], ['daily', 'Every day'], ['weekdays', 'Weekdays (Mon–Fri)'], ['weekly', 'Weekly on…']], t.repeat)}</select></label>
      <div class="field tkDays" style="grid-column:1/-1">Days<div class="tkDayRow">${DOW.map(([d, n]) => `<label><input type="checkbox" name="days" value="${d}" ${(t.days || []).includes(d) ? 'checked' : ''}><span>${n}</span></label>`).join('')}</div></div>
      <label class="field tkDate"><span class="tkDateLbl">Date</span><input class="input" type="date" name="on_date" value="${esc(t.on_date || '')}"></label>
      <label class="field tkUntil">Until (optional)<input class="input" type="date" name="until_date" value="${esc(t.until_date || '')}"></label>
      <label class="field">Time (optional)<input class="input" type="time" name="start_time" step="900" value="${esc(String(t.start_time || '').slice(0, 5))}"></label>
      <label class="field">Takes (minutes)<input class="input" type="number" min="5" max="720" step="5" name="duration_min" value="${t.duration_min || ''}" placeholder="—"></label>
      <label class="field">About account (optional)<select class="select" name="account">${opts([['', '—'], ...accts.map(a => [a, a])], t.account || '')}</select></label>
      <label class="field" style="grid-column:1/-1">Notes / link<input class="input" name="notes" value="${esc(t.notes || '')}"></label>
      <p class="s muted" style="grid-column:1/-1;margin:0" id="tkSum"></p>
      ${isNew ? '' : '<button type="button" class="btn sm danger" id="tkDel" style="justify-self:start">Delete task</button>'}</div>`,
    async onSubmit(fd) {
      const rep = fd.get('repeat'), days = fd.getAll('days').map(Number);
      if (rep === 'weekly' && !days.length) { toast('Pick at least one day'); return false; }
      if (rep === 'once' && !fd.get('on_date')) { toast('Pick a date'); return false; }
      const row = {
        title: String(fd.get('title')).trim(), assignee: fd.get('assignee'), repeat: rep, days: rep === 'weekly' ? days : [],
        on_date: fd.get('on_date') || null, until_date: rep === 'once' ? null : fd.get('until_date') || null,
        start_time: fd.get('start_time') || null, duration_min: +fd.get('duration_min') || null,
        account: fd.get('account') || null, notes: String(fd.get('notes') || '').trim() || null, active: true, updated_at: new Date().toISOString(),
      };
      const r = isNew ? await sb.from('team_tasks').insert(row) : await sb.from('team_tasks').update(row).eq('id', def.id);
      if (fail(r, 'Save task')) return false;
      toast(isNew ? 'Task added' : 'Saved'); await syncToday(); onDone();
    },
  });
  const sync = () => {
    const rep = $('[name=repeat]', el).value;
    $('.tkDays', el).style.display = rep === 'weekly' ? '' : 'none';
    $('.tkUntil', el).style.display = rep === 'once' ? 'none' : '';
    $('.tkDateLbl', el).textContent = rep === 'once' ? 'Date' : 'Starting (optional)';
    const days = $$('[name=days]:checked', el).map(x => +x.value);
    $('#tkSum', el).textContent = 'Shows on Today: ' + repeatText({ repeat: rep, days, on_date: $('[name=on_date]', el).value, start_time: $('[name=start_time]', el).value }) + (rep !== 'once' && !$('[name=start_time]', el).value ? ' (any time that day)' : '') + ` · for ${$('[name=assignee]', el).value}`;
  };
  $$('select,input', el).forEach(i => i.addEventListener('input', sync)); sync();
  $('#tkDel', el)?.addEventListener('click', async () => {
    if (fail(await sb.from('team_tasks').update({ active: false, updated_at: new Date().toISOString() }).eq('id', def.id), 'Delete')) return;
    toast('Task deleted'); await syncToday(); $('[data-x]', el).click(); onDone();
  });
}

export async function openTaskById(id, onDone) {
  const r = await sb.from('team_tasks').select('*').eq('id', id).maybeSingle();
  if (r.data) taskModal(r.data, {}, onDone); else toast('That task was deleted');
}

// ---- Schedule → Team tasks: every repeating and upcoming task, by person ----
let list = null;
export async function renderTeamTasks(el, toggleHtml) {
  const r = await sb.from('team_tasks').select('*').eq('active', true).order('assignee').order('sort').order('created_at');
  if (el.dataset.page !== 'schedule') return;
  const head = `${toggleHtml}<div class="head"><div><h1>Schedule</h1><p>Everyone's own tasks. Daily, weekday and weekly ones appear on Today automatically; one-offs appear on their day.</p></div>
    <div class="row"><button class="btn primary sm" id="tkAdd">New task</button></div></div>`;
  if (r.error) { el.innerHTML = head + '<div class="card"><div class="empty">The team tasks table isn\'t set up in the database yet.</div></div>'; return; }
  const today = opsDate();
  list = (r.data || []).filter(t => t.repeat !== 'once' || !t.on_date || t.on_date >= today);
  const people = [...new Set([...TEAM, ...list.map(t => t.assignee)])].filter(p => list.some(t => t.assignee === p) || TEAM.includes(p));
  el.innerHTML = `${head}<div class="tkPeople">${people.map(p => {
    const mine = list.filter(t => t.assignee === p);
    return `<section class="card"><header><div class="tkWho">${avatar(p)}<div><h2>${esc(p)}</h2><p>${mine.length} task${mine.length === 1 ? '' : 's'}${p === 'Anaz' ? ' + posting, replies and creation (other tabs)' : ''}</p></div></div><button class="btn sm" data-addfor="${esc(p)}">Add</button></header>
      ${mine.length ? `<ul class="tkList">${mine.map(t => `<li data-tk="${t.id}"><div><b>${esc(t.title)}</b><span>${esc(repeatText(t))}${t.duration_min ? ` · ${t.duration_min} min` : ''}</span></div><button class="btn sm ghost" data-edit="${t.id}">Edit</button></li>`).join('')}</ul>` : '<div class="empty">No tasks yet.</div>'}</section>`;
  }).join('')}</div>`;
  const redraw = () => renderTeamTasks(el, toggleHtml);
  $('#tkAdd', el).onclick = () => taskModal(null, {}, redraw);
  $$('[data-addfor]', el).forEach(b => b.onclick = () => taskModal(null, { assignee: b.dataset.addfor }, redraw));
  $$('[data-tk]', el).forEach(li => li.onclick = () => taskModal(list.find(t => t.id === li.dataset.tk), {}, redraw));
}
