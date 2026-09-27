// Growth lab: posts (tagged), A/B experiments with creatives, insights, meetings log, sheet history.
import { esc, fmt, pct, fmtDate, today, opts, modal, toast, fail, lightbox, num, $, $$ } from './core.js';
import { store, load, savePost, saveExperiment, deleteExperiment, saveMeeting, deleteMeeting, uploadAsset, assetUrl, removeAsset, accountName } from './data.js';
import { DIMENSIONS, METRIC_DEFS, breakdown, accountBreakdown, sameCreative, boostEffect, commentsNoMeetings, suggestTests, verdict, confidenceLabel } from './insights.js';
import { SOURCES, sheetStatus } from './overview.js';
import { METRICS } from './sheet.js';
import { scraperView, scraperStatus } from './scraper.js';

const TABS = [['scraper', 'Scraper'], ['posts', 'Posts'], ['experiments', 'Experiments'], ['insights', 'Insights'], ['meetings', 'Meetings'], ['sheet', 'Sheet history']];
const EXP_METRICS = [['impressions', 'Impressions'], ['sent', 'Messages sent'], ['comments', 'Comments'], ['reactions', 'Reactions'], ['saves', 'Saves'], ['sends', 'Sends (shares)'], ['replies', 'Replies'], ['dms', 'Inbound DMs'], ['meetings', 'Meetings']];
const VARIABLES = [...Object.values(DIMENSIONS).map(d => d.label), 'Account', 'Boost', 'Other'];
let insightMetric = 'engagement';

const isTagged = p => ['hook', 'creative', 'cta', 'length', 'topic'].some(k => p.tags[k]) || (p.tags.format && !p.autoFormat);
const accountNames = () => store.accounts.map(a => a.owner_name).filter(Boolean);

function migrationBanner() {
  if (!store.missing.size) return '';
  return `<div class="card" style="border-color:#f0d9a8;background:var(--warn-bg);margin-bottom:20px"><div class="body s"><b>Database update needed.</b> Tagging posts, logging meetings and uploading creatives need the new columns and tables (<code>supabase/2026-09-28-growth.sql</code>). Missing: ${esc([...store.missing].join(', '))}.</div></div>`;
}

export function renderGrowth(root, tab = 'posts') {
  if (!TABS.some(t => t[0] === tab)) tab = 'posts';
  root.innerHTML = `<div class="head"><div><h1>Growth</h1><p>LinkedIn content, experiments and what they turn into.</p></div><div class="row" style="gap:16px">${scraperStatus()}${sheetStatus()}</div></div>
    ${migrationBanner()}
    <nav class="tabs">${TABS.map(([k, l]) => `<button class="${k === tab ? 'on' : ''}" data-tab="${k}">${l}</button>`).join('')}</nav><div id="gBody"></div>`;
  $$('[data-tab]', root).forEach(b => b.onclick = () => { location.hash = `#/growth/${b.dataset.tab}`; });
  const body = $('#gBody', root);
  ({ scraper: scraperView, posts: postsView, experiments: experimentsView, insights: insightsView, meetings: meetingsView, sheet: sheetView })[tab](body);
}

