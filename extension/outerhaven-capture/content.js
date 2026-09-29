// OuterHaven HQ: a small "HQ" button on LinkedIn. Nothing is read until someone clicks "Save conversation".
// It never sends, types or clicks anything on LinkedIn. "Load full history" only scrolls the open chat upwards.
(() => {
  if (window.__ohqLoaded) return; window.__ohqLoaded = true;

  const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  const txt = el => (el?.innerText || el?.textContent || '').replace(/\s+\n/g, '\n').trim();
  const first = s => String(s || '').trim().split(/\s+/)[0].toLowerCase();

  // ---------- reading the page ----------
  function ourName() {
    const img = document.querySelector('img.global-nav__me-photo, .global-nav__me img[alt], button.global-nav__primary-link-me-menu-trigger img[alt]');
    return (img?.getAttribute('alt') || '').replace(/^photo of\s+/i, '').trim();
  }
  // The chat to save: the full-page thread, else the most recently opened chat bubble.
  function activeThread() {
    const page = document.querySelector('.msg-thread, .msg-convo-wrapper, main .msg-s-message-list-container');
    if (page && page.querySelector('.msg-s-message-list, .msg-s-message-list-content')) return { root: page, kind: 'page' };
    const bubbles = [...document.querySelectorAll('.msg-overlay-conversation-bubble')].filter(b => !b.classList.contains('msg-overlay-conversation-bubble--is-minimized') && b.querySelector('.msg-s-message-list, .msg-s-message-list-content'));
    const b = bubbles.find(x => x.contains(document.activeElement)) || bubbles[0];
    return b ? { root: b, kind: 'bubble' } : null;
  }
  function prospect(root) {
    const titleEl = root.querySelector('.msg-entity-lockup__entity-title, .msg-overlay-bubble-header__title, .msg-thread__link-to-profile, h2');
    const link = root.querySelector('a.msg-thread__link-to-profile[href*="/in/"], .msg-overlay-bubble-header a[href*="/in/"], a[href*="linkedin.com/in/"], a[href^="/in/"]');
    const headline = root.querySelector('.msg-entity-lockup__entity-info, .msg-overlay-bubble-header__subtitle');
    let url = link?.getAttribute('href') || '';
    if (url.startsWith('/')) url = 'https://www.linkedin.com' + url;
    return { name: txt(titleEl).split('\n')[0], url: url.split('?')[0], headline: txt(headline).split('\n')[0] };
  }
  function toIso(day, time) {
    if (!time) return null;
    const m = String(time).match(/(\d{1,2}):(\d{2})\s*([AP]M)?/i); if (!m) return null;
    let h = +m[1]; const min = +m[2]; if (m[3]) { h %= 12; if (/p/i.test(m[3])) h += 12; }
    const d = new Date(); d.setSeconds(0, 0);
    const dl = String(day || '').toLowerCase().trim();
    if (!dl || dl === 'today') { /* today */ }
    else if (dl === 'yesterday') d.setDate(d.getDate() - 1);
    else if (WEEKDAYS.includes(dl)) { const back = (d.getDay() - WEEKDAYS.indexOf(dl) + 7) % 7 || 7; d.setDate(d.getDate() - back); }
    else {
      const md = dl.match(/([a-z]{3})[a-z]*\s+(\d{1,2})(?:,?\s*(\d{4}))?/);
      if (!md || MONTHS.indexOf(md[1]) < 0) return null;
      d.setMonth(MONTHS.indexOf(md[1]), +md[2]); if (md[3]) d.setFullYear(+md[3]); else if (d > new Date()) d.setFullYear(d.getFullYear() - 1);
    }
    d.setHours(h, min); return d.toISOString();
  }
  function messages(root, me) {
    const out = []; let day = '', name = '', time = '';
    const events = root.querySelectorAll('li.msg-s-message-list__event, .msg-s-message-list__event');
    for (const li of events) {
      const h = li.querySelector('.msg-s-message-list__time-heading, time.msg-s-message-list__time-heading'); if (h) day = txt(h);
      const n = li.querySelector('.msg-s-message-group__name, .msg-s-message-group__profile-link'); if (n) name = txt(n);
      const t = li.querySelector('.msg-s-message-group__timestamp'); if (t) time = txt(t);
      for (const body of li.querySelectorAll('.msg-s-event-listitem__body')) {
        const ev = body.closest('.msg-s-event-listitem');
        const other = ev ? /msg-s-event-listitem--other/.test(ev.className) : null;
        const fromUs = other === null ? (me && first(name) === first(me)) : !other;
        const text = txt(body); if (!text) continue;
        out.push({ from: fromUs ? 'us' : 'them', name: fromUs ? me : name, at: [day, time].filter(Boolean).join(' '), ts: toIso(day, time), text });
      }
    }
    return out;
  }
  function threadKey(root, who, me) {
    const m = location.pathname.match(/\/messaging\/thread\/([^/]+)/);
    if (m) return 'thread:' + m[1];
    const a = root.querySelector('a[href*="/messaging/thread/"]');
    const m2 = a?.getAttribute('href')?.match(/\/messaging\/thread\/([^/?]+)/);
    if (m2) return 'thread:' + m2[1];
    return who.url ? `profile:${first(me)}:${who.url.replace(/\/$/, '')}` : '';
  }
  async function loadHistory(root, say) {
    const list = root.querySelector('.msg-s-message-list, .msg-s-message-list-content')?.closest('.msg-s-message-list') || root.querySelector('.msg-s-message-list');
    if (!list) return;
    let last = -1, stable = 0;
    for (let i = 0; i < 25 && stable < 2; i++) {
      list.scrollTop = 0; await new Promise(r => setTimeout(r, 900));
      const n = root.querySelectorAll('.msg-s-event-listitem').length;
      say(`Loading older messages… ${n}`); stable = n === last ? stable + 1 : 0; last = n;
    }
    list.scrollTop = list.scrollHeight;
  }
  function read() {
    const t = activeThread(); if (!t) return null;
    const me = ourName(), who = prospect(t.root), msgs = messages(t.root, me);
    const listEl = t.root.querySelector('.msg-s-message-list') || t.root;
    return { root: t.root, payload: { thread_key: threadKey(t.root, who, me), thread_url: location.href.split('?')[0], our_name: me, prospect_name: who.name, prospect_url: who.url, prospect_headline: who.headline, messages: msgs, raw_text: txt(listEl).slice(0, 120000) } };
  }

  // ---------- the HQ button (shadow DOM so LinkedIn's CSS can't touch it) ----------
  const host = document.createElement('div'); host.id = 'ohq-host'; host.style.cssText = 'position:fixed;right:18px;bottom:78px;z-index:2147483000;display:none';
  const sh = host.attachShadow({ mode: 'open' });
  sh.innerHTML = `<style>
    *{box-sizing:border-box;font-family:-apple-system,Segoe UI,Inter,Helvetica,Arial,sans-serif}
    .pill{display:flex;align-items:center;gap:6px;height:34px;padding:0 12px 0 6px;border-radius:17px;background:#111;color:#fff;border:0;font-size:13px;font-weight:600;cursor:pointer;box-shadow:0 4px 16px rgba(0,0,0,.25)}
    .pill i{display:grid;place-items:center;width:22px;height:22px;border-radius:50%;background:#fff;color:#111;font-style:normal;font-family:Georgia,serif;font-size:13px}
    .card{position:absolute;right:0;bottom:44px;width:290px;background:#fff;color:#111;border:1px solid #e4e4e0;border-radius:10px;box-shadow:0 12px 32px rgba(0,0,0,.18);padding:14px;display:none;gap:10px}
    .card.open{display:grid}
    .who{font-size:14px;font-weight:600}.sub{font-size:12px;color:#6b6b6b}
    label{display:flex;gap:8px;align-items:center;font-size:13px;cursor:pointer}
    button.go{height:34px;border:0;border-radius:6px;background:#111;color:#fff;font-size:13px;font-weight:600;cursor:pointer}
    button.go:disabled{opacity:.5;cursor:default}
    button.link{background:none;border:0;padding:0;color:#111;text-decoration:underline;font-size:12px;cursor:pointer;justify-self:start}
    .msg{font-size:12px;color:#6b6b6b;min-height:1em;white-space:pre-wrap}.msg.bad{color:#b42318}.msg.good{color:#067647}
  </style>
  <div class="card" id="card">
    <div><div class="who" id="who">—</div><div class="sub" id="sub"></div></div>
    <label><input type="checkbox" id="mtg"> A meeting is booked with this person</label>
    <button class="go" id="save">Save conversation to HQ</button>
    <button class="link" id="full">Load full history first (long chats)</button>
    <div class="msg" id="msg"></div>
  </div>
  <button class="pill" id="pill"><i>O</i>HQ</button>`;
  document.documentElement.appendChild(host);
  const $ = id => sh.getElementById(id);
  const say = (t, tone = '') => { $('msg').textContent = t; $('msg').className = 'msg ' + tone; };

  function refresh() {
    const r = read();
    host.style.display = r ? 'block' : 'none';
    if (!r) { $('card').classList.remove('open'); return; }
    const p = r.payload, ours = p.messages.filter(m => m.from === 'us').length;
    $('who').textContent = p.prospect_name || 'This conversation';
    $('sub').textContent = `${p.messages.length} messages visible · ${ours} from ${p.our_name || 'us'}`;
  }
  $('pill').onclick = () => { $('card').classList.toggle('open'); say(''); refresh(); };
  $('full').onclick = async () => { const t = activeThread(); if (!t) return; await loadHistory(t.root, m => say(m)); refresh(); say('Full history loaded. Now save.'); };
  $('save').onclick = async () => {
    const r = read(); if (!r) { say('Open a conversation first.', 'bad'); return; }
    if (!r.payload.thread_key) { say("Couldn't identify this conversation. Open it in the full Messaging page and try again.", 'bad'); return; }
    if (!r.payload.our_name) say('Could not read your LinkedIn name; saving anyway.');
    $('save').disabled = true; say('Saving…');
    const res = await new Promise(ok => chrome.runtime.sendMessage({ type: 'capture', payload: { ...r.payload, meeting_booked: $('mtg').checked } }, ok));
    $('save').disabled = false;
    if (!res?.ok) { say(res?.error || 'Save failed', 'bad'); return; }
    const x = res.result;
    say([`${x.updated ? 'Updated' : 'Saved'} · ${x.messages} messages${x.account_name ? ` · ${x.account_name}'s account` : ''}`,
      x.variant ? `Matched DM test “${x.variant.test}”, version ${x.variant.label}` : 'No DM test version matched the first message',
      x.replied ? 'They replied' : 'No reply yet', x.meeting_logged ? 'Meeting logged in HQ' : ''].filter(Boolean).join('\n'), 'good');
    $('mtg').checked = false;
  };

  // LinkedIn is a single-page app: re-check what's open every second (cheap: no network, reads a few elements).
  let lastUrl = '';
  setInterval(() => { if (location.href !== lastUrl || host.style.display === 'none') { lastUrl = location.href; refresh(); } }, 1000);

  // Exposed for tests only.
  window.__ohqTest = { read, messages, toIso };
})();
