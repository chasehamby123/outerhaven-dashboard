// Pure helpers for signal-contacts (tested offline: node scripts/tests/test_contacts_parse.mjs).

// Company name → the brand people actually use ("OmniGuide Holdings, Inc." → "OmniGuide").
export const brand = n => String(n || '')
  .replace(/\s*\(.*?\)\s*/g, ' ')
  .replace(/,?\s+(incorporated|inc|corp|corporation|co|ltd|llc|l\.l\.c|plc|lp|l\.p|holdings?|group|buyer|midco|bidco|topco|holdco|parent|intermediate|acquisition|borrower|merger sub|us|usa)\.?\b/gi, ' ')
  .replace(/[,.]+$/, '').replace(/\s+/g, ' ').trim();

const ROLE = [
  ['cfo', /\b(cfo|chief financial officer|vp,? finance|vice president,? finance|head of finance|finance director|treasurer|controller)\b/i],
  ['ceo', /\b(ceo|chief executive officer|(?<!vice[ -])president|founder|co-founder|owner|managing director)\b/i],
];
export const roleOf = t => (ROLE.find(([, re]) => re.test(t || '')) || ['other'])[0];

// Words that don't make a company a different company ("Venbrook Companies" = Venbrook, "Acme Holdings, Inc." = Acme).
const FILLER = new Set('inc incorporated llc l.l.c ltd lp llp plc co corp corporation company companies group holdings holding the and of us usa america americas international global services solutions systems technologies technology industries enterprises brands products buyer midco bidco topco holdco parent intermediate acquisition borrower'.split(' '));
const words = s => String(s || '').toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9&]+/g, ' ').trim().split(' ').filter(Boolean);
const distinct = s => words(s).filter(w => !FILLER.has(w) && w !== '&');

// Does the employer named on a LinkedIn profile mean this company? Every distinctive word of the brand must be in it, and it
// must not add distinctive words the company's own name doesn't have ("Colonnade Advisors" is not "Colonnade Parent",
// "First Independence Bank" is not "Independence Buyer", "Corporate Travel Management (CTM) Group" is not "CTM Group").
export function sameCompany(employer, company) {
  const raw = String(employer || '').trim();
  const cut = /(\.\.\.|…)$/.test(raw), glued = /\w(\.\.\.|…)$/.test(raw);  // "Essence ..." vs "Essen..." (last word cut off)
  let e = distinct(raw.replace(/\s*(\.\.\.|…)$/, '')); if (glued) e = e.slice(0, -1);
  const own = new Set(distinct(company)), b = distinct(brand(company));
  if (!b.length || !e.length) return false;
  // No words the company's own name doesn't have ("Marquis Software Development" is not "Marquis Software Solutions"), and every
  // distinctive brand word ("Marquis Companies" is not "Marquis Software"); a title cut off by LinkedIn ("CFO at Essence ...")
  // only has to start the same way.
  if (!e.every(w => own.has(w))) return false;
  return cut ? e.every((w, i) => b[i] === w || own.has(w)) && e[0] === b[0] : b.every(w => e.includes(w));
}

// The employer a LinkedIn search result names: "Name - CFO at Acme", "Name - CFO - Acme", "Name - Acme", or "Experience: Acme ·".
function employerOf(parts, desc) {
  for (const p of parts.slice(1)) {
    const at = p.match(/\b(?:at|@)\s+(.+)$/i); if (at) return at[1].trim();
    if (roleOf(p) === 'other') return p.trim();
  }
  const ex = desc.match(/Experience:\s*([^·|]+)/i); return ex ? ex[1].trim() : '';
}

