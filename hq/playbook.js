// Growth → Playbook (rebuilt 14 Oct 2026; Tengku: Insights "too messy", Playbook "doesn't tell me what to do").
// One page, top to bottom: what to do this week → archetypes (ours + saved) → swipe file → the evidence, folded.
// Every number is each post vs ITS OWN account's usual post (hq/scoring.js), so Sara's big audience can't crown a factor.
import { sb, esc, fmt, fmtDate, $, $$, acctName, state } from './core.js';
import { store } from './data.js';
import { scorePosts, elementEffects, CONF_TEXT, ELEMENT_GROUPS } from './scoring.js';
import { ARCHETYPES, archLabel, loadSwipe, swipeRows, swipeTable, bindSwipe, addSwipeModal, per1k } from './swipe.js';

// kind: lead magnets and credibility posts have different jobs (comments that become leads vs trust), so they're never pooled.
const view = { arch: '', egroup: '', libOut: 'best', kind: 'lm' };
const signed = x => (x >= 0 ? '+' : '') + Math.round(x * 100) + '%';
const confWord = c => c === 'solid' ? 'solid' : c === 'early' ? 'early signal' : 'anecdote';
let report = null, editExperiment = null, loaded = false;

// Keep / stop: the strongest element on each side with 4+ posts. "No" values are skipped: their "Yes" twin says it better.
function decisions(scored) {
  const fx = elementEffects(scored).filter(e => e.n >= 4 && e.value !== 'No' && e.label !== 'Format');
  return { keep: fx.filter(e => e.effect > 0.05).slice(0, 2), stop: fx.filter(e => e.effect < -0.05).sort((a, b) => a.effect - b.effect).slice(0, 2) };
}

