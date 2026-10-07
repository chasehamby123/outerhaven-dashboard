// HQ entry: auth gate, routing, sidebar.
import { $, $$, esc, state, sb, authenticate, signIn, signOut, avatar } from './core.js';
import { store, load, loadSheet, subscribe, onChange } from './data.js';
import { renderOverview } from './overview.js';
import { renderGrowth } from './growth.js';
import { renderToday, armWhip, refreshBadge } from './today.js';
import { renderResources } from './resources.js';
import { renderSchedule } from './schedule.js';
import { renderPipeline, refreshPipelineBadge } from './pipeline.js';
import { renderDealsPage, refreshDealsBadge } from './deals.js';
import { mountChat } from './chat.js';
import { renderChaseDaily } from './chase-daily.js';
import { renderTeam } from './team.js';

const ROUTES = {
  today: { label: 'Today', render: r => renderToday(r), ops: true },
  overview: { label: 'Overview', render: r => renderOverview(r) },
  growth: { label: 'Growth', render: (r, sub) => renderGrowth(r, sub) },
  schedule: { label: 'Schedule', render: (r, sub) => renderSchedule(r, sub), ops: true },
  pipeline: { label: 'Pipeline', render: (r, sub) => renderPipeline(r, sub) },
  deals: { label: 'Deals', render: r => renderDealsPage(r) },
  resources: { label: 'Resources', render: (r, sub) => renderResources(r, sub), ops: true },
  team: { label: 'Team access', render: r => renderTeam(r) },
  'chase-daily': { label: 'My Daily Ops', render: r => renderChaseDaily(r), chaseOnly: true },
};

const home = () => state.role === 'ops' ? 'today' : 'overview';
function route() {
  let [, page, sub] = (location.hash || '').split('/');
  if (page === 'pipeline' && sub === 'deals') { history.replaceState(null, '', '#/deals'); page = 'deals'; sub = undefined; }
  const chase = String(state.user?.email || '').toLowerCase() === 'chasehamby@chproduction.org';
  if (!ROUTES[page] || (state.role === 'ops' && !ROUTES[page].ops) || (ROUTES[page].chaseOnly && !chase)) page = home();
  return { page, sub };
}

let lastScroll = 0;
function render() {
  const { page, sub } = route(), main = $('#view');
  lastScroll = window.scrollY;
  $$('.nav a[data-page]').forEach(a => a.classList.toggle('on', a.dataset.page === page));
  if (document.querySelector('.modal')) return; // don't yank a form out from under the user
  main.dataset.page = page; // views check this before redrawing from timers/realtime
  ROUTES[page].render(main, sub);
  window.scrollTo(0, lastScroll);
}

const ICON = {
  overview: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg>',
  today: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M8 2v4M16 2v4M3 10h18M8.5 15l2 2 4-4"/></svg>',
  growth: '<svg viewBox="0 0 24 24"><path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/></svg>',
  schedule: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 10h18M8 2v4M16 2v4"/><rect x="7" y="13" width="5" height="4" rx="1"/></svg>',
  resources: '<svg viewBox="0 0 24 24"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/></svg>',
  deals: '<svg viewBox="0 0 24 24"><path d="M4 7h16v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M4 12h16"/></svg>',
  team: '<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><rect x="15" y="11" width="6.5" height="5" rx="1"/><path d="M16.5 11V9.5a1.75 1.75 0 0 1 3.5 0V11"/></svg>',
  pipeline: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="5" height="16" rx="1.5"/><rect x="10" y="4" width="5" height="10" rx="1.5"/><rect x="17" y="4" width="4" height="6" rx="1.5"/></svg>',
};
const THEMES = [['light', 'Light', '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>'], ['dark', 'Dark', '<svg viewBox="0 0 24 24"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>'], ['tan', 'Tan', '<i></i>']];
const getTheme = () => { try { return localStorage.getItem('hq-theme') || 'light'; } catch { return 'light'; } };
function setTheme(t) {
  document.documentElement.dataset.theme = t;
  try { localStorage.setItem('hq-theme', t); } catch { }
  $$('.themeSw button').forEach(b => b.classList.toggle('on', b.dataset.theme === t));
}
const themeSwitch = () => `<div class="themeSw" role="group" aria-label="Theme">${THEMES.map(([k, l, ic]) => `<button type="button" data-theme="${k}" class="${getTheme() === k ? 'on' : ''}" title="${l} mode">${ic}<span>${l}</span></button>`).join('')}</div>`;
const navLink = (page, href, label) => `<a href="${href}" data-page="${page}">${ICON[page]}<span>${label}</span></a>`;

