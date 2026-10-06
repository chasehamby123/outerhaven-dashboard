// Fund signals rules. Turns a Form D filing (from the GitHub edgartools job, or the Apify fallback) into a judged lead,
// and reads a "did they file again?" check. Plain JS so it runs in the edge function and in Node tests.
// Every verdict carries its reasons, so HQ can show exactly why a fund was kept or cut.

// Bump when the rules change: the cron re-judges every stored signal on the old version.
export const RULES_VERSION = 13;
export const ROMAN = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9, X: 10 };
export const romanOf = n => Object.keys(ROMAN).find(k => ROMAN[k] === n) || '';
const US = new Set('AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA PR RI SC SD TN TX UT VT VA WA WV WI WY'.split(' '));
// Managers with their own fundraising teams, and wealth platforms whose feeders just repackage someone else's fund.
const BRANDS = /\b(apollo|blackstone|kkr|carlyle|ares|cerberus|adams street|investcorp|canyon capital|h\.?i\.?g\.?|bain capital|andreessen|lightspeed|neuberger|icapital|cais|brown advisory|ashwood|nuveen|crestline|lindsay goldberg|hines|greystar|goldman|morgan stanley|j\.?p\.? ?morgan|blackrock|tpg|warburg|general atlantic|sequoia|accel|insight partners|thoma bravo|brookfield|oaktree|hamilton lane|stepstone|pantheon|harbourvest|partners group|ardian|eqt|cvc|permira|silver lake|fortress|starwood|pimco|invesco|fidelity|ubs|wells fargo|meridiam|cresset|moonfare|yieldstreet|novacap|columbia capital|patient square|grey rock|cvp nolimit|blue owl|dfj)\b/i;
// Single-deal or pass-through vehicles: not a fund raising from LPs.
const VEHICLE = /\b(spv|co-?invest\w*|series of|splitter|blocker|continuation|sidecar|aggregator|access fund|annex)\b|\bseries\s+(?!fund\b)[a-z0-9]/i;
// One fund files many Form Ds: amendments, feeders, parallel and offshore twins, -A/-B classes. Same family = same fund.
export const fundFamily = name => String(name || '').toLowerCase().replace(/\([^)]*\)/g, ' ')
  .replace(/\b(feeder|offshore|onshore|parallel|master|qp|ai|institutional|international|cayman|delaware|us|usd|eur|lux|scsp|l\.?\s?p\.?|llc|ltd|limited|inc|co|the)\b/g, ' ')
  .replace(/\b([ivx]+)-[a-z0-9]+\b/g, '$1').replace(/[^a-z0-9 ]/g, ' ').replace(/\b[a-z]\b/g, ' ').replace(/\s+/g, ' ').trim();
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
    amended_at: isoDate(it.amendedAt), amendment_url: it.amendmentUrl || null,
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
    // Next-fund watch (list 'fund1' holds Fund Is AND Fund IIs since 5 Oct 2026): a manager whose last fund is old enough
    // that the next one is due. Fund II managers raising a Fund III are in scope too.
    const n = s.fund_no || 1, nm = `Fund ${romanOf(n) || 'I'}`, nextNm = `Fund ${romanOf(n + 1)}`;
    if (n >= 3) add('cut', `${nm}: established manager with existing investors`);
    // Size = the target. The amount raised on the first Form D is only the first close (filed within 15 days of it), so it
    // is used only when no target is stated, or once the check has read the latest amendment.
    // Once an amendment (or the check) has given the money actually raised, that is the fund's real size: a $10M target
    // that raised $2.4M in three years (Horn of Africa Fund I) is a $2.4M fund.
    const raisedFinal = (s.check_status || s.amended_at) && s.sold > 0 ? s.sold : null;
    const size = raisedFinal || s.offering || (s.sold > 0 ? s.sold : null), max = n === 2 ? 150e6 : 75e6;
    const word = raisedFinal ? 'raised' : s.offering ? 'targeted' : 'raised';
    if (!size) add('maybe', `${nm} size unknown (target "Indefinite", nothing raised yet at filing)`);
    else if (size < 10e6 && !(s.offering == null && !s.check_status && !s.amended_at)) add('cut', `${nm} ${word} only ${money(size)}: too small to pay for help on ${nextNm}`);
    else if (size < 10e6) add('maybe', `${nm} had raised ${money(size)} at its first filing, target not stated: check for later amendments`);
    else if (size > max) add('cut', `${nm} ${word} ${money(size)} (over ${money(max)}): likely already has a fundraising process`);
    // Windows from the cadence study (5 Oct 2026, 250 Fund Is + 250 Fund IIs filed in 2019, next fund = first later fund by the
    // same people, any name, 9+ months later): Fund I -> next median 24 months (middle half 16-35); Fund II -> next median 28
    // (19-37). Only ~1 in 7 Fund I managers with no next fund at year 3 files one by year 5.
    const W = n === 2 ? { lo: 15, hi: 39, med: 28, q: '19-37' } : { lo: 12, hi: 36, med: 24, q: '16-35' };
    if (months != null) {
      const yrs = `${nm} is ${months < 24 ? Math.round(months) + ' months' : (months / 12).toFixed(1) + ' years'} old`;
      if (months < W.lo) add('maybe', `${yrs}: early, most managers file their next fund at ${W.q} months (median ${W.med})`);
      else if (months <= W.hi) add('good', `${yrs}: inside the window where most managers file their next fund (median ${W.med} months, middle half ${W.q})`, 25);
      else if (months <= 60) add('good', `${yrs}: past the usual window; most who raise again have filed by now, so this manager may be stalled (or need help most)`, 5);
      else add('maybe', `${yrs}: may have moved on or stopped`);
    }
    if (pctSold != null && sold > 0 && pctSold < 0.6) add('good', `${nm} reached only ${pctTxt(pctSold)} of its target: ${nextNm} will be harder`, 10);
    if (n === 2) add('good', 'Fund II manager: has a track record to sell for Fund III', 5);
    if (s.check_status === 'clear' && !(s.sold > 0)) add('maybe', `No money reported raised, even in later filings: ${nm} may never have closed`);
    else if (s.check_status === 'clear') add('good', `No ${nextNm} or renamed next fund filed yet (checked ${String(s.checked_at || '').slice(0, 10)})`, 25);
    else if (s.check_status === 'next') add('cut', s.check_note || 'Already filed a later fund');
    else if (s.check_status === 'unsure') add('maybe', s.check_note || `Possible ${nextNm}, not confirmed: check by hand`);
    else if (s.check_status === 'error') add('maybe', 'Next-fund check failed: run it again');
    else if (s.check_status === 'checking') add('info', `Checking EDGAR for a ${nextNm}…`);
    else if (s.check_status === 'queued') add('info', 'Queued for a next-fund check (runs hourly on GitHub)');
    else add('info', 'Not checked for a next fund yet');
    if (s.still_raising) add('good', `Still raising ${nm}: ${s.still_raising}`, 30);
  }
  if (/06c/.test(s.exemptions || '')) add('good', 'Rule 506(c): allowed to market publicly, so already looking for investors openly', 8);
  // Manager size (6 Oct 2026, Tengku): all its funds together under $150M = the target; $150-500M = keep, lower priority;
  // over $500M = established, cut. From the adviser's Form ADV (assets under management / private fund gross assets),
  // or the Form Ds of this manager's funds when no adviser filing is found.
  const mt = s.manager_total != null ? Number(s.manager_total) : null, src = s.manager_total_src ? ` (${s.manager_total_src})` : '';
  if (mt != null && mt > 500e6) add('cut', `Manager runs ${money(mt)} in total${src}: established, not an emerging manager`);
  else if (mt != null && mt > 150e6) add('info', `Manager runs ${money(mt)} in total${src}: past emerging, lower priority`, -15);
  else if (mt != null && mt > 0) add('good', `Emerging manager: ${money(mt)} across all its funds${src}`, 20);
  else if (s.adviser_checked_at && !s.adviser_crd) add('info', 'No SEC adviser filing found: likely a small, state-registered manager');

  const verdict = R.some(r => r.tone === 'cut') ? 'cut' : R.some(r => r.tone === 'maybe') ? 'maybe' : 'target';
  const score = Math.max(0, Math.min(100, R.reduce((n, r) => n + r.pts, 0)));
  return { verdict, score: verdict === 'cut' ? Math.min(score, 20) : score, reasons: R.map(({ tone, text }) => ({ tone, text })) };
}

