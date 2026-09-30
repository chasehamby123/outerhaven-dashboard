// Pipeline: every live opportunity and relationship on one screen, who holds the ball, and what has gone quiet.
// Reads opportunities / people / tasks / lead_intake (the same tables the old board uses), so both stay in step.
import { sb, state, esc, $, $$, toast, fail, modal, opts, avatar, firstName, fmtDate, num } from './core.js';

const BUY = ['New Relationship', 'Diligence Call Complete', 'NDA Signed + Thesis Captured', 'Relevant Deal Identified', 'Interest Meeting Held', 'Buyer Interest Confirmed', 'Engagement Active', 'Closed'];
const SELL = ['New Relationship', 'Diligence Call Complete', 'NDA Signed + Buy-Side Thesis Shared', 'Opportunity Received', 'Initial Interest Identified', 'Buy-Side Interest Confirmed', 'Engagement Active', 'Closed'];
// 'Both' = banks / advisers who are also capital (an IB with family offices). They are tracked as relationships on their own
// board; any actual deal under them is a Sell or Buy side deal with the full stage list.
const BOTH = ['New Relationship', 'Diligence Call Complete', 'NDA Signed + Thesis Captured', 'Engagement Active', 'Closed'];
const stagesFor = side => side === 'Buy Side' ? BUY : side === 'Both' ? BOTH : SELL;
const SIDES = ['Sell Side', 'Buy Side', 'Both'];
const relType = sd => sd === 'Buy Side' ? 'Buy-side Relationship' : sd === 'Both' ? 'Sell + Buy-side Relationship' : 'Sell-side Relationship';
const sideShort = sd => sd === 'Buy Side' ? 'Buy' : sd === 'Both' ? 'Both' : 'Sell';
const SEV = { bad: 3, warn: 2, info: 1 };
const DAY = 864e5;

let root, D = null, loadedAt = 0, side = 'Sell Side', flt = null, showAllLeads = false, tab = 'need';

