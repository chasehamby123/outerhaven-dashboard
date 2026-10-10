// Offline tests for supabase/functions/signal-contacts/parse.js: node scripts/tests/test_contacts_parse.mjs
import assert from 'node:assert/strict';
import { brand, profileFrom, websiteFrom, mergePeople, roleOf, sameCompany } from '../../supabase/functions/signal-contacts/parse.js';

assert.equal(brand('OmniGuide Holdings, Inc.'), 'OmniGuide');
assert.equal(brand('AMBA Buyer, Inc.'), 'AMBA');
assert.equal(brand('Global Integrated Flooring Systems Inc.'), 'Global Integrated Flooring Systems');
assert.equal(roleOf('Chief Financial Officer'), 'cfo');
assert.equal(roleOf('President & CEO'), 'ceo');

const p = profileFrom({ url: 'https://www.linkedin.com/in/robert-allen-123?trk=x', title: 'Robert Allen - Chief Financial Officer - OmniGuide | LinkedIn', description: 'Experience: OmniGuide · Location: Boston' }, 'OmniGuide Holdings, Inc.');
assert.deepEqual(p, { name: 'Robert Allen', title: 'Chief Financial Officer', role: 'cfo', employer: 'OmniGuide', linkedin: 'https://www.linkedin.com/in/robert-allen-123' });
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
// Real false positives from the first live run (10 Oct 2026)
assert.equal(profileFrom({ url: 'https://www.linkedin.com/in/em', title: 'Essence Montgomery - Finance Manager - Acme | LinkedIn', description: 'Acme' }, 'Essence Communications Inc.'), null);
assert.equal(profileFrom({ url: 'https://www.linkedin.com/in/fg', title: 'Fidel Gbesso - Global CFO - Contoso | LinkedIn', description: 'Global CFO at Contoso' }, 'Global Integrated Flooring Systems Inc.'), null);
assert.equal(profileFrom({ url: 'https://www.linkedin.com/in/co', title: 'Chris Ortega - Fractional CFO for SMBs ($1M–$50M) | LinkedIn', description: 'ORL' }, 'ORL Holdco, Inc.'), null);
assert.equal(profileFrom({ url: 'https://www.linkedin.com/in/jw', title: 'John Watson - Chief Financial Officer - Global Integrated Flooring Systems | LinkedIn', description: '' }, 'Global Integrated Flooring Systems Inc.').name, 'John Watson');
assert.equal(websiteFrom([{ url: 'https://www.orl.bc.ca/' }], 'ORL Holdco, Inc.'), null);
assert.ok(profileFrom({ url: 'https://linkedin.com/in/cw', title: 'Caroline Wanga - President/CEO✨Mela-Preneur✨Thought Innovator - Essence Communications | LinkedIn', description: '' }, 'Essence Communications Inc.').title.length <= 60);
assert.equal(profileFrom({ url: 'https://www.linkedin.com/in/em2', title: 'Essence Montgomery - Finance Manager | LinkedIn', description: 'Essence Montgomery. Finance Manager at Contoso.' }, 'Essence Communications Inc.'), null);

// Real misses from the 10 Oct 2026 BDC lookups (Brave results), all must be rejected:
const R = (title, description = '') => ({ url: 'https://www.linkedin.com/in/x', title, description });
assert.equal(profileFrom(R('Jack C. - Vice President at Colonnade Advisors LLC', 'Experience: Colonnade Advisors LLC'), 'Colonnade Parent, Inc.'), null); // other firm + VP
assert.equal(profileFrom(R('Derek Spies - Colonnade Advisors LLC | LinkedIn', 'Experience: Colonnade Advisors LLC'), 'Colonnade Parent, Inc.'), null);
assert.equal(profileFrom(R('Jessica MacDonald - Venbrook | LinkedIn', 'We’re excited to welcome Kenneth Ward as Chief Financial Officer'), 'Venbrook Buyer, LLC'), null); // role is someone else's
assert.equal(profileFrom(R('Rosie Wang - Corporate Travel Management (CTM) Group | LinkedIn', 'CFO (Chief Financial Officer) Owns financial strategy'), 'CTM Group, Inc.'), null);
assert.equal(profileFrom(R('Kenneth Kelly - Chairman & CEO at First Independence ...'), 'Independence Buyer, Inc.'), null);
assert.equal(profileFrom(R('Martha Brown - CFO at Independence Bank of Georgia'), 'Independence Buyer, Inc.'), null);
assert.equal(profileFrom(R('Brian McCarthy - Founder and CEO of Rising Tide Consulting'), 'Rising Tide Holdings, Inc.'), null);
assert.equal(profileFrom(R('Danny Dang - Chief Financial Officer at Thisbowl Fishbowl'), 'Fishbowl Solutions, LLC'), null);
assert.equal(profileFrom(R('John David King - Former CEO at Fishbowl'), 'Fishbowl Solutions, LLC'), null);
assert.equal(profileFrom(R('Ed Fishback - CEO at Marquis Software Develoment, Inc.'), 'Marquis Software Solutions Inc'), null);
assert.equal(profileFrom(R('Gina Cocking - Founder & CEO, Dark Sky Data', 'Colonnade'), 'Colonnade Parent, Inc.'), null);
// ...and these must still match:
assert.equal(profileFrom(R('Sylvia Byrd - Chief Financial Officer | LinkedIn', 'Experience: OmniGuide · Location: Boston'), 'OmniGuide Holdings, Inc.').role, 'cfo');
assert.equal(profileFrom(R('Patrick Hooper - President & CEO at Trimlite LLC'), 'Trimlite Buyer LLC').role, 'ceo');
assert.equal(profileFrom(R('Leslie Wachsman - Chief Financial Officer - SCA Buyer'), 'SCA Buyer, LLC').title, 'Chief Financial Officer');
assert.equal(profileFrom(R('Kostas Antonetsis - CHIEF FINANCIAL OFFICER - Essence Communications'), 'Essence Communications Inc.').role, 'cfo');
assert.equal(profileFrom(R('Ana Ruiz - VP Finance at Marquis Software'), 'Marquis Software Solutions Inc').role, 'cfo');
assert.equal(profileFrom(R('Steve Fogg - Chief Financial Officer - Marquis Companies'), 'Marquis Software Solutions Inc'), null); // senior care, not software
assert.equal(profileFrom(R('Caitriona Circosta - Chief Financial Officer at Essence ...'), 'Essence Communications Inc.').role, 'cfo');
// SEC officer searched by name: a title without a role is fine
assert.equal(profileFrom(R('Jane Roe - Hydrofarm | LinkedIn'), 'HYDROFARM HOLDINGS GROUP, INC.', true).name, 'Jane Roe');
assert.equal(sameCompany('Venbrook Companies', 'Venbrook Buyer, LLC'), true);
assert.equal(sameCompany('Venbrook Insurance ...', 'Venbrook Buyer, LLC'), false); // extra word = can't tell, skip
console.log('contacts parse: all tests passed');
