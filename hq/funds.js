// Pipeline → Fund signals: US funds raising right now (SEC Form D filings, pulled through Apify) and Fund I managers
// due to raise Fund II. The edge function fund-signals scans, judges with fixed rules and checks for a later fund;
// this tab shows every verdict with its reasons, and turns a target into pipeline people with one click.
import { sb, state, esc, $, $$, toast, fail, modal, opts, firstName } from './core.js';
import { me } from './tasks.js';

let el = null, rows = [], runs = [], cfg = null, list = 'live', view = 'target', timer = null, onCount = () => {};
const DAY = 864e5;
const money = n => n == null ? '—' : n >= 1e9 ? '$' + +(n / 1e9).toFixed(1) + 'B' : n >= 1e6 ? '$' + +(n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? '$' + Math.round(n / 1e3) + 'K' : '$' + Math.round(n);
const day = v => v ? new Date(v + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
const toneOf = t => t === 'good' ? 'good' : t === 'cut' ? 'bad' : t === 'maybe' ? 'warn' : '';
const liSearch = (person, s) => `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(person + ' ' + (s.check_keyword || ''))}`;

async function call(body) {
  const { data, error } = await sb.functions.invoke('fund-signals', { body });
  if (error || data?.ok === false) throw new Error(data?.error || error?.message || 'Fund signals error');
  return data;
}

async function load() {
  const [s, r, g] = await Promise.all([
    sb.from('fund_signals').select('*').order('score', { ascending: false }).limit(2000),
    sb.from('fund_signal_runs').select('*').order('created_at', { ascending: false }).limit(60),
    sb.from('growth_settings').select('fund_scan_enabled,fund_monthly_budget').eq('id', 1).maybeSingle(),
  ]);
  if (s.error) { rows = null; return; }
  rows = s.data || []; runs = r.data || []; cfg = g.data || { fund_scan_enabled: false, fund_monthly_budget: 10 };
}

// One row per fund: feeders, parallels and -A/-B vehicles of the same fund collapse into the best-scored one.
function grouped(l) {
  const m = new Map();
  for (const s of rows.filter(x => x.list === l)) {
    const k = s.fund_key || s.id, g = m.get(k);
    if (!g) m.set(k, { ...s, vehicles: [s] });
    else { g.vehicles.push(s); if (s.score > g.score) Object.assign(g, s, { vehicles: g.vehicles }); }
  }
  return [...m.values()];
}
const bucket = s => s.status === 'added' ? 'added' : s.status === 'dismissed' ? 'dismissed' : s.verdict;

export function fundTargetCount() { return rows ? grouped('live').concat(grouped('fund1')).filter(s => bucket(s) === 'target').length : 0; }

export async function renderFunds(target, countCb) {
  el = target; onCount = countCb || onCount;
  if (!rows?.length) el.innerHTML = '<div class="empty">Loading fund signals…</div>';
  await load();
  if (!el.isConnected) return;
  draw();
  const running = runs.filter(r => r.status === 'running');
  if (running.length) collect(true);
}

// Ask the server to pick up finished Apify runs. Repeats every 45 s while runs are going and the tab is open.
async function collect(quiet) {
  clearTimeout(timer);
  try { const r = await call({ action: 'poll' }); if (!quiet || r.finished) { await load(); if (el?.isConnected) draw(); } if (!quiet) toast(r.finished ? `Collected ${r.finished} finished run${r.finished === 1 ? '' : 's'}` : 'Still running on Apify'); }
  catch (e) { if (!quiet) toast(e.message); }
  if (el?.isConnected && runs.some(r => r.status === 'running')) timer = setTimeout(() => collect(true), 45000);
}

function draw() {
  if (rows === null) { el.innerHTML = '<div class="empty">The fund signals tables aren\'t set up yet.</div>'; return; }
  const all = grouped(list), counts = { target: 0, maybe: 0, cut: 0, added: 0, dismissed: 0 };
  all.forEach(s => counts[bucket(s)]++);
  const shown = all.filter(s => bucket(s) === view).sort((a, b) => b.score - a.score || String(b.filing_date).localeCompare(String(a.filing_date)));
  const running = runs.filter(r => r.status === 'running');
  const month = new Date(); month.setUTCDate(1); month.setUTCHours(0, 0, 0, 0);
  const spent = runs.filter(r => Date.parse(r.created_at) >= month).reduce((n, r) => n + (r.status === 'running' ? +r.cap_usd || 0 : +r.cost_usd || 0), 0);
  const lastScan = runs.find(r => r.kind === (list === 'live' ? 'scan_live' : 'scan_fund1') && r.status === 'done');
  onCount(grouped('live').concat(grouped('fund1')).filter(s => bucket(s) === 'target').length);

  el.innerHTML = `<div class="fs">
    <div class="fsTop">
      <div class="pSeg" role="group">${[['live', 'Raising now'], ['fund1', 'Fund I, due for Fund II']].map(([k, l]) => `<button type="button" data-list="${k}" class="${list === k ? 'on' : ''}">${l}<em>${grouped(k).filter(s => bucket(s) === 'target').length}</em></button>`).join('')}</div>
      <div class="row fsBtns">${list === 'live' ? '<button class="btn sm primary" data-scan="live">Scan last 30 days</button>' : '<button class="btn sm primary" data-scan="fund1">Scan Fund Is from 3–4 years ago</button>'}
        <button class="btn sm" id="fsCollect">${running.length ? `Collect results (${running.length} running)` : 'Collect results'}</button>
        <button class="btn sm ghost" id="fsHow">How it works</button><button class="btn sm ghost" id="fsSet">Settings</button></div>
    </div>
    <p class="pHint">${list === 'live' ? 'Fund IIs and IIIs that filed a Form D: they started taking investor money in the last few weeks.' : 'Fund Is that started 3–4 years ago. If no Fund II has been filed, they are about to raise one.'}
      <b>$${spent.toFixed(2)}</b> of $${(+cfg.fund_monthly_budget || 10).toFixed(0)} used this month${lastScan ? ` · last scan ${new Date(lastScan.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` : ''} · weekly scan <b>${cfg.fund_scan_enabled ? 'on' : 'off'}</b></p>
    <div class="fsViews">${[['target', 'Targets'], ['maybe', 'Maybe'], ['cut', 'Cut'], ['added', 'In pipeline'], ['dismissed', 'Dismissed']].map(([k, l]) => `<button type="button" data-view="${k}" class="${view === k ? 'on' : ''}" data-tone="${k === 'target' ? 'good' : k === 'cut' ? 'bad' : ''}">${l} <b>${counts[k]}</b></button>`).join('')}</div>
    ${list === 'fund1' && view === 'target' && shown.some(s => !s.check_status) ? `<div class="fsBulk"><span>${shown.filter(s => !s.check_status).length} not yet checked for a Fund II.</span><button class="btn sm" id="fsCheckAll">Check them all (≈$${(Math.min(40, new Set(shown.filter(s => !s.check_status).map(s => s.manager_key)).size) * 0.3).toFixed(2)} max)</button></div>` : ''}
    <div class="fsList">${shown.length ? shown.map(rowHtml).join('') : `<div class="empty">${view === 'target' ? (all.length ? 'No targets in this list right now.' : 'Nothing scanned yet. Run a scan above; results arrive in a few minutes.') : 'Nothing here.'}</div>`}</div>
  </div>`;
  bind(shown);
}

function rowHtml(s) {
  const pct = s.offering && s.sold != null ? Math.round(s.sold / s.offering * 100) : null;
  const facts = [
    s.offering ? `Target <b>${money(s.offering)}</b>` : 'Target <b>not stated</b>',
    s.sold != null ? `Raised <b>${money(s.sold)}</b>${pct != null ? ` (${pct}%)` : ''}` : '',
    s.investors != null ? `<b>${s.investors}</b> investor${s.investors === 1 ? '' : 's'}` : '',
    s.first_sale ? `First sale <b>${day(s.first_sale)}</b>` : '<b>No money taken yet</b>',
    [s.city, s.state].filter(Boolean).join(', '),
  ].filter(Boolean);
  const ppl = (s.executives || []).slice(0, 4);
  const chk = s.check_status === 'checking' && s.list === 'fund1' ? '' : s.check_status === 'checking' ? '<span class="pFlag">Checking EDGAR for newer filings…</span>'
    : s.check_status ? `<span class="pFlag ${s.check_status === 'next' ? 'bad' : s.check_status === 'clear' ? 'good' : 'warn'}">${esc(s.check_note || '')}</span>` : '';
  return `<article class="fsRow" data-tone="${toneOf(s.verdict === 'target' ? 'good' : s.verdict)}">
    <div class="fsScore"><b>${s.score}</b><span>score</span></div>
    <div class="fsMain">
      <h4>${esc(s.company_name)}${s.vehicles.length > 1 ? ` <span class="fsVeh" title="${esc(s.vehicles.map(v => v.company_name).join('\n'))}">+${s.vehicles.length - 1} vehicle${s.vehicles.length > 2 ? 's' : ''}</span>` : ''}</h4>
      <div class="fsFacts">${facts.map(f => `<span>${f}</span>`).join('')}<span class="muted">Filed ${day(s.filing_date)}${s.form_type === 'D/A' ? ' (amendment)' : ''}</span></div>
      <ul class="fsWhy">${(s.reasons || []).map(r => `<li data-tone="${toneOf(r.tone)}">${esc(r.text)}</li>`).join('')}</ul>
      ${chk ? `<div class="fsCheck">${chk}</div>` : ''}
      ${ppl.length ? `<div class="fsPeople">${ppl.map(p => `<a href="${liSearch(p.name, s)}" target="_blank" rel="noopener" title="Search LinkedIn">${esc(p.name)} ↗</a>`).join('')}${(s.executives || []).length > 4 ? `<span class="muted">+${s.executives.length - 4} more</span>` : ''}</div>` : ''}
    </div>
    <div class="fsAct">
      ${s.status !== 'added' ? `<button class="btn sm ${s.verdict === 'target' ? 'primary' : ''}" data-add="${s.id}">Add to pipeline</button>` : '<span class="pFlag good">In pipeline</span>'}
      <button class="btn sm" data-copy="${s.id}">Copy opener</button>
      ${s.check_status !== 'checking' ? `<button class="btn sm" data-check="${s.id}">${s.check_status ? 'Re-check' : s.list === 'live' ? 'Check newer filings' : 'Check for Fund II'}</button>` : ''}
      ${s.filing_url ? `<a class="btn sm ghost" href="${esc(s.filing_url)}" target="_blank" rel="noopener">Filing ↗</a>` : ''}
      ${s.status === 'dismissed' ? `<button class="btn sm ghost" data-undo="${s.id}">Restore</button>` : s.status !== 'added' ? `<button class="btn sm ghost" data-dismiss="${s.id}">Dismiss</button>` : ''}
    </div></article>`;
}

function opener(s) {
  const who = firstName((s.executives || [])[0]?.name || '') || 'there';
  const pct = s.offering && s.sold ? Math.round(s.sold / s.offering * 100) : null;
  if (s.list === 'fund1') {
    const yrs = s.first_sale || s.filing_date ? ((Date.now() - Date.parse(s.first_sale || s.filing_date)) / (365.25 * DAY)).toFixed(0) : 'a few';
    return `Hi ${who}, ${s.check_keyword} Fund I is about ${yrs} years in, so Fund II planning is probably on the table. We help emerging managers line up new LPs (family offices especially) before launch, not after. Open to comparing notes on who's on your list?`;
  }
  const where = s.sold && s.offering ? `${money(s.sold)} toward ${money(s.offering)}${pct != null ? ` (${pct}%)` : ''}` : 'the raise';
  return `Hi ${who}, congrats on getting ${s.check_keyword} Fund ${ROMAN[s.fund_no] || ''} underway: ${where}. We introduce family offices and other LPs to managers at your stage. Worth a quick chat on who's still on your list?`;
}

function bind(shown) {
  const find = id => shown.find(s => s.id === id) || rows.find(s => s.id === id);
  $$('[data-list]', el).forEach(b => b.onclick = () => { list = b.dataset.list; view = 'target'; draw(); });
  $$('[data-view]', el).forEach(b => b.onclick = () => { view = b.dataset.view; draw(); });
  $('#fsCollect', el).onclick = () => collect(false);
  $('#fsHow', el).onclick = howModal;
  $('#fsSet', el).onclick = settingsModal;
  $$('[data-scan]', el).forEach(b => b.onclick = () => {
    const l = b.dataset.scan, cost = l === 'live' ? 2.4 : 4;
    modal({
      title: l === 'live' ? 'Scan funds raising now' : 'Scan the Fund I cohort', submit: 'Start scan',
      body: `<p style="margin:0">${l === 'live' ? 'Every Fund II and III Form D filed in the last 30 days (2 runs).' : 'Every Fund I Form D filed 3–4 years ago, one quarter per run (4 runs).'} Costs up to <b>$${cost.toFixed(2)}</b> of Apify credit, usually much less. Results arrive in 5–15 minutes; you can leave this page.</p>`,
      async onSubmit() {
        try { const r = await call({ action: 'scan', list: l }); toast(`Started ${r.started} run${r.started === 1 ? '' : 's'}. Results in 5–15 min.`); await load(); if (el.isConnected) draw(); collect(true); }
        catch (e) { toast(e.message); return false; }
      },
    });
  });
  const runCheck = async (ids, btn) => {
    if (btn) btn.disabled = true;
    try { const r = await call({ action: 'check', ids }); toast(`Checking ${r.started} manager${r.started === 1 ? '' : 's'} on EDGAR. A few minutes.`); await load(); draw(); collect(true); }
    catch (e) { toast(e.message); if (btn) btn.disabled = false; }
  };
  $$('[data-check]', el).forEach(b => b.onclick = () => runCheck([b.dataset.check], b));
  $('#fsCheckAll', el)?.addEventListener('click', e => runCheck(shown.filter(s => !s.check_status).map(s => s.id), e.target));
  $$('[data-copy]', el).forEach(b => b.onclick = async () => {
    const s = find(b.dataset.copy), t = opener(s);
    try { await navigator.clipboard.writeText(t); toast('Opener copied. Personalise it before sending.'); } catch { modal({ title: 'Opener', submit: '', body: `<textarea class="input" rows="6" style="width:100%">${esc(t)}</textarea>` }); }
  });
  $$('[data-dismiss],[data-undo]', el).forEach(b => b.onclick = async () => {
    const id = b.dataset.dismiss || b.dataset.undo, st = b.dataset.dismiss ? 'dismissed' : 'new';
    const s = find(id), ids = (s.vehicles || [s]).map(v => v.id);
    if (fail(await sb.from('fund_signals').update({ status: st, updated_at: new Date().toISOString() }).in('id', ids), 'Update')) return;
    rows.filter(r => ids.includes(r.id)).forEach(r => r.status = st); draw();
  });
  $$('[data-add]', el).forEach(b => b.onclick = () => addModal(find(b.dataset.add)));
}

// Each chosen person becomes a Sell Side relationship (a fund raising money is a client with something to sell to investors).
function addModal(s) {
  const ppl = s.executives || [];
  modal({
    title: 'Add to pipeline', submit: 'Add',
    body: `<div class="form pForm"><p class="s muted" style="grid-column:1/-1;margin:0"><b>${esc(s.company_name)}</b>. Each person you tick becomes a sell-side relationship with a task to find them on LinkedIn.</p>
      ${ppl.length ? `<div class="field" style="grid-column:1/-1">People<div class="pTasks">${ppl.map((p, i) => `<label><input type="checkbox" name="p" value="${i}" ${i < 2 ? 'checked' : ''}> <span>${esc(p.name)}</span><em class="muted s">${esc(p.title || '')}</em></label>`).join('')}</div></div>`
        : '<label class="field" style="grid-column:1/-1">Name<input class="input" name="manual" required placeholder="No people in the filing: who did you find?"></label>'}
      <label class="field" style="grid-column:1/-1">First step<input class="input" name="next" value="Find on LinkedIn and send the connection note"></label>
      <label class="field">Owner<select class="select" name="owner">${opts(['Tengku', 'Chase', 'Peter', 'Anaz', 'Razeen'], me())}</select></label></div>`,
    async onSubmit(fd) {
      const chosen = ppl.length ? fd.getAll('p').map(i => ppl[+i]) : [{ name: String(fd.get('manual')).trim(), title: '' }];
      if (!chosen.length) { toast('Tick at least one person'); return false; }
      const now = new Date().toISOString(), fundLine = `${s.company_name}${s.offering ? ` · ${money(s.offering)} target` : ''}${s.sold != null ? `, ${money(s.sold)} raised` : ''}`;
      let first = null;
      for (const p of chosen) {
        const r = await sb.from('people').insert({ name: p.name, primary_side: 'Sell Side', relationship_type: 'Sell-side Relationship', pipeline_stage: 'New Relationship', pipeline_active: true, waiting_on: 'us', waiting_on_since: now, company_name: s.company_name, headline: p.title || null, source: 'Form D', last_inbound_message: `Form D signal: ${fundLine}. ${(s.reasons || []).filter(x => x.tone === 'good').map(x => x.text).join('. ')}`, created_by: state.user?.id }).select().single();
        if (fail(r, 'Add ' + p.name)) return false;
        first = first || r.data.id;
        await sb.from('tasks').insert({ person_id: r.data.id, action: String(fd.get('next') || '').trim() || 'Find on LinkedIn', owner_name: fd.get('owner'), due_date: now.slice(0, 10), created_by: state.user?.id });
      }
      const ids = (s.vehicles || [s]).map(v => v.id);
      await sb.from('fund_signals').update({ status: 'added', person_id: first, updated_at: now }).in('id', ids);
      rows.filter(r => ids.includes(r.id)).forEach(r => { r.status = 'added'; r.person_id = first; });
      toast(`${chosen.length} added to Pipeline → Sell side`); draw();
    },
  });
}

function settingsModal() {
  modal({
    title: 'Fund signals settings', submit: 'Save',
    body: `<div class="form pForm">
      <label class="row s" style="grid-column:1/-1"><input type="checkbox" name="on" ${cfg.fund_scan_enabled ? 'checked' : ''}> Weekly scan (Mondays): last week's Fund II/III filings, the Fund I week that just turned 3.5 years old, and a Fund II check on new Fund I targets. About $0.30–1 a week.</label>
      <label class="field">Monthly budget (USD)<input class="input" type="number" min="1" max="200" step="1" name="budget" value="${+cfg.fund_monthly_budget || 10}"></label>
      <p class="s muted" style="grid-column:1/-1;margin:0">Uses the main Apify account (same one as the LinkedIn scraper). Every run is capped; a scan stops before it would pass this budget.</p></div>`,
    async onSubmit(fd) {
      const patch = { fund_scan_enabled: fd.get('on') === 'on', fund_monthly_budget: Math.max(1, +fd.get('budget') || 10), updated_at: new Date().toISOString(), updated_by: state.user?.id || null };
      if (fail(await sb.from('growth_settings').update(patch).eq('id', 1), 'Save')) return false;
      Object.assign(cfg, patch); toast('Saved'); draw();
    },
  });
}

function howModal() {
  modal({
    title: 'How fund signals work', submit: '', wide: true,
    body: `<div class="fsHow">
      <h4>1. Where the data comes from</h4>
      <p>Every US private fund must file a <b>Form D</b> with the SEC within 15 days of taking its first investor's money, and amend it each year while it keeps raising. HQ pulls these filings from EDGAR through an Apify scraper (about $0.0035 per filing).</p>
      <h4>2. The two lists</h4>
      <p><b>Raising now:</b> filings with "II" or "III" in the fund name, financial services only. <b>Fund I, due for Fund II:</b> Fund I filings from 3–4 years ago, scanned one quarter at a time.</p>
      <h4>3. Automatic cuts (a fund is cut if any one applies)</h4>
      <ul><li>A single-deal vehicle: SPV, co-invest, "a series of", splitter, continuation fund.</li>
      <li>A big brand or wealth platform (Apollo, Ares, a16z, iCapital, CAIS…): they have their own fundraising team.</li>
      <li>Sales commissions or finder's fees above $0: they already pay someone to raise.</li>
      <li>Raising now: target under $50M or over $250M, 60%+ already raised, or Fund IV and up.</li>
      <li>Fund I list: Fund I under $10M or over $75M, or a later fund already filed.</li></ul>
      <h4>4. "Maybe" (needs a human look)</h4>
      <ul><li>Target size "Indefinite", so % raised can't be worked out.</li><li>Non-US manager, or no named people on the filing.</li><li>Fund I younger than 2.5 or older than 5 years.</li></ul>
      <h4>5. Score (higher = call first)</h4>
      <ul><li><b>+40</b> stuck: under 30% raised 6+ months after the first sale.</li><li><b>+30</b> Fund I still raising years later.</li><li><b>+25</b> checked: no Fund II filed yet.</li><li><b>+20</b> Fund II (the hardest raise), or Fund I inside the year 3–5 window.</li><li><b>+15</b> filed before taking money, or under 30% raised.</li><li><b>+8</b> Rule 506(c): allowed to market publicly.</li></ul>
      <h4>6. The Fund II check</h4>
      <p>Searches every Form D and amendment filed since, under the manager's name (e.g. "Ground Game"). A later fund with a higher number = cut ("already filed Fund II"). A newer amendment of the same fund (same SEC company number) updates how much it has raised. Different firms that share a word are ignored unless the name matches.</p>
      <h4>7. What it can't see</h4>
      <ul><li>Funds that raise without filing, or file under a different name.</li><li>Whether the people are still active or reachable: check LinkedIn before messaging.</li><li>Funds whose target is "Indefinite" can't be ranked on % raised.</li></ul>
      <p class="s muted">Placement for a success fee on fund capital needs a US broker-dealer (or a partner who is one). Sort that before signing a mandate.</p></div>`,
  });
}
