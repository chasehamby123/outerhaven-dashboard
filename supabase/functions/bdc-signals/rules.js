// BDC loans rules: which BDC-financed private companies are worth Peter's call. Pure JS (no imports) so HQ and tests can read it.
// Input: a bdc_signals row (scripts/bdc_signals.py). Every verdict stores its reasons.
// Size (Tengku, 8 Oct 2026): under $10M of debt wastes Peter's time; over ~$150M the big banks and placement agents take it.
// $10-75M is the core (~$2-17M EBITDA at the usual 4-5.5x leverage), $75-150M the upper end.
export const BDC_RULES_VERSION = 1;
export const SIZE = { min: 10e6, core: 75e6, max: 150e6 };

// Lender families by BDC name. Big platforms = upper middle market (sponsor deals, facility far bigger than the BDC piece);
// syndicated = broadly syndicated loan buyers (large public loans); lower middle market = owner-run and small-sponsor companies;
// venture = venture debt to VC-backed companies.
const BIG = /\b(ARES|BLACKSTONE|BLUE OWL|OWL ROCK|HPS|GOLUB|APOLLO|MIDCAP|GOLDMAN|MORGAN STANLEY|NORTH HAVEN|KKR|OAKTREE|SIXTH STREET|ANTARES|BARINGS|BAIN CAPITAL|CARLYLE|TCG BDC|BLACKROCK|JPMORGAN|J\.P\. MORGAN|NUVEEN|CHURCHILL|BROOKFIELD|TPG|ALLIANCEBERNSTEIN|AB PRIVATE|NEW MOUNTAIN|MSD|VISTA CREDIT|THOMA BRAVO|STONE POINT|PGIM|FIDELITY|T\. ROWE|OHA|BLACKROCK TCP|KAYNE|AUDAX|CRESCENT|HPS CORPORATE|STEPSTONE|JEFFERIES|ONEX|LORD ABBETT|MANULIFE|JOHN HANCOCK|AGL|26NORTH|SILVER POINT|BLUE OWL|ADAMS STREET|NORTHLEAF|CLIFFWATER|FRANKLIN BSP|KENNEDY LEWIS)\b/;
const SYNDICATED = /\b(PALMER SQUARE|CIFC|MUZINICH|STEELE CREEK|SENIOR CREDIT INVESTMENTS|NEXPOINT|THIRD POINT|EAGLE POINT|OXFORD SQUARE)\b/;
const LMM = /\b(MAIN STREET|MSC INCOME|CAPITAL SOUTHWEST|FIDUS|GLADSTONE|SARATOGA|MONROE|STELLUS|PHENIXFIN|OFS|GREAT ELM|WHITEHORSE|STAR MOUNTAIN|BRIGHTWOOD|COMVEST|LAFAYETTE SQUARE|INVESTCORP|HARVEST CAPITAL|RAND CAPITAL|EQUUS|PROSPECT|PORTMAN RIDGE|LOGAN RIDGE|CAPITALA|PENNANTPARK|FIRST EAGLE|CHICAGO ATLANTIC|ADVANCED FLOWER|SILVER SPIKE|SLR|BCP INVESTMENT|BC PARTNERS|MUZINICH BDC|DIAMOND HILL|DRIVE|TRINITY CAPITAL|VARAGON|STELLUS PRIVATE|LGAM|SCP PRIVATE|CCS|5C LENDING|MOUNT LOGAN)\b/;
const VENTURE = /\b(VENTURE LENDING|HERCULES|TRINITY CAPITAL|HORIZON TECHNOLOGY|RUNWAY GROWTH|TRIPLEPOINT|BIP VENTURES|WTI|WESTERN TECHNOLOGY|SURESTONE|CLARION)\b/;
export const tierOf = bdc => { const n = String(bdc || '').toUpperCase(); return SYNDICATED.test(n) ? 'syndicated' : VENTURE.test(n) ? 'venture' : BIG.test(n) ? 'big' : LMM.test(n) ? 'lmm' : 'other'; };

