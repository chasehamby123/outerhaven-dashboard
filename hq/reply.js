// Growth → Reply assist (admin): the extension's "Draft a reply" button runs on the same Claude Code routine as the HQ chat button
// (no API key; routines/reply.md). This tab shows each account's persona (the only facts a draft may claim; written by Claude from
// the team page and the account's own posts, editable here), usage and the latest drafts. Nothing is typed or sent on LinkedIn.
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
const PLAY = { hostage_ask: 'Questions before resource', deliver: 'Send resource', qualify: 'Qualify', book: 'Move to a call', nurture: 'Keep warm', close_out: 'Close out', holding: 'Holding (human)' };
const LEAD = { owner_operator: 'Owner / operator', sponsor_or_fund: 'Sponsor / fund', adviser_or_banker: 'Adviser / banker', investor: 'Investor', service_provider: 'Service provider', other: 'Other' };
const filled = p => FIELDS.slice(0, 5).filter(([k]) => String(p?.[k] || '').trim()).length;

export async function replyView(body) {
  body.innerHTML = '<div class="empty">Loading…</div>';
  const [per, use, dr, st] = await Promise.all([
    sb.from('reply_personas').select('*'), sb.rpc('reply_usage'),
    sb.from('reply_drafts').select('created_at,status,error,approach,lead_type,account_name,requested_by,prospect_name,intent,needs_human,flags,draft,persona_missing').order('created_at', { ascending: false }).limit(15),
    sb.from('reply_approach_stats').select('*'),
  ]);
  if (!body.isConnected) return;
  if (per.error) { body.innerHTML = `<section class="card"><div class="body s muted">Reply assist isn't set up in the database yet: ${esc(per.error.message)} (run supabase/2026-10-09-reply-record-scores.sql).</div></section>`; return; }
  const personas = per.data || [], names = [...new Set(store.accounts.map(a => a.owner_name).filter(Boolean))];
  if (!sel || !names.includes(sel)) sel = names[0] || '';
  const cur = personas.find(p => p.account_name === sel) || {};

  body.innerHTML = `
  <section class="card rpHow"><div class="body"><b>How it works.</b> In a LinkedIn chat, press the HQ button, then <b>Draft a reply</b>. Claude reads the chat, finds where the lead came from (the post they commented on and its lead magnet, or the outreach campaign they answered), reads the lead's background, and picks the play: for lead magnets that is <b>our questions first, resource after</b>. The reply comes back in 1–2 minutes; the person edits and sends it. Nothing is sent automatically.</div></section>

  <section class="card"><header><div><h2>What's working</h2><p>Reply rate by play and lead type. "Replied" = the lead wrote back after the draft (seen by a later draft or an inbox sync). Claude switches to the better play once a pair has 20+ results.</p></div></header>
    <div class="body flush scroll">${st.data?.length ? `<table class="tbl"><thead><tr><th>Play</th><th>Lead type</th><th class="n">Drafts</th><th class="n">Replied</th><th class="n">Rate</th></tr></thead><tbody>${st.data.sort((a, b) => b.n - a.n).map(r => `<tr><td>${esc(PLAY[r.approach] || r.approach)}</td><td>${esc(LEAD[r.lead_type] || r.lead_type || '—')}</td><td class="n">${r.n}</td><td class="n">${r.replied}</td><td class="n">${r.n ? `<b>${r.reply_rate}%</b>${r.n < 20 ? ' <span class="s muted">early</span>' : ''}` : '—'}</td></tr>`).join('')}</tbody></table>` : '<div class="empty">No results yet. They appear a day after the first drafts are used.</div>'}</div></section>

  <section class="card"><header><div><h2>Personas</h2><p>Drafts sound like this person and claim only what is written in <i>Who they are</i>. Written by Claude from the team page and each account's posts; fix anything that's wrong.</p></div></header>
    <div class="body"><div class="rpChips">${names.map(n => { const p = personas.find(x => x.account_name === n), f = filled(p); return `<button type="button" class="rpChip ${n === sel ? 'on' : ''}" data-n="${esc(n)}">${esc(firstName(n))}<small class="${f >= 4 ? 'up' : f ? '' : 'down'}">${f}/5</small></button>`; }).join('')}</div>
    <form id="rpForm" class="rpForm">${FIELDS.map(([k, l, ph, rows]) => `<label class="field">${l}${rows === 1 ? `<input class="input" name="${k}" value="${esc(cur[k] || '')}" placeholder="${esc(ph)}">` : `<textarea class="textarea" name="${k}" rows="${rows}" placeholder="${esc(ph)}">${esc(cur[k] || '')}</textarea>`}</label>`).join('')}
    <div class="row" style="gap:10px"><button class="btn primary" type="submit">Save ${esc(firstName(sel))}'s persona</button><span class="s muted">${cur.updated_at ? 'Saved ' + fmtDate(cur.updated_at) : 'Not written yet'}</span></div></form></div></section>

  <div class="pbTwo"><section class="card"><header><div><h2>Usage</h2><p>Drafts per person, Malaysia day.</p></div></header><div class="body flush">${use.data?.length ? `<table class="tbl"><thead><tr><th>Person</th><th class="n">Today</th><th class="n">7 days</th></tr></thead><tbody>${use.data.map(u => `<tr><td>${esc(u.requested_by)}</td><td class="n">${u.drafts_today}</td><td class="n">${u.drafts_7d}</td></tr>`).join('')}</tbody></table>` : '<div class="empty">No drafts yet.</div>'}</div></section>
  <section class="card"><header><div><h2>Latest drafts</h2><p>Check that they sound right, then fix the persona.</p></div></header><div class="body flush">${dr.data?.length ? `<ul class="rpDrafts">${dr.data.map(d => `<li><div class="s muted">${fmtDate(d.created_at)} · ${esc(d.account_name)} · ${esc(d.requested_by)} → ${esc(d.prospect_name || 'unknown')}${d.approach ? ' · ' + esc(PLAY[d.approach] || d.approach) : ''}${d.lead_type ? ' · ' + esc(LEAD[d.lead_type] || d.lead_type) : ''}${d.needs_human ? ' · <b class="down">needs a human</b>' : ''}${d.persona_missing ? ' · <b class="down">no persona</b>' : ''}${d.status === 'working' ? ' · writing…' : ''}</div><div>${d.status === 'error' ? `<span class="down">${esc(d.error || 'Failed')}</span>` : esc(String(d.draft || '').slice(0, 260))}</div>${d.flags?.length ? `<div class="s muted">Flags: ${esc(d.flags.join(', '))}</div>` : ''}</li>`).join('')}</ul>` : '<div class="empty">Nothing drafted yet.</div>'}</div></section></div>`;

  $$('.rpChip', body).forEach(b => b.onclick = () => { sel = b.dataset.n; replyView(body); });
  $('#rpForm', body).onsubmit = async e => {
    e.preventDefault(); const fd = new FormData(e.target), row = { account_name: sel, updated_at: new Date().toISOString() };
    FIELDS.forEach(([k]) => { row[k] = String(fd.get(k) || '').trim() || null; });
    const r = await sb.from('reply_personas').upsert(row, { onConflict: 'account_name' });
    if (fail(r, 'Save persona')) return; toast('Persona saved'); replyView(body);
  };
}
