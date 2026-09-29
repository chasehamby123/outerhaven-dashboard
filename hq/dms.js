// DM A/B tests and meeting logging.
// A test has 2+ versions of a DM. From Today the team taps "Sent" / "Reply" per version; meetings are logged in
// growth_meetings with the version they came from. Growth → DM tests compares versions on reply and meeting rate.
import { sb, state, esc, $, $$, toast, fail, modal, opts, today } from './core.js';
import { zTest } from './insights.js';

export const D = { tests: [], variants: [], stats: [], todayEvents: [], accounts: [], posts: [], convos: [], loaded: false };
const PREF = 'hq-dm-account';
const pref = { get: () => { try { return localStorage.getItem(PREF) || ''; } catch { return ''; } }, set: v => { try { localStorage.setItem(PREF, v); } catch { } } };
const opsDay = () => new Date(Date.now() + 6 * 3600e3).toISOString().slice(0, 10); // Malaysia time minus the 2 AM rollover

export async function loadDms() {
  const [t, v, s, e, a, p, c] = await Promise.all([
    sb.from('dm_tests').select('*').order('created_at', { ascending: false }),
    sb.from('dm_variants').select('*').order('label'),
    sb.from('dm_variant_stats').select('*'),
    sb.from('dm_events').select('id,variant_id,event,account_name,work_date').eq('work_date', opsDay()),
    sb.from('daily_ops_accounts').select('owner_name').order('sort_order'),
    sb.from('daily_ops_posts').select('id,post_name,work_date,account_id').or('is_repost.is.null,is_repost.eq.false').order('work_date', { ascending: false }).limit(60),
    sb.from('dm_conversations').select('id,thread_url,account_name,prospect_name,prospect_url,prospect_headline,message_count,replied,meeting_booked,dm_variant_id,variant_match,captured_at,captured_by_email,messages,ai').order('captured_at', { ascending: false }).limit(200),
  ]);
  D.convos = c.data || [];
  D.missing = !!t.error;
  D.tests = t.data || []; D.variants = v.data || []; D.stats = s.data || []; D.todayEvents = e.data || [];
  D.accounts = (a.data || []).map(x => x.owner_name).filter(Boolean); D.posts = p.data || []; D.loaded = true;
}
const statFor = id => D.stats.find(s => s.variant_id === id) || { sent: 0, replied: 0, meetings: 0 };
const variantsOf = testId => D.variants.filter(v => v.test_id === testId).sort((a, b) => a.label.localeCompare(b.label));
const pct = (x, n) => n ? `${(x / n * 100).toFixed(1)}%` : '—';

// Best vs runner-up on one rate. Winner only with 30+ sends each and p < 0.05; otherwise say what's missing.
export function dmVerdict(test, key = 'replied') {
  const vs = variantsOf(test.id).map(v => ({ v, ...statFor(v.id) }));
  if (vs.length < 2) return { text: 'Add a second version to compare.', tone: '' };
  const ranked = vs.filter(x => x.sent).sort((a, b) => b[key] / b.sent - a[key] / a.sent);
  if (ranked.length < 2) return { text: 'No sends logged yet.', tone: '' };
  const [a, b] = ranked, ra = a[key] / a.sent, rb = b[key] / b.sent, label = key === 'replied' ? 'reply rate' : 'meeting rate';
  if (!a[key] && !b[key]) return { text: `No ${key === 'replied' ? 'replies' : 'meetings'} yet.`, tone: '' };
  const t = zTest(b[key], b.sent, a[key], a.sent), minSent = Math.min(a.sent, b.sent);
  if (t && t.p < 0.05 && minSent >= 30) return { text: `${a.v.label} wins on ${label}: ${pct(a[key], a.sent)} vs ${pct(b[key], b.sent)} (p = ${t.p.toFixed(3)}).`, tone: 'good', winner: a.v };
  const pbar = (ra + rb) / 2, diff = Math.abs(ra - rb);
  const need = diff ? Math.ceil(7.85 * (ra * (1 - ra) + rb * (1 - rb)) / (diff * diff)) : null; // 80% power, 5% two-sided
  const more = need ? Math.max(need, 30) - minSent : null;
  return { text: `${a.v.label} leads on ${label} (${pct(a[key], a.sent)} vs ${pct(b[key], b.sent)}), not proven yet.${more > 0 && more < 5000 ? ` About ${more} more sends per version to know.` : pbar && !diff ? '' : ''}`, tone: 'warn' };
}