export function playbookView(body, deps = {}) {
  editExperiment = deps.editExperiment || editExperiment;
  const draw = () => {
    const n = k => store.posts.filter(p => p.kind === k).length, untyped = n(null);
    const posts = view.kind ? store.posts.filter(p => p.kind === view.kind) : store.posts, scored = scorePosts(posts, 'engagement'), sw = swipeRows();
    const broken = posts.filter(p => p.breakdown).length, meetings = posts.reduce((n, p) => n + (p.meetings || 0), 0);
    const { keep, stop } = decisions(scored);
    const test = report?.next_tests?.[0];
    const eff = e => `${signed(e.lift)} vs the account's usual post · ${e.n} posts · ${confWord(e.confidence)}`;
    const dcard = (sym, word, cls, list, empty) => `<div class="pdCol ${cls}"><h3><span aria-hidden="true">${sym}</span> ${word}</h3>${list.length ? list.map(e => `<p><b>${esc(e.label)}: ${esc(e.value)}</b><span class="s muted">${esc(eff(e))}</span></p>`).join('') : `<p class="s muted">${empty}</p>`}</div>`;

    // Archetypes: our posts (Claude's breakdown) and saved posts side by side, so an untried recipe with proof stands out.
    const ours = {}; for (const s of scored) { const a = s.post.breakdown?.archetype; if (a) (ours[a] ||= []).push(s); }
    const saved = {}; for (const s of sw) if (s.archetype) (saved[s.archetype] ||= []).push(s);
    const keys = Object.keys(ARCHETYPES).filter(k => ours[k] || saved[k]);
    const archCard = k => {
      const o = ours[k] || [], v = saved[k] || [], lift = o.length ? Math.exp(o.reduce((t, s) => t + s.logLift, 0) / o.length) : null;
      const best = v.filter(s => per1k(s) != null).sort((a, b) => per1k(b) - per1k(a))[0];
      return `<button type="button" class="paCard ${view.arch === k ? 'on' : ''}" data-arch="${k}">
        <b>${esc(archLabel(k))}</b><span class="s muted">${esc(ARCHETYPES[k][1])}</span>
        <span class="paStat">${o.length ? `<span><em>Ours</em> ${o.length} post${o.length === 1 ? '' : 's'} · ${lift >= 1 ? '▲' : '▼'} ${lift.toFixed(1)}× usual</span>` : '<span><em>Ours</em> not tried yet</span>'}
        ${v.length ? `<span><em>Saved</em> ${v.length}${best ? ` · best ${Math.round(per1k(best))} comments per 1K followers` : ''}</span>` : ''}</span></button>`;
    };
    const list = view.arch ? sw.filter(s => s.archetype === view.arch) : sw;

    body.innerHTML = `
    <div class="row pbKind" style="gap:6px;margin-bottom:8px">${[['lm', 'Lead magnet posts', n('lm')], ['cred', 'Credibility posts', n('cred')], ['', 'All posts', store.posts.length]].map(([k, l, c]) => `<button class="btn sm ${view.kind === k ? '' : 'ghost'}" data-kind="${k}" aria-pressed="${view.kind === k}">${l} <b>${c}</b></button>`).join('')}</div>
    ${untyped ? `<p class="s muted" style="margin:0 0 6px">${untyped} post${untyped === 1 ? ' has' : 's have'} no type yet (posted before posts were matched to schedule slots): they only show under All. Set "Lead magnet: Yes / No" on them in Growth → Posts.</p>` : ''}
    <p class="s muted pbStatus">${posts.length} ${view.kind === 'cred' ? 'credibility' : view.kind === 'lm' ? 'lead magnet' : 'of our'} post${posts.length === 1 ? '' : 's'} · ${broken} broken down by Claude · ${meetings} meeting${meetings === 1 ? '' : 's'} linked to a post. Each post is compared with its own account's usual post. Under 4 posts = anecdote.</p>

    <section class="card"><header><div><h2>Do this week</h2><p>${report ? `From the posts so far and Claude's analysis of ${fmtDate(report.week_start)}.` : 'From the posts so far.'}</p></div>
      ${state.role === 'admin' ? `<button class="btn sm" id="pbRun">Run Claude's analysis</button>` : ''}</header>
      <div class="body pdGrid">
        ${dcard('▲', 'Keep doing', 'keep', keep, 'Nothing has helped across 4+ posts yet.')}
        ${dcard('▼', 'Stop doing', 'stop', stop, 'Nothing has hurt across 4+ posts yet.')}
        <div class="pdCol test"><h3><span aria-hidden="true">?</span> Test next</h3>${test ? `<p><b>${esc(test.title)}</b><span class="s muted">${esc([test.account, test.a && `A: ${test.a}`, test.b && `B: ${test.b}`].filter(Boolean).join(' · '))}</span>${test.why ? `<span class="s muted">${esc(test.why)}</span>` : ''}</p>${editExperiment ? '<button class="btn sm" id="pbBook">Book this test</button>' : ''}`
          : keys.some(k => !ours[k] && saved[k]) ? `<p><b>Try a ${esc(archLabel(keys.find(k => !ours[k] && saved[k])))} post</b><span class="s muted">It works for others (see the swipe file) and we haven't posted one.</span></p>` : '<p class="s muted">Run Claude\'s analysis for a test suggestion.</p>'}</div>
      </div>
      ${report?.summary ? `<details class="pdMore"><summary class="s">Claude's full weekly note</summary><div class="body s">${esc(report.summary).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').split(/\n+/).filter(Boolean).map(l => `<p>${l.replace(/^\s*[-*]\s*/, '')}</p>`).join('')}</div></details>` : ''}
    </section>

    <section class="card"><header><div><h2>Archetypes</h2><p>The recipe a post copies (a fake PDF, a contents cover, a framework…), from Claude's breakdown. Click one to filter the swipe file.</p></div></header>
      <div class="body">${keys.length ? `<div class="paGrid">${keys.map(archCard).join('')}</div>` : '<div class="empty">No archetypes yet. Break down a post below, or run Claude\'s analysis to tag ours.</div>'}</div></section>

    <section class="card"><header><div><h2>Swipe file</h2><p>Posts from other people worth copying. Drop the screenshots; Claude names the recipe, says why it works and writes the GPT image prompt.</p></div>
      <div class="row">${view.arch ? `<button class="btn sm ghost" id="pbAll">Show all</button>` : ''}<button class="btn primary sm" id="pbAdd">Break down a post</button></div></header>
      <div class="body flush scroll">${swipeTable(list)}</div></section>

    <details class="card pbEvidence"><summary><h2>Evidence</h2><span class="s muted">Every element ranked, and our best and worst posts</span></summary>
      ${elementsBlock(scored)}
      ${libraryBlock(scored)}
    </details>`;

    $('#pbAdd', body).onclick = () => addSwipeModal(refresh);
    $$('[data-kind]', body).forEach(b => b.onclick = () => { view.kind = b.dataset.kind; draw(); });
    $('#pbAll', body)?.addEventListener('click', () => { view.arch = ''; draw(); });
    $$('[data-arch]', body).forEach(b => b.onclick = () => { view.arch = view.arch === b.dataset.arch ? '' : b.dataset.arch; draw(); });
    $$('[data-eg]', body).forEach(b => b.onclick = e => { e.preventDefault(); view.egroup = b.dataset.eg; draw(); body.querySelector('.pbEvidence').open = true; });
    $$('[data-lib]', body).forEach(b => b.onclick = e => { e.preventDefault(); view.libOut = b.dataset.lib; draw(); body.querySelector('.pbEvidence').open = true; });
    $('#pbBook', body)?.addEventListener('click', () => editExperiment(null, { name: test.title, hypothesis: test.why || '', primary_metric: 'comments' }));
    $('#pbRun', body)?.addEventListener('click', async e => {
      e.target.disabled = true; e.target.textContent = 'Starting…';
      const { data, error } = await sb.functions.invoke('resource-request', { body: { action: 'analysis' } });
      let msg = data?.error; if (error) { try { msg = (await error.context?.json?.())?.error; } catch { } msg = msg || error.message; }
      e.target.textContent = msg ? 'Run Claude\'s analysis' : 'Running (10–20 min)'; if (msg) e.target.disabled = false;
      (await import('./core.js')).toast(msg || 'Claude is analysing. Results land here in 10–20 minutes.');
    });
    bindSwipe(body, draw);
  };
  const refresh = async () => { await loadSwipe(); draw(); };
  // HQ re-renders the page every time a modal closes: draw from what's already loaded straight away (a "Loading…" placeholder
  // collapsed the page while scrolled down = blank screen), then refresh in the background.
  if (loaded) draw(); else body.innerHTML = '<div class="empty">Loading…</div>';
  Promise.all([loadSwipe(), sb.from('growth_reports').select('*').order('created_at', { ascending: false }).limit(1)]).then(([, r]) => { report = r.data?.[0] || null; loaded = true; if (body.isConnected) draw(); });
}

function elementsBlock(scored) {
  const all = elementEffects(scored).filter(e => e.n >= 2 && (!view.egroup || e.group === view.egroup));
  const up = all.filter(e => e.effect > 0.02).slice(0, 10), down = all.filter(e => e.effect < -0.02).sort((a, b) => a.effect - b.effect).slice(0, 10);
  const row = e => `<li title="${esc(CONF_TEXT[e.confidence])}"><b aria-hidden="true">${e.effect >= 0 ? '▲' : '▼'}</b><span><span class="muted">${esc(e.label)}:</span> ${esc(e.value)}</span><em>${signed(e.lift)}</em><small>${e.n} posts</small></li>`;
  return `<div class="body"><div class="row pbEg" style="margin-bottom:12px"><button class="btn sm ${view.egroup ? 'ghost' : ''}" data-eg="">All</button>${Object.entries(ELEMENT_GROUPS).map(([k, l]) => `<button class="btn sm ${view.egroup === k ? '' : 'ghost'}" data-eg="${k}">${esc(l)}</button>`).join('')}</div>
    ${all.length ? `<div class="pbEls"><div><h4>Goes with better posts</h4><ul>${up.map(row).join('') || '<li class="muted">Nothing yet</li>'}</ul></div><div><h4>Goes with worse posts</h4><ul>${down.map(row).join('') || '<li class="muted">Nothing yet</li>'}</ul></div></div>
    <p class="s muted" style="margin:12px 0 0">Correlation, not proof: elements travel together. Turn the strongest into a test that changes only that element.</p>` : '<div class="empty">No elements with 2+ posts yet.</div>'}</div>`;
}

function libraryBlock(scored) {
  const ok = scored.filter(s => s.outcome !== 'too_early');
  const list = [...ok].sort((a, b) => view.libOut === 'worst' ? a.lift - b.lift : b.lift - a.lift).slice(0, 10);
  return `<div class="body flush"><div class="row" style="padding:0 20px 10px;gap:6px"><b class="s grow">Our posts, ranked against their own account</b><button class="btn sm ${view.libOut === 'best' ? '' : 'ghost'}" data-lib="best">Best</button><button class="btn sm ${view.libOut === 'worst' ? '' : 'ghost'}" data-lib="worst">Worst</button></div>
    <div class="scroll"><table class="tbl"><thead><tr><th>Post</th><th>Account</th><th>Archetype</th><th class="n">vs usual</th></tr></thead><tbody>${list.map(s => `<tr><td style="max-width:320px">${s.post.url ? `<a href="${esc(s.post.url)}" target="_blank" rel="noopener">${esc(s.post.name)}</a>` : esc(s.post.name)}<div class="s muted">${fmtDate(s.post.date)} · ${fmt(s.value)} engagement</div></td><td style="white-space:nowrap">${acctName(s.account)}</td><td class="s">${s.post.breakdown?.archetype ? esc(archLabel(s.post.breakdown.archetype)) : '<span class="muted">—</span>'}</td><td class="n"><b>${s.lift >= 1 ? '▲' : '▼'} ${s.lift.toFixed(1)}×</b></td></tr>`).join('') || '<tr><td colspan="4" class="muted">No posts yet.</td></tr>'}</tbody></table></div></div>`;
}