const m = n => n >= 1e9 ? '$' + +(n / 1e9).toFixed(1) + 'B' : n >= 1e6 ? '$' + +(n / 1e6).toFixed(n >= 1e8 ? 0 : 1) + 'M' : '$' + Math.round(n / 1e3) + 'K';
const mon = d => d ? new Date(d + 'T12:00:00Z').toLocaleString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' }) : '';
const short = s => String(s || '').replace(/,? (INC|CORP|CORPORATION|LLC|FUND|LP|L\.P\.|LTD)\.?$/i, '').replace(/\b(\w)(\w*)/g, (w, a, b) => w.length <= 3 ? w : a + b.toLowerCase());
export const HOLDCO = /\b(buyer|midco|bidco|topco|holdco|parent|purchaser|acquisition|acquiror|intermediate|borrower|merger sub)\b/i;
// EBITDA the facility implies at the usual 4-5.5x senior leverage for this size.
export const ebitdaRange = f => f ? [f / 5.5, f / 4] : null;

export function classifyBdc(s, today = new Date()) {
  const reasons = [], f = Number(s.facility) || 0, mark = s.mark == null ? null : Number(s.mark), prev = s.prev_mark == null ? null : Number(s.prev_mark);
  const holders = Array.isArray(s.holders) ? s.holders : [], tiers = holders.map(h => tierOf(h.bdc));
  const out = (verdict, score) => ({ verdict, score: Math.max(0, Math.min(100, Math.round(score))), reasons });
  if (s.on_latest === false) { reasons.push({ tone: 'cut', text: 'Not in the BDCs\' latest filings any more (repaid, refinanced or sold).' }); return out('cut', 0); }
  if (s.public_ticker) { reasons.push({ tone: 'cut', text: `Public company (${s.public_ticker}): see Credit signals.` }); return out('cut', 0); }
  if (s.controlled) { reasons.push({ tone: 'cut', text: 'Controlled by its BDC lender (the lender owns it): it won\'t hire an adviser to refinance its own owner.' }); return out('cut', 0); }
  if (tiers.length && tiers.every(t => t === 'syndicated')) { reasons.push({ tone: 'cut', text: 'Held only by syndicated-loan buyers: a large public loan run by the big banks.' }); return out('cut', 0); }
  const er = ebitdaRange(f), eb = er ? `~${m(er[0])}–${m(er[1])} EBITDA at 4–5.5× leverage` : '';
  if (f < SIZE.min) { reasons.push({ tone: 'cut', text: `BDCs hold ${m(f)} of its debt: under the $10M floor.` }); return out('cut', 0); }
  if (f > SIZE.max) { reasons.push({ tone: 'cut', text: `BDCs alone hold ${m(f)}: large enough that big banks and placement agents cover it.` }); return out('cut', 0); }

  let score = 10, trigger = false, maybe = false;
  if (f <= SIZE.core) { score += 20; reasons.push({ tone: 'good', text: `${m(f)} of debt held by BDCs (${eb}): in Peter's range.` }); }
  else { score += 5; reasons.push({ tone: 'maybe', text: `${m(f)} of debt held by BDCs (${eb}): upper end of Peter's range.` }); }

  // Maturity: the hard deadline. Lenders want a refinancing 12-18 months out; past maturity and still held = extended or in default.
  const mat = s.earliest_maturity || s.maturity, days = mat ? Math.round((new Date(mat + 'T12:00:00Z') - today) / 864e5) : null;
  if (days != null) {
    const mo = Math.round(days / 30.4);
    // Past maturity but still marked near par = usually extended with the old date still in the filing: worth a check, not a trigger.
    if (days < 0 && (mark == null || mark >= 95)) { score += 10; reasons.push({ tone: 'maybe', text: `Filed maturity ${mon(mat)} has passed but lenders still mark it near par: probably extended. Check the latest terms.` }); }
    else if (days < 0) { score += 30; trigger = true; reasons.push({ tone: 'good', text: `Past its ${mon(mat)} maturity, still outstanding and marked down: extended under pressure or in default. A refinancing is overdue.` }); }
    else if (days <= 365) { score += 35; trigger = true; reasons.push({ tone: 'good', text: `Matures ${mon(mat)} (${mo} months): has to refinance now.` }); }
    else if (days <= 548) { score += 25; trigger = true; reasons.push({ tone: 'good', text: `Matures ${mon(mat)} (${mo} months): inside the 18-month refinancing window.` }); }
    else if (days <= 730) { score += 10; reasons.push({ tone: 'good', text: `Matures ${mon(mat)} (${mo} months): refinancing talks start in the next 6 months.` }); }
    else reasons.push({ tone: 'info', text: `Matures ${mon(mat)}: no deadline soon.` });
  } else reasons.push({ tone: 'info', text: 'Maturity not stated in the filing.' });

  // The lender's own mark (fair value as % of principal): below 90 = the lender expects trouble.
  if (mark != null) {
    const drop = prev != null ? Math.round(prev - mark) : null, d = drop >= 3 ? ` (down ${drop} points this quarter)` : '';
    if (mark < 50) { score += 10; maybe = true; reasons.push({ tone: 'maybe', text: `Lenders mark it at ${Math.round(mark)}¢ on the dollar${d}: deep distress, likely already restructuring with advisers.` }); }
    else if (mark < 80) { score += 30; trigger = true; reasons.push({ tone: 'good', text: `Lenders mark it at ${Math.round(mark)}¢ on the dollar${d}: stressed. Needs rescue or replacement capital.` }); }
    else if (mark < 90) { score += 20; trigger = true; reasons.push({ tone: 'good', text: `Lenders mark it at ${Math.round(mark)}¢ on the dollar${d}: the lender expects trouble.` }); }
    else if (mark < 95) { score += 5; reasons.push({ tone: 'good', text: `Marked at ${Math.round(mark)}¢${d}: slightly below par.` }); }
    else reasons.push({ tone: 'info', text: `Marked at ${Math.round(mark)}¢${d}: performing.` });
    if (drop >= 5 && mark >= 50) { score += 10; trigger = true; reasons.push({ tone: 'good', text: `Marked down ${drop} points in one quarter: getting worse.` }); }
  }
  if (s.nonaccrual) { score += 15; trigger = true; reasons.push({ tone: 'good', text: 'On non-accrual at a lender (interest not being paid).' }); }
  if (s.pik) { score += 8; reasons.push({ tone: 'good', text: 'Paying part of its interest in kind (added to the loan): cash is tight.' }); }
  if (s.spread != null && Number(s.spread) >= 7) { score += 5; reasons.push({ tone: 'good', text: `Priced at ~S+${(+s.spread).toFixed(1)}%: risky credit, expensive to carry.` }); }

  // Who lends: decides who runs the next deal and whether an adviser gets hired.
  const names = [...new Set(holders.map(h => short(h.bdc)))].slice(0, 4).join(', ');
  if (tiers.includes('venture')) { score -= 10; maybe = true; reasons.push({ tone: 'maybe', text: `Venture debt (${names}): VC-backed company, a different set of lenders.` }); }
  else if (tiers.includes('big')) { score -= 10; reasons.push({ tone: 'maybe', text: `Upper-middle-market lender in the deal (${names}): the full facility is likely bigger than BDCs show, and a PE sponsor usually runs the refinancing.` }); }
  else if (tiers.length && tiers.every(t => t === 'lmm' || t === 'other')) { score += 10; reasons.push({ tone: 'good', text: `Lower-middle-market lenders only (${names}): owner-run or small-sponsor company, the kind that hires an adviser.` }); }
  if (s.lenders >= 3) reasons.push({ tone: 'info', text: `${s.lenders} BDC lenders: a club deal.` });
  if (s.affiliated) { maybe = true; reasons.push({ tone: 'maybe', text: 'A lender also owns 5–25% of it: ask whether the lender-owner would welcome outside capital.' }); }
  else if (s.equity_held) reasons.push({ tone: 'info', text: 'A lender also holds equity (co-investor).' });
  if (s.country) { score -= 10; maybe = true; reasons.push({ tone: 'maybe', text: s.country === 'Outside the US' ? 'Non-US company (foreign legal form in the name).' : `Based in ${s.country}.` }); }
  if (HOLDCO.test(s.company_name || '')) reasons.push({ tone: 'info', text: 'Holding-company name (Buyer / Midco / Parent): likely PE-owned. Call the sponsor\'s deal team or the CFO.' });

  if (!trigger) { reasons.push({ tone: 'maybe', text: 'No trigger: nothing forces a refinancing in the next 18 months and lenders mark it near par.' }); return out('maybe', Math.min(score, 44)); }
  return out(maybe || score < 45 ? 'maybe' : 'target', score);
}