// ---------------- Today card ----------------
export function dmCardHtml() {
  if (D.missing) return '';
  const running = D.tests.filter(t => t.status === 'running');
  if (!running.length) return state.role === 'admin' ? `<section class="card dmCard"><div class="body s muted">No DM test running. <a href="#/growth/dms">Set one up in Growth → DM tests</a> so every DM you send teaches you something.</div></section>` : '';
  const acct = pref.get();
  return `<section class="card dmCard"><header><div><h2>DMs today</h2><p>Send the suggested version, then tap. Replies and meetings get tapped when they happen.</p></div>
      <label class="row s" style="gap:6px">From<select class="select sm" id="dmAcct" style="width:auto"><option value="">Account…</option>${opts(D.accounts, acct)}</select></label></header>
    ${running.map(t => {
      const vs = variantsOf(t.id), todayOf = (id, ev) => D.todayEvents.filter(e => e.variant_id === id && e.event === ev).length;
      const next = vs.slice().sort((a, b) => statFor(a.id).sent - statFor(b.id).sent || a.label.localeCompare(b.label))[0];
      return `<div class="dmTest"><div class="row s" style="justify-content:space-between;gap:10px"><b>${esc(t.name)}</b>${t.context ? `<span class="muted">${esc(t.context)}</span>` : ''}</div>
        ${vs.map(v => `<div class="dmVar${next && v.id === next.id ? ' next' : ''}">
          <div class="dmHead"><span class="dmLabel">${esc(v.label)}</span>${next && v.id === next.id ? '<span class="tag warn">Send this one next</span>' : ''}<span class="s muted" style="margin-left:auto">Today: ${todayOf(v.id, 'sent')} sent · ${todayOf(v.id, 'replied')} replies</span></div>
          <p class="dmMsg">${esc(v.message)}</p>
          <div class="row" style="gap:6px;flex-wrap:wrap"><button class="btn sm" data-copy="${v.id}">Copy message</button><button class="btn sm primary" data-dm="sent" data-v="${v.id}">+ Sent</button><button class="btn sm" data-dm="replied" data-v="${v.id}">+ Reply</button><button class="btn sm" data-mtg-v="${v.id}">Meeting booked</button></div>
        </div>`).join('')}</div>`;
    }).join('')}</section>`;
}

export function bindDmCard(root, refresh) {
  $('#dmAcct', root)?.addEventListener('change', e => pref.set(e.target.value));
  $$('[data-copy]', root).forEach(b => b.onclick = async () => { const v = D.variants.find(x => x.id === b.dataset.copy); try { await navigator.clipboard.writeText(v.message); toast('Copied'); } catch { toast('Copy failed: select the text instead'); } });
  $$('[data-dm]', root).forEach(b => b.onclick = async () => {
    b.disabled = true;
    const res = await sb.from('dm_events').insert({ variant_id: b.dataset.v, event: b.dataset.dm, work_date: opsDay(), account_name: $('#dmAcct', root)?.value || null, created_by: state.user?.id || null }).select('id').single();
    b.disabled = false;
    if (fail(res, 'Log DM')) return;
    undoToast(b.dataset.dm === 'sent' ? 'Logged 1 sent' : 'Logged 1 reply', async () => { await sb.from('dm_events').delete().eq('id', res.data.id); await loadDms(); refresh(); });
    await loadDms(); refresh();
  });
  $$('[data-mtg-v]', root).forEach(b => b.onclick = () => meetingModal({ variantId: b.dataset.mtgV, onSaved: async () => { await loadDms(); refresh(); } }));
}

function undoToast(msg, undo) {
  document.querySelectorAll('.toast').forEach(x => x.remove());
  const t = document.createElement('div'); t.className = 'toast'; t.innerHTML = `<span>${esc(msg)}</span><button type="button">Undo</button>`;
  t.querySelector('button').onclick = async () => { t.remove(); await undo(); };
  document.body.appendChild(t); setTimeout(() => t.remove(), 5000);
}

