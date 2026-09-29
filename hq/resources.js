// Resources: one button turns a lead-magnet post into its free resource (Notion doc, PDF or Google Sheet list).
// HQ → resource-request edge function → "OuterHaven resource builder" Claude Code routine → result written back.
import { sb, state, esc, $, $$, toast, fail, opts } from './core.js';

const FORMATS = [['notion', 'Notion doc', 'Hub page with subpages, AI CIO style'], ['pdf', 'PDF', 'Branded PDF in Google Drive'], ['list', 'List', 'Scraped with Apify into a Google Sheet']];
const POSTERS = ['Peter Plaut', 'Tengku Harris', 'Chase Hamby', 'Anaz Azlan'];
const FORMAT_LABEL = Object.fromEntries(FORMATS.map(([k, l]) => [k, l]));
const STATUS = { queued: ['Starting', ''], building: ['Building', 'warn'], ready: ['Ready to check', 'good'], failed: ['Failed', 'bad'], cancelled: ['Cancelled', ''] };
const STALE_MIN = 60;

const S = { jobs: [], posts: [], cfg: null, loaded: false, channel: null, format: 'notion', draft: {}, timer: null };
const isAdmin = () => state.role === 'admin';
const minutes = t => Math.max(0, Math.round((Date.now() - new Date(t)) / 60000));
const ago = t => { if (!t) return ''; const m = minutes(t); return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }); };
const who = e => (e || '').split('@')[0].replace(/[._-]+/g, ' ');

async function loadAll() {
  const [jobs, cfg, posts] = await Promise.all([
    sb.from('resource_jobs').select('*').order('created_at', { ascending: false }).limit(40),
    sb.rpc('resource_config'),
    sb.from('daily_ops_posts').select('id,post_text,post_name,media_url,posted_at,work_date,author_name,is_repost').or('is_repost.is.null,is_repost.eq.false').order('work_date', { ascending: false }).limit(40),
  ]);
  S.missing = !!jobs.error;
  S.jobs = jobs.data || []; S.cfg = cfg.data || null; S.posts = (posts.data || []).filter(p => p.post_text);
  S.loaded = true;
}

function subscribe(root) {
  if (S.channel) return;
  S.channel = sb.channel('hq-resources').on('postgres_changes', { event: '*', schema: 'public', table: 'resource_jobs' }, async () => {
    const [jobs, cfg] = await Promise.all([sb.from('resource_jobs').select('*').order('created_at', { ascending: false }).limit(40), sb.rpc('resource_config')]);
    if (!jobs.error) S.jobs = jobs.data; if (!cfg.error) S.cfg = cfg.data;
    if (root.dataset.page === 'resources') drawJobs(root), drawMeter(root);
  }).subscribe();
  // Elapsed times tick while something is building.
  S.timer = setInterval(() => { if (root.dataset.page === 'resources' && S.jobs.some(j => ['queued', 'building'].includes(j.status))) drawJobs(root); }, 30000);
}

export async function renderResources(root) {
  // Re-renders triggered by other data changing must not wipe a half-typed form.
  if ($('#rForm', root)) { drawJobs(root); drawMeter(root); return; }
  if (!S.loaded) { root.innerHTML = '<div class="empty">Loading…</div>'; await loadAll(); if (root.dataset.page !== 'resources') return; }
  root.innerHTML = `<div class="head"><div><h1>Resources</h1><p>Turn a lead-magnet post into its free resource. Claude writes it, checks it and hands you the link.</p></div><div id="rMeter"></div></div>
    ${S.missing ? `<div class="card" style="background:var(--warn-bg);margin-bottom:20px"><div class="body s"><b>Database update needed</b> (<code>supabase/2026-09-30-resources.sql</code>).</div></div>` : ''}
    <div class="res">
      <section class="card"><header><div><h2>New resource</h2><p>Everything Claude needs comes from this form.</p></div></header><form class="body stack" id="rForm" style="gap:16px"></form></section>
      <div class="stack" style="gap:24px"><section class="card"><header><div><h2>Recent</h2><p>Updates live. Check each one before it goes out.</p></div></header><div class="body flush" id="rJobs"></div></section>
      ${isAdmin() ? '<section class="card" id="rSettings"></section>' : ''}</div>
    </div>`;
  drawMeter(root); drawForm(root); drawJobs(root); if (isAdmin()) drawSettings(root);
  subscribe(root);
  loadAll().then(() => { if (root.dataset.page === 'resources') { drawMeter(root); drawJobs(root); } });
}

function drawMeter(root) {
  const c = S.cfg, el = $('#rMeter', root); if (!el || !c) return;
  el.innerHTML = c.connected
    ? `<span class="row s"><i class="dot ${c.used_today >= c.daily_cap ? 'err' : 'ok'}"></i>${c.used_today} of ${c.daily_cap} used today</span>`
    : `<span class="row s"><i class="dot"></i>Not connected to Claude yet</span>`;
  const btn = $('#rGo', root); if (btn) btn.disabled = !canGenerate();
}
const canGenerate = () => S.cfg?.connected && S.cfg.used_today < S.cfg.daily_cap;

