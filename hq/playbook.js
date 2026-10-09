// Growth → Playbook: which creative / caption factors move results, a predictor for the next draft, and a library of
// winners and flops with the reason each one worked. Engine and method: hq/scoring.js (read its header first).
import { esc, fmt, fmtDate, opts, modal, $, $$, acctName } from './core.js';
import { store } from './data.js';
import { DIMENSIONS, GROUPS, METRIC_DEFS } from './insights.js';
import { scorePosts, factorEffects, explain, predict, recipe, CONF_TEXT } from './scoring.js';

const view = { metric: 'engagement', group: '', showWeak: false, outcome: 'winner', account: '', draft: {} };
const OUT = { converted: ['Booked a meeting', 'good'], winner: ['Winner', 'good'], typical: ['Typical', ''], flop: ['Flop', 'bad'], too_early: ['Too early', 'warn'] };
const signed = x => (x >= 0 ? '+' : '') + Math.round(x * 100) + '%';
const conf = c => `<span class="tag ${c === 'solid' ? 'good' : c === 'early' ? 'warn' : ''}" title="${esc(CONF_TEXT[c])}">${c === 'solid' ? 'Solid' : c === 'early' ? 'Early' : 'Anecdote'}</span>`;

function bar(effect) {
  const w = Math.min(50, Math.abs(effect) / 0.6 * 50); // 0.6 = about +82%: full half-bar
  return `<span class="pbBar" aria-hidden="true"><i class="${effect >= 0 ? 'up' : 'down'}" style="width:${w.toFixed(0)}%;${effect >= 0 ? 'left:50%' : 'right:50%'}"></i></span>`;
}

function factorChip(e) {
  return `<span class="pbF ${e.effect >= 0 ? 'up' : 'down'}" title="${esc(e.dimLabel)}: ${esc(e.value)} · ${e.n} posts · ${esc(CONF_TEXT[e.confidence])}">${esc(e.value)} <b>${signed(e.lift)}</b><small>n=${e.n}</small></span>`;
}

