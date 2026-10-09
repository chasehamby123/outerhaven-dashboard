// Growth → Reply assist (admin): set-up for the extension's "Draft a reply" button.
// 1) Claude API key (write-only: pasted here, never shown again)  2) a persona per account (the only facts a draft may claim)
// 3) usage and the latest drafts. The draft is always read and sent by a person; nothing is typed or sent on LinkedIn.
import { sb, esc, $, $$, toast, fail, fmtDate, firstName } from './core.js';
import { store } from './data.js';

const FIELDS = [
  ['who_they_are', 'Who they are', 'Real background in 2–4 sentences: role, years, what they have actually done, firm. Drafts may claim ONLY what is written here.', 4],
  ['audience', 'Who usually writes in', 'e.g. founders raising $5–50M, family office principals, independent sponsors, bankers.', 2],
  ['voice', 'Voice', 'Tone, length, how they open and close. e.g. "Direct, warm, short. First name. No exclamation marks."', 2],
  ['rules', 'Never say / always do', 'e.g. "Never quote fees. Never promise introductions. Always ask what stage they are at."', 3],
  ['offer', 'What we offer and the next step', 'e.g. "Send the free list, then offer a 20-minute call if they are raising in the next 6 months."', 3],
  ['booking_link', 'Booking link', 'https://…', 1],
];
let sel = '';
const filled = p => FIELDS.slice(0, 5).filter(([k]) => String(p?.[k] || '').trim()).length;

export async function replyView(body) {
  body.innerHTML = '<div class="empty">Loading…</div>';
  const [key, per, use, dr] = await Promise.all([
    sb.rpc('anthropic_key_set'), sb.from('reply_personas').select('*'), sb.rpc('reply_usage'),
    sb.from('reply_drafts').select('created_at,account_name,requested_by,prospect_name,intent,needs_human,flags,draft,persona_missing').order('created_at', { ascending: false }).limit(15),
  ]);
  if (!body.isConnected) return;
  if (per.error) { body.innerHTML = `<section class="card"><div class="body s muted">Reply assist isn't set up in the database yet: ${esc(per.error.message)} (run supabase/2026-10-09-reply-record-scores.sql).</div></section>`; return; }
  const keySet = key.data === true, personas = per.data || [], names = [...new Set(store.accounts.map(a => a.owner_name).filter(Boolean))];
  if (!sel || !names.includes(sel)) sel = names[0] || '';
  const cur = personas.find(p => p.account_name === sel) || {};

  body.innerHTML = `
  <section class="card"><header><div><h2>Claude API key</h2><p>${keySet ? 'A key is saved. Drafting is on.' : 'Not set. The extension\'s Draft button says "isn\'t switched on yet" until you paste one.'}</p></div><span class="tag ${keySet ? 'good' : 'warn'}">${keySet ? 'On' : 'Off'}</span></header>
    <div class="body"><form id="rpKey" class="row" style="gap:10px;flex-wrap:wrap"><input class="input" id="rpKeyIn" type="password" autocomplete="off" placeholder="${keySet ? 'Paste a new key to replace it' : 'Paste the Claude API key'}" style="flex:1;min-width:240px"><button class="btn primary" type="submit">${keySet ? 'Replace key' : 'Save key'}</button></form>
    <p class="s muted" style="margin:10px 0 0">Write-only: it is stored server-side and never shown again. About $0.01 per draft. When someone clicks Draft, the open conversation, the person's name and headline are sent to the Claude API; nothing is sent before that. Drafts are logged below.</p></div></section>

  <section class="card"><header><div><h2>Personas</h2><p>The draft sounds like this person and claims only what is written here. Without a persona it writes neutrally and flags it.</p></div></header>
    <div class="body"><div class="rpChips">${names.map(n => { const p = personas.find(x => x.account_name === n), f = filled(p); return `<button type="button" class="rpChip ${n === sel ? 'on' : ''}" data-n="${esc(n)}">${esc(firstName(n))}<small class="${f >= 4 ? 'up' : f ? '' : 'down'}">${f}/5</small></button>`; }).join('')}</div>
    <form id="rpForm" class="rpForm">${FIELDS.map(([k, l, ph, rows]) => `<label class="field">${l}${rows === 1 ? `<input class="input" name="${k}" value="${esc(cur[k] || '')}" placeholder="${esc(ph)}">` : `<textarea class="textarea" name="${k}" rows="${rows}" placeholder="${esc(ph)}">${esc(cur[k] || '')}</textarea>`}</label>`).join('')}
    <div class="row" style="gap:10px"><button class="btn primary" type="submit">Save ${esc(firstName(sel))}'s persona</button><span class="s muted">${cur.updated_at ? 'Saved ' + fmtDate(cur.updated_at) : 'Not written yet'}</span></div></form></div></section>

  <div class="pbTwo"><section class="card"><header><div><h2>Usage</h2><p>Drafts per person, Malaysia day.</p></div></header><div class="body flush">${use.data?.length ? `<table class="tbl"><thead><tr><th>Person</th><th class="n">Today</th><th class="n">7 days</th></tr></thead><tbody>${use.data.map(u => `<tr><td>${esc(u.requested_by)}</td><td class="n">${u.drafts_today}</td><td class="n">${u.drafts_7d}</td></tr>`).join('')}</tbody></table>` : '<div class="empty">No drafts yet.</div>'}</div></section>
  <section class="card"><header><div><h2>Latest drafts</h2><p>Check that they sound right, then fix the persona.</p></div></header><div class="body flush">${dr.data?.length ? `<ul class="rpDrafts">${dr.data.map(d => `<li><div class="s muted">${fmtDate(d.created_at)} · ${esc(d.account_name)} · ${esc(d.requested_by)} → ${esc(d.prospect_name || 'unknown')} · ${esc(d.intent || '')}${d.needs_human ? ' · <b class="down">needs a human</b>' : ''}${d.persona_missing ? ' · <b class="down">no persona</b>' : ''}</div><div>${esc(String(d.draft || '').slice(0, 260))}</div>${d.flags?.length ? `<div class="s muted">Flags: ${esc(d.flags.join(', '))}</div>` : ''}</li>`).join('')}</ul>` : '<div class="empty">Nothing drafted yet.</div>'}</div></section></div>`;

  $('#rpKey', body).onsubmit = async e => {
    e.preventDefault(); const inp = $('#rpKeyIn', body), v = inp.value.trim(); if (!v) return;
    const r = await sb.rpc('set_anthropic_key', { p_value: v }); inp.value = '';
    if (fail(r, 'Save key')) return; toast('Key saved'); replyView(body);
  };
  $$('.rpChip', body).forEach(b => b.onclick = () => { sel = b.dataset.n; replyView(body); });
  $('#rpForm', body).onsubmit = async e => {
    e.preventDefault(); const fd = new FormData(e.target), row = { account_name: sel, updated_at: new Date().toISOString() };
    FIELDS.forEach(([k]) => { row[k] = String(fd.get(k) || '').trim() || null; });
    const r = await sb.from('reply_personas').upsert(row, { onConflict: 'account_name' });
    if (fail(r, 'Save persona')) return; toast('Persona saved'); replyView(body);
  };
}
