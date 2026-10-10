// Post scoring engine: pure functions, no DOM, no network (test: node hq/scoring-test.mjs).
// Question it answers: "which creative / caption factors actually move results, and what should the next post look like?"
//
// Method (kept deliberately simple so every number can be explained):
//  1. Score each post against ITS OWN account: lift = (engagement + 1) / (account median engagement + 1). An account with a
//     big audience can't make every factor look good. Same definition as the SQL view `post_scores`.
//  2. Outcome: converted (a logged meeting came from it) > winner (top quarter of its account) > flop (bottom quarter) > typical.
//     Accounts with fewer than 4 posts are "too early" (no outcome yet).
//  3. Factor effect = average ln(lift) of the posts that have the factor, SHRUNK toward zero: sum / (n + K). With few posts the
//     estimate stays near "no effect" instead of crowning whatever happened to show up once. K = 3.
//  4. A draft's predicted multiplier = exp(sum of its factors' effects). It assumes factors add up and don't interact. That is
//     wrong in detail and useful as a direction; the confidence label is the weakest factor's sample size.
import { DIMENSIONS, METRIC_DEFS } from './insights.js';

export const K = 3;
export const MIN_ACCOUNT_POSTS = 4;
const med = a => { const s = a.filter(Number.isFinite).sort((x, y) => x - y); if (!s.length) return null; const i = s.length >> 1; return s.length % 2 ? s[i] : (s[i - 1] + s[i]) / 2; };
export const confidence = n => n >= 8 ? 'solid' : n >= 4 ? 'early' : 'anecdote';
export const CONF_TEXT = { solid: 'Solid sample (8+ posts)', early: 'Early signal (4-7 posts)', anecdote: 'Anecdotal (under 4 posts)' };

// Score every post against its own account.
export function scorePosts(posts, metric = 'engagement') {
  const get = METRIC_DEFS[metric].get;
  const byAcct = {};
  for (const p of posts) (byAcct[p.account] ||= []).push(p);
  const out = [];
  for (const [account, ps] of Object.entries(byAcct)) {
    const vals = ps.map(get), base = med(vals), n = ps.length;
    for (const p of ps) {
      const v = get(p), lift = (v + 1) / (base + 1);
      // percent_rank(): ties share the lowest rank, scaled to 0..1 (matches SQL)
      const below = vals.filter(x => x < v).length, pr = n > 1 ? below / (n - 1) : 0;
      const outcome = p.meetings > 0 ? 'converted' : n < MIN_ACCOUNT_POSTS ? 'too_early' : pr >= 0.75 ? 'winner' : pr <= 0.25 ? 'flop' : 'typical';
      out.push({ post: p, account, value: v, base, lift, logLift: Math.log(lift), pr, outcome, accountPosts: n });
    }
  }
  return out;
}

// Effect of every factor value, shrunk toward zero.
export function factorEffects(scored) {
  const rows = [];
  for (const [dim, def] of Object.entries(DIMENSIONS)) {
    const g = {};
    for (const s of scored) { const v = s.post.tags[dim]; if (v) (g[v] ||= []).push(s); }
    for (const [value, ss] of Object.entries(g)) {
      const n = ss.length, sum = ss.reduce((t, s) => t + s.logLift, 0);
      rows.push({
        dim, dimLabel: def.label, group: def.group, value, n, confidence: confidence(n),
        raw: Math.exp(sum / n) - 1, effect: sum / (n + K), lift: Math.exp(sum / (n + K)) - 1,
        winners: ss.filter(s => s.outcome === 'winner' || s.outcome === 'converted').length, flops: ss.filter(s => s.outcome === 'flop').length,
        posts: ss.map(s => s.post.id),
      });
    }
  }
  return rows.sort((a, b) => b.effect - a.effect);
}

