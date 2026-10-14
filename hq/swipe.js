// Swipe file (14 Oct 2026): other people's posts we want to copy, broken down by Claude (routines/breakdown.md) into the same
// parts as our own posts (post-breakdown skill), plus the archetype = the recipe ("fake doc viewer"). Table swipe_posts,
// private bucket 'swipe', job via resource-request action 'breakdown'.
import { sb, esc, fmt, toast, modal, $, $$ } from './core.js';

// Same list and order as .claude/skills/post-breakdown/SKILL.md (archetype). Change both together.
export const ARCHETYPES = {
  fake_doc_viewer: ['Fake doc viewer', 'One image dressed as an open PDF: file bar, page thumbnails, a contents page and a "Comment WORD" button.'],
  contents_cover: ['Contents cover', 'A real document or carousel whose cover is a numbered table of contents.'],
  listicle_slides: ['Listicle slides', 'One item per slide.'],
  framework_diagram: ['Framework diagram', 'One model drawn as boxes and arrows.'],
  data_chart: ['Data chart', 'The chart is the post.'],
  directory_table: ['Directory table', 'A list of named firms or people.'],
  template_preview: ['Template preview', 'A partial look at a tool, sheet or prompt pack.'],
  screenshot_proof: ['Screenshot proof', 'A screenshot of a result, DM or dashboard.'],
  quote_card: ['Quote card', 'One line of text on a plain card.'],
  photo_story: ['Photo story', 'A photo of a person with a story caption.'],
  meme: ['Meme', 'A meme format.'],
  other: ['Other', 'Recipe named in the notes.'],
};
export const archLabel = k => ARCHETYPES[k]?.[0] || (k ? String(k).replace(/_/g, ' ') : 'Not broken down');

let rows = null, poll = null;
export async function loadSwipe() {
  const r = await sb.from('swipe_posts').select('*').order('created_at', { ascending: false }).limit(300);
  rows = r.error ? [] : r.data || [];
  return rows;
}
export const swipeRows = () => rows || [];

// Comments per 1,000 followers = how hard the post worked for its size; comments ÷ reactions over 2 = a comment gate did it.
export const per1k = s => s.author_followers > 0 && s.comments != null ? s.comments / s.author_followers * 1000 : null;
const gate = s => s.reactions > 0 && s.comments != null ? s.comments / s.reactions : null;
const STATUS = { new: '… Not started', queued: '… Claude is breaking it down', ready: '✓ Ready', failed: '✕ Failed' };

async function thumbs(root) {
  for (const el of $$('[data-swthumb]', root)) {
    const { data } = await sb.storage.from('swipe').createSignedUrl(el.dataset.swthumb, 3600);
    if (data?.signedUrl) el.style.backgroundImage = `url("${data.signedUrl}")`;
  }
}

export function swipeTable(list, onChange) {
  if (!list.length) return '<div class="empty">Nothing saved yet. Click "Break down a post", drop the screenshots, paste the caption.</div>';
  return `<table class="tbl swTbl"><thead><tr><th></th><th>Post</th><th>Archetype</th><th class="n">Comments / 1K followers</th><th class="n">Comments ÷ likes</th><th>Status</th><th></th></tr></thead><tbody>
  ${list.map(s => { const p = per1k(s), g = gate(s), img = (s.image_paths || [])[0];
    return `<tr><td>${img ? `<span class="cthumb" data-swthumb="${esc(img)}"></span>` : '<span class="cthumb none">Text</span>'}</td>
      <td style="max-width:300px"><b>${esc(s.author || 'Unknown author')}</b>${s.author_followers ? `<span class="s muted"> · ${fmt(s.author_followers)} followers</span>` : ''}
        <div class="s muted swCap">${esc(s.breakdown?.copy?.hook || (s.caption || '').slice(0, 120))}</div></td>
      <td>${s.archetype ? `<b>${esc(archLabel(s.archetype))}</b>` : '<span class="muted s">—</span>'}</td>
      <td class="n">${p == null ? '<span class="muted">—</span>' : `<b>${p >= 10 ? Math.round(p) : p.toFixed(1)}</b><div class="s muted">${fmt(s.comments)} comments</div>`}</td>
      <td class="n">${g == null ? '<span class="muted">—</span>' : `${g.toFixed(1)}${g > 2 ? '<div class="s muted">comment gate</div>' : ''}`}</td>
      <td class="s">${STATUS[s.status] || esc(s.status)}${s.status === 'failed' && s.error ? `<div class="muted">${esc(s.error.slice(0, 80))}</div>` : ''}</td>
      <td style="white-space:nowrap">${s.breakdown ? `<button class="btn sm" data-swview="${s.id}">Open</button>` : s.status === 'queued' ? '' : `<button class="btn sm" data-swrun="${s.id}">${s.status === 'failed' ? 'Retry' : 'Break down'}</button>`}</td></tr>`; }).join('')}
  </tbody></table>`;
}

