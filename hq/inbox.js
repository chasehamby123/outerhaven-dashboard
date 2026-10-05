// Inbox accountability + outbound. Data comes from the extension's "Sync inbox" (inbox_threads) cross-checked with the
// daily comment scraper, and from the Prosp API for the three Prosp accounts. Read through RPCs so ops (Anaz) can see their own list.
// Verdicts for a commenter we never answered: missed (not in the DMs, inbox synced after the comment) · unverified (synced
// before the comment, sync again) · unsynced (that inbox was never synced) · in_inbox (they are in the DMs, so not missed).
import { sb, state, esc, fmt, pct, $, $$, toast, fail, opts, acctName, avatar, firstName } from './core.js';

export const PROSP_ACCOUNTS = ['Peter', 'Chase', 'Tengku']; // run in Prosp: their inbox sync is optional
const isProsp = n => PROSP_ACCOUNTS.includes(firstName(n));
const CAP = 8;
const open = new Set(), more = new Set();
let cache = null, cacheAt = 0, inflight = null;

export const ago = iso => {
  if (!iso) return 'never';
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  return m < 2 ? 'just now' : m < 60 ? `${m}m ago` : m < 1440 ? `${Math.round(m / 60)}h ago` : `${Math.round(m / 1440)}d ago`;
};
const hoursSince = iso => iso ? (Date.now() - new Date(iso).getTime()) / 3600e3 : Infinity;
const syncTone = (iso, optional) => !iso ? (optional ? 'muted' : 'bad') : hoursSince(iso) > 48 ? 'bad' : hoursSince(iso) > 24 ? 'warn' : 'ok';

export async function loadInbox(force = false) {
  if (!force && cache && Date.now() - cacheAt < 30000) return cache;
  if (inflight) return inflight;
  inflight = (async () => {
    const [st, w, mc] = await Promise.all([sb.rpc('inbox_state'), sb.rpc('inbox_waiting', { p_max_days: 45 }), sb.rpc('missed_commenters', { p_days: 14 })]);
    const err = st.error || w.error || mc.error;
    cache = err ? { error: err.message } : { accounts: st.data || [], waiting: w.data || [], comments: mc.data || [] };
    cacheAt = Date.now(); inflight = null; return cache;
  })();
  return inflight;
}

async function dismiss(kind, ref, account) {
  const res = await sb.from('inbox_dismissals').insert({ kind, ref, account_name: account, by_email: state.user?.email || null });
  if (res.error && !/duplicate|unique/i.test(res.error.message)) { fail(res, 'Dismiss'); return false; }
  return true;
}

// ---------- shared rows ----------
const threadRow = t => `<li class="inRow"><span class="inWho"><b>${t.thread_url ? `<a href="${esc(t.thread_url)}" target="_blank" rel="noopener">${esc(t.participant || 'Unknown')} ↗</a>` : esc(t.participant || 'Unknown')}</b>
  <small>“${esc(String(t.last_snippet || '').slice(0, 110))}”</small></span>
  <span class="inMeta"><b class="${t.days_waiting >= 3 ? 'bad' : ''}">${t.days_waiting}d</b><button type="button" class="btn sm ghost" data-dis="thread" data-ref="${esc(t.ref)}" data-acct="${esc(t.account_name)}" title="Already handled or not needed">Not needed</button></span></li>`;
const VERDICT = { missed: ['Not in inbox', 'bad'], unverified: ['Sync to check', 'warn'], unsynced: ['Inbox not synced', 'warn'] };
const commentRow = c => { const v = VERDICT[c.verdict] || ['', '']; return `<li class="inRow"><span class="inWho"><b>${c.author_url ? `<a href="${esc(c.author_url)}" target="_blank" rel="noopener">${esc(c.author_name || 'Unknown')} ↗</a>` : esc(c.author_name || 'Unknown')}</b>
  <small>commented: “${esc(String(c.body || '').slice(0, 100))}”${c.post_url ? ` · <a href="${esc(c.post_url)}" target="_blank" rel="noopener">open post ↗</a>` : ''}</small></span>
  <span class="inMeta"><b class="pFlag ${v[1]}">${v[0]}</b><button type="button" class="btn sm ghost" data-dis="comment" data-ref="${esc(c.comment_id)}" data-acct="${esc(c.account_name)}">Not needed</button></span></li>`; };