export function playbookView(body) {
  const draw = () => {
    const posts = store.posts, scored = scorePosts(posts, view.metric), fx = factorEffects(scored);
    const tagged = posts.filter(p => Object.keys(DIMENSIONS).some(d => p.tags[d] && d !== 'format' && d !== 'timeslot')).length;
    const meetings = posts.reduce((n, p) => n + (p.meetings || 0), 0);
    const accounts = [...new Set(scored.map(s => s.account))].sort();
    const rec = recipe(fx, 2);

    const shown = fx.filter(e => (!view.group || e.group === view.group) && (view.showWeak || e.n >= 2));
    const table = shown.length ? `<table class="tbl"><thead><tr><th>Factor</th><th>Value</th><th class="n">Posts</th><th class="n">Effect on ${esc(METRIC_DEFS[view.metric].label.toLowerCase())}</th><th></th><th>Confidence</th></tr></thead><tbody>${shown.map(e => `<tr><td class="muted">${esc(e.dimLabel)}</td><td><b>${esc(e.value)}</b></td><td class="n">${e.n}</td><td class="n ${e.effect >= 0 ? 'up' : 'down'}" title="Shrunk toward zero because of small samples. Raw average: ${signed(e.raw)}"><b>${signed(e.lift)}</b></td><td>${bar(e.effect)}</td><td>${conf(e.confidence)}</td></tr>`).join('')}</tbody></table>`
      : '<div class="empty">Nothing to show yet. Tag posts (Posts → Tag) or run Claude\'s weekly analysis so factors exist to compare.</div>';

    const sel = Object.entries(DIMENSIONS).map(([d, def]) => `<label class="field">${esc(def.label)}<select class="select sm" data-d="${d}"><option value="">—</option>${opts(def.values, view.draft[d])}</select></label>`).join('');
    const chosen = Object.fromEntries(Object.entries(view.draft).filter(([, v]) => v));
    const pred = Object.keys(chosen).length ? predict(chosen, fx) : null;

    const lib = scored.filter(s => (view.outcome === 'all' || (view.outcome === 'winner' ? ['winner', 'converted'].includes(s.outcome) : s.outcome === view.outcome)) && (!view.account || s.account === view.account))
      .sort((a, b) => view.outcome === 'flop' ? a.lift - b.lift : b.lift - a.lift).slice(0, 40);

    body.innerHTML = `
    <section class="card pbNote"><div class="body s"><b>Read this as a direction, not a verdict.</b> ${posts.length} original posts, ${tagged} with creative or caption tags, ${meetings} meeting${meetings === 1 ? '' : 's'} linked to a post. Each post is compared with <i>its own account's</i> median (Sara's posts get 4–10× the engagement of the others, so raw numbers would crown whatever Sara posted). Effects are pulled toward zero when the sample is small. Expect it to get sharp at roughly 100 tagged posts. ${meetings ? '' : '<b>Link meetings to the post that caused them</b> (Growth → Meetings) so "converted" can outrank "popular".'}</div></section>

    <section class="card"><header><div><h2>What moves results</h2><p>Average lift against the account's usual post, per factor. Needs 2+ posts to show.</p></div>
      <div class="row"><select class="select sm" id="pbMetric" style="width:auto">${opts(Object.entries(METRIC_DEFS).filter(([k]) => k !== 'meetings').map(([k, v]) => [k, v.label]), view.metric)}</select>
      <select class="select sm" id="pbGroup" style="width:auto"><option value="">All factors</option>${opts(Object.entries(GROUPS), view.group)}</select>
      <label class="s muted" style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="pbWeak" ${view.showWeak ? 'checked' : ''}> show single posts</label></div></header>
      <div class="body flush scroll">${table}</div></section>

    <div class="pbTwo">
    <section class="card"><header><div><h2>Score a draft</h2><p>Pick what the next post will be. Compared with the account's usual post.</p></div><button class="btn sm" id="pbClear" ${pred ? '' : 'disabled'}>Clear</button></header>
      <div class="body"><div class="pbSel">${sel}</div>
      <div class="pbPred" id="pbPred">${!pred ? '<span class="muted s">Choose a few factors to see the prediction.</span>' : `<div class="pbBig ${pred.multiplier >= 1 ? 'up' : 'down'}">${pred.multiplier.toFixed(2)}×</div><div><b>${pred.multiplier >= 1 ? 'Expected above' : 'Expected below'} this account's usual post</b><div class="s muted">${esc(CONF_TEXT[pred.confidence])} · weakest factor has ${pred.n} post${pred.n === 1 ? '' : 's'}. Assumes factors add up independently, which is only roughly true.</div></div>`}</div>
      ${pred ? `<div class="pbWhy">${pred.factors.helps.length ? `<div><h4>Helps</h4>${pred.factors.helps.map(factorChip).join('')}</div>` : ''}${pred.factors.hurts.length ? `<div><h4>Hurts</h4>${pred.factors.hurts.map(factorChip).join('')}</div>` : ''}${pred.factors.neutral.length ? `<div><h4>No clear effect</h4>${pred.factors.neutral.map(e => `<span class="pbF">${esc(e.value)}<small>n=${e.n}</small></span>`).join('')}</div>` : ''}</div>` : ''}</div></section>

    <section class="card"><header><div><h2>The winning recipe</h2><p>Best-performing value of each factor (2+ posts, positive effect).</p></div></header>
      <div class="body">${rec.length ? `<div class="pbWhy">${rec.map(e => `<div class="pbRec"><span class="muted s">${esc(e.dimLabel)}</span>${factorChip(e)}</div>`).join('')}</div><p class="s muted" style="margin:12px 0 0">Use the recipe as the brief for the next creative. Change one factor at a time to find out which one is doing the work (Post experiments).</p>` : '<div class="empty">No factor has a positive effect with 2+ posts yet.</div>'}</div></section>
    </div>

    <section class="card"><header><div><h2>Library</h2><p>Posts ranked against their own account. Click one to see why.</p></div>
      <div class="row"><select class="select sm" id="pbOut" style="width:auto">${opts([['winner', 'Winners & meetings'], ['converted', 'Booked a meeting'], ['flop', 'Flops'], ['typical', 'Typical'], ['all', 'All']], view.outcome)}</select>
      <select class="select sm" id="pbAcct" style="width:auto"><option value="">All accounts</option>${opts(accounts, view.account)}</select></div></header>
      <div class="body flush scroll">${lib.length ? `<table class="tbl"><thead><tr><th>Post</th><th>Account</th><th>Date</th><th class="n">${esc(METRIC_DEFS[view.metric].label)}</th><th class="n">vs account median</th><th>Result</th><th>Factors</th></tr></thead><tbody>${lib.map(s => {
        const o = OUT[s.outcome], tg = Object.keys(DIMENSIONS).map(d => s.post.tags[d]).filter(Boolean).slice(0, 5);
        return `<tr class="pbRow" data-id="${esc(s.post.id)}" tabindex="0"><td style="max-width:260px"><b>${esc(s.post.name)}</b><div class="s muted pbCap">${esc(String(s.post.text || '').slice(0, 110))}</div></td><td style="white-space:nowrap">${acctName(s.account)}</td><td class="muted" style="white-space:nowrap">${fmtDate(s.post.date)}</td><td class="n">${fmt(s.value)}</td><td class="n ${s.lift >= 1 ? 'up' : 'down'}">${s.lift.toFixed(1)}×</td><td><span class="tag ${o[1]}">${o[0]}</span></td><td>${tg.length ? tg.map(t => `<span class="tag">${esc(t)}</span>`).join(' ') : '<span class="s muted">Untagged</span>'}</td></tr>`;
      }).join('')}</tbody></table>` : '<div class="empty">No posts match.</div>'}</div></section>`;

    $('#pbMetric', body).onchange = e => { view.metric = e.target.value; draw(); };
    $('#pbGroup', body).onchange = e => { view.group = e.target.value; draw(); };
    $('#pbWeak', body).onchange = e => { view.showWeak = e.target.checked; draw(); };
    $('#pbOut', body).onchange = e => { view.outcome = e.target.value; draw(); };
    $('#pbAcct', body).onchange = e => { view.account = e.target.value; draw(); };
    $('#pbClear', body).onclick = () => { view.draft = {}; draw(); };
    $$('[data-d]', body).forEach(s => s.onchange = () => { view.draft[s.dataset.d] = s.value; draw(); });
    $$('.pbRow', body).forEach(r => { const open = () => detail(scored.find(s => String(s.post.id) === r.dataset.id), fx); r.onclick = open; r.onkeydown = e => { if (e.key === 'Enter') open(); }; });
  };
  draw();
}

function detail(s, fx) {
  if (!s) return;
  const ex = explain(s.post.tags, fx), o = OUT[s.outcome];
  const sect = (t, list) => list.length ? `<h4>${t}</h4><div class="pbWhy">${list.map(factorChip).join('')}</div>` : '';
  modal({
    title: s.post.name, submit: null, wide: true,
    body: `<div class="row" style="gap:8px;flex-wrap:wrap;margin-bottom:10px">${acctName(s.account)}<span class="tag ${o[1]}">${o[0]}</span><span class="tag">${fmt(s.value)} vs median ${fmt(s.base)} → ${s.lift.toFixed(1)}×</span>${s.post.meetings ? `<span class="tag good">${s.post.meetings} meeting${s.post.meetings === 1 ? '' : 's'}</span>` : ''}${s.post.url ? `<a href="${esc(s.post.url)}" target="_blank" rel="noopener" class="s">Open post ↗</a>` : ''}</div>
    ${s.post.text ? `<blockquote class="pbQuote">${esc(String(s.post.text).slice(0, 700))}</blockquote>` : ''}
    ${Object.values(s.post.tags).some(Boolean) ? `${sect('What probably helped', ex.helps)}${sect('What probably hurt', ex.hurts)}${sect('No clear effect so far', ex.neutral)}` : '<p class="s muted">This post has no tags yet, so there is nothing to explain. Tag it in Posts, or wait for the weekly Claude analysis.</p>'}
    <p class="s muted" style="margin:14px 0 0">Factor numbers are the average effect across every post that shares the factor, not just this one. They suggest a reason; only a controlled test (Post experiments) proves it.</p>`,
  });
}
