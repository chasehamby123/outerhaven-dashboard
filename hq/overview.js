// Overview: the few numbers that actually move the business.
import { esc, fmt, pct, sum, median, fmtDate, avatar } from './core.js';
import { store, loadSheet } from './data.js';
import { SHEET_URL } from './sheet.js';
import { commentsNoMeetings } from './insights.js';
import { scraperStatus } from './scraper.js';
import { renderWeekHistory } from './today.js';
import { renderPostCheck } from './postcheck.js';
import { renderReplyQueue } from './pipeline.js';

export const SOURCES = {
  inbound_post: ['Inbound · from a post', 'in'], inbound_dm: ['Inbound · DM', 'in'], comment_to_dm: ['Comment → DM', 'in'],
  outbound_dm: ['Outbound · LinkedIn DM', 'out'], outbound_email: ['Outbound · email', 'out'], referral: ['Referral', 'other'], other: ['Other', 'other'],
};

let week = null, sortKey = 'meetingsBooked', sortAsc = false;
const COLS = [['account', 'Account', false], ['posts', 'Posts', true], ['impressions', 'Impr.', true], ['comments', 'Comments', true], ['dmsInitiated', 'DMs', true], ['leadsReplied', 'Replies', true], ['meetingsBooked', 'Booked', true], ['meetingsHeld', 'Held', true], ['per1k', 'Mtg / 1k', true]];
// Tie-breakers so equal values still land in a sensible order.
const TIE = ['meetingsBooked', 'meetingsHeld', 'per1k', 'leadsReplied', 'comments', 'impressions'];
function sortAccounts(list) {
  const v = (a, k) => k === 'account' ? a.account.toLowerCase() : (a[k] ?? -1);
  return list.slice().sort((a, b) => {
    for (const k of [sortKey, ...TIE.filter(t => t !== sortKey)]) {
      const x = v(a, k), y = v(b, k); if (x === y) continue;
      const d = x > y ? 1 : -1; return k === sortKey && sortAsc ? d : k === 'account' ? d : -d;
    }
    return 0;
  });
}

export function sheetStatus() {
  if (store.sheetError) return `<span class="row s"><i class="dot err"></i><span>Sheet error: ${esc(store.sheetError)}</span></span>`;
  if (!store.sheet) return `<span class="row s muted"><i class="dot"></i>Loading sheet…</span>`;
  const s = store.sheet, latest = s.weeks.at(-1), filled = s.filledWeeks.at(-1);
  const stale = latest && filled !== latest ? ` · week of ${fmtDate(latest)} not filled in yet` : '';
  return `<span class="row s"><i class="dot ok"></i><span>Sheet connected · ${s.rows.length} rows · read ${s.fetchedAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}${esc(stale)}</span></span>`;
}

function weekRows() {
  const s = store.sheet; if (!s) return [];
  if (!week || !s.weeks.includes(week)) week = s.filledWeeks.at(-1) || s.weeks.at(-1);
  return s.rows.filter(r => r.week === week);
}
function prevWeekRows() {
  const s = store.sheet; if (!s) return [];
  const i = s.filledWeeks.indexOf(week); const pw = i > 0 ? s.filledWeeks[i - 1] : null;
  return pw ? s.rows.filter(r => r.week === pw) : [];
}
const tot = (rows, k) => sum(rows.map(r => r[k]));
function delta(cur, prev) {
  if (!prev) return '<small>No earlier week to compare</small>';
  const d = cur - prev; if (!d) return '<small>No change vs last week</small>';
  return `<small class="${d > 0 ? 'up' : 'down'}">${d > 0 ? '▲' : '▼'} ${fmt(Math.abs(d))} vs last week</small>`;
}