const bindDismiss = (root, rerender) => $$('[data-dis]', root).forEach(b => b.onclick = async () => { b.disabled = true; if (await dismiss(b.dataset.dis, b.dataset.ref, b.dataset.acct)) { cache = null; await loadInbox(true); rerender(); } else b.disabled = false; });

// ---------- Overview (admin): who is behind ----------
export async function renderAccountability(el) {
  const draw = async () => {
    if (!el.isConnected) return;
    const d = await loadInbox(); if (!el.isConnected) return;
    if (d.error) { el.innerHTML = /does not exist|could not find/i.test(d.error) ? '' : `<section class="card"><div class="body s muted">Inbox tracking unavailable: ${esc(d.error)}</div></section>`; return; }
    const rows = d.accounts.map(a => {
      const w = d.waiting.filter(x => x.account_name === a.account_name), c = d.comments.filter(x => x.account_name === a.account_name && x.verdict !== 'in_inbox');
      return { a, w, c, missed: c.filter(x => x.verdict === 'missed'), check: c.filter(x => x.verdict !== 'missed') };
    });
    const behind = rows.filter(r => r.w.length || r.missed.length);
    const unsynced = rows.filter(r => !isProsp(r.a.account_name) && (!r.a.last_sync_at || hoursSince(r.a.last_sync_at) > 36));
    const tW = rows.reduce((n, r) => n + r.w.length, 0), tM = rows.reduce((n, r) => n + r.missed.length, 0);
    const people = [...new Set(d.accounts.map(a => a.responder).concat(['Anaz', 'Chase']))];
    el.innerHTML = `<section class="card inCard"><header><div><h2>Inbox accountability</h2>
      <p><b class="${tW ? 'bad' : ''}">${tW}</b> conversations waiting on us · <b class="${tM ? 'bad' : ''}">${tM}</b> commenters missed${unsynced.length ? ` · <b class="warnTxt">${unsynced.length} inbox${unsynced.length > 1 ? 'es' : ''} not synced in 36h</b>` : ''}</p></div>
      <a class="btn sm" href="#/growth/outbound">Outbound →</a></header>
      <div class="body flush scroll"><table class="tbl inTbl"><thead><tr><th>Account</th><th>Responder</th><th>Last sync</th><th class="n">Waiting on us</th><th class="n">Missed comments</th><th></th></tr></thead><tbody>
      ${rows.map(({ a, w, c, missed, check }) => { const n = a.account_name, tone = syncTone(a.last_sync_at, isProsp(n)), isOpen = open.has(n), cap = more.has(n) ? 99 : CAP;
        return `<tr><td class="strong" style="white-space:nowrap">${acctName(n)}${isProsp(n) ? ' <span class="tag">Prosp</span>' : ''}</td>
        <td><select class="select sm inResp" data-acct="${esc(n)}" style="width:auto" aria-label="Responder for ${esc(n)}">${opts(people, a.responder)}</select></td>
        <td class="inSync ${tone}">${a.last_sync_at ? `${ago(a.last_sync_at)}<small>${esc(firstName(a.last_sync_by || ''))} · ${a.threads} chats</small>` : isProsp(n) ? '<small>Not needed (Prosp)</small>' : 'Never'}</td>
        <td class="n">${w.length ? `<b class="${Math.max(...w.map(x => x.days_waiting)) >= 3 ? 'bad' : ''}">${w.length}</b><small>oldest ${Math.max(...w.map(x => x.days_waiting))}d</small>` : '<span class="muted">0</span>'}</td>
        <td class="n">${missed.length ? `<b class="bad">${missed.length}</b>` : '<span class="muted">0</span>'}${check.length ? `<small>${check.length} to verify</small>` : ''}</td>
        <td>${w.length || c.length ? `<button type="button" class="btn sm ghost" data-open="${esc(n)}">${isOpen ? 'Hide' : 'Show'}</button>` : ''}</td></tr>
        ${isOpen ? `<tr class="inDetail"><td colspan="6">${w.length ? `<h4>Waiting on a reply</h4><ul class="inList">${w.slice(0, cap).map(threadRow).join('')}</ul>` : ''}
          ${c.length ? `<h4>Commented, never answered</h4><ul class="inList">${[...missed, ...check].slice(0, cap).map(commentRow).join('')}</ul>` : ''}
          ${w.length > cap || c.length > cap ? `<button type="button" class="btn sm ghost" data-more="${esc(n)}">Show all</button>` : ''}</td></tr>` : ''}`; }).join('')}
      </tbody></table></div>
      <div class="body s muted inNote">${behind.length ? `Behind: ${behind.map(r => `${esc(firstName(r.a.account_name))} (${esc(r.a.responder)})`).join(', ')}. ` : 'Nobody is behind on what the inboxes show. '}“Missed” = the person commented, nobody on the team answered, and they are not in that inbox's DMs. It needs a fresh inbox sync and the daily comment scraper; “to verify” means sync that inbox again.</div></section>`;
    $$('[data-open]', el).forEach(b => b.onclick = () => { const n = b.dataset.open; open.has(n) ? open.delete(n) : open.add(n); draw(); });
    $$('[data-more]', el).forEach(b => b.onclick = () => { more.add(b.dataset.more); draw(); });
    $$('.inResp', el).forEach(s => s.onchange = async () => {
      const n = s.dataset.acct, up = await sb.from('inbox_owners').update({ responder: s.value }).eq('account_name', n).select();
      if (up.error) { fail(up, 'Change responder'); return; }
      if (!(up.data || []).length) { const ins = await sb.from('inbox_owners').insert({ account_name: n, responder: s.value }); if (fail(ins, 'Change responder')) return; }
      toast(`${n}'s inbox now belongs to ${s.value}`); cache = null; draw();
    });
    bindDismiss(el, draw);
  };
  if (!cache) el.innerHTML = '<section class="card"><div class="body s muted">Loading inbox status…</div></section>';
  await draw();
}

