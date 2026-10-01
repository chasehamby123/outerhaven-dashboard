// Schedule: the weekly posting calendar. Drag a post to move it (day and time, 15-minute steps), click it to edit,
// click an empty slot to add one. It edits daily_ops_weekly_posts, the template the server turns into Today's tasks,
// so a change to today's posts shows up on Today straight away.
import { sb, state, esc, $, $$, toast, fail, modal, opts, acIdx, avatar } from './core.js';
import { opsDate } from './today.js';
import { renderCreation } from './creation.js';
import { renderTeamTasks } from './tasks.js';

// The slider at the top of Schedule: posting calendar vs the weekend post creation batch.
const viewToggle = on => `<div class="viewSw" data-on="${on}" role="tablist"><a href="#/schedule" class="${on === 'post' ? 'on' : ''}">Posting</a><a href="#/schedule/creation" class="${on === 'create' ? 'on' : ''}">Post creation</a><a href="#/schedule/tasks" class="${on === 'tasks' ? 'on' : ''}">Team tasks</a><i></i></div>`;

const DAYS = [[1, 'Mon'], [2, 'Tue'], [3, 'Wed'], [4, 'Thu'], [5, 'Fri'], [6, 'Sat'], [0, 'Sun']];
const DAY_NAME = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const START = 6 * 60, END = 26 * 60;   // 6 AM to 2 AM: the ops day rolls over at 2 AM
const PX = 1.15;                        // pixels per minute
const SNAP = 15, POST_MIN = 60, ENGAGE_MIN = 15, PRE_MIN = 30;
const TZ = 'Asia/Singapore';

let root, posts = [], accounts = [], loaded = false, channel = null, scrolled = false, spot = null;

// What a post is, from its content code: lead magnet versions (A, B, C…), video, or a credibility ("human") post.
const kind = code => /vid/i.test(code || '') ? 'vid' : /cred|human|life|personal/i.test(code || '') ? 'cred' : 'lm';
const KIND_LABEL = { lm: 'Lead magnet', vid: 'Video', cred: 'Credibility' };
const PLAY = '<svg viewBox="0 0 10 10" aria-hidden="true"><path d="M2 1l7 4-7 4z"/></svg>';
const codeHtml = p => { const k = kind(p.content_code); return k === 'vid' ? `${PLAY}Video` : k === 'cred' ? 'Cred' : esc(p.content_code || 'Post'); };
// Minutes Malaysia is ahead of New York right now (12 in summer, 13 in winter): the audience clock under each hour.
const tzNow = tz => new Date(new Date().toLocaleString('en-US', { timeZone: tz }));
const ET_GAP = Math.round((tzNow(TZ) - tzNow('America/New_York')) / 60000);
const labelET = n => { n = ((n % 1440) + 1440) % 1440; const h = Math.floor(n / 60), m = n % 60; return `${((h + 11) % 12) + 1}${m ? ':' + String(m).padStart(2, '0') : ''}${h >= 12 ? 'p' : 'a'} ET`; };

const toMin = t => { const [h, m] = String(t || '0:0').split(':').map(Number); const n = h * 60 + (m || 0); return n < 120 ? n + 1440 : n; };
const toTime = n => { n = ((n % 1440) + 1440) % 1440; return `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`; };
const label12 = n => { n = ((n % 1440) + 1440) % 1440; const h = Math.floor(n / 60), m = n % 60; return `${((h + 11) % 12) + 1}${m ? ':' + String(m).padStart(2, '0') : ''} ${h >= 12 ? 'PM' : 'AM'}`; };
const todayDow = () => new Date(opsDate() + 'T12:00:00').getDay();
const nowMin = () => { const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date()).map(x => [x.type, x.value])); const n = +p.hour * 60 + +p.minute; return n < 120 ? n + 1440 : n; };
const isSara = o => String(o || '').trim().toLowerCase() === 'sara';
const ownerNames = () => [...new Set([...accounts.map(a => a.owner_name), ...posts.map(p => p.owner_name)].filter(Boolean))].sort();

