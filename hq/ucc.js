// Pipeline → UCC signals: sizable PRIVATE companies that need private credit (Peter's lane), from state UCC lien filings
// (Connecticut + Colorado open data) sized by their SBA PPP loan. Filled daily by scripts/ucc_signals.py on GitHub; judged
// on the server (classifyUcc in supabase/functions/ucc-signals/rules.js). Every verdict shows its reasons.
import { sb, state, esc, $, $$, toast, fail, modal, opts, firstName } from './core.js';

let el = null, rows = [], runs = [], view = 'target', onCount = () => {};
const money = n => n == null ? '—' : n >= 1e9 ? '$' + +(n / 1e9).toFixed(1) + 'B' : n >= 1e6 ? '$' + +(n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? '$' + Math.round(n / 1e3) + 'K' : '$' + Math.round(n);
const mon = v => v ? new Date(String(v).slice(0, 10) + 'T12:00:00').toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }) : '';
const toneOf = t => t === 'good' ? 'good' : t === 'cut' ? 'bad' : t === 'maybe' ? 'warn' : '';
const bucket = s => s.status === 'added' ? 'added' : s.status === 'dismissed' ? 'dismissed' : s.verdict;
const GH_RUN = 'https://github.com/chasehamby123/outerhaven-dashboard/actions/workflows/fund-signals.yml';
const SECTOR = { 11: 'Agriculture', 21: 'Mining, oil & gas', 22: 'Utilities', 23: 'Construction', 31: 'Manufacturing', 32: 'Manufacturing', 33: 'Manufacturing', 42: 'Wholesale', 44: 'Retail', 45: 'Retail', 48: 'Transport & logistics', 49: 'Transport & logistics', 51: 'Media & telecom', 53: 'Real estate', 54: 'Professional services', 55: 'Holding company', 56: 'Business services', 61: 'Education', 62: 'Healthcare', 71: 'Leisure', 72: 'Hospitality & food', 81: 'Other services' };
const sector = s => SECTOR[String(s.naics || '').slice(0, 2)] || '';
const CLASS = { mca: 'Merchant cash advance', rep: 'Undisclosed lender (via filing agent)', irs: 'IRS tax lien', state_tax: 'State tax / labor lien', judgment: 'Judgment lien', factoring: 'Factoring', fintech: 'Platform loan', sba: 'SBA (EIDL)', bank: 'Bank', agent: 'Agent (syndicated / private credit)', abl: 'Asset-based / commercial finance', statutory: 'Statutory lien' };
const shortName = n => { const c = String(n || '').replace(/,?\s+(inc|corp|corporation|co|company|ltd|llc|l\.l\.c\.|lp|llp|pc)\.?$/i, '').trim(); return c === c.toUpperCase() ? c.toLowerCase().replace(/\b[a-z]/g, x => x.toUpperCase()) : c; };
const ceoSearch = s => `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(`${shortName(s.company_name)} (CEO OR owner OR president OR CFO)`)}`;
const webSearch = s => `https://www.google.com/search?q=${encodeURIComponent(`"${shortName(s.company_name)}" ${s.city || ''} ${s.state || ''}`)}`;

async function load() {
  const [c, r] = await Promise.all([
    sb.from('ucc_signals').select('*').order('score', { ascending: false }).limit(3000),
    sb.from('ucc_signal_runs').select('*').order('created_at', { ascending: false }).limit(3),
  ]);
  if (c.error) { rows = null; return; }
  rows = (c.data || []).filter(s => s.company_key !== 'ZZTEST|CT'); runs = r.data || [];
}
export function uccTargetCount() { return rows ? rows.filter(s => bucket(s) === 'target').length : 0; }

export async function renderUcc(target, countCb) {
  el = target; onCount = countCb || onCount;
  if (!rows?.length) el.innerHTML = '<div class="empty">Loading UCC signals…</div>';
  await load();
  if (el.isConnected) draw();
}

