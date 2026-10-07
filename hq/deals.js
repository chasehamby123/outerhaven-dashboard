// Pipeline → Deals: deals PROVIDED to OuterHaven (mandates, teasers, CIMs from sponsors, banks and introducers), for Peter
// to review. Not outbound targets: those are Fund signals / Credit signals. Table `deals` (supabase/2026-10-07-deals.sql).
import { sb, esc, $, $$, toast, fail, modal, opts } from './core.js';
import { me } from './tasks.js';

let el = null, rows = [], view = 'review', onCount = () => {};
const TYPES = ['Equity raise', 'Debt / private credit', 'M&A sell-side', 'Real estate', 'Fund raise', 'Other'];
const STATUSES = ['To review', 'Need info', 'Interested', 'Shopping to buyers', 'Passed', 'Closed'];
const NDA = ['None', 'Requested', 'Signed'];
const VIEWS = [['review', 'To review', s => ['To review', 'Need info'].includes(s)], ['live', 'Interested', s => ['Interested', 'Shopping to buyers'].includes(s)],
  ['passed', 'Passed', s => s === 'Passed'], ['closed', 'Closed', s => s === 'Closed'], ['all', 'All', () => true]];
const money = n => n == null ? '' : n >= 1e9 ? '$' + +(n / 1e9).toFixed(2) + 'B' : n >= 1e6 ? '$' + +(n / 1e6).toFixed(1) + 'M' : '$' + Math.round(n / 1e3) + 'K';
const day = v => v ? new Date(String(v).slice(0, 10) + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
const ago = v => { const d = Math.floor((Date.now() - Date.parse(String(v).slice(0, 10) + 'T12:00:00')) / 864e5); return d <= 0 ? 'today' : d === 1 ? '1 day ago' : `${d} days ago`; };
// "$150M raise" → 150e6; "1.2B" → 1.2e9. Only USD (or no currency): "SGD 10m" stays text.
export function parseAsk(t) {
  const s = String(t || '').trim(); if (!s || /\b(sgd|eur|gbp|aud|myr|hkd|inr|aed|€|£)\b/i.test(s)) return null;
  const m = s.replace(/,/g, '').match(/([0-9]+(?:\.[0-9]+)?)\s*(bn|b|billion|mm|m|million|k|thousand)?/i); if (!m) return null;
  const u = (m[2] || '').toLowerCase(), n = +m[1];
  return u.startsWith('b') ? n * 1e9 : ['m', 'mm', 'million'].includes(u) ? n * 1e6 : u.startsWith('k') || u === 'thousand' ? n * 1e3 : n >= 1e5 ? n : null;
}
const docsText = d => (d || []).map(x => x.label && x.label !== x.url ? `${x.label} | ${x.url}` : x.url).join('\n');
const parseDocs = t => String(t || '').split('\n').map(l => l.trim()).filter(Boolean).map(l => {
  const [a, b] = l.includes('|') ? l.split('|').map(x => x.trim()) : [l, l];
  const url = /^https?:\/\//i.test(b) ? b : /^https?:\/\//i.test(a) ? a : null;
  return url ? { label: a === url ? '' : a, url } : null;
}).filter(Boolean);

export const dealsToReviewCount = () => rows.filter(r => ['To review', 'Need info'].includes(r.status)).length;
// Fills the tab badge without opening the tab.
export async function prefetchDeals(cb) {
  const r = await sb.from('deals').select('*').order('received_at', { ascending: false }).order('created_at', { ascending: false });
  if (!r.error) { rows = r.data || []; cb?.(dealsToReviewCount()); }
}

export async function renderDeals(target, countCb) {
  el = target; onCount = countCb || onCount;
  el.innerHTML = '<div class="empty">Loading deals…</div>';
  const r = await sb.from('deals').select('*').order('received_at', { ascending: false }).order('created_at', { ascending: false });
  if (r.error) { el.innerHTML = `<div class="empty">Could not load deals: ${esc(r.error.message)}</div>`; return; }
  rows = r.data || [];
  draw();
}

function draw() {
  onCount(dealsToReviewCount());
  const counts = Object.fromEntries(VIEWS.map(([k, , f]) => [k, rows.filter(d => f(d.status)).length]));
  const f = VIEWS.find(v => v[0] === view)[2];
  const shown = rows.filter(d => f(d.status));
  el.innerHTML = `<div class="fs dl">
    <div class="fsTop"><h3 class="dlTitle">Deals provided to us</h3><div class="row fsBtns"><button class="btn sm primary" id="dlAdd">Add a deal</button></div></div>
    <p class="pHint">Mandates, teasers and CIMs that sponsors, banks and introducers sent us. Peter reviews each one: Fit, Maybe or Pass, with notes. Outbound targets live in Fund signals and Credit signals.</p>
    <div class="fsViews">${VIEWS.map(([k, l]) => `<button type="button" data-view="${k}" class="${view === k ? 'on' : ''}" data-tone="${k === 'review' ? 'warn' : k === 'live' ? 'good' : ''}">${l} <b>${counts[k]}</b></button>`).join('')}</div>
    <div class="fsList">${shown.length ? shown.map(rowHtml).join('') : `<div class="empty">${view === 'review' ? 'Nothing waiting for Peter.' : 'Nothing here.'} <button class="btn sm" data-add>Add a deal</button></div>`}</div>
  </div>`;
  bind();
}

function rowHtml(d) {
  const facts = [
    d.deal_type ? `<b>${esc(d.deal_type)}</b>` : '',
    d.ask_text || d.ask_amount ? `Ask <b>${esc(d.ask_text || money(d.ask_amount))}</b>` : '',
    d.valuation_text ? `Valuation <b>${esc(d.valuation_text)}</b>` : '',
    d.sector ? esc(d.sector) : '', d.geography ? esc(d.geography) : '',
  ].filter(Boolean);
  const meta = [
    d.source_name ? `From <b>${esc(d.source_name)}</b>` : 'Source not logged',
    d.received_at ? `received ${day(d.received_at)} (${ago(d.received_at)})` : '',
    `NDA: ${esc(d.nda_status || 'None')}`, d.owner_name ? `owner ${esc(d.owner_name)}` : '', d.opportunity_id ? 'linked to Pipeline' : '',
  ].filter(Boolean);
  const tone = d.peter_verdict === 'Fit' ? 'good' : d.peter_verdict === 'Pass' ? 'bad' : d.peter_verdict === 'Maybe' ? 'warn' : '';
  const size = d.ask_amount ? money(d.ask_amount) : (String(d.ask_text || '').match(/[A-Z]{3}\s?[0-9.,]+\s?(bn|b|m|k)?/i) || ['—'])[0];
  return `<article class="fsRow dlRow" data-tone="${tone}" data-id="${d.id}">
    <div class="fsScore"><b>${esc(size)}</b><span>ask</span></div>
    <div class="fsMain">
      <h4>${esc(d.codename)} <span class="pFlag ${['Interested', 'Shopping to buyers'].includes(d.status) ? 'good' : d.status === 'Passed' ? 'bad' : d.status === 'Need info' ? 'warn' : ''}">${esc(d.status)}</span></h4>
      ${facts.length ? `<div class="fsFacts">${facts.map(x => `<span>${x}</span>`).join('')}</div>` : ''}
      <div class="fsFacts muted dlMeta">${meta.map(x => `<span>${x}</span>`).join('')}</div>
      ${d.summary ? `<p class="dlSum">${esc(d.summary)}</p>` : ''}
      ${d.structure || d.fee_terms ? `<div class="fsFacts dlMeta">${d.structure ? `<span>Structure: ${esc(d.structure)}</span>` : ''}${d.fee_terms ? `<span>Our fee: ${esc(d.fee_terms)}</span>` : ''}</div>` : ''}
      ${(d.doc_links || []).length ? `<div class="fsPeople">${d.doc_links.map(x => `<a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.label || 'Document')} ↗</a>`).join('')}</div>` : ''}
      <div class="dlReview">
        <div class="dlVerdict" role="group" aria-label="Peter's verdict"><span>Peter</span>${['Fit', 'Maybe', 'Pass'].map(v => `<button type="button" data-verdict="${v}" class="${d.peter_verdict === v ? 'on' : ''}" data-tone="${v === 'Fit' ? 'good' : v === 'Pass' ? 'bad' : 'warn'}">${v}</button>`).join('')}
          ${d.peter_reviewed_at ? `<em>${day(d.peter_reviewed_at)}</em>` : ''}</div>
        <textarea class="textarea" data-notes rows="2" placeholder="Peter's notes: fit, who could fund it, what's missing…">${esc(d.peter_notes || '')}</textarea>
        <label class="dlNext">Next step <input class="input sm" data-next value="${esc(d.next_step || '')}" placeholder="e.g. ask for the model, intro to lender X"></label>
      </div>
    </div>
    <div class="fsAct">
      <select class="select sm" data-status aria-label="Status">${opts(STATUSES, d.status)}</select>
      <button class="btn sm" data-edit>Edit</button>
    </div>
  </article>`;
}

async function save(id, patch, quiet) {
  const { error } = await sb.from('deals').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) { fail(error); return false; }
  Object.assign(rows.find(r => r.id === id) || {}, patch);
  if (!quiet) toast('Saved');
  return true;
}

