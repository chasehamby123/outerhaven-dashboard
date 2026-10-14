// Swipe file (14 Oct 2026): other people's posts we want to copy, broken down by Claude (routines/breakdown.md) into the same
// parts as our own posts (post-breakdown skill), plus the archetype = the recipe ("fake doc viewer"). Table swipe_posts,
// private bucket 'swipe', job via resource-request action 'breakdown'.
import { sb, esc, fmt, toast, modal, $, $$ } from './core.js';

// Same list and order as .claude/skills/post-breakdown/SKILL.md (archetype). Change both together.
export const ARCHETYPES = {
  fake_doc_viewer: ['Fake doc viewer', 'One image dressed as an open PDF: file bar, page thumbnails, a contents page and a "Comment WORD" button.'],
  contents_cover: ['Contents cover', 'A real document or carousel whose cover is a numbered table of contents.'],
  listicle_slides: ['Listicle slides', 'One item per slide.'],
  // key kept as launch_slide (rows already saved with it); Tengku's name for it is "presentation".
  launch_slide: ['Presentation slide', 'A landscape keynote-style title slide: big title ("Introducing X"), one line of result, one piece of art, lots of empty space.'],
  framework_diagram: ['Framework diagram', 'One model drawn as boxes and arrows.'],
  data_chart: ['Data chart', 'The chart is the post.'],
  directory_table: ['Directory table', 'A list of named firms or people.'],
  template_preview: ['Template preview', 'A partial look at a tool, sheet or prompt pack.'],
  tool_in_action: ['Tool in action', 'A mock-up of the tool doing the job (chat on one side, the finished deliverable on the other) under a "Tool + Tool" headline.'],
  screenshot_proof: ['Proof screenshot', 'The visual is the evidence: a real notification, DM, booked call or dashboard, names blurred, key lines boxed.'],
  quote_card: ['Quote card', 'One line of text on a plain card.'],
  photo_story: ['Photo story', 'A photo of a person with a story caption.'],
  meme: ['Meme', 'A meme format.'],
  other: ['Other', 'Recipe named in the notes.'],
};
// Why each recipe works, as rules a remix must keep (14 Oct 2026: a friend's GPT turned the Opus 5 slide into a beige clipboard
// checklist: it copied the look and dropped the launch, the number and the audience). Goes into every copied prompt / JSON.
export const RECIPES = {
  launch_slide: { keep: [
    'Line 1 of the title is the name of a big launch the whole feed already knows THIS WEEK ("Introducing Claude Opus 5"). The borrowed attention is the hook; without it this is just a beige slide.',
    'Line 2 turns the launch into a dollar result for one named audience ("$145M Deal Flow Agent for PE/VCs"). Our industry is the subtitle, never the title.',
    'One calm, crafted piece of art (engraving, natural-history illustration) and lots of empty space. No icons, no UI, no checklist, no "Comment X" text on the slide.',
    'The caption opens with the news ("🚨 X just launched & it now…") so the first visible line matches the slide.',
  ], swap: 'the launch (this week\'s), the dollar number, the audience, the art subject' },
  fake_doc_viewer: { keep: [
    'It must look like a document already open in a viewer (file bar, page thumbnails, page counter), so the reader feels they are one click from having it.',
    'The visible page is a numbered contents list that promises specific deliverables.',
    'The "Comment WORD" button is drawn inside the image; the word is short and on-topic.',
  ], swap: 'the document title, the contents lines, the keyword' },
  tool_in_action: { keep: [
    'The headline names a tool everyone knows ("Claude for Investor Pitch Decks", "Claude + PowerPoint"): the big name is the headline, our use case follows it.',
    'Input and finished output side by side, so the result is visible before anyone asks for it.',
    'The "Comment WORD" button is drawn inside the image.',
  ], swap: 'the deliverable, the input files, the keyword' },
  screenshot_proof: { keep: [
    'The visual is real evidence: OUR own screenshot (booked call, reply, dashboard), names blurred, the one line that proves the claim boxed in red. Never a generated screenshot.',
    'A number headline ("97+ Off-Market Mandates") and the logos of the tools that made it.',
  ], swap: 'the screenshot (ours), the number, the logos' },
};
export function remixPrompt(s) {
  const r = RECIPES[s.archetype], pages = s.recreate?.pages || [];
  if (!r) return '';
  return `Make OUR version of this LinkedIn image for our audience (private credit / M&A: founders, PE, family offices, lenders).

Keep all of these. They are why the original went viral; a version without them fails:
${r.keep.map(k => `- ${k}`).join('\n')}

Change only: ${r.swap}. Keep the canvas size, layout, palette and type style of the original.

The original, for look and layout only:
${pages.map(p => p.prompt).join('\n\n')}

Render every text exactly as you write it; no extra text, no watermark.`;
}
export const LAYOUTS = { title_top_visual_below: 'Title on top, visual below', full_bleed_art_text_over: 'Art fills the frame, text over it', document_viewer: 'Document viewer', split_left_right: 'Split left / right', text_only: 'Text only', photo_with_caption: 'Photo with caption' };
export const archLabel = k => ARCHETYPES[k]?.[0] || (k ? String(k).replace(/_/g, ' ') : 'Not broken down');

