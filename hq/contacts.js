// Contact line on Credit / BDC / UCC signal cards (10 Oct 2026): who to contact and how.
// Data: signal_contacts (one row per kind + key), filled by scripts/officers.py (SEC names for public companies) and the
// signal-contacts edge function (LinkedIn + website via Brave Search, email via Hunter). See supabase/functions/signal-contacts.
import { sb, esc, $$, toast, modal, state } from './core.js';

const cache = { credit: null, bdc: null, ucc: null }, loading = {};
const FN = 'signal-contacts';

export function loadContacts(kind, fresh = false) {
  if (cache[kind] && !fresh) return Promise.resolve(cache[kind]);
  return loading[kind] ||= (async () => {
    const out = new Map();
    for (let from = 0; ; from += 1000) {
      const r = await sb.from('signal_contacts').select('*').eq('kind', kind).range(from, from + 999);
      if (r.error) break;
      (r.data || []).forEach(x => out.set(x.key, x));
      if ((r.data || []).length < 1000) break;
    }
    cache[kind] = out; loading[kind] = null; return out;
  })();
}
const get = (kind, key) => cache[kind]?.get(String(key)) || null;
const live = c => (c?.people || []).filter(p => p.status !== 'wrong');
export const bestPerson = (kind, key) => live(get(kind, key))[0] || null;

const ROLE = { cfo: 'CFO', ceo: 'CEO', other: 'Exec' };
function personHtml(kind, key, p, c) {
  const enc = encodeURIComponent(p.name);
  const src = p.source === 'sec' ? `<a class="ctSrc" href="${esc(p.source_url || '#')}" target="_blank" rel="noopener" title="Signed the ${esc(p.form || '10-K/10-Q')} certification filed ${esc(p.filed || '')}">SEC</a>` : '';
  const email = p.email
    ? `<button type="button" class="ctLink" data-ctcopy="${esc(p.email)}" title="Copy · Hunter score ${p.email_score ?? '?'}${p.email_status ? ' · ' + esc(p.email_status) : ''}">${esc(p.email)}</button>`
    : c?.domain ? `<button type="button" class="ctLink muted" data-ctemail="${enc}">Find email</button>` : '';
  const check = p.status === 'confirmed' ? '<span class="ctOk" title="Confirmed by the team">✓ confirmed</span>'
    : p.source === 'sec' ? '' : `<button type="button" class="ctLink muted" data-ctmark="${enc}" data-st="confirmed" title="This is the right person">✓ Right</button><button type="button" class="ctLink muted" data-ctmark="${enc}" data-st="wrong" title="Wrong person or left the company">✕ Wrong</button>`;
  return `<div class="ctPerson"><span class="ctRole">${ROLE[p.role] || 'Exec'}</span><b>${esc(p.name)}</b>${src}
    ${p.linkedin ? `<a class="ctLink" href="${esc(p.linkedin)}" target="_blank" rel="noopener">LinkedIn ↗</a>` : ''}${email}${check}</div>`;
}

// The contact block for one card. key: credit = cik, bdc / ucc = company_key.
export function contactHtml(kind, key, s) {
  if (!cache[kind]) return `<div class="ct" data-ctkey="${esc(key)}"><span class="ctNone">Loading contacts…</span></div>`;
  const c = get(kind, key), people = live(c).slice(0, 2);
  const extra = [c?.phone ? `<a class="ctLink" href="tel:${esc(c.phone)}">${esc(c.phone)}</a>` : '', c?.website ? `<a class="ctLink" href="${esc(c.website)}" target="_blank" rel="noopener">${esc(c.domain || 'Website')} ↗</a>` : ''].filter(Boolean).join('');
  const change = c?.officer_change ? `<a class="ctWarn" href="${esc(c.officer_change.url)}" target="_blank" rel="noopener">⚠ Officer change filed ${esc(c.officer_change.date)}: check the name</a>` : '';
  const action = people.length && c?.looked_up_at ? '' : `<button type="button" class="ctLink muted" data-ctlookup="${esc(key)}">${c?.looked_up_at ? 'Search again' : people.length ? 'Find LinkedIn' : 'Find contacts'}</button>`;
  const none = !people.length ? `<span class="ctNone">${esc(c?.lookup_note || (c?.looked_up_at ? 'No CFO / CEO found.' : 'No contact yet.'))}</span>` : '';
  return `<div class="ct" data-ctkey="${esc(key)}">${people.map(p => personHtml(kind, key, p, c)).join('')}${none || extra || action || change ? `<div class="ctMeta">${none}${extra}${action}${change}</div>` : ''}</div>`;
}

