// Format tests (Growth → Post experiments, 11 Oct 2026). "2 posts with Sahid as a Presentation, 2 with Chase as a PDF carousel."
// Creating one books the next N posting slots of each arm's account as post_plan rows (experiment_id + arm + format), so:
//   Today shows the poster which format each of those posts must be, with how to make it;
//   the creation batch lists what has to be made; Schedule marks the slots;
//   the scraper matches each post to its slot and checks the format (format_check), so only posts that really went out in
//   the planned format count. Wrong-format and missed slots are listed, never silently averaged in.
// Results compare each post with its OWN account's usual numbers (median of that account's other posts, last 60 days),
// because two accounts with different audiences can't be compared raw: the account would be the variable, not the format.
import { sb, esc, fmt, fmtDate, opts, modal, toast, fail, state, $, $$, avatar } from './core.js';
import { store, load, saveExperiment } from './data.js';
import { opsDate } from './today.js';
import { loadFormats, formatList, fmtLabel, fmtIcon, fmtOf, nextDates, CHECK } from './formats.js';

const TZ_DAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const label12 = t => { const [h, m] = String(t || '0:0').split(':').map(Number); return `${((h + 11) % 12) + 1}${m ? ':' + String(m).padStart(2, '0') : ''} ${h >= 12 ? 'PM' : 'AM'}`; };
const dayLbl = iso => new Date(iso + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
const med = a => { const s = a.filter(Number.isFinite).sort((x, y) => x - y); if (!s.length) return null; const i = s.length >> 1; return s.length % 2 ? s[i] : (s[i - 1] + s[i]) / 2; };
export const isFormatTest = e => !!(e?.format_a || e?.format_b);

let weekly = [], plansByExp = new Map();
export async function loadTestData() {
  const [w, p] = await Promise.all([
    sb.from('daily_ops_weekly_posts').select('id,owner_name,day_of_week,start_time,active,format_key,content_code'),
    sb.from('post_plan').select('*').not('experiment_id', 'is', null),
    loadFormats(),
  ]);
  weekly = (w.data || []).filter(x => x.active !== false);
  plansByExp = new Map(); for (const r of p.data || []) (plansByExp.get(r.experiment_id) || plansByExp.set(r.experiment_id, []).get(r.experiment_id)).push(r);
}

// The next `n` slots for an account from `from` (ops dates), skipping slots another format test already holds.
function nextSlots(owner, n, from, taken) {
  const mine = weekly.filter(w => w.owner_name === owner);
  const out = [];
  for (const w of mine) for (const d of nextDates(w.day_of_week, n + 2, from)) if (!taken.has(`${w.id}|${d}`)) out.push({ w, d });
  return out.sort((a, b) => a.d.localeCompare(b.d) || String(a.w.start_time).localeCompare(String(b.w.start_time))).slice(0, n);
}

export async function editFormatTest() {
  await loadTestData();
  const acc = [...new Set(weekly.map(w => w.owner_name).filter(Boolean))].sort();
  const fl = formatList().map(f => [f.key, f.label]);
  const taken = new Set([...plansByExp.values()].flat().map(p => `${p.weekly_post_id}|${p.work_date}`));
  const { el } = modal({ title: 'New format test', wide: true, submit: 'Book the slots', body: `<p class="s muted" style="margin:0 0 10px">Books the next free posting slots of each account in the test format. <a href="#/guide/test" data-x>How format tests work</a></p><div class="form">
      <label class="field full">Name<input class="input" name="name" required placeholder="Presentation vs PDF carousel"></label>
      <div class="field"><b>Arm A</b><select class="select" name="account_a" required><option value="">Account…</option>${opts(acc)}</select><select class="select" name="format_a" required>${opts(fl, 'presentation')}</select></div>
      <div class="field"><b>Arm B</b><select class="select" name="account_b" required><option value="">Account…</option>${opts(acc)}</select><select class="select" name="format_b" required>${opts(fl, 'pdf')}</select></div>
      <label class="field">Posts per arm<input class="input" type="number" name="n" min="1" max="8" value="2"></label>
      <label class="field">Starting<input class="input" type="date" name="from" value="${opsDate()}"></label>
      <label class="field">Judge on<select class="select" name="primary_metric">${opts([['comments', 'Audience comments'], ['reactions', 'Reactions'], ['engagement', 'Comments + reactions + reposts'], ['meetings', 'Meetings']], 'comments')}</select></label>
      <label class="field full">Why we think it'll work<textarea class="textarea" name="hypothesis" placeholder="Landscape slides read like a pitch deck, so investors stop and swipe…"></textarea></label>
      <div class="full" id="ftPreview"></div>
    </div>`,
    onSubmit: async fd => {
      const v = k => String(fd.get(k) || '').trim();
      const n = Math.max(1, Math.min(8, Number(fd.get('n')) || 2)), from = v('from') || opsDate();
      const plan = preview(v('account_a'), v('account_b'), n, from, taken);
      if (plan.short.length) { toast(plan.short.join(' · ')); return false; }
      const row = { name: v('name'), variable: 'Format', primary_metric: v('primary_metric'), hypothesis: v('hypothesis') || null, status: 'running', started_at: from,
        account_a: v('account_a'), account_b: v('account_b'), format_a: v('format_a'), format_b: v('format_b'), posts_per_arm: n,
        variant_a: `${fmtLabel(v('format_a'))} · ${v('account_a')}`, variant_b: `${fmtLabel(v('format_b'))} · ${v('account_b')}` };
      const r = await saveExperiment(null, row); if (fail(r, 'Create test')) return false;
      const rows = plan.slots.map(s => ({ weekly_post_id: s.w.id, work_date: s.d, format_key: v(s.arm === 'A' ? 'format_a' : 'format_b'), experiment_id: r.data.id, arm: s.arm, note: row.name, created_by: state.user?.id || null }));
      if (fail(await sb.from('post_plan').upsert(rows, { onConflict: 'weekly_post_id,work_date' }), 'Book slots')) { await sb.from('daily_ops_experiments').delete().eq('id', r.data.id); return false; }
      toast(`Booked ${rows.length} posts. Today will show the format on each one.`); await load();
    },
  });
  // Live preview of the slots that will be booked (same account on both arms alternates A, B, A, B).
  const draw = () => {
    const f = new FormData(el), n = Math.max(1, Math.min(8, Number(f.get('n')) || 2));
    const plan = preview(f.get('account_a'), f.get('account_b'), n, f.get('from') || opsDate(), taken);
    $('#ftPreview', el).innerHTML = !f.get('account_a') || !f.get('account_b') ? '<p class="s muted">Pick both accounts to see which posts get booked.</p>'
      : `<div class="ftSlots">${['A', 'B'].map(arm => `<div><b>Arm ${arm}: ${fmtIcon(f.get('format_' + arm.toLowerCase()))} ${esc(fmtLabel(f.get('format_' + arm.toLowerCase())))}</b><ul>${plan.slots.filter(s => s.arm === arm).map(s => `<li>${avatar(s.w.owner_name, 'xs')} ${esc(dayLbl(s.d))} · ${label12(s.w.start_time)} <span class="muted">(${esc(s.w.content_code || 'post')})</span></li>`).join('') || '<li class="muted">No slots</li>'}</ul></div>`).join('')}</div>
        ${plan.short.length ? `<p class="s" style="color:var(--bad)">⚠ ${esc(plan.short.join(' · '))}</p>` : '<p class="s muted">These slots switch to the test format on Today. Change the content on them if a lead magnet was planned there.</p>'}
        ${f.get('account_a') === f.get('account_b') ? '<p class="s muted">Same account on both arms: fairest test (same audience). Slots alternate A, B, A, B.</p>' : '<p class="s muted">Different accounts: results are compared with each account\'s own usual numbers, not raw.</p>'}`;
  };
  $$('select,input', el).forEach(x => x.addEventListener('change', draw)); $('[name=n]', el).addEventListener('input', draw); draw();
}

function preview(a, b, n, from, taken) {
  const short = [], slots = [];
  if (!a || !b) return { slots, short: ['Pick both accounts'] };
  if (a === b) {
    const s = nextSlots(a, n * 2, from, taken); s.forEach((x, i) => slots.push({ ...x, arm: i % 2 ? 'B' : 'A' }));
    if (s.length < n * 2) short.push(`${a} only has ${s.length} free posting slots in the next weeks`);
  } else {
    for (const [arm, who] of [['A', a], ['B', b]]) {
      const s = nextSlots(who, n, from, taken); s.forEach(x => slots.push({ ...x, arm }));
      if (s.length < n) short.push(`${who} has ${s.length} free posting slot${s.length === 1 ? '' : 's'} (needs ${n}): add one in Schedule`);
    }
  }
  return { slots: slots.sort((x, y) => x.d.localeCompare(y.d)), short };
}

const metricOf = (r, k) => k === 'reactions' ? Number(r.reaction_count || 0) : k === 'engagement' ? Number(r.external_comment_count ?? r.commenter_count ?? 0) + Number(r.reaction_count || 0) + Number(r.repost_count || 0)
  : k === 'meetings' ? store.meetings.filter(m => m.post_id === r.id).length : Number(r.external_comment_count ?? r.commenter_count ?? 0);

// Card body for a format test: per arm, every booked slot with what happened, then the result vs each account's baseline.
export function formatTestHtml(e) {
  const plans = (plansByExp.get(e.id) || []).sort((a, b) => a.work_date.localeCompare(b.work_date));
  const k = e.primary_metric || 'comments', today = opsDate();
  const acctId = name => store.accounts.find(a => a.owner_name === name)?.id;
  const posts = store.rawPosts.filter(r => !r.is_repost);
  const since = Date.now() - 60 * 864e5;
  const baseline = name => med(posts.filter(r => r.account_id === acctId(name) && r.experiment_id !== e.id && Date.parse(r.posted_at) > since).map(r => metricOf(r, k)));
  const arms = ['A', 'B'].map(arm => {
    const fk = e['format_' + arm.toLowerCase()], who = e['account_' + arm.toLowerCase()];
    const rows = plans.filter(p => p.arm === arm).map(p => {
      const post = posts.find(r => r.slot_weekly_id === p.weekly_post_id && r.slot_date === p.work_date);
      const st = post ? (post.format_check || 'unknown') : p.work_date > today ? 'upcoming' : p.work_date === today ? 'today' : 'missed';
      return { p, post, st, who: weekly.find(w => w.id === p.weekly_post_id)?.owner_name || who };
    });
    const good = rows.filter(r => r.st === 'match');
    const vals = good.map(r => metricOf(r.post, k)), base = med(rows.map(r => baseline(r.who)).filter(x => x != null));
    const lift = good.length && base ? med(good.map(r => { const b = baseline(r.who); return b ? metricOf(r.post, k) / b : null; }).filter(x => x != null)) : null;
    return { arm, fk, who, rows, good, avg: vals.length ? vals.reduce((x, y) => x + y, 0) / vals.length : null, base, lift };
  });
  const STATE = { match: CHECK.match, mismatch: CHECK.mismatch, unknown: CHECK.unknown, upcoming: ['', '○', 'Coming up'], today: ['warn', '●', 'Today'], missed: ['bad', '✕', 'Not posted'] };
  const done = arms.every(a => a.good.length >= (e.posts_per_arm || 1));
  const [A, B] = arms, call = A.lift != null && B.lift != null ? (Math.abs(A.lift - B.lift) < 0.15 ? 'No clear difference' : `${A.lift > B.lift ? 'A' : 'B'} ahead: ${(Math.max(A.lift, B.lift) * 100).toFixed(0)}% of its account's usual vs ${(Math.min(A.lift, B.lift) * 100).toFixed(0)}%`) : 'Waiting for posts';
  const small = Math.min(A.good.length, B.good.length) < 4;
  return `<div class="variants">${arms.map(a => `<div class="variant">
      <div class="row"><b>${a.arm}</b><span class="fmtChip strong"><i aria-hidden="true">${fmtIcon(a.fk)}</i>${esc(fmtLabel(a.fk))}</span>${a.who ? avatar(a.who, 'xs') + `<span class="s">${esc(a.who)}</span>` : ''}</div>
      <ul class="ftRows">${a.rows.map(r => { const [tone, sym, word] = STATE[r.st] || CHECK.unknown; return `<li data-tone="${tone}"><b aria-hidden="true">${sym}</b><span>${esc(dayLbl(r.p.work_date))}</span><span>${esc(word)}${r.st === 'mismatch' ? `: went out as ${esc(fmtLabel(r.post.detected_format))}` : ''}</span>${r.post?.linkedin_post_url ? `<a href="${esc(r.post.linkedin_post_url)}" target="_blank" rel="noopener">${fmt(metricOf(r.post, k))} ${esc(k)} ↗</a>` : ''}</li>`; }).join('') || '<li class="muted">No slots booked</li>'}</ul>
      ${(() => { const lost = a.rows.filter(r => ['missed', 'mismatch'].includes(r.st)).length, live = a.rows.filter(r => !['missed', 'mismatch'].includes(r.st)).length, short = (e.posts_per_arm || 0) - live; return lost && short > 0 && state.role === 'admin' && e.status !== 'complete' ? `<button type="button" class="btn sm" data-ftmore="${e.id}|${a.arm}|${short}" title="Missed or wrong-format posts can't count. Book the next free slot(s) instead.">Book ${short} replacement${short === 1 ? '' : 's'}</button>` : ''; })()}
      <div class="mgrid"><div><span>Counted posts</span><b>${a.good.length} / ${e.posts_per_arm || a.rows.length}</b></div><div><span>Avg ${esc(k)}</span><b>${a.avg == null ? '—' : fmt(a.avg)}</b></div><div><span>Account's usual</span><b>${a.base == null ? '—' : fmt(a.base)}</b></div><div><span>vs usual</span><b>${a.lift == null ? '—' : `${a.lift >= 1 ? '▲' : '▼'} ${(a.lift * 100).toFixed(0)}%`}</b></div></div>
    </div>`).join('')}</div>
    <div class="body s" style="border-top:1px solid var(--line)"><b>${esc(call)}</b>${small ? ' · directional only: under 4 counted posts per arm, one viral post can flip it. Run it again before changing the plan.' : ''}${done ? '' : ` · ${arms.reduce((n, a) => n + a.rows.filter(r => ['upcoming', 'today'].includes(r.st)).length, 0)} posts still to go`}
      ${plans.some(p => p.work_date >= today) && state.role === 'admin' ? ` · <button type="button" class="link" data-ftcancel="${e.id}">Release the remaining slots</button>` : ''}</div>`;
}

export function bindFormatTests(root) {
  // A post that was missed or went out in the wrong format can't count: book the arm's next free slot(s) instead.
  $$('[data-ftmore]', root).forEach(b => b.onclick = async () => {
    const [id, arm, n] = b.dataset.ftmore.split('|'), e = store.experiments.find(x => x.id === id); if (!e) return;
    const taken = new Set([...plansByExp.values()].flat().map(p => `${p.weekly_post_id}|${p.work_date}`));
    const who = e['account_' + arm.toLowerCase()], slots = nextSlots(who, Number(n), opsDate(), taken);
    if (!slots.length) { toast(`${who} has no free posting slot coming up: add one in Schedule`); return; }
    const rows = slots.map(s => ({ weekly_post_id: s.w.id, work_date: s.d, format_key: e['format_' + arm.toLowerCase()], experiment_id: id, arm, note: e.name + ' (replacement)', created_by: state.user?.id || null }));
    if (fail(await sb.from('post_plan').upsert(rows, { onConflict: 'weekly_post_id,work_date' }), 'Book replacement')) return;
    toast(`Booked ${rows.map(r => dayLbl(r.work_date)).join(', ')}`); await loadTestData(); await load();
  });
  $$('[data-ftcancel]', root).forEach(b => b.onclick = async () => {
    if (!confirm('Release the slots that haven\'t happened yet? They go back to their weekly format.')) return;
    if (fail(await sb.from('post_plan').delete().eq('experiment_id', b.dataset.ftcancel).gte('work_date', opsDate()), 'Release slots')) return;
    toast('Slots released'); await loadTestData(); await load();
  });
}