let rows = null, poll = null;
// Same post = same author + same first 60 letters of the caption. Saved twice shows as ONE row: the copy with the most
// readings and an image wins, the others are listed as extra copies (removable from Open).
export const postKey = s => `${String(s.author || '').toLowerCase().replace(/[^a-z]/g, '')}|${String(s.caption || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 60)}`;
const rank = s => (s.snapshots?.length || 0) * 10 + ((s.image_paths || []).length ? 5 : 0) + (s.breakdown ? 1 : 0);
export async function loadSwipe() {
  const r = await sb.from('swipe_posts').select('*').order('created_at', { ascending: false }).limit(300);
  const all = r.error ? [] : r.data || [], groups = new Map();
  for (const x of all) { const k = x.caption || x.author ? postKey(x) : x.id; (groups.get(k) || groups.set(k, []).get(k)).push(x); }
  rows = [...groups.values()].map(g => { const [best, ...rest] = [...g].sort((a, b) => rank(b) - rank(a)); return { ...best, dupes: rest }; })
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  return rows;
}
export const swipeRows = () => rows || [];

// Comments per 1,000 followers = how hard the post worked for its size; comments ÷ reactions over 2 = a comment gate did it.
export const per1k = s => s.author_followers > 0 && s.comments != null ? s.comments / s.author_followers * 1000 : null;
const gate = s => s.reactions > 0 && s.comments != null ? s.comments / s.reactions : null;
const STATUS = { new: '… Not started', queued: '… Claude is breaking it down', ready: '✓ Ready', failed: '✕ Failed' };

// image_paths: bucket paths, or a full https URL (a seeded / public image).
async function thumbs(root) {
  for (const el of $$('[data-swthumb]', root)) {
    const p = el.dataset.swthumb, url = /^https:\/\//.test(p) ? p : (await sb.storage.from('swipe').createSignedUrl(p, 3600)).data?.signedUrl;
    if (url) el.style.backgroundImage = `url("${url}")`;
  }
}

// Growth over time: each reading of the numbers, with hours since posted and comments per hour since the reading before.
const hoursAt = (s, at) => s.posted_at ? (Date.parse(at) - Date.parse(s.posted_at)) / 36e5 : null;
export function growth(s) {
  const snaps = [...(s.snapshots || [])].sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  return snaps.map((x, i) => { const h = hoursAt(s, x.at), prev = snaps[i - 1], ph = prev ? hoursAt(s, prev.at) : 0, pc = prev ? prev.comments : 0;
    return { ...x, h, perHour: h != null && h - ph >= 1 && x.comments != null ? (x.comments - (pc || 0)) / (h - ph) : null }; });
}
const hrs = h => h == null ? '' : h < 48 ? `${Math.round(h)} h` : `${(h / 24).toFixed(1)} days`;
// What the feed shows before "…see more". Approximate.
export function feedHook(caption) {
  // LinkedIn shows about 3 lines (a blank line counts as one) or ~210 characters, whichever comes first.
  const t = String(caption || '').split('\n').slice(0, 3).join('\n').trimEnd();
  return t.length > 210 ? t.slice(0, 210).replace(/\s+\S*$/, '') + '…' : t;
}

