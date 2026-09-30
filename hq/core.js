// Outerhaven HQ core: Supabase client, auth, routing, small UI helpers.
const SUPABASE_URL = 'https://nfcysxqdwpdhrdpgxrlo.supabase.co';
const SUPABASE_KEY = 'sb_publishable_nBRZvesX4tz7zUPq5QLYfQ__in76dF5';
export const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export const esc = v => String(v ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m]));
export const num = v => { const n = Number(String(v ?? '').replace(/[, ]/g, '')); return Number.isFinite(n) ? n : 0; };
export const fmt = n => n == null || Number.isNaN(n) ? '—' : Math.round(n).toLocaleString('en-US');
export const pct = (a, b, d = 1) => b ? (a / b * 100).toFixed(d) + '%' : '—';
export const fmtDate = v => v ? new Date(String(v).length === 10 ? v + 'T12:00:00' : v).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—';
export const today = () => new Date().toISOString().slice(0, 10);
export const median = a => { const s = a.filter(x => Number.isFinite(x)).sort((x, y) => x - y); if (!s.length) return null; const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
export const sum = a => a.reduce((n, x) => n + (Number(x) || 0), 0);

export const state = { user: null, role: null };

// ---- Account identity: one colour per account, used everywhere the account appears ----
// Known accounts get fixed colours (tokens --c1…--c9 in app.css); anyone new hashes into --c10…--c12.
const AC = { peter: 1, chase: 2, tengku: 3, anaz: 4, razeen: 5, sara: 6, dev: 7, sahid: 8, reza: 9 };
export const firstName = n => String(n || '').trim().split(/\s+/)[0];
export function acIdx(name) {
  const k = firstName(name).toLowerCase(); if (!k) return 12;
  if (AC[k]) return AC[k];
  let h = 0; for (const c of k) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return 10 + (h % 3);
}
export const avatar = (name, size = '') => `<span class="av ${size}" data-ac="${acIdx(name)}" title="${esc(name)}">${esc((firstName(name)[0] || '?').toUpperCase())}</span>`;
export const acctChip = name => name ? `<span class="tag acct" data-ac="${acIdx(name)}">${esc(firstName(name))}</span>` : '';
export const acctName = name => name ? `<span class="acct" data-ac="${acIdx(name)}">${avatar(name, 'xs')}${esc(name)}</span>` : '';

// ---- UI helpers ----
export function toast(msg) {
  document.querySelectorAll('.toast').forEach(x => x.remove());
  const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg;
  document.body.appendChild(t); setTimeout(() => t.remove(), 2600);
}

export function fail(res, what = 'Save') {
  if (res?.error) { console.error(what, res.error); toast(`${what} failed: ${res.error.message}`); return true; }
  return false;
}

// Opens a modal containing a <form>. onSubmit(FormData, formEl) may return false to keep it open.
export function modal({ title, body, submit = 'Save', onSubmit, wide = false }) {
  const scrim = document.createElement('div'); scrim.className = 'scrim';
  const m = document.createElement('form'); m.className = 'modal'; if (wide) m.style.width = 'min(860px,calc(100vw - 32px))';
  m.innerHTML = `<header><h3>${esc(title)}</h3><button type="button" class="btn ghost sm" data-x aria-label="Close">✕</button></header><div class="body">${body}</div><footer><button type="button" class="btn" data-x>Cancel</button>${submit ? `<button class="btn primary" type="submit">${esc(submit)}</button>` : ''}</footer>`;
  const close = () => { scrim.remove(); m.remove(); document.removeEventListener('keydown', onKey); window.dispatchEvent(new Event('hq:modalclosed')); };
  const onKey = e => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  scrim.onclick = close; $$('[data-x]', m).forEach(b => b.onclick = close);
  m.onsubmit = async e => {
    e.preventDefault(); const btn = $('[type=submit]', m); if (btn) btn.disabled = true;
    try { if ((await onSubmit?.(new FormData(m), m)) !== false) close(); } finally { if (btn) btn.disabled = false; }
  };
  document.body.append(scrim, m); $('input,select,textarea', m)?.focus();
  return { el: m, close };
}

export function lightbox(src) {
  const d = document.createElement('div'); d.className = 'lightbox'; d.innerHTML = `<img src="${esc(src)}" alt="">`;
  d.onclick = () => d.remove(); document.body.appendChild(d);
}

export const opts = (list, sel) => list.map(v => { const [val, label] = Array.isArray(v) ? v : [v, v]; return `<option value="${esc(val)}" ${String(val) === String(sel ?? '') ? 'selected' : ''}>${esc(label)}</option>`; }).join('');

// ---- Auth ----
async function allowed(email) { const { data, error } = await sb.rpc('is_dashboard_email_allowed', { input_email: email }); return !error && data === true; }

export async function authenticate() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return { ok: false, msg: '' };
  if (!(await allowed(session.user.email))) { await sb.auth.signOut(); return { ok: false, msg: 'This email is not approved for the dashboard.' }; }
  const { data: role, error } = await sb.rpc('dashboard_role');
  if (error) return { ok: false, msg: 'Could not load your role.' };
  if (role === 'originator') { await sb.auth.signOut(); return { ok: false, msg: `${session.user.email} is set up as a partner (originator) account, not a team account. Its role needs changing to admin or ops in Supabase.` }; }
  if (!['admin', 'ops'].includes(role)) { await sb.auth.signOut(); return { ok: false, msg: 'This account does not have a dashboard role.' }; }
  state.user = session.user; state.role = role;
  return { ok: true };
}

export async function signIn(email, password) {
  email = email.trim().toLowerCase();
  if (!(await allowed(email))) return 'This email is not on the approved access list.';
  const { error } = await sb.auth.signInWithPassword({ email, password });
  return error ? error.message : null;
}

export const signOut = async () => { await sb.auth.signOut(); location.reload(); };
