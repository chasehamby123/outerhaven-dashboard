// Teasers: one-page anonymised deal teasers written by Claude from what a lead told us (their replies / DMs).
// Same pipeline as resources: resource-request (action 'teaser') → the resource-builder routine → routines/teaser-builder.md,
// which writes the teaser as JSON into resource_jobs.payload.teaser (+ a PDF in Drive when it can).
// HQ renders the JSON as a branded A4 page you can tweak in place and download as a PDF.
import { sb, esc, $, $$, toast, modal, opts } from './core.js';

const CONTACTS = ['Chase Hamby', 'Tengku Harris', 'Peter Plaut', 'Anaz Azlan'];
const TITLES = { 'Chase Hamby': 'Managing Director, North America', 'Tengku Harris': 'Co-Managing Director, Asia', 'Peter Plaut': 'Partner & Advisor, UK & North America', 'Anaz Azlan': 'Deal Originator, East Asia & Oceania' };
const STATUS = { queued: ['Starting', ''], building: ['Writing', 'warn'], ready: ['Ready', 'good'], failed: ['Failed', 'bad'], cancelled: ['Cancelled', ''] };
const slug = u => String(u || '').replace(/[?#].*$/, '').replace(/\/+$/, '').split('/').pop().toLowerCase();
const cleanReply = t => String(t || '').replace(/^A lead has replied\s*(Re:)?\s*/i, '').trim();
const ago = t => { if (!t) return ''; const m = Math.round((Date.now() - new Date(t)) / 60000); return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }); };
const errMsg = async (data, error) => { let m = data?.error; if (error) { try { m = (await error.context?.json?.())?.error; } catch { } m = m || error.message; } return m; };

let jobs = [], channel = null, host = null;
async function loadJobs() {
  const r = await sb.from('resource_jobs').select('*').eq('payload->>type', 'teaser').order('created_at', { ascending: false }).limit(100);
  jobs = r.data || [];
}