// ---------------- One-tap meeting ----------------
const SOURCE_OPTS = [['outbound_dm', 'Outbound DM'], ['comment_to_dm', 'Comment → DM (resource)'], ['inbound_dm', 'Inbound DM'], ['inbound_post', 'Inbound from a post'], ['referral', 'Referral'], ['other', 'Other']];
export async function meetingModal({ variantId = '', postId = '', onSaved } = {}) {
  if (!D.loaded) await loadDms();
  const vOpts = [['', '— not from a DM test —'], ...D.variants.map(v => { const t = D.tests.find(x => x.id === v.test_id); return [v.id, `${t?.name || 'Test'} · version ${v.label}`]; })];
  const pOpts = [['', '— not from a post —'], ...D.posts.map(p => [p.id, `${p.work_date} · ${(p.post_name || 'post').slice(0, 60)}`])];
  modal({ title: 'Meeting booked', submit: 'Log meeting', body: `<div class="form">
      <label class="field">Lead name<input class="input" name="lead_name" placeholder="Optional"></label>
      <label class="field">Company<input class="input" name="company" placeholder="Optional"></label>
      <label class="field">Account that got it<select class="select" name="account_name">${opts(['', ...D.accounts], pref.get())}</select></label>
      <label class="field">Where it came from<select class="select" name="source">${opts(SOURCE_OPTS, variantId ? 'comment_to_dm' : postId ? 'inbound_post' : 'outbound_dm')}</select></label>
      <label class="field full">DM version<select class="select" name="dm_variant_id">${opts(vOpts, variantId)}</select></label>
      <label class="field full">Post<select class="select" name="post_id">${opts(pOpts, postId)}</select></label>
      <label class="field">Meeting date<input class="input" type="date" name="meeting_date" value="${today()}"></label></div>`,
    onSubmit: async fd => {
      const row = Object.fromEntries(['lead_name', 'company', 'account_name', 'source', 'dm_variant_id', 'post_id', 'meeting_date'].map(k => [k, String(fd.get(k) || '').trim() || null]));
      const res = await sb.from('growth_meetings').insert({ ...row, status: 'booked', created_by: state.user?.id || null });
      if (fail(res, 'Log meeting')) return false;
      toast('Meeting logged'); await onSaved?.();
    } });
}