async function load() {
  const [w, a] = await Promise.all([
    sb.from('daily_ops_weekly_posts').select('*').order('day_of_week').order('start_time'),
    sb.from('daily_ops_accounts').select('id,owner_name,active').order('sort_order'),
  ]);
  if (fail(w, 'Load schedule')) return;
  posts = w.data || []; accounts = (a.data || []).filter(x => x.active !== false); loaded = true;
}

export async function renderSchedule(el, sub) {
  if (sub === 'creation') return renderCreation(el, viewToggle('create'));
  if (sub === 'tasks') return renderTeamTasks(el, viewToggle('tasks'));
  root = el;
  if (!loaded) { root.innerHTML = '<div class="empty">Loading…</div>'; await load(); if (root.dataset.page !== 'schedule') return; }
  draw();
  if (!channel) {
    channel = sb.channel('hq-schedule').on('postgres_changes', { event: '*', schema: 'public', table: 'daily_ops_weekly_posts' }, async () => { if (dragging) return; await load(); if (root.dataset.page === 'schedule' && !document.querySelector('.modal')) draw(); }).subscribe();
    setInterval(() => { if (root.dataset.page === 'schedule') drawNow(); }, 60000);
  }
}

// Lay out one day's posts. Overlapping posts share the width. Today runs posts back to back with a 15-min
// reply block after each (except Sara), so a post that starts before the previous one finishes gets pushed:
// work that out exactly like the server does and show the real start.
function layout(dayPosts) {
  const items = dayPosts.map(p => ({ p, s: toMin(p.start_time), e: toMin(p.start_time) + POST_MIN })).sort((a, b) => a.s - b.s);
  let cursor = null;
  for (const it of items.filter(x => x.p.active !== false)) {
    it.real = cursor == null || it.s > cursor ? it.s : cursor;
    cursor = it.real + POST_MIN + (isSara(it.p.owner_name) ? 0 : ENGAGE_MIN);
  }
  const groups = []; let g = null;
  for (const it of items) { if (!g || it.s >= g.end) { g = { items: [], end: 0 }; groups.push(g); } g.items.push(it); g.end = Math.max(g.end, it.e); }
  for (const grp of groups) {
    const lanes = [];
    for (const it of grp.items) { let i = lanes.findIndex(end => end <= it.s); if (i < 0) { i = lanes.length; lanes.push(0); } lanes[i] = it.e; it.lane = i; }
    grp.items.forEach(it => { it.lanes = lanes.length; });
  }
  return items;
}

function blockHtml(it) {
  const p = it.p, top = (it.s - START) * PX, w = 100 / it.lanes, left = it.lane * w, k = kind(p.content_code);
  const sara = isSara(p.owner_name), off = p.active === false, pushed = it.real != null && it.real !== it.s;
  const dim = spot && p.owner_name !== spot;
  return `<div class="sBlock t-${k}${off ? ' off' : ''}${sara ? ' nr' : ''}${dim ? ' dim' : ''}" data-ac="${acIdx(p.owner_name)}" data-id="${p.id}" title="${esc(`${p.owner_name} · ${KIND_LABEL[k]}${k === 'lm' ? ' ' + (p.content_code || '') : ''} · ${label12(it.s)}`)}" style="top:${top}px;left:calc(${left}% + 3px);width:calc(${w}% - 6px)">
      <div class="sPost" style="height:${POST_MIN * PX - 2}px"><div class="top">${avatar(p.owner_name, 'xs')}<b>${esc(p.owner_name || 'Account')}</b><span class="code">${codeHtml(p)}</span></div><span class="tm">${label12(it.s)}${off ? ' · paused' : ''}</span>${pushed ? `<em title="The post before it and its reply block run until then, so this one starts later">Runs ${label12(it.real)}</em>` : ''}</div>
      ${sara ? '' : `<div class="sEngage" style="height:${ENGAGE_MIN * PX - 1}px" title="15 minutes replying to comments on the previous post">+15 min replies</div>`}
    </div>`;
}

