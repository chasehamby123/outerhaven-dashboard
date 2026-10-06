// Chat button (bottom right on every page). A message goes to edge function hq-chat, which starts the Claude routine;
// Claude answers questions read-only and puts any change on a review branch (routines/chat.md). Each person's tabs and
// history live in chat_threads / chat_messages: closing a tab archives it, nothing is deleted.
import { sb, esc, $, $$, toast, fmtDate } from './core.js';
import { rich } from './chatmd.js';

let host = null, threads = [], messages = new Map(), current = null, showArchive = false, open = false, unread = false, timer = null, channel = null, sending = false, fresh = false, wide = false;
const store = { get: k => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } } };
const SUGGEST = ['What needs my attention today?', 'Chart our pipeline by stage', 'How did this week\'s posts perform? Show a chart', 'Which replies are we waiting on?'];
const ICON_ARROW = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>';
const ICON_GO = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
const stale = m => m.status === 'working' && Date.now() - new Date(m.created_at).getTime() > 20 * 60e3;
const working = () => [...messages.values()].flat().some(m => m.status === 'working' && !stale(m));
const pageLabel = () => (location.hash || '#/').replace(/^#\/?/, '') || 'home';

// Safe light markdown: escape first, then **bold**, `code`, bare links, line breaks.
function md(t) {
  return esc(t).replace(/`([^`\n]+)`/g, '<code>$1</code>').replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>')
    .replace(/(https:\/\/[^\s<)]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>').replace(/\n/g, '<br>');
}

async function loadThreads() {
  const r = await sb.from('chat_threads').select('id,title,archived,updated_at,created_at').order('updated_at', { ascending: false }).limit(200);
  if (r.error) return false;
  threads = r.data || []; return true;
}
async function loadMessages(id) {
  const r = await sb.from('chat_messages').select('id,thread_id,role,body,status,progress,created_at').eq('thread_id', id).order('created_at', { ascending: true }).limit(500);
  if (!r.error) messages.set(id, r.data || []);
}
async function refresh() {
  if (!host) return;
  const before = new Set([...messages.entries()].filter(([, l]) => l.some(m => m.status === 'working')).map(([id]) => id));
  if (before.size) await sb.rpc('chat_sweep');
  await loadThreads();
  await Promise.all([...new Set([...(open && current ? [current] : []), ...before])].map(loadMessages));
  // A reply that landed while the panel was closed lights the dot on the button.
  if (!open && [...before].some(id => !(messages.get(id) || []).some(m => m.status === 'working'))) unread = true;
  draw(); poll();
}
function poll() { clearTimeout(timer); if (working()) timer = setTimeout(refresh, 4000); }

const openTabs = () => threads.filter(t => !t.archived);
function pickCurrent() {
  if (fresh) { current = null; return; } // 'New chat' stays blank until the first message is sent
  const tabs = openTabs();
  if (!tabs.some(t => t.id === current)) current = tabs.some(t => t.id === store.get('hq-chat-thread')) ? store.get('hq-chat-thread') : tabs[0]?.id || null;
}

function draw() {
  if (!host) return;
  pickCurrent();
  const btn = $('#hqChatBtn', host), panel = $('#hqChatPanel', host);
  btn.classList.toggle('on', open); btn.classList.toggle('busy', working() && !open); btn.classList.toggle('dot', unread && !open);
  panel.hidden = !open; panel.classList.toggle('wide', wide);
  const wb = $('[data-act=wide]', host); if (wb) { wb.title = wide ? 'Make smaller' : 'Make larger'; wb.setAttribute('aria-label', wb.title); }
  if (!open) return;
  const tabs = openTabs(), list = current ? messages.get(current) || [] : [];
  const t = $('#hqChatTabs', host);
  t.innerHTML = tabs.map(x => `<span class="hqTab ${x.id === current && !showArchive ? 'on' : ''}"><button type="button" data-tab="${x.id}" title="${esc(x.title)}">${esc(x.title)}</button><button type="button" class="x" data-close="${x.id}" aria-label="Close tab" title="Close tab (kept in History)">×</button></span>`).join('')
    + `<button type="button" class="hqTabNew" id="hqChatNew" title="New chat" aria-label="New chat">+</button><button type="button" class="hqTabHist ${showArchive ? 'on' : ''}" id="hqChatHist">History</button>`;
  const body = $('#hqChatBody', host);
  if (showArchive) {
    const old = threads.filter(x => x.archived);
    body.innerHTML = old.length ? `<ul class="hqHist">${old.map(x => `<li><button type="button" data-reopen="${x.id}"><b>${esc(x.title)}</b><small>${fmtDate(x.updated_at)}</small></button></li>`).join('')}</ul>` : '<div class="hqEmpty">Closed chats show up here. Nothing is ever deleted.</div>';
    $('#hqChatForm', host).hidden = true;
  } else {
    $('#hqChatForm', host).hidden = false;
    body.innerHTML = !current ? `<div class="hqEmpty"><b>How can I help?</b><p>Ask about your data, or ask for a change: it goes to a review branch and nothing is live until it's reviewed. Ask for a chart and you get one.</p><div class="hqSuggest">${SUGGEST.map(q => `<button type="button" data-suggest="${esc(q)}"><span>${esc(q)}</span>${ICON_GO}</button>`).join('')}</div></div>`
      : list.length ? list.map(m => `<div class="hqMsg ${m.role}${m.status === 'error' || stale(m) ? ' err' : ''}">${m.role === 'assistant' && (m.status === 'working' && !stale(m)) ? `<span class="hqWork"><i></i><i></i><i></i></span><small>${esc(m.progress || 'Working')}. This can take a minute or two.</small>` : stale(m) ? 'Claude did not answer in time. Send the message again.' : m.role === 'assistant' && m.status !== 'error' ? rich(m.body) : md(m.body)}</div>`).join('') : '<div class="hqEmpty">Loading…</div>';
    const full = $('#hqChatBody', host); if (full) full.scrollTop = full.scrollHeight;
  }
  $('#hqChatSend', host).disabled = sending || (current && (messages.get(current) || []).some(m => m.status === 'working' && !stale(m)));
}

