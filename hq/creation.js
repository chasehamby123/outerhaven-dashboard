// Schedule → Post creation: the weekly blocks where creatives get made for each account.
// Each block = start time + N creatives × minutes each, so the end time is always derived. Today picks up the
// day's blocks as tasks (sync_daily_ops_today, auto_key 'create:<id>').
import { sb, esc, $, $$, toast, fail, modal, opts, avatar } from './core.js';
import { opsDate } from './today.js';

const DAYS = [[1, 'Monday'], [2, 'Tuesday'], [3, 'Wednesday'], [4, 'Thursday'], [5, 'Friday'], [6, 'Saturday'], [0, 'Sunday']];
let root, blocks = [], owners = [], loaded = false, channel = null;

const toMin = t => { const [h, m] = String(t || '0:0').split(':').map(Number); return h * 60 + (m || 0); };
const toTime = n => `${String(Math.floor(n / 60) % 24).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;
const label12 = n => { const h = Math.floor(n / 60) % 24, m = n % 60; return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`; };
const mins = b => b.creatives * b.minutes_per;
const hrs = m => { const h = m / 60; return Number.isInteger(h) ? `${h}h` : `${Math.floor(h) ? Math.floor(h) + 'h ' : ''}${m % 60}m`; };

async function load() {
  const [b, a] = await Promise.all([
    sb.from('daily_ops_creation_blocks').select('*').order('day_of_week').order('start_time'),
    sb.from('daily_ops_accounts').select('owner_name,active').order('sort_order'),
  ]);
  if (b.error) { blocks = null; console.error(b.error); } else blocks = b.data || [];
  owners = [...new Set((a.data || []).filter(x => x.active !== false).map(x => x.owner_name))];
  loaded = true;
}

export async function renderCreation(el, toggleHtml) {
  root = el;
  if (!loaded) { root.innerHTML = '<div class="empty">Loading…</div>'; await load(); if (root.dataset.page !== 'schedule') return; }
  draw(toggleHtml);
  if (!channel) channel = sb.channel('hq-creation').on('postgres_changes', { event: '*', schema: 'public', table: 'daily_ops_creation_blocks' }, async () => { await load(); if (root.dataset.page === 'schedule' && location.hash.includes('creation') && !document.querySelector('.modal')) draw(toggleHtml); }).subscribe();
}

function draw(toggleHtml) {
  const head = `${toggleHtml}<div class="head"><div><h1>Schedule</h1><p>When the creatives for each account get made. Each block is creatives × minutes per creative; Today shows them as tasks on the day.</p></div>
    <div class="row"><button class="btn primary sm" id="cAdd">Add block</button></div></div>`;
  if (blocks === null) { root.innerHTML = head + '<div class="card"><div class="empty">The post creation table isn\'t set up in the database yet.</div></div>'; return; }
  const act = blocks.filter(b => b.active !== false), tdow = new Date(opsDate() + 'T12:00:00').getDay();
  const totC = act.reduce((n, b) => n + b.creatives, 0), totM = act.reduce((n, b) => n + mins(b), 0);
  const byAcct = {}; act.forEach(b => byAcct[b.owner_name] = (byAcct[b.owner_name] || 0) + b.creatives);
  const days = DAYS.map(([d, name]) => ({ d, name, list: blocks.filter(b => b.day_of_week === d).sort((a, b) => toMin(a.start_time) - toMin(b.start_time)) })).filter(x => x.list.length);

  root.innerHTML = `${head}
    <div class="cTotals">
      <div><b>${totC}</b><span>creatives a week</span></div>
      <div><b>${hrs(totM)}</b><span>of creation time</span></div>
      <div class="cSplit">${Object.entries(byAcct).sort((a, b) => b[1] - a[1]).map(([o, n]) => `<span>${avatar(o, 'xs')}${esc(o)} <b>${n}</b></span>`).join('')}</div>
    </div>
    ${days.length ? days.map(({ d, name, list }) => {
      const a = list.filter(b => b.active !== false), first = a.length ? Math.min(...a.map(b => toMin(b.start_time))) : 0, last = a.length ? Math.max(...a.map(b => toMin(b.start_time) + mins(b))) : 0;
      return `<section class="card cDay ${d === tdow ? 'isToday' : ''}"><header><div><h2>${name}${d === tdow ? ' <span class="cToday">Today</span>' : ''}</h2>
        <p>${a.length ? `${label12(first)} – ${label12(last)} · ${a.reduce((n, b) => n + b.creatives, 0)} creatives · ${hrs(a.reduce((n, b) => n + mins(b), 0))}` : 'All paused'}</p></div>
        <button class="btn sm" data-addday="${d}">Add block</button></header>
        <table class="tbl cTbl"><thead><tr><th>Time</th><th>Account</th><th class="r">Creatives</th><th class="r">Min each</th><th class="r">Total</th><th></th></tr></thead><tbody>
        ${list.map(b => { const s = toMin(b.start_time); return `<tr class="${b.active === false ? 'off' : ''}" data-id="${b.id}">
          <td class="cTime"><b>${label12(s)}</b> – ${label12(s + mins(b))}</td>
          <td><span class="cAcct">${avatar(b.owner_name, 'xs')}<b>${esc(b.owner_name)}</b></span>${b.notes ? `<div class="s muted">${esc(b.notes)}</div>` : ''}</td>
          <td class="r"><span class="cStep"><button type="button" data-dec="${b.id}" aria-label="One less">−</button><b>${b.creatives}</b><button type="button" data-inc="${b.id}" aria-label="One more">+</button></span></td>
          <td class="r">${b.minutes_per}</td><td class="r"><b>${mins(b)}</b> min</td>
          <td class="r"><button class="btn sm ghost" data-edit="${b.id}">Edit</button></td></tr>`; }).join('')}
        </tbody></table></section>`;
    }).join('') : '<div class="card"><div class="empty">No creation blocks yet. Add one.</div></div>'}`;

  $('#cAdd').onclick = () => edit(null);
  $$('[data-addday]', root).forEach(b => b.onclick = () => edit(null, +b.dataset.addday));
  $$('[data-edit]', root).forEach(b => b.onclick = () => edit(blocks.find(x => x.id === b.dataset.edit)));
  $$('.cTbl tbody tr', root).forEach(tr => tr.onclick = e => { if (!e.target.closest('button')) edit(blocks.find(x => x.id === tr.dataset.id)); });
  $$('[data-inc],[data-dec]', root).forEach(btn => btn.onclick = async () => {
    const id = btn.dataset.inc || btn.dataset.dec, b = blocks.find(x => x.id === id), n = b.creatives + (btn.dataset.inc ? 1 : -1);
    if (n < 1) return;
    b.creatives = n; draw(toggleHtml);
    fail(await sb.from('daily_ops_creation_blocks').update({ creatives: n, updated_at: new Date().toISOString() }).eq('id', id), 'Save');
    syncToday();
  });
}

