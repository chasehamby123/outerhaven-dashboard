// node scripts/tests/test_reply_prompt.mjs
import assert from 'node:assert/strict';
import { clipMessages, pickResources, exampleFrom, INTENTS } from '../../supabase/functions/reply-assist/prompt.js';

// clip: keeps the newest, drops empties, tags sender
const many = Array.from({ length: 50 }, (_, i) => ({ from: i % 2 ? 'us' : 'them', text: 'm' + i }));
const c = clipMessages(many); assert.equal(c.length, 30); assert.equal(c.at(-1).text, 'm49'); assert.equal(c[0].text, 'm20');
assert.equal(clipMessages([{ from: 'them', text: '   ' }, null]).length, 0);
assert.equal(clipMessages([{ from: 'them', text: 'x'.repeat(5000) }])[0].text.length, 1200);
assert.ok(clipMessages(Array.from({ length: 30 }, () => ({ from: 'them', text: 'y'.repeat(1200) }))).length <= 10, 'total cap');

// resources: matches by topic words, ignores unrelated and link-less
const res = [
  { title: 'AI deal screening blueprint', topic: 'AI investment research screening', url: 'https://x/ai' },
  { title: 'Family office list Asia', topic: 'family offices real estate', url: 'https://x/fo' },
  { title: 'No link yet', topic: 'screening', url: '' },
];
const hit = pickResources([{ text: 'Hi, could you send the AI screening blueprint?' }], res);
assert.deepEqual(hit.map(r => r.url), ['https://x/ai']);
assert.equal(pickResources([{ text: 'hello there' }], res).length, 0);

assert.ok(INTENTS.includes('no'));
assert.equal(exampleFrom({ messages: [{ from: 'them', text: 'a' }, { from: 'us', text: 'b' }] }), 'b');
console.log('reply prompt tests ok');
