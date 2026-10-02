// Fund signals rules. Turns a Form D filing (from the GitHub edgartools job, or the Apify fallback) into a judged lead,
// and reads a "did they file again?" check. Plain JS so it runs in the edge function and in Node tests.
// Every verdict carries its reasons, so HQ can show exactly why a fund was kept or cut.

// Bump when the rules change: the cron re-judges every stored signal on the old version.
export const RULES_VERSION = 3;
export const ROMAN = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9, X: 10 };
export const romanOf = n => Object.keys(ROMAN).find(k => ROMAN[k] === n) || '';
const US = new Set('AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA PR RI SC SD TN TX UT VT VA WA WV WI WY'.split(' '));
// Managers with their own fundraising teams, and wealth platforms whose feeders just repackage someone else's fund.
const BRANDS = /\b(apollo|blackstone|kkr|carlyle|ares|cerberus|adams street|investcorp|canyon capital|h\.?i\.?g\.?|bain capital|andreessen|lightspeed|neuberger|icapital|cais|brown advisory|ashwood|nuveen|crestline|lindsay goldberg|hines|greystar|goldman|morgan stanley|j\.?p\.? ?morgan|blackrock|tpg|warburg|general atlantic|sequoia|accel|insight partners|thoma bravo|brookfield|oaktree|hamilton lane|stepstone|pantheon|harbourvest|partners group|ardian|eqt|cvc|permira|silver lake|fortress|starwood|pimco|invesco|fidelity|ubs|wells fargo|meridiam|cresset|moonfare|yieldstreet|novacap|columbia capital|patient square|grey rock|cvp nolimit)\b/i;
// Single-deal or pass-through vehicles: not a fund raising from LPs.
const VEHICLE = /\b(spv|co-?invest\w*|series of|splitter|blocker|continuation|sidecar|aggregator|access fund|annex)\b/i;
const STOP = new Set('fund funds lp llc llp ltd inc l p gp partners partnership capital ventures venture vc equity growth opportunity opportunities holdings investors investment investments management private credit global strategic select co company the a limited sicav scsp master offshore onshore feeder parallel us international series of and & fof'.split(' '));
const ENTITY = /\b(llc|l\.?l\.?c|l\.?p\.?|inc|ltd|limited|gp|partners|management|corporation|company|s\.?a\.? ?r\.?l|trust|fund|advisers|advisors|group|holdings)\b/i;

export const num = v => { if (v === null || v === undefined || v === '') return null; const n = Number(String(v).replace(/[$,\s]/g, '')); return Number.isFinite(n) ? n : null; };
export const money = n => n == null ? '—' : n >= 1e9 ? '$' + +(n / 1e9).toFixed(1) + 'B' : n >= 1e6 ? '$' + +(n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? '$' + Math.round(n / 1e3) + 'K' : '$' + Math.round(n);
const pctTxt = x => Math.round(x * 100) + '%';
const isoDate = v => /^\d{4}-\d{2}-\d{2}/.test(String(v || '')) ? String(v).slice(0, 10) : null;

// "Ground Game Venture Fund I, L.P." → { fund_no: 1, manager_key: 'ground game', keyword: 'Ground Game' }
export function parseName(name) {
  const clean = String(name || '').replace(/\([^)]*\)/g, ' ').replace(/[.,]/g, ' ').replace(/\s+-\s+/g, ' ').replace(/\s+/g, ' ').trim();
  const toks = clean.split(' ').filter(t => /[a-z0-9]/i.test(t));
  let fund_no = 0, at = -1;
  for (let i = 1; i < toks.length; i++) {
    const t = toks[i].toUpperCase().replace(/-[A-Z0-9]+$/, '');
    if (ROMAN[t]) { fund_no = ROMAN[t]; at = i; break; }
    if (/^FUND$/i.test(toks[i - 1]) && /^\d{1,2}$/.test(t)) { fund_no = +t; at = i; break; }
  }
  const head = (at < 0 ? toks : toks.slice(0, at));
  let i = 0; while (i < head.length && STOP.has(head[i].toLowerCase())) i++;
  const kept = [];
  for (; i < head.length && kept.length < 3; i++) { if (STOP.has(head[i].toLowerCase())) break; kept.push(head[i]); }
  const words = kept.length ? kept : toks.slice(0, 2);
  return { fund_no, manager_key: words.join(' ').toLowerCase(), keyword: words.map(w => w[0] + w.slice(1).toLowerCase()).join(' ') };
}

