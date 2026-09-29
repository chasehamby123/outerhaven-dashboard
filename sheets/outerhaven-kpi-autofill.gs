/**
 * Outerhaven KPI sheet auto-fill (Google Apps Script, bound to "OuterHaven LinkedIn Accounts KPI").
 *
 * Every morning it pulls the LinkedIn numbers the scraper collects and writes them into the Daily and Weekly tabs:
 *   Post amount · Total comments · Repost · Total Unreplied comments
 * Only original posts count (reshares of teammates' posts are ignored). Numbers are by the day the post went out
 * (Malaysia time). Everything else (impressions, saves, DMs, meetings…) stays manual: LinkedIn only shows it to the
 * account owner.
 *
 * Safe by design:
 *   - It never overwrites a number a person typed. It only writes into empty cells, or cells it wrote itself
 *     (marked with a note) whose value nobody has changed since.
 *   - It adds a row block for yesterday in Daily, and a new block in Weekly when a new week starts, using the
 *     account list from the most recent block. New rows copy the previous block's formatting (colours, fonts),
 *     and every block gets the black separator line under its last row, like the ones typed by hand.
 *
 * Setup (one time): Extensions → Apps Script → paste this file → Save → reload the sheet →
 * menu "Outerhaven" → "Turn on daily auto-fill". Google will ask you to authorise it once.
 */
const OH = {
  URL: 'https://nfcysxqdwpdhrdpgxrlo.supabase.co/rest/v1/rpc/sheet_post_stats',
  KEY: 'sb_publishable_nBRZvesX4tz7zUPq5QLYfQ__in76dF5', // public key, same one the website uses
  TOKEN: '8f9f76c35558a75d514e56930a7e4cf070ba1ba74d23f2b6', // read-only token for this feed
  TZ: 'Asia/Kuala_Lumpur',
  DAYS_BACK: 60,
  RUN_HOUR: 11, // after the 9 AM scrape and its comment passes
};
const FILL_COLS = { 'post amount': 'posts', 'total comments': 'comments', 'repost': 'reposts', 'total unreplied comments': 'unreplied' };
const NOTE_PREFIX = 'Auto-filled from scraper: ';

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Outerhaven')
    .addItem('Fill scraped numbers now', 'fillFromScraper')
    .addItem('Turn on daily auto-fill', 'installDailyTrigger')
    .addItem('Turn off daily auto-fill', 'removeDailyTrigger')
    .addItem('Redraw block lines', 'redrawAllBlockLines')
    .addToUi();
}

function installDailyTrigger() {
  removeDailyTrigger();
  ScriptApp.newTrigger('fillFromScraper').timeBased().everyDays(1).atHour(OH.RUN_HOUR).inTimezone(OH.TZ).create();
  fillFromScraper();
  SpreadsheetApp.getActive().toast(`Daily auto-fill is on (${OH.RUN_HOUR}:00 Malaysia time).`, 'Outerhaven', 6);
}

function removeDailyTrigger() {
  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'fillFromScraper').forEach(t => ScriptApp.deleteTrigger(t));
}

function fillFromScraper() {
  const ss = SpreadsheetApp.getActive();
  const today = Utilities.formatDate(new Date(), OH.TZ, 'yyyy-MM-dd');
  const stats = fetchStats(addDays(today, -OH.DAYS_BACK), today);
  const report = [];
  for (const [tab, kind] of [['Daily', 'daily'], ['Weekly', 'weekly']]) {
    const sh = ss.getSheetByName(tab);
    if (!sh) continue;
    let values = sh.getDataRange().getValues();
    const toAdd = planNewRows(values, kind, today);
    if (toAdd.length) {
      const start = sh.getLastRow() + 1, lastCol = sh.getLastColumn(), prev = lastBlock(values, today);
      sh.getRange(start, 1, toAdd.length, 2).setValues(toAdd.map(r => [r[0], toSheetDate(r[1])]));
      // Look like the rows above: copy each row's formatting from the matching row of the previous block.
      if (prev) for (let i = 0; i < toAdd.length; i++) {
        const src = prev.first + (i % prev.count);
        sh.getRange(src, 1, 1, lastCol).copyFormatToRange(sh, 1, lastCol, start + i, start + i);
      }
      sh.getRange(start, 2, toAdd.length, 1).setNumberFormat('d/m/yyyy');
      values = sh.getDataRange().getValues();
    }
    drawBlockLines(sh, values);
    const notes = sh.getDataRange().getNotes();
    const writes = planFill(values, notes, stats, kind, today);
    writes.forEach(w => { const c = sh.getRange(w.r + 1, w.c + 1); c.setValue(w.v); c.setNote(NOTE_PREFIX + w.v); });
    report.push(`${tab}: ${writes.length} cells${toAdd.length ? `, ${toAdd.length} rows added` : ''}`);
  }
  ss.toast(report.join(' · ') || 'Nothing to fill', 'Outerhaven', 6);
}

// Black line under the last row of every date block (Daily: each day, Weekly: each week).
function drawBlockLines(sh, values) {
  const ends = blockEnds(values || sh.getDataRange().getValues());
  if (!ends.length) return;
  const lastCol = sh.getLastColumn();
  const a1 = ends.map(r => sh.getRange(r + 1, 1, 1, lastCol).getA1Notation());
  sh.getRangeList(a1).setBorder(null, null, true, null, null, null, '#000000', SpreadsheetApp.BorderStyle.SOLID);
}

function redrawAllBlockLines() {
  const ss = SpreadsheetApp.getActive();
  for (const tab of ['Daily', 'Weekly']) { const sh = ss.getSheetByName(tab); if (sh) drawBlockLines(sh); }
  ss.toast('Block lines redrawn.', 'Outerhaven', 4);
}

