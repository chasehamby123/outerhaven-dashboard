// Deterministic insight engine. Pure functions only: no DOM, no network, so it can be tested in Node.
// Every output carries its sample size so the UI never presents noise as a finding.

// Factors, split into what the creative is, what the caption says, and when it went out.
// Values are filled by hand (Tag) or by the weekly Claude analysis (ai_tags); hand tags win.
export const DIMENSIONS = {
  format: { label: 'Format', group: 'creative', values: ['Text only', 'Single image', 'Carousel / document', 'Video', 'Article', 'Poll', 'Infographic'] },
  creative: { label: 'Visual', group: 'creative', values: ['Person photo', 'Chart / data', 'Quote card', 'Screenshot', 'Map', 'Branded graphic', 'Meme', 'None'] },
  face: { label: 'Face in creative', group: 'creative', values: ['Yes', 'No'] },
  textOnImage: { label: 'Text on image', group: 'creative', values: ['None', 'Headline only', 'Text-heavy'] },
  hook: { label: 'Hook', group: 'caption', values: ['Contrarian', 'Data / stat', 'Story', 'Question', 'Pain point', 'List / how-to', 'Timely / news', 'Social proof'] },
  hookNumber: { label: 'Number in hook', group: 'caption', values: ['Yes', 'No'] },
  length: { label: 'Caption length', group: 'caption', values: ['Short', 'Medium', 'Long'] },
  cta: { label: 'CTA', group: 'caption', values: ['Comment keyword', 'DM me', 'Link', 'Question', 'None'] },
  leadMagnet: { label: 'Lead magnet', group: 'caption', values: ['Yes', 'No'] },
  topic: { label: 'Topic', group: 'caption', values: ['Family offices', 'Capital raising', 'M&A', 'Deal flow', 'Market commentary', 'Personal / story'] },
  timeslot: { label: 'Post time', group: 'timing', values: ['Morning', 'Midday', 'Evening'] },
};
export const GROUPS = { creative: 'Creative', caption: 'Caption', timing: 'Timing' };

export const METRIC_DEFS = {
  engagement: { label: 'Engagement', get: p => p.m.comments + p.m.reactions + p.m.reposts },
  comments: { label: 'Comments (audience)', get: p => p.m.comments },
  commentsAll: { label: 'Comments incl. team', get: p => p.m.commentsAll },
  reactions: { label: 'Reactions', get: p => p.m.reactions },
  impressions: { label: 'Impressions', get: p => p.m.impressions },
  engagementRate: { label: 'Engagement rate', rate: true, get: p => p.m.impressions ? (p.m.comments + p.m.reactions + p.m.saves + p.m.sends + p.m.reposts) / p.m.impressions : null },
  meetings: { label: 'Meetings', get: p => p.meetings },
};

const med = a => { const s = a.filter(Number.isFinite).sort((x, y) => x - y); if (!s.length) return null; const i = s.length >> 1; return s.length % 2 ? s[i] : (s[i - 1] + s[i]) / 2; };
const conf = n => n >= 8 ? 'solid' : n >= 4 ? 'early' : 'anecdote';
export const confidenceLabel = { solid: 'Solid sample', early: 'Early signal', anecdote: 'Anecdotal' };
const minN = (...ns) => Math.min(...ns);

