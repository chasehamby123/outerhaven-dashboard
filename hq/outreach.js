// Omnichannel outreach from HQ (10 Oct 2026): "Send today's batch" picks the day's BDC + credit targets that have a contact,
// a person ticks them, and the outreach edge function enrols each in Prosp (LinkedIn) and PlusVibe (email).
// Copy lives in the Prosp / PlusVibe campaigns; HQ sends {{first_name}}, {{company}}, {{opener}}, {{need}}.
import { sb, esc, $, $$, toast, modal, opts } from './core.js';
import { loadContacts, bestPerson } from './contacts.js';
import { needLine } from './kinds.js';
import { opener as bdcOpener } from './bdc.js';
import { opener as creditOpener } from './credit.js';

const OWNERS = ['Peter', 'Chase', 'Tengku'];
const monthsTo = d => d ? (Date.parse(d) - Date.now()) / (30.4 * 864e5) : null;

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
    .filter(x => x.p).sort((x, y) => (monthsTo(x.s.earliest_maturity) ?? 99) - (monthsTo(y.s.earliest_maturity) ?? 99) || y.s.score - x.s.score);
  const c = (cr.data || []).filter(s => !done.has(`credit:${String(Number(s.cik))}`) && s.ebitda > 0 && s.revenue >= 20e6 && !(s.flags || {}).going_concern)
    .map(s => ({ kind: 'credit', key: String(Number(s.cik)), s, p: usable('credit', String(Number(s.cik))) })).filter(x => x.p).sort((x, y) => y.s.score - x.s.score);
  const waiting = { bdc: (bdc.data || []).length, credit: (cr.data || []).length };
  return { list: [...b.slice(0, st.bdc_per_day ?? 10), ...c.slice(0, st.credit_per_day ?? 10)], waiting, ready: { bdc: b.length, credit: c.length } };
}