// The week at a glance: how many posts, the content mix, and cadence per account (click to spotlight one).
function summaryHtml(active) {
  const mix = { lm: 0, vid: 0, cred: 0 }; active.forEach(p => mix[kind(p.content_code)]++);
  const total = active.length, posting = new Set(active.map(p => p.owner_name));
  // Accounts with no posts are listed too (so a silent account shows), unless a posting name already covers them ("Peter" vs "Peter Plaut").
  const names = ownerNames().filter(n => posting.has(n) || !active.some(p => String(p.owner_name).split(' ')[0].toLowerCase() === String(n).split(' ')[0].toLowerCase()));
  const per = names.map(n => ({ n, list: active.filter(p => p.owner_name === n).sort((a, b) => kind(a.content_code).localeCompare(kind(b.content_code))) })).sort((a, b) => b.list.length - a.list.length || a.n.localeCompare(b.n));
  const quiet = per.filter(x => x.list.length < 2).map(x => x.n);
  const hints = [];
  if (total && mix.cred / total < 0.15) hints.push(`<b>${mix.cred} of ${total}</b> posts are credibility posts. Accounts that only post lead magnets read as bots; aim for about 1 in 4.`);
  if (quiet.length) hints.push(`<b>${esc(quiet.join(', '))}</b> ${quiet.length > 1 ? 'post' : 'posts'} less than twice a week.`);
  return `<section class="card sSum">
    <div>
      <div class="sBig"><b>${total}</b><span>posts a week across ${per.filter(x => x.list.length).length} accounts</span></div>
      <div class="mix" aria-hidden="true">${['lm', 'vid', 'cred'].map(k => mix[k] ? `<i class="${k}" style="flex:${mix[k]}"></i>` : '').join('')}</div>
      <div class="mixKey">${['lm', 'vid', 'cred'].map(k => `<span><i class="${k}"></i><b>${mix[k]}</b>${KIND_LABEL[k].toLowerCase()}</span>`).join('')}</div>
      ${hints.map(h => `<p class="sHint">${h}</p>`).join('')}
    </div>
    <div>
      <div class="cadH"><h3>Posts per account, per week</h3><span>${spot ? `Showing ${esc(spot)} · <button type="button" class="link" data-spot="">show all</button>` : 'Click an account to highlight it'}</span></div>
      <div class="cad${spot ? ' dim' : ''}">${per.map(x => `<button type="button" class="cadChip${spot === x.n ? ' on' : ''}" data-ac="${acIdx(x.n)}" data-spot="${esc(x.n)}">${avatar(x.n, 'lg')}<b>${esc(x.n)}</b><span class="sq">${x.list.map(p => `<i class="${kind(p.content_code) === 'lm' ? '' : 'v'}" title="${esc(DAY_NAME[p.day_of_week].slice(0, 3) + ' · ' + (p.content_code || ''))}"></i>`).join('') || ''}<em>${x.list.length}</em></span></button>`).join('')}</div>
    </div>
  </section>`;
}

