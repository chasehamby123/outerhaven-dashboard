// Offline tests for supabase/functions/signal-contacts/parse.js: node scripts/tests/test_contacts_parse.mjs
import assert from 'node:assert/strict';
import { brand, profileFrom, websiteFrom, mergePeople, roleOf } from '../../supabase/functions/signal-contacts/parse.js';

assert.equal(brand('OmniGuide Holdings, Inc.'), 'OmniGuide');
assert.equal(brand('AMBA Buyer, Inc.'), 'AMBA');
assert.equal(brand('Global Integrated Flooring Systems Inc.'), 'Global Integrated Flooring Systems');
assert.equal(roleOf('Chief Financial Officer'), 'cfo');
assert.equal(roleOf('President & CEO'), 'ceo');

const p = profileFrom({ url: 'https://www.linkedin.com/in/robert-allen-123?trk=x', title: 'Robert Allen - Chief Financial Officer - OmniGuide | LinkedIn', description: 'Experience: OmniGuide · Location: Boston' }, 'OmniGuide Holdings, Inc.');
assert.deepEqual(p, { name: 'Robert Allen', title: 'Chief Financial Officer', role: 'cfo', linkedin: 'https://www.linkedin.com/in/robert-allen-123' });
// Wrong company: rejected
assert.equal(profileFrom({ url: 'https://www.linkedin.com/in/jane', title: 'Jane Doe - CFO - Acme Corp | LinkedIn', description: 'Acme' }, 'OmniGuide Holdings'), null);
// Not a finance / top role: rejected
assert.equal(profileFrom({ url: 'https://www.linkedin.com/in/joe', title: 'Joe Bloggs - Sales Manager - OmniGuide | LinkedIn', description: 'OmniGuide sales' }, 'OmniGuide'), null);
// Company page, not a person: rejected
assert.equal(profileFrom({ url: 'https://www.linkedin.com/company/omniguide', title: 'OmniGuide | LinkedIn', description: '' }, 'OmniGuide'), null);
// Credentials stripped from the name
assert.equal(profileFrom({ url: 'https://linkedin.com/in/a', title: 'Mary Smith, CPA – VP Finance – Marquis Software | LinkedIn', description: 'Marquis Software' }, 'Marquis Software Solutions Inc').name, 'Mary Smith');

assert.deepEqual(websiteFrom([{ url: 'https://www.zoominfo.com/c/omniguide/1' }, { url: 'https://www.omni-guide.com/about' }], 'OmniGuide Holdings, Inc.'), { website: 'https://omni-guide.com', domain: 'omni-guide.com' });
assert.equal(websiteFrom([{ url: 'https://www.bloomberg.com/x' }], 'OmniGuide'), null);

const m = mergePeople([{ name: 'Robert Allen', role: 'cfo', status: 'confirmed', email: 'r@x.com' }, { name: 'Old CEO', role: 'ceo', status: 'wrong' }],
  [{ name: 'Robert Allen', role: 'cfo', linkedin: 'https://linkedin.com/in/ra', title: 'CFO' }, { name: 'New CEO', role: 'ceo' }]);
assert.equal(m[0].name, 'Robert Allen'); assert.equal(m[0].email, 'r@x.com'); assert.equal(m[0].linkedin, 'https://linkedin.com/in/ra');
assert.equal(m[m.length - 1].name, 'Old CEO');
console.log('contacts parse: all tests passed');
