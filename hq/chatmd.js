// Chat reply renderer: markdown (headings, lists, tables, quotes, code) plus "artifacts" the model writes as fenced blocks:
//   ```chart   {"type":"pie|donut|bar|line","title":"…","unit":"£M","data":[{"label":"…","value":1}]}
//              or {"type":"bar|line","x":["A","B"],"series":[{"name":"…","values":[1,2]}]}
//   ```stats   [{"label":"…","value":"£5M","note":"…"}]
// Nothing from the reply is ever inserted as HTML: text is escaped first, charts are drawn here from numbers only,
// links must be https. Colours are tokens (--viz1…--viz5, validated for colour-blind separation; no orange).
import { esc } from './core.js';

const inline = t => esc(t)
  .replace(/`([^`\n]+)`/g, '<code>$1</code>')
  .replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>')
  .replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s).,;:!?]|$)/g, '$1<i>$2</i>')
  .replace(/\[([^\]\n]+)\]\((https:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
  .replace(/(^|[\s(])(https:\/\/[^\s<)]+)/g, '$1<a href="$2" target="_blank" rel="noopener">$2</a>');

// ---------- number formatting ----------
const fmtNum = n => Math.abs(n) >= 1000 ? Math.round(n).toLocaleString('en-US') : String(+Number(n).toFixed(2));
const fv = (n, unit) => { const m = /^(£|\$|€|US\$|S\$|RM)?(.*)$/.exec(unit || ''), suf = m[2] || ''; return `${m[1] || ''}${fmtNum(n)}${suf && /^[A-Za-z]{3,}/.test(suf) ? ' ' : ''}${suf}`; };
const clip = (s, n) => s.length > n ? s.slice(0, n - 1) + '…' : s;

// ---------- chart spec ----------
function norm(spec) {
  if (!spec || typeof spec !== 'object') return null;
  const type = ['pie', 'donut', 'bar', 'line'].includes(spec.type) ? spec.type : 'bar';
  let x, series;
  if (Array.isArray(spec.data)) { x = spec.data.map(d => String(d?.label ?? '')); series = [{ name: String(spec.title || ''), values: spec.data.map(d => Number(d?.value) || 0) }]; }
  else if (Array.isArray(spec.x) && Array.isArray(spec.series)) { x = spec.x.map(String); series = spec.series.slice(0, 5).map(s => ({ name: String(s?.name ?? ''), values: x.map((_, i) => Number(s?.values?.[i]) || 0) })); }
  else return null;
  if (!x.length || x.length > 40 || !series.length) return null;
  return { type, title: String(spec.title || ''), unit: String(spec.unit || ''), x, series, note: spec.note ? String(spec.note) : '' };
}
const niceStep = raw => { const p = 10 ** Math.floor(Math.log10(raw || 1)), f = raw / p; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p; };
function scale(values, ticks = 4) {
  const lo0 = Math.min(0, ...values), hi0 = Math.max(0, ...values), step = niceStep((hi0 - lo0 || 1) / ticks);
  const lo = Math.floor(lo0 / step) * step, hi = Math.ceil(hi0 / step) * step || step, t = [];
  for (let v = lo; v <= hi + step / 1e6; v += step) t.push(+v.toFixed(10));
  return { lo, hi, ticks: t };
}
const col = i => `var(--viz${(i % 5) + 1})`;
const legend = (items, unit) => `<ul class="czLegend">${items.map(it => `<li><i style="background:${it.color}"></i><span>${esc(it.name)}</span>${it.value != null ? `<b>${esc(fv(it.value, unit))}</b>` : ''}${it.share != null ? `<em>${it.share.toFixed(1)}%</em>` : ''}</li>`).join('')}</ul>`;

// ---------- pie / donut ----------
function pie(c) {
  let rows = c.x.map((l, i) => ({ name: l, value: Math.max(0, c.series[0].values[i]) })).filter(r => r.value > 0).sort((a, b) => b.value - a.value);
  if (rows.length > 6) { const rest = rows.slice(5).reduce((t, r) => t + r.value, 0); rows = [...rows.slice(0, 5), { name: 'Other', value: rest, other: true }]; }
  const total = rows.reduce((t, r) => t + r.value, 0); if (!total) return null;
  const R = 90, r0 = c.type === 'donut' ? 54 : 0, cx = 100, cy = 100, P = (r, a) => [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  let a = -Math.PI / 2;
  const paths = rows.map((r, i) => {
    r.color = r.other ? 'var(--vizOther)' : col(i); r.share = r.value / total * 100;
    const span = Math.min(r.value / total * 2 * Math.PI, 2 * Math.PI - 1e-4), a1 = a + span, big = span > Math.PI ? 1 : 0;
    const [x0, y0] = P(R, a), [x1, y1] = P(R, a1), [x2, y2] = P(r0, a1), [x3, y3] = P(r0, a);
    const d = r0 ? `M${x0} ${y0}A${R} ${R} 0 ${big} 1 ${x1} ${y1}L${x2} ${y2}A${r0} ${r0} 0 ${big} 0 ${x3} ${y3}Z` : `M${cx} ${cy}L${x0} ${y0}A${R} ${R} 0 ${big} 1 ${x1} ${y1}Z`;
    a = a1; return `<path class="czMark" d="${d}" fill="${r.color}" stroke="var(--surface)" stroke-width="2"><title>${esc(r.name)}: ${esc(fv(r.value, c.unit))} (${r.share.toFixed(1)}%)</title></path>`;
  }).join('');
  const mid = r0 ? `<text x="${cx}" y="${cy - 2}" text-anchor="middle" class="czBig">${esc(fv(total, c.unit))}</text><text x="${cx}" y="${cy + 14}" text-anchor="middle" class="czSub">total</text>` : '';
  return { html: `<div class="czPie"><svg viewBox="0 0 200 200" role="img" aria-label="${esc(c.title || 'Pie chart')}">${paths}${mid}</svg>${legend(rows, c.unit)}</div>`, table: { head: ['', c.unit ? `Value (${c.unit})` : 'Value', 'Share'], rows: rows.map(r => [r.name, fmtNum(r.value), r.share.toFixed(1) + '%']) } };
}

// ---------- bar / line ----------
const W = 520;
function barPath(x, y, w, h, up) { // 4px rounded data end, square at the baseline
  const r = Math.max(0, Math.min(4, w / 2, h)); if (h <= 0) return '';
  return up ? `M${x} ${y + h}V${y + r}Q${x} ${y} ${x + r} ${y}H${x + w - r}Q${x + w} ${y} ${x + w} ${y + r}V${y + h}Z` : `M${x} ${y}V${y + h - r}Q${x} ${y + h} ${x + r} ${y + h}H${x + w - r}Q${x + w} ${y + h} ${x + w} ${y + h - r}V${y}Z`;
}
function hbar(c) {
  const s = c.series[0], rows = c.x.map((l, i) => ({ l, v: s.values[i] })), sc = scale(rows.map(r => r.v)), L = 128, Rm = 64, rowH = 28, H = rows.length * rowH + 22, pw = W - L - Rm;
  const X = v => L + (v - sc.lo) / (sc.hi - sc.lo) * pw, z = X(0);
  const grid = sc.ticks.map(t => `<line x1="${X(t)}" x2="${X(t)}" y1="0" y2="${H - 20}" class="czGrid"/><text x="${X(t)}" y="${H - 6}" text-anchor="middle" class="czTick">${esc(fv(t, c.unit))}</text>`).join('');
  const bars = rows.map((r, i) => { const y = i * rowH + 5, w = Math.abs(X(r.v) - z), x = r.v >= 0 ? z : z - w; return `<text x="${L - 8}" y="${y + 11}" text-anchor="end" class="czTick czLab">${esc(clip(r.l, 16))}<title>${esc(r.l)}</title></text><path class="czMark" fill="${col(0)}" d="${r.v >= 0 ? hRound(x, y, w, 16) : hRound(x, y, w, 16, true)}"><title>${esc(r.l)}: ${esc(fv(r.v, c.unit))}</title></path><text x="${r.v >= 0 ? x + w + 6 : x - 6}" y="${y + 12}" text-anchor="${r.v >= 0 ? 'start' : 'end'}" class="czVal">${esc(fv(r.v, c.unit))}</text>`; }).join('');
  return { html: `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(c.title || 'Bar chart')}">${grid}<line x1="${z}" x2="${z}" y1="0" y2="${H - 20}" class="czAxis"/>${bars}</svg>` };
}
function hRound(x, y, w, h, left) { const r = Math.max(0, Math.min(4, h / 2, w)); if (w <= 0) return ''; return left ? `M${x + w} ${y}H${x + r}Q${x} ${y} ${x} ${y + r}V${y + h - r}Q${x} ${y + h} ${x + r} ${y + h}H${x + w}Z` : `M${x} ${y}H${x + w - r}Q${x + w} ${y} ${x + w} ${y + r}V${y + h - r}Q${x + w} ${y + h} ${x + w - r} ${y + h}H${x}Z`; }
function cartesian(c) {
  const n = c.x.length, all = c.series.flatMap(s => s.values), sc = scale(all), L = 60, Rm = 14, T = 14, B = 38, H = 250, pw = W - L - Rm, ph = H - T - B;
  const Y = v => T + (sc.hi - v) / (sc.hi - sc.lo) * ph, z = Y(0), every = Math.ceil(n / 8);
  const grid = sc.ticks.map(t => `<line x1="${L}" x2="${W - Rm}" y1="${Y(t)}" y2="${Y(t)}" class="${t === 0 ? 'czAxis' : 'czGrid'}"/><text x="${L - 8}" y="${Y(t) + 3.5}" text-anchor="end" class="czTick">${esc(fv(t, c.unit))}</text>`).join('');
  let marks = '', xl = '';
  if (c.type === 'line') {
    const px = i => L + (n === 1 ? pw / 2 : i / (n - 1) * pw);
    xl = c.x.map((l, i) => i % every ? '' : `<text x="${px(i)}" y="${H - 14}" text-anchor="middle" class="czTick">${esc(clip(l, 8))}<title>${esc(l)}</title></text>`).join('');
    marks = c.series.map((s, k) => `<polyline points="${s.values.map((v, i) => `${px(i)},${Y(v)}`).join(' ')}" fill="none" stroke="${col(k)}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>${s.values.map((v, i) => `<circle class="czMark" cx="${px(i)}" cy="${Y(v)}" r="3.5" fill="${col(k)}" stroke="var(--surface)" stroke-width="2"><title>${esc(c.x[i])}${s.name ? ' · ' + esc(s.name) : ''}: ${esc(fv(v, c.unit))}</title></circle>`).join('')}`).join('');
  } else {
    const gw = pw / n, k = c.series.length, bw = Math.min(46, gw * 0.7 / k), used = bw * k + (k - 1) * 2;
    xl = c.x.map((l, i) => i % every ? '' : `<text x="${L + gw * i + gw / 2}" y="${H - 14}" text-anchor="middle" class="czTick">${esc(clip(l, Math.max(5, Math.floor(gw / 8))))}<title>${esc(l)}</title></text>`).join('');
    marks = c.series.map((s, si) => s.values.map((v, i) => {
      const x = L + gw * i + (gw - used) / 2 + si * (bw + 2), y = v >= 0 ? Y(v) : z, h = Math.abs(Y(v) - z);
      return `<path class="czMark" fill="${col(si)}" d="${barPath(x, y, bw, h, v >= 0)}"><title>${esc(c.x[i])}${s.name ? ' · ' + esc(s.name) : ''}: ${esc(fv(v, c.unit))}</title></path>${k === 1 && n <= 8 ? `<text x="${x + bw / 2}" y="${v >= 0 ? y - 5 : y + h + 12}" text-anchor="middle" class="czVal">${esc(fv(v, c.unit))}</text>` : ''}`;
    }).join('')).join('');
  }
  const lg = c.series.length > 1 ? legend(c.series.map((s, i) => ({ name: s.name || `Series ${i + 1}`, color: col(i) })), c.unit) : '';
  return { html: `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(c.title || 'Chart')}">${grid}${xl}${marks}</svg>${lg}` };
}