// ---- Resources → Teasers tab ----
export async function renderTeasers(body) {
  host = body;
  body.innerHTML = '<div class="empty">Loading teasers…</div>';
  await loadJobs(); if (!body.isConnected) return;
  draw();
  if (!channel) channel = sb.channel('hq-teasers').on('postgres_changes', { event: '*', schema: 'public', table: 'resource_jobs' }, async () => { if (!host?.isConnected) return; await loadJobs(); if (!document.querySelector('.modal')) draw(); }).subscribe();
}
function draw() {
  if (!host?.isConnected) return;
  host.innerHTML = `<section class="card"><header><div><h2>Deal teasers</h2><p>Claude turns what a lead told us into a one-page, anonymised teaser for our buy-side network. Built only from their messages and your notes, nothing invented.</p></div>
      <button class="btn primary sm" id="tzNew">New teaser</button></header>
    <div class="body flush">${jobs.length ? jobs.map(card).join('') : '<div class="empty">No teasers yet. Start one here, or from a lead in Pipeline → LinkedIn leads.</div>'}</div></section>`;
  $('#tzNew', host).onclick = () => teaserModal({});
  $$('[data-view]', host).forEach(b => b.onclick = () => viewTeaser(jobs.find(j => j.id === b.dataset.view)));
  $$('[data-retry]', host).forEach(b => b.onclick = async () => { b.disabled = true; const { data, error } = await sb.functions.invoke('resource-request', { body: { action: 'retry', id: b.dataset.retry } }); toast((await errMsg(data, error)) || 'Started again'); await loadJobs(); draw(); });
}
function card(j) {
  const [label, tone] = STATUS[j.status] || [j.status, ''], t = j.payload?.teaser, live = ['queued', 'building'].includes(j.status);
  const src = j.payload?.lead_name ? `From ${esc(j.payload.lead_name)}${j.payload.lead_company ? ' · ' + esc(j.payload.lead_company) : ''}` : 'From pasted text';
  return `<article class="job tzJob">
    <div class="row" style="justify-content:space-between;align-items:flex-start;gap:12px"><div style="min-width:0">
      <b class="jt">${esc(t?.project || j.output_title || j.topic.replace(/^Teaser:\s*/, ''))}</b>
      <div class="s muted">${src} · contact ${esc(j.poster || '')} · ${esc(ago(j.created_at))}</div></div>
      <span class="pFlag ${tone}">${label}</span></div>
    ${t?.headline ? `<p class="tzHead">${esc(t.headline)}</p>` : ''}
    ${live ? `<div class="s" style="margin-top:6px">${esc(j.progress || 'Waiting for Claude to start')}</div>` : ''}
    ${j.status === 'failed' && j.error ? `<div class="s" style="margin-top:6px;color:var(--bad)">${esc(j.error)}</div>` : ''}
    ${j.status === 'ready' && j.judgment_calls?.length ? `<ul class="jc s">${j.judgment_calls.map(c => `<li>${esc(c)}</li>`).join('')}</ul>` : ''}
    <div class="row s" style="margin-top:10px;gap:12px">
      ${t ? `<button class="btn sm primary" data-view="${j.id}">View &amp; download PDF</button>` : ''}
      ${j.output_url ? `<a class="btn sm" href="${esc(j.output_url)}" target="_blank" rel="noopener">PDF in Drive ↗</a>` : ''}
      ${j.session_url ? `<a class="muted" href="${esc(j.session_url)}" target="_blank" rel="noopener">Claude's session ↗</a>` : ''}
      ${j.status === 'failed' ? `<button class="link s" data-retry="${j.id}">Try again</button>` : ''}</div></article>`;
}

// ---- Start a teaser (from the tab, or prefilled from a lead in Pipeline) ----
// prefill: { lead_intake_id, person_id, opportunity_id, lead_name, lead_company, linkedin_url, text }
export async function teaserModal(prefill = {}) {
  const r = await sb.from('lead_intake').select('id,name,company_name,reply_text,linkedin_url,created_at,source_account,person_id').neq('decision', 'not_qualified').order('created_at', { ascending: false }).limit(400);
  const byPerson = new Map();
  for (const l of r.data || []) { const k = slug(l.linkedin_url) || l.id; if (!byPerson.has(k)) byPerson.set(k, { ...l, texts: [] }); byPerson.get(k).texts.unshift({ at: l.created_at, text: cleanReply(l.reply_text) }); }
  const leads = [...byPerson.values()];
  const { el } = modal({
    title: 'New deal teaser', submit: 'Write teaser', wide: true,
    body: `<div class="form pForm">
      <label class="field" style="grid-column:1/-1">Lead<select class="select" name="lead">${opts([['', '— paste text instead —'], ...leads.map(l => [slug(l.linkedin_url) || l.id, `${l.name || 'Unknown'}${l.company_name ? ' · ' + l.company_name : ''}`])], prefill.linkedin_url ? slug(prefill.linkedin_url) : '')}</select></label>
      <label class="field" style="grid-column:1/-1">What they told us <span class="muted">(their messages; edit or add anything)</span><textarea class="textarea" name="source" rows="9" required placeholder="Paste the DM thread or their reply here">${esc(prefill.text || '')}</textarea></label>
      <label class="field" style="grid-column:1/-1">Team notes <span class="muted">(numbers or terms from a call, optional)</span><textarea class="textarea" name="notes" rows="3" placeholder="e.g. Raising US$25M equity, 3-year hold, NDA signed 1 Oct"></textarea></label>
      <label class="field">Project name <span class="muted">(optional)</span><input class="input" name="codename" placeholder="Claude picks one, e.g. Project Atlas"></label>
      <label class="field">Contact on the teaser<select class="select" name="contact">${opts(CONTACTS, 'Chase Hamby')}</select></label>
      <label class="field">It's<select class="select" name="side">${opts([['sell', 'An opportunity raising / selling (for investors)'], ['buy', "An investor's mandate (for deal owners)"]], 'sell')}</select></label>
      <label class="row s" style="align-self:end"><input type="checkbox" name="anon" checked> Anonymise (no names, no company)</label>
      <p class="s muted" style="grid-column:1/-1;margin:0">Takes a few minutes and uses one of today's Claude jobs. You can edit the wording before downloading the PDF.</p></div>`,
    async onSubmit(fd) {
      const k = fd.get('lead'), l = leads.find(x => (slug(x.linkedin_url) || x.id) === k);
      const teaser = {
        source_text: String(fd.get('source') || ''), notes: String(fd.get('notes') || ''), codename: String(fd.get('codename') || ''),
        contact: fd.get('contact'), side: fd.get('side'), anonymise: fd.get('anon') === 'on',
        lead_name: l?.name || prefill.lead_name || '', lead_company: l?.company_name || prefill.lead_company || '', linkedin_url: l?.linkedin_url || prefill.linkedin_url || '',
        lead_intake_id: l?.id || prefill.lead_intake_id || '', person_id: l?.person_id || prefill.person_id || '', opportunity_id: prefill.opportunity_id || '',
      };
      if (teaser.source_text.trim().length < 40) { toast('Add what they told us first (a couple of sentences at least).'); return false; }
      const { data, error } = await sb.functions.invoke('resource-request', { body: { action: 'teaser', teaser } });
      const msg = await errMsg(data, error);
      if (msg) { toast(msg); return false; }
      toast('Claude is writing the teaser. It shows up in Resources → Teasers.');
      if (host?.isConnected) { await loadJobs(); draw(); } else location.hash = '#/resources/teasers';
    },
  });
  // Picking a lead fills in everything they've said (outreach replies + any chat saved with the extension).
  const sel = $('[name=lead]', el), ta = $('[name=source]', el);
  sel.onchange = async () => {
    const l = leads.find(x => (slug(x.linkedin_url) || x.id) === sel.value); if (!l) return;
    let out = l.texts.map(t => `[${new Date(t.at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}] ${l.name || 'Them'}: ${t.text}`);
    const s = slug(l.linkedin_url);
    if (s) {
      const c = await sb.from('dm_conversations').select('messages,account_name').ilike('prospect_url', `%${s}%`).order('captured_at', { ascending: false }).limit(1);
      const msgs = c.data?.[0]?.messages; if (msgs?.length) out = msgs.map(m => `${m.from === 'us' ? (c.data[0].account_name || 'Us') : (m.name || l.name || 'Them')}: ${m.text}`);
    }
    ta.value = out.join('\n\n');
  };
  if (prefill.linkedin_url && !prefill.text) sel.onchange();
}