async function send(text) {
  const ta = $('#hqChatInput', host), body = (typeof text === 'string' ? text : ta.value).trim(); if (!body || sending) return;
  sending = true; draw();
  const res = await sb.functions.invoke('hq-chat', { body: { action: 'send', thread_id: current, body, page: pageLabel() } });
  sending = false;
  const out = res.data || {};
  if (res.error && !out.error) { let msg = res.error.message; try { msg = (await res.error.context?.json?.())?.error || msg; } catch { /* keep */ } toast(msg); draw(); return; }
  if (!out.ok && !out.thread_id) { toast(out.error || 'Could not send'); draw(); return; }
  ta.value = ''; ta.style.height = 'auto';
  fresh = false; current = out.thread_id; store.set('hq-chat-thread', current); showArchive = false;
  if (out.error) toast(out.error);
  await loadThreads(); await loadMessages(current); draw(); poll();
}

// Expand a chart/table card full screen (a copy, so the chat underneath stays as it was). Click outside or Esc closes.
function openArtifact(fig) {
  if (!fig) return; document.querySelector('.czOverlay')?.remove();
  const ov = document.createElement('div'); ov.className = 'czOverlay'; ov.appendChild(fig.cloneNode(true));
  ov.querySelector('[data-cz-open]')?.remove();
  ov.addEventListener('click', e => {
    if (e.target === ov) return ov.remove();
    const t = e.target.closest('[data-cz-view]'); if (!t) return;
    const f = t.closest('.cz'), on = f.querySelector('.czTable').hidden; f.querySelector('.czTable').hidden = !on; f.querySelector('.czChart').hidden = on; t.setAttribute('aria-pressed', on); t.textContent = on ? 'Chart' : 'Table';
  });
  document.body.appendChild(ov);
}

