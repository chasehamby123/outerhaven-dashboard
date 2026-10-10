// Reason kinds for the signal tabs (Fund / Credit / BDC / UCC) and the Rules page.
// The rules on the server tag a reason 'good' whenever it raises the score, and that lumps two different
// things together: why the company NEEDS us (a deadline) and why it will be HARD TO FINANCE (distress).
// Green on "going concern" reads as "good credit" to a lender like Peter, so every reason is shown with a
// label and a symbol, never colour alone (red-green colour-blind safe):
//   ▲ Need  = a trigger: why they have to act now (good for us, the reason to call)
//   ⚠ Risk  = distress: makes the loan harder for Peter's lenders to place (still a lead, harder to fulfil)
//   ✓ Fit   = in our range (size, sector, lender type)
//   ? Check = unclear, needs a look before calling
//   ✕ Cut   = ruled out
//   • Info  = context
const RISK = /going.concern|forbearance|losing patience|non-accrual|interest not being paid|in kind|cash is tight|stressed|distress|expects trouble|marked down|defaulted|in default|under pressure|negative ebitda|rescue|restructur|refinancing gap|tax lien|labor-department lien|judgment lien|cash strain|merchant cash advance|stacking|stacked|hides the lender|factor|risky credit|highly levered|covered [01]\.\dx|slightly below par/i;
const NEED = /matur|due within|must refinance|has to refinance|refinancing window|lapses|next.fund|window|raising|still outstanding/i;

export const KINDS = {
  need: { sym: '▲', label: 'Need', tip: 'Why they have to act now: the reason to call' },
  risk: { sym: '⚠', label: 'Risk', tip: 'Distress: harder for Peter\'s lenders to finance' },
  fit: { sym: '✓', label: 'Fit', tip: 'In our range' },
  check: { sym: '?', label: 'Check', tip: 'Unclear: look before calling' },
  cut: { sym: '✕', label: 'Cut', tip: 'Ruled out' },
  info: { sym: '•', label: 'Info', tip: 'Context' },
};

export function kindOf(r) {
  const t = String(r?.text || ''), tone = r?.tone;
  if (tone === 'cut') return 'cut';
  if (tone === 'maybe') return RISK.test(t) ? 'risk' : 'check';
  if (tone === 'info') return /refinancing gap/i.test(t) ? 'risk' : 'info';
  if (RISK.test(t)) return 'risk';
  if (NEED.test(t)) return 'need';
  return tone === 'good' ? 'fit' : 'info';
}

// One reason as a list item: symbol + label chip, then the text. Used by every signal tab.
export const whyItem = (r, esc) => { const k = kindOf(r), K = KINDS[k]; return `<li data-kind="${k}"><span class="rk" title="${esc(K.tip)}"><i aria-hidden="true">${K.sym}</i>${K.label}</span><span>${esc(r.text)}</span></li>`; };

export const kindLegend = () => `<div class="rkLegend" aria-label="What the labels mean">${['need', 'risk', 'fit', 'check', 'cut'].map(k => `<span data-kind="${k}"><span class="rk"><i aria-hidden="true">${KINDS[k].sym}</i>${KINDS[k].label}</span>${KINDS[k].tip}</span>`).join('')}<a href="#/rules">All qualification rules →</a></div>`;
