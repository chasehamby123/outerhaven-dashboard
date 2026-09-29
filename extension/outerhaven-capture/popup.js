const $ = id => document.getElementById(id);
const send = msg => new Promise(r => chrome.runtime.sendMessage(msg, r));
async function show() {
  const s = await send({ type: 'status' });
  $('login').hidden = !!s?.email; $('in').hidden = !s?.email; $('who').textContent = s?.email || '';
}
$('login').onsubmit = async e => {
  e.preventDefault(); $('err').textContent = ''; const b = e.submitter; b.disabled = true; b.textContent = 'Signing in…';
  const r = await send({ type: 'login', email: $('email').value.trim(), password: $('password').value });
  b.disabled = false; b.textContent = 'Sign in';
  if (!r?.ok) { $('err').textContent = r?.error || 'Sign-in failed'; return; }
  $('password').value = ''; show();
};
$('logout').onclick = async () => { await send({ type: 'logout' }); show(); };
show();