function bind() {
  $$('[data-view]', el).forEach(b => b.onclick = () => { view = b.dataset.view; draw(); });
  $('#dlAdd', el)?.addEventListener('click', () => edit(null));
  $$('[data-add]', el).forEach(b => b.onclick = () => edit(null));
  $$('.dlRow', el).forEach(card => {
    const id = card.dataset.id, d = rows.find(r => r.id === id);
    $$('[data-verdict]', card).forEach(b => b.onclick = async () => {
      const v = d.peter_verdict === b.dataset.verdict ? null : b.dataset.verdict;
      // A verdict moves the deal along unless someone already set a later status.
      const status = v === 'Fit' && ['To review', 'Need info'].includes(d.status) ? 'Interested'
        : v === 'Pass' ? 'Passed' : v === 'Maybe' && d.status === 'To review' ? 'Need info' : d.status;
      if (await save(id, { peter_verdict: v, peter_reviewed_at: v ? new Date().toISOString() : null, status }, true)) { toast(v ? `Marked ${v}` : 'Verdict cleared'); draw(); }
    });
    $('[data-notes]', card).onchange = e => save(id, { peter_notes: e.target.value.trim() || null, peter_reviewed_at: new Date().toISOString() });
    $('[data-next]', card).onchange = e => save(id, { next_step: e.target.value.trim() || null });
    $('[data-status]', card).onchange = async e => { if (await save(id, { status: e.target.value }, true)) { toast(`Status: ${e.target.value}`); draw(); } };
    $('[data-edit]', card).onclick = () => edit(d);
  });
}