// Normalise a raw daily_ops_posts row (+ accounts + meetings) into the engine's shape.
const FORMAT_FROM_TYPE = { text: 'Text only', image: 'Single image', document: 'Carousel / document', video: 'Video', article: 'Article' };
export function toPost(row, accountName, meetingCount = 0, resharedBy = []) {
  const ai = row.ai_tags || {}, manual = row.tags || {}, m = row.metrics || {};
  // Hand tags win; Claude's weekly tags fill the gaps.
  const t = { ...Object.fromEntries(Object.keys(DIMENSIONS).filter(k => ai[k]).map(k => [k, ai[k]])), ...Object.fromEntries(Object.entries(manual).filter(([, v]) => v !== '' && v != null)) };
  const has = v => v !== '' && v != null && Number.isFinite(Number(v));
  const pick = (k, fallback) => has(m[k]) ? Number(m[k]) : Number(fallback || 0);
  const posted = row.posted_at ? new Date(row.posted_at) : null;
  // Post time in Malaysia (GMT+8), where the team works.
  const hour = posted ? (posted.getUTCHours() + 8) % 24 : null;
  const boosted = [...new Set([...(Array.isArray(t.boosted_by) ? t.boosted_by : []), ...resharedBy])];
  return {
    id: row.id, name: row.post_name || row.post_key || 'LinkedIn post', url: row.linkedin_post_url || null,
    account: accountName || '—', date: row.posted_at || row.work_date || null, text: row.post_text || '',
    autoFormat: !manual.format && !ai.format && !!FORMAT_FROM_TYPE[row.content_type], aiTagged: !!row.ai_tagged_at, aiNotes: ai.notes || '',
    tags: { ...t, format: t.format || FORMAT_FROM_TYPE[row.content_type] || undefined, timeslot: t.timeslot || (hour == null ? undefined : hour < 11 ? 'Morning' : hour < 16 ? 'Midday' : 'Evening') },
    boostedBy: boosted, resharedBy, group: t.creative_group || null,
    // Comments: our own accounts' comments (engagement pod) are excluded once the thread has been scraped.
    // Until then only LinkedIn's total is known, which includes them (commentsExact = false).
    m: { impressions: pick('impressions'), comments: pick('comments', row.external_comment_count ?? row.commenter_count), commentsAll: Number(row.commenter_count || 0), teamComments: Number(row.team_comment_count || 0), reactions: pick('reactions', row.reaction_count), saves: pick('saves'), sends: pick('sends'), reposts: pick('reposts', row.repost_count) },
    commentsExact: has(m.comments) || row.external_comment_count != null, unreplied: Number(row.unreplied_count || 0),
    meetings: meetingCount,
  };
}

export function breakdown(posts, dim, metric) {
  const get = METRIC_DEFS[metric].get, base = med(posts.map(get));
  const groups = {};
  for (const p of posts) { const v = p.tags[dim]; if (!v) continue; (groups[v] ||= []).push(get(p)); }
  return Object.entries(groups).map(([value, xs]) => { const md = med(xs); return { value, n: xs.filter(Number.isFinite).length, median: md, lift: base && md != null ? md / base - 1 : null }; })
    .filter(g => g.n > 0).sort((a, b) => (b.median ?? -1) - (a.median ?? -1));
}

export function accountBreakdown(posts, metric) {
  const get = METRIC_DEFS[metric].get, g = {};
  for (const p of posts) (g[p.account] ||= []).push(get(p));
  return Object.entries(g).map(([account, xs]) => ({ account, n: xs.filter(Number.isFinite).length, median: med(xs) })).sort((a, b) => (b.median ?? -1) - (a.median ?? -1));
}

// Same creative + copy posted from different accounts: isolates the account/audience effect.
export function sameCreative(posts, metric) {
  const get = METRIC_DEFS[metric].get, g = {};
  for (const p of posts) if (p.group) (g[p.group] ||= []).push(p);
  return Object.entries(g).map(([group, ps]) => ({ group, posts: ps.map(p => ({ account: p.account, value: get(p), id: p.id, boostedBy: p.boostedBy })).sort((a, b) => (b.value ?? -1) - (a.value ?? -1)) }))
    .filter(x => new Set(x.posts.map(p => p.account)).size >= 2);
}

// For every account that boosts other people's posts: median with vs without that boost.
export function boostEffect(posts, metric) {
  const get = METRIC_DEFS[metric].get, boosters = [...new Set(posts.flatMap(p => p.boostedBy))];
  return boosters.map(b => {
    const w = posts.filter(p => p.boostedBy.includes(b)).map(get), wo = posts.filter(p => !p.boostedBy.includes(b) && p.account !== b).map(get);
    const mw = med(w), mwo = med(wo);
    return { booster: b, nWith: w.length, nWithout: wo.length, medWith: mw, medWithout: mwo, lift: mw != null && mwo ? mw / mwo - 1 : null };
  }).sort((a, b) => (b.lift ?? -9) - (a.lift ?? -9));
}

export function commentsNoMeetings(posts) {
  if (!posts.some(p => p.meetings)) return []; // meaningless until meetings are linked to posts
  const cs = posts.map(p => p.m.comments).sort((a, b) => a - b);
  if (cs.length < 3) return [];
  const p75 = cs[Math.floor(cs.length * 0.75)];
  return posts.filter(p => p.m.comments >= Math.max(p75, 5) && !p.meetings).sort((a, b) => b.m.comments - a.m.comments);
}