// ---------- Today: what this person owes ----------
let needsHtml = { key: '', html: '' };
export async function renderNeedsReply(el, person) {
  if (needsHtml.key === person && !el.innerHTML) el.innerHTML = needsHtml.html; // no flash when Today redraws
  const d = await loadInbox(); if (!el.isConnected) return;
  if (d.error) { el.innerHTML = ''; return; }
  const all = person === 'Everyone', mine = d.accounts.filter(a => all || a.responder === person);
  const names = new Set(mine.map(a => a.account_name));
  if (!mine.length) { el.innerHTML = ''; return; }
  const w = d.waiting.filter(x => names.has(x.account_name)), c = d.comments.filter(x => names.has(x.account_name) && x.verdict !== 'in_inbox');
  const missed = c.filter(x => x.verdict === 'missed'), check = c.filter(x => x.verdict !== 'missed');
  const stale = mine.filter(a => !isProsp(a.account_name) && (!a.last_sync_at || hoursSince(a.last_sync_at) > 20));
  const list = [...w.map(x => ({ x, t: 'w' })), ...missed.map(x => ({ x, t: 'c' }))];
  el.innerHTML = `<section class="card inToday"><header><div><h2>Needs a reply</h2><p>${list.length ? `<b class="bad">${list.length}</b> from the inboxes ${all ? 'you can see' : 'you answer'}` : 'Nothing waiting on an answer'}</p></div></header>
    ${stale.length ? `<div class="inStale">Sync ${stale.map(a => `<b>${esc(firstName(a.account_name))}</b> (${a.last_sync_at ? ago(a.last_sync_at) : 'never'})`).join(', ')}: open linkedin.com/messaging in that browser and press <b>Sync inbox</b> in the HQ button.</div>` : ''}
    ${list.length ? `<ul class="inList">${list.slice(0, 12).map(({ x, t }) => `${all || mine.length > 1 ? `<li class="inAcct">${avatar(x.account_name, 'xs')}<small>${esc(firstName(x.account_name))}'s inbox</small></li>` : ''}${t === 'w' ? threadRow(x) : commentRow(x)}`).join('')}</ul>${list.length > 12 ? `<div class="body s muted">+ ${list.length - 12} more</div>` : ''}` : `<div class="empty">${stale.length ? 'Sync the inboxes above to see what is waiting.' : 'Inbox is clear.'}</div>`}
    ${check.length ? `<div class="body s muted">${check.length} commenter${check.length > 1 ? 's' : ''} can't be checked until the inbox is synced again.</div>` : ''}</section>`;
  needsHtml = { key: person, html: el.innerHTML };
  bindDismiss(el, () => renderNeedsReply(el, person));
}

// ---------- Overview (admin): the numbers that move the needle ----------
const delta = (a, b) => b == null || (a === 0 && b === 0) ? '' : `<small class="${a >= b ? 'up' : 'down'}">${a >= b ? '▲' : '▼'} ${Math.abs(a - b)} vs previous 7 days</small>`;
export async function renderNeedle(el) {
  const r = await sb.rpc('needle_metrics', { p_days: 7 }); if (!el.isConnected) return;
  if (r.error) { el.innerHTML = ''; return; }
  const n = r.data || {}, m = n.meetings || {}, c = n.comments || {}, p = n.prosp || {}, rp = n.replies || {}, ms = n.missed || {}, wt = n.waiting || {}, mn = n.manual || {};
  const inv = (p.invited || 0) + (p.connected || 0) + (p.messaged || 0) + (p.replied || 0), con = (p.connected || 0) + (p.messaged || 0) + (p.replied || 0), msg = (p.messaged || 0) + (p.replied || 0);
  const step = (l, v, base) => `<li><span>${l}</span><b>${fmt(v)}</b><em>${base ? pct(v, base, 0) : ''}</em></li>`;
  el.innerHTML = `<section class="card ndCard"><header><div><h2>What moves the needle</h2><p>Last 7 days. Meetings are what pay; everything else is a lead indicator.</p></div></header>
    <div class="body"><div class="kpis ndK">
      <div class="kpi"><label>Meetings · inbound</label><b>${fmt(m.inbound)}</b>${delta(m.inbound || 0, m.inbound_prev)}</div>
      <div class="kpi"><label>Meetings · outbound</label><b>${fmt(m.outbound)}</b>${delta(m.outbound || 0, m.outbound_prev)}</div>
      <div class="kpi"><label>Comments answered</label><b>${c.total ? pct(c.replied, c.total, 0) : '—'}</b><small>${fmt(c.replied)} of ${fmt(c.total)}${n.median_reply_hours != null ? ` · median ${n.median_reply_hours}h` : ''}</small></div>
      <div class="kpi"><label>Waiting on us</label><b class="${wt.threads ? 'bad' : ''}">${fmt(wt.threads)}</b><small>${wt.threads ? `oldest ${wt.oldest_days}d` : 'inboxes clear'}</small></div>
    </div>
    <div class="cols ndCols">
      <div><h4>Inbound (posts and comments)</h4><ul class="ndFun">${step('Audience comments', c.total)}${step('We answered', c.replied, c.total)}${step('Missed (not in DMs)', ms.missed)}${ms.unverified ? step('Can\'t verify yet', ms.unverified) : ''}</ul></div>
      <div><h4>Outbound · Prosp${p.as_of ? ` <small class="muted">as of ${ago(p.as_of)}</small>` : ''}</h4>${p.leads ? `<ul class="ndFun">${step('Leads loaded', p.leads)}${step('Invited', inv, p.leads)}${step('Connected', con, inv)}${step('Messaged', msg, con)}${step('Replied', p.replied, msg)}</ul>` : `<div class="s muted">No Prosp numbers yet. <a href="#/growth/outbound">Connect Prosp →</a></div>`}
        <div class="s muted ndSub">Replies this week ${fmt(rp.now)}${rp.prev != null ? ` (prev ${fmt(rp.prev)})` : ''} · qualified ${fmt(rp.qualified)} · manual accounts: ${fmt(mn.new_convos)} new conversations, ${fmt(mn.awaiting_them)} waiting on them</div></div>
    </div></div></section>`;
}

// ---------- Growth → Outbound ----------
export async function outboundView(body) {
  body.innerHTML = '<div class="empty">Loading…</div>';
  const [stats, runs, keyset, d] = await Promise.all([sb.from('prosp_stats').select('*').order('captured_at', { ascending: false }).limit(300), sb.from('prosp_sync_runs').select('*').order('started_at', { ascending: false }).limit(1), sb.rpc('prosp_key_set'), loadInbox(true)]);
  if (!body.isConnected) return;
  const seen = new Set(), camps = (stats.data || []).filter(s => !seen.has(s.campaign_id) && seen.add(s.campaign_id));
  const run = (runs.data || [])[0], accts = d.accounts || [];
  const manual = accts.filter(a => !isProsp(a.account_name));
  const row = s => { const inv = s.invited + s.connected + s.messaged + s.replied, con = s.connected + s.messaged + s.replied, msg = s.messaged + s.replied;
    return `<tr><td class="strong">${esc(s.campaign_name || s.campaign_id)}${s.truncated ? ' <span class="tag" title="Hit the time or page limit: counts are a floor">partial</span>' : ''}</td><td>${s.account_name ? acctName(s.account_name) : '<span class="muted">unknown sender</span>'}</td>
      <td class="n">${fmt(s.leads)}</td><td class="n">${fmt(inv)}</td><td class="n">${fmt(con)}<small>${pct(con, inv, 0)}</small></td><td class="n">${fmt(msg)}</td><td class="n strong">${fmt(s.replied)}<small>${pct(s.replied, msg, 0)}</small></td>
      <td style="max-width:260px">${Object.entries(s.statuses || {}).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v]) => `<span class="tag" title="raw Prosp status">${esc(k)} ${v}</span>`).join(' ')}</td></tr>`; };
  body.innerHTML = `<div class="stack">
    <section class="card"><header><div><h2>Prosp (Peter, Chase, Tengku)</h2><p>Campaign funnel pulled from the Prosp API every 6 hours. Funnel stages are inferred from Prosp's status words (shown on the right), so check they look right.</p></div>
      <div class="row"><button class="btn sm primary" id="pSync" ${keyset.data ? '' : 'disabled'}>Sync now</button></div></header>
      <div class="body"><div class="row" style="gap:8px;flex-wrap:wrap"><input type="password" id="pKey" class="input sm" autocomplete="off" placeholder="${keyset.data ? 'Key saved. Paste a new one to replace it' : 'Paste the Prosp API key'}" style="max-width:340px"><button class="btn sm" id="pSave">Save key</button>
        <span class="s muted">${keyset.data ? 'Write-only: HQ never shows the key again.' : 'Not connected yet.'}${run ? ` Last sync ${ago(run.started_at)}: ${run.ok ? `${run.campaigns} campaigns, ${fmt(run.leads)} leads` : `<b class="bad">${esc(run.error || 'failed')}</b>`}.` : ''}</span></div></div>
      ${camps.length ? `<div class="body flush scroll"><table class="tbl"><thead><tr><th>Campaign</th><th>Account</th><th class="n">Leads</th><th class="n">Invited</th><th class="n">Connected</th><th class="n">Messaged</th><th class="n">Replied</th><th>Raw statuses</th></tr></thead><tbody>${camps.map(row).join('')}</tbody></table></div>
      <div class="body s muted">Invited, Connected and Messaged are cumulative (a lead who replied also counts as messaged). Percentages are step to step.</div>` : `<div class="empty">${keyset.data ? 'No numbers yet. Press Sync now.' : 'Paste the key, then press Sync now.'}</div>`}</section>
    <section class="card"><header><div><h2>Manual accounts (AdsPower)</h2><p>Filled by the extension: open LinkedIn messaging in each browser and press Sync inbox.</p></div></header>
      <div class="body flush scroll"><table class="tbl"><thead><tr><th>Account</th><th>Responder</th><th>Last sync</th><th class="n">Chats</th><th class="n">New (7d)</th><th class="n">Waiting on them</th><th class="n">Waiting on us</th></tr></thead><tbody>
      ${manual.map(a => `<tr><td class="strong">${acctName(a.account_name)}</td><td>${esc(a.responder)}</td><td class="inSync ${syncTone(a.last_sync_at)}">${a.last_sync_at ? `${ago(a.last_sync_at)}<small>${esc(firstName(a.last_sync_by || ''))}</small>` : 'Never'}</td><td class="n">${fmt(a.threads)}</td><td class="n">${fmt(a.new_7d)}</td><td class="n">${fmt(a.awaiting_them)}</td><td class="n ${a.awaiting_us ? 'strong' : ''}">${fmt(a.awaiting_us)}</td></tr>`).join('') || '<tr><td colspan="7" class="empty">No accounts.</td></tr>'}</tbody></table></div>
      <div class="body s muted">Sends aren't counted on manual accounts. LinkedIn's inbox shows conversations only, so “New” = a conversation that wasn't there at the previous sync (the first sync per account is a baseline and isn't counted).</div></section></div>`;
  $('#pSave', body).onclick = async () => { const i = $('#pKey', body), v = i.value.trim(); if (!v) { toast('Paste the key first'); return; }
    const res = await sb.rpc('set_prosp_key', { p_value: v }); i.value = ''; if (fail(res, 'Save key')) return; toast('Prosp key saved'); outboundView(body); };
  $('#pSync', body).onclick = async e => { e.target.disabled = true; e.target.textContent = 'Syncing…';
    const res = await sb.functions.invoke('prosp-sync', { body: { action: 'manual' } }); const out = res.data || {};
    if (res.error || !out.ok) toast(out.error || res.error?.message || 'Sync failed'); else toast(`Synced ${out.campaigns} campaigns, ${out.leads} leads${out.truncated ? ' (partial)' : ''}`);
    outboundView(body); };
}