async function call(body) {
  const { data, error } = await sb.functions.invoke(FN, { body });
  if (error || data?.ok === false) throw new Error(data?.error || error?.message || 'Failed');
  return data;
}
async function refresh(kind, key) {
  const r = await sb.from('signal_contacts').select('*').eq('kind', kind).eq('key', String(key)).maybeSingle();
  if (r.data) { cache[kind] ||= new Map(); cache[kind].set(String(key), r.data); }
}

export function bindContacts(root, kind, redraw) {
  const keyOf = b => b.closest('[data-ctkey]')?.dataset.ctkey;
  $$('[data-ctcopy]', root).forEach(b => b.onclick = async () => { try { await navigator.clipboard.writeText(b.dataset.ctcopy); toast('Email copied'); } catch { toast(b.dataset.ctcopy); } });
  $$('[data-ctlookup]', root).forEach(b => b.onclick = async () => {
    const key = keyOf(b); b.disabled = true; b.textContent = 'Searching…';
    try { const r = await call({ action: 'lookup', kind, key }); await refresh(kind, key); toast(r.note === 'no key' ? 'Add the Brave Search key first (Contacts setup)' : r.found ? `Found ${r.found}` : 'Nothing found'); }
    catch (e) { toast(e.message); }
    redraw();
  });
  $$('[data-ctemail]', root).forEach(b => b.onclick = async () => {
    const key = keyOf(b), name = decodeURIComponent(b.dataset.ctemail); b.disabled = true; b.textContent = 'Finding…';
    try { const r = await call({ action: 'email', kind, key, name }); await refresh(kind, key); toast(r.email ? `${r.email} (score ${r.score ?? '?'})` : 'No email found'); }
    catch (e) { toast(e.message); }
    redraw();
  });
  $$('[data-ctmark]', root).forEach(b => b.onclick = async () => {
    const key = keyOf(b);
    try { await call({ action: 'mark', kind, key, name: decodeURIComponent(b.dataset.ctmark), status: b.dataset.st }); await refresh(kind, key); }
    catch (e) { toast(e.message); }
    redraw();
  });
}

// Admin: paste the Brave Search and Hunter keys (write-only; nobody can read them back from HQ).
export async function contactsSetup() {
  const { data: set } = await sb.rpc('contact_keys_set');
  modal({
    title: 'Contacts setup', submit: 'Save',
    body: `<div class="form pForm">
      <p class="s muted" style="grid-column:1/-1;margin:0">Public companies get their CFO and CEO from SEC filings automatically (free). For LinkedIn profiles, websites and private companies, add a <a href="https://api-dashboard.search.brave.com/" target="_blank" rel="noopener">Brave Search API</a> key. For work emails, add a <a href="https://hunter.io/api-keys" target="_blank" rel="noopener">Hunter</a> key. Keys are stored write-only.</p>
      <label class="field">Brave Search key ${set?.brave ? '<em class="ctOk">✓ saved</em>' : ''}<input class="input" name="brave" type="password" autocomplete="off" placeholder="${set?.brave ? 'Saved. Paste to replace' : 'Paste key'}"></label>
      <label class="field">Hunter key ${set?.hunter ? '<em class="ctOk">✓ saved</em>' : ''}<input class="input" name="hunter" type="password" autocomplete="off" placeholder="${set?.hunter ? 'Saved. Paste to replace' : 'Paste key'}"></label>
      <p class="s muted" style="grid-column:1/-1;margin:0">With the Brave key saved, HQ looks up ~120 targets a day on its own (best BDC targets first). "Find email" uses one Hunter credit per person, only when you click it.</p></div>`,
    async onSubmit(fd) {
      for (const [field, name] of [['brave', 'BRAVE_SEARCH_KEY'], ['hunter', 'HUNTER_API_KEY']]) {
        const v = String(fd.get(field) || '').trim();
        if (v) { const r = await sb.rpc('set_contact_key', { p_name: name, p_value: v }); if (r.error) { toast(r.error.message); return false; } }
      }
      toast('Saved');
    },
  });
}
export const isAdmin = () => state.role === 'admin';
