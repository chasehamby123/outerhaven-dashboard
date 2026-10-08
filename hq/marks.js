// Stars and flags on signal rows (fund, credit, UCC). Shared across the team: the row stores who starred / flagged it.
// Star = "worth pursuing, look at this". Flag = "something's off" (wrong data, needs a second look), with a short note.
import { sb, esc, $$, toast, fail, modal, firstName, state } from './core.js';
import { me } from './tasks.js';

const who = () => firstName(me() || state.user?.email?.split('@')[0] || 'Someone');
const when = v => v ? new Date(v).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '';

export const MARK_VIEWS = [['starred', '★ Starred'], ['flagged', '⚑ Flagged']];
export const inMarkView = (view, s) => view === 'starred' ? !!s.starred_at : view === 'flagged' ? !!s.flagged_at : null;

// Small buttons for a row's action column. ids = every row the mark applies to (fund vehicles share one).
export function markBtns(s) {
  const st = s.starred_at ? `Starred by ${s.starred_by || '?'} ${when(s.starred_at)}. Click to unstar` : 'Star: worth pursuing';
  const fl = s.flagged_at ? `Flagged by ${s.flagged_by || '?'} ${when(s.flagged_at)}${s.flag_note ? `: ${s.flag_note}` : ''}. Click to clear` : 'Flag: something looks off';
  return `<div class="mkBtns"><button type="button" class="mkBtn${s.starred_at ? ' on' : ''}" data-star="${s.id}" title="${esc(st)}" aria-label="${esc(st)}" aria-pressed="${!!s.starred_at}">★</button>`
    + `<button type="button" class="mkBtn flag${s.flagged_at ? ' on' : ''}" data-flag="${s.id}" title="${esc(fl)}" aria-label="${esc(fl)}" aria-pressed="${!!s.flagged_at}">⚑</button></div>`;
}

// Line under the row title when it's marked, so the team sees who and why without hovering.
export function markLine(s) {
  const bits = [];
  if (s.starred_at) bits.push(`<span class="mkTag">★ ${esc(s.starred_by || '')}</span>`);
  if (s.flagged_at) bits.push(`<span class="mkTag flag">⚑ ${esc(s.flagged_by || '')}${s.flag_note ? `: ${esc(s.flag_note)}` : ''}</span>`);
  return bits.length ? `<div class="mkLine">${bits.join('')}</div>` : '';
}

// table: 'fund_signals' | 'credit_signals' | 'ucc_signals'. find(id) → row. idsOf(row) → ids to update. redraw() after.
// rawFind(id) → the stored row to patch (funds group vehicles into one display row, so the two differ).
export function bindMarks(root, { table, find, rawFind = find, idsOf = s => [s.id], redraw }) {
  const apply = async (s, patch) => {
    const ids = idsOf(s);
    if (fail(await sb.from(table).update(patch).in('id', ids), 'Save')) return false;
    for (const id of ids) { const r = rawFind(id); if (r) Object.assign(r, patch); }
    Object.assign(s, patch); redraw(); return true;
  };
  $$('[data-star]', root).forEach(b => b.onclick = async e => {
    e.stopPropagation();
    const s = find(b.dataset.star); if (!s) return;
    const on = !s.starred_at;
    if (await apply(s, on ? { starred_at: new Date().toISOString(), starred_by: who() } : { starred_at: null, starred_by: null })) toast(on ? 'Starred' : 'Unstarred');
  });
  $$('[data-flag]', root).forEach(b => b.onclick = e => {
    e.stopPropagation();
    const s = find(b.dataset.flag); if (!s) return;
    if (s.flagged_at) { apply(s, { flagged_at: null, flagged_by: null, flag_note: null }).then(ok => ok && toast('Flag cleared')); return; }
    modal({
      title: 'Flag this row', submit: 'Flag',
      body: `<label class="field">What's off? (optional)<input class="input" name="note" maxlength="200" placeholder="e.g. wrong size, already talking to them, check the numbers"></label>`,
      onSubmit: async fd => apply(s, { flagged_at: new Date().toISOString(), flagged_by: who(), flag_note: String(fd.get('note') || '').trim() || null }),
    });
  });
}
