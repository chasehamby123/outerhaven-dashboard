// OuterHaven HQ: a small "HQ" button on LinkedIn. Nothing is read until someone clicks "Save conversation".
// It never sends, types or clicks anything on LinkedIn ("Draft a reply" only shows text in this panel; a person copies and sends it). "Load full history" only scrolls the open chat upwards;
// "Sync inbox" only scrolls the conversation list and reads names, previews and times.
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


  // ---------- the inbox list (Sync inbox) ----------
  // Reads only the conversation LIST (name, last message preview, time). Never opens, sends or clicks a conversation.
  const THREAD_RE = /\/messaging\/thread\/([^/?#]+)/;
  function listTime(raw) {
    const t = String(raw || '').trim(); if (!t) return null;
    if (/^\d{1,2}:\d{2}/.test(t)) return toIso('today', t);
    const wd = t.toLowerCase().slice(0, 3), full = WEEKDAYS.find(w => w.startsWith(wd));
    if (full && /^[a-z]{3,9}$/i.test(t)) return toIso(full, '12:00 PM');
    if (/^yesterday$/i.test(t)) return toIso('yesterday', '12:00 PM');
    const md = t.match(/^([A-Za-z]{3})[a-z]*\.?\s+(\d{1,2})(?:,?\s*(\d{4}))?$/);
    if (md) return toIso(`${md[1]} ${md[2]}${md[3] ? ' ' + md[3] : ''}`, '12:00 PM');
    return null;
  }
  // "You: thanks" / "You sent an attachment" => we spoke last.
  const FROM_US = /^you(:|\s+(sent|replied|shared|reacted|liked|loved|laughed)\b)/i;
  function rowFromAnchor(a, li, strategy) {
    const m = (a.getAttribute('href') || '').match(THREAD_RE); if (!m) return null;
    const q = sel => li.querySelector(sel);
    let name = txt(q('.msg-conversation-card__participant-names, .msg-conversation-listitem__participant-names')).split('\n')[0];
    let snippet = txt(q('.msg-conversation-card__message-snippet, .msg-conversation-card__message-snippet-body, .msg-overview-list__snippet'));
    let time = txt(q('time.msg-conversation-listitem__time-stamp, .msg-conversation-card__time-stamp, time'));
    if (strategy === 'generic' || !name) {
      const lines = txt(li).split('\n').map(x => x.trim()).filter(x => x.length > 2);
      name = name || lines[0] || '';
      const tm = lines.find(l => /^(\d{1,2}:\d{2}\s*[AP]M|mon|tue|wed|thu|fri|sat|sun|yesterday|[A-Z][a-z]{2}\s+\d{1,2})/i.test(l) && l.length < 14);
      time = time || tm || '';
      snippet = snippet || lines.slice(1).filter(l => l !== time && l !== name).join(' ');
    }
    snippet = snippet.replace(/\s+/g, ' ').trim();
    const unread = !!(q('.msg-conversation-card__unread-count, .notification-badge--show') || /--unread|is-unread/.test(li.className) || /^\d+\s+unread/i.test(txt(li)));
    if (!name) return null;
    return { thread_key: 'thread:' + m[1], thread_url: 'https://www.linkedin.com/messaging/thread/' + m[1] + '/', name: name.slice(0, 120),
      last_from: FROM_US.test(snippet) ? 'us' : 'them', snippet: snippet.replace(FROM_US, '').replace(/^:\s*/, '').trim().slice(0, 300), ts: listTime(time), unread };
  }
  function readInboxList() {
    const out = new Map(); let strategy = 'classic';
    const items = [...document.querySelectorAll('li.msg-conversation-listitem, li.msg-conversation-card, .msg-conversations-container__conversations-list li')];
    for (const li of items) {
      const a = li.querySelector('a[href*="/messaging/thread/"]'); if (!a) continue;
      const r = rowFromAnchor(a, li, 'classic'); if (r) out.set(r.thread_key, r);
    }
    if (!out.size) {
      strategy = 'generic';
      for (const a of document.querySelectorAll('a[href*="/messaging/thread/"]')) {
        const li = a.closest('li') || a.parentElement; if (!li || li.querySelector('.msg-s-message-list')) continue;
        const r = rowFromAnchor(a, li, 'generic'); if (r && !out.has(r.thread_key)) out.set(r.thread_key, r);
      }
    }
    return { rows: [...out.values()], strategy };
  }
  function listScroller() {
    const a = document.querySelector('a[href*="/messaging/thread/"]'); if (!a) return null;
    for (let el = a.parentElement; el && el !== document.body; el = el.parentElement) {
      const cs = getComputedStyle(el); if (/(auto|scroll)/.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 4) return el;
    }
    return document.scrollingElement;
  }
  async function syncInbox(say) {
    const sc = listScroller(); let strategy = 'classic', scrolls = 0, last = -1, stable = 0, rows = [];
    const cutoff = Date.now() - 30 * 864e5;
    for (; scrolls < 14; scrolls++) {
      const r = readInboxList(); rows = r.rows; strategy = r.strategy; say(`Reading inbox… ${rows.length} conversations`);
      const oldest = rows.map(x => x.ts && Date.parse(x.ts)).filter(Boolean).sort((a, b) => a - b)[0];
      if (rows.length >= 300 || (oldest && oldest < cutoff)) break;
      stable = rows.length === last ? stable + 1 : 0; last = rows.length; if (stable >= 2 || !sc) break;
      sc.scrollTop = sc.scrollHeight; await new Promise(ok => setTimeout(ok, 1100));
    }
    if (sc) sc.scrollTop = 0;
    return { rows, strategy, scrolls };
  }

  // ---------- the HQ button (shadow DOM so LinkedIn's CSS can't touch it) ----------
  const host = document.createElement('div'); host.id = 'ohq-host'; host.style.cssText = 'position:fixed;right:18px;bottom:78px;z-index:2147483000;display:none';
  const sh = host.attachShadow({ mode: 'open' });
  sh.innerHTML = `<style>
    *{box-sizing:border-box;font-family:-apple-system,Segoe UI,Inter,Helvetica,Arial,sans-serif}
    .pill{display:flex;align-items:center;gap:6px;height:34px;padding:0 12px 0 6px;border-radius:17px;background:#111;color:#fff;border:0;font-size:13px;font-weight:600;cursor:pointer;box-shadow:0 4px 16px rgba(0,0,0,.25)}
    .pill i{display:grid;place-items:center;width:22px;height:22px;border-radius:50%;background:#fff;color:#111;font-style:normal;font-family:Georgia,serif;font-size:13px}
    .card{position:absolute;right:0;bottom:44px;width:290px;max-height:calc(100vh - 150px);overflow-y:auto;background:#fff;color:#111;border:1px solid #e4e4e0;border-radius:10px;box-shadow:0 12px 32px rgba(0,0,0,.18);padding:14px;display:none;gap:10px}
    .card.open{display:grid}
    .who{font-size:14px;font-weight:600}.sub{font-size:12px;color:#6b6b6b}
    label{display:flex;gap:8px;align-items:center;font-size:13px;cursor:pointer}
    button.go{height:34px;border:0;border-radius:6px;background:#111;color:#fff;font-size:13px;font-weight:600;cursor:pointer}
    button.go:disabled{opacity:.5;cursor:default}
    button.link{background:none;border:0;padding:0;color:#111;text-decoration:underline;font-size:12px;cursor:pointer;justify-self:start}
    .pick{display:grid;grid-template-columns:1fr 1fr;gap:6px}.pick select{height:30px;border:1px solid #d8d8d4;border-radius:6px;font-size:12px;background:#fff;color:#111;min-width:0}
    hr{border:0;border-top:1px solid #e4e4e0;margin:2px 0;width:100%}
    button.go.alt{background:#fff;color:#111;border:1px solid #111}
    .msg{font-size:12px;color:#6b6b6b;min-height:1em;white-space:pre-wrap}.msg.bad{color:#b42318}.msg.good{color:#067647}
    .note{height:30px;border:1px solid #d8d8d4;border-radius:6px;padding:0 8px;font-size:12px;width:100%}
    textarea.out{width:100%;min-height:120px;border:1px solid #d8d8d4;border-radius:6px;padding:8px;font-size:13px;line-height:1.4;resize:vertical;color:#111}
    .meta{font-size:12px;color:#444;line-height:1.35}.meta b{font-weight:600}
    .flags{display:flex;flex-wrap:wrap;gap:4px}.flag{font-size:11px;padding:2px 6px;border-radius:4px;background:#f3f3ef;color:#444}.flag.warn{background:#fdf0d2;color:#9a5a06}
    .row2{display:grid;grid-template-columns:1fr 1fr;gap:6px}
    .card.wide{width:340px}
  </style>
  <div class="card" id="card">
    <div><div class="who" id="who">—</div><div class="sub" id="sub"></div></div>
    <div class="pick"><select id="me" title="Who is saving / who booked"></select><select id="acct" title="Which LinkedIn account this is"></select></div>
    <label><input type="checkbox" id="mtg"> A meeting is booked with this person</label>
    <button class="go" id="save">Save conversation to HQ</button>
    <button class="link" id="full">Load full history first (long chats)</button>
    <hr><div class="sub">Whole inbox for this account</div>
    <button class="go alt" id="sync">Sync inbox to HQ</button>
    <div class="sub" id="lastsync"></div>
    <div class="msg" id="msg"></div>
    <div id="draftSec" style="display:none;gap:8px;grid-template-columns:1fr">
      <hr><div class="sub">AI reply · you review, edit and send it yourself</div>
      <input class="note" id="tweak" placeholder="Optional note: shorter, warmer, more direct…" maxlength="200">
      <button class="go" id="draft">Draft a reply</button>
      <div id="draftBox" style="display:none;gap:8px;grid-template-columns:1fr">
        <div class="meta" id="dmeta"></div><div class="flags" id="dflags"></div>
        <textarea class="out" id="dout" spellcheck="true"></textarea>
        <div class="row2"><button class="go" id="dcopy">Copy reply</button><button class="go alt" id="dagain">Redraft</button></div>
        <div class="sub" id="dnote"></div>
      </div>
    </div>
  </div>
  <button class="pill" id="pill"><i>O</i>HQ</button>`;
  document.documentElement.appendChild(host);
  const $ = id => sh.getElementById(id);
  const say = (t, tone = '') => { $('msg').textContent = t; $('msg').className = 'msg ' + tone; };

  function refresh() {
    const r = read(), onMsg = /^\/messaging/.test(location.pathname);
    host.style.display = r || onMsg ? 'block' : 'none';
    if (!r && !onMsg) { $('card').classList.remove('open'); return; }
    $('save').style.display = $('full').style.display = $('mtg').parentElement.style.display = r ? '' : 'none';
    $('draftSec').style.display = r ? 'grid' : 'none';
    if (!r || draftFor !== draftKey(r)) hideDraft();
    if (r) {
      const p = r.payload, ours = p.messages.filter(m => m.from === 'us').length;
      $('who').textContent = p.prospect_name || 'This conversation';
      $('sub').textContent = `${p.messages.length} messages visible · ${ours} from ${p.our_name || 'us'}`;
    } else { $('who').textContent = 'Inbox'; $('sub').textContent = 'Sync the whole inbox so HQ can show what is waiting on a reply.'; }
    showLast();
  }
  // Who's saving and which account: remembered per browser profile, changeable right here.
  async function loadPicks() {
    const s = await new Promise(ok => chrome.runtime.sendMessage({ type: 'setup' }, ok));
    if (!s?.ok) { say(s?.error || 'Could not reach HQ', 'bad'); return; }
    const o = (list, sel, ph) => `<option value="">${ph}</option>` + list.map(v => `<option ${v === sel ? 'selected' : ''}>${v}</option>`).join('');
    $('me').innerHTML = o(s.team, s.prefs.who, 'You are…'); $('acct').innerHTML = o(s.accounts, s.prefs.account, 'Account…');
  }
  const savePicks = () => chrome.runtime.sendMessage({ type: 'prefs', prefs: { who: $('me').value, account: $('acct').value } });
  $('me').onchange = savePicks; $('acct').onchange = savePicks;
  $('pill').onclick = () => { $('card').classList.toggle('open'); say(''); refresh(); if ($('card').classList.contains('open')) loadPicks(); };
  $('full').onclick = async () => { const t = activeThread(); if (!t) return; await loadHistory(t.root, m => say(m)); refresh(); say('Full history loaded. Now save.'); };
  $('save').onclick = async () => {
    const r = read(); if (!r) { say('Open a conversation first.', 'bad'); return; }
    if (!r.payload.thread_key) { say("Couldn't identify this conversation. Open it in the full Messaging page and try again.", 'bad'); return; }
    if (!$('me').value) { say('Pick who you are first.', 'bad'); return; }
    if (!$('acct').value) { say('Pick which LinkedIn account this is.', 'bad'); return; }
    $('save').disabled = true; say('Saving…');
    const res = await new Promise(ok => chrome.runtime.sendMessage({ type: 'capture', payload: { ...r.payload, meeting_booked: $('mtg').checked, booked_by: $('me').value, account: $('acct').value } }, ok));
    $('save').disabled = false;
    if (!res?.ok) { say(res?.error || 'Save failed', 'bad'); return; }
    const x = res.result;
    say([`${x.updated ? 'Updated' : 'Saved'} · ${x.messages} messages${x.account_name ? ` · ${x.account_name}'s account` : ''}`,
      x.variant ? `Matched DM test “${x.variant.test}”, version ${x.variant.label}` : 'No DM test version matched the first message',
      x.replied ? 'They replied' : 'No reply yet', x.meeting_logged ? `Meeting logged in HQ for ${$('me').value}` : ''].filter(Boolean).join('\n'), 'good');
    $('mtg').checked = false;
  };


  async function showLast() {
    try {
      const { lastSync } = await chrome.storage.local.get('lastSync'); const a = $('acct').value, v = lastSync?.[a];
      $('lastsync').textContent = v ? `Last sync for ${a}: ${new Date(v.at).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' })} · ${v.threads} chats · ${v.awaiting_us} waiting on us` : '';
    } catch { /* storage unavailable */ }
  }
  $('acct').addEventListener('change', showLast);
  $('sync').onclick = async () => {
    if (!/^\/messaging/.test(location.pathname)) { say('Open linkedin.com/messaging first.', 'bad'); return; }
    if (!$('me').value) { say('Pick who you are first.', 'bad'); return; }
    if (!$('acct').value) { say('Pick which LinkedIn account this is.', 'bad'); return; }
    $('sync').disabled = true; say('Reading inbox…');
    try {
      const { rows, strategy, scrolls } = await syncInbox(m => say(m));
      if (!rows.length) { say("Couldn't read any conversations. Make sure the conversation list is visible on the left (not minimised), then try again. If it keeps failing, tell Chase: LinkedIn may have changed its layout.", 'bad'); return; }
      say(`Sending ${rows.length} conversations…`);
      const res = await new Promise(ok => chrome.runtime.sendMessage({ type: 'capture', payload: { action: 'inbox_sync', account: $('acct').value, booked_by: $('me').value, threads: rows, strategy, scrolls, version: chrome.runtime.getManifest().version } }, ok));
      if (!res?.ok) { say(res?.error || 'Sync failed', 'bad'); return; }
      const x = res.result;
      try { const { lastSync = {} } = await chrome.storage.local.get('lastSync'); lastSync[$('acct').value] = { at: x.at, threads: x.threads, awaiting_us: x.awaiting_us }; await chrome.storage.local.set({ lastSync }); } catch {}
      say([`Synced ${x.threads} conversations for ${x.account_name}`, `${x.awaiting_us} waiting on our reply · ${x.awaiting_them} waiting on them`, x.baseline ? 'First sync: this is the baseline.' : `${x.new} new since last sync`].join('\n'), 'good'); showLast();
    } catch (e) { say('Sync failed: ' + (e.message || e), 'bad'); }
    finally { $('sync').disabled = false; }
  };

  // ---------- AI reply (draft only: the person reads, edits, copies and sends it themselves) ----------
  let draftFor = '';
  const draftKey = r => (r?.payload.thread_key || '') + '|' + (r?.payload.prospect_name || '');
  function hideDraft() { draftFor = ''; $('draftBox').style.display = 'none'; $('card').classList.remove('wide'); }
  const FLAG_TEXT = { persona_missing: 'No persona written for this account: ask an admin to fill it in (HQ → Growth → Reply assist)', no_resource_matched: 'No matching resource found: add the link yourself', instruction_in_message: 'The message tried to give the AI instructions: be careful' };
  const esc = s => String(s).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  async function draftReply() {
    const r = read(); if (!r) { say('Open a conversation first.', 'bad'); return; }
    if (!$('me').value) { say('Pick who you are first.', 'bad'); return; }
    if (!$('acct').value) { say('Pick which LinkedIn account this is.', 'bad'); return; }
    if (!r.payload.messages.length) { say("Couldn't read any messages. Open the chat on the full Messaging page.", 'bad'); return; }
    $('draft').disabled = true; $('dagain').disabled = true; say('Drafting…');
    const p = r.payload;
    const res = await new Promise(ok => chrome.runtime.sendMessage({ type: 'reply', payload: {
      account: $('acct').value, booked_by: $('me').value, thread_key: p.thread_key, tweak: $('tweak').value.trim(),
      prospect: { name: p.prospect_name, headline: p.prospect_headline },
      messages: p.messages.slice(-30).map(m => ({ from: m.from, text: m.text, at: m.at })) } }, ok));
    $('draft').disabled = false; $('dagain').disabled = false;
    if (!res?.ok) { say(res?.error || 'Draft failed', 'bad'); return; }
    // The person may have switched chats while Claude was writing: never show a draft against the wrong person.
    const now = read(); if (!now || draftKey(now) !== draftKey(r)) { say('You switched chats while it was drafting. Press Draft again.', 'bad'); return; }
    const d = res.result; draftFor = draftKey(r);
    $('dout').value = d.reply;
    $('dmeta').innerHTML = [d.background ? `<b>Who:</b> ${esc(d.background)}` : '', d.intent ? `<b>Looks like:</b> ${esc(d.intent.replace(/_/g, ' '))}` : '', d.next_step ? `<b>Next:</b> ${esc(d.next_step)}` : ''].filter(Boolean).join('<br>');
    $('dflags').innerHTML = (d.needs_human ? '<span class="flag warn">Needs a person: check before sending</span>' : '') + (d.flags || []).map(f => `<span class="flag ${FLAG_TEXT[f] ? 'warn' : ''}">${esc(FLAG_TEXT[f] || f)}</span>`).join('');
    $('dnote').textContent = d.remaining_today != null ? `${d.remaining_today} drafts left today` : '';
    $('draftBox').style.display = 'grid'; $('card').classList.add('wide'); say('');
  }
  $('draft').onclick = draftReply; $('dagain').onclick = draftReply;
  $('dcopy').onclick = async () => {
    const t = $('dout').value; if (!t.trim()) return;
    try { await navigator.clipboard.writeText(t); } catch { $('dout').select(); document.execCommand('copy'); }
    const ph = t.match(/\[[^\]]{2,60}\]/g);
    say(ph ? `Copied. Fill in ${ph.join(', ')} before you send.` : 'Copied. Paste it into the chat, check it, then send.', ph ? 'bad' : 'good');
  };

  // LinkedIn is a single-page app: re-check what's open every second (cheap: no network, reads a few elements).
  let lastUrl = '';
  setInterval(() => {
    if (location.href !== lastUrl || host.style.display === 'none') { lastUrl = location.href; refresh(); }
    else if (draftFor && draftKey(read()) !== draftFor) hideDraft(); // chat bubbles switch without a URL change
  }, 1000);

  // Exposed for tests only.
  window.__ohqTest = { read, messages, toIso, readInboxList, listTime, draftReply };
})();