function chartCard(raw) {
  let spec; try { spec = norm(JSON.parse(raw)); } catch { spec = null; }
  if (!spec) return `<pre class="mdCode">${esc(raw)}</pre>`;
  const horizontal = spec.type === 'bar' && spec.series.length === 1 && (spec.x.length > 6 || spec.x.some(l => l.length > 12));
  const out = spec.type === 'pie' || spec.type === 'donut' ? pie(spec) : horizontal ? hbar(spec) : cartesian(spec);
  if (!out) return `<pre class="mdCode">${esc(raw)}</pre>`;
  const t = out.table || { head: ['', ...spec.series.map(s => s.name || (spec.unit ? `Value (${spec.unit})` : 'Value'))], rows: spec.x.map((l, i) => [l, ...spec.series.map(s => fmtNum(s.values[i]))]) };
  const table = `<table><thead><tr>${t.head.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${t.rows.map(r => `<tr>${r.map((v, i) => i ? `<td class="n">${esc(v)}</td>` : `<th>${esc(v)}</th>`).join('')}</tr>`).join('')}</tbody></table>`;
  return `<figure class="cz"><figcaption><b>${esc(spec.title || 'Chart')}</b><span class="czTools"><button type="button" data-cz-view aria-pressed="false" title="Show the numbers">Table</button><button type="button" data-cz-open title="Expand" aria-label="Expand chart"><svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M10 2h4v4M6 14H2v-4M14 2l-5 5M2 14l5-5"/></svg></button></span></figcaption><div class="czChart">${out.html}</div><div class="czTable" hidden>${table}</div>${spec.note ? `<div class="czNote">${esc(spec.note)}</div>` : ''}</figure>`;
}
function statsCard(raw) {
  let a; try { a = JSON.parse(raw); } catch { a = null; }
  if (!Array.isArray(a) || !a.length) return `<pre class="mdCode">${esc(raw)}</pre>`;
  return `<div class="czStats">${a.slice(0, 6).map(s => `<div><small>${esc(s?.label ?? '')}</small><b>${esc(s?.value ?? '')}</b>${s?.note ? `<span>${esc(s.note)}</span>` : ''}</div>`).join('')}</div>`;
}