function edit(d) {
  const v = d || {};
  modal({
    title: d ? `Edit ${d.codename}` : 'Add a deal', submit: d ? 'Save' : 'Add deal', wide: true,
    body: `<div class="form dlForm">
      <label class="field">Codename <input class="input" name="codename" required value="${esc(v.codename || '')}" placeholder="Anonymised name for NDA deals, e.g. Project Cement"></label>
      <label class="field">Type <select class="select" name="deal_type"><option value="">Choose…</option>${opts(TYPES, v.deal_type)}</select></label>
      <label class="field">Ask (as given) <input class="input" name="ask_text" value="${esc(v.ask_text || '')}" placeholder="$150M raise, SGD 10m for 20%…"></label>
      <label class="field">Valuation <input class="input" name="valuation_text" value="${esc(v.valuation_text || '')}" placeholder="e.g. $60M pre-money"></label>
      <label class="field">Sector <input class="input" name="sector" value="${esc(v.sector || '')}"></label>
      <label class="field">Geography <input class="input" name="geography" value="${esc(v.geography || '')}"></label>
      <label class="field">From (who gave it to us) <input class="input" name="source_name" value="${esc(v.source_name || '')}" placeholder="Introducer, sponsor or bank"></label>
      <label class="field">Received <input class="input" type="date" name="received_at" value="${esc(String(v.received_at || new Date().toISOString()).slice(0, 10))}"></label>
      <label class="field">NDA <select class="select" name="nda_status">${opts(NDA, v.nda_status || 'None')}</select></label>
      <label class="field">Owner <input class="input" name="owner_name" value="${esc(v.owner_name || me())}"></label>
      <label class="field full">Structure <input class="input" name="structure" value="${esc(v.structure || '')}" placeholder="e.g. senior secured, 3 years, 12%; or 20% equity"></label>
      <label class="field full">Our fee terms <input class="input" name="fee_terms" value="${esc(v.fee_terms || '')}" placeholder="e.g. 2% success fee, $10k/month retainer"></label>
      <label class="field full">Summary <textarea class="textarea" name="summary" rows="4" placeholder="What it is, the numbers that matter, why it's raising">${esc(v.summary || '')}</textarea></label>
      <label class="field full">Documents (one per line: Label | link) <textarea class="textarea" name="docs" rows="3" placeholder="Teaser | https://drive.google.com/…&#10;CIM | https://…">${esc(docsText(v.doc_links))}</textarea></label>
    </div>`,
    onSubmit: async fd => {
      const g = k => String(fd.get(k) || '').trim() || null;
      const row = { codename: g('codename'), deal_type: g('deal_type'), ask_text: g('ask_text'), ask_amount: parseAsk(g('ask_text')), valuation_text: g('valuation_text'),
        sector: g('sector'), geography: g('geography'), source_name: g('source_name'), received_at: g('received_at'), nda_status: g('nda_status') || 'None',
        owner_name: g('owner_name'), structure: g('structure'), fee_terms: g('fee_terms'), summary: g('summary'), doc_links: parseDocs(fd.get('docs')) };
      if (!row.codename) { toast('Give it a codename'); return false; }
      if (d) { if (!(await save(d.id, row))) return false; }
      else {
        const { data, error } = await sb.from('deals').insert({ ...row, status: 'To review' }).select('*').single();
        if (error) { fail(error); return false; }
        rows.unshift(data); view = 'review'; toast('Deal added for Peter to review');
      }
      draw();
    },
  });
}
