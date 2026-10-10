// Scoreboard (#/score, admin, 10 Oct 2026): did we do the Daily 3, every day, and who did it. Outcomes only, no vanity numbers.
// 1 Targets worked = signal companies added to the pipeline (people.source BDC / SEC credit / UCC), credited to the task owner.
// 2 Replies cleared = lead_intake rows reviewed (reviewed_by). 3 Calls booked = growth_meetings (created_by).
// Funnel (30 days): targets worked → replies in → calls → live deals. Targets come from DAILY3 in daily3.js.
import { sb, esc, avatar, acIdx } from './core.js';
import { DAILY3 } from './daily3.js';
import { opsDate } from './today.js';

const SOURCES = ['BDC loan signal', 'SEC credit signal', 'UCC signal'];
const addDays = (iso, n) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const dayOf = ts => { const t = Date.parse(ts); return Number.isFinite(t) ? opsDate(t) : ''; };
const label = iso => new Date(iso + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' });
const isWeekday = iso => { const g = new Date(iso + 'T12:00:00Z').getUTCDay(); return g !== 0 && g !== 6; };

export async function renderScoreboard(el) {
  el.innerHTML = '<div class="empty">Loading the scoreboard…</div>';
  const today = opsDate(), from = addDays(today, -29), since = new Date(`${from}T02:00:00+08:00`).toISOString();
  const [ppl, rev, inn, mtg, names, deals] = await Promise.all([
    sb.from('people').select('id,created_at,source').in('source', SOURCES).gte('created_at', since).limit(5000),
    sb.from('lead_intake').select('reviewed_at,reviewed_by').gte('reviewed_at', since).limit(5000),
    sb.from('lead_intake').select('id', { count: 'exact', head: true }).gte('created_at', since),
    sb.from('growth_meetings').select('created_at,created_by,account_name').gte('created_at', since).limit(2000),
    sb.rpc('team_user_names'),
    sb.from('opportunities').select('id', { count: 'exact', head: true }).eq('pipeline_active', true),
  ]);
  if (!el.isConnected) return;
  const who = new Map((names.data || []).map(r => [r.id, r.name]));
  const owner = new Map();
  const pIds = (ppl.data || []).map(p => p.id);
  for (let i = 0; i < pIds.length; i += 200) {
    const t = await sb.from('tasks').select('person_id,owner_name').in('person_id', pIds.slice(i, i + 200));
    (t.data || []).forEach(r => { if (!owner.has(r.person_id)) owner.set(r.person_id, r.owner_name || 'Unassigned'); });
  }
  // events: [day, person, metric]
  const ev = [];
  (ppl.data || []).forEach(p => ev.push([dayOf(p.created_at), owner.get(p.id) || 'Unassigned', 'worked']));
  (rev.data || []).forEach(r => ev.push([dayOf(r.reviewed_at), who.get(r.reviewed_by) || 'Someone', 'cleared']));
  (mtg.data || []).forEach(m => ev.push([dayOf(m.created_at), who.get(m.created_by) || m.account_name || 'Someone', 'calls']));
  const sum = (f) => ev.filter(f).length;

  // Last 7 ops days, team totals vs the daily targets.
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
  const dayRow = d => ({ d, worked: sum(e => e[0] === d && e[2] === 'worked'), cleared: sum(e => e[0] === d && e[2] === 'cleared'), calls: sum(e => e[0] === d && e[2] === 'calls') });
  const week = days.map(dayRow);
  const hit = r => r.worked >= DAILY3.contact && r.calls >= DAILY3.calls;
  const workdays = week.filter(r => isWeekday(r.d) && r.d <= today);
  const hits = workdays.filter(hit).length;
  let streak = 0; for (const r of [...week].reverse()) { if (!isWeekday(r.d)) continue; if (r.d === today && !hit(r)) continue; if (hit(r)) streak++; else break; }
  const cell = (v, goal) => `<td class="${goal ? (v >= goal ? 'sbHit' : v ? 'sbPart' : 'sbMiss') : ''}">${goal ? (v >= goal ? '✓ ' : v ? '' : '✕ ') : ''}${v}</td>`;

  // Per person, last 7 days.
  const people = [...new Set(ev.filter(e => e[0] >= days[0]).map(e => e[1]))].sort();
  const per = people.map(p => ({ p, worked: sum(e => e[1] === p && e[0] >= days[0] && e[2] === 'worked'), cleared: sum(e => e[1] === p && e[0] >= days[0] && e[2] === 'cleared'), calls: sum(e => e[1] === p && e[0] >= days[0] && e[2] === 'calls'), zero: workdays.filter(r => !ev.some(e => e[1] === p && e[0] === r.d)).length }))
    .sort((a, b) => (b.worked + b.calls * 10) - (a.worked + a.calls * 10));

  // 30-day funnel.
  const f30 = { worked: sum(e => e[2] === 'worked'), replies: inn.count ?? 0, calls: sum(e => e[2] === 'calls'), deals: deals.count ?? 0 };
  const pct = (a, b) => b ? Math.round(a / b * 100) + '%' : '—';
  const wk = { worked: week.reduce((n, r) => n + r.worked, 0), cleared: week.reduce((n, r) => n + r.cleared, 0), calls: week.reduce((n, r) => n + r.calls, 0) };

  el.innerHTML = `<div class="sbPage">
    <h1>Scoreboard</h1>
    <p class="lede">Three numbers, every day. Nothing else counts here: posts, likes and impressions live under Growth.</p>
    <section class="sbKpis">
      <div><span>Weekdays the team hit the Daily 3</span><b>${hits} of ${workdays.length}</b><em>${streak ? `${streak}-day streak` : 'No streak yet'}</em></div>
      <div><span>Targets worked, last 7 days</span><b>${wk.worked}</b><em>goal ${DAILY3.contact * workdays.length}</em></div>
      <div><span>Replies cleared, last 7 days</span><b>${wk.cleared}</b><em>queue goal: 0</em></div>
      <div><span>Calls booked, last 7 days</span><b>${wk.calls}</b><em>goal ${DAILY3.calls * workdays.length}</em></div>
    </section>
    <section class="card"><header><div><h2>Last 7 days, whole team</h2><p>✓ = target hit, ✕ = nothing done. Targets: ${DAILY3.contact} worked and ${DAILY3.calls} call a day.</p></div></header>
      <div class="body flush"><table class="tbl sbTbl"><thead><tr><th></th>${week.map(r => `<th class="${r.d === today ? 'sbToday' : ''}">${esc(label(r.d))}</th>`).join('')}</tr></thead><tbody>
        <tr><th>Targets worked</th>${week.map(r => cell(r.worked, isWeekday(r.d) ? DAILY3.contact : 0)).join('')}</tr>
        <tr><th>Replies cleared</th>${week.map(r => `<td>${r.cleared}</td>`).join('')}</tr>
        <tr><th>Calls booked</th>${week.map(r => cell(r.calls, isWeekday(r.d) ? DAILY3.calls : 0)).join('')}</tr>
      </tbody></table></div></section>
    <section class="card"><header><div><h2>Who did it, last 7 days</h2><p>Targets count for the person who owns the follow-up task. "Days with nothing" counts weekdays.</p></div></header>
      <div class="body flush">${per.length ? `<table class="tbl sbTbl"><thead><tr><th>Person</th><th>Targets worked</th><th>Replies cleared</th><th>Calls booked</th><th>Days with nothing</th></tr></thead><tbody>
        ${per.map(r => `<tr><th><span class="sbWho" data-ac="${acIdx(r.p)}">${avatar(r.p)}${esc(r.p)}</span></th><td>${r.worked}</td><td>${r.cleared}</td><td>${r.calls}</td><td class="${r.zero ? 'sbMiss' : ''}">${r.zero ? '✕ ' : ''}${r.zero}</td></tr>`).join('')}
      </tbody></table>` : '<div class="empty">Nothing logged in the last 7 days.</div>'}</div></section>
    <section class="card"><header><div><h2>Funnel, last 30 days</h2><p>Where deals leak. Each step's % is of the step before.</p></div></header>
      <div class="body"><ol class="sbFunnel">
        <li><b>${f30.worked}</b><span>Targets worked</span></li>
        <li><b>${f30.replies}</b><span>Replies in (all outreach)</span></li>
        <li><b>${f30.calls}</b><span>Calls booked</span><em>${pct(f30.calls, f30.replies)} of replies</em></li>
        <li><b>${f30.deals}</b><span>Live deals in Pipeline</span></li>
      </ol>
      <p class="s muted" style="margin:12px 0 0">Messages sent aren't counted yet: paste the Prosp key in Growth → Outbound so reply rates can be measured.</p></div></section>
  </div>`;
}
