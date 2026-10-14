// Offline tests for supabase/functions/fund-signals/rules.js: node scripts/tests/test_fund_rules.mjs
import assert from 'node:assert/strict';
import { classify } from '../../supabase/functions/fund-signals/rules.js';

const now = Date.parse('2026-10-14');
const ago = m => new Date(now - m * 30.44 * 864e5).toISOString().slice(0, 10);
const fund = (o) => ({ list: 'fund1', fund_no: 1, company_name: 'Acme Credit Fund I, LP', state: 'NY', executives: [{ name: 'Jo Smith' }],
  offering: 40e6, check_status: 'clear', still_raising: 'D/A filed', filing_date: ago(14), amended_at: ago(2), ...o });

// Stuck: 14 months in, first close done, 30% raised -> placement target on this fund.
let r = classify(fund({ first_sale: ago(14), sold: 12e6 }), now);
assert.equal(r.stage, 'stuck'); assert.equal(r.verdict, 'target');
assert.ok(r.reasons.some(x => /pitch placement on this fund/.test(x.text)));
assert.ok(!r.reasons.some(x => /Likely Fund II|pre-launch/.test(x.text)), 'no next-fund pitch while stuck');

// Under 12 months: still the old "too early" maybe.
r = classify(fund({ first_sale: ago(8), filing_date: ago(8), sold: 12e6 }), now);
assert.equal(r.stage, 'raising'); assert.equal(r.verdict, 'maybe');

// Stuck with nothing raised: no first close -> maybe.
r = classify(fund({ first_sale: ago(14), sold: 0 }), now);
assert.equal(r.stage, 'stuck'); assert.equal(r.verdict, 'maybe');

console.log('fund rules ok');