function draw() {
  const tdow = todayDow(), hours = [];
  for (let m = START; m < END; m += 60) hours.push(m);
  const active = posts.filter(p => p.active !== false);
  const perDay = DAYS.map(([d]) => active.filter(p => p.day_of_week === d).length), avg = perDay.reduce((a, b) => a + b, 0) / 7;
  root.innerHTML = `${viewToggle('post')}<div class="head"><div><h1>Schedule</h1><p>The weekly posting plan in Malaysia time, with New York time under each hour. Drag a post to move it, click it to edit, click an empty slot to add one.</p></div>
      <div class="row"><div class="row s muted" style="gap:14px;margin-right:6px"><span class="sKey"><i class="k1"></i>Lead magnet / video</span><span class="sKey"><i class="k3"></i>Credibility</span><span class="sKey"><i class="k2"></i>Replies</span></div><button class="btn primary sm" id="sAdd">Add post</button></div></div>
    ${summaryHtml(active)}
    <div class="card sCal">
      <div class="sScroll" id="sScroll"><div class="sHead"><div>MYT</div>${DAYS.map(([d, n], i) => {
        const own = [...new Set(active.filter(p => p.day_of_week === d).sort((a, b) => toMin(a.start_time) - toMin(b.start_time)).map(p => p.owner_name))];
        return `<div class="${d === tdow ? 'isToday' : ''}${perDay[i] < avg - 0.99 ? ' thin' : ''}"><b>${n}</b><span>${perDay[i]} post${perDay[i] === 1 ? '' : 's'}</span><div class="dots">${own.map(o => `<i data-ac="${acIdx(o)}" title="${esc(o)}"></i>`).join('')}</div></div>`;
      }).join('')}</div><div class="sGrid" style="height:${(END - START) * PX}px">
        <div class="sHours">${hours.map(m => `<span style="top:${(m - START) * PX}px">${label12(m)}${m > START ? `<em>${labelET(m - ET_GAP)}</em>` : ''}</span>`).join('')}</div>
        ${DAYS.map(([d]) => {
          const dayPosts = posts.filter(p => p.day_of_week === d), act = dayPosts.filter(p => p.active !== false);
          const first = act.length ? Math.min(...act.map(p => toMin(p.start_time))) : null;
          return `<div class="sCol${d === tdow ? ' isToday' : ''}" data-dow="${d}">
            ${hours.map(m => `<i class="sLine" style="top:${(m - START) * PX}px"></i><i class="sLine half" style="top:${(m + 30 - START) * PX}px"></i>`).join('')}
            ${first != null && first - PRE_MIN >= START ? `<div class="sPre" data-ac="${acIdx('Sara')}" style="top:${(first - PRE_MIN - START) * PX}px;height:${PRE_MIN * PX - 2}px${spot && spot !== 'Sara' ? ';opacity:.25' : ''}">${avatar('Sara', 'xs')}Sara · reply to 20 comments</div>` : ''}
            ${layout(dayPosts).map(blockHtml).join('')}
            ${d === tdow ? '<i class="sNow" id="sNow"></i>' : ''}
            <div class="sHover hidden"></div>
          </div>`;
        }).join('')}
      </div></div>
    </div>
    <p class="s muted" style="margin-top:12px">Changes apply every week. Today's column feeds the Today checklist straight away; when posts overlap, Today runs them back to back ("Runs" shows the real start).</p>`;
  drawNow();
  const sc = $('#sScroll', root);
  if (!scrolled) { const firstPost = Math.min(...active.map(p => toMin(p.start_time)), 19 * 60); lastScroll = Math.max(0, (firstPost - 90 - START) * PX); scrolled = true; }
  sc.scrollTop = lastScroll;
  sc.onscroll = () => { lastScroll = sc.scrollTop; };
  $$('.sBlock', root).forEach(b => b.addEventListener('pointerdown', startDrag));
  $$('[data-spot]', root).forEach(b => b.onclick = () => { const v = b.dataset.spot; spot = !v || spot === v ? null : v; draw(); });
  $('#sAdd', root).onclick = () => editPost(null, { day_of_week: tdow, start: 20 * 60 });
  const slotAt = (c, e) => { const r = c.getBoundingClientRect(); return snap(START + Math.floor((e.clientY - r.top) / PX / SNAP) * SNAP); };
  $$('.sCol', root).forEach(c => {
    const hov = $('.sHover', c);
    c.addEventListener('click', e => { if (e.target.closest('.sBlock') || justDragged) return; editPost(null, { day_of_week: Number(c.dataset.dow), start: slotAt(c, e) }); });
    c.addEventListener('mousemove', e => {
      if (dragging || e.target.closest('.sBlock')) { hov.classList.add('hidden'); return; }
      const m = slotAt(c, e); hov.classList.remove('hidden'); hov.style.top = `${(m - START) * PX}px`; hov.style.height = `${POST_MIN * PX - 2}px`; hov.textContent = `+ Add at ${label12(m)}`;
    });
    c.addEventListener('mouseleave', () => hov.classList.add('hidden'));
  });
}
let lastScroll = 0;

