// node hq/scoring-test.mjs   (also checks the JS lift/outcome matches the SQL view post_scores when given a fixture)
import { selfTest, scorePosts } from './scoring.js';
import { toPost } from './insights.js';
import fs from 'node:fs';
console.log(selfTest());
const f = process.argv[2];
if (f) {
  const rows = JSON.parse(fs.readFileSync(f, 'utf8')); // [{id, account, engagement, lift_ratio, outcome}] from the view + raw posts under .raw
  const posts = rows.raw.map(r => toPost(r, r.__account, 0, []));
  const sc = scorePosts(posts); let bad = 0;
  for (const v of rows.view) { const s = sc.find(x => x.post.id === v.id); if (!s) { bad++; console.log('missing', v.id); continue; }
    if (Math.abs(s.value - Number(v.engagement)) > 1e-9 || Math.abs(s.lift - Number(v.lift_ratio)) > 0.006 || s.outcome !== v.outcome) { bad++; console.log('MISMATCH', v.id, s.value, v.engagement, s.lift.toFixed(2), v.lift_ratio, s.outcome, v.outcome); } }
  console.log(bad ? `${bad} mismatches` : `JS matches SQL view on ${rows.view.length} posts`); process.exit(bad ? 1 : 0);
}
