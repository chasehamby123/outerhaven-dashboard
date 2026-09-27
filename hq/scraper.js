// LinkedIn scraper controls, on top of the existing daily-ops-linkedin-auto function.
// pg_cron calls it every 30 min; it paces Apify spend across the month and obeys growth_settings.
import { sb, state, esc, $, toast, fail } from './core.js';
import { store, load } from './data.js';

const money = n => '$' + Number(n || 0).toFixed(2);
const ago = t => { if (!t) return 'never'; const m = Math.round((Date.now() - new Date(t)) / 60000); return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`; };
const isRun = r => !String(r.run_mode).startsWith('skip');
const isError = r => String(r.run_mode).startsWith('error');
const LABEL = { posts: 'Posts', comments: 'Comments', manual_posts: 'Posts (manual)', manual_comments: 'Comments (manual)', skip_budget: 'Skipped: budget', skip_disabled: 'Auto scraping off', skip_pace: 'Waiting (pacing)' };
const label = m => LABEL[m] || LABEL[m.replace(/_partial$/, '')] ? (LABEL[m] || LABEL[m.replace(/_partial$/, '')] + ' · partial') : m.startsWith('error_') ? `Failed: ${LABEL[m.slice(6)] || m.slice(6)}` : m;

// Real cost per run, measured from Apify usage between consecutive runs in the same cycle.
export function costPerRun() {
  const runs = store.scrapeLog.filter(isRun).filter(r => r.usage_before != null).slice(0, 30);
  const diffs = [];
  for (let i = 0; i < runs.length - 1; i++) { const d = Number(runs[i].usage_before) - Number(runs[i + 1].usage_before); if (d > 0 && d < 2) diffs.push(d); }
  if (!diffs.length) return null;
  diffs.sort((a, b) => a - b); return diffs[diffs.length >> 1];
}
function latestStatus() { const r = store.scrapeLatest; return r?.detail || null; }

export function scraperStatus() {
  const s = store.settings; if (!s) return '';
  const lastRun = store.scrapeLog.find(isRun);
  const failing = lastRun && isError(lastRun);
  return `<a class="row s" href="#/growth/scraper" style="text-decoration:none"><i class="dot ${failing ? 'err' : s.scrape_enabled ? 'ok' : ''}"></i><span>Scraper ${s.scrape_enabled ? 'on' : 'off'}${failing ? ' · last run failed' : ` · last run ${esc(ago(lastRun?.created_at))}`}</span></a>`;
}

let running = false;
async function invoke(body) {
  const { data, error } = await sb.functions.invoke('daily-ops-linkedin-auto', { body });
  if (error) { let d = ''; try { const j = await error.context?.json?.(); d = j?.detail || j?.error || ''; } catch { } throw new Error(d || error.message); }
  if (data?.ran === false && data?.reason) throw new Error(data.detail || data.reason.replaceAll('_', ' '));
  if (data?.ok === false) throw new Error(data.detail || data.error || 'Scraper error');
  return data;
}

async function runNow(btn, statusEl) {
  const st = latestStatus(), cpr = costPerRun() ?? 0.1, used = Number(st?.usage_usd || 0), budget = Number(store.settings?.monthly_budget || 19);
  if (!confirm(`Run the LinkedIn scraper now?\n\nPosts + comments: about ${money(cpr * 2)} (2 runs at ~${money(cpr)})\nApify spend this billing month: ${money(used)} of ${money(budget)}`)) return;
  running = true; btn.disabled = true; btn.textContent = 'Running…';
  const say = t => { if (statusEl) statusEl.textContent = t; };
  try {
    say('1/2 · Fetching the latest post from every account (about a minute)…');
    const p = await invoke({ mode: 'posts' });
    say(`2/2 · ${p.result?.posts_saved ?? 0} posts updated. Fetching comments…`);
    const c = await invoke({ mode: 'comments' });
    const errs = [...(p.result?.errors || []), ...(c.result?.errors || [])];
    say(errs.length ? `Done with ${errs.length} problem(s): ${errs.join('; ')}` : `Done · ${p.result?.posts_saved ?? 0} posts, ${c.result?.comment_posts_processed ?? 0} comment threads refreshed.`);
    toast(errs.length ? 'Scrape finished with problems' : 'Scrape complete');
  } catch (e) { say('Failed: ' + e.message); toast('Scrape failed: ' + e.message); }
  finally { running = false; btn.disabled = false; await load(); }
}

async function saveSettings(patch) {
  const r = await sb.from('growth_settings').update({ ...patch, updated_at: new Date().toISOString(), updated_by: state.user?.id || null }).eq('id', 1);
  if (!fail(r, 'Save scraper settings')) { toast('Saved'); await load(); }
}

export function scraperView(body) {
  const s = store.settings, admin = state.role === 'admin';
  if (!s) { body.innerHTML = `<div class="card"><div class="empty">Scraper controls need the database update (growth_settings).</div></div>`; return; }
  const st = latestStatus(), used = Number(st?.usage_usd ?? 0), budget = Number(s.monthly_budget), cpr = costPerRun();
  const pct = Math.min(100, used / Math.max(0.01, budget) * 100);
  const runs = store.scrapeLog.filter(isRun), lastRun = runs[0], lastOk = runs.find(r => !isError(r));
  let streak = 0; for (const r of runs) { if (isError(r)) streak++; else break; }
  const interval = st?.recommended_average_interval_minutes, resets = st?.usage_cycle_end ? new Date(st.usage_cycle_end).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : null;
  body.innerHTML = `${streak >= 2 ? `<div class="card" style="border-color:#f1c7c3;background:var(--bad-bg);margin-bottom:20px"><div class="body s"><b>The last ${streak} runs failed</b> and each still used Apify credit. Latest error: ${esc(lastRun?.detail?.error || '')}. Last successful run: ${esc(ago(lastOk?.created_at))}.</div></div>` : ''}
  <div class="cols-2">
  <section class="card"><header><div><h2>Automatic scraping</h2><p>Runs on the server every 30 minutes when it's on. Nobody needs to be logged in.</p></div></header>
    <div class="body stack" style="gap:18px">
      <label class="switch"><input type="checkbox" id="scOn" ${s.scrape_enabled ? 'checked' : ''} ${admin ? '' : 'disabled'}><span></span><b>${s.scrape_enabled ? 'On' : 'Off'}</b><span class="muted s">${s.scrape_enabled ? `Spreads the budget evenly over the month${interval ? `: about one run every ${interval >= 90 ? (interval / 60).toFixed(1) + ' hours' : Math.round(interval) + ' min'}` : ''}.` : 'Nothing runs on its own. Use Run now when you want fresh data.'}</span></label>
      <div class="form"><label class="field">Monthly budget ($)<input class="input" type="number" min="0" step="1" id="scBudget" value="${esc(budget)}" ${admin ? '' : 'disabled'}></label>
        <div class="field">Cost per run<div class="s" style="padding-top:8px">${cpr ? `about <b>${money(cpr)}</b>, measured from recent runs` : 'Not enough runs to measure yet'}</div></div></div>
      <div class="s muted">Automatic runs stop once Apify spend reaches the budget, then resume when Apify's billing month resets${resets ? ` (${esc(resets)})` : ''}. Each run does either posts or comments, whichever is due.</div>
    </div></section>
  <section class="card"><header><div><h2>Apify spend this billing month</h2><p>Read live from your Apify account</p></div></header>
    <div class="body stack" style="gap:14px">
      <div><div class="row"><b style="font-size:26px;font-weight:500">${st ? money(used) : '—'}</b><span class="muted">of ${money(budget)} budget</span></div><div class="bar" style="margin-top:8px"><i style="width:${pct}%;${pct >= 90 ? 'background:var(--bad)' : ''}"></i></div></div>
      <div class="row"><button class="btn primary" id="scRun" ${admin && !running ? '' : 'disabled'}>${running ? 'Running…' : 'Run now'}</button><span class="s muted">Posts, then comments${cpr ? ` · about ${money(cpr * 2)}` : ''}</span></div>
      <div class="s muted" id="scStatus">Last run ${esc(ago(lastRun?.created_at))}${lastRun ? ` (${esc(label(lastRun.run_mode))})` : ''}.</div>
    </div></section></div>
  <section class="card" style="margin-top:24px"><header><div><h2>Run history</h2><p>Every run with its Apify cost. Pacing checks are hidden.</p></div></header>
    <div class="body flush scroll"><table class="tbl"><thead><tr><th>When</th><th>Run</th><th class="n">Posts</th><th class="n">Comment threads</th><th class="n">Cost</th><th>Notes</th></tr></thead><tbody>
    ${store.scrapeLog.slice(0, 60).map((r, i, arr) => {
      const res = r.detail?.result || {}, next = arr.slice(i + 1).find(x => x.usage_before != null);
      const cost = r.usage_after != null && r.usage_after > r.usage_before ? r.usage_after - r.usage_before : (isRun(r) && next && r.usage_before != null ? Number(r.usage_before) - Number(next.usage_before) : null);
      const note = r.detail?.error || (res.errors?.length ? res.errors.join('; ') : '') || (res.missing_profiles?.length ? 'No post found: ' + res.missing_profiles.join(', ') : '') || (r.run_mode === 'skip_budget' ? `Budget reached (${money(r.usage_before)})` : '');
      return `<tr><td class="muted" style="white-space:nowrap">${new Date(r.created_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</td>
        <td><span class="tag ${isError(r) ? 'bad' : r.run_mode.endsWith('partial') ? 'warn' : isRun(r) ? 'good' : ''}">${esc(label(r.run_mode))}</span>${r.detail?.by ? `<div class="s muted">${esc(r.detail.by)}</div>` : ''}</td>
        <td class="n">${res.posts_saved ?? '—'}</td><td class="n">${res.comment_posts_processed ?? '—'}</td><td class="n">${cost != null && cost >= 0 && cost < 2 ? money(cost) : '—'}</td>
        <td class="s muted" style="max-width:380px">${esc(note)}</td></tr>`;
    }).join('')}
    </tbody></table>${!store.scrapeLog.length ? '<div class="empty">No runs logged yet.</div>' : ''}</div></section>`;
  if (!admin) return;
  $('#scOn', body).onchange = e => saveSettings({ scrape_enabled: e.target.checked });
  $('#scBudget', body).onchange = e => saveSettings({ monthly_budget: Math.max(0, Number(e.target.value) || 0) });
  $('#scRun', body).onclick = e => runNow(e.target, $('#scStatus', body));
}