// Why did / would this post do what it did? Its factors, best first.
export function explain(tags, effects) {
  const idx = {}; for (const e of effects) idx[e.dim + '\u0000' + e.value] = e;
  const used = Object.keys(DIMENSIONS).filter(d => tags[d]).map(d => idx[d + '\u0000' + tags[d]] || { dim: d, dimLabel: DIMENSIONS[d].label, value: tags[d], n: 0, effect: 0, lift: 0, confidence: 'anecdote' });
  return { helps: used.filter(e => e.effect > 0.02).sort((a, b) => b.effect - a.effect), hurts: used.filter(e => e.effect < -0.02).sort((a, b) => a.effect - b.effect), neutral: used.filter(e => Math.abs(e.effect) <= 0.02) };
}

// Predicted multiplier vs the account's usual post for a set of chosen factors.
export function predict(tags, effects) {
  const ex = explain(tags, effects), all = [...ex.helps, ...ex.hurts, ...ex.neutral];
  if (!all.length) return { multiplier: 1, n: 0, confidence: 'anecdote', factors: ex };
  const sum = all.reduce((t, e) => t + e.effect, 0), minN = Math.min(...all.map(e => e.n));
  return { multiplier: Math.exp(sum), n: minN, confidence: confidence(minN), factors: ex };
}

// The best value of each factor that has at least minN posts behind it and a positive effect: "what a winning post looks like".
export function recipe(effects, minN = 2) {
  const best = {};
  for (const e of effects) if (e.n >= minN && e.effect > 0 && (!best[e.dim] || e.effect > best[e.dim].effect)) best[e.dim] = e;
  return Object.values(best).sort((a, b) => b.effect - a.effect);
}