function drawForm(root) {
  const f = $('#rForm', root), d = S.draft, list = S.format === 'list';
  const postOpts = S.posts.map(p => [p.id, `${(p.work_date || '').slice(5).split('-').reverse().join('/')} · ${(p.author_name || '').split(' ')[0]} · ${(p.post_name || p.post_text).replace(/\s+/g, ' ').slice(0, 70)}`]);
  f.innerHTML = `
    <div class="field">Format<div class="fmt" role="radiogroup">${FORMATS.map(([k, l, s]) => `<label class="${S.format === k ? 'on' : ''}"><input type="radio" name="format" value="${k}" ${S.format === k ? 'checked' : ''}><b>${l}</b><span>${s}</span></label>`).join('')}</div></div>
    ${postOpts.length ? `<label class="field"><span>Start from a scraped post <span class="muted">(optional)</span></span><select class="select" name="post_id"><option value="">Paste the caption below instead</option>${opts(postOpts, d.post_id)}</select></label>` : ''}
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
    <div class="row" style="justify-content:space-between"><span class="s muted" id="rHint">${S.cfg?.connected ? 'Takes about 5–15 minutes. You can leave this page.' : isAdmin() ? 'Connect Claude in Settings to turn this on.' : 'An admin needs to connect Claude first.'}</span>
      <button class="btn primary" id="rGo" type="submit" ${canGenerate() ? '' : 'disabled'}>Generate</button></div>`;

  const keep = () => { const fd = new FormData(f); Object.assign(d, Object.fromEntries(['post_id', 'poster', 'topic', 'caption', 'list_brief', 'notes'].map(k => [k, fd.get(k) ?? d[k]]))); };
  $$('[name=format]', f).forEach(r => r.onchange = () => { keep(); S.format = r.value; drawForm(root); });
  f.oninput = keep;
  const sel = $('[name=post_id]', f);
  if (sel) sel.onchange = () => {
    const p = S.posts.find(x => x.id === sel.value); keep();
    if (p) { d.caption = p.post_text; d.creative_url = p.media_url || ''; d.post_id = p.id; if (!d.poster) d.poster = POSTERS.find(n => (p.author_name || '').startsWith(n.split(' ')[0])) || ''; d.creative = null; d.creativeName = ''; }
    else { d.creative_url = ''; d.post_id = ''; }
    drawForm(root);
  };
  const drop = $('#rDrop', f), file = $('[name=creative]', f);
  const pick = fl => { if (!fl) return; d.creative = fl; d.creativeName = fl.name; $('#rDropTxt', f).textContent = fl.name; };
  file.onchange = () => pick(file.files[0]);
  drop.ondragover = e => { e.preventDefault(); drop.classList.add('over'); };
  drop.ondragleave = () => drop.classList.remove('over');
  drop.ondrop = e => { e.preventDefault(); drop.classList.remove('over'); pick(e.dataTransfer.files[0]); };
  f.onsubmit = async e => { e.preventDefault(); keep(); await generate(root, f); };
}

async function generate(root, f) {
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
    let msg = data?.error;
    if (error) { try { msg = (await error.context?.json?.())?.error; } catch { } msg = msg || error.message; }
    if (msg) { toast(msg); await refresh(root); return; }
    toast('Claude is on it. The link shows up here when it’s ready.');
    S.draft = {}; drawForm(root); await refresh(root);
  } finally { btn.textContent = 'Generate'; btn.disabled = !canGenerate(); }
}

async function refresh(root) {
  const [jobs, cfg] = await Promise.all([sb.from('resource_jobs').select('*').order('created_at', { ascending: false }).limit(40), sb.rpc('resource_config')]);
  if (!jobs.error) S.jobs = jobs.data; if (!cfg.error) S.cfg = cfg.data;
  drawJobs(root); drawMeter(root);
}

function jobCard(j) {
  const [label, tone] = STATUS[j.status] || [j.status, ''], live = ['queued', 'building'].includes(j.status);
  const stale = live && minutes(j.fired_at || j.created_at) > STALE_MIN;
  const title = j.output_title || j.topic;
  return `<article class="job">
    <div class="row" style="justify-content:space-between;align-items:flex-start;gap:12px">
      <div style="min-width:0"><b class="jt">${j.output_url ? `<a href="${esc(j.output_url)}" target="_blank" rel="noopener">${esc(title)} ↗</a>` : esc(title)}</b>
        <div class="s muted">${esc(FORMAT_LABEL[j.format] || j.format)} · ${esc(j.poster.split(' ')[0])}${j.brand && j.brand !== 'OuterHaven Advisory' ? ' · ' + esc(j.brand) : ''} · asked by <span style="text-transform:capitalize">${esc(who(j.requested_by))}</span> ${esc(ago(j.created_at))}</div></div>
      <span class="tag ${stale ? 'bad' : tone}">${stale ? 'Stuck?' : label}${live && !stale ? ` · ${minutes(j.started_at || j.fired_at || j.created_at)} min` : ''}</span></div>
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

function drawJobs(root) {
  const el = $('#rJobs', root); if (!el) return;
  el.innerHTML = S.jobs.length ? S.jobs.map(jobCard).join('') : '<div class="empty">Nothing yet. Your first resource shows up here.</div>';
  $$('[data-retry]', el).forEach(b => b.onclick = async () => {
    b.disabled = true;
    const { data, error } = await sb.functions.invoke('resource-request', { body: { action: 'retry', id: b.dataset.retry } });
    let msg = data?.error; if (error) { try { msg = (await error.context?.json?.())?.error; } catch { } msg = msg || error.message; }
    toast(msg || 'Started again'); refresh(root);
  });
  $$('[data-cancel]', el).forEach(b => b.onclick = async () => {
    if (!confirm('Mark this as cancelled? If Claude is already building it, it may still finish in Notion or Drive.')) return;
    if (!fail(await sb.from('resource_jobs').update({ status: 'cancelled', progress: null, finished_at: new Date().toISOString() }).eq('id', b.dataset.cancel), 'Cancel')) refresh(root);
  });
}

function drawSettings(root) {
  const el = $('#rSettings', root), c = S.cfg || {};
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
    drawSettings(root); drawMeter(root); drawForm(root);
  };
}
