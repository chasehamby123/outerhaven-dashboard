// LinkedIn scraper controls: auto on/off, schedule, budget, manual run, run log.
import { sb, state, esc, $, $$, toast, fail, opts } from './core.js';
import { store, load } from './data.js';

const FREQ = [['daily', 'Once a day'], ['twice_daily', 'Twice a day'], ['every_6h', 'Every 6 hours'], ['weekly', 'Once a week (Monday)']];
const hourLabel = h => `${((h + 11) % 12) + 1}:00 ${h >= 12 ? 'PM' : 'AM'}`;
const money = n => '$' + Number(n || 0).toFixed(2);
const ago = t => { if (!t) return 'never'; const m = Math.round((Date.now() - new Date(t)) / 60000); return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`; };

export function monthSpend() {
  const start = new Date(); start.setDate(1); start.setHours(0, 0, 0, 0);
  const runs = store.runs.filter(r => r.status !== 'skipped' && new Date(r.started_at) >= start);
  return { runs: runs.length, spent: runs.reduce((n, r) => n + Number(r.cost_usd || 0), 0) };
}
function nextRun(s) {
  if (!s?.scrape_enabled) return null;
  const f = FREQ.find(x => x[0] === s.scrape_frequency)?.[1] || s.scrape_frequency;
  return s.scrape_frequency === 'every_6h' ? f : `${f} at ${hourLabel(s.scrape_hour)}${s.scrape_frequency === 'twice_daily' ? ` and ${hourLabel((s.scrape_hour + 12) % 24)}` : ''}`;
}

// One-line status used in page headers.
export function scraperStatus() {
  const s = store.settings; if (!s) return '';
  const last = store.runs.find(r => r.status !== 'skipped');
  return `<a class="row s" href="#/growth/scraper" style="text-decoration:none"><i class="dot ${s.scrape_enabled ? 'ok' : ''}"></i><span>Scraper ${s.scrape_enabled ? 'on' : 'off'} · last run ${esc(ago(last?.started_at))}</span></a>`;
}

let running = false;
async function invoke(body) {
  const { data, error } = await sb.functions.invoke('daily-ops-linkedin-sync', { body });
  if (error) { let d = ''; try { const j = await error.context?.json?.(); d = j?.detail || j?.error || j?.message || ''; } catch { } throw new Error(d || error.message || 'Scraper request failed'); }
  if (!data?.ok) throw new Error(data?.detail || data?.message || data?.error || 'Scraper returned an error');
  return data;
}

async function runNow(btn, statusEl) {
  const s = store.settings || { cost_per_run: 0.19, monthly_budget: 15 }, m = monthSpend();
  const over = m.spent + Number(s.cost_per_run) > Number(s.monthly_budget);
  if (!confirm(`Run the LinkedIn scraper now?\n\nCost: ${money(s.cost_per_run)}\nSpent this month: ${money(m.spent)} of ${money(s.monthly_budget)}${over ? '\n\nThis goes over your monthly budget.' : ''}`)) return;
  running = true; btn.disabled = true; btn.textContent = 'Running…';
  const log = await sb.from('growth_scrape_runs').insert({ trigger: 'manual', stage: 'posts', cost_usd: s.cost_per_run }).select().single();
  const runId = log.data?.id;
  const setStatus = t => { if (statusEl) statusEl.textContent = t; };
  try {
    setStatus('1/3 · Checking the scraper connection…'); await invoke({ mode: 'health' });
    setStatus('2/3 · Fetching the latest post from each account…'); const posts = await invoke({ mode: 'posts' });
    setStatus(`3/3 · ${posts.posts_saved || 0} posts updated. Refreshing comments…`); const comments = await invoke({ mode: 'comments' });
    const issues = [...new Set([...(posts.missing_profiles || []), ...(comments.missing_accounts || []), ...(comments.incomplete_accounts || [])].filter(Boolean))];
    if (runId) await sb.from('growth_scrape_runs').update({ status: issues.length ? 'partial' : 'ok', stage: 'done', finished_at: new Date().toISOString(), posts_saved: posts.posts_saved ?? null, profiles_checked: posts.profiles_checked ?? null, comment_threads: comments.comment_posts_processed ?? null, detail: { posts, comments, issues } }).eq('id', runId);
    toast(issues.length ? `Done, with gaps: ${issues.join(', ')}` : 'Scrape complete');
  } catch (e) {
    if (runId) await sb.from('growth_scrape_runs').update({ status: 'failed', finished_at: new Date().toISOString(), detail: { error: e.message } }).eq('id', runId);
    toast('Scrape failed: ' + e.message);
  } finally { running = false; await load(); }
}

async function saveSettings(patch) {
  const r = await sb.from('growth_settings').update({ ...patch, updated_at: new Date().toISOString(), updated_by: state.user?.id || null }).eq('id', 1);
  if (!fail(r, 'Save scraper settings')) { toast('Saved'); await load(); }
}

export function scraperView(body) {
  const s = store.settings, admin = state.role === 'admin';
  if (!s) { body.innerHTML = `<div class="card"><div class="empty">Scraper controls need the database update (growth_settings table).</div></div>`; return; }
  const m = monthSpend(), budgetPct = Math.min(100, m.spent / Math.max(0.01, s.monthly_budget) * 100);
  const lastAuto = store.runs.find(r => r.trigger === 'auto' && r.status !== 'skipped');
  const enabledFor = Date.now() - new Date(s.updated_at || 0), window_ = (s.scrape_frequency === 'weekly' ? 8 : 1.5) * 864e5;
  const stalled = s.scrape_enabled && enabledFor > window_ && (!lastAuto || Date.now() - new Date(lastAuto.started_at) > (s.scrape_frequency === 'weekly' ? 8 : 1.5) * 864e5);
  body.innerHTML = `<div class="cols-2">
  <section class="card"><header><div><h2>Automatic scraping</h2><p>Runs on the server, so it works even when nobody has the dashboard open.</p></div></header>
    <div class="body stack" style="gap:18px">
      <label class="switch"><input type="checkbox" id="scOn" ${s.scrape_enabled ? 'checked' : ''} ${admin ? '' : 'disabled'}><span></span><b>${s.scrape_enabled ? 'On' : 'Off'}</b><span class="muted s">${s.scrape_enabled ? esc(nextRun(s)) + ' · Malaysia time' : 'Nothing runs automatically. Use Run now when you need fresh data.'}</span></label>
      ${stalled ? `<div class="tag bad" style="height:auto;padding:6px 8px;white-space:normal">Auto scraping is on but hasn't run recently. The server timer may not be set up yet.</div>` : ''}
      <div class="form">
        <label class="field">How often<select class="select" id="scFreq" ${admin ? '' : 'disabled'}>${opts(FREQ, s.scrape_frequency)}</select></label>
        <label class="field">At<select class="select" id="scHour" ${admin ? '' : 'disabled'}>${opts([...Array(24).keys()].map(h => [h, hourLabel(h)]), s.scrape_hour)}</select></label>
        <label class="field">Cost per run ($)<input class="input" type="number" step="0.01" min="0" id="scCost" value="${esc(s.cost_per_run)}" ${admin ? '' : 'disabled'}></label>
        <label class="field">Monthly budget cap ($)<input class="input" type="number" step="1" min="0" id="scBudget" value="${esc(s.monthly_budget)}" ${admin ? '' : 'disabled'}></label>
      </div>
      <div class="s muted">When the month's spend reaches the cap, automatic runs stop until the 1st. Manual runs ask first.</div>
    </div></section>
  <section class="card"><header><div><h2>This month</h2><p>${m.runs} run${m.runs === 1 ? '' : 's'}</p></div></header>
    <div class="body stack" style="gap:14px">
      <div><div class="row"><b style="font-size:26px;font-weight:500">${money(m.spent)}</b><span class="muted">of ${money(s.monthly_budget)} budget</span></div><div class="bar" style="margin-top:8px"><i style="width:${budgetPct}%;${budgetPct >= 90 ? 'background:var(--bad)' : ''}"></i></div></div>
      <div class="row"><button class="btn primary" id="scRun" ${admin && !running ? '' : 'disabled'}>${running ? 'Running…' : `Run now · ${money(s.cost_per_run)}`}</button></div>
      <div class="s muted" id="scStatus">Scrapes the latest post and comments for every mapped LinkedIn account.</div>
    </div></section></div>
  <section class="card" style="margin-top:24px"><header><div><h2>Run history</h2><p>Every scrape, what it cost and what came back</p></div></header>
    <div class="body flush scroll"><table class="tbl"><thead><tr><th>When</th><th>Type</th><th>Result</th><th class="n">Posts</th><th class="n">Comment threads</th><th class="n">Cost</th><th>Notes</th></tr></thead><tbody>
    ${store.runs.slice(0, 40).map(r => `<tr><td class="muted" style="white-space:nowrap">${new Date(r.started_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</td><td>${r.trigger === 'auto' ? 'Auto' : 'Manual'}</td>
      <td><span class="tag ${r.status === 'ok' ? 'good' : r.status === 'failed' ? 'bad' : r.status === 'running' ? '' : 'warn'}">${r.status === 'running' ? `running · ${esc(r.stage || '')}` : esc(r.status)}</span></td>
      <td class="n">${r.posts_saved ?? '—'}</td><td class="n">${r.comment_threads ?? '—'}</td><td class="n">${r.status === 'skipped' ? '—' : money(r.cost_usd)}</td>
      <td class="s muted" style="max-width:320px">${esc(r.detail?.error || r.detail?.reason || (r.detail?.issues?.length ? 'Check: ' + r.detail.issues.join(', ') : ''))}</td></tr>`).join('')}
    </tbody></table>${!store.runs.length ? '<div class="empty">No runs yet.</div>' : ''}</div></section>`;
  if (!admin) return;
  $('#scOn', body).onchange = e => saveSettings({ scrape_enabled: e.target.checked });
  $('#scFreq', body).onchange = e => saveSettings({ scrape_frequency: e.target.value });
  $('#scHour', body).onchange = e => saveSettings({ scrape_hour: Number(e.target.value) });
  $('#scCost', body).onchange = e => saveSettings({ cost_per_run: Number(e.target.value) || 0 });
  $('#scBudget', body).onchange = e => saveSettings({ monthly_budget: Number(e.target.value) || 0 });
  $('#scRun', body).onclick = e => runNow(e.target, $('#scStatus', body));
}
