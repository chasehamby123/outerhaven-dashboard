// HQ → Guide (#/guide, everyone incl. ops): how the posting-format workflow works, by job. Written for the team, not for us:
// plain words, what to click, what each symbol means. Keep it in sync with formats.js / formattest.js / postcheck.js.
import { esc, $, $$ } from './core.js';
import { loadFormats, formatList, fmtChip, CHECK } from './formats.js';

const SECTIONS = [
  ['post', 'Posting a scheduled post'],
  ['make', 'Making the creatives'],
  ['specs', 'Format specs'],
  ['plan', 'Planning formats'],
  ['test', 'Running a format test'],
  ['learn', 'Finding what works'],
  ['gpt', 'Rebuilding a post in GPT image'],
  ['fix', 'When something looks wrong'],
];

const sym = k => { const [tone, s, w] = CHECK[k]; return `<span class="fmtCheck" data-tone="${tone}"><b aria-hidden="true">${s}</b>${esc(w)}</span>`; };
const step = (n, title, body) => `<li><span class="gNum">${n}</span><div><b>${title}</b><div>${body}</div></div></li>`;
const go = (href, label) => `<a class="btn sm" href="${href}">${esc(label)} →</a>`;

export async function renderGuide(root, sub) {
  await loadFormats().catch(() => {});
  const f = formatList();
  const flow = ['Plan the format (Schedule)', 'Make it (Post creation)', 'Post it at the slot time (Today)', 'Scraper checks LinkedIn (daily)', 'Results (Experiments, Playbook)'];
  root.innerHTML = `<div class="head"><div><h1>Guide</h1><p>How post formats, format tests and post breakdowns work, by job. Jump to yours.</p></div></div>
  <nav class="gToc">${SECTIONS.map(([k, l], i) => `<a href="#/guide/${k}" data-k="${k}">${i + 1}. ${esc(l)}</a>`).join('')}</nav>
  <section class="card"><div class="body"><h3 style="margin:0 0 10px">The loop</h3><ol class="gFlow">${flow.map((t, i) => `<li><span>${i + 1}</span>${esc(t)}</li>`).join('')}</ol>
    <p class="s muted" style="margin:10px 0 0">Every post has a planned format. LinkedIn tells us what actually went out. If the two match, the post counts in tests and in the rankings. If not, it's flagged so we can fix the habit, not the numbers.</p></div></section>

  <section class="card gSec" id="g-post"><header><div><h2>1. Posting a scheduled post</h2><p>Whoever posts (usually Anaz).</p></div>${go('#/today', 'Today')}</header><div class="body"><ol class="gSteps">
    ${step(1, 'Open Today and find the post task.', `Under the task you'll see the format it must go out as, e.g. ${fmtChip('presentation', 'strong')}, with one line on how it's made.`)}
    ${step(2, 'Check for a ★ test label.', `<span class="fmtTest">Test: Presentation vs PDF · arm A</span> means this post is part of a format test. It has to be <b>exactly</b> that format and posted at the slot time, or the test can't use it.`)}
    ${step(3, 'Post it in that format, within 4 hours of the slot time.', 'A post more than 4 hours away from its slot isn\'t linked to the slot, so it shows as "No slot". Documents (Presentation, PDF carousel) must be uploaded with LinkedIn\'s <b>Add a document</b> option, never as images.')}
    ${step(4, 'Tick it on Today.', 'The tick is your word that it went out. The scraper checks it against LinkedIn after its next run.')}
    ${step(5, 'Look at the result the next day.', `${sym('match')} it went out as planned. ${sym('mismatch')} it went out as something else: tell whoever planned it. ${sym('unknown')} not checked yet.`)}
  </ol></div></section>

  <section class="card gSec" id="g-make"><header><div><h2>2. Making the creatives</h2><p>Whoever makes the posts in the weekend batch.</p></div>${go('#/schedule/creation', 'Post creation')}</header><div class="body"><ol class="gSteps">
    ${step(1, 'Open Schedule → Post creation.', 'The card <b>Make these for the next 7 days</b> lists, per account, how many of each format are needed and on which days.')}
    ${step(2, 'Make ★ posts first.', 'They are format test posts. A wrong format wastes a test slot, and it has to be booked again.')}
    ${step(3, 'Follow the spec for the format.', 'See the next section. The size of the pages is what tells a Presentation from a PDF carousel.')}
    ${step(4, 'Name files so the poster can find them.', 'e.g. <code>Sahid · Tue 14 Oct · Presentation.pdf</code>.')}
  </ol></div></section>

  <section class="card gSec" id="g-specs"><header><div><h2>3. Format specs</h2><p>What each format means to HQ. Admins can change the list in Schedule → Formats.</p></div></header><div class="body flush scroll">
    <table class="tbl"><thead><tr><th>Format</th><th>What LinkedIn must show</th><th>How to make it</th></tr></thead><tbody>
    ${f.map(x => `<tr><td style="white-space:nowrap">${fmtChip(x.key, 'strong')}</td><td class="s">${esc(x.linkedin_type.replace('_', ' '))}${x.linkedin_type === 'document' ? ` · pages ${esc(x.orientation.replace(/_/g, ' '))}` : ''}</td><td class="s">${esc(x.how_to || '')}</td></tr>`).join('')}
    </tbody></table>
    <div class="body s"><b>Sizes that work:</b> Presentation 1920 × 1080 px (16:9 slides). PDF carousel 1080 × 1350 px (4:5) or 1080 × 1080 (square). Single image 1080 × 1350 px.
      HQ reads the page shape from the PDF itself: a 16:9 deck exported as a PDF is a Presentation, a 4:5 one is a PDF carousel. Upload images one by one and it becomes Multi-image instead.</div></div></section>

  <section class="card gSec" id="g-plan"><header><div><h2>4. Planning formats</h2><p>Tengku, Chase.</p></div>${go('#/schedule', 'Schedule')}</header><div class="body"><ol class="gSteps">
    ${step(1, 'Give every slot an every-week format.', 'Schedule → click a post → <b>Format, every week</b>. The block then shows it (e.g. ▣ Single image). "No format set" means nothing can be checked.')}
    ${step(2, 'One-off change for a date.', 'Same window → <b>One-off format for a date</b> (next 4 dates). The block shows a <b>*</b> when its next date differs from every week.')}
    ${step(3, 'Edit the list of formats.', 'Schedule → <b>Formats</b>. Two document formats can\'t share a page shape, or the scraper couldn\'t tell them apart.')}
  </ol></div></section>

  <section class="card gSec" id="g-test"><header><div><h2>5. Running a format test</h2><p>e.g. 2 posts with Sahid as a Presentation, 2 with Chase as a PDF carousel.</p></div>${go('#/growth/experiments', 'Post experiments')}</header><div class="body"><ol class="gSteps">
    ${step(1, 'Growth → Post experiments → New format test.', 'Pick the account and format for arm A and arm B, how many posts each, and the start date. The window shows which slots it will take.')}
    ${step(2, 'Book the slots.', 'Those slots switch to the test format on Today, Schedule and Post creation, with a ★. Change the content plan for them if a lead magnet was planned there.')}
    ${step(3, 'Fairest test: the same account on both arms.', 'Slots then alternate A, B, A, B. With two accounts, each post is compared with <b>its own account\'s usual numbers</b>, because Sahid\'s audience and Chase\'s audience aren\'t the same size.')}
    ${step(4, 'Read the card.', `Every booked slot shows ○ coming up, ● today, ${sym('match')}, ${sym('mismatch')} or <span class="fmtCheck" data-tone="bad"><b>✕</b>Not posted</span>. Only ✓ posts count. "vs usual" = the post's comments as a % of its account's usual.`)}
    ${step(5, 'Missed one? Book a replacement.', 'The card offers <b>Book N replacements</b> on the next free slots. <b>Release the remaining slots</b> ends a test early.')}
    ${step(6, 'Don\'t call it on 2 posts.', 'Under 4 counted posts per arm the card says "directional only": one viral post flips it. Run it again before changing the plan.')}
  </ol></div></section>

  <section class="card gSec" id="g-learn"><header><div><h2>6. Finding what works</h2><p>Everyone who plans content.</p></div>${go('#/growth/playbook', 'Playbook')}</header><div class="body"><ol class="gSteps">
    ${step(1, 'Every post is split into elements.', 'The format (measured), the caption counts (length, hook words, emojis, list lines… counted automatically), and Claude\'s breakdown of the creative and copy (cover promise, number on the cover, face, text on cover, page count, structure, hook type, reading grade, CTA size…) every Monday.')}
    ${step(2, 'Growth → Playbook → Elements, ranked.', '▲ goes with better posts, ▼ with worse ones, each against the account\'s usual post. n = how many posts have it. Under 4 = anecdote.')}
    ${step(3, 'Turn the strongest ▲ into a test.', 'Elements travel together (long captions often have lists too). A test that changes only that one element is the proof.')}
  </ol></div></section>

  <section class="card gSec" id="g-gpt"><header><div><h2>7. Rebuilding a post in GPT image</h2><p>When a post worked and you want another like it.</p></div>${go('#/growth/posts', 'Posts')}</header><div class="body"><ol class="gSteps">
    ${step(1, 'Growth → Posts → click the creative.', 'You see every slide, what it\'s made of, and the rebuild tools.')}
    ${step(2, 'Copy JSON for GPT image (whole post) or Copy page N prompt (one page).', 'The JSON is the literal copy: canvas size, colours (hex), fonts, every text block word for word with its position, images, shapes, and a ready prompt per page.')}
    ${step(3, 'Paste into ChatGPT.', 'With the JSON: <code>Render page 1 exactly as specified in this JSON.</code> Change the text in the JSON first if you want a new version. Then page 2, and so on.')}
    ${step(4, 'Touch up only what it lists under ⚠ Watch for.', 'Usually: paste the real logo or face back in, and check long or small text.')}
  </ol><p class="s muted">The JSON is written by the Monday analysis (or Growth → Insights → Run analysis now). New posts get it the Monday after.</p></div></section>

  <section class="card gSec" id="g-fix"><header><div><h2>8. When something looks wrong</h2></div></header><div class="body"><dl class="gFaq">
    <dt>${sym('mismatch')} but I posted it right</dt><dd>Check how it was uploaded: slides added as images become Multi-image, not a document. A 16:9 deck counts as Presentation, a 4:5 one as PDF carousel.</dd>
    <dt><span class="fmtCheck"><b>–</b>No slot</span></dt><dd>The post went out more than 4 hours from any slot of that account, or on a day with no slot. Post at the slot time, or move the slot in Schedule.</dd>
    <dt>${sym('unknown')}</dt><dd>The scraper hasn't read the post yet (it runs once a day) or the slot has no format set.</dd>
    <dt>"Not found" on Overview</dt><dd>Nothing from that account on LinkedIn for that slot after the scraper ran. Reshares never count as the account's own post.</dd>
    <dt>No GPT image JSON</dt><dd>The post is newer than the last Monday analysis, or it's text / video.</dd>
  </dl></div></section>`;
  const el = sub && $(`#g-${sub}`, root);
  if (el) { el.scrollIntoView({ block: 'start' }); el.classList.add('gHi'); }
  $$('.gToc a', root).forEach(a => a.onclick = e => { e.preventDefault(); history.replaceState(null, '', a.getAttribute('href')); $(`#g-${a.dataset.k}`, root)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
}