export function swipeTable(list, onChange) {
  if (!list.length) return '<div class="empty">Nothing saved yet. Click "Break down a post", drop the screenshots, paste the caption.</div>';
  return `<table class="tbl swTbl"><thead><tr><th></th><th>Post</th><th>Archetype</th><th class="n">Comments / 1K followers</th><th class="n">Comments ÷ likes</th><th>Status</th><th></th></tr></thead><tbody>
  ${list.map(s => { const p = per1k(s), g = gate(s), img = (s.image_paths || [])[0];
    const gr = growth(s), traj = gr.length > 1 ? gr.map(x => `${fmt(x.comments)}${x.h != null ? ` <small>(${hrs(x.h)})</small>` : ''}`).join(' → ') : '';
    return `<tr class="${s.breakdown ? 'swRow' : ''}" ${s.breakdown ? `data-swview="${s.id}" tabindex="0"` : ''}><td>${img ? `<span class="cthumb" data-swthumb="${esc(img)}" title="Open"></span>` : '<span class="cthumb none">Text</span>'}</td>
      <td style="max-width:300px"><b>${esc(s.author || 'Unknown author')}</b>${s.author_followers ? `<span class="s muted"> · ${fmt(s.author_followers)} followers</span>` : ''}
        <div class="s muted swCap">${esc(s.breakdown?.copy?.hook || (s.caption || '').slice(0, 120))}</div></td>
      <td>${s.archetype ? `<b>${esc(archLabel(s.archetype))}</b>${s.breakdown?.cover?.layout ? `<div class="s muted">${esc(LAYOUTS[s.breakdown.cover.layout] || s.breakdown.cover.layout.replace(/_/g, ' '))}</div>` : ''}` : '<span class="muted s">—</span>'}</td>
      <td class="n">${p == null ? '<span class="muted">—</span>' : `<b>${p >= 10 ? Math.round(p) : p.toFixed(1)}</b><div class="s muted">${traj ? `${traj} comments` : `${fmt(s.comments)} comments${gr.at(-1)?.h ? ` in ${hrs(gr.at(-1).h)}` : ''}`}</div>`}</td>
      <td class="n">${g == null ? '<span class="muted">—</span>' : `${g.toFixed(1)}${g > 2 ? '<div class="s muted">comment gate</div>' : ''}`}</td>
      <td class="s">${STATUS[s.status] || esc(s.status)}${s.status === 'failed' && s.error ? `<div class="muted">${esc(s.error.slice(0, 80))}</div>` : ''}</td>
      <td style="white-space:nowrap">${s.breakdown ? `<button class="btn sm" type="button">Open</button>` : s.status === 'queued' ? '' : `<button class="btn sm" data-swrun="${s.id}">${s.status === 'failed' ? 'Retry' : 'Break down'}</button>`}</td></tr>`; }).join('')}
  </tbody></table>`;
}

export function bindSwipe(root, onChange) {
  thumbs(root);
  // Click anywhere on a broken-down row (image included) to open it.
  $$('[data-swview]', root).forEach(r => { const open = () => openSwipe(swipeRows().find(s => s.id === r.dataset.swview), onChange); r.onclick = open; r.onkeydown = e => { if (e.key === 'Enter') open(); }; });
  $$('[data-swrun]', root).forEach(b => b.onclick = async () => { b.disabled = true; b.textContent = 'Starting…'; await runBreakdown(b.dataset.swrun); onChange(); });
  // While Claude works (a few minutes), check back every 20 s.
  clearInterval(poll);
  if (swipeRows().some(s => s.status === 'queued')) poll = setInterval(async () => { if (!root.isConnected) return clearInterval(poll); const before = swipeRows().filter(s => s.status === 'queued').length; await loadSwipe(); if (swipeRows().filter(s => s.status === 'queued').length !== before) onChange(); }, 20000);
}

async function runBreakdown(id) {
  const { data, error } = await sb.functions.invoke('resource-request', { body: { action: 'breakdown', swipe_id: id } });
  let msg = data?.error; if (error) { try { msg = (await error.context?.json?.())?.error; } catch { } msg = msg || error.message; }
  toast(msg || 'Claude is breaking it down. Takes a few minutes; this page updates itself.');
  await loadSwipe();
}