// ---------------- Growth tab ----------------
export async function dmTestsView(body) {
  body.innerHTML = '<div class="empty">Loading…</div>';
  await loadDms();
  if (D.missing) { body.innerHTML = '<div class="card"><div class="empty">DM tests need the database update (supabase/2026-09-30-dm-tests-analysis.sql).</div></div>'; return; }
  const draw = () => {
    body.innerHTML = `<section class="card"><header><div><h2>DM tests</h2><p>Test DM versions against each other on what matters: replies and meetings per message sent. Each DM sent is one trial, so these reach an answer far faster than post tests.</p></div><button class="btn primary" id="dmNew">New DM test</button></header>
      <div class="body s muted" style="padding-top:0">Easiest way to feed this: the <b>OuterHaven HQ browser extension</b>. Open a LinkedIn chat, click <b>HQ → Save</b>, and the whole conversation lands here, matched to its DM version, with replies and meetings counted automatically. <a href="/hq/outerhaven-hq-extension.zip" download>Download the extension</a> · <a href="#" id="dmHow">How to install</a></div>
      ${D.tests.length ? '' : '<div class="empty">No DM tests yet. Start with your resource DM: version A as you send it today, version B with one change (shorter, a question at the end, the link up front…).</div>'}</section>
      ${D.tests.map(t => {
        const vs = variantsOf(t.id), vr = dmVerdict(t, 'replied'), vm = dmVerdict(t, 'meetings');
        return `<section class="card" style="margin-top:20px"><header><div><h2>${esc(t.name)} <span class="tag ${t.status === 'running' ? 'good' : ''}">${esc(t.status)}</span></h2><p>${esc(t.context || '')}${t.hypothesis ? ` · Bet: ${esc(t.hypothesis)}` : ''}</p></div>
          <div class="row" style="gap:6px"><button class="btn sm" data-edit-test="${t.id}">Edit</button>${t.status === 'running' ? `<button class="btn sm ghost" data-status="${t.id}" data-to="paused">Pause</button><button class="btn sm ghost" data-status="${t.id}" data-to="complete">Finish</button>` : `<button class="btn sm ghost" data-status="${t.id}" data-to="running">Resume</button>`}</div></header>
          <div class="body flush scroll"><table class="tbl"><thead><tr><th>Version</th><th>Message</th><th class="n">Sent</th><th class="n">Replies</th><th class="n">Reply rate</th><th class="n">Meetings</th><th class="n">Meeting rate</th></tr></thead><tbody>
          ${vs.map(v => { const s = statFor(v.id); return `<tr><td class="strong">${esc(v.label)}${vr.winner?.id === v.id || vm.winner?.id === v.id ? ' <span class="tag good">winner</span>' : ''}</td><td class="s" style="max-width:420px;white-space:pre-wrap">${esc(v.message)}</td><td class="n">${s.sent}</td><td class="n">${s.replied}</td><td class="n strong">${pct(s.replied, s.sent)}</td><td class="n">${s.meetings}</td><td class="n strong">${pct(s.meetings, s.sent)}</td></tr>`; }).join('')}
          </tbody></table></div>
          <div class="body s"><div class="muted" style="margin-bottom:6px">${vs.reduce((n, v) => n + (statFor(v.id).captured || 0), 0)} of these sends come from saved LinkedIn conversations; the rest from taps on Today.</div><div><span class="tag ${vr.tone}">Replies</span> ${esc(vr.text)}</div><div style="margin-top:6px"><span class="tag ${vm.tone}">Meetings</span> ${esc(vm.text)}</div></div></section>`;
      }).join('')}
      ${convosHtml()}`;
    $('#dmNew', body).onclick = () => editTest();
    $('#dmHow', body).onclick = e => { e.preventDefault(); installHelp(); };
    $$('[data-convo]', body).forEach(r => r.onclick = () => transcript(D.convos.find(c => c.id === r.dataset.convo)));
    $$('[data-edit-test]', body).forEach(b => b.onclick = () => editTest(D.tests.find(t => t.id === b.dataset.editTest)));
    $$('[data-status]', body).forEach(b => b.onclick = async () => { if (!fail(await sb.from('dm_tests').update({ status: b.dataset.to, completed_at: b.dataset.to === 'complete' ? new Date().toISOString() : null }).eq('id', b.dataset.status), 'Update test')) { await loadDms(); draw(); } });
  };
  const editTest = t => {
    const vs = t ? variantsOf(t.id) : [{ label: 'A', message: '' }, { label: 'B', message: '' }];
    const { el } = modal({ title: t ? 'Edit DM test' : 'New DM test', wide: true, submit: 'Save', body: `<div class="form">
        <label class="field">Name<input class="input" name="name" required value="${esc(t?.name || '')}" placeholder="Resource DM: short vs long"></label>
        <label class="field">When this DM is sent<input class="input" name="context" value="${esc(t?.context || '')}" placeholder="After someone comments the keyword"></label>
        <label class="field full">What you're betting on <span class="muted">(optional)</span><input class="input" name="hypothesis" value="${esc(t?.hypothesis || '')}" placeholder="A question at the end gets more replies"></label>
        <div class="field full" id="dmVersions">${vs.map((v, i) => versionField(v, i)).join('')}</div>
        <div class="full"><button type="button" class="btn sm" id="dmAddV">Add version</button> <span class="s muted">Change one thing between versions, or you won't know what made the difference.</span></div></div>`,
      onSubmit: async fd => {
        const labels = fd.getAll('v_label'), msgs = fd.getAll('v_msg'), ids = fd.getAll('v_id');
        const rows = labels.map((l, i) => ({ id: ids[i] || null, label: String(l).trim() || String.fromCharCode(65 + i), message: String(msgs[i] || '').trim() })).filter(r => r.message);
        if (rows.length < 2) { toast('Add at least two versions'); return false; }
        const head = { name: String(fd.get('name')).trim(), context: String(fd.get('context') || '').trim() || null, hypothesis: String(fd.get('hypothesis') || '').trim() || null };
        let testId = t?.id;
        if (t) { if (fail(await sb.from('dm_tests').update(head).eq('id', t.id), 'Save test')) return false; }
        else { const r = await sb.from('dm_tests').insert({ ...head, created_by: state.user?.id || null }).select('id').single(); if (fail(r, 'Save test')) return false; testId = r.data.id; }
        for (const r of rows) {
          const res = r.id ? await sb.from('dm_variants').update({ label: r.label, message: r.message }).eq('id', r.id) : await sb.from('dm_variants').insert({ test_id: testId, label: r.label, message: r.message });
          if (fail(res, 'Save version')) return false;
        }
        toast('Saved'); await loadDms(); draw();
      } });
    $('#dmAddV', el).onclick = () => { const box = $('#dmVersions', el), n = box.querySelectorAll('.dmVField').length; box.insertAdjacentHTML('beforeend', versionField({ label: String.fromCharCode(65 + n), message: '' }, n)); };
  };
  draw();
}
const versionField = (v, i) => `<div class="dmVField"><input type="hidden" name="v_id" value="${esc(v.id || '')}"><input class="input" name="v_label" value="${esc(v.label)}" style="width:60px"><textarea class="textarea" name="v_msg" rows="4" placeholder="Version ${esc(v.label)} message, exactly as sent">${esc(v.message)}</textarea></div>`;

