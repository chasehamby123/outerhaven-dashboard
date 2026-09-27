// Live read of the "OuterHaven LinkedIn Accounts KPI" Google Sheet (Weekly tab).
// The sheet stays the place the team types numbers; the dashboard only reads it.
export const SHEET_ID = '1RGhFmIzQDCulzW6EVlFpVl8mmWEn_QU7rbSnzq1I01g';
export const SHEET_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit`;

// Column header in sheet -> field name. Matching is case/space-insensitive.
const COLS = {
  'account': 'account', 'date': 'date', 'post amount': 'posts', 'total comments': 'comments', 'saves': 'saves',
  'repost': 'reposts', 'sends': 'sends', 'impressions': 'impressions', 'network ratio (in/out)': 'networkRatio',
  'connections': 'connections', 'total followers': 'followers', 'total replied comments': 'repliedComments',
  'total unreplied comments': 'unrepliedComments', 'total comment connections': 'commentConnections',
  "total initiated dm's": 'dmsInitiated', "total followed-up dm's": 'dmsFollowedUp', 'total leads replied': 'leadsReplied',
  'meetings booked': 'meetingsBooked', 'successful meetings': 'meetingsHeld',
};
export const METRICS = ['posts', 'impressions', 'comments', 'saves', 'reposts', 'sends', 'connections', 'followers', 'repliedComments', 'unrepliedComments', 'commentConnections', 'dmsInitiated', 'dmsFollowedUp', 'leadsReplied', 'meetingsBooked', 'meetingsHeld'];

export function parseCSV(text) {
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

// Sheet dates are day-first (13/9/2026 is valid, so 5/9/2026 is 5 September).
export function parseDate(s) {
  const m = String(s || '').trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const [, d, mo, y] = m.map(Number);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export function normalize(rows) {
  const header = (rows[0] || []).map(h => COLS[h.trim().toLowerCase()] || null);
  const out = [];
  for (const r of rows.slice(1)) {
    const o = { filled: false };
    header.forEach((f, i) => { if (f) o[f] = (r[i] ?? '').trim(); });
    if (!o.account || !o.date) continue;
    o.account = o.account.replace(/\s+/g, ' ').trim();
    o.week = parseDate(o.date);
    if (!o.week) continue;
    for (const k of METRICS) {
      const v = o[k]; if (v === '' || v == null) { o[k] = null; continue; }
      const n = Number(String(v).replace(/[, ]/g, '')); o[k] = Number.isFinite(n) ? n : null; if (o[k] != null) o.filled = true;
    }
    out.push(o);
  }
  return out;
}

export async function loadWeekly() {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=Weekly&_=${Date.now()}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Sheet returned ${res.status}`);
  const text = await res.text();
  if (/^\s*</.test(text)) throw new Error('Sheet is not shared as "Anyone with the link can view".');
  const rows = normalize(parseCSV(text));
  const weeks = [...new Set(rows.map(r => r.week))].sort();
  const filledWeeks = [...new Set(rows.filter(r => r.filled).map(r => r.week))].sort();
  return { rows, weeks, filledWeeks, fetchedAt: new Date() };
}

// Self-check: run `import('/hq/sheet.js').then(m=>m.selfTest())` in the console.
export function selfTest() {
  const csv = '"Account","Date","Post amount","Meetings Booked"\n"Chase ","13/9/2026","3","2"\n"Dev","5/9/2026","",""\n';
  const r = normalize(parseCSV(csv));
  console.assert(r.length === 2 && r[0].account === 'Chase' && r[0].week === '2026-09-13' && r[0].posts === 3 && r[0].meetingsBooked === 2 && r[0].filled, 'row 1');
  console.assert(r[1].filled === false && r[1].posts === null, 'row 2 empty');
  console.assert(parseDate('31/2/2026') !== null && parseDate('1/13/2026') === null, 'dates');
  return 'sheet selfTest ok';
}