export function addSwipeModal(onChange) {
  const num = n => `<input class="input" name="${n}" type="number" min="0" inputmode="numeric">`;
  modal({
    title: 'Break down a post', submit: 'Save and break down', wide: true,
    body: `<div class="form">
      <label class="field full">Screenshots of the post (phone screenshots are fine, in order)<input class="input" type="file" name="files" accept="image/png,image/jpeg,image/webp,application/pdf" multiple></label>
      <label class="field full">Caption (paste the whole text, after "…see more")<textarea class="textarea" name="caption" rows="6"></textarea></label>
      <label class="field">Author<input class="input" name="author" placeholder="Name"></label>
      <label class="field">Their followers${num('author_followers')}</label>
      <label class="field">Reactions${num('reactions')}</label>
      <label class="field">Comments${num('comments')}</label>
      <label class="field">Reposts${num('reposts')}</label>
      <label class="field">Posted how long ago (hours; 1d = 24)${num('hours_live')}</label>
      <label class="field full">Link to the post (optional)<input class="input" name="url" placeholder="https://www.linkedin.com/posts/…"></label>
      <label class="field full">Why save it (optional)<input class="input" name="note" placeholder="e.g. 279 comments on 1K followers"></label></div>
      <p class="s muted" style="margin:10px 0 0">Claude reads the screenshots, names the archetype, breaks it into the same parts as our posts and writes a GPT image prompt to rebuild it. A few minutes; counts as one of today's Claude jobs.</p>`,
    async onSubmit(fd, form) {
      const files = [...(form.querySelector('[name=files]').files || [])], caption = String(fd.get('caption') || '').trim();
      if (!files.length && !caption) { toast('Add the screenshots or the caption'); return false; }
      const n = k => { const v = String(fd.get(k) || '').trim(); return v === '' ? null : Number(v); };
      const { data: { session } } = await sb.auth.getSession();
      const author = String(fd.get('author') || '').trim(), same = (caption || author) && swipeRows().find(x => postKey(x) === postKey({ author, caption }));
      if (same) {
        const now = new Date(), h = n('hours_live'), posted = same.posted_at || (h != null ? new Date(now - h * 36e5).toISOString() : null);
        const snap = { at: now.toISOString(), reactions: n('reactions'), comments: n('comments'), reposts: n('reposts') };
        const upd = { posted_at: posted, ...(snap.comments != null || snap.reactions != null ? { snapshots: [...(same.snapshots || []), snap], reactions: snap.reactions ?? same.reactions, comments: snap.comments ?? same.comments, reposts: snap.reposts ?? same.reposts } : {}) };
        const paths = [];
        if (!(same.image_paths || []).length) for (const [i, f] of files.entries()) { const path = `${same.id}/${i + 1}-${f.name.replace(/[^\w.-]+/g, '_')}`; if (!(await sb.storage.from('swipe').upload(path, f, { contentType: f.type, upsert: true })).error) paths.push(path); }
        if (paths.length) upd.image_paths = paths;
        const r = await sb.from('swipe_posts').update(upd).eq('id', same.id); if (r.error) { toast(r.error.message); return false; }
        toast('Already saved: added as a new reading of the same post'); await loadSwipe(); onChange(); return;
      }
      const ins = await sb.from('swipe_posts').insert({ caption: caption || null, author: String(fd.get('author') || '').trim() || null, author_followers: n('author_followers'),
        reactions: n('reactions'), comments: n('comments'), reposts: n('reposts'), hours_live: n('hours_live'), url: String(fd.get('url') || '').trim() || null,
        note: String(fd.get('note') || '').trim() || null, added_by: (session?.user?.email || '').split('@')[0] || null }).select('id').single();
      if (ins.error) { toast(ins.error.message); return false; }
      const paths = [];
      for (const [i, f] of files.entries()) {
        const path = `${ins.data.id}/${i + 1}-${f.name.replace(/[^\w.-]+/g, '_')}`;
        const up = await sb.storage.from('swipe').upload(path, f, { contentType: f.type, upsert: true });
        if (up.error) { toast(`Upload failed: ${up.error.message}`); return false; }
        paths.push(path);
      }
      if (paths.length) await sb.from('swipe_posts').update({ image_paths: paths }).eq('id', ins.data.id);
      // First reading of the numbers, so growth can be tracked when someone updates them later.
      const h = n('hours_live'), now = new Date();
      if (h != null || n('comments') != null) await sb.from('swipe_posts').update({ posted_at: h != null ? new Date(now - h * 36e5).toISOString() : null,
        snapshots: [{ at: now.toISOString(), reactions: n('reactions'), comments: n('comments'), reposts: n('reposts') }] }).eq('id', ins.data.id);
      await runBreakdown(ins.data.id);
      onChange();
    },
  });
}

