// UCC signals rules: which sizable private companies are worth Peter's call. Pure JS (no imports) so HQ and tests can read it.
// Input: a ucc_signals row (facts from scripts/ucc_signals.py, ppp = matched SBA PPP loan). Every verdict stores its reasons.
export const UCC_RULES_VERSION = 1;

export const SECTOR = { 11: 'Agriculture', 21: 'Mining, oil & gas', 22: 'Utilities', 23: 'Construction', 31: 'Manufacturing', 32: 'Manufacturing', 33: 'Manufacturing', 42: 'Wholesale', 44: 'Retail', 45: 'Retail', 48: 'Transport & logistics', 49: 'Transport & logistics', 51: 'Media & telecom', 52: 'Finance & insurance', 53: 'Real estate', 54: 'Professional services', 55: 'Holding company', 56: 'Business services', 61: 'Education', 62: 'Healthcare', 71: 'Leisure', 72: 'Hospitality & food', 81: 'Other services', 92: 'Public administration' };
export const sectorOf = naics => SECTOR[String(naics || '').slice(0, 2)] || null;

// PPP loan ≈ 2.5 months of payroll (capped at $100K a year per person), so payroll ≈ 4.8 × loan; payroll is roughly
// 20–40% of revenue → revenue ≈ 12–24 × loan (15 used). Jobs × $180K is the cross-check. Both are 2020 numbers.
export function estRevenue(ppp) {
  if (!ppp) return null;
  const a = Number(ppp.amount) || 0, j = Number(ppp.jobs) || 0;
  if (a && j) return Math.round((a * 15 + j * 180000) / 2);
  return Math.round(a * 15 || j * 180000) || null;
}
const m = n => n >= 1e9 ? '$' + +(n / 1e9).toFixed(1) + 'B' : n >= 1e6 ? '$' + Math.round(n / 1e6) + 'M' : '$' + Math.round(n / 1e3) + 'K';
const mon = d => d ? new Date(d + 'T12:00:00Z').toLocaleString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' }) : '';

export function classifyUcc(s) {
  const f = s.facts || {}, ppp = s.ppp || null, reasons = [], est = estRevenue(ppp), code = String(s.naics || ppp?.naics || '').slice(0, 2);
  const out = (verdict, score) => ({ verdict, score: Math.max(0, Math.min(100, score)), reasons, est_revenue: est });
  if (s.on_latest === false) { reasons.push({ tone: 'cut', text: 'No live trigger in the latest scan (lien released or aged out).' }); return out('cut', 0); }
  if (!ppp) { reasons.push({ tone: 'cut', text: 'No size data (no PPP match).' }); return out('cut', 0); }
  if (code === '52' || code === '92') { reasons.push({ tone: 'cut', text: `${sectorOf(code)}: a lender or public body, not a borrower for Peter.` }); return out('cut', 0); }
  if (ppp.nonprofit || /non.?profit/i.test(ppp.business_type || '')) { reasons.push({ tone: 'cut', text: 'Non-profit.' }); return out('cut', 0); }

  let score = 0, strong = false, any = false;
  const size = `~${m(est)} revenue (est. from ${ppp.jobs ? `${ppp.jobs} jobs and ` : ''}a ${m(ppp.amount)} PPP loan in 2020–21)`;
  if (est >= 50e6) { score += 20; reasons.push({ tone: 'good', text: size }); }
  else if (est >= 20e6) { score += 12; reasons.push({ tone: 'good', text: size }); }
  else if (est >= 10e6) reasons.push({ tone: 'maybe', text: `${size}: on the small side for a private credit facility.` });
  else { reasons.push({ tone: 'cut', text: `${size}: too small.` }); return out('cut', 0); }

  if (f.mca_18m >= 2) { score += 45; strong = any = true; reasons.push({ tone: 'good', text: `Stacking: ${f.mca_18m} merchant cash advance / alternative lender filings in 18 months. Expensive short-term money one facility can replace.` }); }
  else if (f.mca_12m >= 1) { score += 30; strong = any = true; reasons.push({ tone: 'good', text: 'Took a merchant cash advance / alternative lender in the last 12 months.' }); }
  if (f.irs_24m) { score += 35; strong = any = true; reasons.push({ tone: 'good', text: `Federal tax lien (IRS) in the last 2 years${f.irs_24m > 1 ? ` (${f.irs_24m})` : ''}: cash strain.` }); }
  if (f.state_tax_24m) { score += 25; strong = any = true; reasons.push({ tone: 'good', text: 'State tax or labor-department lien in the last 2 years.' }); }
  if (f.judgment_24m) { score += 20; strong = any = true; reasons.push({ tone: 'good', text: 'Judgment lien in the last 2 years.' }); }
  if (f.factoring_24m) { score += 15; any = true; reasons.push({ tone: 'good', text: 'Selling or pledging receivables to a factor.' }); }
  if (f.fintech_18m) { score += 10; any = true; reasons.push({ tone: 'good', text: 'Platform loan (WebBank, Shopify, PayPal and similar) in the last 18 months.' }); }
  const refi = (f.refi || [])[0];
  if (refi) { score += 20; any = true; reasons.push({ tone: 'good', text: `Lien from ${refi.party} (filed ${mon(refi.filed)}) lapses ${mon(refi.lapse)} with no continuation: the facility is likely up for renewal.` }); }
  if (f.agent_active) { score += 5; reasons.push({ tone: 'good', text: 'Already borrows from an agent or asset-based lender: used to non-bank credit.' }); }
  if (s.latest_filing && Date.now() - Date.parse(s.latest_filing) < 90 * 864e5 && (strong || refi)) { score += 10; reasons.push({ tone: 'good', text: 'Newest filing in the last 90 days.' }); }
  if (f.released_24m) reasons.push({ tone: 'maybe', text: `${f.released_24m} earlier distress lien${f.released_24m > 1 ? 's' : ''} since released.` });
  if (!any) { reasons.push({ tone: 'cut', text: 'No trigger.' }); return out('cut', 0); }
  return out(est >= 20e6 && (strong || refi) ? 'target' : 'maybe', score);
}
