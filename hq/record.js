// Track record (admin): a calendar of who finished their tasks on which day. Data: RPC track_record(from, to), which also
// reports days nobody opened HQ (no rows were ever created for them), shown as "HQ not opened" rather than hidden.
import { sb, esc, $, $$, avatar, fail } from './core.js';

const PEOPLE = ['Anaz', 'Chase', 'Tengku', 'Peter', 'Razeen', 'Sara', 'Dev', 'Sahid', 'Reza'];
const MON = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const view = { y: null, m: null, who: '', day: null };
const opsToday = () => new Date(Date.now() + 6 * 3600e3).toISOString().slice(0, 10); // 2 AM GMT+8 rollover
const iso = (y, m, d) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
const cache = new Map();

async function fetchRange(from, to) {
  const k = from + to;
  if (cache.has(k) && Date.now() - cache.get(k).at < 60000) return cache.get(k).rows;
  const r = await sb.rpc('track_record', { p_from: from, p_to: to });
  if (r.error) return { error: r.error.message };
  cache.set(k, { at: Date.now(), rows: r.data || [] });
  return r.data || [];
}

// One day, for the chosen person (or everyone): planned / done / skipped + a state for colouring.
function cellOf(rows, day, who, today) {
  const rs = rows.filter(r => r.day === day && (!who || r.assignee === who));
  if (day > today) return { state: 'future', planned: 0, done: 0 };
  if (!rs.length) return { state: 'none', planned: 0, done: 0 };
  const planned = rs.reduce((n, r) => n + r.planned, 0), done = rs.reduce((n, r) => n + r.done, 0), skipped = rs.reduce((n, r) => n + r.skipped, 0);
  const norec = rs.every(r => r.no_record);
  if (day === today) return { state: 'live', planned, done, skipped };
  if (!planned) return { state: 'none', planned, done };
  if (norec) return { state: 'norec', planned, done: 0, skipped: 0 };
  const p = done / planned;
  return { state: p >= 1 ? 'full' : p >= 0.6 ? 'part' : 'miss', planned, done, skipped, pct: Math.round(p * 100) };
}