// People on a filing, as comparable keys: "aman brar" → "a brar". Entities are already dropped by people().
const personKeys = list => new Set((list || []).map(p => String(p.name || `${p.firstName || ''} ${p.lastName || ''}`).toLowerCase().replace(/[^a-z\s]/g, ' ').trim().split(/\s+/)).filter(w => w.length >= 2).map(w => `${w[0][0]} ${w[w.length - 1]}`));

// People on both lists; sameCity = that person's address city matches too (a stronger sign it's the same person).
function sharedPeople(ours, theirs) {
  const key = p => { const w = String(p.name || '').toLowerCase().replace(/[^a-z\s]/g, ' ').trim().split(/\s+/).filter(x => x.length >= 2); return w.length >= 2 ? `${w[0][0]} ${w[w.length - 1]}` : ''; };
  const city = p => String(p.location || '').split(',')[0].trim().toLowerCase();
  const mine = new Map((ours || []).map(p => [key(p), p]));
  return (theirs || []).filter(p => key(p) && mine.has(key(p))).map(p => ({ name: p.name, sameCity: !!city(p) && city(p) === city(mine.get(key(p))) }));
}

// Money raised across this manager's funds in our Form D data: the latest amount per fund (feeders and parallels folded
// into one fund), counting only filings that share a named person with this one (or the same city), so two firms with
// similar names never add up.
export function formDTotal(s, peers) {
  const ours = personKeys(s.executives), city = String(s.city || '').toLowerCase();
  const best = new Map();
  for (const p of peers || []) {
    if (p.manager_key !== s.manager_key) continue;
    const theirs = personKeys(p.executives);
    const same = p.id === s.id || [...theirs].some(k => ours.has(k)) || (!ours.size && city && String(p.city || '').toLowerCase() === city);
    if (!same) continue;
    const fam = `${fundFamily(p.company_name)}#${p.fund_no || 0}`, v = Number(p.sold) || 0;
    if (v > (best.get(fam) || 0)) best.set(fam, v);
  }
  let total = 0; for (const v of best.values()) total += v;
  return { total, funds: best.size };
}