function shell() {
  const email = state.user?.email || '', name = email.split('@')[0].replace(/[._-]+/g, ' ');
  $('#app').innerHTML = `<div class="app">
    <aside class="side">
      <div class="brand"><b>O</b><span>Outerhaven</span><em>HQ</em></div>
      ${themeSwitch()}
      <nav class="nav">${state.role === 'ops' ? navLink('today', '#/today', 'Today') + navLink('schedule', '#/schedule', 'Schedule') + navLink('resources', '#/resources', 'Resources') : `
        ${navLink('overview', '#/overview', 'Overview')}
        ${navLink('today', '#/today', 'Today')}
        ${navLink('schedule', '#/schedule', 'Schedule')}
        ${navLink('pipeline', '#/pipeline', 'Pipeline')}
        ${navLink('deals', '#/deals', 'Deals')}
        ${navLink('growth', '#/growth/posts', 'Growth')}
        ${navLink('resources', '#/resources', 'Resources')}
        ${navLink('team', '#/team', 'Team access')}
        ${String(state.user?.email || '').toLowerCase() === 'chasehamby@chproduction.org' ? navLink('chase-daily', '#/chase-daily', 'My Daily Ops') : ''}
        <small>Legacy</small>
        <a href="/shared.html">${ICON.pipeline}<span>Old pipeline board</span><em>↗</em></a>`}
      </nav>
      <div class="sideFoot">${avatar(name || '?', 'lg')}<div class="who"><b style="text-transform:capitalize">${esc(name)}</b><button class="link s" id="signOut">Sign out</button></div></div>
    </aside>
    <main class="main" id="view"></main></div>`;
  $('#signOut').onclick = signOut;
  $$('.themeSw button').forEach(b => b.onclick = () => setTheme(b.dataset.theme));
  // Clicking Today (even when already there) arms the overdue check; see today.js / whip.js.
  $('.nav a[data-page="today"]')?.addEventListener('click', () => { armWhip(); if (route().page === 'today') render(); });
}

function authScreen(msg = '') {
  $('#app').innerHTML = `<div class="auth"><div class="card"><div class="brand" style="padding:0"><b>O</b><span>Outerhaven</span></div>
    <h1>Sign in</h1><p>Team members only.</p>
    <form id="authForm"><label class="field">Email<input class="input" id="aEmail" type="email" autocomplete="email" required></label>
    <label class="field">Password<input class="input" id="aPass" type="password" autocomplete="current-password" required></label>
    <div class="msg" id="aMsg">${esc(msg)}</div><button class="btn primary" type="submit">Sign in</button>
    <button type="button" class="btn" id="aLink">Email me a sign-in link instead</button>
    <button type="button" class="link s" id="aForgot" style="justify-self:start">Forgot password?</button></form></div></div>`;
  // Passwordless: one-tap link by email. Only emails on the access list get one.
  $('#aLink').onclick = async e => {
    const email = $('#aEmail').value.trim().toLowerCase(), m = $('#aMsg'), b = e.currentTarget;
    m.style.color = '';
    if (!email) { m.textContent = 'Type your email above first.'; $('#aEmail').focus(); return; }
    b.disabled = true;
    const { data: ok } = await sb.rpc('is_dashboard_email_allowed', { input_email: email });
    if (ok !== true) { m.textContent = 'This email is not on the approved access list.'; b.disabled = false; return; }
    const { error } = await sb.auth.signInWithOtp({ email, options: { shouldCreateUser: true, emailRedirectTo: location.origin + '/hq.html' } });
    b.disabled = false;
    m.style.color = error ? '' : 'var(--good)';
    m.textContent = error ? error.message : `Sign-in link sent to ${email}. Open it on this device (check spam too).`;
  };
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
  const linkErr = /error_description=([^&]+)/.exec(location.hash);
  const r = await authenticate();
  if (/access_token=|error_description=/.test(location.hash)) history.replaceState(null, '', '/hq.html');
  if (!r.ok) return authScreen(r.msg || (linkErr ? decodeURIComponent(linkErr[1].replace(/\+/g, ' ')) + '. Ask for a new link.' : ''));
  shell();
  mountChat();
  $('#view').innerHTML = '<div class="empty">Loading…</div>';
  onChange(render);
  window.addEventListener('hq:modalclosed', render);
  window.addEventListener('hashchange', () => { window.scrollTo(0, 0); lastScroll = 0; if (route().page === 'today') armWhip(); render(); });
  if (route().page === 'today') armWhip();
  refreshBadge(); setInterval(refreshBadge, 60000);
  if (state.role === 'ops') { render(); return; }
  refreshPipelineBadge(); setInterval(refreshPipelineBadge, 120000);
  refreshDealsBadge(); setInterval(refreshDealsBadge, 120000);
  await Promise.all([load(), loadSheet()]);
  subscribe();
}

// HQ is a single-page app that people leave open for days: when a new version is deployed, offer a reload.
let builtTag = null;
async function checkUpdate() {
  try {
    const r = await fetch('/hq/main.js', { method: 'HEAD', cache: 'no-store' });
    const tag = r.headers.get('etag') || r.headers.get('last-modified'); if (!tag) return;
    if (builtTag == null) { builtTag = tag; return; }
    if (tag !== builtTag && !document.querySelector('.hqUpdate')) {
      const b = document.createElement('div'); b.className = 'hqUpdate';
      b.innerHTML = '<span>HQ has been updated.</span><button class="btn sm brass">Reload</button>';
      b.querySelector('button').onclick = () => location.reload(); document.body.appendChild(b);
    }
  } catch { }
}
if (!/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) { checkUpdate(); setInterval(checkUpdate, 5 * 60000); document.addEventListener('visibilitychange', () => { if (!document.hidden) checkUpdate(); }); }

start();
window.__hq = { store }; // handy for debugging in the console