// Two-proportion z-test. Returns probability-ish confidence that B differs from A.
export function zTest(x1, n1, x2, n2) {
  if (!n1 || !n2) return null; const p1 = x1 / n1, p2 = x2 / n2, p = (x1 + x2) / (n1 + n2), se = Math.sqrt(p * (1 - p) * (1 / n1 + 1 / n2));
  if (!se) return null; const z = (p2 - p1) / se;
  const cdf = z => { const t = 1 / (1 + 0.2316419 * Math.abs(z)), d = 0.3989423 * Math.exp(-z * z / 2), pr = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274)))); return z > 0 ? 1 - pr : pr; };
  return { z, p: 2 * (1 - cdf(Math.abs(z))) };
}

// Verdict for an experiment: uses rates when impressions exist, raw counts otherwise.
export function verdict(exp) {
  const metric = exp.primary_metric || 'comments';
  const a = exp.metrics_a || {}, b = exp.metrics_b || {};
  const xa = Number(a[metric] || 0), xb = Number(b[metric] || 0);
  // Denominator: impressions for content tests, messages sent for DM/outreach tests.
  const base = a.impressions && b.impressions ? 'impressions' : a.sent && b.sent ? 'sent' : null;
  const na = base ? Number(a[base]) : 0, nb = base ? Number(b[base]) : 0;
  const manual = exp.winner ? ` · winner set to ${exp.winner}` : '';
  if (!xa && !xb) return exp.winner ? { state: 'win', winner: exp.winner, text: `Winner: ${exp.winner} (set manually)` } : { state: 'none', text: 'No results yet' };
  if (base && metric !== base) {
    const t = zTest(xa, na, xb, nb), ra = xa / na, rb = xb / nb, lead = rb >= ra ? 'B' : 'A', lift = Math.min(ra, rb) ? Math.max(ra, rb) / Math.min(ra, rb) - 1 : null;
    const per = base === 'sent' ? 'per message sent' : 'per impression';
    const liftTxt = lift == null ? '' : ` (+${Math.round(lift * 100)}% ${metric} ${per})`;
    if (t && t.p < 0.05) return { state: 'win', winner: lead, text: `${lead} wins${liftTxt} · 95% confidence${exp.winner && exp.winner !== lead ? manual : ''}` };
    if (t && t.p < 0.2) return { state: 'lean', winner: lead, text: `${lead} leading${liftTxt} · not yet significant${manual}` };
    return { state: 'flat', text: `No real difference yet${manual}` };
  }
  if (exp.winner) return { state: 'win', winner: exp.winner, text: `Winner: ${exp.winner} (set manually) · add ${metric === 'replies' || metric === 'dms' ? 'messages sent' : 'impressions'} to confirm` };
  const lead = xb >= xa ? 'B' : 'A';
  if (xa === xb) return { state: 'flat', text: 'Tied' };
  return { state: 'lean', winner: lead, text: `${lead} ahead on raw ${metric} (${Math.max(xa, xb)} vs ${Math.min(xa, xb)}) · add ${metric === 'replies' || metric === 'dms' ? 'messages sent' : 'impressions'} for a real verdict` };
}