function meetingSplit(days = 90) {
  const cutoff = new Date(Date.now() - days * 864e5).toISOString().slice(0, 10);
  const ms = store.meetings.filter(m => m.meeting_date >= cutoff && m.status !== 'cancelled');
  const by = {}; for (const m of ms) by[m.source] = (by[m.source] || 0) + 1;
  const dir = { in: 0, out: 0, other: 0 }; for (const [k, v] of Object.entries(by)) dir[SOURCES[k]?.[1] || 'other'] += v;
  const held = ms.filter(m => ['held', 'qualified'].includes(m.status)).length;
  return { ms, by, dir, held };
}

export function renderOverview(root) {
  const rows = weekRows(), prev = prevWeekRows(), s = store.sheet;
  const T = k => tot(rows, k), P = k => tot(prev, k);
  const imp = T('impressions'), booked = T('meetingsBooked'), held = T('meetingsHeld');
  const kpi = (label, v, k, sub = '', hero = false) => `<div class="kpi${hero ? ' hero' : ''}"><label>${label}</label><b>${v}</b>${k ? delta(T(k), P(k)) : `<small>${sub}</small>`}</div>`;

  // Per-account efficiency, the core "what moves the needle" table.
  const acct = rows.filter(r => r.filled).map(r => ({ ...r, per1k: r.impressions ? (r.meetingsBooked || 0) / r.impressions * 1000 : null, commentRate: r.impressions ? (r.comments || 0) / r.impressions : null }))
    ;
  const acctSorted = sortAccounts(acct);
  const medImp = median(acct.map(a => a.impressions || 0)) || 0, medCom = median(acct.map(a => a.comments || 0)) || 0;
  const flag = a => {
    if ((a.impressions || 0) >= medImp && (a.comments || 0) >= medCom && !a.meetingsBooked) return '<span class="tag warn">Attention, no meetings</span>';
    if ((a.impressions || 0) < medImp && (a.meetingsBooked || 0) >= 2) return '<span class="tag good">Low reach, converts</span>';
    if (a.dmsInitiated && !a.leadsReplied) return '<span class="tag bad">DMs not landing</span>';
    return '';
  };

  // Conversion rates. The sheet isn't one linear funnel (inbound and outbound both feed meetings), so show honest ratios.
  const rates = [
    ['Comments per 1k impressions', imp ? (T('comments') / imp * 1000).toFixed(1) : '—', 'Content resonance'],
    ['DM reply rate', T('dmsInitiated') ? pct(T('leadsReplied'), T('dmsInitiated'), 0) : '—', 'Leads replied ÷ DMs initiated'],
    ['Meetings per 1k impressions', imp ? (booked / imp * 1000).toFixed(1) : '—', 'Reach → pipeline'],
    ['Show rate', booked ? pct(held, booked, 0) : '—', 'Meetings held ÷ booked'],
  ];
  // Findings computed from the week, stated plainly.
  const notes = [];
  const topConv = acct.filter(a => a.per1k != null && a.meetingsBooked).sort((a, b) => b.per1k - a.per1k)[0];
  if (topConv) notes.push(`<b>${esc(topConv.account)}</b> turns reach into meetings best: ${topConv.per1k.toFixed(1)} meetings per 1,000 impressions (${fmt(topConv.meetingsBooked)} from ${fmt(topConv.impressions)}).`);
  const loud = acct.filter(a => (a.comments || 0) >= medCom && !a.meetingsBooked).map(a => a.account);
  if (loud.length) notes.push(`<b>${esc(loud.join(', '))}</b> ${loud.length > 1 ? 'get' : 'gets'} above-median comments but <b>zero meetings</b>. Engagement there isn't converting, so test the CTA and DM follow-up rather than posting more.`);
  const outbound = acct.filter(a => a.dmsInitiated);
  if (outbound.length) notes.push(`Outbound DMs this week: ${outbound.map(a => `${esc(a.account)} ${fmt(a.dmsInitiated)} sent → ${fmt(a.leadsReplied || 0)} replies → ${fmt(a.meetingsBooked || 0)} meetings`).join('; ')}.`);
  if (booked) notes.push(`${pct(held, booked, 0)} of booked meetings actually happened (${fmt(held)} of ${fmt(booked)}).`);

  const split = meetingSplit(), cnm = commentsNoMeetings(store.posts);
  const weeks = s ? s.filledWeeks : [];
  const trend = weeks.map(w => ({ w, v: sum(s.rows.filter(r => r.week === w).map(r => r.meetingsBooked)) }));
  const maxT = Math.max(1, ...trend.map(t => t.v));

  root.innerHTML = `
  <div class="head"><div><h1>Overview</h1><p>What moved this week, and where the meetings actually come from.</p><div class="row" style="margin-top:8px;gap:16px">${scraperStatus()}${sheetStatus()}</div></div>
    <div class="row">${s ? `<select class="select sm" id="ovWeek" style="width:auto">${s.weeks.slice().reverse().map(w => `<option value="${w}" ${w === week ? 'selected' : ''}>Week of ${fmtDate(w)}${s.filledWeeks.includes(w) ? '' : ' (empty)'}</option>`).join('')}</select>` : ''}
    <button class="btn sm" id="ovRefresh">Refresh sheet</button><a class="btn sm ghost" href="${SHEET_URL}" target="_blank" rel="noopener">Open sheet ↗</a></div></div>
  <div class="stack">
    <div id="ovPosts"></div>
    <div id="ovReplies"></div>
    <div class="kpis">
      ${kpi('Meetings booked', fmt(booked), 'meetingsBooked', '', true)}
      ${kpi('Impressions', fmt(imp), 'impressions')}
      ${kpi('Comments', fmt(T('comments')), 'comments')}
      ${kpi('DMs initiated', fmt(T('dmsInitiated')), 'dmsInitiated')}
      ${kpi('Meetings held', fmt(held), 'meetingsHeld')}
      ${kpi('Meetings / 1k impressions', imp ? (booked / imp * 1000).toFixed(1) : '—', null, 'Reach → pipeline efficiency')}
    </div>
    ${notes.length ? `<section class="card"><header><div><h2>What moved the needle</h2><p>Calculated from the sheet for the selected week.</p></div></header><div class="body flush">${notes.map(n => `<div class="insight"><p>${n}</p></div>`).join('')}</div></section>` : ''}
    <div id="ovTasks"></div>
    <section class="card"><header><div><h2>Accounts</h2><p>Click a column to sort. Flags show where effort isn't converting.</p></div></header>
        <div class="body flush scroll"><table class="tbl"><thead><tr>${COLS.map(([k, l, n]) => `<th class="sort ${n ? 'n' : ''} ${k === sortKey ? 'on' : ''} ${k === sortKey && sortAsc ? 'asc' : ''}" data-sort="${k}">${l}</th>`).join('')}<th></th></tr></thead><tbody>
        ${acctSorted.map((a, i) => `<tr><td class="strong" style="white-space:nowrap"><span class="rank ${i === 0 ? 'top' : ''}">${i + 1}</span><span class="acct">${avatar(a.account)}${esc(a.account)}</span></td><td class="n">${fmt(a.posts)}</td><td class="n">${fmt(a.impressions)}</td><td class="n">${fmt(a.comments)}</td><td class="n">${fmt(a.dmsInitiated)}</td><td class="n">${fmt(a.leadsReplied)}</td><td class="n strong">${fmt(a.meetingsBooked)}</td><td class="n">${fmt(a.meetingsHeld)}</td><td class="n">${a.per1k == null ? '—' : a.per1k.toFixed(1)}</td><td>${flag(a)}</td></tr>`).join('')}
        </tbody></table>${!acct.length ? '<div class="empty">No numbers entered for this week yet.</div>' : ''}${rows.filter(r => !r.filled).length ? `<div class="s muted" style="padding:10px 12px;border-top:1px solid var(--line)">Not filled in: ${esc(rows.filter(r => !r.filled).map(r => r.account).join(', '))}</div>` : ''}</div></section>
    <div class="cols">
      <section class="card"><header><div><h2>Conversion</h2><p>Where effort turns into meetings, for the selected week.</p></div></header>
        <div class="body flush"><table class="tbl"><tbody>${rates.map(r => `<tr><td>${r[0]}<div class="s muted">${r[2]}</div></td><td class="n strong" style="font-size:16px">${r[1]}</td></tr>`).join('')}</tbody></table></div></section>

      <section class="card"><header><div><h2>Inbound vs outbound</h2><p>From the meetings log · last 90 days</p></div><a class="btn sm" href="#/growth/meetings">Log a meeting</a></header>
        <div class="body">${split.ms.length ? `
          <div class="mini3"><div class="kpi"><label>Inbound</label><b>${split.dir.in}</b><small>${pct(split.dir.in, split.ms.length, 0)} of meetings</small></div><div class="kpi"><label>Outbound</label><b>${split.dir.out}</b><small>${pct(split.dir.out, split.ms.length, 0)} of meetings</small></div><div class="kpi"><label>Held</label><b>${split.held}</b><small>${pct(split.held, split.ms.length, 0)} show rate</small></div></div>
          <table class="tbl"><tbody>${Object.entries(split.by).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<tr><td>${esc(SOURCES[k]?.[0] || k)}</td><td style="width:45%"><div class="bar"><i style="width:${v / split.ms.length * 100}%"></i></div></td><td class="n strong">${v}</td></tr>`).join('')}</tbody></table>`
        : `<div class="empty">No meetings logged yet. The sheet only counts meetings per account, so it can't say whether they came from posts or DMs. Log each meeting with its source and this panel answers that.</div>`}</div></section>
    </div>
    <div class="cols">
      <section class="card"><header><div><h2>Meetings booked per week</h2><p>From the sheet</p></div></header>
        <div class="body">${trend.length ? `<div style="display:flex;align-items:flex-end;gap:10px;height:120px">${trend.map((t, i) => `<div style="flex:1;display:grid;gap:6px;justify-items:center"><span class="s strong">${t.v}</span><div style="width:100%;max-width:48px;height:${Math.max(3, t.v / maxT * 80)}px;background:${i === trend.length - 1 ? 'var(--brass)' : 'var(--ink)'};border-radius:4px 4px 0 0"></div><span class="s muted">${fmtDate(t.w)}</span></div>`).join('')}</div>` : '<div class="empty">No weeks filled in yet.</div>'}</div></section>
      <section class="card"><header><div><h2>Comments, no meetings</h2><p>High-comment posts that produced nothing</p></div><a class="btn sm" href="#/growth/posts">All posts</a></header>
        <div class="body flush">${cnm.length ? `<table class="tbl"><tbody>${cnm.slice(0, 6).map(p => `<tr><td>${p.url ? `<a href="${esc(p.url)}" target="_blank" rel="noopener">${esc(p.name)}</a>` : esc(p.name)}<div class="s muted">${esc(p.account)} · ${fmtDate(p.date)}</div></td><td class="n strong">${fmt(p.m.comments)}<div class="s muted">comments</div></td></tr>`).join('')}</tbody></table>` : `<div class="empty">Needs posts with comment counts and meetings linked to posts.</div>`}</div></section>
    </div>
  </div>`;

  root.querySelectorAll('[data-sort]').forEach(th => th.onclick = () => { const k = th.dataset.sort; if (k === sortKey) sortAsc = !sortAsc; else { sortKey = k; sortAsc = k === 'account'; } renderOverview(root); });
  root.querySelector('#ovWeek')?.addEventListener('change', e => { week = e.target.value; renderOverview(root); });
  const ovPosts = root.querySelector('#ovPosts'); if (ovPosts) renderPostCheck(ovPosts);
  const ovReplies = root.querySelector('#ovReplies'); if (ovReplies) renderReplyQueue(ovReplies);
  const ovTasks = root.querySelector('#ovTasks'); if (ovTasks) renderWeekHistory(ovTasks);
  root.querySelector('#ovRefresh')?.addEventListener('click', async e => { e.target.disabled = true; e.target.textContent = 'Refreshing…'; await loadSheet(); });
}
