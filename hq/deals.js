// Pipeline → Deals: deals PROVIDED to OuterHaven (mandates, teasers, CIMs from sponsors, banks and introducers), for Peter
// to review. Not outbound targets: those are Fund signals / Credit signals. Table `deals` (supabase/2026-10-07-deals.sql).
import { sb, esc, $, $$, toast, fail, modal, opts } from './core.js';
import { me } from './tasks.js';
import { openTeaserPage, TITLES } from './teasers.js';

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

const lines = t => String(t || '').split('\n').map(x => x.replace(/^[-•*\s]+/, '').trim()).filter(Boolean);
const FULL = { Chase: 'Chase Hamby', Tengku: 'Tengku Harris', Peter: 'Peter Plaut', Anaz: 'Anaz Azlan' };
const contactOf = d => d.contact || FULL[String(d.owner_name || '').split(' ')[0]] || 'Chase Hamby';
// What a one-page teaser needs. Each missing item is listed on the card and on the teaser.
const NEEDS = [
  ['headline or summary', d => d.headline || d.summary], ['type', d => d.deal_type], ['ask', d => d.ask_text || d.ask_amount],
  ['sector', d => d.sector], ['geography', d => d.geography], ['3+ highlights', d => lines(d.highlights).length >= 3],
  ['financials', d => d.financials], ['use of funds or structure', d => lines(d.use_of_funds).length || d.structure],
];
const missingOf = d => NEEDS.filter(([, ok]) => !ok(d)).map(([k]) => k);
// Teaser JSON (routines/teaser-builder.md shape) straight from the deal's fields: no Claude, no invented facts.
function autoTeaser(d) {
  const terms = [['Valuation', d.valuation_text], ['Structure', d.structure], ['Financials', d.financials], ['Timeline', d.timeline]].filter(([, v]) => v).map(([label, value]) => ({ label, value }));
  const first = String(d.summary || '').split(/(?<=[.!?])\s/)[0];
  return {
    project: d.codename, headline: d.headline || (first && first.length < 180 ? first : ''), sector: d.sector || '', geography: d.geography || '',
    transaction: d.deal_type || '', size: d.ask_text || (d.ask_amount ? money(d.ask_amount) : ''), overview: d.summary || '',
    highlights: lines(d.highlights), key_terms: terms, use_of_funds: lines(d.use_of_funds), ideal_investor: d.ideal_investor || '',
    next_steps: 'Sign an NDA → information memorandum → call with the sponsor',
    contact: { name: contactOf(d), title: TITLES[contactOf(d)] || '', email: '' }, missing: missingOf(d),
  };
}
const brief = d => [
  `Deal: ${d.codename}`, d.deal_type && `Type: ${d.deal_type}`, (d.ask_text || d.ask_amount) && `Ask: ${d.ask_text || money(d.ask_amount)}`,
  d.valuation_text && `Valuation: ${d.valuation_text}`, d.sector && `Sector: ${d.sector}`, d.geography && `Geography: ${d.geography}`,
  d.headline && `In one line: ${d.headline}`, d.summary && `Summary: ${d.summary}`, d.highlights && `Highlights:\n${d.highlights}`,
  d.financials && `Financials: ${d.financials}`, d.use_of_funds && `Use of funds:\n${d.use_of_funds}`, d.structure && `Structure: ${d.structure}`,
  d.timeline && `Timeline: ${d.timeline}`, d.ideal_investor && `Ideal investor: ${d.ideal_investor}`,
].filter(Boolean).join('\n\n');

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
  pullClaudeTeasers();
}
// A Claude teaser job finished since we asked: copy its JSON onto the deal (once).
async function pullClaudeTeasers() {
  const waiting = rows.filter(d => d.teaser_job_id && !d.teaser);
  if (!waiting.length) return;
  const j = await sb.from('resource_jobs').select('id,status,payload,error').in('id', waiting.map(d => d.teaser_job_id));
  let changed = false;
  for (const job of j.data || []) {
    const d = waiting.find(x => x.teaser_job_id === job.id);
    if (job.status === 'ready' && job.payload?.teaser) { if (await save(d.id, { teaser: job.payload.teaser, teaser_html: null }, true)) changed = true; }
    else if (job.status === 'failed') { d._teaserFailed = job.error || 'failed'; changed = true; }
  }
  if (changed && el?.isConnected && !document.querySelector('.modal')) draw();
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
      <div class="dlDocs">
        <button type="button" class="btn sm primary" data-teaser>View teaser</button>
        ${(d.doc_links || []).map((x, i) => `<button type="button" class="btn sm" data-doc="${i}">${esc(x.label || (x.path ? x.path.split('/').pop().replace(/^\d+-/, '') : 'Document'))}</button>`).join('')}
        <span class="pFlag ${teaserTone(d)}">${esc(teaserState(d))}</span>
      </div>
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

function teaserState(d) {
  if (d.teaser_job_id && !d.teaser) return d._teaserFailed ? 'Claude teaser failed' : 'Claude is writing the teaser…';
  const miss = missingOf(d);
  const kind = d.teaser_html ? 'Edited teaser' : d.teaser ? 'Claude teaser' : 'Teaser drafted from the deal';
  return miss.length ? `${kind} · ${NEEDS.length - miss.length}/${NEEDS.length} facts, add ${miss.slice(0, 3).join(', ')}${miss.length > 3 ? '…' : ''}` : `${kind} · ready`;
}
const teaserTone = d => d.teaser_job_id && !d.teaser ? (d._teaserFailed ? 'bad' : 'warn') : missingOf(d).length ? 'warn' : 'good';

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
    $('[data-teaser]', card).onclick = () => showTeaser(d);
    $$('[data-doc]', card).forEach(b => b.onclick = () => viewDoc(d.doc_links[+b.dataset.doc]));
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
      <h4 class="dlFormH full">For the teaser <span class="muted">(write it anonymised: no company or people names)</span></h4>
      <label class="field full">In one line <input class="input" name="headline" value="${esc(v.headline || '')}" placeholder="e.g. US$40M equity for a 120-key branded resort in the Visayas, 60% pre-sold"></label>
      <label class="field full">Highlights (one per line, 3–6) <textarea class="textarea" name="highlights" rows="4" placeholder="Land fully owned, no debt&#10;Branded operator signed&#10;…">${esc(v.highlights || '')}</textarea></label>
      <label class="field full">Financials (as given) <input class="input" name="financials" value="${esc(v.financials || '')}" placeholder="e.g. Revenue $18M, EBITDA $4.2M (FY25); or projected IRR 22%"></label>
      <label class="field full">Use of funds (one per line) <textarea class="textarea" name="use_of_funds" rows="3" placeholder="Construction phase 2: $25M&#10;Working capital: $5M">${esc(v.use_of_funds || '')}</textarea></label>
      <label class="field">Timeline <input class="input" name="timeline" value="${esc(v.timeline || '')}" placeholder="e.g. first close Q1 2027"></label>
      <label class="field">Contact on the teaser <select class="select" name="contact">${opts(Object.keys(TITLES), contactOf(v))}</select></label>
      <label class="field full">Ideal investor <input class="input" name="ideal_investor" value="${esc(v.ideal_investor || '')}" placeholder="e.g. family offices, $5–15M tickets, 5-year hold"></label>
      <h4 class="dlFormH full">Documents</h4>
      <label class="field full">Upload their teaser, CIM or model (PDF or image, up to 25 MB each) <input class="input" type="file" name="files" multiple accept="application/pdf,image/png,image/jpeg,image/webp"></label>
      ${(v.doc_links || []).filter(x => x.path).length ? `<div class="field full">Uploaded <div class="checks">${v.doc_links.filter(x => x.path).map(x => `<label><input type="checkbox" name="keep" value="${esc(x.path)}" checked> ${esc(x.label || x.path)}</label>`).join('')}</div></div>` : ''}
      <label class="field full">Links (one per line: Label | link) <textarea class="textarea" name="docs" rows="2" placeholder="Teaser | https://drive.google.com/…&#10;Data room | https://…">${esc(docsText((v.doc_links || []).filter(x => x.url)))}</textarea></label>
    </div>`,
    onSubmit: async fd => {
      const g = k => String(fd.get(k) || '').trim() || null;
      const row = { codename: g('codename'), deal_type: g('deal_type'), ask_text: g('ask_text'), ask_amount: parseAsk(g('ask_text')), valuation_text: g('valuation_text'),
        sector: g('sector'), geography: g('geography'), source_name: g('source_name'), received_at: g('received_at'), nda_status: g('nda_status') || 'None',
        owner_name: g('owner_name'), structure: g('structure'), fee_terms: g('fee_terms'), summary: g('summary'),
        headline: g('headline'), highlights: g('highlights'), financials: g('financials'), use_of_funds: g('use_of_funds'), timeline: g('timeline'),
        contact: g('contact'), ideal_investor: g('ideal_investor') };
      if (!row.codename) { toast('Give it a codename'); return false; }
      const keep = new Set(fd.getAll('keep').map(String));
      const files = fd.getAll('files').filter(f => f && f.size);
      const kept = (v.doc_links || []).filter(x => x.path && keep.has(x.path));
      row.doc_links = [...kept, ...parseDocs(fd.get('docs'))];
      let id = d?.id;
      if (d) { if (!(await save(d.id, row, true))) return false; }
      else {
        const { data, error } = await sb.from('deals').insert({ ...row, status: 'To review' }).select('*').single();
        if (error) { fail(error); return false; }
        rows.unshift(data); id = data.id; view = 'review';
      }
      if (files.length) {
        const up = await uploadDocs(id, files);
        if (up.length) await save(id, { doc_links: [...kept, ...up, ...parseDocs(fd.get('docs'))] }, true);
      }
      toast(d ? 'Saved' : 'Deal added for Peter to review');
      draw();
    },
  });
}

// ---- Teaser popup: saved edits > Claude's version > drafted from the deal's fields ----
function showTeaser(d) {
  const t = d.teaser ? { ...d.teaser, missing: d.teaser.missing || [] } : autoTeaser(d);
  const note = d.teaser_html ? 'Your saved version.' : d.teaser ? 'Written by Claude from this deal.' : 'Drafted from this deal\'s fields (fill in more on Edit for a fuller teaser).';
  openTeaserPage({
    t, poster: contactOf(d), html: d.teaser_html || null, note,
    onSave: async html => { if (await save(d.id, { teaser_html: html })) draw(); },
    actions: [
      ...(d.teaser_html || d.teaser ? [{ label: 'Rebuild from deal fields', onClick: async (m, close) => { if (await save(d.id, { teaser_html: null, teaser: null, teaser_job_id: null }, true)) { close(); draw(); showTeaser(d); } } }] : []),
      { label: d.teaser ? 'Rewrite with Claude' : 'Write with Claude', onClick: async (m, close) => {
        if (brief(d).length < 120) { toast('Add a summary and a few facts first (Edit).'); return; }
        const { data, error } = await sb.functions.invoke('resource-request', { body: { action: 'teaser', teaser: {
          source_text: brief(d), notes: [d.fee_terms && `Our fee (do not put on the teaser): ${d.fee_terms}`, d.source_name && `Provided to us by ${d.source_name} (do not name them)`].filter(Boolean).join('\n'),
          codename: d.codename, contact: contactOf(d), side: 'sell', anonymise: true, opportunity_id: d.opportunity_id || '', deal_id: d.id } } });
        let msg = data?.error; if (error) { try { msg = (await error.context?.json?.())?.error; } catch { } msg = msg || error.message; }
        if (msg) { toast(msg); return; }
        const job = data?.id || data?.job_id || null;
        if (await save(d.id, { teaser_job_id: job, teaser: null, teaser_html: null }, true)) { toast('Claude is writing it (a few minutes). The deal shows when it is ready.'); close(); draw(); watch(d.id); }
      } },
    ],
  });
}
// Poll a few times for the Claude teaser while the tab is open.
function watch(id) {
  let n = 0; const t = setInterval(async () => {
    n++; const d = rows.find(r => r.id === id);
    if (!el?.isConnected || !d || d.teaser || n > 30) { clearInterval(t); return; }
    if (!d.teaser_job_id) { const r = await sb.from('deals').select('teaser_job_id').eq('id', id).maybeSingle(); d.teaser_job_id = r.data?.teaser_job_id; }
    await pullClaudeTeasers();
  }, 20000);
}

// ---- Documents: uploaded files (private bucket, signed link) or links, shown in a popup ----
async function viewDoc(x) {
  if (!x) return;
  let url = x.url;
  if (x.path) { const { data, error } = await sb.storage.from('deal-docs').createSignedUrl(x.path, 3600); if (error) { fail(error, 'Open'); return; } url = data.signedUrl; }
  const drive = String(url).match(/drive\.google\.com\/file\/d\/([^/]+)/) || String(url).match(/[?&]id=([^&]+)/);
  const docs = String(url).match(/docs\.google\.com\/(document|presentation|spreadsheets)\/d\/([^/]+)/);
  const src = drive && /drive\.google/.test(url) ? `https://drive.google.com/file/d/${drive[1]}/preview` : docs ? `https://docs.google.com/${docs[1]}/d/${docs[2]}/preview` : url;
  const img = /\.(png|jpe?g|webp)(\?|$)/i.test(x.path || url);
  modal({ title: x.label || 'Document', submit: '', wide: true,
    body: `<div class="dlViewer">${img ? `<img src="${esc(src)}" alt="">` : `<iframe src="${esc(src)}" title="${esc(x.label || 'Document')}"></iframe>`}</div>
      <p class="s muted" style="margin:10px 0 0">Not showing? <a href="${esc(url)}" target="_blank" rel="noopener">Open in a new tab ↗</a></p>` });
}
async function uploadDocs(id, files) {
  const out = [];
  for (const f of files) {
    if (f.size > 25 * 1048576) { toast(`${f.name} is over 25 MB, skipped`); continue; }
    const path = `${id}/${Date.now()}-${f.name.replace(/[^\w.-]+/g, '_')}`;
    const { error } = await sb.storage.from('deal-docs').upload(path, f, { contentType: f.type || 'application/pdf' });
    if (error) { fail(error, 'Upload'); continue; }
    out.push({ label: f.name.replace(/\.[^.]+$/, ''), path });
  }
  return out;
}
