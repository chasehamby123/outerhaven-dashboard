// Post formats (11 Oct 2026): what a posting slot is planned to be, what actually went out, and whether they match.
// post_formats = our names ("Presentation", "PDF carousel") mapped to what LinkedIn shows (linkedin_type) and, for documents,
// the page shape. Planned format for a slot on a date = post_plan row (one-off / experiment) ?? the weekly slot's format_key.
// The scraper (daily-ops-linkedin-auto v11) writes detected_format / planned_format / format_check on each post.
import { sb, esc, state, modal, opts, toast, fail, $, $$ } from './core.js';

let formats = null, pending = null;
export async function loadFormats(force = false) {
  if (formats && !force) return formats;
  if (!pending || force) pending = sb.from('post_formats').select('*').order('sort').then(r => { formats = r.error ? [] : (r.data || []); pending = null; return formats; });
  return pending;
}
export const formatList = (all = false) => (formats || []).filter(f => all || f.active !== false);
export const fmtOf = key => (formats || []).find(f => f.key === key) || null;
export const fmtLabel = key => fmtOf(key)?.label || (key ? String(key) : 'Not set');

// A shape per LinkedIn type, so the format reads without colour.
const ICON = { image: '▣', multi_image: '▦', document: '▤', video: '▶', text: '¶', poll: '☰', article: '⧉' };
export const fmtIcon = key => ICON[fmtOf(key)?.linkedin_type] || '•';
export const fmtChip = (key, cls = '') => key ? `<span class="fmtChip ${cls}" title="${esc(fmtOf(key)?.how_to || '')}"><i aria-hidden="true">${fmtIcon(key)}</i>${esc(fmtLabel(key))}</span>` : '';

// Planned vs what went out. Symbol + word, never colour alone (Tengku is red-green colour-blind).
export const CHECK = {
  match: ['good', '✓', 'Right format'],
  mismatch: ['bad', '✕', 'Wrong format'],
  unknown: ['warn', '?', "Can't tell yet"],
  unplanned: ['', '–', 'No slot'],
};
export const checkHtml = (post, opt = {}) => {
  if (!post?.format_check) return '';
  const [tone, sym, word] = CHECK[post.format_check] || CHECK.unknown;
  const what = post.format_check === 'mismatch' ? `${word}: went out as ${fmtLabel(post.detected_format)}, planned ${fmtLabel(post.planned_format)}`
    : post.format_check === 'match' ? `${word} (${fmtLabel(post.detected_format)})` : post.format_check === 'unknown' ? (post.planned_format ? `${word}: planned ${fmtLabel(post.planned_format)}` : 'No format planned for this slot') : word;
  return `<span class="fmtCheck" data-tone="${tone}" title="${esc(what)}"><b aria-hidden="true">${sym}</b>${esc(opt.short ? word : what)}</span>`;
};

// One-off plans (post_plan) between two dates → Map "weeklyId|date" → row.
export async function loadPlans(from, to) {
  let q = sb.from('post_plan').select('*').gte('work_date', from);
  if (to) q = q.lte('work_date', to);
  const r = await q; const m = new Map();
  for (const p of r.data || []) m.set(`${p.weekly_post_id}|${p.work_date}`, p);
  return m;
}
export const plannedFor = (weekly, date, plans) => plans?.get(`${weekly?.id}|${date}`)?.format_key || weekly?.format_key || null;

// The next n dates (YYYY-MM-DD, ops days) that fall on weekday dow, starting at `from`.
export function nextDates(dow, n, from) {
  const out = [], d = new Date(from + 'T12:00:00Z');
  for (let i = 0; out.length < n && i < 7 * n + 7; i++) { if (d.getUTCDay() === dow) out.push(d.toISOString().slice(0, 10)); d.setUTCDate(d.getUTCDate() + 1); }
  return out;
}

// Admin editor for the format list itself (Schedule → Formats).
const TYPES = [['image', 'Single image'], ['multi_image', 'Several images'], ['document', 'Document (PDF)'], ['video', 'Video'], ['text', 'Text only'], ['poll', 'Poll'], ['article', 'Article / link']];
const SHAPES = [['any', 'Any'], ['landscape', 'Landscape (16:9)'], ['portrait_or_square', 'Portrait or square'], ['portrait', 'Portrait only'], ['square', 'Square only']];
export async function editFormats(onDone) {
  await loadFormats(true);
  const rows = formatList(true);
  const row = (f, i) => `<div class="fmtRow" data-i="${i}">
      <input class="input" name="label" value="${esc(f.label || '')}" placeholder="Name, e.g. Presentation" aria-label="Name">
      <select class="select" name="linkedin_type" aria-label="What LinkedIn shows">${opts(TYPES, f.linkedin_type || 'image')}</select>
      <select class="select" name="orientation" aria-label="Page shape (documents)">${opts(SHAPES, f.orientation || 'any')}</select>
      <label class="row s" style="gap:6px"><input type="checkbox" name="active" ${f.active !== false ? 'checked' : ''}> In use</label>
      <input class="input full" name="how_to" value="${esc(f.how_to || '')}" placeholder="How to make it (shown on Today and the creation batch)" aria-label="How to make it">
    </div>`;
  const { el } = modal({ title: 'Post formats', wide: true, submit: 'Save formats', body: `<p class="s muted" style="margin:0 0 12px">The scraper decides what went out from what LinkedIn shows: the type, and for documents the page shape it reads from the PDF.
      So two document formats only stay apart by shape (Presentation = landscape slides, PDF carousel = portrait or square pages).</p>
      <div class="fmtRows">${rows.map(row).join('')}</div><button type="button" class="btn sm" id="fmtAdd" style="margin-top:10px">Add a format</button>`,
    onSubmit: async () => {
      const list = $$('.fmtRow', el).map((r, i) => {
        const v = n => $(`[name=${n}]`, r); const old = rows[i];
        const label = v('label').value.trim(); if (!label) return null;
        const key = old?.key || label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 30);
        return { key, label, linkedin_type: v('linkedin_type').value, orientation: v('linkedin_type').value === 'document' ? v('orientation').value : 'any', how_to: v('how_to').value.trim() || null, active: v('active').checked, sort: (i + 1) * 10, updated_at: new Date().toISOString() };
      }).filter(Boolean);
      const docs = list.filter(f => f.active && f.linkedin_type === 'document');
      const clash = docs.find((a, i) => docs.some((b, j) => j > i && (a.orientation === b.orientation || a.orientation === 'any' || b.orientation === 'any' || (a.orientation === 'portrait_or_square' && b.orientation !== 'landscape') || (b.orientation === 'portrait_or_square' && a.orientation !== 'landscape'))));
      if (clash) { toast(`Two document formats overlap in shape (${clash.label}); the scraper couldn't tell them apart`); return false; }
      if (fail(await sb.from('post_formats').upsert(list, { onConflict: 'key' }), 'Save formats')) return false;
      await loadFormats(true); toast('Formats saved'); onDone?.();
    },
  });
  $('#fmtAdd', el).onclick = () => { const i = $$('.fmtRow', el).length; rows.push({}); $('.fmtRows', el).insertAdjacentHTML('beforeend', row({}, i)); };
  if (state.role !== 'admin') $$('input,select,#fmtAdd', el).forEach(x => { x.disabled = true; });
}
