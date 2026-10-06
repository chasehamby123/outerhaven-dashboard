// LinkedIn scraper controls, on top of the existing daily-ops-linkedin-auto function.
// pg_cron calls it every 30 min; it paces Apify spend across the month and obeys growth_settings.
import { sb, state, esc, $, $$, toast, fail } from './core.js';
import { store, load } from './data.js';

const hourLabel = h => `${((h + 11) % 12) + 1}:00 ${h >= 12 ? 'PM' : 'AM'}`;
const money = n => '$' + Number(n || 0).toFixed(2);
const ago = t => { if (!t) return 'never'; const m = Math.round((Date.now() - new Date(t)) / 60000); return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`; };
const isRun = r => !String(r.run_mode).startsWith('skip');
const isError = r => String(r.run_mode).startsWith('error');
const LABEL = { posts: 'Posts', comments: 'Comments', manual_posts: 'Posts (manual)', manual_comments: 'Comments (manual)', skip_budget: 'Skipped: budget', skip_disabled: 'Auto scraping off', skip_pace: 'Waiting (pacing)' };
const label = m => LABEL[m] || LABEL[m.replace(/_partial$/, '')] ? (LABEL[m] || LABEL[m.replace(/_partial$/, '')] + ' · partial') : m.startsWith('error_') ? `Failed: ${LABEL[m.slice(6)] || m.slice(6)}` : m;

// Spend is counted across every Apify account in the pool, not just the main one: each run goes to whichever account
// has the most credit left, so the main account's figure alone barely moves. Apify's own usage figure trails a
// finished run by a few minutes, so the log cost is the pool total at the start of the next run minus this run's.
let liveAccts = null; // last live read (status_only); falls back to the snapshot saved with the latest log row
const poolOf = accts => {
  const ok = (accts || []).filter(a => !a.error);
  const sum = k => ok.reduce((t, a) => t + Number(a[k] || 0), 0);
  const main = ok.find(a => a.slot === 1), extras = ok.filter(a => a.slot !== 1);
  const part = l => ({ used: l.reduce((t, a) => t + Number(a.used || 0), 0), limit: l.reduce((t, a) => t + Number(a.limit || 0), 0) });
  return { n: ok.length, used: sum('used'), limit: sum('limit'), remaining: sum('remaining'), main: main ? part([main]) : null, extras: part(extras), extraN: extras.length };
};
const rowPool = r => { const a = (r?.detail?.accounts || []).filter(x => !x.error); return a.length ? a.reduce((t, x) => t + Number(x.used || 0), 0) : null; };
const currentAccts = () => liveAccts || latestStatus()?.accounts || [];
// Cost of each logged run (what the pool spent between it and the next run), median over recent runs.
export function costPerRun() {
  const runs = store.scrapeLog.filter(isRun).filter(r => rowPool(r) != null).slice(0, 30);
  const diffs = [];
  for (let i = 1; i < runs.length; i++) { const d = rowPool(runs[i - 1]) - rowPool(runs[i]); if (d > 0 && d < 3) diffs.push(d); }
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
  const cpr = costPerRun() ?? 0.1, pool = poolOf(currentAccts());
  const spend = pool.n ? `${money(pool.used)} of ${money(pool.limit)} across ${pool.n} Apify account${pool.n === 1 ? '' : 's'}` : `${money(latestStatus()?.usage_usd)} of ${money(store.settings?.monthly_budget || 19)} (main account)`;
  if (!confirm(`Run the LinkedIn scraper now?\n\nPosts + comments: about ${money(cpr * 2)} (2 runs at ~${money(cpr)}, more if there are big comment threads)\nApify spend this billing month: ${spend}`)) return;
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
  finally { running = false; btn.disabled = false; await load(); refreshLive(); setTimeout(refreshLive, 90e3); setTimeout(refreshLive, 300e3); }
}

// Free read of every account's usage (no Apify run). Repaints the spend card and accounts table if the page is open.
async function refreshLive() {
  if (!$('#scSpend')) return;
  try { liveAccts = (await invoke({ status_only: true })).accounts || liveAccts; } catch { return; }
  paintSpend(); $('#scAcc')?.dispatchEvent(new Event('live'));
}
function paintSpend() {
  const hist = $('#scHist'); if (hist) hist.innerHTML = historyRows();
  const host = $('#scSpend'); if (!host) return;
  const s = store.settings, st = latestStatus(), pool = poolOf(currentAccts()), budget = Number(s?.monthly_budget || 0);
  if (!pool.n) { const used = Number(st?.usage_usd ?? 0), pct = Math.min(100, used / Math.max(0.01, budget) * 100); host.innerHTML = `<div class="row"><b style="font-size:26px;font-weight:500">${st ? money(used) : '—'}</b><span class="muted">of ${money(budget)} budget (main account)</span></div><div class="bar" style="margin-top:8px"><i style="width:${pct}%"></i></div>`; return; }
  const pct = Math.min(100, pool.used / Math.max(0.01, pool.limit) * 100);
  host.innerHTML = `<div class="row"><b style="font-size:26px;font-weight:500">${money(pool.used)}</b><span class="muted">of ${money(pool.limit)} across ${pool.n} Apify account${pool.n === 1 ? '' : 's'}</span></div>
    <div class="bar" style="margin-top:8px"><i style="width:${pct}%;${pct >= 90 ? 'background:var(--bad)' : ''}"></i></div>
    <div class="s muted" style="margin-top:8px">${money(pool.remaining)} left. ${pool.main ? `Main account ${money(pool.main.used)} of ${money(pool.main.limit)} (your budget cap)` : ''}${pool.extraN ? `${pool.main ? ' · ' : ''}${pool.extraN} extra: ${money(pool.extras.used)} of ${money(pool.extras.limit)}` : ''}. Apify updates its figures a few minutes after a run finishes.</div>`;
}

async function saveSettings(patch) {
  const r = await sb.from('growth_settings').update({ ...patch, updated_at: new Date().toISOString(), updated_by: state.user?.id || null }).eq('id', 1);
  if (!fail(r, 'Save scraper settings')) { toast('Saved'); await load(); }
}

// Extra Apify accounts: the scraper sends each run to the account with the most credit left.
// Tokens are write-only (RPC set_apify_token); the page only ever sees names and dollar amounts.
async function accountsCard(host) {
  let slots = [];
  const pull = async () => { const r = await sb.rpc('apify_token_slots'); slots = Array.isArray(r.data) ? r.data : []; };
  const refresh = async () => { try { liveAccts = (await invoke({ status_only: true })).accounts || []; paintSpend(); } catch (e) { toast('Could not read Apify accounts: ' + e.message); } };
  const draw = () => {
    const accts = currentAccts(), free = [2, 3, 4, 5, 6, 7, 8, 9].filter(n => !slots.includes(n));
    host.innerHTML = `<header><div><h2>Apify accounts</h2><p>Every run goes to the account with the most credit left. Add accounts to get more credit per month.</p></div><button class="btn sm" id="acRef">Refresh</button></header>
    <div class="body stack" style="gap:16px">
      ${accts.length ? `<div class="scroll"><table class="tbl"><thead><tr><th>Account</th><th class="n">Used</th><th class="n">Left</th><th></th></tr></thead><tbody>${accts.map(a => `<tr>
        <td><b>${esc(a.name)}</b> <span class="muted s">${a.slot === 1 ? 'main' : 'extra ' + a.slot}</span></td>
        <td class="n">${a.error ? '—' : money(a.used) + ' <span class="muted s">of ' + money(a.limit) + '</span>'}</td>
        <td class="n">${a.error ? `<span class="tag bad">${esc(a.error)}</span>` : money(a.remaining)}</td>
        <td class="n">${a.slot > 1 ? `<button class="btn sm ghost" data-rm="${a.slot}">Remove</button>` : ''}</td></tr>`).join('')}</tbody></table></div>
      <div class="s"><b>${money(accts.reduce((t, a) => t + (a.error ? 0 : a.remaining), 0))}</b> of credit left across ${accts.filter(a => !a.error).length} account${accts.filter(a => !a.error).length === 1 ? '' : 's'} this billing month.</div>` : '<div class="s muted">Press Refresh to read the accounts.</div>'}
      ${free.length ? `<form class="form" id="acForm" autocomplete="off"><label class="field">Slot<select class="select" id="acSlot">${free.map(n => `<option value="${n}">Extra account ${n}</option>`).join('')}</select></label>
        <label class="field">Apify API token<input class="input" type="password" id="acTok" placeholder="apify_api_…" autocomplete="off" spellcheck="false"></label>
        <div class="field full"><button class="btn primary" id="acSave" type="submit">Add account</button></div></form>` : '<div class="s muted">All 8 extra slots are in use.</div>'}
      <div class="s muted">Get the token in that Apify account: Settings → API &amp; Integrations → Personal API tokens. It is saved write-only and never shown again; to replace one, remove the account and add it again.</div>
    </div>`;
    $('#acRef', host).onclick = async e => { e.target.disabled = true; await refresh(); draw(); };
    $('#acForm', host)?.addEventListener('submit', async e => {
      e.preventDefault(); const tok = $('#acTok', host).value.trim(); if (!tok) return;
      $('#acSave', host).disabled = true;
      if (!fail(await sb.rpc('set_apify_token', { p_slot: Number($('#acSlot', host).value), p_value: tok }), 'Add Apify account')) { await pull(); await refresh(); toast('Account added'); }
      draw();
    });
    $$('[data-rm]', host).forEach(b => b.onclick = async () => {
      if (!confirm('Remove this Apify account from the scraper?')) return;
      if (!fail(await sb.rpc('set_apify_token', { p_slot: Number(b.dataset.rm), p_value: '' }), 'Remove Apify account')) { await pull(); await refresh(); toast('Removed'); }
      draw();
    });
  };
  host.addEventListener('live', draw);
  await pull(); draw();
}

function historyRows() {
  return store.scrapeLog.slice(0, 60).map((r, i, arr) => {
      const res = r.detail?.result || {};
      // What the whole pool spent from this run's start to the next run's start (the newest run uses the live figure).
      const newer = isRun(r) ? arr.slice(0, i).reverse().find(x => isRun(x) && rowPool(x) != null) : null, p0 = rowPool(r);
      const after = newer ? rowPool(newer) : (liveAccts ? poolOf(liveAccts).used || null : null);
      const cost = isRun(r) && p0 != null && after != null ? Math.max(after - p0, Number(res.apify_cost_usd || 0)) : null;
      const note = r.detail?.error || (res.errors?.length ? res.errors.join('; ') : '') || (res.missing_profiles?.length ? 'No post found: ' + res.missing_profiles.join(', ') : '') || (r.run_mode === 'skip_budget' ? `Budget reached (${money(r.usage_before)})` : '');
      return `<tr><td class="muted" style="white-space:nowrap">${new Date(r.created_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</td>
        <td><span class="tag ${isError(r) ? 'bad' : r.run_mode.endsWith('partial') ? 'warn' : isRun(r) ? 'good' : ''}">${esc(label(r.run_mode))}</span>${r.detail?.by ? `<div class="s muted">${esc(r.detail.by)}</div>` : ''}</td>
        <td class="n">${res.posts_saved ?? '—'}</td><td class="n">${res.comment_posts_processed ?? '—'}</td><td class="n">${cost != null && cost >= 0 && cost < 5 ? money(cost) : '—'}</td>
        <td class="s muted" style="max-width:380px">${esc(note)}</td></tr>`;
  }).join('');
}

export function scraperView(body) {
  const s = store.settings, admin = state.role === 'admin';
  if (!s) { body.innerHTML = `<div class="card"><div class="empty">Scraper controls need the database update (growth_settings).</div></div>`; return; }
  const st = latestStatus(), budget = Number(s.monthly_budget), cpr = costPerRun();
  const runs = store.scrapeLog.filter(isRun), lastRun = runs[0], lastOk = runs.find(r => !isError(r));
  let streak = 0; for (const r of runs) { if (isError(r)) streak++; else break; }
  const hour = Number.isFinite(Number(s.scrape_hour)) ? Number(s.scrape_hour) : 9, resets = st?.usage_cycle_end ? new Date(st.usage_cycle_end).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : null;
  body.innerHTML = `${streak >= 2 ? `<div class="card" style="border-color:var(--line-2);background:var(--bad-bg);margin-bottom:20px"><div class="body s"><b>The last ${streak} runs failed</b> and each still used Apify credit. Latest error: ${esc(lastRun?.detail?.error || '')}. Last successful run: ${esc(ago(lastOk?.created_at))}.</div></div>` : ''}
  <div class="cols-2">
  <section class="card"><header><div><h2>Automatic scraping</h2><p>Runs on the server, so nobody needs to be logged in.</p></div></header>
    <div class="body stack" style="gap:18px">
      <label class="switch"><input type="checkbox" id="scOn" ${s.scrape_enabled ? 'checked' : ''} ${admin ? '' : 'disabled'}><span></span><b>${s.scrape_enabled ? 'On' : 'Off'}</b><span class="muted s">${s.scrape_enabled ? `Once a day at ${hourLabel(hour)} Malaysia time. Checks each account's last 10 items, keeps only their own posts from the last 7 days (reposts are ignored), then refreshes comment threads.` : 'Nothing runs on its own. Use Run now when you want fresh data.'}</span></label>
      <div class="form"><label class="field">Daily run time (Malaysia)<select class="select" id="scHour" ${admin ? '' : 'disabled'}>${[...Array(24).keys()].map(h => `<option value="${h}" ${h === hour ? 'selected' : ''}>${hourLabel(h)}</option>`).join('')}</select></label>
        <label class="field">Main account budget cap ($)<input class="input" type="number" min="0" step="1" id="scBudget" value="${esc(budget)}" ${admin ? '' : 'disabled'}></label>
        <div class="field full">Cost<div class="s" style="padding-top:4px">${cpr ? `About <b>${money(cpr)}</b> per pass, so roughly <b>${money(cpr * 2)}–${money(cpr * 3)} a day</b> (${money(cpr * 2 * 30)}–${money(cpr * 3 * 30)} a month).` : 'Not enough runs to measure yet.'}</div></div></div>
      <div class="s muted">The main account stops at this cap; each extra account is used up to its own plan limit. Automatic runs stop when no account has credit left, then resume when Apify's billing month resets${resets ? ` (${esc(resets)})` : ''}. A day's scrape is one posts pass, then up to 3 comment passes (one Apify run per thread, about $0.60–$1.30 each) until every changed thread is refreshed or the credit runs out.</div>
    </div></section>
  <section class="card"><header><div><h2>Apify spend this billing month</h2><p>Read live from your Apify account</p></div></header>
    <div class="body stack" style="gap:14px">
      <div id="scSpend"></div>
      <div class="row"><button class="btn primary" id="scRun" ${admin && !running ? '' : 'disabled'}>${running ? 'Running…' : 'Run now'}</button><span class="s muted">Posts, then comments${cpr ? ` · about ${money(cpr * 2)}` : ''}</span></div>
      <div class="s muted" id="scStatus">Last run ${esc(ago(lastRun?.created_at))}${lastRun ? ` (${esc(label(lastRun.run_mode))})` : ''}.</div>
    </div></section></div>
  ${admin ? '<section class="card" id="scAcc" style="margin-top:24px"></section>' : ''}
  <section class="card" style="margin-top:24px"><header><div><h2>Run history</h2><p>Every run with its Apify cost. Pacing checks are hidden.</p></div></header>
    <div class="body flush scroll"><table class="tbl"><thead><tr><th>When</th><th>Run</th><th class="n">Posts</th><th class="n">Comment threads</th><th class="n">Cost</th><th>Notes</th></tr></thead><tbody id="scHist">
    ${historyRows()}
    </tbody></table>${!store.scrapeLog.length ? '<div class="empty">No runs logged yet.</div>' : ''}</div></section>`;
  paintSpend();
  if (!admin) return;
  accountsCard($('#scAcc', body)); refreshLive();
  $('#scOn', body).onchange = e => saveSettings({ scrape_enabled: e.target.checked });
  $('#scHour', body).onchange = e => saveSettings({ scrape_hour: Number(e.target.value) });
  $('#scBudget', body).onchange = e => saveSettings({ monthly_budget: Math.max(0, Number(e.target.value) || 0) });
  $('#scRun', body).onclick = e => runNow(e.target, $('#scStatus', body));
}
