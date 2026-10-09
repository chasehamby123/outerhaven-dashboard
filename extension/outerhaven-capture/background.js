// Talks to HQ. No sign-in: this copy carries the team capture key, baked in when an admin downloaded it from HQ.
// Who you are and which LinkedIn account this browser profile runs are picked once and remembered here.
const SUPABASE_URL = 'https://nfcysxqdwpdhrdpgxrlo.supabase.co';
const KEY = 'sb_publishable_nBRZvesX4tz7zUPq5QLYfQ__in76dF5'; // public key, same one the HQ website uses
const CAPTURE_KEY = '__OHQ_CAPTURE_KEY__'; // replaced with the real key when HQ builds your download

async function call(payload, fn = 'dm-capture') {
  if (CAPTURE_KEY.startsWith('__')) throw new Error('This copy is not connected. Download the extension from HQ → Growth → DM tests (the download button builds a connected copy).');
  let r;
  try { r = await fetch(`${SUPABASE_URL}/functions/v1/${fn}`, { method: 'POST', headers: { apikey: KEY, 'x-capture-key': CAPTURE_KEY, 'content-type': 'application/json' }, body: JSON.stringify(payload) }); }
  catch { throw new Error("Can't reach HQ. Check the internet connection and try again."); }
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.ok) throw new Error(j.error || `HQ returned ${r.status}`);
  return j;
}
async function config() {
  const { cfg } = await chrome.storage.local.get('cfg');
  if (cfg && Date.now() - cfg.at < 6 * 3600e3) return cfg;
  const j = await call({ action: 'config' });
  const fresh = { team: j.team, accounts: j.accounts, at: Date.now() };
  await chrome.storage.local.set({ cfg: fresh }); return fresh;
}

chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  (async () => {
    try {
      if (msg.type === 'setup') { const c = await config(); const { prefs } = await chrome.storage.local.get('prefs'); reply({ ok: true, team: c.team, accounts: c.accounts, prefs: prefs || {} }); }
      else if (msg.type === 'prefs') { await chrome.storage.local.set({ prefs: msg.prefs }); reply({ ok: true }); }
      else if (msg.type === 'capture') reply({ ok: true, result: await call(msg.payload) });
      else if (msg.type === 'reply') reply({ ok: true, result: await call(msg.payload, 'reply-assist') });
      else reply({ ok: false, error: 'unknown message' });
    } catch (e) { reply({ ok: false, error: e.message || String(e) }); }
  })();
  return true; // async reply
});