const syncToday = () => sb.rpc('sync_daily_ops_today').then(() => {}, () => {});

function edit(b, day) {
  const isNew = !b; b = b || { day_of_week: day ?? 6, start_time: '10:00', owner_name: owners[0] || '', creatives: 1, minutes_per: 30, maker: 'Anaz', active: true };
  const { el } = modal({
    title: isNew ? 'Add creation block' : `${b.owner_name} · creation block`, submit: isNew ? 'Add' : 'Save',
    body: `<div class="form pForm">
      <label class="field">Day<select class="select" name="day">${opts(DAYS.map(([d, n]) => [d, n]), b.day_of_week)}</select></label>
      <label class="field">Start<input class="input" type="time" name="start" step="900" value="${esc(String(b.start_time).slice(0, 5))}" required></label>
      <label class="field">Account<select class="select" name="owner">${opts([...new Set([...owners, b.owner_name].filter(Boolean))], b.owner_name)}</select></label>
      <label class="field">Made by<input class="input" name="maker" value="${esc(b.maker || '')}"></label>
      <label class="field">Creatives<input class="input" type="number" min="1" max="50" name="creatives" value="${b.creatives}" required></label>
      <label class="field">Minutes per creative<input class="input" type="number" min="5" max="240" step="5" name="per" value="${b.minutes_per}" required></label>
      <p class="s muted" style="grid-column:1/-1;margin:0" id="cEnd"></p>
      <label class="field" style="grid-column:1/-1">Notes<input class="input" name="notes" value="${esc(b.notes || '')}" placeholder="e.g. 2 lead magnets + 2 credibility"></label>
      ${isNew ? '' : `<label class="row s" style="grid-column:1/-1"><input type="checkbox" name="paused" ${b.active === false ? 'checked' : ''}> Paused (keep it, but don't put it on Today)</label>
      <button type="button" class="btn sm danger" id="cDel" style="justify-self:start">Delete block</button>`}</div>`,
    async onSubmit(fd) {
      const row = { day_of_week: +fd.get('day'), start_time: fd.get('start'), owner_name: fd.get('owner'), maker: String(fd.get('maker') || '').trim() || null, creatives: +fd.get('creatives'), minutes_per: +fd.get('per'), notes: String(fd.get('notes') || '').trim() || null, active: fd.get('paused') !== 'on', updated_at: new Date().toISOString() };
      const r = isNew ? await sb.from('daily_ops_creation_blocks').insert(row) : await sb.from('daily_ops_creation_blocks').update(row).eq('id', b.id);
      if (fail(r, 'Save')) return false;
      toast(isNew ? 'Block added' : 'Saved'); await load(); syncToday();
    },
  });
  const upd = () => { const s = toMin($('[name=start]', el).value), m = (+$('[name=creatives]', el).value || 0) * (+$('[name=per]', el).value || 0); $('#cEnd', el).textContent = m ? `Runs ${label12(s)} – ${label12(s + m)} (${m} min)` : ''; };
  $$('[name=start],[name=creatives],[name=per]', el).forEach(i => i.oninput = upd); upd();
  $('#cDel', el)?.addEventListener('click', async () => {
    if (fail(await sb.from('daily_ops_creation_blocks').delete().eq('id', b.id), 'Delete')) return;
    toast('Deleted'); $('[data-x]', el).click(); await load(); syncToday();
  });
}