function drawNow() {
  const n = $('#sNow', root); if (!n) return;
  const m = nowMin(); n.style.display = m >= START && m < END ? '' : 'none'; n.style.top = `${(m - START) * PX}px`;
}

const snap = m => Math.min(END - POST_MIN, Math.max(START, Math.round(m / SNAP) * SNAP));

// ---------------- Drag ----------------
let dragging = null, justDragged = false;
function startDrag(e) {
  if (e.button !== 0) return;
  const el = e.currentTarget, p = posts.find(x => x.id === el.dataset.id); if (!p) return;
  const cols = $$('.sCol', root).map(c => ({ c, r: c.getBoundingClientRect(), dow: Number(c.dataset.dow) }));
  dragging = { el, p, x0: e.clientX, y0: e.clientY, s0: toMin(p.start_time), dow0: p.day_of_week, moved: false, cols, dow: p.day_of_week, s: toMin(p.start_time) };
  el.setPointerCapture(e.pointerId);
  el.addEventListener('pointermove', moveDrag); el.addEventListener('pointerup', endDrag, { once: true }); el.addEventListener('pointercancel', endDrag, { once: true });
}
function moveDrag(e) {
  const d = dragging; if (!d) return;
  const dx = e.clientX - d.x0, dy = e.clientY - d.y0;
  if (!d.moved && Math.hypot(dx, dy) < 5) return;
  if (!d.moved) { d.moved = true; d.el.classList.add('drag'); d.ghost = d.el.cloneNode(true); d.ghost.classList.add('ghost'); d.el.parentElement.appendChild(d.ghost); d.el.style.left = '2px'; }
  const col = d.cols.find(c => e.clientX >= c.r.left && e.clientX < c.r.right) || d.cols.reduce((a, c) => Math.abs(c.r.left - e.clientX) < Math.abs(a.r.left - e.clientX) ? c : a);
  d.s = snap(d.s0 + dy / PX); d.dow = col.dow;
  // Stay in the original column (re-parenting would drop pointer capture); shift across with a transform.
  const home = d.cols.find(c => c.dow === d.dow0);
  d.el.style.transform = `translateX(${col.r.left - home.r.left}px)`; d.el.style.width = `${col.r.width - 4}px`;
  d.el.style.top = `${(d.s - START) * PX}px`;
  $('.sPost .tm', d.el).textContent = `${DAY_NAME[d.dow].slice(0, 3)} ${label12(d.s)}`;
}
async function endDrag(e) {
  const d = dragging; dragging = null; if (!d) return;
  d.el.removeEventListener('pointermove', moveDrag);
  if (!d.moved) { editPost(d.p); return; }
  justDragged = true; setTimeout(() => { justDragged = false; }, 50);
  d.ghost?.remove();
  if (d.s === d.s0 && d.dow === d.dow0) { draw(); return; }
  const before = { day_of_week: d.p.day_of_week, start_time: d.p.start_time, end_time: d.p.end_time };
  const ok = await save(d.p, { day_of_week: d.dow, start: d.s });
  if (ok) undoToast(`${d.p.owner_name} · ${d.p.content_code || 'Post'} moved to ${DAY_NAME[d.dow]} ${label12(d.s)}`, async () => { await save(d.p, { day_of_week: before.day_of_week, start: toMin(before.start_time) }); });
}