// One Brave web result for a LinkedIn profile → { name, title, linkedin } if it belongs to this company and a finance / top role.
// LinkedIn titles look like "Robert Allen - Chief Financial Officer - OmniGuide | LinkedIn" or "Robert Allen – OmniGuide | LinkedIn".
// The role must be in the person's own title: snippets are often posts about someone else ("We welcome Kenneth Ward as CFO").
// named = true for SEC officers searched by name (the role is already known from the filing, so a title without one is fine).
export function profileFrom(r, company, named = false) {
  const url = String(r?.url || '');
  if (!/^https:\/\/([a-z]{2,3}\.)?linkedin\.com\/in\//i.test(url)) return null;
  const title = String(r.title || '').replace(/\s*\|\s*LinkedIn\s*$/i, '').replace(/[^\x20-\x7EÀ-ɏ–—’]+/g, ' ').replace(/\s+/g, ' ').trim();
  const desc = String(r.description || '').replace(/<[^>]+>/g, '').replace(/&#x27;|&#39;/g, "'");
  const parts = title.split(/\s+[-–—|]\s+/);
  const rest = parts.slice(1).join(' ');
  if (/\b(former|ex-|previously|retired|fractional|freelance|consultant|outsourced|part-time cfo|cfo services|advisor to|for smbs?)\b/i.test(rest)) return null;
  const emp = employerOf(parts, desc), employer = emp.replace(/\s*(\.\.\.|…)$/, '').trim();
  if (!sameCompany(emp, company)) return null;
  const name = (parts[0] || '').replace(/,.*$/, '').replace(/\b(MBA|CPA|CFA|PhD|Jr\.?|Sr\.?)\b/g, '').replace(/\s+/g, ' ').trim();
  if (!/^[A-Z][\p{L}'.-]+(\s+[A-Z][\p{L}'.-]*){1,3}$/u.test(name)) return null;
  const roleSeg = parts.slice(1).find(p => roleOf(p) !== 'other');
  const role = roleSeg ? roleOf(roleSeg) : named ? 'named' : 'other';
  if (role === 'other') return null;
  const raw = roleSeg ? roleSeg.replace(/\s+(?:at|@)\s+.+$/i, '').trim() : '';
  const jobTitle = raw.length > 60 ? raw.slice(0, 58).trim() + '…' : raw;
  return { name, title: jobTitle, role, employer: employer.slice(0, 60), linkedin: url.split('?')[0] };
}

// Directory / data sites that are never the company's own website.
const NOT_SITE = /(linkedin|zoominfo|bloomberg|crunchbase|dnb|pitchbook|rocketreach|apollo\.io|signalhire|lusha|facebook|instagram|twitter|x\.com|youtube|wikipedia|glassdoor|indeed|yelp|bbb\.org|mapquest|opencorporates|sec\.gov|prnewswire|businesswire|globenewswire|craft\.co|owler|cbinsights|manta|buzzfile|yahoo|reuters|wsj|forbes|google|amazon|bizapedia|corporationwiki|govtribe|sam\.gov|privco|growjo|leadiq|contactout)\./i;
export function websiteFrom(results, company) {
  const words = brand(company).toLowerCase().split(' ').filter(w => w.length >= 3);
  for (const r of results || []) {
    let host = '';
    try { host = new URL(r.url).hostname.replace(/^www\./, ''); } catch { continue; }
    if (NOT_SITE.test(host) || !/\.(com|net|io|co|us|org|biz|ai|health|tech)$/.test(host)) continue;
    const flat = host.replace(/\.[a-z]+$/, '').replace(/[^a-z0-9]/g, ''), all = words.join('').replace(/[^a-z0-9]/g, '');
    if ((all.length >= 4 && flat.includes(all)) || words.some(w => w.length >= 5 && flat.includes(w.replace(/[^a-z0-9]/g, '')))) return { website: `https://${host}`, domain: host };
  }
  return null;
}

// Merge newly found people into the stored list: same person (name match) keeps what humans set (status, email, linkedin).
const nk = n => String(n || '').toLowerCase().replace(/[^a-z]/g, '');
export function mergePeople(old, found) {
  const out = [...(old || [])];
  for (const p of found) {
    const i = out.findIndex(o => nk(o.name) === nk(p.name));
    if (i < 0) out.push(p);
    else out[i] = { ...p, ...Object.fromEntries(Object.entries(out[i]).filter(([, v]) => v != null && v !== '')) };
  }
  const rank = p => (p.status === 'wrong' ? 9 : 0) + (p.status === 'confirmed' ? -2 : 0) + (p.role === 'cfo' ? 0 : p.role === 'ceo' ? 1 : 2) + (p.source === 'sec' ? -0.5 : 0);
  return out.sort((a, b) => rank(a) - rank(b)).slice(0, 6);
}
