// Offline tests for supabase/functions/fund-signals/rules.js: node scripts/tests/test_fund_rules.mjs
import assert from 'node:assert/strict';
import { classify } from '../../supabase/functions/fund-signals/rules.js';

const now = Date.parse('2026-10-14');
const ago = m => new Date(now - m * 30.44 * 864e5).toISOString().slice(0, 10);
const fund = (o) => ({ list: 'fund1', fund_no: 1, company_name: 'Acme Credit Fund I, LP', state: 'NY', executives: [{ name: 'Jo Smith' }],
  offering: 40e6, check_status: 'clear', still_raising: 'D/A filed', filing_date: ago(14), amended_at: ago(2), ...o });

// Fund II stuck: 14 months in, first close done, 30% raised -> placement target on this fund.
let r = classify(fund({ fund_no: 2, company_name: 'Acme Credit Fund II, LP', first_sale: ago(14), sold: 12e6 }), now);
assert.equal(r.stage, 'stuck'); assert.equal(r.verdict, 'target');
assert.ok(r.reasons.some(x => /pitch placement on this fund/.test(x.text)));
assert.ok(!r.reasons.some(x => /Likely Fund II|pre-launch/.test(x.text)), 'no next-fund pitch while stuck');

// Fund I stuck: no fund track record -> maybe until attributable deals are confirmed.
r = classify(fund({ first_sale: ago(14), sold: 12e6 }), now);
assert.equal(r.stage, 'stuck'); assert.equal(r.verdict, 'maybe');

// Under 12 months: still the old "too early" maybe.
r = classify(fund({ first_sale: ago(8), filing_date: ago(8), sold: 12e6 }), now);
assert.equal(r.stage, 'raising'); assert.equal(r.verdict, 'maybe');

// Stuck with nothing raised: no first close -> maybe.
r = classify(fund({ first_sale: ago(14), sold: 0 }), now);
assert.equal(r.stage, 'stuck'); assert.equal(r.verdict, 'maybe');

// Live raise, stuck, weak Fund I and little re-up (Future Labs Capital Fund II, 19 Oct 2026) -> maybe, not target.
const fl = { list: 'live', fund_no: 2, company_name: 'Future Labs Capital Fund II, L.P.', state: 'NY', executives: [{ name: 'Jo Smith' }],
  offering: 65e6, sold: 6.5e6, first_sale: ago(19), filing_date: ago(1), investors: 25 };
r = classify({ ...fl, history: [{ name: 'Future Labs Capital Fund I, L.P.', fund_no: 1, first: ago(64), sold: 22.6e6, offering: 65e6 }] }, now);
assert.equal(r.verdict, 'maybe'); assert.ok(r.reasons.some(x => /re-upping/.test(x.text))); assert.ok(r.reasons.some(x => /35% of its/.test(x.text)));
// Same raise without history: unchanged (target).
assert.equal(classify(fl, now).verdict, 'target');
// Investors coming back: Fund II already past Fund I.
r = classify({ ...fl, sold: 25e6, history: [{ name: 'Future Labs Capital Fund I, L.P.', fund_no: 1, first: ago(64), sold: 22.6e6, offering: 25e6 }] }, now);
assert.ok(r.reasons.some(x => /coming back/.test(x.text)));

console.log('fund rules ok');