// Writes a post's slot, then rebuilds Today if today's column was touched.
async function save(p, { day_of_week, start, owner_name = p.owner_name, content_code = p.content_code, active = p.active }) {
  const patch = { day_of_week, start_time: toTime(start) + ':00', end_time: toTime(start + POST_MIN) + ':00', owner_name, content_code, active, label: `${owner_name} ${content_code || ''}`.trim(), updated_at: new Date().toISOString(), updated_by: state.user?.id || null };
  const touched = [p.day_of_week, day_of_week].includes(todayDow());
  const res = p.id ? await sb.from('daily_ops_weekly_posts').update(patch).eq('id', p.id) : await sb.from('daily_ops_weekly_posts').insert({ ...patch, timezone: TZ, created_by: state.user?.id || null });
  if (fail(res, 'Save schedule')) { draw(); return false; }
  if (p.id) Object.assign(p, patch);
  if (touched || (!p.id && day_of_week === todayDow())) { const s = await sb.rpc('sync_daily_ops_today'); if (s.error) console.warn('sync', s.error.message); }
  await load(); draw();
  return true;
}

function undoToast(msg, undo) {
  document.querySelectorAll('.toast').forEach(x => x.remove());
  const t = document.createElement('div'); t.className = 'toast'; t.innerHTML = `<span>${esc(msg)}</span><button type="button">Undo</button>`;
  $('button', t).onclick = async () => { t.remove(); await undo(); toast('Undone'); };
  document.body.appendChild(t); setTimeout(() => t.remove(), 6000);
}

// ---------------- Edit / add ----------------
function editPost(p, init = {}) {
  const isNew = !p, cur = p || { owner_name: '', content_code: 'A', day_of_week: init.day_of_week, active: true };
  const start = p ? toMin(p.start_time) : init.start;
  const times = []; for (let m = START; m <= END - POST_MIN; m += SNAP) times.push([m, label12(m)]);
  const { el } = modal({ title: isNew ? 'Add a post' : `${p.owner_name} · ${p.content_code || 'Post'}`, submit: isNew ? 'Add' : 'Save', body: `<div class="form">
      <label class="field">Account<select class="select" name="owner" required><option value="">Choose…</option>${opts(ownerNames(), cur.owner_name)}</select></label>
      <label class="field">Content<input class="input" name="code" required value="${esc(cur.content_code || '')}" placeholder="A, B, C = lead magnet · Video · Cred Post" list="sCodes"><datalist id="sCodes">${[...new Set(posts.map(x => x.content_code).filter(Boolean))].map(c => `<option value="${esc(c)}">`).join('')}</datalist></label>
      <label class="field">Day<select class="select" name="dow">${opts(DAYS.map(([d]) => [d, DAY_NAME[d]]), cur.day_of_week)}</select></label>
      <label class="field">Time (Malaysia)<select class="select" name="start">${opts(times, start)}</select></label>
      ${isNew ? '' : `<label class="field full row" style="gap:8px"><input type="checkbox" name="active" ${cur.active !== false ? 'checked' : ''}> Active (turn off to pause without deleting)</label>`}
    </div>${!isNew && state.role === 'admin' ? '<div class="row" style="margin-top:14px"><button type="button" class="link s" id="sDel" style="color:var(--bad)">Delete this post from the schedule</button></div>' : ''}`,
    onSubmit: async fd => save(cur, { day_of_week: Number(fd.get('dow')), start: Number(fd.get('start')), owner_name: fd.get('owner'), content_code: String(fd.get('code')).trim(), active: isNew ? true : fd.get('active') === 'on' }),
  });
  const del = $('#sDel', el);
  if (del) del.onclick = async () => {
    if (!confirm(`Delete ${p.owner_name} · ${p.content_code} on ${DAY_NAME[p.day_of_week]}s?`)) return;
    if (fail(await sb.from('daily_ops_weekly_posts').delete().eq('id', p.id), 'Delete')) return;
    if (p.day_of_week === todayDow()) await sb.rpc('sync_daily_ops_today');
    $('[data-x]', el).click(); toast('Deleted'); await load(); draw();
  };
}
