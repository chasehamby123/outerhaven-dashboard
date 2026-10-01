// Holds the HQ login and talks to Supabase. The LinkedIn page never sees the token.
const SUPABASE_URL = 'https://nfcysxqdwpdhrdpgxrlo.supabase.co';
const KEY = 'sb_publishable_nBRZvesX4tz7zUPq5QLYfQ__in76dF5'; // public key, same one the HQ website uses

async function auth(path, body) {
  const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=${path}`, { method: 'POST', headers: { apikey: KEY, 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(/invalid login/i.test(j.error_description || j.msg || '') ? 'Wrong email or password. It is the same login as HQ; if you forgot it, use "Forgot password?" on the HQ sign-in page.' : (j.error_description || j.msg || j.error || `Sign-in failed (${r.status})`));
  const session = { access_token: j.access_token, refresh_token: j.refresh_token, expires_at: Date.now() + (j.expires_in || 3600) * 1000, email: j.user?.email || '' };
  await chrome.storage.local.set({ session });
  return session;
}
async function token() {
  const { session } = await chrome.storage.local.get('session');
  if (!session) throw new Error('Not signed in. Click the OuterHaven icon in the toolbar and sign in with your HQ account.');
  if (session.expires_at - Date.now() > 60000) return session.access_token;
  return (await auth('refresh_token', { refresh_token: session.refresh_token })).access_token;
}
async function capture(payload) {
  const r = await fetch(`${SUPABASE_URL}/functions/v1/dm-capture`, { method: 'POST', headers: { apikey: KEY, authorization: `Bearer ${await token()}`, 'content-type': 'application/json' }, body: JSON.stringify(payload) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.ok) throw new Error(j.error || `HQ returned ${r.status}`);
  return j;
}

chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  (async () => {
    try {
      if (msg.type === 'login') { const s = await auth('password', { email: msg.email, password: msg.password }); await capture({ action: 'whoami' }); reply({ ok: true, email: s.email }); }
      else if (msg.type === 'logout') { await chrome.storage.local.remove('session'); reply({ ok: true }); }
      else if (msg.type === 'status') { const { session } = await chrome.storage.local.get('session'); reply({ ok: true, email: session?.email || null }); }
      else if (msg.type === 'capture') reply({ ok: true, result: await capture(msg.payload) });
      else reply({ ok: false, error: 'unknown message' });
    } catch (e) {
      if (/failed to fetch|networkerror/i.test(e.message || '')) e = new Error("Can't reach HQ. Check the internet connection and try again.");
      if (msg.type === 'login') await chrome.storage.local.remove('session'); // wrong role / bad password: don't keep it
      reply({ ok: false, error: e.message || String(e) });
    }
  })();
  return true; // async reply
});