// Read a check run: later filings (D or D/A) whose name matches this manager.
// A higher fund number by the same manager = they already started the next fund. "Same manager" needs the name match AND
// at least one person (partner/director) on both filings; without people to compare it's only "unsure".
// Same fund number under the same SEC company number (CIK), later date = an amendment with fresh numbers.
export function readCheck(s, items) {
  const mine = Math.max(1, s.fund_no || 0), later = [], amends = [], strangers = [], unsure = [];
  const ours = personKeys(s.executives);
  const byPerson = [];
  for (const it of items || []) {
    const p = parseName(it.companyName);
    if (VEHICLE.test(it.companyName || '')) continue;
    // Found by searching a person's name: a fund under ANY name that the same people filed later (managers often drop the
    // numbering: "Stratos Venture Partners Fund I", then "Frontier Fund"). Judged on the people, not the name.
    if (it.via === 'person' && p.manager_key !== s.manager_key) {
      const date = isoDate(it.filingDate);
      if (s.cik && it.cik && Number(s.cik) === Number(it.cik)) continue;
      if (!date || (s.filing_date && date <= s.filing_date)) continue;
      if (it.industryGroup && it.industryGroup !== 'Pooled Investment Fund') continue;
      // Deal vehicles (one property, one co-invest) don't count as a next fund: under $10M, or AIV / opportunity-zone names.
      const off = num(it.totalOfferingAmount);
      if ((off != null && off < 10e6) || /\b(aiv|oz|qof|qozf|investco|propco)\b/i.test(it.companyName || '')) continue;
      const theirs = people(it), shared = sharedPeople(s.executives, theirs);
      if (!shared.length) continue;
      byPerson.push({ name: it.companyName, date, form: it.formType, offering: off, sold: num(it.totalAmountSold), fund_no: p.fund_no, cik: it.cik || null,
        shared: shared.map(x => x.name), strong: shared.length >= 2 || shared.some(x => x.sameCity) || theirs.length === 1 });
      continue;
    }
    if (p.manager_key !== s.manager_key) continue;
    const row = { name: it.companyName, date: isoDate(it.filingDate), form: it.formType, offering: num(it.totalOfferingAmount), sold: num(it.totalAmountSold), fund_no: p.fund_no, cik: it.cik || null };
    // Same fund = same SEC company id (CIK); fall back to the exact name when a CIK is missing.
    const same = s.cik && row.cik ? Number(s.cik) === Number(row.cik) : String(it.companyName || '').toLowerCase() === String(s.company_name || '').toLowerCase();
    if (same) { if (row.date && (!s.filing_date || row.date > s.filing_date)) amends.push(row); continue; }
    if (!(p.fund_no > mine) || (s.filing_date && row.date && row.date <= s.filing_date)) continue;
    const theirs = personKeys(people(it));
    row.shared = [...theirs].filter(k => ours.has(k));
    if (!ours.size || !theirs.size) unsure.push(row);
    else if (row.shared.length) later.push(row);
    else strangers.push(row);
  }
  const byDate = (a, b) => String(a.date).localeCompare(String(b.date));
  // One fund files several Form Ds (amendments, feeders): keep the first filing per fund name.
  const firstPer = rows => rows.sort(byDate).filter((r, i, a) => a.findIndex(x => String(x.name).toLowerCase() === String(r.name).toLowerCase()) === i);
  const renamed = firstPer(byPerson.filter(r => r.strong)), renamedUnsure = firstPer(byPerson.filter(r => !r.strong));
  later.push(...renamed.map(r => ({ ...r, renamed: true }))); unsure.push(...renamedUnsure.map(r => ({ ...r, renamed: true })));
  const families = rows => rows.sort(byDate).filter((r, i, a) => a.findIndex(x => fundFamily(x.name) === fundFamily(r.name)) === i);
  later.splice(0, later.length, ...families(later)); unsure.splice(0, unsure.length, ...families(unsure));
  amends.sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const out = { funds_since: later.length, later: [...later, ...unsure.map(r => ({ ...r, unconfirmed: true })), ...strangers.map(r => ({ ...r, other_manager: true }))], latest: amends.find(a => a.sold != null) || amends[0] || null };
  const fresh = out.latest ? `Latest Fund ${romanOf(mine)} filing ${out.latest.date}${out.latest.sold != null ? `: ${money(out.latest.sold)} raised${out.latest.offering ? ` of ${money(out.latest.offering)}` : ''}` : ''}` : '';
  const ignored = strangers.length ? ` Ignored ${strangers.length} same-name filing${strangers.length > 1 ? 's' : ''} by different people (${strangers[0].name}).` : '';
  if (later.length) { const f = later[0]; out.status = 'next'; out.note = f.renamed
    ? `Already raised a later fund under a new name: ${f.name} (${f.date}${f.offering ? `, ${money(f.offering)} target` : ''}), same people (${f.shared.join(', ')})`
    : `Already filed ${f.name} (${f.date}${f.offering ? `, ${money(f.offering)} target` : ''}); same people on both filings`;
    if (later.length > 1) out.note += `. ${later.length} funds since: ${later.map(x => `${x.name} (${String(x.date).slice(0, 4)})`).join('; ')}`; }
  else if (unsure.length) { const f = unsure[0]; out.status = 'unsure'; out.note = f.renamed
    ? `Possible later fund under a new name: ${f.name} (${f.date}) names ${f.shared.join(', ')}, but nothing else matches (could be another firm with the same person). Check by hand.${ignored}`
    : `Possible Fund II: ${f.name} (${f.date}), but no named people to confirm it's the same manager. Check by hand.${ignored}`; }
  else { out.status = 'clear'; out.note = (fresh ? `No later fund. ${fresh}.` : `No later fund filed since ${s.filing_date || 'the original filing'}.`) + ignored; }
  return out;
}