export async function renderRecord(root) {
  const t = opsToday();
  if (view.y == null) { view.y = +t.slice(0, 4); view.m = +t.slice(5, 7) - 1; }
  root.innerHTML = `<div class="head"><div><h1>Track record</h1><p>Every day, who finished what they were given. Green is everything done; red is under 60%.</p></div></div><div id="rcBody"><div class="empty">Loading…</div></div>`;
  const body = $('#rcBody', root);
  const first = iso(view.y, view.m, 1), last = iso(view.y, view.m, new Date(view.y, view.m + 1, 0).getDate());
  const from28 = new Date(Date.parse(t) - 28 * 864e5).toISOString().slice(0, 10);
  const [rows, recent] = await Promise.all([fetchRange(first, last), fetchRange(from28, t)]);
  if (!body.isConnected) return;
  const err = rows.error || recent.error;
  if (err) { body.innerHTML = `<section class="card"><div class="body s muted">Track record unavailable: ${esc(err)}${/does not exist|could not find/i.test(err) ? ' (run supabase/2026-10-09-reply-record-scores.sql)' : ''}</div></section>`; return; }
  const who = view.who, people = PEOPLE.filter(p => recent.some(r => r.assignee === p) || rows.some(r => r.assignee === p));

  // Summary over the last 14 finished days (today excluded: it is still in progress).
  const days14 = Array.from({ length: 14 }, (_, i) => new Date(Date.parse(t) - (i + 1) * 864e5).toISOString().slice(0, 10));
  const sum = w => {
    let planned = 0, done = 0, norec = 0, missed = 0, streak = 0, streakOn = true;
    for (const d of days14) {
      const c = cellOf(recent, d, w, t); if (c.state === 'none') continue;
      planned += c.planned; done += c.done; if (c.state === 'norec') norec++; if (c.state === 'miss' || c.state === 'norec') missed++;
      if (streakOn && c.state === 'full') streak++; else streakOn = false;
    }
    return { planned, done, pct: planned ? Math.round(done / planned * 100) : null, norec, missed, streak };
  };
  const s = sum(who);
  const lead = people.map(p => ({ p, ...sum(p) })).sort((a, b) => (a.pct ?? 101) - (b.pct ?? 101));

  // Month grid (Monday first).
  const dim = new Date(view.y, view.m + 1, 0).getDate(), offset = (new Date(view.y, view.m, 1).getDay() + 6) % 7;
  const cells = [...Array(offset).fill(null), ...Array.from({ length: dim }, (_, i) => i + 1)];
  const grid = cells.map(d => {
    if (!d) return '<span class="rcCell blank"></span>';
    const day = iso(view.y, view.m, d), c = cellOf(rows, day, who, t);
    const label = { full: 'All done', part: `${c.done}/${c.planned} done`, miss: `${c.done}/${c.planned} done`, norec: 'HQ not opened', live: 'In progress', none: 'Nothing planned', future: '' }[c.state];
    const sub = c.state === 'norec' ? '—' : c.state === 'live' ? `${c.done}/${c.planned}` : c.pct != null ? c.pct + '%' : '';
    return `<button type="button" class="rcCell ${c.state} ${day === t ? 'today' : ''} ${view.day === day ? 'sel' : ''}" data-day="${day}" title="${esc(day + ' · ' + label)}" ${c.state === 'future' ? 'disabled' : ''}><b>${d}</b><small>${sub}</small></button>`;
  }).join('');

  body.innerHTML = `<div class="rcTop">
      <label class="field" style="max-width:220px">Person<select class="select" id="rcWho"><option value="">Everyone</option>${people.map(p => `<option ${p === who ? 'selected' : ''}>${esc(p)}</option>`).join('')}</select></label>
      <div class="rcKpis"><div class="kpi"><label>Last 14 days</label><b>${s.pct == null ? '—' : s.pct + '%'}</b><small>${s.done} of ${s.planned} tasks</small></div>
        <div class="kpi"><label>Full days in a row</label><b>${s.streak}</b><small>ending yesterday</small></div>
        <div class="kpi"><label>Bad days</label><b class="${s.missed ? 'down' : ''}">${s.missed}</b><small>under 60%${s.norec ? `, ${s.norec} with HQ not opened` : ''}</small></div></div></div>
    <div class="rcCols"><section class="card"><header><div><h2>${MON[view.m]} ${view.y}</h2><p>${who ? esc(who) : 'Everyone together'}. Click a day.</p></div><div class="row"><button class="btn sm" id="rcPrev" aria-label="Previous month">←</button><button class="btn sm" id="rcNext" aria-label="Next month">→</button></div></header>
      <div class="body"><div class="rcGrid"><span class="rcHd">Mon</span><span class="rcHd">Tue</span><span class="rcHd">Wed</span><span class="rcHd">Thu</span><span class="rcHd">Fri</span><span class="rcHd">Sat</span><span class="rcHd">Sun</span>${grid}</div>
      <div class="rcKey"><span><i class="full"></i>All done</span><span><i class="part"></i>60–99%</span><span><i class="miss"></i>Under 60%</span><span><i class="norec"></i>HQ not opened</span><span><i class="live"></i>Today</span></div></div></section>
    <section class="card"><header><div><h2>Last 14 days by person</h2><p>Lowest first. Click to filter.</p></div></header><div class="body flush"><ul class="rcList">${lead.map(r => `<li data-who="${esc(r.p)}">${avatar(r.p, 'sm')}<b>${esc(r.p)}</b><span class="rcMini">${days14.slice().reverse().map(d => `<i class="${cellOf(recent, d, r.p, t).state}" title="${d}"></i>`).join('')}</span><em class="${r.pct != null && r.pct < 60 ? 'down' : r.pct === 100 ? 'up' : ''}">${r.pct == null ? '—' : r.pct + '%'}</em></li>`).join('') || '<li class="muted s" style="padding:16px">No tasks recorded.</li>'}</ul></div></section></div>
    <section class="card" id="rcDay" ${view.day ? '' : 'hidden'}></section>`;

  $('#rcWho', body).onchange = e => { view.who = e.target.value; renderRecord(root); };
  $('#rcPrev', body).onclick = () => { view.m--; if (view.m < 0) { view.m = 11; view.y--; } view.day = null; renderRecord(root); };
  $('#rcNext', body).onclick = () => { view.m++; if (view.m > 11) { view.m = 0; view.y++; } view.day = null; renderRecord(root); };
  $$('[data-day]', body).forEach(b => b.onclick = () => { view.day = b.dataset.day; $$('.rcCell', body).forEach(x => x.classList.toggle('sel', x === b)); dayDetail($('#rcDay', body), view.day, who); });
  $$('.rcList li[data-who]', body).forEach(li => li.onclick = () => { view.who = li.dataset.who; renderRecord(root); });
  if (view.day) dayDetail($('#rcDay', body), view.day, who);
}

async function dayDetail(el, day, who) {
  el.hidden = false;
  el.innerHTML = `<header><div><h2>${new Date(day + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</h2><p>${who ? esc(who) : 'Everyone'}</p></div></header><div class="body"><div class="empty">Loading…</div></div>`;
  const r = await sb.from('daily_ops_schedule').select('task,status,start_time,assignee,completed_by_name,completed_at').eq('work_date', day).order('start_time');
  if (!el.isConnected) return;
  if (fail(r, 'Load day')) return;
  const rows = (r.data || []).filter(x => !who || (x.assignee || 'Anaz') === who);
  const ST = { done: ['Done', 'good'], skipped: ['Skipped', 'warn'] };
  const hhmm = v => v ? String(v).slice(0, 5) : '';
  const when = v => v ? new Date(v).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kuala_Lumpur' }) : '';
  el.querySelector('.body').innerHTML = rows.length ? `<table class="tbl"><thead><tr><th>Time</th><th>Task</th><th>Owner</th><th>Status</th><th>Ticked by</th></tr></thead><tbody>${rows.map(x => {
    const st = ST[x.status] || ['Not done', 'bad'];
    return `<tr><td class="muted">${hhmm(x.start_time)}</td><td>${esc(x.task)}</td><td>${esc(x.assignee || 'Anaz')}</td><td><span class="tag ${st[1]}">${st[0]}</span></td><td class="muted">${x.status === 'done' ? esc(x.completed_by_name || '') + (x.completed_at ? ' · ' + when(x.completed_at) : '') : ''}</td></tr>`;
  }).join('')}</tbody></table>`
    : '<div class="empty">No task rows exist for this day. Task rows are created when someone opens HQ, so nobody opened it (or nothing was planned).</div>';
  el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}
