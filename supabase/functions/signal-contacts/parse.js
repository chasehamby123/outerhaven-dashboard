// Pure helpers for signal-contacts (tested offline: node scripts/tests/test_contacts_parse.mjs).

// Company name → the brand people actually use ("OmniGuide Holdings, Inc." → "OmniGuide").
export const brand = n => String(n || '')
  .replace(/\s*\(.*?\)\s*/g, ' ')
  .replace(/,?\s+(incorporated|inc|corp|corporation|co|ltd|llc|l\.l\.c|plc|lp|l\.p|holdings?|group|buyer|midco|bidco|topco|holdco|parent|intermediate|acquisition|borrower|merger sub|us|usa)\.?\b/gi, ' ')
  .replace(/[,.]+$/, '').replace(/\s+/g, ' ').trim();

const ROLE = [
  ['cfo', /\b(cfo|chief financial officer|vp,? finance|vice president,? finance|head of finance|finance director|treasurer|controller)\b/i],
  ['ceo', /\b(ceo|chief executive officer|president|founder|co-founder|owner|managing director)\b/i],
];
export const roleOf = t => (ROLE.find(([, re]) => re.test(t || '')) || ['other'])[0];

// One Brave web result for a LinkedIn profile → { name, title, linkedin } if it belongs to this company and a finance / top role.
// LinkedIn titles look like "Robert Allen - Chief Financial Officer - OmniGuide | LinkedIn" or "Robert Allen – OmniGuide | LinkedIn".
export function profileFrom(r, company) {
  const url = String(r?.url || '');
  if (!/^https:\/\/([a-z]{2,3}\.)?linkedin\.com\/in\//i.test(url)) return null;
  const title = String(r.title || '').replace(/\s*\|\s*LinkedIn\s*$/i, '').trim();
  const desc = String(r.description || '').replace(/<[^>]+>/g, '');
  const b = brand(company).toLowerCase();
  const first = b.split(' ')[0];
  const hay = (title + ' ' + desc).toLowerCase();
  if (!b || !(hay.includes(b) || (first.length >= 5 && hay.includes(first)))) return null;
  const parts = title.split(/\s+[-–—|]\s+/);
  const name = (parts[0] || '').replace(/,.*$/, '').replace(/\b(MBA|CPA|CFA|PhD|Jr\.?|Sr\.?)\b/g, '').replace(/\s+/g, ' ').trim();
  if (!/^[A-Z][\p{L}'.-]+(\s+[A-Z][\p{L}'.-]*){1,3}$/u.test(name)) return null;
  const role = roleOf(parts.slice(1).join(' ') + ' ' + desc.slice(0, 160));
  if (role === 'other') return null;
  const jobTitle = (parts.slice(1).find(p => roleOf(p) !== 'other') || (role === 'cfo' ? 'Finance' : 'Executive')).trim();
  return { name, title: jobTitle, role, linkedin: url.split('?')[0] };
}

// Directory / data sites that are never the company's own website.
const NOT_SITE = /(linkedin|zoominfo|bloomberg|crunchbase|dnb|pitchbook|rocketreach|apollo\.io|signalhire|lusha|facebook|instagram|twitter|x\.com|youtube|wikipedia|glassdoor|indeed|yelp|bbb\.org|mapquest|opencorporates|sec\.gov|prnewswire|businesswire|globenewswire|craft\.co|owler|cbinsights|manta|buzzfile|yahoo|reuters|wsj|forbes|google|amazon|bizapedia|corporationwiki|govtribe|sam\.gov|privco|growjo|leadiq|contactout)\./i;
export function websiteFrom(results, company) {
  const words = brand(company).toLowerCase().split(' ').filter(w => w.length >= 3);
  for (const r of results || []) {
    let host = '';
    try { host = new URL(r.url).hostname.replace(/^www\./, ''); } catch { continue; }
    if (NOT_SITE.test(host)) continue;
    const flat = host.replace(/[^a-z0-9]/g, '');
    if (words.some(w => flat.includes(w.replace(/[^a-z0-9]/g, '')))) return { website: `https://${host}`, domain: host };
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