// One saved post, read like a brief: what it is, why it works, what to copy. JSON only behind the copy buttons.
export function openSwipe(s, onChange = () => {}) {
  if (!s) return;
  const b = s.breakdown || {}, c = b.cover || {}, cp = b.copy || {}, pages = s.recreate?.pages || [];
  const li = a => (a || []).map(x => `<li>${esc(x)}</li>`).join('');
  const line = (k, v) => v ? `<div class="swKV"><span class="muted">${k}</span><span>${v}</span></div>` : '';
  const m = modal({
    title: `${s.author || 'Saved post'} · ${archLabel(s.archetype)}`, submit: null, wide: true,
    body: `<div class="swOpen">
      <div class="swShots">${(s.image_paths || []).map(p => `<span class="swShot" data-swthumb="${esc(p)}"></span>`).join('')}</div>
      <div>
        <p class="s muted" style="margin:0 0 12px">${esc(ARCHETYPES[s.archetype]?.[1] || '')}</p>
        ${line('Results', [s.comments != null && `${fmt(s.comments)} comments`, s.reactions != null && `${fmt(s.reactions)} reactions`, s.author_followers && `${fmt(s.author_followers)} followers`].filter(Boolean).map(esc).join(' · '))}
        ${growth(s).length ? `<h4 class="swH">Growth</h4><table class="tbl swGrowth"><thead><tr><th>After</th><th class="n">Comments</th><th class="n">Likes</th><th class="n">Reposts</th><th class="n">Comments per hour</th></tr></thead><tbody>${growth(s).map(g => `<tr><td>${g.h != null ? hrs(g.h) : esc(String(g.at).slice(0, 10))}</td><td class="n"><b>${fmt(g.comments)}</b></td><td class="n">${fmt(g.reactions)}</td><td class="n">${fmt(g.reposts)}</td><td class="n">${g.perHour != null ? (g.perHour >= 10 ? Math.round(g.perHour) : g.perHour.toFixed(1)) : '—'}</td></tr>`).join('')}</tbody></table>` : ''}
        ${s.caption ? `<h4 class="swH">What the feed shows before "…see more"</h4><p class="swFeed">${esc(feedHook(s.caption))}</p>` : ''}
        ${line('Layout', esc(LAYOUTS[c.layout] || (c.layout || '').replace(/_/g, ' ')))}
        ${line('Cover headline', esc(c.headline || ''))}
        ${line('Hook', esc(cp.hook || ''))}
        ${line('Ask', esc([cp.cta && cp.cta.replace(/_/g, ' '), cp.cta_keyword && `"${cp.cta_keyword}"`, cp.lead_magnet].filter(Boolean).join(' · ')))}
        ${b.why_it_might_work?.length ? `<h4 class="swH">▲ Why it works</h4><ul class="swList">${li(b.why_it_might_work)}</ul>` : ''}
        ${RECIPES[s.archetype] ? `<h4 class="swH">✓ Must keep when we copy it</h4><ul class="swList">${li(RECIPES[s.archetype].keep)}</ul><p class="s muted" style="margin:0 0 8px">Change only: ${esc(RECIPES[s.archetype].swap)}.</p>` : ''}
        ${b.why_it_might_not?.length ? `<h4 class="swH">⚠ Watch out</h4><ul class="swList">${li(b.why_it_might_not)}</ul>` : ''}
        ${b.notes ? `<p class="s muted">${esc(b.notes)}</p>` : ''}
        <div class="row" style="gap:8px;flex-wrap:wrap;margin-top:14px">
          ${RECIPES[s.archetype] && pages.length ? `<button class="btn primary sm" type="button" data-copy="remix">Copy prompt for our version</button>` : ''}
          ${pages.length ? `<button class="btn ${RECIPES[s.archetype] ? '' : 'primary '}sm" type="button" data-copy="prompt">Copy exact-copy prompt${pages.length > 1 ? 's' : ''}</button>` : ''}
          <button class="btn sm" type="button" data-copy="json">Copy breakdown JSON</button>
          <button class="btn sm" type="button" data-swnums>Update numbers</button>
          ${s.url ? `<a class="btn sm ghost" href="${esc(s.url)}" target="_blank" rel="noopener">Open on LinkedIn ↗</a>` : ''}
          <button class="btn sm ghost" type="button" data-swdel>Remove</button>
          ${s.dupes?.length ? `<button class="btn sm ghost" type="button" data-swdupes>Remove ${s.dupes.length} extra cop${s.dupes.length === 1 ? 'y' : 'ies'} of this post</button>` : ''}
        </div>
        ${s.caption ? `<details class="swPit"><summary class="s">Full caption, line breaks as posted</summary><pre class="swCaption">${esc(s.caption)}</pre></details>` : ''}
        ${s.recreate?.gpt_image_pitfalls?.length ? `<details class="swPit"><summary class="s">What GPT image gets wrong here</summary><ul class="swList s">${li(s.recreate.gpt_image_pitfalls)}</ul></details>` : ''}
      </div></div>`,
  });
  thumbs(m.el);
  const copy = async t => { try { await navigator.clipboard.writeText(t); toast('Copied'); } catch { toast('Copy failed'); } };
  $('[data-copy=prompt]', m.el)?.addEventListener('click', () => copy(pages.map((p, i) => (pages.length > 1 ? `Page ${i + 1}:\n` : '') + p.prompt).join('\n\n')));
  $('[data-copy=json]', m.el)?.addEventListener('click', () => copy(JSON.stringify({ must_keep: RECIPES[s.archetype] || null, breakdown: s.breakdown, recreate: s.recreate }, null, 2)));
  $('[data-copy=remix]', m.el)?.addEventListener('click', () => copy(remixPrompt(s)));
  $('[data-swnums]', m.el)?.addEventListener('click', () => { m.close(); updateNumbers(s, onChange); });
  $('[data-swdupes]', m.el)?.addEventListener('click', async () => {
    const r = await sb.from('swipe_posts').delete().in('id', s.dupes.map(d => d.id)); if (r.error) return toast(r.error.message);
    toast('Extra copies removed'); m.close(); await loadSwipe(); onChange();
  });
  $('[data-swdel]', m.el)?.addEventListener('click', async () => {
    if (!confirm(`Remove ${s.author || 'this post'} from the swipe file?`)) return;
    const r = await sb.from('swipe_posts').delete().eq('id', s.id); if (r.error) return toast(r.error.message);
    m.close(); await loadSwipe(); onChange();
  });
}