// ---------------- Captured conversations ----------------
function convosHtml() {
  const vLabel = id => { const v = D.variants.find(x => x.id === id); const t = v && D.tests.find(x => x.id === v.test_id); return v ? `${t?.name || 'Test'} · ${v.label}` : ''; };
  return `<section class="card" style="margin-top:20px"><header><div><h2>Saved LinkedIn conversations</h2><p>${D.convos.length} saved with the extension. Claude reads them every Monday for what books meetings.</p></div></header>
    <div class="body flush scroll">${D.convos.length ? `<table class="tbl"><thead><tr><th>Prospect</th><th>Our account</th><th>DM version</th><th class="n">Messages</th><th>Outcome</th><th>Saved</th></tr></thead><tbody>
    ${D.convos.map(c => `<tr data-convo="${c.id}" style="cursor:pointer"><td class="strong">${esc(c.prospect_name || '—')}<div class="s muted">${esc((c.prospect_headline || '').slice(0, 70))}</div></td><td>${esc(c.account_name || '—')}</td>
      <td class="s">${c.dm_variant_id ? esc(vLabel(c.dm_variant_id)) : '<span class="muted">No match</span>'}</td><td class="n">${c.message_count}</td>
      <td>${c.meeting_booked ? '<span class="tag good">Meeting</span>' : c.replied ? '<span class="tag warn">Replied</span>' : '<span class="tag">No reply yet</span>'}${c.ai?.stage && !c.meeting_booked ? ` <span class="tag">${esc(c.ai.stage)}</span>` : ''}</td>
      <td class="muted s" style="white-space:nowrap">${new Date(c.captured_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</td></tr>`).join('')}
    </tbody></table>` : '<div class="empty">Nothing saved yet. Install the extension and click HQ → Save on a LinkedIn chat.</div>'}</div></section>`;
}
function transcript(c) {
  if (!c) return;
  const ai = c.ai || {};
  modal({ title: c.prospect_name || 'Conversation', wide: true, submit: '', body: `<div class="s muted" style="margin-bottom:12px">${esc(c.prospect_headline || '')}${c.prospect_url ? ` · <a href="${esc(c.prospect_url)}" target="_blank" rel="noopener">Profile ↗</a>` : ''}${c.thread_url ? ` · <a href="${esc(c.thread_url)}" target="_blank" rel="noopener">Open chat ↗</a>` : ''}</div>
    ${ai.summary ? `<div class="card" style="margin-bottom:14px"><div class="body s"><b>Claude:</b> ${esc(ai.summary)}${ai.objections?.length ? `<div class="muted" style="margin-top:6px">Objections: ${esc(ai.objections.join('; '))}</div>` : ''}</div></div>` : ''}
    <div class="chat">${(c.messages || []).map(m => `<div class="bubble ${m.from}"><div class="s muted">${esc(m.from === 'us' ? (c.account_name || 'Us') : (m.name || c.prospect_name || 'Them'))} · ${esc(m.at || '')}</div><div>${esc(m.text)}</div></div>`).join('') || '<div class="empty">No structured messages; the raw text was saved for Claude.</div>'}</div>` });
}
function installHelp() {
  modal({ title: 'Install the OuterHaven HQ extension', submit: '', body: `<ol class="report">
    <li><a href="/hq/outerhaven-hq-extension.zip" download>Download the zip</a> and unzip it (you get a folder called <b>outerhaven-capture</b>).</li>
    <li><b>Chrome:</b> open <code>chrome://extensions</code>, turn on <b>Developer mode</b> (top right), click <b>Load unpacked</b> and pick that folder.</li>
    <li><b>AdsPower:</b> Extensions → Upload extension → pick the zip, then enable it for the LinkedIn profiles you use (Peter, Chase, …).</li>
    <li>Click the black <b>O</b> icon in the toolbar and sign in with your HQ email and password.</li>
    <li>On LinkedIn, open a conversation. A black <b>HQ</b> button appears bottom right: tick <b>meeting booked</b> if it is, then <b>Save conversation</b>. Saving again later updates it.</li></ol>
    <p class="s muted" style="margin-top:12px">It only reads the chat you have open, only when you click Save, and never sends or clicks anything on LinkedIn.</p>` });
}