function fetchStats(from, to) {
  const res = UrlFetchApp.fetch(OH.URL, {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { apikey: OH.KEY, Authorization: 'Bearer ' + OH.KEY },
    payload: JSON.stringify({ p_token: OH.TOKEN, p_from: from, p_to: to }),
  });
  if (res.getResponseCode() !== 200) throw new Error('Outerhaven feed error ' + res.getResponseCode() + ': ' + res.getContentText().slice(0, 300));
  return JSON.parse(res.getContentText());
}

// ---------- pure helpers (no Google services; tested in Node) ----------

function acctKey(name) { return String(name || '').trim().split(/\s+/)[0].toLowerCase(); }
function addDays(iso, n) { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
function toSheetDate(iso) { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); }

// Sheet dates are day-first (13/9/2026). Date cells come through as Date objects.
function isoDate(v) {
  if (v instanceof Date && !isNaN(v)) return v.getFullYear() + '-' + String(v.getMonth() + 1).padStart(2, '0') + '-' + String(v.getDate()).padStart(2, '0');
  const m = String(v || '').trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m || +m[2] < 1 || +m[2] > 12) return null;
  return m[3] + '-' + m[2].padStart(2, '0') + '-' + m[1].padStart(2, '0');
}

function columns(header) {
  const h = header.map(x => String(x || '').trim().toLowerCase());
  const cols = { account: h.indexOf('account'), date: h.indexOf('date'), fill: {} };
  h.forEach((name, i) => { if (FILL_COLS[name]) cols.fill[FILL_COLS[name]] = i; });
  return cols;
}

// Weekly rows cover [their date, next block's date); the last block covers 7 days.
function periods(values, cols, kind) {
  const dates = [...new Set(values.slice(1).map(r => isoDate(r[cols.date])).filter(Boolean))].sort();
  const end = {};
  dates.forEach((d, i) => { end[d] = kind === 'daily' ? addDays(d, 1) : (dates[i + 1] || addDays(d, 7)); });
  return end;
}

function planFill(values, notes, stats, kind, today) {
  const cols = columns(values[0] || []);
  if (cols.account < 0 || cols.date < 0) return [];
  const end = periods(values, cols, kind), out = [];
  for (let r = 1; r < values.length; r++) {
    const key = acctKey(values[r][cols.account]), start = isoDate(values[r][cols.date]);
    if (!key || !start || start > today) continue;
    const rows = stats.filter(s => acctKey(s.account) === key && s.day >= start && s.day < end[start]);
    if (!rows.length) continue; // no scraped posts for this account/period: leave it to the team
    for (const [field, c] of Object.entries(cols.fill)) {
      const v = rows.reduce((n, s) => n + (Number(s[field]) || 0), 0);
      const cur = values[r][c], note = (notes[r] && notes[r][c]) || '';
      const empty = cur === '' || cur === null;
      const ours = note.indexOf(NOTE_PREFIX) === 0 && String(cur) === note.slice(NOTE_PREFIX.length);
      if ((empty || ours) && String(cur) !== String(v)) out.push({ r, c, v });
    }
  }
  return out;
}

// Row indexes (0-based, in values) that end a date block: the next row has a different date, or no date.
function blockEnds(values) {
  const cols = columns(values[0] || []);
  if (cols.account < 0 || cols.date < 0) return [];
  const out = [];
  for (let r = 1; r < values.length; r++) {
    const d = isoDate(values[r][cols.date]); if (!d || !String(values[r][cols.account] || '').trim()) continue;
    const next = r + 1 < values.length ? isoDate(values[r + 1][cols.date]) : null;
    if (next !== d) out.push(r);
  }
  return out;
}

// The most recent block on or before today: its first row (1-based sheet row) and row count.
function lastBlock(values, today) {
  const cols = columns(values[0] || []);
  if (cols.account < 0 || cols.date < 0) return null;
  let last = null;
  for (let r = 1; r < values.length; r++) { const d = isoDate(values[r][cols.date]); if (d && d <= today && String(values[r][cols.account] || '').trim() && (!last || d > last)) last = d; }
  if (!last) return null;
  const rows = []; for (let r = 1; r < values.length; r++) if (isoDate(values[r][cols.date]) === last) rows.push(r);
  return { first: rows[0] + 1, count: rows.length };
}

// Daily: add yesterday's block. Weekly: add blocks for any week that has started since the last one.
function planNewRows(values, kind, today) {
  const cols = columns(values[0] || []);
  if (cols.account < 0 || cols.date < 0) return [];
  // Ignore mistyped future dates (e.g. 5/11/2026) when finding the latest block.
  const rows = values.slice(1).map(r => ({ a: String(r[cols.account] || '').trim(), d: isoDate(r[cols.date]) })).filter(x => x.a && x.d && x.d <= today);
  if (!rows.length) return [];
  const last = rows.map(x => x.d).sort().pop();
  const names = rows.filter(x => x.d === last).map(x => x.a);
  const have = new Set(rows.map(x => x.d)), add = [];
  if (kind === 'daily') {
    const y = addDays(today, -1);
    if (!have.has(y) && y > last) names.forEach(n => add.push([n, y]));
  } else {
    for (let d = addDays(last, 7); d <= today; d = addDays(d, 7)) names.forEach(n => add.push([n, d]));
  }
  return add;
}

if (typeof module !== 'undefined') module.exports = { planFill, planNewRows, blockEnds, lastBlock, isoDate, acctKey, periods, columns, NOTE_PREFIX };
