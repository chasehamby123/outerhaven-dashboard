// HQ entry: auth gate, routing, sidebar.
import { $, $$, esc, state, authenticate, signIn, signOut } from './core.js';
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

function shell() {
  $('#app').innerHTML = `<div class="app">
    <aside class="side">
      <div class="brand"><b>O</b><span>Outerhaven</span></div>
      <nav class="nav">${state.role === 'ops' ? '<a href="#/today" data-page="today">Today</a>' : `
        <a href="#/overview" data-page="overview">Overview</a>
        <a href="#/today" data-page="today">Today</a>
        <a href="#/growth/posts" data-page="growth">Growth</a>
        <small>Legacy</small>
        <a href="/shared.html">Pipeline <em>↗</em></a>`}
      </nav>
      <div class="sideFoot"><span>${esc(state.user?.email || '')}</span><button class="link s" id="signOut">Sign out</button></div>
    </aside>
    <main class="main" id="view"></main></div>`;
  $('#signOut').onclick = signOut;
}

function authScreen(msg = '') {
  $('#app').innerHTML = `<div class="auth"><div class="card"><div class="brand" style="padding:0"><b>O</b><span>Outerhaven</span></div>
    <h1>Sign in</h1><p>Team members only.</p>
    <form id="authForm"><label class="field">Email<input class="input" id="aEmail" type="email" autocomplete="email" required></label>
    <label class="field">Password<input class="input" id="aPass" type="password" autocomplete="current-password" required></label>
    <div class="msg" id="aMsg">${esc(msg)}</div><button class="btn primary" type="submit">Sign in</button></form></div></div>`;
  $('#authForm').onsubmit = async e => {
    e.preventDefault(); const b = e.submitter; b.disabled = true;
    const err = await signIn($('#aEmail').value, $('#aPass').value);
    if (err) { $('#aMsg').textContent = err; b.disabled = false; return; }
    start();
  };
}

async function start() {
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