// ---- Elements (11 Oct 2026): every part of a post, ranked ----
// A post is broken into elements from three places: the measured format, the caption counts the scraper takes (text_features),
// and Claude's breakdown of the creative and copy (post-breakdown skill). Each element value is scored exactly like a factor
// above (lift vs own account, shrunk toward zero), so "cover has a number" and "6-10 pages" can be ranked side by side.
const bucket = (v, cuts, labels) => { if (v == null || !Number.isFinite(Number(v))) return null; const i = cuts.findIndex(c => Number(v) <= c); return labels[i < 0 ? labels.length - 1 : i]; };
const yn = v => v == null ? null : v ? 'Yes' : 'No';
const pretty = v => v == null || v === '' ? null : String(v).replace(/_/g, ' ').replace(/^./, c => c.toUpperCase());
export const ELEMENT_GROUPS = { format: 'Format', cover: 'Cover / image', pages: 'Pages', copy: 'Caption (Claude)', counts: 'Caption (counted)' };
export function elementsOf(post) {
  const b = post.breakdown || {}, c = b.cover || {}, cp = b.copy || {}, f = post.features || {}, out = [];
  const add = (group, label, value) => { if (value != null && value !== '') out.push({ group, label, value: String(value) }); };
  add('format', 'Format', post.tags?.format);
  // Cover / single image
  add('cover', 'Cover promise', pretty(c.promise)); add('cover', 'Number on cover', yn(c.has_number)); add('cover', 'Cover subject', pretty(c.subject));
  add('cover', 'Face', pretty(c.face)); add('cover', 'Eye contact', c.face && c.face !== 'none' ? yn(c.eye_contact) : null);
  add('cover', 'Text on cover', pretty(c.text_density)); add('cover', 'Cover words', bucket(c.words_on_cover, [5, 15, 30], ['0-5', '6-15', '16-30', '31+']));
  add('cover', 'Headline words', bucket(c.headline_words, [6, 10], ['1-6', '7-10', '11+'])); add('cover', 'Names an audience', c.specific_audience === undefined ? null : yn(!!c.specific_audience));
  add('cover', 'Contrast', pretty(c.contrast)); add('cover', 'Background', pretty(c.background)); add('cover', 'Palette', pretty(c.palette));
  add('cover', 'Branding', pretty(c.branding)); add('cover', 'Swipe cue', yn(c.swipe_cue)); add('cover', 'Looks like', pretty(c.looks_like)); add('cover', 'Readable on phone', pretty(c.mobile_readable));
  // Pages (multi-image / documents)
  const pages = Array.isArray(b.pages) ? b.pages.length : 0;
  if (pages) add('pages', 'Page count', bucket(pages, [1, 5, 10], ['1', '2-5', '6-10', '11+']));
  add('pages', 'Structure', pretty(b.structure)); add('pages', 'Value given', pretty(b.value_given)); add('pages', 'Data', pretty(b.data_specificity));
  add('pages', 'Last page CTA', pretty(b.last_page_cta)); add('pages', 'Production', pretty(b.production)); add('pages', 'Design consistency', pretty(b.design_consistency));
  // Copy (Claude)
  add('copy', 'Hook type', pretty(cp.hook_type)); add('copy', 'Hook', pretty(cp.hook_specificity)); add('copy', 'Curiosity gap', yn(cp.curiosity_gap));
  add('copy', 'Calls out an audience', cp.audience_callout === undefined ? null : yn(!!cp.audience_callout)); add('copy', 'Line 2', pretty(cp.rehook));
  add('copy', 'Body', pretty(cp.body_structure)); add('copy', 'Proof', pretty(cp.proof)); add('copy', 'Tone', pretty(cp.tone));
  add('copy', 'Reading grade', bucket(cp.reading_grade, [6, 8, 10], ['≤6', '7-8', '9-10', '11+'])); add('copy', 'Point of view', cp.point_of_view ? String(cp.point_of_view).toUpperCase() : null);
  add('copy', 'Jargon', pretty(cp.jargon)); add('copy', 'Emotion', pretty(cp.emotion)); add('copy', 'CTA', pretty(cp.cta)); add('copy', 'Ask size', pretty(cp.ask_size));
  add('copy', 'Lead magnet', cp.lead_magnet === undefined ? null : yn(!!cp.lead_magnet)); add('copy', 'Caption vs creative', pretty(cp.caption_vs_creative));
  // Caption, counted by the scraper (exact)
  if (f && f.chars != null) {
    add('counts', 'Caption length', bucket(f.chars, [400, 1200], ['Short (<400)', 'Medium (400-1,200)', 'Long (1,200+)']));
    add('counts', 'Hook words', bucket(f.hook_words, [6, 12], ['1-6', '7-12', '13+'])); add('counts', 'Number in hook', yn(f.hook_number));
    add('counts', 'Question in hook', yn(f.hook_question)); add('counts', 'Hook starts with I / we', yn(f.hook_first_person)); add('counts', 'Negative hook', yn(f.hook_negative));
    add('counts', 'Cut by "see more"', yn(f.see_more_cut)); add('counts', 'List lines', bucket(f.list_lines, [0, 4], ['0', '1-4', '5+']));
    add('counts', 'Emojis', bucket(f.emojis, [0, 3], ['0', '1-3', '4+'])); add('counts', 'Hashtags', bucket(f.hashtags, [0, 3], ['0', '1-3', '4+']));
    add('counts', 'Link in caption', yn(f.links > 0)); add('counts', 'Comment-keyword CTA', yn(!!f.cta_keyword)); add('counts', 'P.S.', yn(f.ps));
    add('counts', 'Words per line', bucket(f.avg_line_words, [8, 15], ['≤8', '9-15', '16+']));
  }
  return out;
}
export function elementEffects(scored) {
  const g = {};
  for (const s of scored) for (const e of elementsOf(s.post)) { const k = e.group + '\u0000' + e.label + '\u0000' + e.value; (g[k] ||= { ...e, ss: [] }).ss.push(s); }
  return Object.values(g).map(({ ss, ...e }) => {
    const n = ss.length, sum = ss.reduce((t, s) => t + s.logLift, 0);
    return { ...e, n, confidence: confidence(n), effect: sum / (n + K), lift: Math.exp(sum / (n + K)) - 1, raw: Math.exp(sum / n) - 1, posts: ss.map(s => s.post.id) };
  }).sort((a, b) => b.effect - a.effect);
}