function draw() {
  if (rows === null) { el.innerHTML = '<div class="empty">The UCC signals table isn\'t set up yet.</div>'; return; }
  const counts = { target: 0, maybe: 0, cut: 0, added: 0, dismissed: 0 };
  rows.forEach(s => counts[bucket(s)]++);
  const shown = rows.filter(s => bucket(s) === view).sort((a, b) => b.score - a.score || (b.est_revenue || 0) - (a.est_revenue || 0));
  const last = runs[0], st = last?.stats || {};
  onCount(counts.target);
  el.innerHTML = `<div class="fs">
    <div class="fsTop"><p class="pHint" style="padding:0;margin:0;max-width:680px">Private companies with roughly $20M+ revenue whose lien filings show they need money: stacked merchant cash advances, tax or judgment liens, or a bank facility about to lapse. Private credit is the natural fix, and Peter's lane.</p>
      <div class="row fsBtns"><a class="btn sm primary" href="${GH_RUN}" target="_blank" rel="noopener">Run a scan on GitHub ↗</a><button class="btn sm ghost" id="ucHow">How it works</button></div></div>
    <p class="pHint">Source: Connecticut and Colorado UCC open data, sized by SBA PPP loans. Refreshed daily on GitHub, free.${last ? ` Last run <b>${new Date(last.created_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</b>${st.filings ? ` · ${Number(st.filings).toLocaleString()} filings on sized companies read` : ''}${st.complete === false ? ' · <b style="color:var(--bad)">a state failed to load</b>' : ''}.` : ' Not run yet: on GitHub choose Run workflow, mode <b>ucc</b>.'}</p>
    <div class="fsViews">${[['target', 'Targets'], ['maybe', 'Maybe'], ['cut', 'Cut'], ['added', 'In pipeline'], ['dismissed', 'Dismissed']].map(([k, l]) => `<button type="button" data-view="${k}" class="${view === k ? 'on' : ''}" data-tone="${k === 'target' ? 'good' : k === 'cut' ? 'bad' : ''}">${l} <b>${counts[k]}</b></button>`).join('')}</div>
    <div class="fsList">${shown.length ? shown.slice(0, 200).map(rowHtml).join('') : `<div class="empty">${rows.length ? 'Nothing here.' : 'No companies yet. Run the scan on GitHub (mode ucc); the first run takes about 10–15 minutes.'}</div>`}</div>
    ${shown.length > 200 ? `<p class="pHint">Showing the top 200 of ${shown.length}.</p>` : ''}
  </div>`;
  bind(shown);
}

function rowHtml(s) {
  const p = s.ppp || {};
  const facts = [
    s.est_revenue ? `Revenue <b>~${money(s.est_revenue)}</b> <span class="muted">(est.)</span>` : '',
    p.jobs ? `Jobs <b>${p.jobs}</b>` : '',
    p.amount ? `PPP loan <b>${money(p.amount)}</b>` : '',
    [sector(s), [s.city, s.state].filter(Boolean).join(', ')].filter(Boolean).map(esc).join(' · '),
  ].filter(Boolean);
  const liens = (s.liens || []).filter(l => l.class !== 'bank' || l.status === 'active').slice(0, 8);
  return `<article class="fsRow" data-tone="${toneOf(s.verdict === 'target' ? 'good' : s.verdict)}">
    <div class="fsScore"><b>${s.score}</b><span>score</span></div>
    <div class="fsMain">
      <h4>${esc(s.company_name)} <span class="fsVeh">${esc((s.sources || []).join(' · '))} UCC</span></h4>
      <div class="fsFacts">${facts.map(x => `<span>${x}</span>`).join('')}</div>
      <ul class="fsWhy">${(s.reasons || []).map(r => `<li data-tone="${toneOf(r.tone)}">${esc(r.text)}</li>`).join('')}</ul>
      ${liens.length ? `<details class="ucLiens"><summary>Filings (${(s.liens || []).length})</summary><table><tbody>${liens.map(l => `<tr><td>${esc(mon(l.filed))}</td><td>${esc(CLASS[l.class] || l.class)}</td><td>${esc(l.party)}</td><td class="muted">${l.status === 'active' ? (l.lapse && !l.lapse.startsWith('9999') ? 'lapses ' + esc(mon(l.lapse)) : 'active') : 'released'}</td></tr>`).join('')}</tbody></table></details>` : ''}
      <div class="fsPeople"><a href="${ceoSearch(s)}" target="_blank" rel="noopener">Find the owner / CEO on LinkedIn ↗</a><a href="${webSearch(s)}" target="_blank" rel="noopener">Website ↗</a></div>
    </div>
    <div class="fsAct">
      ${s.status !== 'added' ? `<button class="btn sm ${s.verdict === 'target' ? 'primary' : ''}" data-add="${s.id}">Add to pipeline</button>` : '<span class="pFlag good">In pipeline</span>'}
      <button class="btn sm" data-copy="${s.id}">Copy opener</button>
      ${s.status === 'dismissed' ? `<button class="btn sm ghost" data-undo="${s.id}">Restore</button>` : s.status !== 'added' ? `<button class="btn sm ghost" data-dismiss="${s.id}">Dismiss</button>` : ''}
    </div></article>`;
}

// Peter's first message. Never mentions the liens (public, but naming them reads as surveillance); leads with the fix.
function opener(s, name = '') {
  const who = firstName(name) || 'there', co = shortName(s.company_name), f = s.facts || {}, sec = sector(s).toLowerCase();
  const peers = sec ? `${sec} companies` : 'companies';
  const body = f.mca_18m || f.mca_12m || f.fintech_18m || f.factoring_24m
    ? `A lot of ${peers} around ${co}'s size end up juggling short-term funding because the bank won't stretch. Private lenders will often replace all of it with one longer-term facility: lower cost, no daily debits, one relationship.`
    : f.irs_24m || f.state_tax_24m || f.judgment_24m
      ? `Private lenders are funding ${peers} like ${co} for working capital when the bank won't move fast enough: one facility that cleans up the balance sheet and leaves room to grow.`
      : `If ${co}'s bank facility comes up for renewal in the next year, it's worth seeing what private lenders offer first: more flexible structures, and they're moving faster than banks right now.`;
  return `Hi ${who}, I've spent 35 years in private credit. ${body} Happy to tell you who's actively lending to businesses like yours, no pitch. Worth 15 minutes?`;
}

function bind(shown) {
  const find = id => shown.find(s => s.id === id) || rows.find(s => s.id === id);
  $$('[data-view]', el).forEach(b => b.onclick = () => { view = b.dataset.view; draw(); });
  $('#ucHow', el).onclick = howModal;
  $$('[data-copy]', el).forEach(b => b.onclick = async () => {
    const t = opener(find(b.dataset.copy));
    try { await navigator.clipboard.writeText(t); toast('Opener copied. Put their name in before sending.'); } catch { modal({ title: 'Opener', submit: '', body: `<textarea class="input" rows="6" style="width:100%">${esc(t)}</textarea>` }); }
  });
  $$('[data-dismiss],[data-undo]', el).forEach(b => b.onclick = async () => {
    const id = b.dataset.dismiss || b.dataset.undo, st = b.dataset.dismiss ? 'dismissed' : 'new';
    if (fail(await sb.from('ucc_signals').update({ status: st, updated_at: new Date().toISOString() }).eq('id', id), 'Update')) return;
    const r = rows.find(x => x.id === id); if (r) r.status = st; draw();
  });
  $$('[data-add]', el).forEach(b => b.onclick = () => addModal(find(b.dataset.add)));
}

function addModal(s) {
  modal({
    title: 'Add to pipeline', submit: 'Add',
    body: `<div class="form pForm"><p class="s muted" style="grid-column:1/-1;margin:0"><b>${esc(s.company_name)}</b>${s.city ? `, ${esc(s.city)}` : ''}. Find the owner or CEO first: <a href="${ceoSearch(s)}" target="_blank" rel="noopener">LinkedIn search ↗</a></p>
      <label class="field">Name<input class="input" name="name" required placeholder="Jane Smith"></label>
      <label class="field">Title<input class="input" name="title" value="CEO"></label>
      <label class="field" style="grid-column:1/-1">LinkedIn URL (optional)<input class="input" name="li"></label>
      <label class="field" style="grid-column:1/-1">First step<input class="input" name="next" value="Connect and send the opener (Peter's private credit angle)"></label>
      <label class="field">Owner<select class="select" name="owner">${opts(['Peter', 'Tengku', 'Chase', 'Anaz', 'Razeen'], 'Peter')}</select></label></div>`,
    async onSubmit(fd) {
      const now = new Date().toISOString(), name = String(fd.get('name')).trim(), li = String(fd.get('li') || '').trim() || null;
      const facts = `${s.company_name} (${[s.city, s.state].filter(Boolean).join(', ')}): ${(s.reasons || []).filter(x => x.tone === 'good').map(x => x.text).join(' ')}`;
      const r = await sb.from('people').insert({ name, primary_side: 'Sell Side', relationship_type: 'Sell-side Relationship', pipeline_stage: 'New Relationship', pipeline_active: true, waiting_on: 'us', waiting_on_since: now, company_name: s.company_name, headline: String(fd.get('title') || '').trim() || null, linkedin_url: li, has_linkedin: !!li, source: 'UCC signal', last_inbound_message: facts, created_by: state.user?.id }).select().single();
      if (fail(r, 'Add')) return false;
      await sb.from('tasks').insert({ person_id: r.data.id, action: String(fd.get('next') || '').trim() || 'Connect and send the opener', owner_name: fd.get('owner'), due_date: now.slice(0, 10), created_by: state.user?.id });
      await sb.from('ucc_signals').update({ status: 'added', person_id: r.data.id, updated_at: now }).eq('id', s.id);
      s.status = 'added'; s.person_id = r.data.id;
      try { await navigator.clipboard.writeText(opener(s, name)); toast(`${name} added. Opener copied with their name.`); } catch { toast(`${name} added to Pipeline → Sell side`); }
      draw();
    },
  });
}

function howModal() {
  modal({
    title: 'How UCC signals work', submit: '', wide: true,
    body: `<div class="fsHow">
      <h4>1. Who this finds</h4><p>Private companies big enough for a private credit facility (roughly $20M+ revenue) that are paying too much for money or under cash strain. They never file with the SEC, so Credit signals can't see them.</p>
      <h4>2. Where the data comes from</h4>
      <ul><li><b>UCC filings</b>: a lender's public notice that it has a lien on a company's assets. Connecticut and Colorado publish every filing as free open data, refreshed nightly. Last 30 months, plus bank liens about to lapse.</li>
      <li><b>Size</b>: filings carry no revenue, so each company is matched by name and state (same state only) to the SBA's PPP loan data (2020–21). The loan was about 2.5 months of payroll; revenue is estimated from that and the jobs reported. Only loans of $500K+ are considered.</li></ul>
      <h4>3. What counts as a signal (score)</h4><ul>
      <li><b>+45</b> stacking: 2+ filings by named merchant cash advance funders in 18 months; <b>+30</b> one in the last 12 months.</li>
      <li><b>+30</b> 4+ liens in 18 months filed through agents that hide the lender (CSC, CT Corporation, First Corporate Solutions "as representative"). Cash-advance funders use these agents a lot, but so do equipment lessors, so 3 counts <b>+20</b> and 1 only <b>+8</b>.</li>
      <li><b>+35</b> IRS tax lien, <b>+25</b> state tax or labor-department lien, <b>+20</b> judgment lien (last 2 years).</li>
      <li><b>+20</b> a bank or agent lien that lapses in 3–12 months with no continuation: the facility is likely up for renewal.</li>
      <li><b>+15</b> factoring, <b>+10</b> platform loans (WebBank, Shopify, PayPal), <b>+5</b> already borrows from an agent or asset-based lender.</li>
      <li><b>+20</b> estimated revenue $50M+, <b>+12</b> $20–50M; <b>+10</b> newest filing in the last 90 days.</li></ul>
      <p>Target = estimated revenue $20M+ and a strong signal (named cash advance, 4+ agent filings, tax, judgment) or a lapsing facility. $10–20M or weaker signals = Maybe. Lenders, public bodies, non-profits and anything under $10M are cut.</p>
      <h4>4. What it can't see</h4><ul><li>Companies organized in other states: a UCC is filed where the company is incorporated, so a Delaware LLC based in Connecticut is missed. More states can be added where they publish data (Vermont, West Virginia, Oregon) or by buying bulk files (Texas, Ohio).</li>
      <li>Loan amounts: UCC filings don't say how much was borrowed.</li><li>Size is a 2020 estimate: check the website and LinkedIn headcount before calling.</li></ul>
      <p class="s muted">The opener never mentions liens. They are public, but naming them in a first message reads as surveillance.</p></div>`,
  });
}