// ---- Credit signals: small US public companies that need private credit (Peter's lane) ----
// Item from scripts/credit_signals.py: { cik, name, tickers, exchange, sic, sicDesc, state, periodEnd, debtCurrent,
// debtNoncurrent, cash, revenue, publicFloat, flags: { going_concern?, forbearance? }, filingUrl }
export const CREDIT_RULES_VERSION = 3;
export function normalizeCredit(it) {
  return {
    cik: String(Number(it.cik)), company_name: it.name || 'Unknown', tickers: (it.tickers || []).join ? (it.tickers || []).join(', ') : it.tickers || null,
    exchange: (it.exchanges || []).join ? (it.exchanges || []).join(', ') : it.exchange || null, sic: it.sic ? String(it.sic) : null, sic_desc: it.sicDesc || null,
    state: it.state || null, period_end: isoDate(it.periodEnd), debt_current: num(it.debtCurrent), debt_noncurrent: num(it.debtNoncurrent), revolver_current: num(it.revolverCurrent),
    cash: num(it.cash), revenue: num(it.revenue), public_float: num(it.publicFloat), flags: it.flags || {}, filing_url: it.filingUrl || null,
  };
}
export function classifyCredit(s) {
  const R = [], add = (tone, text, pts = 0) => R.push({ tone, text, pts });
  const sic = Number(s.sic) || 0, f = s.flags || {};
  const dc = s.debt_current, cash = s.cash, total = (s.debt_current || 0) + (s.debt_noncurrent || 0);
  const when = s.period_end ? ` (balance sheet ${s.period_end})` : '';
  if (sic >= 6000 && sic <= 6799 && sic !== 6798) add('cut', `Bank, insurer or fund (${s.sic_desc || 'SIC ' + sic}): not a borrower for us`);
  if (s.on_latest === false) add('cut', 'No longer on the latest scan: its numbers stopped showing a trigger (earlier runs counted revolving lines as debt due)');
  if (/(^|,\s*)[A-Z]{4}Q(,|$)/.test(s.tickers || '')) add('cut', 'Ticker ends in Q: already in Chapter 11, its rescue lenders are set');
  if (s.revenue == null) add('maybe', 'Revenue not found in its filings');
  else if (s.revenue === 0) add('cut', 'No revenue reported: pre-revenue, nothing for a lender to lend against');
  else if (s.revenue < 20e6) add('cut', `Revenue only ${money(s.revenue)}: no cash flow for a lender to lend against`);
  if (total > 750e6) add('cut', `${money(total)} of debt: big enough for banks and the bond market`);
  if (s.public_float != null && s.public_float > 2e9) add('cut', `Public float ${money(s.public_float)}: too large, has bank coverage`);
  if (s.state && !US.has(s.state)) add('maybe', `Non-US company (${s.state})`);
  let trigger = false;
  // Points (0-100): the refinancing deadline and lender stress matter most, then fit. Bigger gap = more urgent.
  if (dc >= 10e6 && cash != null && dc > cash) { trigger = true; add('good', `${money(dc)} of term debt due within 12 months vs ${money(cash)} cash${when}: must refinance`, 30 + Math.min(15, Math.round((dc / Math.max(cash, 1e6) - 1) * 5))); }
  else if (dc >= 10e6 && cash != null && dc > 0.5 * cash) add('good', `${money(dc)} due within 12 months, ${Math.round(dc / cash * 100)}% of its cash${when}`, 10);
  if (f.forbearance) { trigger = true; add('good', `Lender forbearance agreement (${f.forbearance.form} ${f.forbearance.date}): current lender is losing patience`, 30); }
  if (f.going_concern) { trigger = true; add('good', `Going-concern doubt disclosed (${f.going_concern.form} ${f.going_concern.date}): needs rescue or bridge financing`, 15); }
  if (s.revolver_current >= 5e6) add('info', `Plus ${money(s.revolver_current)} on a revolving line (classed as current but usually rolls over)`);
  if (s.revenue >= 50e6 && s.revenue <= 1e9) add('good', `${money(s.revenue)} revenue: enough cash flow to support a private loan`, 7);
  if (s.public_float != null && s.public_float <= 300e6) add('good', `Small cap (public float ${money(s.public_float)}): too small for the bond market`, 10);
  if (total >= 20e6 && total <= 300e6) add('good', `${money(total)} total debt: the size Peter's private credit lenders write`, 8);
  if (!trigger) add('maybe', 'No refinancing deadline, forbearance or going-concern warning found');
  const verdict = R.some(r => r.tone === 'cut') ? 'cut' : R.some(r => r.tone === 'maybe') ? 'maybe' : 'target';
  const score = Math.max(0, Math.min(100, R.reduce((n, r) => n + r.pts, 0)));
  return { verdict, score: verdict === 'cut' ? Math.min(score, 20) : score, reasons: R.map(({ tone, text }) => ({ tone, text })) };
}
