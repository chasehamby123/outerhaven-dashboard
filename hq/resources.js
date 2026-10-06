// Resources: the library of lead-magnet resources and the queue of posts that still need one.
// Generate → resource-request edge function → "OuterHaven resource builder" Claude Code routine → result written back.
// Resources made outside HQ can be logged by link. Posts link to resources automatically (caption match) or by hand.
import { sb, state, esc, $, $$, toast, fail, opts, modal } from './core.js';
import { renderTeasers } from './teasers.js';

const FORMATS = [['notion', 'Notion doc', 'Hub page with subpages, AI CIO style'], ['pdf', 'PDF', 'Branded PDF in Google Drive'], ['list', 'List', 'Scraped with Apify into a Google Sheet']];
const POSTERS = ['Peter Plaut', 'Tengku Harris', 'Chase Hamby', 'Anaz Azlan'];
const FORMAT_LABEL = { ...Object.fromEntries(FORMATS.map(([k, l]) => [k, l])), other: 'Other' };
const STATUS = { queued: ['Starting', ''], building: ['Building', 'warn'], ready: ['Ready', 'good'], failed: ['Failed', 'bad'], cancelled: ['Cancelled', ''] };
const TABS = [['queue', 'Needs a resource'], ['library', 'Library'], ['new', 'Generate'], ['teasers', 'Deal teasers']];
const STALE_MIN = 60, QUEUE_DAYS = 45;
const LEAD_MAGNET = /\b(comment|steal|free|dm me|template|blueprint|playbook|guide|checklist|prompts?|resource|swipe|cheat ?sheet|framework)\b/i;