// ---------------- Posts ----------------
function tagSummary(p) {
  const t = p.tags, bits = ['format', 'hook', 'creative', 'cta'].map(k => t[k]).filter(Boolean);
  if (p.boostedBy.length) bits.push('Boosted: ' + p.boostedBy.join(', '));
  return bits.length ? bits.map(b => `<span class="tag">${esc(b)}</span>`).join(' ') : '<span class="s muted">Untagged</span>';
}
function postsView(body) {
  const posts = store.posts, tagged = posts.filter(isTagged).length;
  const avg = posts.length ? posts.reduce((n, p) => n + METRIC_DEFS.engagement.get(p), 0) / posts.length : 0;
  body.innerHTML = `<section class="card"><header><div><h2>Posts</h2><p>${posts.length} original posts, scraped automatically. Reshares count as boosts. Add tags so Insights can explain why posts worked.</p></div><div class="row"><select class="select sm" id="pAcct" style="width:auto"><option value="">All accounts</option>${opts(accountNames())}</select></div></header>
  <div class="body flush scroll"><table class="tbl"><thead><tr><th>Post</th><th>Account</th><th>Date</th><th class="n">Comments</th><th class="n">Reactions</th><th class="n">Reposts</th><th class="n">vs avg</th><th class="n">Meetings</th><th>Tags</th><th></th></tr></thead><tbody id="pRows"></tbody></table>${!posts.length ? '<div class="empty">No posts yet. They appear here as the LinkedIn sync picks them up.</div>' : ''}</div></section>`;
  const draw = () => {
    const f = $('#pAcct', body).value;
    $('#pRows', body).innerHTML = posts.filter(p => !f || p.account === f).map(p => {
      const eng = METRIC_DEFS.engagement.get(p), d = avg ? Math.round((eng - avg) / avg * 100) : 0;
      return `<tr><td style="max-width:280px">${p.url ? `<a href="${esc(p.url)}" target="_blank" rel="noopener">${esc(p.name)}</a>` : esc(p.name)}${p.group ? `<div class="s muted">Creative: ${esc(p.group)}</div>` : ''}</td><td>${esc(p.account)}</td><td class="muted" style="white-space:nowrap">${fmtDate(p.date)}</td><td class="n strong">${fmt(p.m.comments)}</td><td class="n">${fmt(p.m.reactions)}</td><td class="n">${fmt(p.m.reposts)}</td><td class="n ${d >= 0 ? 'up' : 'down'}">${d >= 0 ? '+' : ''}${d}%</td><td class="n">${p.meetings || '<span class="muted">0</span>'}</td><td>${tagSummary(p)}</td><td><button class="btn sm" data-edit="${p.id}">Tag</button></td></tr>`;
    }).join('');
    $$('[data-edit]', body).forEach(b => b.onclick = () => editPost(b.dataset.edit));
  };
  $('#pAcct', body).onchange = draw; draw();
}

function editPost(id) {
  const raw = store.rawPosts.find(r => r.id === id), p = store.posts.find(x => x.id === id); if (!raw) return;
  const t = raw.tags || {}, m = raw.metrics || {};
  const sel = (k) => `<label class="field">${DIMENSIONS[k].label}<select class="select" name="t_${k}"><option value="">—</option>${opts(DIMENSIONS[k].values, t[k])}</select></label>`;
  const inp = (k, l) => `<label class="field">${l}<input class="input" type="number" min="0" name="m_${k}" value="${esc(m[k] ?? '')}" ${k === 'comments' ? `placeholder="${esc(raw.commenter_count ?? '')} (synced)"` : ''}></label>`;
  const groups = [...new Set(store.rawPosts.map(r => r.tags?.creative_group).filter(Boolean))];
  modal({ title: p.name, wide: true, submit: 'Save tags', body: `
    <div class="form">
      ${sel('format')}${sel('creative')}${sel('hook')}${sel('cta')}${sel('length')}${sel('topic')}
      <label class="field full">Boosted by<span class="muted" style="font-weight:400">${p.resharedBy.length ? `Reshared by ${esc(p.resharedBy.join(', '))} (detected automatically). Tick anyone else who commented or liked early.` : 'Tick accounts that commented or liked early. Reshares are detected automatically.'}</span><div class="checks">${accountNames().filter(n => n !== p.account && !p.resharedBy.includes(n)).map(n => `<label><input type="checkbox" name="boost" value="${esc(n)}" ${(t.boosted_by || []).includes(n) ? 'checked' : ''}>${esc(n)}</label>`).join('')}</div></label>
      <label class="field full">Creative ID <span class="muted" style="font-weight:400">· use the same ID when the same creative + copy runs on several accounts</span><input class="input" name="group" list="groupList" value="${esc(t.creative_group || '')}" placeholder="e.g. 900-family-offices-map"><datalist id="groupList">${groups.map(g => `<option value="${esc(g)}">`).join('')}</datalist></label>
      <div class="full s muted">Comments, reactions and reposts are scraped. Add the numbers LinkedIn only shows the account owner:</div>
      ${inp('impressions', 'Impressions')}${inp('saves', 'Saves')}${inp('sends', 'Sends')}
      <label class="field full">Notes<textarea class="textarea" name="notes" placeholder="Why do you think it did well or badly?">${esc(t.notes || '')}</textarea></label>
    </div>`,
    onSubmit: async fd => {
      const tags = { ...t };
      for (const k of Object.keys(DIMENSIONS)) if (k !== 'timeslot') { const v = fd.get('t_' + k); if (v) tags[k] = v; else delete tags[k]; }
      tags.boosted_by = fd.getAll('boost'); tags.creative_group = String(fd.get('group') || '').trim() || null; tags.notes = String(fd.get('notes') || '').trim() || null;
      const metrics = { ...m }; for (const k of ['impressions', 'saves', 'sends']) { const v = fd.get('m_' + k); if (v === '' || v == null) delete metrics[k]; else metrics[k] = num(v); }
      if (fail(await savePost(id, { tags, metrics }), 'Save tags')) return false;
      toast('Tags saved'); await load();
    } });
}