// Suggested A/B tests, ranked by how much they could teach us.
export function suggestTests(posts, experiments = [], metric = 'comments') {
  const running = new Set(experiments.filter(e => e.status !== 'complete').map(e => String(e.variable || '').toLowerCase()));
  const out = [];
  for (const [dim, def] of Object.entries(DIMENSIONS)) {
    const b = breakdown(posts, dim, metric).filter(g => g.median != null);
    if (b.length >= 2) {
      const [top, next] = b;
      if (top.median > 0 && (next.median === 0 || top.median / Math.max(next.median, 1e-9) >= 1.25)) {
        const liftTxt = next.median ? `${Math.round((top.median / next.median - 1) * 100)}% more` : 'more';
        out.push({ score: 3 + (running.has(def.label.toLowerCase()) ? -5 : 0) + (minN(top.n, next.n) < 4 ? 1 : 0), dim: def.label,
          title: `${def.label}: “${top.value}” vs “${next.value}”`,
          why: `“${top.value}” posts get ${liftTxt} ${METRIC_DEFS[metric].label.toLowerCase()} (median) than “${next.value}”, on ${top.n} vs ${next.n} posts.`,
          how: `Same topic, same account, same time slot. Change only the ${def.label.toLowerCase()}.`, confidence: conf(minN(top.n, next.n)) });
      }
    }
    const tried = new Set(b.map(g => g.value)), untried = def.values.filter(v => !tried.has(v));
    if (b.length && untried.length && ['format', 'hook', 'creative'].includes(dim) && !out.some(o => o.untested)) {
      out.push({ score: 1, untested: true, dim: def.label, title: `Try an untested ${def.label.toLowerCase()}: “${untried[0]}”`,
        why: `No logged posts use “${untried[0]}” yet, so there is no evidence either way.`, how: `Run it against your current best (“${b[0].value}”) on the same account.`, confidence: 'anecdote' });
    }
  }
  const boosts = boostEffect(posts, metric).filter(be => be.lift != null && be.lift >= 0.25 && be.nWith >= 2);
  if (boosts.length) {
    const top = boosts.slice(0, 3), b = top[0];
    out.push({ score: 4, dim: 'Boost',
      title: `Early boost from ${b.booster} vs no boost`,
      why: `Posts boosted early get more ${METRIC_DEFS[metric].label.toLowerCase()}: ${top.map(x => `${x.booster} +${Math.round(x.lift * 100)}% (${x.nWith} vs ${x.nWithout} posts)`).join(', ')}.`,
      how: `Post the same creative and copy twice on comparable days: one with an early boost from ${b.booster} in the first hour, one with no boost.`, confidence: conf(minN(b.nWith, b.nWithout)) });
  }
  for (const g of sameCreative(posts, metric)) {
    const [hi, lo] = [g.posts[0], g.posts[g.posts.length - 1]];
    if (hi.value && lo.value != null && (lo.value === 0 || hi.value / lo.value >= 2)) out.push({ score: 4, dim: 'Account',
      title: `Account effect: ${hi.account} vs ${lo.account}`,
      why: `The same creative (“${g.group}”) did ${lo.value ? (hi.value / lo.value).toFixed(1) + '×' : 'far'} better on ${hi.account} (${hi.value} vs ${lo.value}).`,
      how: `Repeat with a new creative on both accounts on the same day to confirm it's the audience, not the day.`, confidence: 'anecdote' });
  }
  const cnm = commentsNoMeetings(posts);
  if (cnm.length >= 2) out.push({ score: 3, dim: 'CTA', title: 'CTA: “Comment keyword” vs “DM me”',
    why: `${cnm.length} of your highest-comment posts produced zero meetings. Comments are not converting.`,
    how: 'Keep the hook; change only the CTA and track meetings, not comments.', confidence: conf(cnm.length) });
  return out.sort((a, b) => b.score - a.score).slice(0, 8);
}

// Self-check: `node -e "import('./hq/insights.js').then(m=>console.log(m.selfTest()))"`
export function selfTest() {
  const mk = (id, account, tags, comments, impressions, meetings = 0) => ({ id, account, tags, boostedBy: tags.boosted_by || [], group: tags.creative_group || null, m: { comments, impressions, reactions: 0, saves: 0, sends: 0, reposts: 0 }, meetings });
  const posts = [
    mk(1, 'Peter', { hook: 'Contrarian', creative_group: 'map', boosted_by: ['Peter'] }, 30, 3000),
    mk(2, 'Razeen', { hook: 'Contrarian', creative_group: 'map' }, 6, 2000),
    mk(3, 'Chase', { hook: 'Story', boosted_by: ['Peter'] }, 20, 1800, 1),
    mk(4, 'Chase', { hook: 'Story' }, 4, 900),
    mk(5, 'Tengku', { hook: 'Data / stat' }, 2, 400, 3),
  ];
  const b = breakdown(posts, 'hook', 'comments');
  console.assert(b[0].value === 'Contrarian' && b[0].n === 2 && b[0].median === 18, 'breakdown');
  console.assert(sameCreative(posts, 'comments')[0].posts[0].account === 'Peter', 'same creative');
  const be = boostEffect(posts, 'comments').find(x => x.booster === 'Peter');
  console.assert(be.nWith === 2 && be.medWith === 25, 'boost');
  console.assert(commentsNoMeetings(posts).map(p => p.id).includes(1), 'comments no meetings');
  const v = verdict({ primary_metric: 'comments', metrics_a: { comments: 10, impressions: 2000 }, metrics_b: { comments: 40, impressions: 2000 } });
  console.assert(v.state === 'win' && v.winner === 'B', 'verdict win');
  console.assert(verdict({ metrics_a: {}, metrics_b: {} }).state === 'none', 'verdict none');
  const dm = verdict({ primary_metric: 'replies', metrics_a: { sent: 14, replies: 1 }, metrics_b: { sent: 13, replies: 10 } });
  console.assert(dm.state === 'win' && dm.winner === 'B', 'dm verdict ' + JSON.stringify(dm));
  const s = suggestTests(posts, [], 'comments');
  console.assert(s.length > 0 && s.every(x => x.why && x.how), 'suggestions');
  return `insights selfTest ok (${s.length} suggestions)`;
}