function people(it) {
  const d = Array.isArray(it.executivesDetail) ? it.executivesDetail : [];
  const out = [];
  for (const p of d) {
    const first = String(p.firstName || '').trim(), last = String(p.lastName || '').trim(), full = `${first} ${last}`.trim();
    if (!first || !last || /^(n\/?a|na|-+|\.|\[none\]|none)$/i.test(first) || ENTITY.test(full) || /general partner|managing member/i.test(full)) continue;
    const nice = s => s === s.toUpperCase() ? s.toLowerCase().replace(/\b[a-z]/g, c => c.toUpperCase()) : s;
    out.push({ name: `${nice(first)} ${nice(last)}`, title: p.title || '', location: p.location || '' });
  }
  return out;
}

// One Apify item → one fund_signals row (before judging).
export function normalize(it, list) {
  const p = parseName(it.companyName);
  const off = num(it.totalOfferingAmount);
  return {
    accession: it.accessionNumber || `${it.cik || 'x'}-${it.filingDate || ''}-${it.companyName || ''}`,
    list, company_name: it.companyName || 'Unknown', cik: it.cik || null,
    fund_no: p.fund_no, manager_key: p.manager_key, check_keyword: p.keyword, fund_key: `${p.manager_key}#${p.fund_no}`,
    filing_date: isoDate(it.filingDate), form_type: it.formType || null,
    offering: off, offering_text: off == null ? (it.totalOfferingAmount || null) : null,
    sold: num(it.totalAmountSold), investors: num(it.numberOfInvestors),
    first_sale: isoDate(it.dateOfFirstSale), commissions: num(it.salesCommissions) || 0, finders: num(it.findersFeesExpenses) || 0,
    exemptions: it.federalExemptions || null, state: it.state || null, city: it.city || null, phone: it.phone || null,
    industry: it.industryGroup || null, executives: people(it), executives_text: it.executives || '',
    filing_url: it.filingUrl || null, edgar_url: it.edgarUrl || null,
  };
}

// Judge a signal. Returns { verdict: 'target' | 'maybe' | 'cut', score 0-100, reasons: [{ tone, text }] }.
export function classify(s, now = Date.now()) {
  const R = [], add = (tone, text, pts = 0) => R.push({ tone, text, pts });
  const name = s.company_name || '';
  if (VEHICLE.test(name)) add('cut', 'Single-deal vehicle (SPV, co-invest or series), not a fund raising from investors');
  if (BRANDS.test(name) || BRANDS.test(s.executives_text || '')) add('cut', 'Big brand or wealth platform: has its own fundraising team');
  if (s.commissions > 0) add('cut', `Already pays a placement agent (${money(s.commissions)} in sales commissions)`);
  else if (s.finders > 0) add('cut', `Already pays a finder (${money(s.finders)})`);
  if (s.state && !US.has(s.state)) add('maybe', `Non-US manager (state code ${s.state})`);
  if (!(s.executives || []).length) add('maybe', 'No named people in the filing, only entities');
  // A fund's legal name nearly always says what it is; "MCF SpaceX-I LLC" or "TS Rover I, LLC" is usually a one-deal vehicle.
  if (!/\b(fund|funds|partners|capital|ventures?|vc|equity|investors|investments?|opportunit\w*|growth|credit|holdings|lp|l\.?p\.?|scsp)\b/i.test(name)) add('maybe', "Name doesn't read like a fund: could be a single-deal vehicle");

  const sold = s.sold || 0, pctSold = s.offering ? sold / s.offering : null;
  const start = s.first_sale ? Date.parse(s.first_sale) : s.filing_date ? Date.parse(s.filing_date) : null;
  const months = start ? (now - start) / (30.44 * 864e5) : null;

  if (s.list === 'live') {
    if (s.fund_no >= 4) add('cut', `Fund ${romanOf(s.fund_no)}: established manager with existing investors`);
    else if (s.fund_no === 0) add('maybe', 'Fund number not in the name');
    else if (s.fund_no === 1) add('maybe', 'Fund I: usually too early (no track record to sell)');
    else add('good', s.fund_no === 2 ? 'Fund II: the hardest raise, no realised returns yet' : 'Fund III: still building its investor base', s.fund_no === 2 ? 20 : 12);
    if (s.offering == null) add('maybe', 'Target size not stated ("Indefinite"), so % raised is unknown');
    else if (s.offering < 50e6) add('cut', `Too small: ${money(s.offering)} target (we want $50–250M)`);
    else if (s.offering > 250e6) add('cut', `Too big: ${money(s.offering)} target (we want $50–250M)`);
    if (pctSold != null && (sold > 0 || s.first_sale)) {
      if (pctSold >= 0.6) add('cut', `Mostly raised: ${pctTxt(pctSold)} of target`);
      else add('good', `${pctTxt(pctSold)} raised, ${money(s.offering - sold)} still to raise`, pctSold < 0.3 ? 15 : 8);
    }
    if (!s.first_sale) add('good', 'Filed before taking any money: the earliest possible contact', 15);
    else if (months != null && months <= 1.5) add('good', 'Started raising in the last 6 weeks', 12);
    if (months != null && months >= 6 && pctSold != null && pctSold < 0.3 && s.first_sale) add('good', `Stuck: only ${pctTxt(pctSold)} raised in ${Math.round(months)} months`, 40);
    else if (months != null && months >= 12 && pctSold == null && s.first_sale) add('good', `Still raising ${Math.round(months)} months after the first sale`, 20);
  } else {
    if (s.fund_no >= 2) add('cut', 'Not a Fund I');
    // Size = money actually raised when there is any (a $50M target with $375K raised never really happened).
    const size = s.sold > 0 ? s.sold : s.offering || null;
    if (!size) add('maybe', 'Fund I size unknown');
    else if (size < 10e6) add('cut', `Fund I ${s.sold > 0 ? 'raised' : 'targeted'} only ${money(size)}: too small to pay for help on Fund II`);
    else if (size > 75e6) add('cut', `Fund I over $75M (${money(size)}): likely already has a fundraising process`);
    if (months != null) {
      if (months < 30) add('maybe', `Fund I is only ${(months / 12).toFixed(1)} years old: too early for Fund II`);
      else if (months > 60) add('maybe', `Fund I is ${(months / 12).toFixed(1)} years old: may have moved on or stopped`);
      else add('good', `Fund I is ${(months / 12).toFixed(1)} years old: inside the Fund II window (years 3–5)`, 20);
    }
    if (pctSold != null && sold > 0 && pctSold < 0.6) add('good', `Fund I reached only ${pctTxt(pctSold)} of its target: Fund II will be harder`, 10);
    if (s.check_status === 'clear' && !(s.sold > 0)) add('maybe', 'No money reported raised, even in later filings: Fund I may never have closed');
    else if (s.check_status === 'clear') add('good', `No Fund II filed yet (checked ${String(s.checked_at || '').slice(0, 10)})`, 25);
    else if (s.check_status === 'next') add('cut', s.check_note || 'Already filed a later fund');
    else if (s.check_status === 'error') add('maybe', 'Fund II check failed: run it again');
    else if (s.check_status === 'checking') add('info', 'Checking EDGAR for a Fund II…');
    else if (s.check_status === 'queued') add('info', 'Queued for a Fund II check (runs hourly on GitHub)');
    else add('info', 'Not checked for a Fund II yet');
    if (s.still_raising) add('good', `Still raising Fund I: ${s.still_raising}`, 30);
  }
  if (/06c/.test(s.exemptions || '')) add('good', 'Rule 506(c): allowed to market publicly, so already looking for investors openly', 8);

  const verdict = R.some(r => r.tone === 'cut') ? 'cut' : R.some(r => r.tone === 'maybe') ? 'maybe' : 'target';
  const score = Math.max(0, Math.min(100, 30 + R.reduce((n, r) => n + r.pts, 0)));
  return { verdict, score: verdict === 'cut' ? Math.min(score, 20) : score, reasons: R.map(({ tone, text }) => ({ tone, text })) };
}