// ---------------- Experiments ----------------
async function hydrateThumbs(root) {
  for (const el of $$('[data-thumb]', root)) {
    const url = await assetUrl(el.dataset.thumb); if (!url) continue;
    const img = el.querySelector('img'); img.src = url; img.onclick = () => lightbox(url);
    const dl = await assetUrl(el.dataset.thumb, el.dataset.name || true); const a = el.querySelector('a'); if (dl) a.href = dl;
  }
}
function variantHtml(e, v, win) {
  const m = e['metrics_' + v.toLowerCase()] || {}, assets = (e.assets || []).filter(a => a.variant === v);
  return `<div class="variant ${win ? 'win' : ''}">
    <div class="row"><b>${v}</b>${e['account_' + v.toLowerCase()] ? `<span class="tag">${esc(e['account_' + v.toLowerCase()])}</span>` : ''}${win ? '<span class="tag good">Winner</span>' : ''}</div>
    <div class="s">${esc(e['variant_' + v.toLowerCase()] || '—')}</div>
    <div class="thumbs">${assets.map(a => `<div class="thumb" data-thumb="${esc(a.path)}" data-name="${esc(a.name)}">${/^image\//.test(a.type) ? '<img alt="">' : `<div class="s" style="padding:8px">${esc(a.name)}</div><img alt="" class="hidden">`}<a download title="Download">↓</a><button type="button" class="btn sm ghost" style="position:absolute;top:2px;right:2px;height:20px;padding:0 5px;background:rgba(255,255,255,.9)" data-rm="${esc(a.path)}" data-exp="${e.id}" title="Remove">✕</button></div>`).join('')}
      <label class="drop">+ Add image<input type="file" accept="image/*,video/mp4,application/pdf" multiple hidden data-up="${e.id}" data-variant="${v}"></label></div>
    ${(() => { const has = EXP_METRICS.filter(([k]) => m[k] != null && m[k] !== ''); return has.length ? `<div class="mgrid">${has.map(([k, l]) => `<div><span>${l}</span><b>${fmt(m[k])}</b></div>`).join('')}</div>` : '<div class="s muted">No results entered yet.</div>'; })()}
    ${(() => { const k = e.primary_metric || 'comments', base = m.impressions ? 'impressions' : m.sent ? 'sent' : null; return base && m[k] != null ? `<div class="s muted">${esc((EXP_METRICS.find(x => x[0] === k) || [k, k])[1])} per ${base === 'sent' ? 'message sent' : 'impression'}: ${pct(Number(m[k]), Number(m[base]), 2)}</div>` : ''; })()}
  </div>`;
}
function experimentsView(body) {
  const ex = store.experiments;
  const running = ex.filter(e => e.status !== 'complete'), done = ex.filter(e => e.status === 'complete');
  const card = e => {
    const v = verdict(e), winner = e.winner && e.winner !== 'Tie' ? e.winner : (v.state === 'win' ? v.winner : null);
    return `<article class="card"><header><div><h2>${esc(e.name)}</h2><p>${esc(e.variable || 'Variable not set')} · primary metric: ${esc(e.primary_metric || 'comments')} · started ${fmtDate(e.started_at)}${e.ended_at ? ` · ended ${fmtDate(e.ended_at)}` : ''}</p></div>
      <div class="row"><span class="tag ${v.state === 'win' ? 'good' : v.state === 'lean' ? 'warn' : ''}">${esc(v.text)}</span><button class="btn sm" data-result="${e.id}">Enter results</button><button class="btn sm ghost" data-editexp="${e.id}">Edit</button></div></header>
      ${e.hypothesis ? `<div class="body s" style="padding-top:12px;padding-bottom:12px"><span class="muted">Hypothesis:</span> ${esc(e.hypothesis)}</div>` : ''}
      <div class="variants">${variantHtml(e, 'A', winner === 'A')}${variantHtml(e, 'B', winner === 'B')}</div>
      ${e.learning ? `<div class="body s" style="border-top:1px solid var(--line)"><span class="muted">Learning:</span> ${esc(e.learning)}</div>` : ''}</article>`;
  };
  body.innerHTML = `<div class="row" style="margin-bottom:16px"><div class="grow s muted">${running.length} running · ${done.length} complete. Change one variable at a time. Log impressions so results can be called with confidence.</div><button class="btn primary" id="newExp">New experiment</button></div>
    <div class="stack">${running.map(card).join('')}${done.length ? `<h3 class="s muted" style="margin:8px 0 -8px;font-weight:500">Completed</h3>${done.map(card).join('')}` : ''}${!ex.length ? '<div class="card"><div class="empty">No experiments yet. Start one, or pick a suggestion from Insights.</div></div>' : ''}</div>`;
  $('#newExp', body).onclick = () => editExperiment();
  $$('[data-editexp]', body).forEach(b => b.onclick = () => editExperiment(b.dataset.editexp));
  $$('[data-result]', body).forEach(b => b.onclick = () => enterResults(b.dataset.result));
  $$('[data-up]', body).forEach(inp => inp.onchange = async () => {
    const e = store.experiments.find(x => x.id === inp.dataset.up); if (!e || !inp.files.length) return;
    const lbl = inp.closest('.drop'); lbl.firstChild.textContent = 'Uploading…';
    const assets = [...(e.assets || [])];
    for (const f of inp.files) { const r = await uploadAsset(e.id, inp.dataset.variant, f); if (r.error) { toast('Upload failed: ' + r.error.message); continue; } assets.push(r.asset); }
    if (!fail(await saveExperiment(e.id, { assets }), 'Save image')) toast('Uploaded');
    await load();
  });
  $$('[data-rm]', body).forEach(b => b.onclick = async ev => {
    ev.stopPropagation(); if (!confirm('Remove this image?')) return;
    const e = store.experiments.find(x => x.id === b.dataset.exp);
    await removeAsset(b.dataset.rm);
    if (!fail(await saveExperiment(e.id, { assets: (e.assets || []).filter(a => a.path !== b.dataset.rm) }), 'Remove image')) await load();
  });
  hydrateThumbs(body);
}

export function editExperiment(id, preset = {}) {
  const e = id ? store.experiments.find(x => x.id === id) : { status: 'running', primary_metric: 'comments', ...preset };
  const acc = ['', ...accountNames()];
  const m = modal({ title: id ? 'Edit experiment' : 'New experiment', wide: true, submit: id ? 'Save' : 'Create', body: `
    <div class="form">
      <label class="field full">Name<input class="input" name="name" required value="${esc(e.name || '')}" placeholder="Map creative vs chart creative"></label>
      <label class="field">Variable being tested<select class="select" name="variable">${opts(VARIABLES, e.variable)}</select></label>
      <label class="field">Primary metric<select class="select" name="primary_metric">${opts(EXP_METRICS.map(x => x[0]).filter(x => !['impressions', 'sent'].includes(x)).map(k => [k, EXP_METRICS.find(x => x[0] === k)[1]]), e.primary_metric)}</select></label>
      <label class="field">Variant A<input class="input" name="variant_a" value="${esc(e.variant_a || '')}" placeholder="What's different about A"></label>
      <label class="field">Variant B<input class="input" name="variant_b" value="${esc(e.variant_b || '')}" placeholder="What's different about B"></label>
      <label class="field">Account for A<select class="select" name="account_a">${opts(acc, e.account_a)}</select></label>
      <label class="field">Account for B<select class="select" name="account_b">${opts(acc, e.account_b)}</select></label>
      <label class="field full">Hypothesis<textarea class="textarea" name="hypothesis" placeholder="We think B gets more comments because…">${esc(e.hypothesis || '')}</textarea></label>
      ${id ? '' : `<label class="field">Images for A<input class="input" type="file" name="files_a" accept="image/*,video/mp4,application/pdf" multiple style="padding-top:6px"></label><label class="field">Images for B<input class="input" type="file" name="files_b" accept="image/*,video/mp4,application/pdf" multiple style="padding-top:6px"></label>`}
      <label class="field">Status<select class="select" name="status">${opts([['running', 'Running'], ['planned', 'Planned'], ['complete', 'Complete']], e.status)}</select></label>
    </div>${id ? `<div style="margin-top:16px"><button type="button" class="btn sm danger" id="delExp">Delete experiment</button></div>` : ''}`,
    onSubmit: async fd => {
      const row = Object.fromEntries(['name', 'variable', 'primary_metric', 'variant_a', 'variant_b', 'hypothesis', 'status'].map(k => [k, String(fd.get(k) || '').trim() || null]));
      row.account_a = fd.get('account_a') || null; row.account_b = fd.get('account_b') || null;
      if (!id) row.started_at = today();
      if (row.status === 'complete' && !e.ended_at) row.ended_at = today();
      const r = await saveExperiment(id, row); if (fail(r, 'Save experiment')) return false;
      if (!id) {
        const assets = [];
        for (const [v, key] of [['A', 'files_a'], ['B', 'files_b']]) for (const f of fd.getAll(key)) if (f && f.size) { const u = await uploadAsset(r.data.id, v, f); if (u.error) toast('Upload failed: ' + u.error.message); else assets.push(u.asset); }
        if (assets.length) fail(await saveExperiment(r.data.id, { assets }), 'Save images');
      }
      toast(id ? 'Saved' : 'Experiment created'); await load();
    } });
  $('#delExp', m.el)?.addEventListener('click', async () => {
    if (!confirm('Delete this experiment and its images?')) return;
    for (const a of e.assets || []) await removeAsset(a.path);
    if (!fail(await deleteExperiment(id), 'Delete')) { m.close(); toast('Deleted'); await load(); }
  });
}

function enterResults(id) {
  const e = store.experiments.find(x => x.id === id); if (!e) return;
  const col = v => { const m = e['metrics_' + v] || {}; return EXP_METRICS.map(([k, l]) => `<label class="field">${l}<input class="input" type="number" min="0" name="${v}_${k}" value="${esc(m[k] ?? '')}"></label>`).join(''); };
  modal({ title: `Results · ${e.name}`, wide: true, submit: 'Save results', body: `
    <div class="form"><div class="full s strong">Variant A · ${esc(e.variant_a || '')}</div>${col('a')}<div class="full s strong" style="margin-top:8px">Variant B · ${esc(e.variant_b || '')}</div>${col('b')}
    <label class="field full">What did we learn?<textarea class="textarea" name="learning">${esc(e.learning || '')}</textarea></label>
    <label class="field">Status<select class="select" name="status">${opts([['running', 'Still running'], ['complete', 'Complete']], e.status === 'complete' ? 'complete' : 'running')}</select></label>
    <label class="field">Winner (leave on Auto to use the numbers)<select class="select" name="winner">${opts([['', 'Auto'], 'A', 'B', 'Tie'], e.winner || '')}</select></label></div>`,
    onSubmit: async fd => {
      const pick = v => { const o = { ...(e['metrics_' + v] || {}) }; for (const [k] of EXP_METRICS) { const x = fd.get(`${v}_${k}`); if (x === '' || x == null) delete o[k]; else o[k] = num(x); } return o; };
      const row = { metrics_a: pick('a'), metrics_b: pick('b'), learning: String(fd.get('learning') || '').trim() || null, status: fd.get('status') };
      const auto = verdict({ ...e, ...row }); row.winner = fd.get('winner') || (auto.state === 'win' ? auto.winner : null);
      if (row.status === 'complete' && !e.ended_at) row.ended_at = today();
      if (fail(await saveExperiment(id, row), 'Save results')) return false;
      toast('Results saved'); await load();
    } });
}

// ---------------- Insights ----------------
function insightsView(body) {
  const posts = store.posts, tagged = posts.filter(isTagged).length;
  const md = METRIC_DEFS[insightMetric], fmtV = v => v == null ? '—' : md.rate ? (v * 100).toFixed(2) + '%' : (Math.round(v * 10) / 10).toLocaleString();
  const sugg = suggestTests(posts, store.experiments, insightMetric);
  const dims = Object.entries(DIMENSIONS).map(([k, d]) => ({ k, d, rows: breakdown(posts, k, insightMetric) })).filter(x => x.rows.length);
  const same = sameCreative(posts, insightMetric), boost = boostEffect(posts, insightMetric), accts = accountBreakdown(posts, insightMetric), cnm = commentsNoMeetings(posts);
  const liftTag = l => l == null ? '' : `<span class="tag ${l >= 0.15 ? 'good' : l <= -0.15 ? 'bad' : ''}">${l >= 0 ? '+' : ''}${Math.round(l * 100)}%</span>`;
  const maxOf = rows => Math.max(1e-9, ...rows.map(r => r.median || 0));

  body.innerHTML = `<div class="row" style="margin-bottom:16px"><div class="grow s muted">Format, post time and boosts (reshares) are detected automatically. ${tagged} of ${posts.length} posts have hook/creative/CTA tags. Findings on fewer than 4 posts are marked anecdotal: treat them as hypotheses to test.</div>
    <label class="row s">Measure by <select class="select sm" id="iMetric" style="width:auto">${opts(Object.entries(METRIC_DEFS).map(([k, d]) => [k, d.label]), insightMetric)}</select></label></div>
  <div class="stack">
    <section class="card"><header><div><h2>Suggested A/B tests</h2><p>Ranked by how much each could teach you, based on the gaps in your data.</p></div></header>
      <div class="body flush">${sugg.length ? sugg.map((s, i) => `<div class="insight"><h4>${esc(s.title)} <span class="tag ${s.confidence === 'solid' ? 'good' : s.confidence === 'early' ? 'warn' : ''}">${confidenceLabel[s.confidence]}</span></h4><p>${esc(s.why)}</p><p class="muted">${esc(s.how)}</p><div><button class="btn sm" data-sugg="${i}">Start this test</button></div></div>`).join('') : '<div class="empty">Tag at least a handful of posts (format, hook, creative, CTA, boosts) and suggestions will appear here.</div>'}</div></section>
    <div class="cols">
      ${dims.map(({ k, d, rows }) => `<section class="card"><header><div><h2>${d.label}</h2><p>Median ${md.label.toLowerCase()} per post</p></div></header><div class="body flush"><table class="tbl"><tbody>${rows.map(r => `<tr><td>${esc(r.value)}<div class="s muted">${r.n} post${r.n === 1 ? '' : 's'}</div></td><td style="width:34%"><div class="bar"><i style="width:${(r.median || 0) / maxOf(rows) * 100}%"></i></div></td><td class="n strong">${fmtV(r.median)}</td><td class="n">${liftTag(r.lift)}</td></tr>`).join('')}</tbody></table></div></section>`).join('')}
      <section class="card"><header><div><h2>Accounts</h2><p>Median ${md.label.toLowerCase()} per post</p></div></header><div class="body flush">${accts.length ? `<table class="tbl"><tbody>${accts.map(r => `<tr><td>${esc(r.account)}<div class="s muted">${r.n} posts</div></td><td style="width:34%"><div class="bar"><i style="width:${(r.median || 0) / maxOf(accts) * 100}%"></i></div></td><td class="n strong">${fmtV(r.median)}</td></tr>`).join('')}</tbody></table>` : '<div class="empty">No posts yet.</div>'}</div></section>
      <section class="card"><header><div><h2>Boost effect</h2><p>Posts with vs without an early boost from each account</p></div></header><div class="body flush">${boost.length ? `<table class="tbl"><thead><tr><th>Booster</th><th class="n">With</th><th class="n">Without</th><th class="n">Lift</th></tr></thead><tbody>${boost.map(b => `<tr><td>${esc(b.booster)}<div class="s muted">${b.nWith} vs ${b.nWithout} posts</div></td><td class="n strong">${fmtV(b.medWith)}</td><td class="n">${fmtV(b.medWithout)}</td><td class="n">${liftTag(b.lift)}</td></tr>`).join('')}</tbody></table>` : '<div class="empty">Tick “Boosted by” when tagging posts to measure this.</div>'}</div></section>
      <section class="card"><header><div><h2>Same creative, different account</h2><p>Isolates the audience effect from the creative</p></div></header><div class="body flush">${same.length ? same.map(g => `<div class="insight"><h4>${esc(g.group)}</h4>${g.posts.map(p => `<p class="row"><span class="grow">${esc(p.account)}${p.boostedBy.length ? ` <span class="s muted">· boosted by ${esc(p.boostedBy.join(', '))}</span>` : ''}</span><b>${fmtV(p.value)}</b></p>`).join('')}</div>`).join('') : '<div class="empty">Give posts the same Creative ID when the same creative + copy runs on more than one account.</div>'}</div></section>
      <section class="card"><header><div><h2>Comments, no meetings</h2><p>Loud posts that didn't convert</p></div></header><div class="body flush">${cnm.length ? `<table class="tbl"><tbody>${cnm.slice(0, 8).map(p => `<tr><td>${esc(p.name)}<div class="s muted">${esc(p.account)} · ${esc(p.tags.cta ? 'CTA: ' + p.tags.cta : 'CTA not tagged')}</div></td><td class="n strong">${fmt(p.m.comments)}</td></tr>`).join('')}</tbody></table>` : '<div class="empty">Log meetings in the Meetings tab and pick the post they came from. Then this shows which loud posts didn\'t convert.</div>'}</div></section>
    </div>
  </div>`;
  $('#iMetric', body).onchange = e => { insightMetric = e.target.value; insightsView(body); };
  $$('[data-sugg]', body).forEach(b => b.onclick = () => { const s = sugg[+b.dataset.sugg]; editExperiment(null, { name: s.title.replace(/[“”]/g, '"'), variable: VARIABLES.includes(s.dim) ? s.dim : 'Other', hypothesis: s.why, primary_metric: insightMetric === 'meetings' ? 'meetings' : 'comments' }); });
}

// ---------------- Meetings ----------------
function meetingsView(body) {
  const ms = store.meetings, postOpts = [['', '— none —'], ...store.rawPosts.slice(0, 200).map(r => [r.id, `${accountName(r.account_id)} · ${fmtDate(r.posted_at)} · ${(r.post_name || 'post').slice(0, 50)}`])];
  const byDir = { in: 0, out: 0, other: 0 }; ms.filter(m => m.status !== 'cancelled').forEach(m => byDir[SOURCES[m.source]?.[1] || 'other']++);
  body.innerHTML = `<div class="kpis" style="margin-bottom:20px"><div class="kpi"><label>Meetings logged</label><b>${ms.length}</b></div><div class="kpi"><label>Inbound</label><b>${byDir.in}</b></div><div class="kpi"><label>Outbound</label><b>${byDir.out}</b></div><div class="kpi"><label>Held or qualified</label><b>${ms.filter(m => ['held', 'qualified'].includes(m.status)).length}</b></div></div>
  <section class="card"><header><div><h2>Meetings log</h2><p>One row per meeting, with where it came from. This is what answers “inbound or outbound?”</p></div><button class="btn primary" id="newMtg" ${store.missing.has('growth_meetings') ? 'disabled title="Run the database update first"' : ''}>Log meeting</button></header>
  <div class="body flush scroll"><table class="tbl"><thead><tr><th>Date</th><th>Lead</th><th>Account</th><th>Source</th><th>From post</th><th>Status</th><th></th></tr></thead><tbody>
  ${ms.map(m => { const post = store.rawPosts.find(r => r.id === m.post_id); return `<tr><td class="muted" style="white-space:nowrap">${fmtDate(m.meeting_date)}</td><td class="strong">${esc(m.lead_name || '—')}<div class="s muted">${esc(m.company || '')}</div></td><td>${esc(m.account_name || '—')}</td><td>${esc(SOURCES[m.source]?.[0] || m.source)}</td><td class="s">${post ? esc((post.post_name || 'post').slice(0, 40)) : '<span class="muted">—</span>'}</td><td><span class="tag ${['held', 'qualified'].includes(m.status) ? 'good' : ['no_show', 'cancelled'].includes(m.status) ? 'bad' : ''}">${esc(m.status)}</span></td><td><button class="btn sm ghost" data-mtg="${m.id}">Edit</button></td></tr>`; }).join('')}
  </tbody></table>${!ms.length ? '<div class="empty">No meetings logged yet.</div>' : ''}</div></section>`;
  const edit = id => {
    const m = id ? ms.find(x => x.id === id) : { meeting_date: today(), status: 'booked', source: 'inbound_post' };
    const md = modal({ title: id ? 'Edit meeting' : 'Log meeting', submit: 'Save', body: `<div class="form">
      <label class="field">Date<input class="input" type="date" name="meeting_date" value="${esc(m.meeting_date || today())}" required></label>
      <label class="field">Status<select class="select" name="status">${opts([['booked', 'Booked'], ['held', 'Held'], ['qualified', 'Qualified'], ['no_show', 'No-show'], ['cancelled', 'Cancelled']], m.status)}</select></label>
      <label class="field">Lead name<input class="input" name="lead_name" value="${esc(m.lead_name || '')}"></label>
      <label class="field">Company<input class="input" name="company" value="${esc(m.company || '')}"></label>
      <label class="field">Account that got it<select class="select" name="account_name">${opts(['', ...accountNames()], m.account_name)}</select></label>
      <label class="field">Source<select class="select" name="source">${opts(Object.entries(SOURCES).map(([k, v]) => [k, v[0]]), m.source)}</select></label>
      <label class="field full">From which post (if inbound)<select class="select" name="post_id">${opts(postOpts, m.post_id)}</select></label>
      <label class="field full">Notes<textarea class="textarea" name="notes">${esc(m.notes || '')}</textarea></label></div>
      ${id ? '<div style="margin-top:14px"><button type="button" class="btn sm danger" id="delMtg">Delete</button></div>' : ''}`,
      onSubmit: async fd => {
        const row = Object.fromEntries(['meeting_date', 'status', 'lead_name', 'company', 'account_name', 'source', 'post_id', 'notes'].map(k => [k, String(fd.get(k) || '').trim() || null]));
        if (fail(await saveMeeting(id, row), 'Save meeting')) return false; toast('Saved'); await load();
      } });
    $('#delMtg', md.el)?.addEventListener('click', async () => { if (confirm('Delete this meeting?') && !fail(await deleteMeeting(id), 'Delete')) { md.close(); await load(); } });
  };
  $('#newMtg', body).onclick = () => edit();
  $$('[data-mtg]', body).forEach(b => b.onclick = () => edit(b.dataset.mtg));
}

// ---------------- Sheet history ----------------
let sheetMetric = 'meetingsBooked';
const LABELS = { posts: 'Posts', impressions: 'Impressions', comments: 'Comments', saves: 'Saves', reposts: 'Reposts', sends: 'Sends', connections: 'Connections', followers: 'Followers', repliedComments: 'Replied comments', unrepliedComments: 'Unreplied comments', commentConnections: 'Comment connections', dmsInitiated: 'DMs initiated', dmsFollowedUp: 'DMs followed up', leadsReplied: 'Leads replied', meetingsBooked: 'Meetings booked', meetingsHeld: 'Meetings held' };
function sheetView(body) {
  const s = store.sheet;
  if (!s) { body.innerHTML = `<div class="card"><div class="empty">${store.sheetError ? esc(store.sheetError) : 'Loading sheet…'}</div></div>`; return; }
  const accounts = [...new Set(s.rows.map(r => r.account))], weeks = s.weeks;
  const cell = (a, w) => s.rows.find(r => r.account === a && r.week === w)?.[sheetMetric];
  body.innerHTML = `<section class="card"><header><div><h2>Weekly KPIs by account</h2><p>Straight from the Weekly tab. Empty cells mean the week hasn't been filled in.</p></div><select class="select sm" id="sMetric" style="width:auto">${opts(METRICS.map(k => [k, LABELS[k]]), sheetMetric)}</select></header>
  <div class="body flush scroll"><table class="tbl"><thead><tr><th>Account</th>${weeks.map(w => `<th class="n">${fmtDate(w)}</th>`).join('')}</tr></thead><tbody>
  ${accounts.map(a => `<tr><td class="strong">${esc(a)}</td>${weeks.map(w => { const v = cell(a, w); return `<td class="n">${v == null ? '<span class="muted">·</span>' : fmt(v)}</td>`; }).join('')}</tr>`).join('')}
  <tr><td class="strong">Team</td>${weeks.map(w => `<td class="n strong">${fmt(s.rows.filter(r => r.week === w).reduce((n, r) => n + (r[sheetMetric] || 0), 0))}</td>`).join('')}</tr>
  </tbody></table></div></section>`;
  $('#sMetric', body).onchange = e => { sheetMetric = e.target.value; sheetView(body); };
}
