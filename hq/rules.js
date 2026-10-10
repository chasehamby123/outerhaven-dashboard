// Rules page (#/rules, admin): every qualification rule behind the signal tabs, in plain words, with the same
// Need / Risk / Fit / Check / Cut labels the tabs use. Written from the rules files on the server:
//   supabase/functions/bdc-signals/rules.js (BDC_RULES_VERSION 3), fund-signals/rules.js (classifyCredit v4, fund v15),
//   ucc-signals/rules.js (UCC_RULES_VERSION 4). When a rule changes there, change it here in the same commit.
import { esc } from './core.js';
import { KINDS, kindLegend } from './kinds.js';

const item = (k, text, pts = '') => `<li data-kind="${k}"><span class="rk" title="${esc(KINDS[k].tip)}"><i aria-hidden="true">${KINDS[k].sym}</i>${KINDS[k].label}</span><span>${esc(text)}${pts ? ` <span class="pts">${esc(pts)}</span>` : ''}</span></li>`;
const list = rows => `<ul class="fsWhy">${rows.map(r => item(...r)).join('')}</ul>`;
const block = (title, sub, parts) => `<section class="card"><header><div><h2>${esc(title)}</h2><p>${esc(sub)}</p></div></header><div class="body">${parts.map(([h, rows]) => `<h3>${esc(h)}</h3>${list(rows)}`).join('')}</div></section>`;