function bind() {
  host.addEventListener('click', async e => {
    const t = e.target.closest('button'); if (!t) return;
    if (t.id === 'hqChatBtn') { open = !open; unread = false; if (open) { await refresh(); $('#hqChatInput', host)?.focus(); } else draw(); return; }
    if (t.id === 'hqChatMin') { open = false; draw(); return; }
    if (t.dataset.act === 'wide') { wide = !wide; store.set('hq-chat-wide', wide ? '1' : '0'); draw(); return; }
    if (t.dataset.suggest) { send(t.dataset.suggest); return; }
    if (t.hasAttribute('data-cz-view')) { const fig = t.closest('.cz'), on = fig.querySelector('.czTable').hidden; fig.querySelector('.czTable').hidden = !on; fig.querySelector('.czChart').hidden = on; t.setAttribute('aria-pressed', on); t.textContent = on ? 'Chart' : 'Table'; return; }
    if (t.hasAttribute('data-cz-open')) { openArtifact(t.closest('.cz')); return; }
    if (t.id === 'hqChatNew') { fresh = true; current = null; showArchive = false; draw(); $('#hqChatInput', host).focus(); return; }
    if (t.id === 'hqChatHist') { showArchive = !showArchive; await loadThreads(); draw(); return; }
    if (t.dataset.tab) { fresh = false; current = t.dataset.tab; store.set('hq-chat-thread', current); showArchive = false; await loadMessages(current); draw(); return; }
    if (t.dataset.close) { fresh = false; await sb.from('chat_threads').update({ archived: true }).eq('id', t.dataset.close); if (current === t.dataset.close) current = null; await loadThreads(); draw(); return; }
    if (t.dataset.reopen) { fresh = false; await sb.from('chat_threads').update({ archived: false }).eq('id', t.dataset.reopen); current = t.dataset.reopen; store.set('hq-chat-thread', current); showArchive = false; await loadThreads(); await loadMessages(current); draw(); }
  });
  $('#hqChatForm', host).addEventListener('submit', e => { e.preventDefault(); send(); });
  const ta = $('#hqChatInput', host);
  ta.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(); } });
  ta.addEventListener('input', () => { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 140) + 'px'; });
  document.addEventListener('keydown', e => { if (e.key !== 'Escape') return; const ov = document.querySelector('.czOverlay'); if (ov) { ov.remove(); return; } if (open && !document.querySelector('.modal')) { open = false; draw(); } });
}

export async function mountChat() {
  if (host) return;
  if (!(await loadThreads())) return; // tables missing or no access: no button
  host = document.createElement('div'); host.id = 'hqChat';
  host.innerHTML = `<section class="hqChatPanel" id="hqChatPanel" hidden aria-label="Chat with Claude">
      <header><div class="who"><span class="logo"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M18 6l-2.5 2.5M8.5 15.5L6 18"/></svg></span><div><b>Claude</b><small>Ask about HQ. Changes go to a review branch.</small></div></div>
        <div class="acts"><button type="button" data-act="wide" aria-label="Make larger" title="Make larger"><svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M10 2h4v4M6 14H2v-4M14 2l-5 5M2 14l5-5"/></svg></button><button type="button" id="hqChatMin" aria-label="Minimise chat" title="Minimise">–</button></div></header>
      <div class="hqTabs" id="hqChatTabs"></div>
      <div class="hqBody" id="hqChatBody"></div>
      <form class="hqForm" id="hqChatForm"><div class="box"><textarea id="hqChatInput" rows="1" maxlength="4000" placeholder="Ask or request a change…" aria-label="Message"></textarea><button class="hqSend" id="hqChatSend" type="submit" aria-label="Send">${ICON_ARROW}</button></div></form>
    </section>
    <button type="button" class="hqChatBtn" id="hqChatBtn" aria-label="Chat with Claude"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/></svg></button>`;
  wide = store.get('hq-chat-wide') === '1';
  document.body.appendChild(host); bind(); pickCurrent();
  if (current) await loadMessages(current);
  for (const t of openTabs().slice(0, 5)) if (!messages.has(t.id)) loadMessages(t.id);
  draw(); poll();
  // New replies appear as soon as Claude writes them (RLS limits this to your own chats); polling covers a dropped connection.
  channel = sb.channel('hq-chat').on('postgres_changes', { event: '*', schema: 'public', table: 'chat_messages' }, () => { clearTimeout(timer); timer = setTimeout(refresh, 300); }).subscribe();
  if (working()) refresh();
}
