// Omnichannel outreach from HQ (10 Oct 2026): "Send today's batch" picks the day's BDC + credit targets that have a contact,
// a person ticks them, and the outreach edge function enrols each in Prosp (LinkedIn) and PlusVibe (email).
// LinkedIn first: when the LinkedIn step goes out, the email follows email_delay_days later, only if they haven't replied.
// Copy lives in the Prosp / PlusVibe campaigns. HQ sends Prosp's standard fields + {{deadline}}, and shows each person's exact
// message before sending. Personalisation = one true, dated fact about THEIR company; no AI icebreakers, no opener.
// Variant test (11 Oct): dated vs plain (same message without the date line) when an account has a plain campaign.
import { sb, esc, $, $$, toast, modal, opts } from './core.js';
import { loadContacts, bestPerson } from './contacts.js';
import { needLine } from './kinds.js';

// Same rules as the outreach function (cleanName / deadlineOf), so the preview is what Prosp sends.
export function cleanName(n) {
  let s = String(n || '').replace(/\s*\/[A-Z]{2}\/?\s*$/, '').replace(/\s*\(.*?\)\s*/g, ' ');
  const SUF = /,?\s+(incorporated|inc|corp|corporation|co|company|ltd|llc|l\.l\.c|plc|lp|l\.p|holdings?|holding corp|group|buyer|midco|bidco|topco|holdco|parent|intermediate|acquisition|borrower|finco|us|usa)\.?$/i;
  for (let i = 0; i < 6 && SUF.test(s.trim()) && s.trim().split(/\s+/).length > 1; i++) s = s.trim().replace(SUF, '');
  s = s.replace(/[,.\s]+$/, '').replace(/\s+/g, ' ').trim();
  if (s === s.toUpperCase()) s = s.split(' ').map(w => w.length <= 3 && /^[A-Z]+$/.test(w) ? w : w.charAt(0) + w.slice(1).toLowerCase()).join(' ');
  return s || String(n || '');
}
const MON = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export function deadlineOf(kind, sig, now = Date.now()) {
  const my = d => `${MON[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  if (kind === 'bdc' && sig.earliest_maturity) { const d = new Date(sig.earliest_maturity); if (d.getTime() > now) return `a loan maturing in ${my(d)}`; }
  if (kind === 'credit' && Number(sig.debt_current) > 0 && sig.period_end) { const d = new Date(sig.period_end); d.setUTCFullYear(d.getUTCFullYear() + 1); if (d.getTime() > now) return `debt coming due by ${my(d)}`; }
  return null;
}
// The LinkedIn message (Peter). Defaults = the Prosp campaign copy on 11 Oct; Outreach setup keeps the live copies in sync.
export const TEMPLATE = {
  dated: "Hi {{First name}},\n\nNoticed {{company}} has {{deadline}}.\n\nI've spent 30+ years in private credit and know most of the lenders personally. I can tell you what they'd offer {{company}} today.\n\nWould that be of interest?\n\nPeter",
  plain: "Hi {{First name}},\n\nI've spent 30+ years in private credit and know most of the lenders personally. I can tell you what they'd offer {{company}} today.\n\nWould that be of interest?\n\nPeter",
};
// What the cards copy ("Copy message"): the same message Prosp would send, dated when there's a date to cite.
export function messageFor(kind, s, name = '', st = {}) {
  const deadline = kind === 'ucc' ? null : deadlineOf(kind, s);
  const t = deadline ? (st.li_template_dated || TEMPLATE.dated) : (st.li_template_plain || TEMPLATE.plain);
  return fillTemplate(t, { first_name: String(name || '').trim().split(/\s+/)[0] || 'there', company: cleanName(s.company_name), deadline: deadline || '' });
}
export const fillTemplate = (t, v) => String(t || '').replace(/\{\{\s*([^}]+?)\s*\}\}/g, (m, k) => { const key = k.toLowerCase().replace(/\s+/g, '_'); return v[key] ?? v[k] ?? m; });

const OWNERS = ['Peter', 'Chase', 'Tengku'];
const monthsTo = d => d ? (Date.parse(d) - Date.now()) / (30.4 * 864e5) : null;
// Soonest FUTURE maturity first. A date already passed (Elliott: Jan 2026) usually means the loan was extended: no date to cite, sort last.
const ahead = d => { const m = monthsTo(d); return m == null || m < 0 ? 99 : m; };

async function settings() {
  const r = await sb.from('outreach_settings').select('*').eq('id', 1).maybeSingle();
  return r.data || { prosp: [], bdc_per_day: 10, credit_per_day: 10, min_email_score: 90 };
}
const emailOk = (p, min) => p?.email && (p.email_status === 'valid' || (p.email_score ?? 0) >= min);

// Today's picks: BDC targets maturing soonest, then lendable public credit targets (positive EBITDA, $20M+ revenue,
// no going-concern warning), each with a usable contact. Nothing already enrolled.
async function picks(st) {
  const [bdc, cr, en] = await Promise.all([
    sb.from('bdc_signals').select('*').eq('verdict', 'target').eq('status', 'new').limit(2000),
    sb.from('credit_signals').select('*').eq('verdict', 'target').eq('status', 'new').limit(2000),
    sb.from('outreach_enrollments').select('kind,key'),
  ]);
  await Promise.all([loadContacts('bdc', true), loadContacts('credit', true)]);
  const done = new Set((en.data || []).map(e => `${e.kind}:${e.key}`));
  const usable = (kind, key) => { const p = bestPerson(kind, key); return p && (p.linkedin || emailOk(p, st.min_email_score)) ? p : null; };
  const b = (bdc.data || []).filter(s => !done.has(`bdc:${s.company_key}`)).map(s => ({ kind: 'bdc', key: s.company_key, s, p: usable('bdc', s.company_key) }))
    .filter(x => x.p).sort((x, y) => ahead(x.s.earliest_maturity) - ahead(y.s.earliest_maturity) || y.s.score - x.s.score);
  const c = (cr.data || []).filter(s => !done.has(`credit:${String(Number(s.cik))}`) && s.ebitda > 0 && s.revenue >= 20e6 && !(s.flags || {}).going_concern)
    .map(s => ({ kind: 'credit', key: String(Number(s.cik)), s, p: usable('credit', String(Number(s.cik))) })).filter(x => x.p).sort((x, y) => y.s.score - x.s.score);
  const waiting = { bdc: (bdc.data || []).length, credit: (cr.data || []).length };
  // A lead is sendable when it has a date to cite (dated message), or a plain campaign exists, or it has a valid email.
  const anyPlain = (st.prosp || []).some(a => a.plain_campaign_id);
  const can = x => (x.deadline = deadlineOf(x.kind, x.s)) || anyPlain || emailOk(x.p, st.min_email_score);
  const bb = b.filter(can), cc = c.filter(can);
  return { list: [...bb.slice(0, st.bdc_per_day ?? 10), ...cc.slice(0, st.credit_per_day ?? 10)], waiting, ready: { bdc: bb.length, credit: cc.length }, held: b.length + c.length - bb.length - cc.length };
}

export async function sendBatchModal(onDone) {
  const st = await settings();
  const { data: keys } = await sb.rpc('contact_keys_set');
  const { list, ready, held } = await picks(st);
  const accounts = (st.prosp || []).filter(a => a.campaign_id && a.list_id);
  const owners = accounts.length ? accounts.map(a => a.owner) : OWNERS;
  // Which message each person gets. Dated leads are split dated / plain when the sender has a plain campaign (the test);
  // undated leads get plain, or email only. Chosen here so the preview is exactly what goes out.
  const split = Number(st.test_split ?? 0.5);
  const variantFor = (x, owner) => { const a = accounts.find(y => y.owner === owner); const plain = !!a?.plain_campaign_id;
    if (x.p.linkedin && a && x.deadline) return plain && (x.coin ??= Math.random()) >= split ? 'plain' : 'dated';
    return x.p.linkedin && plain ? 'plain' : 'email_only'; };
  const msg = (x, v) => v === 'email_only' ? '' : fillTemplate(v === 'dated' ? (st.li_template_dated || TEMPLATE.dated) : (st.li_template_plain || TEMPLATE.plain), { first_name: String(x.p.name).split(/\s+/)[0], company: cleanName(x.s.company_name), deadline: x.deadline || '' });
  const VLABEL = { dated: '▲ Dated', plain: '○ Plain', email_only: '✉ Email only' };
  const cell = (x, i, owner) => { const v = variantFor(x, owner); return `<span class="obVar" data-v="${v}">${VLABEL[v]}</span>${x.deadline ? `<div class="s muted">${esc(x.deadline)}</div>` : '<div class="s muted">no date to cite</div>'}${v === 'email_only' ? '' : `<details class="obMsg"><summary>Message</summary><pre>${esc(msg(x, v))}</pre></details>`}`; };
  const warn = [!keys?.prosp && 'No Prosp key: LinkedIn will be skipped.', keys?.prosp && !accounts.length && 'No Prosp campaign set: LinkedIn will be skipped.',
    !keys?.plusvibe && 'No PlusVibe key: email will be skipped.', keys?.plusvibe && !(st.plusvibe_workspace_id && st.plusvibe_campaign_id) && 'No PlusVibe campaign set: email will be skipped.'].filter(Boolean);
  modal({
    title: "Send today's batch", submit: list.length ? `Send ${list.length}` : 'Close', wide: true,
    body: `<div class="obWrap">
      <p class="s muted" style="margin:0 0 10px">${held ? `${held} held back: no date to cite, no plain campaign, no email. ` : ''}${list.filter(x => x.kind === 'bdc').length} BDC (maturing soonest) + ${list.filter(x => x.kind === 'credit').length} public credit (lendable). Ready with a contact: ${ready.bdc} BDC, ${ready.credit} credit. Untick anyone who looks wrong.</p>
      ${warn.length ? `<div class="obWarn">⚠ ${warn.map(esc).join('<br>⚠ ')} <button type="button" class="link" id="obSetup">Outreach setup</button></div>` : ''}
      ${list.length ? `<table class="tbl obTbl"><thead><tr><th></th><th>Company</th><th>Contact</th><th>Message</th><th>LinkedIn</th><th>Email</th><th>From</th></tr></thead><tbody>
      ${list.map((x, i) => `<tr><td><input type="checkbox" name="pick" value="${i}" checked aria-label="Send to ${esc(x.s.company_name)}"></td>
        <td><b>${esc(x.s.company_name)}</b><br><span class="s muted">${x.kind === 'bdc' ? 'BDC' : 'Public'} · ${esc(needLine(x.s.reasons) || '')}</span></td>
        <td>${esc(x.p.name)}<br><span class="s muted">${esc(x.p.title || x.p.role?.toUpperCase() || '')}${x.p.employer ? ' at ' + esc(x.p.employer) : ''}${x.p.source === 'sec' ? ' · SEC' : x.p.status === 'confirmed' ? ' · confirmed' : ' · unconfirmed'}</span></td>
        <td class="obMsgCell" data-row="${i}">${cell(x, i, owners[i % owners.length])}</td>
        <td>${x.p.linkedin ? `<a href="${esc(x.p.linkedin)}" target="_blank" rel="noopener">✓ ↗</a>` : '—'}</td>
        <td>${emailOk(x.p, st.min_email_score) ? '✓' : x.p.email ? '<span class="s muted">low score</span>' : '—'}</td>
        <td><select class="select sm" name="owner${i}">${opts(owners, owners[i % owners.length])}</select></td></tr>`).join('')}
      </tbody></table>` : '<div class="empty">No targets with a contact yet. Contacts fill in as the lookup runs (about 120 companies a day), or click "Find contacts" on a card.</div>'}</div>`,
    async onSubmit(fd) {
      if (!list.length) return;
      const idx = fd.getAll('pick').map(Number);
      const items = idx.map(i => { const x = list[i], owner = fd.get(`owner${i}`); return { kind: x.kind, key: x.key, person: x.p.name, owner, variant: variantFor(x, owner) }; });
      if (!items.length) return;
      const { data, error } = await sb.functions.invoke('outreach', { body: { action: 'send', items } });
      if (error || data?.ok === false) { toast(data?.error || error?.message || 'Send failed'); return false; }
      const res = data.results || [], sent = res.filter(r => r.status === 'sent').length;
      const li = res.filter(r => r.prosp_status === 'added').length, em = res.filter(r => r.plusvibe_status === 'added').length, later = res.filter(r => r.plusvibe_status === 'scheduled').length;
      toast(`Sent ${sent} of ${items.length}: ${li} on LinkedIn, ${em} by email${later ? `, ${later} emails follow in ${st.email_delay_days ?? 3} days unless they reply on LinkedIn` : ''}`);
      onDone?.();
    },
  });
  $('#obSetup')?.addEventListener('click', () => { document.querySelector('.modal .x, .modal [data-close]')?.click(); outreachSetup(); });
  // The send button counts what is ticked, so "Send 10" never goes out with 3 ticked.
  const btn = document.querySelector('.modal button[type=submit]');
  const recount = () => { const n = $$('.modal input[name=pick]:checked').length; if (btn) { btn.textContent = n ? `Send ${n}` : 'Nothing ticked'; btn.disabled = !n; } };
  $$('.modal input[name=pick]').forEach(b => b.addEventListener('change', recount));
  // Changing the sender can change the variant (only some accounts have a plain campaign): redraw that row's message.
  list.forEach((x, i) => $(`.modal select[name=owner${i}]`)?.addEventListener('change', e => { const td = $(`.modal .obMsgCell[data-row="${i}"]`); if (td) td.innerHTML = cell(x, i, e.target.value); }));
}

export async function outreachSetup() {
  const st = await settings();
  const [{ data: keys }, { data: hook }] = await Promise.all([sb.rpc('contact_keys_set'), sb.rpc('plusvibe_webhook_url')]);
  let campaigns = [];
  if (keys?.prosp) { const r = await sb.functions.invoke('outreach', { body: { action: 'campaigns' } }); campaigns = r.data?.prosp || []; }
  const acct = o => (st.prosp || []).find(a => a.owner === o) || {};
  const campOpts = sel => `<option value="">Not set</option>${campaigns.map(c => `<option value="${esc(c.campaign_id)}" ${c.campaign_id === sel ? 'selected' : ''}>${esc(c.campaign_name)}</option>`).join('')}`;
  modal({
    title: 'Outreach setup', submit: 'Save', wide: true,
    body: `<div class="form pForm">
      <p class="s muted" style="grid-column:1/-1;margin:0">Write the message sequences inside Prosp (LinkedIn) and PlusVibe (email). Use the fields HQ sends: <code>{{First name}}</code>, <code>{{company}}</code>, <code>{{deadline}}</code> (Prosp) / <code>{{first_name}}</code>, <code>{{company_name}}</code> (PlusVibe). Every lead's message is previewed in the send window. Keys are write-only.</p>
      <label class="field">Prosp API key ${keys?.prosp ? '<em class="ctOk">✓ saved</em>' : ''}<input class="input" name="prosp_key" type="password" autocomplete="off" placeholder="${keys?.prosp ? 'Saved. Paste to replace' : 'Paste key'}"></label>
      <label class="field">PlusVibe API key ${keys?.plusvibe ? '<em class="ctOk">✓ saved</em>' : ''}<input class="input" name="pv_key" type="password" autocomplete="off" placeholder="${keys?.plusvibe ? 'Saved. Paste to replace' : 'Paste key (Business plan)'}"></label>
      <h4 class="obH">LinkedIn: Prosp campaigns per account${keys?.prosp ? '' : ' (save the Prosp key first to pick campaigns)'}</h4>
      <p class="s muted" style="grid-column:1/-1;margin:0">Dated = the message with "Noticed {{company}} has {{deadline}}". Plain (optional) = a copy of that campaign with the deadline line removed: leads with no date go there, and ${Math.round((1 - Number(st.test_split ?? 0.5)) * 100)}% of dated leads too, so we learn whether the date earns replies.</p>
      ${OWNERS.map(o => `<div class="obRow obRow3"><b>${o}</b>
        ${campaigns.length ? `<select class="select" name="camp_${o}" aria-label="${o} dated campaign">${campOpts(acct(o).campaign_id)}</select><select class="select" name="plain_${o}" aria-label="${o} plain campaign">${campOpts(acct(o).plain_campaign_id).replace('Not set', 'Plain: not set')}</select>`
          : `<input class="input" name="camp_${o}" placeholder="Dated campaign ID" value="${esc(acct(o).campaign_id || '')}"><input class="input" name="plain_${o}" placeholder="Plain campaign ID (optional)" value="${esc(acct(o).plain_campaign_id || '')}">`}
        <input class="input" name="list_${o}" placeholder="Prosp list ID" value="${esc(acct(o).list_id || '')}"></div>`).join('')}
      <label class="field">Share of dated leads that get the dated message<input class="input" name="split" type="number" min="0" max="1" step="0.1" value="${st.test_split ?? 0.5}"></label>
      <div class="field" id="obResults" style="grid-column:1/-1"></div>
      <label class="field" style="grid-column:1/-1">Dated message (copy of the Prosp step, for HQ's preview only)<textarea class="textarea" name="tpl_dated" rows="7">${esc(st.li_template_dated || '')}</textarea></label>
      <label class="field" style="grid-column:1/-1">Plain message (copy of the Prosp step)<textarea class="textarea" name="tpl_plain" rows="6">${esc(st.li_template_plain || '')}</textarea></label>
      <h4 class="obH">Email: PlusVibe</h4>
      <label class="field">Workspace ID<input class="input" name="pv_ws" value="${esc(st.plusvibe_workspace_id || '')}"></label>
      <label class="field">Campaign ID<input class="input" name="pv_camp" value="${esc(st.plusvibe_campaign_id || '')}"></label>
      <label class="field" style="grid-column:1/-1">Reply webhook for PlusVibe (Settings → Webhooks → event "Email Replies")<input class="input" readonly value="${esc(hook || '')}" onclick="this.select()"></label>
      <h4 class="obH">Daily batch</h4>
      <label class="field">BDC per day<input class="input" name="bdc_n" type="number" min="0" max="40" value="${st.bdc_per_day ?? 10}"></label>
      <label class="field">Credit per day<input class="input" name="cr_n" type="number" min="0" max="40" value="${st.credit_per_day ?? 10}"></label>
      <label class="field">Email after LinkedIn (days)<input class="input" name="delay" type="number" min="0" max="14" value="${st.email_delay_days ?? 3}"></label>
      <label class="field">Min Hunter email score<input class="input" name="min_score" type="number" min="50" max="100" value="${st.min_email_score ?? 90}"></label></div>`,
    async onSubmit(fd) {
      for (const [f, name] of [['prosp_key', 'PROSP_API_KEY'], ['pv_key', 'PLUSVIBE_API_KEY']]) {
        const v = String(fd.get(f) || '').trim();
        if (v) { const r = await sb.rpc('set_contact_key', { p_name: name, p_value: v }); if (r.error) { toast(r.error.message); return false; } }
      }
      const prosp = OWNERS.map(o => ({ owner: o, campaign_id: String(fd.get(`camp_${o}`) || '').trim() || null, plain_campaign_id: String(fd.get(`plain_${o}`) || '').trim() || null, list_id: String(fd.get(`list_${o}`) || '').trim() || null,
        campaign_name: campaigns.find(c => c.campaign_id === fd.get(`camp_${o}`))?.campaign_name || null })).filter(a => a.campaign_id || a.list_id);
      const r = await sb.from('outreach_settings').update({ prosp, plusvibe_workspace_id: String(fd.get('pv_ws') || '').trim() || null, plusvibe_campaign_id: String(fd.get('pv_camp') || '').trim() || null,
        test_split: Math.min(1, Math.max(0, Number(fd.get('split')) || 0)), li_template_dated: String(fd.get('tpl_dated') || '') || null, li_template_plain: String(fd.get('tpl_plain') || '') || null,
        bdc_per_day: Number(fd.get('bdc_n')) || 0, credit_per_day: Number(fd.get('cr_n')) || 0, min_email_score: Number(fd.get('min_score')) || 90, email_delay_days: Math.max(0, Number(fd.get('delay')) || 0), updated_at: new Date().toISOString() }).eq('id', 1);
      if (r.error) { toast(r.error.message); return false; }
      toast('Outreach settings saved');
    },
  });
  variantResults($('#obResults'));
}

// Does the date earn replies? Reply rate per variant (LinkedIn sends only). Needs ~100+ sends per variant to mean anything.
async function variantResults(el) {
  if (!el) return;
  const r = await sb.from('outreach_enrollments').select('variant,status,prosp_status').eq('prosp_status', 'added');
  const g = {}; for (const e of r.data || []) { const v = e.variant || 'dated'; (g[v] ||= { n: 0, rep: 0 }); g[v].n++; if (e.status === 'replied') g[v].rep++; }
  const rows = ['dated', 'plain'].filter(v => g[v]).map(v => `<span><b>${v === 'dated' ? '▲ Dated' : '○ Plain'}</b> ${g[v].rep}/${g[v].n} replied (${g[v].n ? Math.round(g[v].rep / g[v].n * 100) : 0}%)</span>`);
  const small = Math.min(g.dated?.n || 0, g.plain?.n || 0) < 100;
  el.innerHTML = `<span class="s"><b>Test so far:</b> ${rows.join(' · ') || 'no LinkedIn sends yet'}${rows.length ? (small ? ' · too few to call (needs ~100 per side)' : '') : ''}</span>`;
}