// Read a check run: later filings (D or D/A) whose name matches this manager.
// A higher fund number = they already started the next fund. Same number, later date = an amendment with fresh numbers.
export function readCheck(s, items) {
  const mine = Math.max(1, s.fund_no || 0), later = [], amends = [];
  for (const it of items || []) {
    const p = parseName(it.companyName);
    if (p.manager_key !== s.manager_key || VEHICLE.test(it.companyName || '')) continue;
    const row = { name: it.companyName, date: isoDate(it.filingDate), form: it.formType, offering: num(it.totalOfferingAmount), sold: num(it.totalAmountSold), fund_no: p.fund_no, cik: it.cik || null };
    // Same fund = same SEC company id (CIK); fall back to the exact name when a CIK is missing.
    const same = s.cik && row.cik ? Number(s.cik) === Number(row.cik) : String(it.companyName || '').toLowerCase() === String(s.company_name || '').toLowerCase();
    if (same) { if (row.date && (!s.filing_date || row.date > s.filing_date)) amends.push(row); }
    else if (p.fund_no > mine) later.push(row);
  }
  later.sort((a, b) => String(a.date).localeCompare(String(b.date)));
  amends.sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const out = { later, latest: amends.find(a => a.sold != null) || amends[0] || null };
  if (later.length) { const f = later[0]; out.status = 'next'; out.note = `Already filed ${f.name} (${f.date}${f.offering ? `, ${money(f.offering)} target` : ''})`; }
  else { out.status = 'clear'; out.note = out.latest ? `No later fund. Latest Fund ${romanOf(mine)} filing ${out.latest.date}${out.latest.sold != null ? `: ${money(out.latest.sold)} raised${out.latest.offering ? ` of ${money(out.latest.offering)}` : ''}` : ''}` : `No later fund filed since ${s.filing_date || 'the original filing'}`; }
  return out;
}
