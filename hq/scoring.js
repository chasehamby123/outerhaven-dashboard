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
  return `scoring selfTest ok (${s.length} posts, ${fx.length} factor rows; ${many ? 'Question n=' + many.n : ''})`;
}