// ---- View / tweak / download ----
const BLANK = v => v == null || v === '' || (Array.isArray(v) && !v.length);
function teaserHtml(t, j) {
  const contact = t.contact || { name: j.poster, title: TITLES[j.poster] || '' };
  const facts = [['Sector', t.sector], ['Geography', t.geography], ['Transaction', t.transaction], ['Size', t.size]].filter(([, v]) => !BLANK(v));
  const list = a => `<ul>${a.map(x => `<li>${esc(x)}</li>`).join('')}</ul>`;
  const sec = (h, v, html) => BLANK(v) ? '' : `<section><h3>${h}</h3>${html}</section>`;
  return `<div class="tz" id="tzDoc">
    <header class="tzTop"><div class="tzBrand">OUTERHAVEN ADVISORY <span>· Confidential teaser</span></div><h1 contenteditable>${esc(t.project || 'Project')}</h1>${t.headline ? `<p contenteditable>${esc(t.headline)}</p>` : ''}</header>
    ${facts.length ? `<div class="tzFacts">${facts.map(([k, v]) => `<div><label>${k}</label><b contenteditable>${esc(v)}</b></div>`).join('')}</div>` : ''}
    <div class="tzBody" contenteditable>
      ${sec('Overview', t.overview, `<p>${esc(t.overview || '')}</p>`)}
      ${sec('Investment highlights', t.highlights, list(t.highlights || []))}
      ${sec('Key terms', t.key_terms, `<table>${(t.key_terms || []).map(r => `<tr><td>${esc(r.label)}</td><td>${esc(r.value)}</td></tr>`).join('')}</table>`)}
      ${sec('Use of funds', t.use_of_funds, list(t.use_of_funds || []))}
      ${sec('Ideal investor', t.ideal_investor, `<p>${esc(t.ideal_investor || '')}</p>`)}
      ${sec('Next steps', t.next_steps, `<p>${esc(t.next_steps || '')}</p>`)}
    </div>
    <footer class="tzFoot"><div class="tzContact" contenteditable><b>${esc(contact.name || '')}</b><span>${esc(contact.title || '')}</span>${contact.email ? `<span>${esc(contact.email)}</span>` : ''}<span>OuterHaven Advisory</span></div>
      <p>Strictly private and confidential. This teaser does not constitute an offer to sell or a solicitation of an offer to buy any security. Information is provided by the issuer and has not been independently verified.</p></footer>
  </div>`;
}
function viewTeaser(j) {
  const t = j?.payload?.teaser; if (!t) return;
  const { el } = modal({
    title: t.project || 'Teaser', submit: '', wide: true,
    body: `${t.missing?.length ? `<div class="tzMissing"><b>Still missing before it goes out:</b> ${esc(t.missing.join(' · '))}</div>` : ''}
      <p class="s muted" style="margin:0 0 10px">Click any text to edit it, then download. Edits here only change this download.</p>
      <div class="tzWrap">${teaserHtml(t, j)}</div>
      <div class="row" style="margin-top:14px;justify-content:flex-end"><button type="button" class="btn primary" id="tzPdf">Download PDF</button></div>`,
  });
  $('#tzPdf', el).onclick = async e => {
    const b = e.currentTarget; b.disabled = true; b.textContent = 'Making PDF…';
    try {
      if (!window.html2pdf) await new Promise((ok, no) => { const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js'; s.onload = ok; s.onerror = () => no(new Error('Could not load the PDF library')); document.head.appendChild(s); });
      const doc = $('#tzDoc', el), name = (t.project || 'teaser').replace(/[^\w-]+/g, '-');
      doc.classList.add('printing');
      await window.html2pdf().set({ margin: 0, filename: `${name}-teaser.pdf`, image: { type: 'jpeg', quality: 0.96 }, html2canvas: { scale: 2, backgroundColor: '#ffffff' }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }, pagebreak: { mode: ['avoid-all'] } }).from(doc).save();
      doc.classList.remove('printing');
    } catch (err) { toast('PDF failed: ' + err.message); }
    finally { b.disabled = false; b.textContent = 'Download PDF'; }
  };
}
