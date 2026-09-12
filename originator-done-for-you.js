(function(){
  if(window.__outerhavenDoneForYou)return;window.__outerhavenDoneForYou=true;
  const sb=window.__OUTERHAVEN_ORIGINATOR_SB,M=window.OuterHavenMatcher;if(!sb||!M)return;
  const $=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  const norm=v=>String(v||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  const money=v=>{const n=Number(v||0);if(!n)return'Not provided';if(n>=1e9)return'$'+(n/1e9).toFixed(n%1e9?1:0)+'B';if(n>=1e6)return'$'+(n/1e6).toFixed(n%1e6?1:0)+'M';if(n>=1e3)return'$'+(n/1e3).toFixed(n%1e3?1:0)+'K';return'$'+n.toLocaleString()};
  let snapshot=null,loading=false;

  function installStyles(){
    if($('dfyLayerStyle'))return;
    const s=document.createElement('style');s.id='dfyLayerStyle';s.textContent=`
      .dfyPanel{margin:0 0 16px;border:1px solid #d7c6b3;border-radius:15px;background:#fffdf9;overflow:hidden}.dfyPanelTop{display:grid;grid-template-columns:1.25fr .75fr;gap:1px;background:#e1d4c5}.dfyDiagnosis{background:#fffdf9;padding:18px}.dfyDiagnosis .eyebrow{font-size:8px}.dfyDiagnosis h3{font:500 23px/1.15 Georgia,serif;margin:5px 0 7px;color:#261f19}.dfyDiagnosis p{font-size:10px;line-height:1.55;color:#6d6155;margin:0}.dfyDecision{background:#211c17;color:#fff;padding:18px}.dfyDecision span{display:block;font-size:7px;text-transform:uppercase;letter-spacing:.1em;color:#b9a68f;font-weight:900}.dfyDecision strong{display:block;font:500 19px/1.2 Georgia,serif;margin:6px 0;color:#fff}.dfyDecision small{font-size:8.5px;line-height:1.5;color:#d8cbbd}.dfyBlockers{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;padding:14px}.dfyBlocker{border:1px solid #e3d8cb;border-radius:11px;padding:13px;background:#fff}.dfyBlockerTop{display:flex;justify-content:space-between;gap:8px;align-items:start}.dfyBlocker h4{font-size:10.5px;line-height:1.3;margin:0;color:#2a231e}.dfyImpact{font-size:6.5px;padding:4px 6px;border-radius:999px;text-transform:uppercase;letter-spacing:.07em;font-weight:900;white-space:nowrap}.dfyImpact.high{background:#f4e4de;color:#874734}.dfyImpact.med{background:#f3ecd9;color:#756037}.dfyImpact.low{background:#e8eee5;color:#3f5a3d}.dfyBlocker p{font-size:8.7px;line-height:1.45;color:#70645a;margin:7px 0 10px}.dfyFixBtn,.dfyMasterBtn{border:0;border-radius:9px;font:850 9px/1 Inter,system-ui;cursor:pointer}.dfyFixBtn{padding:8px 9px;background:#f3ece3;color:#302820;width:100%}.dfyFixBtn:hover{background:#eadfD2}.dfyMaster{margin:0 14px 14px;padding:17px;border-radius:12px;background:linear-gradient(135deg,#171411,#2b241e);color:#fff;display:grid;grid-template-columns:1fr auto;gap:18px;align-items:center}.dfyMaster .kicker{font-size:7px;text-transform:uppercase;letter-spacing:.11em;color:#cdb596;font-weight:900}.dfyMaster h3{font:500 21px/1.15 Georgia,serif;margin:5px 0}.dfyMaster p{font-size:9px;line-height:1.55;color:#d7cab9;margin:0;max-width:760px}.dfyMasterBtn{padding:12px 15px;background:#f2e5d2;color:#241d17;min-width:155px}.dfyMasterBtn[disabled],.dfyFixBtn[disabled]{opacity:.55;cursor:not-allowed}.dfyStatus{font-size:8px;color:#a99176;margin-top:7px}.dfyToast{position:fixed;right:22px;bottom:22px;z-index:99999;max-width:340px;background:#211c17;color:#fff;padding:12px 14px;border-radius:10px;box-shadow:0 14px 40px rgba(0,0,0,.25);font-size:9px;line-height:1.5}.dfyProductOutcome{margin:0 0 10px;padding:8px 9px;border-radius:8px;background:#f4eee6;color:#5e5145;font-size:8.5px;line-height:1.45}.dfyProductOutcome strong{color:#2f271f}.dfyOutputCta{margin:12px 16px;padding:13px 14px;border-radius:11px;background:#211c17;color:#fff;display:flex;justify-content:space-between;gap:14px;align-items:center}.dfyOutputCta strong{display:block;font-size:10px}.dfyOutputCta span{display:block;font-size:8px;color:#d2c4b4;margin-top:3px}.dfyPrintDecision{border:1px solid #ddcfbf;border-radius:11px;padding:14px;margin-bottom:22px;background:#fbf7f1}.dfyPrintDecision h3{margin:0 0 5px;font:500 17px/1.2 Georgia,serif}.dfyPrintDecision p{margin:0;font-size:9px;line-height:1.55;color:#62574d}.dfyPrintDecision ul{margin:9px 0 0;padding-left:17px}.dfyPrintDecision li{font-size:8.7px;line-height:1.45;color:#655a50;margin:3px 0}.dfyEmpty{padding:17px;font-size:9px;color:#74685e}
      @media(max-width:900px){.dfyPanelTop{grid-template-columns:1fr}.dfyBlockers{grid-template-columns:1fr}.dfyMaster{grid-template-columns:1fr}.dfyMasterBtn{width:100%}}@media print{.dfyOutputCta{display:none!important}.dfyPrintDecision{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
    `;document.head.appendChild(s);
  }

  function docKinds(docs){const n=docs.map(x=>norm(x.name)).join(' ');return{cim:/cim|memorandum|teaser|deck|one pager/.test(n),financial:/financial|model|forecast|budget|statement/.test(n),qoe:/qoe|quality of earnings|audit/.test(n),ownership:/cap table|ownership|org chart|corporate/.test(n)}}
  function blocker(title,why,fix,service,impact='high'){return{title,why,fix,service,impact}}

  function diagnose(d,docs,rank){
    const k=docKinds(docs),isRE=M.sectorFamilies(d.sector).has('real_estate'),b=[];
    if(!d.authority_confirmed)b.push(blocker('Seller-side authority is not cleared','Without confirmed seller or sponsor authority, institutional distribution creates process and credibility risk.','OuterHaven verifies the relationship, identifies what evidence is needed, and clears the opportunity for controlled review.','managed_capital_readiness','high'));
    if(!d.deal_size||!d.transaction_type)b.push(blocker('Transaction definition is incomplete','Capital cannot be matched or structured reliably without a clear ask and transaction structure.','OuterHaven rebuilds the transaction definition, sources-and-uses logic, and investor-facing ask.','capital_stack_review','high'));
    if(isRE){
      if(!d.revenue&&!d.ebitda)b.push(blocker('Property underwriting is too thin','A real-estate or hospitality opportunity needs operating/property economics before serious capital screening.','OuterHaven creates the underwriting request list and rebuilds the capital case around NOI, occupancy, ADR/RevPAR, LTV, DSCR and sponsor equity where applicable.','capital_stack_review','high'));
    }else if(!d.revenue||!d.ebitda)b.push(blocker('Financial underwriting is incomplete','Revenue and EBITDA are not both available, so investors cannot quickly test scale, margins or debt capacity.','OuterHaven identifies the missing financials, reconciles periods and builds the investor-facing financial snapshot.','diligence_audit','high'));
    if(!k.cim)b.push(blocker('No current investor-facing core document','The data room does not show a CIM, teaser, deck or one-pager that can carry the transaction narrative.','OuterHaven restructures the story into an institutional brief and identifies what must be supported before release.','institutional_package','high'));
    if(!k.financial)b.push(blocker('No financial model or forecast detected','Without a model or forecast, investors cannot test the capital ask against operating performance or downside cases.','OuterHaven creates the exact financial request list, reconciles the available numbers and prepares the model requirements.','diligence_audit','med'));
    if(!k.ownership)b.push(blocker('Ownership / capitalization is not documented','Capital providers need to understand who owns the asset/company, existing capital and what changes at close.','OuterHaven builds the ownership/capitalization request list and adds it to the transaction package.','diligence_audit','med'));
    if(String(d.summary||'').length<250)b.push(blocker('The investment thesis is underdeveloped','The current summary does not yet explain why the deal wins, what capital changes, and what an investor is underwriting.','OuterHaven rewrites the opportunity into a concise institutional thesis with transaction rationale, merits and risks.','institutional_package','high'));
    const strong=rank.eligible.filter(x=>x.score>=75);
    if(!strong.length)b.push(blocker('No strong published mandate fit','Even after eligibility gates, no published mandate currently reaches a strong-fit score. Sending broadly would create noise.','OuterHaven reviews the structure, target universe and positioning, then builds a tighter distribution strategy.','mandate_strategy','high'));
    else if(strong.length<3)b.push(blocker('Buyer coverage is narrow',`Only ${strong.length} published mandate${strong.length===1?'':'s'} currently clears 75%. The opportunity may need better structure or wider relationship sourcing.`,'OuterHaven reviews the near-fit set, validates exceptions and builds the first controlled distribution wave.','mandate_strategy','med'));
    if(docs.length<2)b.push(blocker('The data room is too thin',`Only ${docs.length} supporting document${docs.length===1?' is':'s are'} detected. Institutional review will stall quickly.`,'OuterHaven gives you the exact document request list and organizes the package around what capital actually needs.','diligence_audit','high'));
    const severity={high:3,med:2,low:1};b.sort((a,z)=>severity[z.impact]-severity[a.impact]);
    let decision='Ready for targeted human review',decisionCopy='The software does not see a fatal screening blocker, but OuterHaven should still validate the package and current investor appetite before any distribution.';
    if(b.some(x=>x.title.includes('authority'))) {decision='Not ready for distribution';decisionCopy='Clear seller/sponsor authority before the opportunity moves into any controlled capital process.'}
    else if(b.filter(x=>x.impact==='high').length>=2){decision='Needs institutional packaging';decisionCopy='The opportunity has enough information to analyze, but not enough to put in front of serious capital without remediation.'}
    else if(!strong.length){decision='Needs capital strategy work';decisionCopy='The opportunity needs positioning, structure or relationship work before there is a credible first distribution wave.'}
    return{blockers:b,strong,decision,decisionCopy,isRE};
  }

  async function getSnapshot(){
    const id=$('capitalDealSelect')?.value;if(!id)return null;
    const a=await sb.auth.getSession(),u=a.data.session?.user;if(!u)return null;
    const [dr,br,rr]=await Promise.all([
      sb.from('deals').select('*').eq('id',id).maybeSingle(),
      sb.from('buy_boxes').select('*').eq('published',true),
      sb.from('capital_service_requests').select('id,service_type,status,notes').eq('member_id',u.id).eq('deal_id',id).order('created_at',{ascending:false})
    ]);
    if(dr.error)throw dr.error;if(br.error)throw br.error;if(rr.error)throw rr.error;
    const d=dr.data,boxes=br.data||[],ls=await sb.storage.from('deal-documents').list(`${u.id}/${id}`,{limit:100}),docs=ls.error?[]:(ls.data||[]).filter(x=>x.name&&x.id),rank=M.rank(d,boxes),diagnosis=diagnose(d,docs,rank);
    return{user:u,d,boxes,docs,rank,diagnosis,requests:rr.data||[]};
  }

  function activeRequest(type){return snapshot?.requests?.find(r=>r.service_type===type&&!['declined','completed'].includes(r.status))}
  function serviceLabel(type){return({institutional_package:'Investor-ready package rebuild',diligence_audit:'Diligence cleanup',mandate_strategy:'Capital targeting strategy',capital_stack_review:'Capital structure review',managed_capital_readiness:'Full deal remediation'})[type]||type}
  function toast(msg){document.querySelector('.dfyToast')?.remove();const t=document.createElement('div');t.className='dfyToast';t.textContent=msg;document.body.appendChild(t);setTimeout(()=>t.remove(),3200)}

  async function requestFix(type,issue,button){
    if(!snapshot?.d||!snapshot.user)return;
    const existing=activeRequest(type);if(existing){toast(`${serviceLabel(type)} is already in the OuterHaven pipeline. Current status: ${existing.status}.`);return}
    if(button)button.disabled=true;
    const top=snapshot.diagnosis.blockers.slice(0,5).map(x=>x.title).join(' | ');
    const notes=[
      'DONE FOR YOU request from Capital Suite.',
      `Deal: ${snapshot.d.title}.`,
      `Capital ask: ${money(snapshot.d.deal_size)}.`,
      `Requested scope: ${serviceLabel(type)}.`,
      issue?`Specific problem to fix: ${issue}.`:'Requested full remediation of the current capital-readiness issues.',
      top?`Current automated blockers: ${top}.`:'',
      'OuterHaven should review the source materials, determine the exact remediation scope, and return the opportunity with the requested work completed or clearly scoped.'
    ].filter(Boolean).join(' ');
    const {error}=await sb.from('capital_service_requests').insert({member_id:snapshot.user.id,deal_id:snapshot.d.id,service_type:type,notes});
    if(error){toast(error.message);if(button)button.disabled=false;return}
    toast('Sent to OuterHaven. This deal is now in the managed-work pipeline.');
    await refreshValue();
  }

  function renderValue(){
    const products=$('capitalProducts');if(!products||!snapshot)return;
    let panel=$('dfyValuePanel');if(!panel){panel=document.createElement('div');panel.id='dfyValuePanel';panel.className='dfyPanel';products.parentNode.insertBefore(panel,products)}
    const dx=snapshot.diagnosis,top=dx.blockers.slice(0,3);
    const active=activeRequest('managed_capital_readiness');
    panel.innerHTML=`<div class="dfyPanelTop"><div class="dfyDiagnosis"><div class="eyebrow">WHAT ACTUALLY MOVES THIS DEAL FORWARD</div><h3>${esc(top.length?`${top.length} priority issue${top.length===1?'':'s'} to solve first`:'No obvious screening blocker')}</h3><p>${esc(top.length?'These are the items most likely to slow institutional review or weaken buyer fit. Fixing them should come before broad distribution.':'The record clears the current software screen. The next value is human validation, investor targeting and execution.')}</p></div><div class="dfyDecision"><span>OuterHaven decision</span><strong>${esc(dx.decision)}</strong><small>${esc(dx.decisionCopy)}</small></div></div><div class="dfyBlockers">${top.length?top.map(x=>`<article class="dfyBlocker"><div class="dfyBlockerTop"><h4>${esc(x.title)}</h4><span class="dfyImpact ${x.impact==='high'?'high':x.impact==='med'?'med':'low'}">${esc(x.impact)} impact</span></div><p><strong>Why it matters:</strong> ${esc(x.why)}<br><br><strong>What we fix:</strong> ${esc(x.fix)}</p><button type="button" class="dfyFixBtn" data-dfy-service="${esc(x.service)}" data-dfy-issue="${esc(x.title)}">Fix this for me</button></article>`).join(''):`<div class="dfyEmpty" style="grid-column:1/-1">No high-priority blocker is visible from the current portal data. OuterHaven can still take over final packaging, investor selection and process preparation.</div>`}</div><div class="dfyMaster"><div><div class="kicker">DONE FOR YOU</div><h3>Hand the deal to OuterHaven and have us clean it up.</h3><p>We review the materials, fix the institutional narrative, build the diligence request list, tighten the capital structure, remove bad mandate matches, create the buyer strategy and return a cleaner package for controlled distribution. This is the human-execution layer above the software.</p>${active?`<div class="dfyStatus">Already requested · ${esc(active.status)}</div>`:''}</div><button type="button" class="dfyMasterBtn" data-dfy-service="managed_capital_readiness" data-dfy-issue="Full deal remediation" ${active?'disabled':''}>${active?'In OuterHaven pipeline':'Have OuterHaven fix this deal'}</button></div>`;
    patchProducts();
  }

  function patchProducts(){
    const map={
      'Institutional Package':['You leave with','a cleaner decision brief you can actually use to determine whether the deal is ready for capital.'],
      'Diligence Audit':['You leave with','an exact request list showing what is missing before institutional review can move efficiently.'],
      'Mandate Strategy':['You leave with','a filtered first-wave buyer set, exclusion reasons, and a clear stop-list for bad fits.'],
      'Capital Stack Review':['You leave with','a structure plan showing what can be sized now, what cannot, and which inputs are still required.'],
      'Managed Capital Readiness':['Done for you','OuterHaven takes the remediation work off your plate and moves the deal toward a usable institutional package.']
    };
    document.querySelectorAll('#capitalProducts .capitalProduct').forEach(card=>{
      const title=card.querySelector('h3')?.textContent?.trim();if(!map[title])return;
      let o=card.querySelector('.dfyProductOutcome');if(!o){o=document.createElement('div');o.className='dfyProductOutcome';const p=card.querySelector('p');if(p)p.after(o);else card.appendChild(o)}
      o.innerHTML=`<strong>${map[title][0]}:</strong> ${map[title][1]}`;
      if(title==='Managed Capital Readiness'){
        const btn=card.querySelector('[data-cap-request="managed_capital_readiness"]');if(btn){btn.textContent='Have OuterHaven fix this deal';btn.classList.add('primary')}
      }
    });
  }

  function serviceForOutput(){const t=$('capitalOutputTitle')?.textContent||'';if(/Diligence/i.test(t))return'diligence_audit';if(/Mandate/i.test(t))return'mandate_strategy';if(/Capital Structure/i.test(t))return'capital_stack_review';return'institutional_package'}
  function decorateOutput(){
    const out=$('capitalOutput'),body=$('capitalOutputBody');if(!out||!body||!snapshot)return;
    const doc=body.querySelector('.oh3');if(!doc)return;
    let cta=out.querySelector('.dfyOutputCta');if(!cta){cta=document.createElement('div');cta.className='dfyOutputCta';const head=out.querySelector('.capitalOutputHead');head?.after(cta)}
    const type=serviceForOutput(),existing=activeRequest(type);cta.innerHTML=`<div><strong>Want OuterHaven to do the remediation instead?</strong><span>We can take this exact output, fix the flagged issues, and move it into the managed-work pipeline.</span></div><button type="button" class="dfyMasterBtn" data-dfy-service="${type}" data-dfy-issue="Remediate issues identified in ${esc($('capitalOutputTitle')?.textContent||'this output')}" ${existing?'disabled':''}>${existing?'Already requested':'Fix this for me'}</button>`;
    if(!doc.querySelector('.dfyPrintDecision')){
      const top=snapshot.diagnosis.blockers.slice(0,3),box=document.createElement('div');box.className='dfyPrintDecision';box.innerHTML=`<h3>What this means</h3><p><strong>${esc(snapshot.diagnosis.decision)}.</strong> ${esc(snapshot.diagnosis.decisionCopy)}</p>${top.length?`<ul>${top.map(x=>`<li><strong>${esc(x.title)}:</strong> ${esc(x.fix)}</li>`).join('')}</ul>`:''}`;
      doc.querySelector('.oh3body')?.prepend(box);
    }
  }

  function customPrint(){
    const doc=$('capitalOutputBody')?.querySelector('.oh3');if(!doc)return false;
    const w=window.open('','_blank','noopener,noreferrer');if(!w)return false;
    const title=$('capitalOutputTitle')?.textContent||'OuterHaven Capital Output';
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>${$('ohDocV3Style')?.textContent||''}${$('dfyLayerStyle')?.textContent||''}body{margin:0;background:#fff}.oh3{max-width:900px;margin:auto}</style></head><body>${doc.outerHTML}<script>window.onload=()=>setTimeout(()=>window.print(),150)<\/script></body></html>`);w.document.close();return true;
  }

  async function refreshValue(){
    if(loading)return;loading=true;
    try{snapshot=await getSnapshot();if(snapshot)renderValue()}catch(e){console.error('done for you layer',e)}finally{loading=false}
  }

  function boot(){
    installStyles();
    const products=$('capitalProducts'),select=$('capitalDealSelect');
    if(!products||!select){setTimeout(boot,220);return}
    refreshValue();
    select.addEventListener('change',()=>setTimeout(refreshValue,120));
    $('capitalRefresh')?.addEventListener('click',()=>setTimeout(refreshValue,250));
    const obs=new MutationObserver(()=>patchProducts());obs.observe(products,{childList:true,subtree:true});
  }

  document.addEventListener('click',e=>{
    const fix=e.target.closest('[data-dfy-service]');if(fix){e.preventDefault();e.stopImmediatePropagation();requestFix(fix.dataset.dfyService,fix.dataset.dfyIssue||'',fix);return}
    if(e.target.closest('[data-cap-generate]')){setTimeout(()=>{let n=0;const poll=setInterval(()=>{n++;if($('capitalOutputBody')?.querySelector('.oh3')){clearInterval(poll);decorateOutput()}else if(n>30)clearInterval(poll)},120)},0);return}
    if(e.target.closest('#capitalDownload')&&$('capitalOutputBody')?.querySelector('.oh3')){e.preventDefault();e.stopImmediatePropagation();customPrint();return}
  },true);

  boot();
})();