const todayIso = () => new Date().toISOString().slice(0, 10);
const daysSince = ts => ts ? Math.max(0, Math.floor((Date.now() - Date.parse(ts)) / DAY)) : null;
const money = n => !n ? '' : n >= 1e9 ? '$' + +(n / 1e9).toFixed(1) + 'B' : n >= 1e6 ? '$' + +(n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? '$' + Math.round(n / 1e3) + 'K' : '$' + n;
const slug = u => String(u || '').replace(/[?#].*$/, '').replace(/\/+$/, '').split('/').pop().toLowerCase();

// ---- Data ----
async function fetchCore() {
  const [o, p, t] = await Promise.all([
    sb.from('opportunities').select('*'),
    sb.from('people').select('*'),
    sb.from('tasks').select('*').eq('completed', false),
  ]);
  if (o.error || p.error || t.error) { console.error(o.error || p.error || t.error); return null; }
  return { opps: o.data || [], people: p.data || [], tasks: t.data || [] };
}
async function fetchAll() {
  const [core, l, a] = await Promise.all([
    fetchCore(),
    sb.from('lead_intake').select('id,name,headline,company_name,reply_text,decision,confidence,reason,sell_side_kind,suggested_next_step,source_account,campaign_name,linkedin_url,created_at,person_id,reviewed_at').is('person_id', null).is('reviewed_at', null).order('created_at', { ascending: false }).limit(300),
    sb.from('daily_ops_accounts').select('owner_name,linkedin_url'),
  ]);
  if (!core) return null;
  return { ...core, leads: (l.data || []).filter(x => x.decision !== 'not_qualified'), accts: a.data || [] };
}

// ---- The model: one "item" per live deal, plus one per live relationship that has no deal yet ----
function buildItems({ opps, people, tasks }) {
  const today = todayIso();
  const liveOpps = opps.filter(o => o.pipeline_active !== false);
  const oppsByPerson = {}; liveOpps.forEach(o => { if (o.person_id) (oppsByPerson[o.person_id] ||= []).push(o); });
  const pById = Object.fromEntries(people.map(p => [p.id, p]));
  const tasksFor = (oppId, personId, single) => tasks.filter(t => (oppId && t.opportunity_id === oppId) || (!t.opportunity_id && personId && t.person_id === personId && (single || !oppId)));
  const items = [];
  for (const o of liveOpps) {
    const p = pById[o.person_id];
    const single = p && (oppsByPerson[p.id] || []).length === 1;
    items.push(mk({ kind: 'deal', id: o.id, name: o.title, sub: p?.name || '', side: o.side === 'Both' ? 'Sell Side' : o.side, stage: o.pipeline_stage || o.stage, ball: o.waiting_on, since: o.waiting_on_since || o.updated_at, updated: o.updated_at, next: o.next_step, owner: o.next_step_owner || o.owner_name, due: o.due_date, size: o.opportunity_size, raise: num(o.revenue_raise_amount), tasks: tasksFor(o.id, p?.id, single), row: o, person: p }, today));
  }
  for (const p of people) {
    if (p.pipeline_active === false || (oppsByPerson[p.id] || []).length) continue;
    items.push(mk({ kind: 'rel', id: p.id, name: p.name, sub: [p.company_name || p.relationship_type].filter(Boolean).join(' · '), side: p.primary_side === 'Buy Side' ? 'Buy Side' : p.primary_side === 'Both' ? 'Both' : 'Sell Side', stage: p.pipeline_stage, ball: p.waiting_on, since: p.waiting_on_since || p.updated_at, updated: p.updated_at, next: null, tasks: tasksFor(null, p.id, false), row: p, person: p, raise: 0 }, today));
  }
  return items;
}
function mk(i, today) {
  const t0 = i.tasks.slice().sort((a, b) => String(a.due_date || '9').localeCompare(String(b.due_date || '9')))[0];
  i.nextText = i.next || t0?.action || '';
  i.due = i.due || t0?.due_date || null;
  i.owner = i.owner || t0?.owner_name || '';
  i.days = daysSince(i.since) ?? 0;
  i.closed = i.stage === 'Closed';
  i.ball = i.ball === 'us' || i.ball === 'them' ? i.ball : null;
  const f = [], add = (code, sev, text) => f.push({ code, sev, text });
  if (!i.closed) {
    if (i.ball === 'us') add('us', i.days >= 7 ? 'bad' : i.days >= 3 ? 'warn' : 'info', `Our move · ${i.days}d`);
    else if (i.ball === 'them') add('them', i.days >= 14 ? 'bad' : i.days >= 7 ? 'warn' : 'info', i.days >= 7 ? `Chase · waiting ${i.days}d` : `Their move · ${i.days}d`);
    else add('noball', 'warn', 'Nobody owns the next move');
    if (!i.nextText) add('nonext', 'warn', 'No next step');
    const od = i.tasks.filter(t => t.due_date && t.due_date < today);
    if (od.length) add('overdue', 'bad', `${od.length} overdue task${od.length > 1 ? 's' : ''}`);
    const idle = daysSince(i.updated);
    if (idle >= 21) add('stale', 'warn', `No movement in ${idle}d`);
  }
  i.flags = f.sort((a, b) => SEV[b.sev] - SEV[a.sev]);
  i.sev = f.length ? Math.max(...f.map(x => SEV[x.sev])) : 0;
  i.has = code => f.some(x => x.code === code);
  return i;
}
const byHeat = (a, b) => b.sev - a.sev || b.days - a.days;

// Shared with the nav badge: how many things are red right now.
export async function refreshPipelineBadge() {
  const a = document.querySelector('.nav a[data-page="pipeline"]'); if (!a) return;
  const core = await fetchCore(); if (!core) return;
  const red = buildItems(core).filter(i => i.sev >= 3).length;
  let b = a.querySelector('.badge'); if (!b) { b = document.createElement('span'); a.appendChild(b); }
  b.className = 'badge' + (red ? ' hot' : ''); b.textContent = red || ''; b.title = red ? `${red} need action now` : '';
  if (!red) b.remove();
}

// ---- Render ----
export async function renderPipeline(r) {
  root = r;
  const fresh = D && Date.now() - loadedAt < 8000;
  if (!D) root.innerHTML = '<div class="empty">Loading pipeline…</div>';
  if (!fresh) {
    const d = await fetchAll();
    if (root.dataset.page !== 'pipeline') return;
    if (!d) { root.innerHTML = '<div class="empty">Could not load the pipeline. Try Refresh.</div>'; return; }
    D = d; loadedAt = Date.now();
  }
  draw();
}
const reload = async () => { D = await fetchAll() || D; loadedAt = Date.now(); if (root?.dataset.page === 'pipeline') draw(); refreshPipelineBadge(); };

function draw() {
  const all = buildItems(D), live = all.filter(i => !i.closed), today = todayIso();
  const liveDeals = live.filter(i => i.kind === 'deal');
  const k = {
    us: live.filter(i => i.ball === 'us'),
    them: live.filter(i => i.ball === 'them' && i.days >= 7),
    nonext: live.filter(i => i.has('nonext') || i.has('noball')),
    overdue: live.filter(i => i.has('overdue')),
  };
  const leads = D.leads.slice().sort((a, b) => (b.decision.startsWith('qualified') ? 1 : 0) - (a.decision.startsWith('qualified') ? 1 : 0));
  const qualified = leads.filter(l => l.decision.startsWith('qualified')).length;
  const raise = liveDeals.reduce((n, i) => n + i.raise, 0);
  const kpi = (f, label, n, sev) => `<button type="button" class="pChip pf ${flt === f ? 'on' : ''}" data-f="${f}" data-sev="${n ? sev : ''}"><b>${n}</b>${label}</button>`;

  let need = live.filter(i => i.sev >= 2);
  if (flt === 'us') need = k.us; else if (flt === 'them') need = k.them; else if (flt === 'nonext') need = k.nonext; else if (flt === 'overdue') need = k.overdue;
  need = need.slice().sort(byHeat);
  const parked = [...D.opps.filter(o => o.pipeline_active === false).map(o => ({ kind: 'deal', id: o.id, name: o.title, sub: o.side })), ...D.people.filter(p => p.pipeline_active === false && !D.opps.some(o => o.person_id === p.id && o.pipeline_active !== false)).map(p => ({ kind: 'rel', id: p.id, name: p.name, sub: p.primary_side || '' }))];

  const inFlt = new Set((flt && flt !== 'leads' ? need : []).map(i => i.kind + ':' + i.id));
  const tabs = [['need', flt && flt !== 'leads' ? { us: 'Our move', them: 'Chase them', nonext: 'No next step', overdue: 'Overdue' }[flt] : 'Needs you', need.length], ['leads', 'LinkedIn leads', leads.length], ...(parked.length ? [['parked', 'Parked', parked.length]] : [])];
  const panel = tab === 'leads'
    ? `<p class="pHint">${qualified} qualified${leads.length - qualified ? `, ${leads.length - qualified} still to review` : ''}. Add them before they go cold.</p>
      <div class="pList">${leads.length ? leads.slice(0, showAllLeads ? 300 : 8).map(leadHtml).join('') : '<div class="empty">Inbox is clear.</div>'}</div>
      ${leads.length > 8 ? `<footer class="pMore"><button class="btn sm" data-more>${showAllLeads ? 'Show fewer' : `Show all ${leads.length}`}</button></footer>` : ''}`
    : tab === 'parked'
      ? `<div class="pList">${parked.map(x => `<div class="pRow" data-sev="0"><span class="pDot"></span><div class="pMain"><div class="pTitle">${esc(x.name)}</div><div class="pSub">${esc(x.sub)}</div></div><div class="pAct"><button class="btn sm" data-react="${x.kind}:${x.id}">Reactivate</button></div></div>`).join('')}</div>`
      : `<p class="pHint">${flt && flt !== 'leads' ? 'Filtered. Matching cards are highlighted on the board.' : 'Waiting on us 3+ days, on them 7+ days, or missing a next step. Most urgent first.'}${flt ? ' <button class="link s" data-clear>Clear filter</button>' : ''}</p>
      <div class="pList">${need.length ? need.map(rowHtml).join('') : '<div class="empty">Nothing is stuck. Every live item has a next move and is on time.</div>'}</div>`;
  root.innerHTML = `<div class="pipe">
    <div class="pTop">
      <div class="pTitleRow"><h1>Pipeline</h1><span class="muted s">${liveDeals.length} deal${liveDeals.length === 1 ? '' : 's'} · ${live.length - liveDeals.length} relationships${raise ? ` · <b class="pRaise">${money(raise)}</b> in play` : ''}</span></div>
      <div class="row"><button class="btn sm" id="pRefresh">Refresh</button><button class="btn sm" id="pAddPerson">Add person</button><button class="btn sm primary" id="pAddDeal">Add deal</button></div>
    </div>
    <div class="pChips">
      ${kpi('us', 'our move', k.us.length, 'bad')}${kpi('them', 'to chase', k.them.length, 'warn')}${kpi('nonext', 'no next step', k.nonext.length, 'warn')}${kpi('overdue', 'overdue', k.overdue.length, 'bad')}${kpi('leads', 'leads waiting', qualified, 'warn')}
    </div>
    <section class="card pSec pBoardCard ${inFlt.size ? 'filtering' : ''}"><header><div class="pSeg" role="group">${SIDES.map(s => `<button type="button" data-side="${s}" class="${side === s ? 'on' : ''}">${s}<em>${live.filter(i => i.side === s).length}</em></button>`).join('')}</div>
      <p>${side === 'Both' ? 'Banks and advisers who are also capital. ' : ''}Click a card to update it.</p></header>
      <div class="pBoard">${boardHtml(live, inFlt)}</div></section>
    <section class="card pSec" id="pNeed"><header class="pTabs">${tabs.map(([k, l, n]) => `<button type="button" data-tab="${k}" class="${tab === k ? 'on' : ''}">${esc(l)}<em>${n}</em></button>`).join('')}</header>
      ${panel}</section>
  </div>`;
  bind(all);
}

const flagChip = f => `<span class="tag ${f.sev === 'bad' ? 'bad' : f.sev === 'warn' ? 'warn' : ''}">${esc(f.text)}</span>`;
function rowHtml(i) {
  const act = i.ball === 'us' ? `<button class="btn sm primary" data-q="followed" data-k="${i.kind}:${i.id}">Followed up</button>`
    : i.ball === 'them' ? `<button class="btn sm" data-q="replied" data-k="${i.kind}:${i.id}">They replied</button><button class="btn sm" data-q="chased" data-k="${i.kind}:${i.id}">Chased again</button>`
      : `<button class="btn sm" data-q="us" data-k="${i.kind}:${i.id}">Our move</button><button class="btn sm" data-q="them" data-k="${i.kind}:${i.id}">Their move</button>`;
  return `<div class="pRow" data-sev="${i.sev}"><span class="pDot"></span>
    <div class="pMain"><div class="pTitle">${esc(i.name)} <span class="tag">${esc(i.stage || 'No stage')}</span><span class="tag">${i.kind === 'deal' ? 'Deal' : 'Relationship'} · ${sideShort(i.side)}</span></div>
      ${i.sub ? `<div class="pSub">${esc(i.sub)}</div>` : ''}
      <div class="pFlags">${i.flags.filter(f => f.sev !== 'info').map(flagChip).join('')}</div>
      <div class="pNext">${i.nextText ? `<b>Next:</b> ${esc(i.nextText)}${i.due ? ` <span class="muted">· due ${fmtDate(i.due)}</span>` : ''}` : '<i>No next step set</i>'}${i.owner ? ` <span class="pOwn">${avatar(i.owner, 'xs')}${esc(firstName(i.owner))}</span>` : ''}</div></div>
    <div class="pAct">${act}<button class="btn sm ghost" data-upd="${i.kind}:${i.id}">Update</button></div></div>`;
}
function boardHtml(live, inFlt = new Set()) {
  const st = stagesFor(side).filter(x => x !== 'Closed'), items = live.filter(i => i.side === side);
  const cols = st.map((name, idx) => ({ name, items: items.filter(i => { const at = stagesFor(side).indexOf(i.stage); return (at < 0 ? 0 : at) === idx; }).sort(byHeat) }));
  const tpl = cols.map(c => c.items.length ? 'minmax(250px,1fr)' : 'minmax(120px,150px)').join(' ');
  return `<div class="pGrid" style="grid-template-columns:${tpl}">${cols.map((c, idx) => {
    const hot = c.items.filter(i => i.sev >= 3).length, total = c.items.reduce((n, i) => n + i.raise, 0);
    return `<div class="pCol ${c.items.length ? '' : 'none'}"><h3><span class="n">${idx + 1}</span>${esc(c.name)}</h3>
      <div class="pColSum"><b>${c.items.length}</b>${hot ? `<span class="tag bad">${hot} red</span>` : ''}${total ? `<span class="s muted">${money(total)}</span>` : ''}</div>
      ${c.items.map(i => cardHtml(i, inFlt.has(i.kind + ':' + i.id))).join('') || '<div class="pEmpty">Empty</div>'}</div>`;
  }).join('')}</div>`;
}
function cardHtml(i, hit) {
  const tone = i.ball === 'us' ? (i.days >= 7 ? 'bad' : i.days >= 3 ? 'warn' : '') : i.ball === 'them' ? (i.days >= 14 ? 'bad' : i.days >= 7 ? 'warn' : '') : 'warn';
  const worst = i.flags.find(f => f.sev !== 'info' && f.code !== 'us' && f.code !== 'them');
  return `<button type="button" class="pCard ${hit ? 'hit' : ''}" data-sev="${i.sev}" data-upd="${i.kind}:${i.id}">
    <span class="pCardTop"><b>${esc(i.name)}</b>${i.owner ? avatar(i.owner, 'xs') : ''}</span>
    ${i.sub ? `<span class="s muted">${esc(i.sub)}</span>` : ''}
    <span class="pCardNext ${i.nextText ? '' : 'none'}">${i.nextText ? esc(i.nextText) : 'No next step'}</span>
    <span class="pMeta"><span class="tag ${tone}">${i.ball === 'us' ? 'Our move' : i.ball === 'them' ? 'Their move' : 'Nobody'} · ${i.days}d</span>${worst && worst.code !== 'nonext' && worst.code !== 'noball' ? `<span class="tag ${worst.sev === 'bad' ? 'bad' : 'warn'}">${esc(worst.text)}</span>` : ''}${i.raise ? `<span class="s pSize">${money(i.raise)}</span>` : i.size ? `<span class="s pSize">${esc(i.size)}</span>` : ''}</span></button>`;
}
function leadHtml(l) {
  const q = l.decision.startsWith('qualified'), sd = l.decision === 'qualified_buy_side' ? 'Buy Side' : l.decision === 'qualified_sell_side' ? 'Sell Side' : '';
  const age = daysSince(l.created_at);
  return `<div class="pRow" data-sev="${q && age >= 3 ? 2 : 0}"><span class="pDot"></span>
    <div class="pMain"><div class="pTitle">${l.linkedin_url ? `<a href="${esc(l.linkedin_url)}" target="_blank" rel="noopener">${esc(l.name || 'Unknown')} ↗</a>` : esc(l.name || 'Unknown')} ${q ? `<span class="tag good">${sd} · qualified</span>` : '<span class="tag">Needs review</span>'}<span class="tag ${age >= 7 ? 'bad' : age >= 3 ? 'warn' : ''}">${age}d in inbox</span></div>
      <div class="pSub">${esc([l.headline, l.company_name].filter(Boolean).join(' · '))}</div>
      ${l.reply_text ? `<div class="pNext"><b>Said:</b> “${esc(String(l.reply_text).slice(0, 160))}${l.reply_text.length > 160 ? '…' : ''}”</div>` : ''}
      ${l.suggested_next_step ? `<div class="pNext muted">Suggested: ${esc(l.suggested_next_step)}</div>` : ''}</div>
    <div class="pAct"><button class="btn sm ${sd === 'Sell Side' ? 'primary' : ''}" data-lead="sell:${l.id}">Add as sell side</button><button class="btn sm ${sd === 'Buy Side' ? 'primary' : ''}" data-lead="buy:${l.id}">Add as buy side</button><button class="btn sm" data-lead="both:${l.id}">Both</button><button class="btn sm ghost" data-lead="no:${l.id}">Not a fit</button></div></div>`;
}

function bind(all) {
  const find = key => { const [kind, id] = key.split(':'); return all.find(i => i.kind === kind && i.id === id); };
  $('#pRefresh').onclick = async () => { await reload(); toast('Refreshed'); };
  $('#pAddPerson').onclick = addPersonModal; $('#pAddDeal').onclick = addDealModal;
  $$('.pf', root).forEach(b => b.onclick = () => {
    if (b.dataset.f === 'leads') { tab = 'leads'; flt = null; draw(); $('#pNeed').scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
    flt = flt === b.dataset.f ? null : b.dataset.f; tab = 'need'; draw();
  });
  $$('[data-tab]', root).forEach(b => b.onclick = () => { tab = b.dataset.tab; draw(); });
  $('[data-clear]', root)?.addEventListener('click', () => { flt = null; draw(); });
  $$('[data-side]', root).forEach(b => b.onclick = () => { side = b.dataset.side; draw(); });
  $('[data-more]', root)?.addEventListener('click', () => { showAllLeads = !showAllLeads; draw(); });
  $$('[data-upd]', root).forEach(b => b.onclick = () => { const i = find(b.dataset.upd); if (i) updateModal(i); });
  $$('[data-q]', root).forEach(b => b.onclick = async () => {
    const i = find(b.dataset.k); if (!i) return; b.disabled = true;
    const q = b.dataset.q, now = new Date().toISOString();
    const ball = q === 'followed' || q === 'them' || q === 'chased' ? 'them' : 'us';
    if (await patchBall(i, ball, now)) { toast({ followed: 'Logged. Ball is with them.', chased: 'Chase logged. Clock restarted.', replied: 'Ball is with us now.', us: 'Marked our move.', them: 'Marked their move.' }[q]); await reload(); } else b.disabled = false;
  });
  $$('[data-react]', root).forEach(b => b.onclick = async () => {
    const [kind, id] = b.dataset.react.split(':');
    const r = await sb.from(kind === 'deal' ? 'opportunities' : 'people').update({ pipeline_active: true, updated_at: new Date().toISOString() }).eq('id', id);
    if (!fail(r, 'Reactivate')) { toast('Back on the board'); await reload(); }
  });
  $$('[data-lead]', root).forEach(b => b.onclick = async () => {
    const [act, id] = b.dataset.lead.split(':'), l = D.leads.find(x => x.id === id); if (!l) return; b.disabled = true;
    const ok = act === 'no' ? await rejectLead(l) : await promoteLead(l, act === 'buy' ? 'Buy Side' : act === 'both' ? 'Both' : 'Sell Side');
    if (ok) await reload(); else b.disabled = false;
  });
}

// ---- Writes ----
const nowIso = () => new Date().toISOString();
async function patchBall(i, ball, now = nowIso()) {
  const f = { waiting_on: ball, waiting_on_since: now, updated_at: now };
  if (i.kind === 'deal') {
    if (fail(await sb.from('opportunities').update(f).eq('id', i.id), 'Update')) return false;
    if (i.person && i.row.person_id) await sb.from('people').update(f).eq('id', i.row.person_id); // keep the old board's person row in step
    await logActivity(i.id, ball === 'them' ? 'Followed up, waiting on them' : 'Reply received, our move');
  } else if (fail(await sb.from('people').update(f).eq('id', i.id), 'Update')) return false;
  return true;
}
async function logActivity(oppId, action) { await sb.from('activity').insert({ opportunity_id: oppId, action, actor_id: state.user?.id || null }); }

function ownerFor(l) {
  const s = slug(l.source_account), a = D.accts.find(x => s && slug(x.linkedin_url) === s);
  return a?.owner_name || firstName((state.user?.email || '').split('@')[0].replace(/[._-]+/g, ' ')).replace(/^./, c => c.toUpperCase()) || null;
}
async function promoteLead(l, sd) {
  const now = nowIso(), key = slug(l.linkedin_url), lname = String(l.name || '').trim().toLowerCase();
  let p = D.people.find(x => (key && slug(x.linkedin_url) === key) || (lname && x.name.trim().toLowerCase() === lname));
  if (!p) {
    const r = await sb.from('people').insert({
      name: l.name || 'Unknown', relationship_type: relType(sd), primary_side: sd, pipeline_stage: 'New Relationship', pipeline_active: true,
      waiting_on: 'us', waiting_on_since: l.created_at, linkedin_url: l.linkedin_url, has_linkedin: !!l.linkedin_url, company_name: l.company_name, headline: l.headline, sell_side_kind: l.sell_side_kind || 'multi_deal', source: 'LinkedIn',
      source_campaign: l.campaign_name, source_account: l.source_account, qualification_confidence: l.confidence, qualification_reason: l.reason, last_inbound_message: l.reply_text, created_by: state.user?.id,
    }).select().single();
    if (fail(r, 'Add lead')) return false; p = r.data;
  } else if (p.pipeline_active === false) await sb.from('people').update({ pipeline_active: true, waiting_on: 'us', waiting_on_since: l.created_at, updated_at: now }).eq('id', p.id);
  const t = await sb.from('tasks').insert({ person_id: p.id, action: l.suggested_next_step || 'Reply and qualify', owner_name: ownerFor(l), due_date: todayIso(), created_by: state.user?.id });
  if (fail(t, 'Add task')) return false;
  const u = { person_id: p.id, reviewed_at: now, reviewed_by: state.user?.id };
  if (l.decision === 'needs_review' && sd !== 'Both') u.decision = sd === 'Buy Side' ? 'qualified_buy_side' : 'qualified_sell_side';
  if (fail(await sb.from('lead_intake').update(u).eq('id', l.id), 'Update lead')) return false;
  toast(`${l.name || 'Lead'} added${sd === 'Both' ? ' as sell + buy side' : ` to the ${sd.toLowerCase()} pipeline`}`); return true;
}
async function rejectLead(l) {
  if (fail(await sb.from('lead_intake').update({ decision: 'not_qualified', reviewed_at: nowIso(), reviewed_by: state.user?.id }).eq('id', l.id), 'Update lead')) return false;
  toast('Marked not a fit'); return true;
}

// ---- Modals ----
function updateModal(i) {
  const st = stagesFor(i.side), open = i.tasks;
  const who = state.user?.email ? firstName(state.user.email.split('@')[0]) : '';
  modal({
    title: i.name, submit: 'Save', wide: false,
    body: `<div class="form pForm">
      <p class="muted s" style="grid-column:1/-1;margin:0">${esc(i.sub || '')} ${i.kind === 'deal' ? '· Deal' : '· Relationship'} · ${i.side}</p>
      ${i.kind === 'rel' ? `<label class="field">Side<select class="select" name="side">${opts([['Sell Side', 'Sell side'], ['Buy Side', 'Buy side'], ['Both', 'Both']], i.side)}</select></label>` : ''}
      <label class="field">Stage<select class="select" name="stage">${opts(st, st.includes(i.stage) ? i.stage : st[0])}</select></label>
      <label class="field">Who is next<select class="select" name="ball">${opts([['us', 'Us (we owe a move)'], ['them', 'Them (we are waiting)'], ['', 'Nobody yet']], i.ball || '')}</select></label>
      ${open.length ? `<div class="field" style="grid-column:1/-1">Open tasks, tick what is done<div class="pTasks">${open.map(t => `<label><input type="checkbox" name="done" value="${t.id}"> <span>${esc(t.action)}</span><em class="muted s">${t.owner_name ? esc(firstName(t.owner_name)) : ''}${t.due_date ? ' · ' + fmtDate(t.due_date) : ''}${t.due_date && t.due_date < todayIso() ? ' · overdue' : ''}</em></label>`).join('')}</div></div>` : ''}
      <label class="field" style="grid-column:1/-1">Add the next step<input class="input" name="next" placeholder="${open.length ? 'Another step (optional)' : 'What is the next move?'}"></label>
      <label class="field">Owner<input class="input" name="owner" value="${esc(i.owner || who)}"></label>
      <label class="field">Due<input class="input" type="date" name="due"></label>
      <label class="row s" style="grid-column:1/-1"><input type="checkbox" name="park"> Take this off the board (park it)</label></div>`,
    async onSubmit(fd) {
      const now = nowIso(), ball = fd.get('ball') || null, stage = fd.get('stage'), next = String(fd.get('next') || '').trim();
      const done = fd.getAll('done'), park = fd.get('park') === 'on';
      const base = { updated_at: now }, ballChanged = (ball || null) !== (i.ball || null);
      if (ballChanged) { base.waiting_on = ball; base.waiting_on_since = now; }
      if (park) base.pipeline_active = false;
      for (const id of done) if (fail(await sb.from('tasks').update({ completed: true, updated_at: now }).eq('id', id), 'Complete task')) return false;
      if (next) {
        const t = await sb.from('tasks').insert({ person_id: i.person?.id || null, opportunity_id: i.kind === 'deal' ? i.id : null, action: next, owner_name: String(fd.get('owner') || '').trim() || null, due_date: fd.get('due') || null, created_by: state.user?.id });
        if (fail(t, 'Add next step')) return false;
      }
      if (i.kind === 'deal') {
        const f = { ...base, pipeline_stage: stage, stage };
        if (next) { f.next_step = next; f.next_step_owner = String(fd.get('owner') || '').trim() || null; f.due_date = fd.get('due') || null; }
        if (fail(await sb.from('opportunities').update(f).eq('id', i.id), 'Save')) return false;
        if (i.row.person_id && ballChanged) await sb.from('people').update({ waiting_on: ball, waiting_on_since: now, updated_at: now }).eq('id', i.row.person_id);
        if (stage !== i.stage) await logActivity(i.id, `Stage: ${i.stage || '—'} → ${stage}`);
        else if (ballChanged) await logActivity(i.id, ball === 'them' ? 'Waiting on them' : ball === 'us' ? 'Our move' : 'Ball cleared');
      } else if (fail(await sb.from('people').update({ ...base, pipeline_stage: stage, primary_side: fd.get('side') || i.side, relationship_type: fd.get('side') && fd.get('side') !== i.side ? relType(fd.get('side')) : i.row.relationship_type }).eq('id', i.id), 'Save')) return false;
      toast('Saved'); D = null; loadedAt = 0; refreshPipelineBadge();
    },
  });
  const f = $('.modal'), sd = $('[name=side]', f), stg = $('[name=stage]', f);
  if (sd) sd.onchange = () => { const l = stagesFor(sd.value); stg.innerHTML = opts(l, l.includes(stg.value) ? stg.value : l[0]); };
}

function addPersonModal() {
  modal({
    title: 'Add person', submit: 'Add to pipeline',
    body: `<div class="form pForm"><label class="field">Name<input class="input" name="name" required></label>
      <label class="field">Side<select class="select" name="side">${opts([['Sell Side', 'Sell side'], ['Buy Side', 'Buy side'], ['Both', 'Both (e.g. an IB with family offices)']])}</select></label>
      <label class="field">Company or type<input class="input" name="co" placeholder="Family office, developer…"></label>
      <label class="field">LinkedIn URL<input class="input" name="li"></label>
      <label class="field" style="grid-column:1/-1">Next step<input class="input" name="next" placeholder="Reply and qualify"></label>
      <label class="field">Owner<input class="input" name="owner" value="${esc(firstName((state.user?.email || '').split('@')[0]))}"></label>
      <label class="field">Who is next<select class="select" name="ball">${opts([['us', 'Us'], ['them', 'Them']])}</select></label></div>`,
    async onSubmit(fd) {
      const now = nowIso(), sd = fd.get('side');
      const r = await sb.from('people').insert({ name: String(fd.get('name')).trim(), primary_side: sd, relationship_type: relType(sd), company_name: fd.get('co') || null, linkedin_url: fd.get('li') || null, has_linkedin: !!fd.get('li'), pipeline_stage: 'New Relationship', pipeline_active: true, waiting_on: fd.get('ball'), waiting_on_since: now, created_by: state.user?.id }).select().single();
      if (fail(r, 'Add person')) return false;
      if (fd.get('next')) await sb.from('tasks').insert({ person_id: r.data.id, action: String(fd.get('next')).trim(), owner_name: String(fd.get('owner') || '').trim() || null, due_date: todayIso(), created_by: state.user?.id });
      toast('Added'); D = null; loadedAt = 0; refreshPipelineBadge();
    },
  });
}
function addDealModal() {
  const people = D.people.filter(p => p.pipeline_active !== false).sort((a, b) => a.name.localeCompare(b.name));
  modal({
    title: 'Add deal', submit: 'Add to pipeline',
    body: `<div class="form pForm"><label class="field" style="grid-column:1/-1">Deal name<input class="input" name="title" required></label>
      <label class="field">Side<select class="select" name="side">${opts(['Sell Side', 'Buy Side'])}</select></label>
      <label class="field">Stage<select class="select" name="stage">${opts(SELL, 'Opportunity Received')}</select></label>
      <label class="field">Contact<select class="select" name="person">${opts([['', '— none —'], ...people.map(p => [p.id, p.name])])}</select></label>
      <label class="field">Raise / deal size (USD)<input class="input" name="raise" inputmode="decimal" placeholder="25,000,000"></label>
      <label class="field">Owner<input class="input" name="owner" value="${esc(firstName((state.user?.email || '').split('@')[0]))}"></label>
      <label class="field">Who is next<select class="select" name="ball">${opts([['us', 'Us'], ['them', 'Them']])}</select></label>
      <label class="field" style="grid-column:1/-1">Next step<input class="input" name="next"></label>
      <label class="field">Due<input class="input" type="date" name="due"></label></div>`,
    async onSubmit(fd, form) {
      const now = nowIso(), stage = fd.get('stage'), raise = num(fd.get('raise'));
      const r = await sb.from('opportunities').insert({ title: String(fd.get('title')).trim(), side: fd.get('side'), stage, pipeline_stage: stage, pipeline_active: true, person_id: fd.get('person') || null, owner_name: String(fd.get('owner') || '').trim() || null, waiting_on: fd.get('ball'), waiting_on_since: now, next_step: fd.get('next') || null, next_step_owner: String(fd.get('owner') || '').trim() || null, due_date: fd.get('due') || null, revenue_raise_amount: raise || null, opportunity_size: raise ? money(raise) : null, created_by: state.user?.id }).select().single();
      if (fail(r, 'Add deal')) return false;
      if (fd.get('next')) await sb.from('tasks').insert({ person_id: fd.get('person') || null, opportunity_id: r.data.id, action: String(fd.get('next')).trim(), owner_name: String(fd.get('owner') || '').trim() || null, due_date: fd.get('due') || null, created_by: state.user?.id });
      await logActivity(r.data.id, 'Created in HQ');
      toast('Added'); D = null; loadedAt = 0; refreshPipelineBadge();
    },
  });
  // Stage list follows the side.
  const f = $('.modal'), sd = $('[name=side]', f), stg = $('[name=stage]', f);
  sd.onchange = () => { const l = stagesFor(sd.value); stg.innerHTML = opts(l, sd.value === 'Buy Side' ? 'Relevant Deal Identified' : 'Opportunity Received'); };
}
