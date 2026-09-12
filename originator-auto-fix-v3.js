(function(){
  if(window.__outerhavenAutoFixV3)return;window.__outerhavenAutoFixV3=true;
  const sb=window.__OUTERHAVEN_ORIGINATOR_SB,M=window.OuterHavenMatcher;if(!sb||!M)return;
  const $=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  const norm=v=>String(v||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  const money=v=>{const n=Number(v||0);if(!n)return'Not provided';if(n>=1e9)return'$'+(n/1e9).toFixed(n%1e9?1:0)+'B';if(n>=1e6)return'$'+(n/1e6).toFixed(n%1e6?1:0)+'M';if(n>=1e3)return'$'+(n/1e3).toFixed(n%1e3?1:0)+'K';return'$'+n.toLocaleString()};
  let snapshot=null,loading=false;

  function styles(){if($('autoFixV3Style'))return;const s=document.createElement('style');s.id='autoFixV3Style';s.textContent=`
    .afx{margin:0 0 16px;border:1px solid #d9cbbd;border-radius:16px;background:#fff;overflow:hidden}.afxHead{display:grid;grid-template-columns:1.35fr .65fr;background:#f7f2eb}.afxIntro{padding:20px}.afxIntro .eyebrow{font-size:8px}.afxIntro h3{margin:5px 0 7px;font:600 23px/1.12 "Segoe UI Variable","Helvetica Neue",Arial,sans-serif;letter-spacing:-.02em;color:#201b17}.afxIntro p{margin:0;font:10px/1.6 "Segoe UI Variable","Helvetica Neue",Arial,sans-serif;color:#6e6257}.afxDecision{padding:20px;background:#1e1a17;color:#fff}.afxDecision span{display:block;font:800 7px/1.2 "Segoe UI Variable",sans-serif;letter-spacing:.12em;text-transform:uppercase;color:#bba88e}.afxDecision strong{display:block;margin:7px 0;font:600 18px/1.22 "Segoe UI Variable",sans-serif}.afxDecision small{font:9px/1.5 "Segoe UI Variable",sans-serif;color:#d6c9ba}.afxIssues{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;padding:14px}.afxIssue{border:1px solid #e5ddd4;border-radius:12px;padding:14px;background:#fff}.afxBadge{display:inline-block;margin-bottom:8px;padding:4px 6px;border-radius:999px;background:#f4ebe0;color:#725d45;font:800 6.5px/1 "Segoe UI Variable",sans-serif;letter-spacing:.08em;text-transform:uppercase}.afxBadge.input{background:#f5e5df;color:#8b4e3b}.afxIssue h4{margin:0 0 7px;font:700 11px/1.35 "Segoe UI Variable",sans-serif;color:#29221d}.afxIssue p{margin:0 0 11px;font:9px/1.5 "Segoe UI Variable",sans-serif;color:#70645a}.afxIssue button,.afxMaster button{border:0;border-radius:9px;cursor:pointer;font:800 9px/1 "Segoe UI Variable",sans-serif}.afxIssue button{width:100%;padding:9px 10px;background:#231e19;color:#fff}.afxIssue button.secondary{background:#f1e9df;color:#2b241e}.afxIssue button[disabled],.afxMaster button[disabled]{opacity:.55;cursor:not-allowed}.afxMaster{margin:0 14px 14px;padding:18px;border-radius:13px;background:linear-gradient(135deg,#1a1714,#2d261f);color:#fff;display:grid;grid-template-columns:1fr auto;gap:18px;align-items:center}.afxMaster .kicker{font:800 7px/1 "Segoe UI Variable",sans-serif;letter-spacing:.12em;text-transform:uppercase;color:#cdb797}.afxMaster h3{margin:5px 0 6px;font:600 20px/1.18 "Segoe UI Variable",sans-serif}.afxMaster p{margin:0;max-width:790px;font:9px/1.55 "Segoe UI Variable",sans-serif;color:#d5c8b8}.afxMaster button{padding:12px 15px;background:#f0e2cf;color:#211a15;min-width:185px}.afxToast{position:fixed;right:22px;bottom:22px;z-index:99999;max-width:360px;padding:12px 14px;border-radius:10px;background:#211c17;color:#fff;box-shadow:0 14px 40px rgba(0,0,0,.25);font:9px/1.5 "Segoe UI Variable",sans-serif}.afxOutcome{margin:0 0 10px;padding:9px 10px;border-radius:9px;background:#f6f1ea;color:#5d5146;font:8.7px/1.45 "Segoe UI Variable",sans-serif}.afxTask{margin:12px 16px;padding:14px;border-radius:11px;background:#f7f3ed;border:1px solid #e2d7cb;font:9px/1.55 "Segoe UI Variable",sans-serif;color:#5f554b}.afxTask strong{color:#2a231e}.afxTask ul{margin:8px 0 0;padding-left:18px}.afxTask li{margin:3px 0}@media(max-width:900px){.afxHead{grid-template-columns:1fr}.afxIssues{grid-template-columns:1fr}.afxMaster{grid-template-columns:1fr}.afxMaster button{width:100%}}
  `;document.head.appendChild(s)}

  function docKinds(docs){const n=docs.map(x=>norm(x.name)).join(' ');return{core:/cim|memorandum|teaser|deck|one pager/.test(n),financial:/financial|model|forecast|budget|statement/.test(n),ownership:/cap table|ownership|org chart|corporate/.test(n)}}
  function issue(kind,title,why,action,fixable=true){return{kind,title,why,action,fixable}}
  function diagnose(d,docs,rank){
    const k=docKinds(docs),isRE=M.sectorFamilies(d.sector).has('real_estate'),out=[];
    if(!d.authority_confirmed)out.push(issue('authority','Seller-side authority still needs confirmation','The software cannot truthfully certify a relationship that only the originator can confirm.','Confirm your seller / sponsor authority in the deal record.',false));
    if(!d.deal_size||!d.transaction_type)out.push(issue('transaction','Transaction definition is incomplete','The capital ask or structure is not clear enough for reliable matching.','Build a clean transaction definition and sources-and-uses outline.',true));
    if(String(d.summary||'').length<280)out.push(issue('narrative','Investment thesis is underdeveloped','The current narrative does not clearly explain the transaction, why capital is needed and what an investor is underwriting.','Rewrite the opportunity into an institutional-quality transaction narrative.',true));
    if(!k.core)out.push(issue('teaser','No polished investor-facing teaser is available','The data room does not contain a usable teaser/CIM/deck, but the software can generate a first-pass institutional teaser from the structured deal data.','Generate a polished institutional teaser now.',true));
    if(isRE&&(!d.revenue&&!d.ebitda))out.push(issue('property_inputs','Property underwriting inputs are missing','For hospitality / real estate, the software should not invent NOI, occupancy, ADR, RevPAR, LTV or DSCR.','Generate the exact underwriting input request list.',false));
    if(!isRE&&(!d.revenue||!d.ebitda))out.push(issue('financial_inputs','Financial underwriting inputs are incomplete','The software cannot invent financial performance, but it can tell the user exactly what is needed next.','Generate the exact financial information request list.',false));
    if(!k.financial)out.push(issue('model_inputs','No model or forecast detected','A forward view is required to test the capital ask, downside and coverage.','Generate a model / forecast requirements checklist.',false));
    if(!k.ownership)out.push(issue('ownership_inputs','Ownership and capitalization are not documented','Investors need to understand ownership, existing capital and what changes at close.','Generate an ownership / capitalization request list.',false));
    const strong=rank.eligible.filter(x=>x.score>=75);
    if(!strong.length)out.push(issue('targeting','Buyer targeting needs work','No published mandate clears the strong-fit threshold after sector and geography eligibility gates.','Rebuild the buyer strategy around eligible and near-fit capital.',true));
    else if(strong.length<3)out.push(issue('targeting','Buyer coverage is narrow',`Only ${strong.length} published mandate${strong.length===1?'':'s'} currently clears 75%.`,'Build a tighter first-wave and second-wave distribution strategy.',true));
    if(docs.length<2)out.push(issue('dataroom','Data room is too thin',`Only ${docs.length} supporting document${docs.length===1?' is':'s are'} detected.`,'Generate the exact diligence checklist for this transaction.',true));
    let decision='Ready for targeted review',copy='The record clears the basic software screen. The next step is precise investor targeting and controlled distribution.';
    if(!d.authority_confirmed){decision='Needs one manual confirmation';copy='The software can fix the package, but seller/sponsor authority still has to be confirmed by the user.'}
    else if(out.filter(x=>x.fixable).length>=3){decision='Software can clean this up';copy='Several presentation, positioning and process issues can be fixed immediately from the existing deal data.'}
    else if(!strong.length){decision='Needs targeting repair';copy='The software can rebuild the buyer strategy, but may still require more source data to improve fit.'}
    return{issues:out,strong,decision,copy,isRE};
  }

  async function load(){
    const id=$('capitalDealSelect')?.value;if(!id)return null;
    const a=await sb.auth.getSession(),u=a.data.session?.user;if(!u)return null;
    const [dr,br]=await Promise.all([sb.from('deals').select('*').eq('id',id).maybeSingle(),sb.from('buy_boxes').select('*').eq('published',true)]);if(dr.error)throw dr.error;if(br.error)throw br.error;
    const d=dr.data,ls=await sb.storage.from('deal-documents').list(`${u.id}/${id}`,{limit:100}),docs=ls.error?[]:(ls.data||[]).filter(x=>x.name&&x.id),rank=M.rank(d,br.data||[]);
    return{user:u,d,docs,rank,diagnosis:diagnose(d,docs,rank)};
  }
  function toast(t){document.querySelector('.afxToast')?.remove();const n=document.createElement('div');n.className='afxToast';n.textContent=t;document.body.appendChild(n);setTimeout(()=>n.remove(),3200)}

  function buildNarrative(d){
    const original=String(d.summary||'').replace(/\s+/g,' ').trim();
    const base=`${d.company||d.title||'The opportunity'} is a ${d.sector||'private-market'} transaction in ${d.geography||'the stated market'} seeking ${money(d.deal_size)} through ${d.transaction_type||'the proposed transaction structure'}.`;
    const middle=original?` The submitted materials describe the opportunity as follows: ${original}`:'';
    const close=` The investor case should be evaluated around the stated capital requirement, transaction structure, operating / asset fundamentals, seller or sponsor authority, and the ability of the current diligence package to support the claims made to capital providers.`;
    return (base+middle+close).slice(0,2200);
  }
  function inputList(kind,d){
    const re=M.sectorFamilies(d.sector).has('real_estate');
    const lists={
      property_inputs:['Current asset value / purchase price','Current and stabilized NOI','Occupancy','ADR and RevPAR where relevant','Existing debt and debt service','Sponsor equity already invested and new equity contribution','Acquisition / development budget','Sources and uses','LTV / LTC assumptions','DSCR or debt-yield assumptions'],
      financial_inputs:['Last 3 years revenue and EBITDA','Latest YTD financials','Normalized EBITDA bridge','Working-capital profile','Existing debt schedule','Forecast / budget','Use of proceeds','Cash-flow available for debt service'],
      model_inputs:re?['Monthly / annual operating forecast','Occupancy and rate assumptions','NOI bridge','Capex / development schedule','Debt schedule','Exit / stabilization assumptions','Sensitivity cases']:['3-5 year operating forecast','Revenue build','Gross margin / EBITDA bridge','Working capital','Capex','Debt schedule','Cash-flow forecast','Base / upside / downside cases'],
      ownership_inputs:['Current cap table / ownership schedule','Legal entity chart','Existing preferred / debt securities','Sponsor / shareholder contributions','Pre- and post-transaction ownership','Any control, consent or transfer restrictions'],
      dataroom:['Current teaser / CIM / deck','Historical financials','Forecast / model','Ownership / capitalization','Debt schedule','Material contracts','Key legal / corporate documents','Transaction-specific diligence materials']
    };
    return lists[kind]||[];
  }
  function showTask(title,items){
    const out=$('capitalOutput'),body=$('capitalOutputBody'),head=$('capitalOutputTitle');if(!out||!body)return;
    out.classList.remove('hidden');if(head)head.textContent=title;body.innerHTML=`<div class="afxTask"><strong>${esc(title)}</strong><div style="margin-top:4px">The software will not fabricate missing source data. Add these inputs and rerun the analysis:</div><ul>${items.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div>`;out.scrollIntoView({behavior:'smooth',block:'start'});
  }
  async function saveSummary(){const d=snapshot?.d;if(!d)return false;const summary=buildNarrative(d);const {error}=await sb.from('deals').update({summary,updated_at:new Date().toISOString()}).eq('id',d.id);if(error)throw error;return true}
  function renderDoc(type){if(window.OuterHavenCapitalDocsV4?.render){window.OuterHavenCapitalDocsV4.render(type);return true}const btn=document.querySelector(`[data-cap-generate="${type}"]`);if(btn){btn.click();return true}return false}

  async function fix(kind,btn){
    if(!snapshot)return;if(btn)btn.disabled=true;
    try{
      if(kind==='narrative'){await saveSummary();toast('Narrative rebuilt and saved to the deal.');await refresh();return}
      if(kind==='teaser'){if(String(snapshot.d.summary||'').length<280)await saveSummary();toast('Generating a cleaner institutional teaser from the deal data.');await refresh();renderDoc('institutional_package');return}
      if(kind==='targeting'){toast('Rebuilding the buyer strategy using only eligible mandates.');renderDoc('mandate_strategy');return}
      if(kind==='transaction'){toast('Building the transaction and capital-structure repair plan.');renderDoc('capital_stack_review');return}
      if(kind==='dataroom'){showTask('Institutional Data Room Checklist',inputList('dataroom',snapshot.d));return}
      if(['property_inputs','financial_inputs','model_inputs','ownership_inputs'].includes(kind)){showTask('Required Inputs',inputList(kind,snapshot.d));return}
      if(kind==='authority'){showTask('Manual Confirmation Required',['Confirm your relationship to the seller / sponsor','Confirm you are authorized to submit this opportunity','Upload or retain supporting authority documentation where appropriate']);return}
    }catch(e){console.error('auto fix',e);toast(e?.message||'Could not apply this fix.')}finally{if(btn)btn.disabled=false}
  }
  async function fixAll(btn){if(!snapshot)return;if(btn)btn.disabled=true;try{const canRewrite=String(snapshot.d.summary||'').length<280;if(canRewrite)await saveSummary();toast('Software fixes applied. Building the cleaned institutional teaser now.');await refresh();renderDoc('institutional_package')}catch(e){toast(e?.message||'Could not complete the automatic cleanup.')}finally{if(btn)btn.disabled=false}}

  function patchProducts(){
    const map={'Institutional Package':'Generate a cleaner investor-facing teaser / brief from the structured deal data.','Diligence Audit':'Turn missing diligence into an exact action list instead of a generic score.','Mandate Strategy':'Use hard eligibility gates, then build a first-wave and second-wave capital plan.','Capital Stack Review':'Frame the transaction structure and expose the inputs still required to size it responsibly.','Managed Capital Readiness':'Run the software cleanup across the entire deal.'};
    document.querySelectorAll('#capitalProducts .capitalProduct').forEach(card=>{const title=card.querySelector('h3')?.textContent?.trim(),copy=map[title];if(!copy)return;let o=card.querySelector('.afxOutcome');if(!o){o=document.createElement('div');o.className='afxOutcome';const p=card.querySelector('p');if(p)p.after(o);else card.appendChild(o)}o.innerHTML=`<strong>Software outcome:</strong> ${copy}`;if(title==='Managed Capital Readiness'){const h=card.querySelector('h3');if(h)h.textContent='Deal Auto-Fix';const b=card.querySelector('[data-cap-request="managed_capital_readiness"]');if(b){b.textContent='Auto-fix this deal';b.dataset.afxAll='1'}}});
  }
  function render(){
    const products=$('capitalProducts');if(!products||!snapshot)return;let p=$('dfyValuePanel');if(!p){p=document.createElement('div');p.id='dfyValuePanel';products.parentNode.insertBefore(p,products)}p.className='afx';const dx=snapshot.diagnosis,top=dx.issues.slice(0,3);
    p.innerHTML=`<div class="afxHead"><div class="afxIntro"><div class="eyebrow">SOFTWARE REPAIR CENTER</div><h3>${esc(top.length?`${top.length} priority issue${top.length===1?'':'s'} to repair first`:'No obvious software-screening blocker')}</h3><p>${esc(top.length?'The software will fix presentation, narrative, targeting and process issues automatically. It will never invent financials, authority or ownership data.':'The record clears the current software screen. You can still regenerate the teaser, mandate strategy and capital structure outputs.')}</p></div><div class="afxDecision"><span>Current decision</span><strong>${esc(dx.decision)}</strong><small>${esc(dx.copy)}</small></div></div><div class="afxIssues">${top.length?top.map(x=>`<article class="afxIssue"><span class="afxBadge ${x.fixable?'':'input'}">${x.fixable?'Software fix':'Needs source input'}</span><h4>${esc(x.title)}</h4><p><strong>Why it matters:</strong> ${esc(x.why)}<br><br><strong>Next action:</strong> ${esc(x.action)}</p><button type="button" class="${x.fixable?'':'secondary'}" data-afx-kind="${esc(x.kind)}">${x.fixable?'Fix with software':'Show required inputs'}</button></article>`).join(''):'<div style="grid-column:1/-1;padding:16px;font:9px/1.5 Segoe UI,sans-serif;color:#74685e">No major blocker is visible. Use the outputs below to regenerate the deal package.</div>'}</div><div class="afxMaster"><div><div class="kicker">ONE-CLICK CLEANUP</div><h3>Auto-fix everything the software can safely fix.</h3><p>This rewrites the transaction narrative where needed, applies the stricter mandate logic, rebuilds the institutional teaser and surfaces any remaining items that require real source data instead of fabricating them.</p></div><button type="button" data-afx-all="1">Auto-fix this deal</button></div>`;
    patchProducts();
  }
  async function refresh(){if(loading)return;loading=true;try{snapshot=await load();if(snapshot)render()}catch(e){console.error('auto fix refresh',e)}finally{loading=false}}
  function init(){styles();const select=$('capitalDealSelect'),products=$('capitalProducts');if(!select||!products){setTimeout(init,250);return}refresh();setTimeout(patchProducts,350);setTimeout(patchProducts,900);select.addEventListener('change',()=>setTimeout(refresh,100));$('capitalRefresh')?.addEventListener('click',()=>setTimeout(refresh,180))}
  document.addEventListener('click',e=>{const one=e.target.closest('[data-afx-kind]');if(one){e.preventDefault();e.stopImmediatePropagation();fix(one.dataset.afxKind,one);return}const all=e.target.closest('[data-afx-all]');if(all){e.preventDefault();e.stopImmediatePropagation();fixAll(all);return}const legacy=e.target.closest('[data-cap-request="managed_capital_readiness"]');if(legacy){e.preventDefault();e.stopImmediatePropagation();fixAll(legacy);return}if(e.target.closest('.navBtn[data-section="capital"]'))setTimeout(refresh,160)},true);
  init();
})();