export async function sendBatchModal(onDone) {
  const st = await settings();
  const { data: keys } = await sb.rpc('contact_keys_set');
  const { list, ready } = await picks(st);
  const accounts = (st.prosp || []).filter(a => a.campaign_id && a.list_id);
  const owners = accounts.length ? accounts.map(a => a.owner) : OWNERS;
  const warn = [!keys?.prosp && 'No Prosp key: LinkedIn will be skipped.', keys?.prosp && !accounts.length && 'No Prosp campaign set: LinkedIn will be skipped.',
    !keys?.plusvibe && 'No PlusVibe key: email will be skipped.', keys?.plusvibe && !(st.plusvibe_workspace_id && st.plusvibe_campaign_id) && 'No PlusVibe campaign set: email will be skipped.'].filter(Boolean);
  modal({
    title: "Send today's batch", submit: list.length ? `Send ${list.length}` : 'Close', wide: true,
    body: `<div class="obWrap">
      <p class="s muted" style="margin:0 0 10px">${list.filter(x => x.kind === 'bdc').length} BDC (maturing soonest) + ${list.filter(x => x.kind === 'credit').length} public credit (lendable). Ready with a contact: ${ready.bdc} BDC, ${ready.credit} credit. Untick anyone who looks wrong.</p>
      ${warn.length ? `<div class="obWarn">⚠ ${warn.map(esc).join('<br>⚠ ')} <button type="button" class="link" id="obSetup">Outreach setup</button></div>` : ''}
      ${list.length ? `<table class="tbl obTbl"><thead><tr><th></th><th>Company</th><th>Contact</th><th>LinkedIn</th><th>Email</th><th>From</th></tr></thead><tbody>
      ${list.map((x, i) => `<tr><td><input type="checkbox" name="pick" value="${i}" checked aria-label="Send to ${esc(x.s.company_name)}"></td>
        <td><b>${esc(x.s.company_name)}</b><br><span class="s muted">${x.kind === 'bdc' ? 'BDC' : 'Public'} · ${esc(needLine(x.s.reasons) || '')}</span></td>
        <td>${esc(x.p.name)}<br><span class="s muted">${esc(x.p.title || x.p.role?.toUpperCase() || '')}${x.p.source === 'sec' ? ' · SEC' : x.p.status === 'confirmed' ? ' · confirmed' : ' · unconfirmed'}</span></td>
        <td>${x.p.linkedin ? `<a href="${esc(x.p.linkedin)}" target="_blank" rel="noopener">✓ ↗</a>` : '—'}</td>
        <td>${emailOk(x.p, st.min_email_score) ? '✓' : x.p.email ? '<span class="s muted">low score</span>' : '—'}</td>
        <td><select class="select sm" name="owner${i}">${opts(owners, owners[i % owners.length])}</select></td></tr>`).join('')}
      </tbody></table>` : '<div class="empty">No targets with a contact yet. Contacts fill in as the lookup runs (about 120 companies a day), or click "Find contacts" on a card.</div>'}</div>`,
    async onSubmit(fd) {
      if (!list.length) return;
      const idx = fd.getAll('pick').map(Number);
      const items = idx.map(i => { const x = list[i]; return { kind: x.kind, key: x.key, owner: fd.get(`owner${i}`), need: needLine(x.s.reasons),
        opener: x.kind === 'bdc' ? bdcOpener(x.s, x.p.name) : creditOpener(x.s, x.p.name) }; });
      if (!items.length) return;
      const { data, error } = await sb.functions.invoke('outreach', { body: { action: 'send', items } });
      if (error || data?.ok === false) { toast(data?.error || error?.message || 'Send failed'); return false; }
      const res = data.results || [], sent = res.filter(r => r.status === 'sent').length;
      const li = res.filter(r => r.prosp_status === 'added').length, em = res.filter(r => r.plusvibe_status === 'added').length;
      toast(`Sent ${sent} of ${items.length}: ${li} on LinkedIn, ${em} by email`);
      onDone?.();
    },
  });
  $('#obSetup')?.addEventListener('click', () => { document.querySelector('.modal .x, .modal [data-close]')?.click(); outreachSetup(); });
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
      <p class="s muted" style="grid-column:1/-1;margin:0">Write the message sequences inside Prosp (LinkedIn) and PlusVibe (email). Use the fields HQ sends: <code>{{first_name}}</code>, <code>{{company}}</code>, <code>{{opener}}</code> (Peter's opener, written per company) and <code>{{need}}</code> (e.g. "Matures Nov 2026"). Keys are write-only.</p>
      <label class="field">Prosp API key ${keys?.prosp ? '<em class="ctOk">✓ saved</em>' : ''}<input class="input" name="prosp_key" type="password" autocomplete="off" placeholder="${keys?.prosp ? 'Saved. Paste to replace' : 'Paste key'}"></label>
      <label class="field">PlusVibe API key ${keys?.plusvibe ? '<em class="ctOk">✓ saved</em>' : ''}<input class="input" name="pv_key" type="password" autocomplete="off" placeholder="${keys?.plusvibe ? 'Saved. Paste to replace' : 'Paste key (Business plan)'}"></label>
      <h4 class="obH">LinkedIn: one Prosp campaign per account${keys?.prosp ? '' : ' (save the Prosp key first to pick campaigns)'}</h4>
      ${OWNERS.map(o => `<div class="obRow"><b>${o}</b>
        ${campaigns.length ? `<select class="select" name="camp_${o}">${campOpts(acct(o).campaign_id)}</select>` : `<input class="input" name="camp_${o}" placeholder="Campaign ID" value="${esc(acct(o).campaign_id || '')}">`}
        <input class="input" name="list_${o}" placeholder="Prosp list ID" value="${esc(acct(o).list_id || '')}"></div>`).join('')}
      <h4 class="obH">Email: PlusVibe</h4>
      <label class="field">Workspace ID<input class="input" name="pv_ws" value="${esc(st.plusvibe_workspace_id || '')}"></label>
      <label class="field">Campaign ID<input class="input" name="pv_camp" value="${esc(st.plusvibe_campaign_id || '')}"></label>
      <label class="field" style="grid-column:1/-1">Reply webhook for PlusVibe (Settings → Webhooks → event "Email Replies")<input class="input" readonly value="${esc(hook || '')}" onclick="this.select()"></label>
      <h4 class="obH">Daily batch</h4>
      <label class="field">BDC per day<input class="input" name="bdc_n" type="number" min="0" max="40" value="${st.bdc_per_day ?? 10}"></label>
      <label class="field">Credit per day<input class="input" name="cr_n" type="number" min="0" max="40" value="${st.credit_per_day ?? 10}"></label>
      <label class="field">Min Hunter email score<input class="input" name="min_score" type="number" min="50" max="100" value="${st.min_email_score ?? 90}"></label></div>`,
    async onSubmit(fd) {
      for (const [f, name] of [['prosp_key', 'PROSP_API_KEY'], ['pv_key', 'PLUSVIBE_API_KEY']]) {
        const v = String(fd.get(f) || '').trim();
        if (v) { const r = await sb.rpc('set_contact_key', { p_name: name, p_value: v }); if (r.error) { toast(r.error.message); return false; } }
      }
      const prosp = OWNERS.map(o => ({ owner: o, campaign_id: String(fd.get(`camp_${o}`) || '').trim() || null, list_id: String(fd.get(`list_${o}`) || '').trim() || null,
        campaign_name: campaigns.find(c => c.campaign_id === fd.get(`camp_${o}`))?.campaign_name || null })).filter(a => a.campaign_id || a.list_id);
      const r = await sb.from('outreach_settings').update({ prosp, plusvibe_workspace_id: String(fd.get('pv_ws') || '').trim() || null, plusvibe_campaign_id: String(fd.get('pv_camp') || '').trim() || null,
        bdc_per_day: Number(fd.get('bdc_n')) || 0, credit_per_day: Number(fd.get('cr_n')) || 0, min_email_score: Number(fd.get('min_score')) || 90, updated_at: new Date().toISOString() }).eq('id', 1);
      if (r.error) { toast(r.error.message); return false; }
      toast('Outreach settings saved');
    },
  });
}