export function bindSwipe(root, onChange) {
  thumbs(root);
  $$('[data-swview]', root).forEach(b => b.onclick = () => openSwipe(swipeRows().find(s => s.id === b.dataset.swview)));
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
      <label class="field">Hours since posted${num('hours_live')}</label>
      <label class="field full">Link to the post (optional)<input class="input" name="url" placeholder="https://www.linkedin.com/posts/…"></label>
      <label class="field full">Why save it (optional)<input class="input" name="note" placeholder="e.g. 279 comments on 1K followers"></label></div>
      <p class="s muted" style="margin:10px 0 0">Claude reads the screenshots, names the archetype, breaks it into the same parts as our posts and writes a GPT image prompt to rebuild it. A few minutes; counts as one of today's Claude jobs.</p>`,
    async onSubmit(fd, form) {
      const files = [...(form.querySelector('[name=files]').files || [])], caption = String(fd.get('caption') || '').trim();
      if (!files.length && !caption) { toast('Add the screenshots or the caption'); return false; }
      const n = k => { const v = String(fd.get(k) || '').trim(); return v === '' ? null : Number(v); };
      const { data: { session } } = await sb.auth.getSession();
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
      await runBreakdown(ins.data.id);
      onChange();
    },
  });
}

// One saved post, read like a brief: what it is, why it works, what to copy. JSON only behind the copy buttons.
export function openSwipe(s) {
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
        ${line('Results', [s.comments != null && `${fmt(s.comments)} comments`, s.reactions != null && `${fmt(s.reactions)} reactions`, s.author_followers && `${fmt(s.author_followers)} followers`, s.hours_live && `${s.hours_live} h live`].filter(Boolean).map(esc).join(' · '))}
        ${line('Cover headline', esc(c.headline || ''))}
        ${line('Hook', esc(cp.hook || ''))}
        ${line('Ask', esc([cp.cta && cp.cta.replace(/_/g, ' '), cp.cta_keyword && `"${cp.cta_keyword}"`, cp.lead_magnet].filter(Boolean).join(' · ')))}
        ${b.why_it_might_work?.length ? `<h4 class="swH">▲ Why it works</h4><ul class="swList">${li(b.why_it_might_work)}</ul>` : ''}
        ${b.why_it_might_not?.length ? `<h4 class="swH">⚠ Watch out</h4><ul class="swList">${li(b.why_it_might_not)}</ul>` : ''}
        ${b.notes ? `<p class="s muted">${esc(b.notes)}</p>` : ''}
        <div class="row" style="gap:8px;flex-wrap:wrap;margin-top:14px">
          ${pages.length ? `<button class="btn primary sm" type="button" data-copy="prompt">Copy GPT image prompt${pages.length > 1 ? 's' : ''}</button>` : ''}
          <button class="btn sm" type="button" data-copy="json">Copy breakdown JSON</button>
          ${s.url ? `<a class="btn sm ghost" href="${esc(s.url)}" target="_blank" rel="noopener">Open on LinkedIn ↗</a>` : ''}
        </div>
        ${s.recreate?.gpt_image_pitfalls?.length ? `<details class="swPit"><summary class="s">What GPT image gets wrong here</summary><ul class="swList s">${li(s.recreate.gpt_image_pitfalls)}</ul></details>` : ''}
      </div></div>`,
  });
  thumbs(m.el);
  const copy = async t => { try { await navigator.clipboard.writeText(t); toast('Copied'); } catch { toast('Copy failed'); } };
  $('[data-copy=prompt]', m.el)?.addEventListener('click', () => copy(pages.map((p, i) => (pages.length > 1 ? `Page ${i + 1}:\n` : '') + p.prompt).join('\n\n')));
  $('[data-copy=json]', m.el)?.addEventListener('click', () => copy(JSON.stringify({ breakdown: s.breakdown, recreate: s.recreate }, null, 2)));
}