// ---------- markdown ----------
const cells = line => line.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());
const isSep = l => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(l) && l.includes('-');
export function rich(text) {
  const lines = String(text || '').replace(/\r/g, '').split('\n'), out = [];
  for (let i = 0; i < lines.length;) {
    const l = lines[i];
    const fence = /^\s*```\s*([\w-]*)\s*$/.exec(l);
    if (fence) { const body = []; i++; while (i < lines.length && !/^\s*```\s*$/.test(lines[i])) body.push(lines[i++]); i++; const raw = body.join('\n'), lang = fence[1].toLowerCase(); out.push(lang === 'chart' ? chartCard(raw) : lang === 'stats' ? statsCard(raw) : `<pre class="mdCode">${esc(raw)}</pre>`); continue; }
    if (!l.trim()) { i++; continue; }
    const h = /^(#{1,4})\s+(.+)$/.exec(l); if (h) { out.push(`<h${Math.min(6, h[1].length + 2)} class="mdH">${inline(h[2])}</h${Math.min(6, h[1].length + 2)}>`); i++; continue; }
    if (/^\s*([-*_])\1{2,}\s*$/.test(l)) { out.push('<hr>'); i++; continue; }
    if (l.includes('|') && i + 1 < lines.length && isSep(lines[i + 1])) {
      const head = cells(l), rows = []; i += 2; while (i < lines.length && lines[i].includes('|') && lines[i].trim()) rows.push(cells(lines[i++]));
      out.push(`<div class="mdTable"><table><thead><tr>${head.map(c => `<th>${inline(c)}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${head.map((_, k) => `<td>${inline(r[k] ?? '')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`); continue;
    }
    if (/^\s*>\s?/.test(l)) { const q = []; while (i < lines.length && /^\s*>\s?/.test(lines[i])) q.push(lines[i++].replace(/^\s*>\s?/, '')); out.push(`<blockquote>${q.map(inline).join('<br>')}</blockquote>`); continue; }
    const li = /^(\s*)([-*•]|\d+[.)])\s+(.*)$/.exec(l);
    if (li) {
      const ordered = /\d/.test(li[2]), items = [];
      while (i < lines.length) { const m = /^(\s*)([-*•]|\d+[.)])\s+(.*)$/.exec(lines[i]); if (m && /\d/.test(m[2]) === ordered) { items.push(m[3]); i++; } else if (items.length && /^\s{2,}\S/.test(lines[i]) && !/^\s*([-*•]|\d+[.)])\s/.test(lines[i])) items[items.length - 1] += ' ' + lines[i++].trim(); else break; }
      out.push(`<${ordered ? 'ol' : 'ul'} class="mdList">${items.map(x => `<li>${inline(x)}</li>`).join('')}</${ordered ? 'ol' : 'ul'}>`); continue;
    }
    const p = []; while (i < lines.length && lines[i].trim() && !/^\s*(```|#{1,4}\s|>|([-*•]|\d+[.)])\s)/.test(lines[i]) && !(lines[i].includes('|') && i + 1 < lines.length && isSep(lines[i + 1]))) p.push(lines[i++]);
    if (!p.length) { out.push(`<p>${inline(lines[i++])}</p>`); continue; }
    out.push(`<p>${p.map(inline).join('<br>')}</p>`);
  }
  return out.join('');
}
