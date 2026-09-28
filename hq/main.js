// HQ entry: auth gate, routing, sidebar.
import { $, $$, esc, state, sb, authenticate, signIn, signOut } from './core.js';
import { store, load, loadSheet, subscribe, onChange } from './data.js';
import { renderOverview } from './overview.js';
import { renderGrowth } from './growth.js';
import { renderToday } from './today.js';

const ROUTES = {
  today: { label: 'Today', render: r => renderToday(r), ops: true },
  overview: { label: 'Overview', render: r => renderOverview(r) },
  growth: { label: 'Growth', render: (r, sub) => renderGrowth(r, sub) },
};

const home = () => state.role === 'ops' ? 'today' : 'overview';
function route() {
  let [, page, sub] = (location.hash || '').split('/');
  if (!ROUTES[page] || (state.role === 'ops' && !ROUTES[page].ops)) page = home();
  return { page, sub };
}

let lastScroll = 0;
function render() {
  const { page, sub } = route(), main = $('#view');
  lastScroll = window.scrollY;
  $$('.nav a[data-page]').forEach(a => a.classList.toggle('on', a.dataset.page === page));
  if (document.querySelector('.modal')) return; // don't yank a form out from under the user
  ROUTES[page].render(main, sub);
  window.scrollTo(0, lastScroll);
}

const ICON = {
  overview: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg>',
  today: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M8 2v4M16 2v4M3 10h18M8.5 15l2 2 4-4"/></svg>',
  growth: '<svg viewBox="0 0 24 24"><path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/></svg>',
  pipeline: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="5" height="16" rx="1.5"/><rect x="10" y="4" width="5" height="10" rx="1.5"/><rect x="17" y="4" width="4" height="6" rx="1.5"/></svg>',
};
const navLink = (page, href, label) => `<a href="${href}" data-page="${page}">${ICON[page]}<span>${label}</span></a>`;

function shell() {
  const email = state.user?.email || '', name = email.split('@')[0].replace(/[._-]+/g, ' ');
  $('#app').innerHTML = `<div class="app">
    <aside class="side">
      <div class="brand"><b>O</b><span>Outerhaven</span><em>HQ</em></div>
      <nav class="nav">${state.role === 'ops' ? navLink('today', '#/today', 'Today') : `
        ${navLink('overview', '#/overview', 'Overview')}
        ${navLink('today', '#/today', 'Today')}
        ${navLink('growth', '#/growth/posts', 'Growth')}
        <small>Legacy</small>
        <a href="/shared.html">${ICON.pipeline}<span>Pipeline</span><em>↗</em></a>`}
      </nav>
      <div class="sideFoot"><div class="av">${esc((name[0] || '?').toUpperCase())}</div><div class="who"><b style="text-transform:capitalize">${esc(name)}</b><button class="link s" id="signOut">Sign out</button></div></div>
    </aside>
    <main class="main" id="view"></main></div>`;
  $('#signOut').onclick = signOut;
}

function authScreen(msg = '') {
  $('#app').innerHTML = `<div class="auth"><div class="card"><div class="brand" style="padding:0"><b>O</b><span>Outerhaven</span></div>
    <h1>Sign in</h1><p>Team members only.</p>
    <form id="authForm"><label class="field">Email<input class="input" id="aEmail" type="email" autocomplete="email" required></label>
    <label class="field">Password<input class="input" id="aPass" type="password" autocomplete="current-password" required></label>
    <div class="msg" id="aMsg">${esc(msg)}</div><button class="btn primary" type="submit">Sign in</button>
    <button type="button" class="link s" id="aForgot" style="justify-self:start">Forgot password?</button></form></div></div>`;
  $('#aForgot').onclick = async () => {
    const email = $('#aEmail').value.trim().toLowerCase(), m = $('#aMsg');
    if (!email) { m.textContent = 'Type your email above first.'; return; }
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + '/hq.html' });
    m.style.color = error ? '' : 'var(--good)';
    m.textContent = error ? error.message : `If ${email} has an account, a reset link is on its way. Check that inbox (and spam).`;
  };
  $('#authForm').onsubmit = async e => {
    e.preventDefault(); const b = e.submitter; b.disabled = true;
    const err = await signIn($('#aEmail').value, $('#aPass').value);
    if (err) { $('#aMsg').textContent = err; b.disabled = false; return; }
    start();
  };
}

// Landing from a password-reset email: let the person choose a new password.
function recoveryScreen() {
  $('#app').innerHTML = `<div class="auth"><div class="card"><div class="brand" style="padding:0"><b>O</b><span>Outerhaven</span></div>
    <h1>Set a new password</h1><p>At least 8 characters.</p>
    <form id="rForm"><label class="field">New password<input class="input" id="rPass" type="password" autocomplete="new-password" minlength="8" required></label>
    <label class="field">Repeat it<input class="input" id="rPass2" type="password" autocomplete="new-password" minlength="8" required></label>
    <div class="msg" id="rMsg"></div><button class="btn primary" type="submit">Save password</button></form></div></div>`;
  $('#rForm').onsubmit = async e => {
    e.preventDefault(); const p = $('#rPass').value, m = $('#rMsg');
    if (p !== $('#rPass2').value) { m.textContent = "Passwords don't match."; return; }
    const { error } = await sb.auth.updateUser({ password: p });
    if (error) { m.textContent = error.message; return; }
    history.replaceState(null, '', '/hq.html'); start();
  };
}

async function start() {
  if (/type=recovery/.test(location.hash) || /type=recovery/.test(location.search)) {
    await sb.auth.getSession(); // lets supabase-js consume the token from the link
    return recoveryScreen();
  }
  const r = await authenticate();
  if (!r.ok) return authScreen(r.msg);
  shell();
  $('#view').innerHTML = '<div class="empty">Loading…</div>';
  onChange(render);
  window.addEventListener('hq:modalclosed', render);
  window.addEventListener('hashchange', () => { window.scrollTo(0, 0); lastScroll = 0; render(); });
  if (state.role === 'ops') { render(); return; }
  await Promise.all([load(), loadSheet()]);
  subscribe();
}

start();
window.__hq = { store }; // handy for debugging in the console