const S = { jobs: [], posts: [], accounts: {}, cfg: null, loaded: false, channel: null, format: 'notion', draft: {}, q: '' };
const isAdmin = () => state.role === 'admin';
const isResource = j => (j.kind || 'resource') === 'resource' && !['teaser', 'chat'].includes(j.payload?.type); // analysis + teaser jobs share the table
const minutes = t => Math.max(0, Math.round((Date.now() - new Date(t)) / 60000));
const ago = t => { if (!t) return ''; const m = minutes(t); return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }); };
const day = d => d ? new Date(d + (d.length === 10 ? 'T12:00:00' : '')).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—';
const who = e => (e || '').split('@')[0].replace(/[._-]+/g, ' ');
const first = s => String(s || '').trim().split(/\s+/)[0];
const acct = p => S.accounts[p.account_id] || p.author_name || '—';
const posterFor = name => POSTERS.find(n => first(n).toLowerCase() === first(name).toLowerCase()) || '';
const snippet = (t, n = 90) => { const s = String(t || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
const errMsg = async (data, error) => { let m = data?.error; if (error) { try { m = (await error.context?.json?.())?.error; } catch { } m = m || error.message; } return m; };

const linkedJob = postId => S.jobs.find(j => j.post_id === postId && j.status !== 'cancelled');
const postById = id => S.posts.find(p => p.id === id);
function queue() {
  const cutoff = new Date(Date.now() - QUEUE_DAYS * 864e5).toISOString().slice(0, 10);
  return S.posts.filter(p => p.work_date >= cutoff && !p.tags?.no_resource && !linkedJob(p.id))
    .map(p => ({ ...p, likely: LEAD_MAGNET.test(p.post_text || '') }))
    .sort((a, b) => (b.likely - a.likely) || String(b.work_date).localeCompare(String(a.work_date)));
}

async function loadAll() {
  const [jobs, cfg, posts, accts] = await Promise.all([
    sb.from('resource_jobs').select('*').order('created_at', { ascending: false }).limit(300),
    sb.rpc('resource_config'),
    sb.from('daily_ops_posts').select('id,account_id,post_text,post_name,media_url,work_date,author_name,is_repost,commenter_count,external_comment_count,reaction_count,linkedin_post_url,tags').or('is_repost.is.null,is_repost.eq.false').order('work_date', { ascending: false }).limit(300),
    sb.from('daily_ops_accounts').select('id,owner_name'),
  ]);
  S.missing = !!jobs.error;
  S.jobs = (jobs.data || []).filter(isResource); S.cfg = cfg.data || null; S.posts = (posts.data || []).filter(p => p.post_text);
  S.accounts = Object.fromEntries((accts.data || []).map(a => [a.id, a.owner_name]));
  S.loaded = true;
}
async function refresh() {
  const [jobs, cfg, posts] = await Promise.all([
    sb.from('resource_jobs').select('*').order('created_at', { ascending: false }).limit(300), sb.rpc('resource_config'),
    sb.from('daily_ops_posts').select('id,account_id,post_text,post_name,media_url,work_date,author_name,is_repost,commenter_count,external_comment_count,reaction_count,linkedin_post_url,tags').or('is_repost.is.null,is_repost.eq.false').order('work_date', { ascending: false }).limit(300),
  ]);
  if (!jobs.error) S.jobs = jobs.data.filter(isResource); if (!cfg.error) S.cfg = cfg.data; if (!posts.error) S.posts = posts.data.filter(p => p.post_text);
}

let root, tab = 'queue';
const redraw = () => { if (root?.dataset.page === 'resources') draw(); };
function subscribe() {
  if (S.channel) return;
  S.channel = sb.channel('hq-resources').on('postgres_changes', { event: '*', schema: 'public', table: 'resource_jobs' }, async () => { await refresh(); redrawLive(); }).subscribe();
  setInterval(() => { if (root?.dataset.page === 'resources' && S.jobs.some(j => ['queued', 'building'].includes(j.status))) redrawLive(); }, 30000);
}
// Live updates must not wipe a half-typed Generate form.
const redrawLive = () => { if (root?.dataset.page !== 'resources') return; if (tab === 'new') { drawMeter(); drawRecent(); } else if (tab === 'teasers') drawMeter(); else draw(); };

export async function renderResources(r, sub) {
  root = r; const next = TABS.some(t => t[0] === sub) ? sub : 'queue';
  if (next === tab && tab === 'new' && $('#rForm', root)) { drawMeter(); drawRecent(); return; } // re-render from other data: keep the form
  tab = next;
  if (!S.loaded) { root.innerHTML = '<div class="empty">Loading…</div>'; await loadAll(); if (root.dataset.page !== 'resources') return; }
  draw(); subscribe();
}

function draw() {
  const q = queue(), ready = S.jobs.filter(j => j.status === 'ready');
  const weekAgo = Date.now() - 7 * 864e5, built = S.jobs.filter(j => j.source !== 'manual' && j.status === 'ready' && new Date(j.finished_at || j.created_at) > weekAgo).length;
  const recent = S.posts.filter(p => p.work_date >= new Date(Date.now() - QUEUE_DAYS * 864e5).toISOString().slice(0, 10));
  const aud = p => p.external_comment_count ?? p.commenter_count ?? 0; // audience comments; our own accounts excluded once scraped
  const avg = a => a.length ? Math.round(a.reduce((n, p) => n + aud(p), 0) / a.length) : null;
  const withR = avg(recent.filter(p => linkedJob(p.id))), without = avg(recent.filter(p => !linkedJob(p.id)));
  root.innerHTML = `<div class="head"><div><h1>Resources</h1><p>Every lead-magnet resource, and the posts that still need one.</p></div><div id="rMeter"></div></div>
    ${S.missing ? `<div class="card" style="background:var(--warn-bg);margin-bottom:20px"><div class="body s"><b>Database update needed</b> (<code>supabase/2026-09-30-resources.sql</code>).</div></div>` : ''}
    <div class="kpis" style="margin-bottom:24px">
      <div class="kpi hero"><label>Posts waiting for a resource</label><b>${q.length}</b><small>${q.filter(p => p.likely).length} look like lead magnets · last ${QUEUE_DAYS} days</small></div>
      <div class="kpi"><label>Resources in the library</label><b>${ready.length}</b><small>${ready.filter(j => j.source === 'manual').length} added by hand</small></div>
      <div class="kpi"><label>Built by Claude this week</label><b>${built}</b><small>${S.cfg ? `${S.cfg.used_today} of ${S.cfg.daily_cap} used today` : ''}</small></div>
      <div class="kpi"><label>Avg comments, post with a resource</label><b>${withR ?? '—'}</b><small>${without != null ? `vs ${without} without` : 'No posts yet'}</small></div>
    </div>
    <nav class="tabs">${TABS.map(([k, l]) => `<button class="${k === tab ? 'on' : ''}" data-tab="${k}">${l}${k === 'queue' && q.length ? ` <span class="count">${q.length}</span>` : ''}</button>`).join('')}</nav><div id="rBody"></div>`;
  $$('[data-tab]', root).forEach(b => b.onclick = () => { location.hash = `#/resources/${b.dataset.tab}`; });
  drawMeter();
  const body = $('#rBody', root);
  ({ queue: queueView, library: libraryView, new: newView, teasers: renderTeasers })[tab](body);
}

function drawMeter() {
  const c = S.cfg, el = $('#rMeter', root); if (!el || !c) return;
  el.innerHTML = c.connected
    ? `<span class="row s"><i class="dot ${c.used_today >= c.daily_cap ? 'err' : 'ok'}"></i>Claude connected · ${c.used_today} of ${c.daily_cap} today</span>`
    : `<span class="row s"><i class="dot"></i>Not connected to Claude yet</span>`;
  const btn = $('#rGo', root); if (btn) btn.disabled = !canGenerate();
}
const canGenerate = () => S.cfg?.connected && S.cfg.used_today < S.cfg.daily_cap;

// ---------------- Queue ----------------
function queueView(body) {
  const q = queue();
  body.innerHTML = `<section class="card"><header><div><h2>Posts that need a resource</h2><p>Your own posts from the last ${QUEUE_DAYS} days with no resource linked. Lead-magnet posts first.</p></div></header>
    <div class="body flush scroll">${q.length ? `<table class="tbl"><thead><tr><th>Post</th><th>Account</th><th>Date</th><th class="n">Comments</th><th></th></tr></thead><tbody>
    ${q.map(p => `<tr><td style="max-width:460px">${p.likely ? '<span class="tag warn" style="margin-right:6px">Lead magnet</span>' : ''}${p.linkedin_post_url ? `<a href="${esc(p.linkedin_post_url)}" target="_blank" rel="noopener">${esc(snippet(p.post_name || p.post_text))}</a>` : esc(snippet(p.post_name || p.post_text))}</td>
      <td>${esc(acct(p))}</td><td class="muted" style="white-space:nowrap">${day(p.work_date)}</td><td class="n strong">${p.external_comment_count ?? p.commenter_count ?? 0}</td>
      <td style="white-space:nowrap;text-align:right"><button class="btn sm primary" data-gen="${p.id}">Generate</button> <button class="btn sm" data-link="${p.id}">Add link</button> <button class="btn sm ghost" data-skip="${p.id}" title="This post doesn't need a resource">Not needed</button></td></tr>`).join('')}
    </tbody></table>` : '<div class="empty">Every recent post has a resource, or is marked as not needing one.</div>'}</div></section>
    ${S.posts.some(p => p.tags?.no_resource) ? `<p class="s muted" style="margin-top:12px">${S.posts.filter(p => p.tags?.no_resource).length} posts marked not needed. <button class="link s" id="rShowSkipped">Show them</button></p><div id="rSkipped"></div>` : ''}`;
  $$('[data-gen]', body).forEach(b => b.onclick = () => startFromPost(b.dataset.gen));
  $$('[data-link]', body).forEach(b => b.onclick = () => linkModal({ postId: b.dataset.link }));
  $$('[data-skip]', body).forEach(b => b.onclick = async () => { if (!fail(await sb.rpc('set_post_no_resource', { p_post: b.dataset.skip, p_value: true }), 'Update')) { await refresh(); draw(); toast('Marked not needed'); } });
  const show = $('#rShowSkipped', body);
  if (show) show.onclick = () => {
    $('#rSkipped', body).innerHTML = `<div class="card"><div class="body flush"><table class="tbl"><tbody>${S.posts.filter(p => p.tags?.no_resource).map(p => `<tr><td>${esc(snippet(p.post_name || p.post_text))}</td><td>${esc(acct(p))}</td><td class="muted">${day(p.work_date)}</td><td style="text-align:right"><button class="link s" data-unskip="${p.id}">Put back</button></td></tr>`).join('')}</tbody></table></div></div>`;
    $$('[data-unskip]', body).forEach(b => b.onclick = async () => { if (!fail(await sb.rpc('set_post_no_resource', { p_post: b.dataset.unskip, p_value: false }), 'Update')) { await refresh(); draw(); } });
  };
}

function startFromPost(postId) {
  const p = postById(postId); if (!p) return;
  S.draft = { post_id: p.id, caption: p.post_text, creative_url: p.media_url || '', poster: posterFor(acct(p)), topic: '' };
  location.hash = '#/resources/new';
}

// ---------------- Library ----------------
function libraryView(body) {
  body.innerHTML = `<section class="card"><header><div><h2>Library</h2><p>Every resource, generated or added by hand, with the post it belongs to.</p></div>
      <div class="row"><input class="input sm" id="rSearch" placeholder="Search" style="width:180px" value="${esc(S.q)}"><button class="btn sm" id="rAdd">Add existing resource</button></div></header>
    <div class="body flush scroll"><table class="tbl"><thead><tr><th>Resource</th><th>Format</th><th>Account</th><th>Post</th><th class="n">Comments</th><th>Status</th><th>Added</th><th></th></tr></thead><tbody id="rLib"></tbody></table><div id="rLibEmpty"></div></div></section>
    <section class="card" style="margin-top:24px"><header><div><h2>In progress</h2><p>Updates live while Claude builds.</p></div></header><div class="body flush" id="rJobs"></div></section>`;
  const drawRows = () => {
    const q = S.q.toLowerCase();
    const rows = S.jobs.filter(j => j.status !== 'cancelled' && (!q || [j.output_title, j.topic, j.poster, j.brand, postById(j.post_id)?.post_text].some(v => String(v || '').toLowerCase().includes(q))));
    $('#rLib', body).innerHTML = rows.map(j => {
      const p = postById(j.post_id), [label, tone] = STATUS[j.status] || [j.status, ''];
      return `<tr><td style="max-width:260px">${j.output_url ? `<a href="${esc(j.output_url)}" target="_blank" rel="noopener">${esc(j.output_title || j.topic)}</a>` : esc(j.output_title || j.topic)}<div class="s muted">${j.source === 'manual' ? 'Added by hand' : 'Built by Claude'}${j.requested_by ? ' · ' + esc(who(j.requested_by)) : ''}</div></td>
        <td>${esc(FORMAT_LABEL[j.format] || j.format)}</td><td>${esc(first(j.poster))}</td>
        <td style="max-width:240px">${p ? `<span title="${esc(p.post_text)}">${esc(snippet(p.post_name || p.post_text, 60))}</span>${j.linked_by?.startsWith('auto') ? '<div class="s muted">Linked automatically</div>' : ''}` : '<span class="muted">Not linked</span>'}</td>
        <td class="n">${p ? (p.external_comment_count ?? p.commenter_count ?? 0) : '—'}</td>
        <td><span class="tag ${tone}">${label}</span></td><td class="muted" style="white-space:nowrap">${ago(j.created_at)}</td>
        <td style="text-align:right"><button class="btn sm ghost" data-relink="${j.id}">${p ? 'Change post' : 'Link post'}</button></td></tr>`;
    }).join('');
    $('#rLibEmpty', body).innerHTML = rows.length ? '' : `<div class="empty">${S.q ? 'Nothing matches.' : 'No resources yet. Generate one or add one you already made.'}</div>`;
    $$('[data-relink]', body).forEach(b => b.onclick = () => relinkModal(b.dataset.relink));
  };
  $('#rSearch', body).oninput = e => { S.q = e.target.value; drawRows(); };
  $('#rAdd', body).onclick = () => linkModal({});
  drawRows(); drawRecent();
}

const postOptions = (sel, onlyFree = false) => `<option value="">No post</option>${opts(S.posts.filter(p => !onlyFree || !linkedJob(p.id) || p.id === sel).slice(0, 120).map(p => [p.id, `${day(p.work_date)} · ${first(acct(p))} · ${snippet(p.post_name || p.post_text, 70)}`]), sel)}`;

// Log a resource made outside HQ (optionally for a given post), or link an existing unlinked one.
function linkModal({ postId = '' }) {
  const p = postById(postId), free = S.jobs.filter(j => j.status === 'ready' && !j.post_id);
  modal({ title: p ? 'Add the resource for this post' : 'Add an existing resource', submit: 'Save', body: `<div class="stack" style="gap:14px">
    ${p ? `<div class="s muted">${esc(snippet(p.post_text, 180))}</div>` : ''}
    ${p && free.length ? `<label class="field">Already in the library<select class="select" name="existing"><option value="">No, it's a new one (fill in below)</option>${opts(free.map(j => [j.id, `${j.output_title || j.topic} · ${FORMAT_LABEL[j.format] || j.format}`]))}</select></label>` : ''}
    <div class="form">
      <label class="field full">Link to the resource<input class="input" type="url" name="url" placeholder="https://notion.so/… or a Drive / Sheets link"></label>
      <label class="field">Name<input class="input" name="title" placeholder="e.g. AI CIO"></label>
      <label class="field">Format<select class="select" name="format">${opts([['notion', 'Notion doc'], ['pdf', 'PDF'], ['list', 'List (Sheet)'], ['other', 'Other']])}</select></label>
      <label class="field">Account<select class="select" name="poster">${opts([...new Set([...POSTERS, ...Object.values(S.accounts)])].filter(Boolean).map(n => [n, n]), p ? (posterFor(acct(p)) || acct(p)) : '')}</select></label>
      ${p ? '' : `<label class="field">Post <span class="muted">(optional)</span><select class="select" name="post">${postOptions('', true)}</select></label>`}
    </div></div>`,
    onSubmit: async fd => {
      const existing = fd.get('existing');
      if (existing) { if (fail(await sb.rpc('link_resource', { p_job: existing, p_post: postId }), 'Link')) return false; }
      else {
        const url = String(fd.get('url') || '').trim(), title = String(fd.get('title') || '').trim();
        if (!/^https?:\/\//.test(url)) { toast('Paste the link to the resource'); return false; }
        if (!title) { toast('Give it a name'); return false; }
        const row = { source: 'manual', status: 'ready', output_url: url, output_title: title, topic: title, format: fd.get('format'), poster: fd.get('poster'), post_id: postId || fd.get('post') || null, requested_by: state.user?.email || null, finished_at: new Date().toISOString(), linked_by: state.user?.email || null, linked_at: new Date().toISOString() };
        if (fail(await sb.from('resource_jobs').insert(row), 'Add resource')) return false;
      }
      toast('Saved'); await refresh(); draw();
    },
  });
}

function relinkModal(jobId) {
  const j = S.jobs.find(x => x.id === jobId); if (!j) return;
  modal({ title: j.output_title || j.topic, submit: 'Save', body: `<label class="field">Which post is this resource for?<select class="select" name="post">${postOptions(j.post_id, true)}</select></label>`,
    onSubmit: async fd => { if (fail(await sb.rpc('link_resource', { p_job: jobId, p_post: fd.get('post') || null }), 'Link')) return false; toast('Saved'); await refresh(); draw(); } });
}

// ---------------- Generate ----------------
function newView(body) {
  body.innerHTML = `<div class="res">
      <section class="card"><header><div><h2>Generate a resource</h2><p>Claude writes it, checks it and hands you the link.</p></div></header><form class="body stack" id="rForm" style="gap:16px"></form></section>
      <div class="stack" style="gap:24px"><section class="card"><header><div><h2>In progress</h2><p>Updates live. Check each one before it goes out.</p></div></header><div class="body flush" id="rJobs"></div></section>
      ${isAdmin() ? '<section class="card" id="rSettings"></section>' : ''}</div></div>`;
  drawForm(); drawRecent(); if (isAdmin()) drawSettings();
}

function drawForm() {
  const f = $('#rForm', root); if (!f) return;
  const d = S.draft, list = S.format === 'list';
  const postOpts = S.posts.slice(0, 60).map(p => [p.id, `${day(p.work_date)} · ${first(acct(p))} · ${snippet(p.post_name || p.post_text, 70)}`]);
  f.innerHTML = `
    <div class="field">Format<div class="fmt" role="radiogroup">${FORMATS.map(([k, l, s]) => `<label class="${S.format === k ? 'on' : ''}"><input type="radio" name="format" value="${k}" ${S.format === k ? 'checked' : ''}><b>${l}</b><span>${s}</span></label>`).join('')}</div></div>
    ${postOpts.length ? `<label class="field"><span>From a scraped post <span class="muted">(optional)</span></span><select class="select" name="post_id"><option value="">Not posted yet, paste the caption below</option>${opts(postOpts, d.post_id)}</select></label>` : ''}
    <div class="form">
      <label class="field">Posted by<select class="select" name="poster" required><option value="">Choose…</option>${opts(POSTERS, d.poster)}</select></label>
      <label class="field">Topic<input class="input" name="topic" required maxlength="300" placeholder="e.g. AI deal screening for family offices" value="${esc(d.topic || '')}"></label>
      <label class="field full">Caption<textarea class="textarea" name="caption" required rows="7" placeholder="The LinkedIn post text, exactly as it will go out">${esc(d.caption || '')}</textarea></label>
      ${list ? `<label class="field full">What should the list contain?<textarea class="textarea" name="list_brief" required rows="3" placeholder="e.g. 50 single-family offices in Singapore and Hong Kong that invest in real estate, with AUM, website and a decision-maker">${esc(d.list_brief || '')}</textarea><span class="s muted">Claude picks the Apify scraper itself. Spend is capped at US$5 per list.</span></label>` : ''}
      <div class="field full"><span>Creative <span class="muted">(image or carousel PDF)</span></span>
        <label class="drop" id="rDrop"><input type="file" name="creative" accept="image/*,application/pdf" hidden><span id="rDropTxt">${d.creativeName ? esc(d.creativeName) : d.creative_url ? 'Using the image from the selected post' : 'Click to upload, or drop a file here'}</span></label></div>
      <label class="field full"><span>Facts Claude may use <span class="muted">(optional)</span></span><textarea class="textarea" name="notes" rows="3" placeholder="Real results, numbers or source material. Anything not written here gets a clearly hypothetical example instead.">${esc(d.notes || '')}</textarea></label>
    </div>
    <details class="s"${d.client ? ' open' : ''}><summary>For a client instead of OuterHaven</summary><div class="form" style="margin-top:12px">
      <label class="field">Client brand<input class="input" name="c_name" value="${esc(d.client?.name || '')}"></label>
      <label class="field">Who takes the call<input class="input" name="c_person" value="${esc(d.client?.cta_person || '')}"></label>
      <label class="field">Booking link<input class="input" type="url" name="c_link" value="${esc(d.client?.booking_link || '')}" placeholder="https://cal.com/…"></label>
      <label class="field"><span>Brand colours <span class="muted">(PDF)</span></span><input class="input" name="c_colours" value="${esc(d.client?.colours || '')}" placeholder="#0B1F3A, #C8A24A"></label></div></details>
    <div class="row" style="justify-content:space-between"><span class="s muted">${S.cfg?.connected ? 'Takes about 5–15 minutes. You can leave this page.' : isAdmin() ? 'Connect Claude in Settings to turn this on.' : 'An admin needs to connect Claude first.'}</span>
      <button class="btn primary" id="rGo" type="submit" ${canGenerate() ? '' : 'disabled'}>Generate</button></div>`;

  const keep = () => { const fd = new FormData(f); for (const k of ['post_id', 'poster', 'topic', 'caption', 'list_brief', 'notes']) { const v = fd.get(k); if (v !== null) d[k] = v; } };
  $$('[name=format]', f).forEach(r => r.onchange = () => { keep(); S.format = r.value; drawForm(); });
  f.oninput = keep;
  const sel = $('[name=post_id]', f);
  if (sel) sel.onchange = () => {
    const p = postById(sel.value); keep();
    if (p) { d.caption = p.post_text; d.creative_url = p.media_url || ''; d.post_id = p.id; if (!d.poster) d.poster = posterFor(acct(p)); d.creative = null; d.creativeName = ''; }
    else { d.creative_url = ''; d.post_id = ''; }
    drawForm();
  };
  const drop = $('#rDrop', f), file = $('[name=creative]', f);
  const pick = fl => { if (!fl) return; d.creative = fl; d.creativeName = fl.name; $('#rDropTxt', f).textContent = fl.name; };
  file.onchange = () => pick(file.files[0]);
  drop.ondragover = e => { e.preventDefault(); drop.classList.add('over'); };
  drop.ondragleave = () => drop.classList.remove('over');
  drop.ondrop = e => { e.preventDefault(); drop.classList.remove('over'); pick(e.dataTransfer.files[0]); };
  f.onsubmit = async e => { e.preventDefault(); keep(); await generate(f); };
}

async function generate(f) {
  const d = S.draft, btn = $('#rGo', f), fd = new FormData(f);
  const client = fd.get('c_name')?.trim() ? { name: fd.get('c_name').trim(), cta_person: fd.get('c_person').trim(), booking_link: fd.get('c_link').trim(), colours: fd.get('c_colours').trim() } : null;
  if (client && (!client.cta_person || !client.booking_link)) { toast('For a client, add who takes the call and their booking link.'); return; }
  btn.disabled = true; btn.textContent = 'Starting…';
  try {
    let creative_path = null;
    if (d.creative) {
      const safe = d.creative.name.replace(/[^\w.-]+/g, '-').slice(-80), path = `resources/${Date.now()}-${safe}`;
      const up = await sb.storage.from('growth-assets').upload(path, d.creative, { contentType: d.creative.type });
      if (fail(up, 'Upload creative')) return;
      creative_path = path;
    }
    const job = { format: S.format, poster: d.poster, topic: d.topic, caption: d.caption, list_brief: S.format === 'list' ? d.list_brief : null, notes: d.notes, post_id: d.post_id || null, creative_path, creative_url: creative_path ? null : d.creative_url || null, brand: client ? client.name : 'OuterHaven Advisory', client };
    const { data, error } = await sb.functions.invoke('resource-request', { body: { action: 'create', job } });
    const msg = await errMsg(data, error);
    await refresh();
    if (msg) { toast(msg); drawRecent(); drawMeter(); return; }
    toast('Claude is on it. The link shows up here when it’s ready.');
    S.draft = {}; drawForm(); drawRecent(); drawMeter();
  } finally { btn.textContent = 'Generate'; btn.disabled = !canGenerate(); }
}

function jobCard(j) {
  const [label, tone] = STATUS[j.status] || [j.status, ''], live = ['queued', 'building'].includes(j.status);
  const stale = live && minutes(j.fired_at || j.created_at) > STALE_MIN;
  const title = j.output_title || j.topic;
  return `<article class="job">
    <div class="row" style="justify-content:space-between;align-items:flex-start;gap:12px">
      <div style="min-width:0"><b class="jt">${j.output_url ? `<a href="${esc(j.output_url)}" target="_blank" rel="noopener">${esc(title)} ↗</a>` : esc(title)}</b>
        <div class="s muted">${esc(FORMAT_LABEL[j.format] || j.format)} · ${esc(first(j.poster))}${j.brand && j.brand !== 'OuterHaven Advisory' ? ' · ' + esc(j.brand) : ''} · asked by <span style="text-transform:capitalize">${esc(who(j.requested_by))}</span> ${esc(ago(j.created_at))}</div></div>
      <span class="tag ${stale ? 'bad' : tone}">${stale ? 'Stuck?' : label === 'Ready' ? 'Ready to check' : label}${live && !stale ? ` · ${minutes(j.started_at || j.fired_at || j.created_at)} min` : ''}</span></div>
    ${live ? `<div class="s" style="margin-top:8px">${stale ? `Over ${STALE_MIN} minutes with no result. Open Claude's session to see what happened.` : esc(j.progress || 'Waiting for Claude to start')}</div>` : ''}
    ${j.status === 'failed' && j.error ? `<div class="s" style="margin-top:8px;color:var(--bad)">${esc(j.error)}</div>` : ''}
    ${j.status === 'ready' && j.judgment_calls?.length ? `<div class="s" style="margin-top:10px"><b>Worth a 10-second look</b><ul class="jc">${j.judgment_calls.map(c => `<li>${esc(c)}</li>`).join('')}</ul></div>` : ''}
    <div class="row s" style="margin-top:10px;gap:14px">
      ${j.output_url ? `<a class="btn sm primary" href="${esc(j.output_url)}" target="_blank" rel="noopener">Open</a>` : ''}
      ${j.session_url ? `<a href="${esc(j.session_url)}" target="_blank" rel="noopener" class="muted">Claude’s session ↗</a>` : ''}
      ${isAdmin() && (j.status === 'failed' || stale) ? `<button class="link s" data-retry="${j.id}">Try again</button>` : ''}
      ${isAdmin() && live ? `<button class="link s" data-cancel="${j.id}">Cancel</button>` : ''}
    </div></article>`;
}

// Generated jobs from the last 3 days, plus anything still building or failed.
function drawRecent() {
  const el = $('#rJobs', root); if (!el) return;
  const cutoff = Date.now() - 3 * 864e5;
  const list = S.jobs.filter(j => j.source !== 'manual' && j.status !== 'cancelled' && (['queued', 'building', 'failed'].includes(j.status) || new Date(j.created_at) > cutoff)).slice(0, 12);
  el.innerHTML = list.length ? list.map(jobCard).join('') : '<div class="empty">Nothing building right now.</div>';
  $$('[data-retry]', el).forEach(b => b.onclick = async () => {
    b.disabled = true;
    const { data, error } = await sb.functions.invoke('resource-request', { body: { action: 'retry', id: b.dataset.retry } });
    toast((await errMsg(data, error)) || 'Started again'); await refresh(); drawRecent(); drawMeter();
  });
  $$('[data-cancel]', el).forEach(b => b.onclick = async () => {
    if (!confirm('Mark this as cancelled? If Claude is already building it, it may still finish in Notion or Drive.')) return;
    if (!fail(await sb.from('resource_jobs').update({ status: 'cancelled', progress: null, finished_at: new Date().toISOString() }).eq('id', b.dataset.cancel), 'Cancel')) { await refresh(); drawRecent(); }
  });
}

function drawSettings() {
  const el = $('#rSettings', root), c = S.cfg || {}; if (!el) return;
  el.innerHTML = `<header><div><h2>Settings</h2><p>Admins only.</p></div><span class="row s"><i class="dot ${c.connected ? 'ok' : ''}"></i>${c.connected ? 'Connected' : 'Not connected'}</span></header>
    <form class="body stack" id="rSet" style="gap:14px">
      <div class="s muted">From your routine at <a href="https://claude.ai/code/routines" target="_blank" rel="noopener">claude.ai/code/routines</a> → Edit → API trigger. The token is stored on the server and never shown again.</div>
      <label class="field">Routine URL<input class="input" name="url" placeholder="${c.connected ? 'Saved. Paste a new one to replace it' : 'https://api.anthropic.com/v1/claude_code/routines/trig_…/fire'}" autocomplete="off"></label>
      <label class="field">Routine token<input class="input" type="password" name="token" placeholder="${c.connected ? '••••••••  saved' : 'sk-ant-oat01-…'}" autocomplete="new-password"></label>
      <div class="form">
        <label class="field">Resources per day (team)<input class="input" type="number" min="0" max="50" name="cap" value="${esc(c.daily_cap ?? 6)}"></label>
        <label class="field"><span>Notion parent page <span class="muted">(optional)</span></span><input class="input" type="url" name="notion" value="${esc(c.notion_parent_url || '')}" placeholder="Top level, like AI CIO"></label>
        <label class="field full"><span>Google Drive folder <span class="muted">(optional)</span></span><input class="input" type="url" name="drive" value="${esc(c.drive_folder_url || '')}" placeholder="Default: “OuterHaven Lead Magnets”"></label></div>
      <div class="row" style="justify-content:flex-end"><button class="btn primary" type="submit">Save settings</button></div></form>`;
  $('#rSet', el).onsubmit = async e => {
    e.preventDefault(); const fd = new FormData(e.target), url = fd.get('url').trim(), token = fd.get('token').trim();
    if (url && !/^https:\/\/api\.anthropic\.com\/v1\/claude_code\/routines\/[^/]+\/fire$/.test(url)) { toast('That URL should look like https://api.anthropic.com/v1/claude_code/routines/trig_…/fire'); return; }
    for (const [k, v] of [['ROUTINE_FIRE_URL', url], ['ROUTINE_FIRE_TOKEN', token]]) if (v && fail(await sb.rpc('set_routine_secret', { p_key: k, p_value: v }), 'Save routine')) return;
    const r = await sb.from('growth_settings').update({ resource_daily_cap: Math.max(0, Number(fd.get('cap')) || 0), notion_parent_url: fd.get('notion').trim() || null, drive_folder_url: fd.get('drive').trim() || null, updated_at: new Date().toISOString(), updated_by: state.user?.id || null }).eq('id', 1);
    if (fail(r, 'Save settings')) return;
    toast('Saved'); const cfg = await sb.rpc('resource_config'); if (!cfg.error) S.cfg = cfg.data;
    drawSettings(); drawMeter(); drawForm();
  };
}