export function renderRules(el) {
  el.innerHTML = `<div class="rulesPage">
  <h1>How we qualify</h1>
  <p class="lede">What each signal list looks for, what rules a company out, and what we focus on. A company becomes a <b>Target</b> when it has at least one Need or Risk trigger and nothing that cuts it. Points add up to a 0–100 score that sorts the list.</p>
  <section class="card"><header><div><h2>Reading the labels</h2><p>Every reason on every signal card carries one of these. Colour is a second cue only.</p></div></header><div class="body">
    ${list([['need', 'A deadline or event that forces them to act now. This is why we call.'], ['risk', 'Distress. It makes them need us more, but it makes the loan harder for Peter\'s lenders to place. Read it as a warning, not a plus.'], ['fit', 'In our range: size, sector, lender type.'], ['check', 'Unclear. Look before calling.'], ['cut', 'Ruled out.']])}
    <p class="s muted" style="margin:12px 0 0">Red-green colour-blind? Turn on "Colour-blind safe" in the sidebar: good turns blue, bad turns orange.</p></div></section>

  <section class="card"><header><div><h2>What we focus on</h2><p>Private credit first (Peter's 35-year lane). Volume first: 20 credit targets worked a day.</p></div></header><div class="body">
    <ol class="focus">
      <li><b>Private credit, $20M+ loans.</b> Peter's minimum is $20M. Work the cleanest targets first: a Need trigger, few or no Risk flags.</li>
      <li><b>BDC loans and public small caps side by side.</b> 10-day split test, ~100 contacts each, then put the volume where replies, calls and retainers are higher.</li>
      <li><b>Fund signals</b> (Fund I / II managers near their next raise) for fund placement.</li>
      <li><b>UCC signals</b> are secondary: estimated sizes, mostly distress.</li>
    </ol></div></section>

  ${block('BDC loans', 'Private companies that borrow from BDCs (public lending funds that list every loan each quarter). Numbers are the lenders\' own.', [
    ['Cut', [['cut', 'BDCs hold under $10M of its debt, or over $150M (banks and placement agents cover those).'], ['cut', 'Controlled by its lender, held only by syndicated-loan buyers, or a public company (see Credit signals).'], ['cut', 'No longer in the BDCs\' latest filings (repaid, refinanced or sold).']]],
    ['Fit', [['fit', '$10–75M of debt held by BDCs: Peter\'s range. BDC debt is a floor; the full loan can be bigger.', '+15'], ['check', '$75–150M: upper end.', '+3'], ['fit', 'Lower-middle-market lenders only (Main Street, Monroe, Fidus…): owner-run or small-sponsor companies that hire advisers.', '+8']]],
    ['Need', [['need', 'Matures within 12 months.', '+25'], ['need', 'Matures in 12–18 months.', '+18'], ['need', 'Matures in 18–24 months (talks start soon).', '+7'], ['need', 'Matured after the lenders\' last report: extended, refinanced or defaulted since. Find out which.', '+15']]],
    ['Risk', [['risk', 'Past maturity, still outstanding and marked down: extended under pressure or in default.', '+22'], ['risk', 'Lenders mark it under 80¢ on the dollar: stressed.', '+25'], ['risk', 'Marked 80–90¢: the lender expects trouble.', '+15'], ['risk', 'Marked down 5+ points in one quarter.', '+8'], ['risk', 'Non-accrual: interest not being paid.', '+10'], ['risk', 'PIK: part of the interest added to the loan instead of paid.', '+5'], ['risk', 'Priced at S+7% or more.', '+3'], ['risk', 'Marked under 50¢: deep distress, likely already restructuring with advisers.', 'Maybe']]],
    ['Check', [['check', 'A big platform in the deal (Ares, Blackstone, Golub…): the PE sponsor usually runs the refinancing.', '−10'], ['check', 'Venture debt, a lender that also owns 5–25%, or non-US.', 'Maybe'], ['check', 'Past maturity but still marked near par: probably extended.', '+5']]],
  ])}

  ${block('Credit signals (public small caps)', 'Small US public companies from SEC filings: debt, cash, revenue, EBITDA, interest, and warning language in their filings.', [
    ['Cut', [['cut', 'Bank, insurer or fund. Ticker ending in Q (already in Chapter 11).'], ['cut', 'Revenue under $20M or none: nothing to lend against.'], ['cut', 'Over $750M of debt or public float over $2B: banks and bond markets cover it.']]],
    ['Fit', [['fit', '$20–200M revenue: Peter\'s sweet spot.', '+10'], ['fit', '$200M–1B revenue.', '+3'], ['fit', 'Public float $300M or less: too small for the bond market.', '+10'], ['fit', '$20–300M total debt: the size Peter\'s lenders write.', '+8']]],
    ['Need', [['need', 'Term debt due within 12 months is more than its cash: must refinance.', '+30 to +45'], ['need', 'Debt due within 12 months is over half its cash.', '+10']]],
    ['Risk', [['risk', 'Lender forbearance agreement: the current lender is losing patience.', '+30'], ['risk', 'Going-concern doubt disclosed: needs rescue or bridge money. Hardest to finance.', '+15'], ['risk', 'Net debt 7x+ EBITDA with interest covered under 2x: restructuring likely.', '+25'], ['risk', 'Negative EBITDA with $20M+ net debt: a rescue, not a refinancing.', '+10'], ['risk', 'Net debt 5x+ EBITDA: highly levered.', '+8']]],
    ['Check', [['check', 'Strong cash flow (net debt under 3x, interest covered 4x+): its bank will likely refinance.', '−15'], ['check', 'Balance sheet over 9 months old: check the latest filing first.', '−5'], ['check', 'Revenue not found, or non-US.', 'Maybe']]],
  ])}

  ${block('UCC signals', 'Private companies from free state lien filings (CT, CO, OR, FL tax liens). Size is estimated from PPP loans, so treat it as a guide.', [
    ['Cut', [['cut', 'No size data, under $10M estimated revenue, public, non-profit, or a lender / public body.'], ['cut', 'No trigger, or the lien was released.']]],
    ['Fit', [['fit', 'Estimated revenue $50M+.', '+20'], ['fit', '$30–50M.', '+12'], ['check', '$10–30M: likely under the facility floor.', 'Maybe'], ['fit', 'Already borrows from an agent or asset-based lender.', '+5']]],
    ['Need', [['need', 'A bank or asset-based facility whose lien lapses in 3–12 months (about 5 years old): refinancing window.', '+15'], ['need', 'Newest filing in the last 90 days.', '+10']]],
    ['Risk', [['risk', 'Federal (IRS) tax lien in 2 years: ranks ahead of a new lender.', '+20'], ['risk', 'State tax or labour lien.', '+15'], ['risk', 'Judgment lien.', '+12'], ['risk', '2+ named merchant cash advances in 18 months (stacking).', '+20'], ['risk', 'A merchant cash advance in 12 months.', '+12'], ['risk', '4+ liens filed through agents that hide the lender.', '+15'], ['risk', 'Factoring receivables.', '+15'], ['risk', 'Platform loan (Shopify, PayPal…).', '+10']]],
  ])}

  ${block('Fund signals', 'US funds from Form D filings: managers raising now, and Fund I / Fund II managers near their next raise. For fund placement.', [
    ['Cut', [['cut', 'All the manager\'s funds together over $500M.'], ['cut', 'Already filed its next fund under any name.']]],
    ['Fit', [['fit', 'Manager total under $150M.', '+20'], ['check', 'Manager total $150–500M.', '−15'], ['fit', 'Private credit strategy.', '+8'], ['check', 'Real estate: crowded, hardest to get paid on.', '−15'], ['fit', 'Oversubscribed (raised more than its target).', '+12'], ['fit', 'Average cheque $1M+.', '+6'], ['fit', 'Fee income enough for a retainer.', '+5'], ['check', 'Fee income under $400K a year.', '−8']]],
    ['Need', [['need', 'In the pre-launch window: 12 months before to 9 after the expected next fund.', '+15'], ['need', 'Raising now: Fund II/III, $50–250M, under 60% sold, no sales commissions.'], ['need', 'Next fund 1.3x+ bigger than the last.', '+8']]],
    ['Check', [['check', 'Still raising its current fund: too early for a next-fund pitch.', 'Maybe'], ['check', 'Closed under 60% of target: weak fund, hard to place.', 'Maybe −10']]],
  ])}
  ${kindLegend()}
  </div>`;
}