// Self-check: `node hq/scoring-test.mjs`
export function selfTest() {
  const assert = (c, m) => { if (!c) throw new Error('scoring selfTest failed: ' + m); };
  const mk = (id, account, tags, eng, meetings = 0) => ({ id, account, tags, meetings, m: { comments: eng, reactions: 0, reposts: 0 } });
  const posts = [
    ...[10, 12, 14, 40].map((e, i) => mk('a' + i, 'A', { hook: i === 3 ? 'Contrarian' : 'Story', cta: 'DM me' }, e)),
    ...[100, 110, 120, 20].map((e, i) => mk('b' + i, 'B', { hook: i === 3 ? 'Story' : 'Contrarian', cta: 'DM me' }, e)),
    mk('c0', 'C', { hook: 'Question' }, 50), mk('c1', 'C', { hook: 'Question' }, 5, 1),
  ];
  const s = scorePosts(posts);
  const a3 = s.find(x => x.post.id === 'a3'), b3 = s.find(x => x.post.id === 'b3'), c1 = s.find(x => x.post.id === 'c1'), c0 = s.find(x => x.post.id === 'c0');
  assert(a3.outcome === 'winner' && b3.outcome === 'flop', 'winner/flop within account');
  assert(c1.outcome === 'converted' && c0.outcome === 'too_early', 'converted beats too_early; small accounts have no outcome');
  assert(Math.abs(a3.lift - 41 / 14) < 1e-9, 'lift = (v+1)/(median+1)');
  const fx = factorEffects(s), con = fx.find(e => e.dim === 'hook' && e.value === 'Contrarian'), st = fx.find(e => e.dim === 'hook' && e.value === 'Story');
  assert(con.n === 4 && st.n === 4, 'counts');
  // Contrarian has one big win on A and three good posts on B; Story has the opposite: account normalisation must keep Story above 0 only through A.
  assert(Math.abs(con.effect) < Math.abs(con.raw) * 1.2 + 1, 'shrinkage keeps effect bounded');
  const one = factorEffects(scorePosts([mk('x1', 'A', { hook: 'Story' }, 90), mk('x2', 'A', { hook: 'Question' }, 10), mk('x3', 'A', { hook: 'Question' }, 10), mk('x4', 'A', { hook: 'Question' }, 11)]));
  const lone = one.find(e => e.value === 'Story'), many = one.find(e => e.value === 'Question');
  assert(Math.abs(lone.effect) < Math.abs(Math.log(lone.raw + 1)) && lone.confidence === 'anecdote', 'one post barely moves the estimate');
  const p = predict({ hook: 'Contrarian', cta: 'DM me' }, fx);
  // weakest factor decides confidence: Contrarian n=4 (early), "DM me" n=8 (solid) -> early
  assert(p.multiplier > 0 && p.n === 4 && p.confidence === 'early', 'predict uses weakest factor n');
  assert(predict({}, fx).multiplier === 1, 'no factors = 1x');
  assert(recipe(fx).every(r => r.effect > 0), 'recipe positive only');
  const ex = explain({ hook: 'Story' }, fx); assert(ex.helps.length + ex.hurts.length + ex.neutral.length === 1, 'explain buckets');
  const el = elementsOf({ tags: { format: 'Presentation' }, breakdown: { cover: { has_number: true, promise: 'number_list' }, pages: [{}, {}, {}], copy: { reading_grade: 6 } }, features: { chars: 900, hook_words: 5, emojis: 0 } });
  const has = (l, v) => el.some(e => e.label === l && e.value === v);
  assert(has('Number on cover', 'Yes') && has('Cover promise', 'Number list') && has('Page count', '2-5') && has('Reading grade', '≤6') && has('Caption length', 'Medium (400-1,200)') && has('Emojis', '0') && has('Format', 'Presentation'), 'elementsOf flattens breakdown + counts');
  const ee = elementEffects(scorePosts([1, 2, 3, 4].map(i => ({ id: 'e' + i, account: 'A', meetings: 0, tags: {}, features: { chars: i > 2 ? 1500 : 100 }, m: { comments: i > 2 ? 30 : 5, reactions: 0, reposts: 0 } }))));
  const longC = ee.find(e => e.label === 'Caption length' && e.value === 'Long (1,200+)'), shortC = ee.find(e => e.label === 'Caption length' && e.value === 'Short (<400)');
  assert(longC.effect > 0 && shortC.effect < 0 && longC.n === 2, 'elementEffects ranks within account');
  return `scoring selfTest ok (${s.length} posts, ${fx.length} factor rows; ${many ? 'Question n=' + many.n : ''})`;
}
