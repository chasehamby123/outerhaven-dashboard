const $ = id => document.getElementById(id);
const send = msg => new Promise(r => chrome.runtime.sendMessage(msg, r));
const opts = (list, sel, ph) => `<option value="">${ph}</option>` + list.map(v => `<option ${v === sel ? 'selected' : ''}>${v}</option>`).join('');
(async () => {
  const s = await send({ type: 'setup' });
  if (!s?.ok) { $('err').textContent = s?.error || 'Could not reach HQ'; return; }
  $('who').innerHTML = opts(s.team, s.prefs.who, 'Pick your name…');
  $('acct').innerHTML = opts(s.accounts, s.prefs.account, 'Pick the account…');
  const save = async () => { await send({ type: 'prefs', prefs: { who: $('who').value, account: $('acct').value } }); $('ok').textContent = $('who').value && $('acct').value ? `Saved. Chats saved here count as ${$('who').value} on ${$('acct').value}'s account.` : ''; };
  $('who').onchange = save; $('acct').onchange = save; save();
})();