// A new reading of the numbers: appended to snapshots (never overwrites the earlier ones), so the growth curve builds up.
function updateNumbers(s, onChange) {
  const g = growth(s).at(-1) || {}, num = (n, v) => `<input class="input" name="${n}" type="number" min="0" inputmode="numeric" value="${v ?? ''}">`;
  modal({
    title: `Update numbers · ${s.author || 'saved post'}`, submit: 'Save',
    body: `<div class="form"><label class="field">Comments${num('comments', '')}</label><label class="field">Likes${num('reactions', '')}</label><label class="field">Reposts${num('reposts', '')}</label>
      ${s.posted_at ? '' : '<label class="field">Posted how long ago (hours)<input class="input" name="ago" type="number" min="0"></label>'}</div>
      <p class="s muted" style="margin:10px 0 0">${g.comments != null ? `Last reading: ${fmt(g.comments)} comments, ${fmt(g.reactions)} likes${g.h ? ` after ${hrs(g.h)}` : ''}.` : 'First reading.'}</p>`,
    async onSubmit(fd) {
      const n = k => { const v = String(fd.get(k) || '').trim(); return v === '' ? null : Number(v); }, now = new Date();
      if (n('comments') == null && n('reactions') == null) { toast('Type at least comments or likes'); return false; }
      const posted = s.posted_at || (n('ago') != null ? new Date(now - n('ago') * 36e5).toISOString() : null);
      const snap = { at: now.toISOString(), reactions: n('reactions'), comments: n('comments'), reposts: n('reposts') };
      const r = await sb.from('swipe_posts').update({ snapshots: [...(s.snapshots || []), snap], posted_at: posted, reactions: snap.reactions ?? s.reactions, comments: snap.comments ?? s.comments,
        reposts: snap.reposts ?? s.reposts, hours_live: posted ? Math.round((now - Date.parse(posted)) / 36e4) / 10 : s.hours_live }).eq('id', s.id);
      if (r.error) { toast(r.error.message); return false; }
      toast('Saved'); await loadSwipe(); onChange();
    },
  });
}
