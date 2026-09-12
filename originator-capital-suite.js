(function(){
  if(window.__outerhavenCapitalSuite)return;
  window.__outerhavenCapitalSuite=true;
  const sb=window.__OUTERHAVEN_ORIGINATOR_SB;
  if(!sb)return;

  let user=null,member=null,deals=[],boxes=[],requests=[],selectedDealId=null,docs=[];
  const $=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  const norm=v=>String(v||'').trim().toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  const cap=v=>String(v||'').replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
  const money=v=>{const n=Number(v||0);if(!n)return'Not specified';if(n>=1e9)return'$'+(n/1e9).toFixed(n%1e9?1:0)+'B';if(n>=1e6)return'$'+(n/1e6).toFixed(n%1e6?1:0)+'M';if(n>=1e3)return'$'+(n/1e3).toFixed(n%1e3?1:0)+'K';return'$'+n.toLocaleString()};
  const range=b=>b.min_size&&b.max_size?`${money(b.min_size)}–${money(b.max_size)}`:b.min_size?`${money(b.min_size)}+`:b.max_size?`Up to ${money(b.max_size)}`:'Flexible';

  function textMatch(input,criterion,globalWords=[]){
    const a=norm(input),b=norm(criterion);if(!b)return true;if(globalWords.some(w=>b.includes(w)))return true;if(!a)return false;
    return a.includes(b)||b.includes(a)||a.split(' ').some(x=>x.length>3&&b.includes(x));
  }
  function scoreBox(d,b){
    const tests=[];const amount=Number(d.deal_size||0);
    if(b.min_size||b.max_size)tests.push({label:'Size',ok:(!b.min_size||amount>=Number(b.min_size))&&(!b.max_size||amount<=Number(b.max_size))});
    tests.push({label:'Sector',ok:textMatch(d.sector,b.sector,['agnostic','all sectors','sector agnostic'])});
    tests.push({label:'Geography',ok:textMatch(d.geography,b.geography,['global','worldwide','all geographies'])});
    tests.push({label:'Structure',ok:textMatch(d.transaction_type,b.transaction_type,['flexible','all structures','multiple structures'])});
    if(b.min_ebitda)tests.push({label:'EBITDA',ok:Number(d.ebitda||0)>=Number(b.min_ebitda)});
    const score=tests.length?Math.round(tests.filter(t=>t.ok).length/tests.length*100):0;
    return{score,tests};
  }
  function rankedMandates(d){return boxes.map(box=>({box,...scoreBox(d,box)})).sort((a,b)=>b.score-a.score)}

  function readiness(d,docList=docs){
    let score=0;const gaps=[];
    if(d.authority_confirmed)score+=15;else gaps.push('Seller-side authority confirmation');
    if(d.seller_relationship)score+=8;else gaps.push('Seller / sponsor relationship');
    if(Number(d.deal_size)>=20000000)score+=8;else gaps.push('$20M+ institutional transaction scale');
    if(d.sector&&d.geography&&d.transaction_type)score+=12;else gaps.push('Complete sector, geography and structure');
    if(Number(d.revenue)>0)score+=8;else gaps.push('Revenue disclosure');
    if(Number(d.ebitda)>0)score+=8;else gaps.push('EBITDA / operating earnings disclosure');
    if(String(d.summary||'').length>=300)score+=12;else if(String(d.summary||'').length>=120)score+=7;else gaps.push('Institutional-quality opportunity narrative');
    const names=docList.map(x=>norm(x.name)).join(' ');
    const docSignals=[/cim|memorandum|teaser|deck/,/financial|model|forecast|budget/,/qoe|quality of earnings|audit|statement/,/cap table|ownership|org chart|corporate/];
    const docPts=Math.min(20,docSignals.filter(r=>r.test(names)).length*5+(docList.length>=3?5:0));score+=docPts;
    if(docPts<10)gaps.push('Broader diligence package');
    const strong=rankedMandates(d).filter(x=>x.score>=75).length;if(strong)score+=9;else gaps.push('75%+ published mandate coverage');
    score=Math.min(100,score);
    return{score,tier:score>=90?'Institutional':score>=75?'Qualified':score>=60?'Developing':'Incomplete',gaps,strong};
  }

  function installStyles(){
    if($('capitalSuiteStyle'))return;
    const s=document.createElement('style');s.id='capitalSuiteStyle';s.textContent=`
      .capitalNavBadge{font-size:7px!important;padding:2px 5px;border-radius:999px;background:#c7aa82;color:#211b15;margin-left:auto}
      .capitalHero{display:grid;grid-template-columns:1.25fr .75fr;gap:16px;margin-bottom:16px}.capitalHeroCard{border:1px solid #ded2c3;border-radius:15px;background:linear-gradient(135deg,#fcf8f2,#f1e7d9);padding:20px}.capitalHeroCard h2{font-size:24px;margin:4px 0 8px}.capitalHeroCard p{font-size:11px;line-height:1.6;color:#6f6358;margin:0}.capitalPlan{border:1px solid #dfd3c5;background:#fffdf9;border-radius:15px;padding:18px}.capitalPlan strong{display:block;font-size:18px}.capitalPlan span{font-size:9px;color:#817467}.capitalPlan .planTag{display:inline-block;margin-top:9px;padding:5px 8px;border-radius:999px;background:#211c17;color:#fff8ef;text-transform:uppercase;letter-spacing:.07em;font-size:7px;font-weight:900}
      .capitalControls{display:flex;gap:10px;align-items:end;margin-bottom:15px;flex-wrap:wrap}.capitalControls label{display:grid;gap:5px;font-size:9px;text-transform:uppercase;letter-spacing:.06em;font-weight:850;color:#75685c}.capitalControls select{min-width:330px;max-width:100%;padding:10px 12px;border:1px solid #d7cabb;border-radius:10px;background:#fff;font:inherit;color:#29231e}.capitalRefresh{padding:10px 13px;border:1px solid #d7cabb;border-radius:10px;background:#fffdf9;font:inherit;font-size:10px;font-weight:850;cursor:pointer}
      .capitalMetrics{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:16px}.capitalMetric{border:1px solid #e0d5c9;border-radius:12px;background:#fffdfa;padding:13px}.capitalMetric span{display:block;font-size:8px;text-transform:uppercase;letter-spacing:.07em;color:#85786b;font-weight:850}.capitalMetric strong{display:block;font-size:22px;margin-top:4px}.capitalMetric small{display:block;color:#817467;font-size:8px;margin-top:2px}
      .capitalProducts{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}.capitalProduct{border:1px solid #e0d5c8;border-radius:14px;background:#fffdfa;padding:17px;display:flex;flex-direction:column;min-height:205px}.capitalProductTop{display:flex;justify-content:space-between;gap:10px}.capitalProductIcon{width:34px;height:34px;border-radius:10px;background:#eee3d5;display:grid;place-items:center;font-size:12px;font-weight:950}.capitalProductTag{font-size:7px;text-transform:uppercase;letter-spacing:.07em;font-weight:900;color:#806d58;background:#f2e8dc;padding:5px 7px;border-radius:999px;height:max-content}.capitalProduct h3{font-size:15px;margin:13px 0 6px}.capitalProduct p{font-size:10px;line-height:1.55;color:#766a5e;margin:0 0 12px}.capitalFeatureList{display:grid;gap:5px;margin:0 0 14px;padding:0;list-style:none}.capitalFeatureList li{font-size:9px;color:#5f554c}.capitalFeatureList li:before{content:'✓';font-weight:900;margin-right:7px;color:#795e3f}.capitalActions{display:flex;gap:7px;flex-wrap:wrap;margin-top:auto}.capitalBtn{border:1px solid #cfc1b1;background:#fffdfa;color:#2b251f;border-radius:9px;padding:8px 10px;font:inherit;font-size:9px;font-weight:850;cursor:pointer}.capitalBtn.primary{background:#211c17;color:#fffaf3;border-color:#211c17}.capitalBtn:disabled{opacity:.55;cursor:not-allowed}.capitalReqStatus{font-size:8px;color:#7e6f61;margin-top:8px}.capitalOutput{margin-top:16px;border:1px solid #dfd4c7;border-radius:14px;background:#fffdfa;overflow:hidden}.capitalOutput.hidden{display:none}.capitalOutputHead{display:flex;justify-content:space-between;gap:10px;align-items:center;padding:14px 16px;border-bottom:1px solid #e4dacf}.capitalOutputHead h3{margin:0;font-size:14px}.capitalOutputActions{display:flex;gap:6px}.capitalOutputBody{padding:17px;white-space:pre-wrap;font:10.5px/1.65 ui-monospace,SFMono-Regular,Menlo,monospace;color:#4e463e;max-height:560px;overflow:auto}.capitalNotice{font-size:9px;color:#7f7164;background:#f6efe6;border-radius:9px;padding:9px 10px;margin-top:10px}
      @media(max-width:900px){.capitalHero{grid-template-columns:1fr}.capitalMetrics{grid-template-columns:repeat(2,1fr)}.capitalProducts{grid-template-columns:1fr}}@media(max-width:600px){.capitalControls select{min-width:0;width:100%}.capitalMetrics{grid-template-columns:1fr 1fr}}
    `;document.head.appendChild(s);
  }

  function installUI(){
    if($('capitalSection'))return;
    const nav=document.querySelector('.nav');
    if(nav){
      const btn=document.createElement('button');btn.className='navBtn';btn.dataset.section='capital';btn.innerHTML='<span>Capital Suite</span><b class="capitalNavBadge">PRO</b>';btn.onclick=showCapital;nav.appendChild(btn);
    }
    const main=document.querySelector('.main');if(!main)return;
    const section=document.createElement('section');section.id='capitalSection';section.className='section';section.innerHTML=`
      <div class="capitalHero"><div class="capitalHeroCard"><div class="eyebrow">OUTERHAVEN CAPITAL SUITE</div><h2>Turn a submitted deal into an institutional package.</h2><p>Build investor-ready outputs, identify diligence gaps, map active mandate coverage, and request higher-touch OuterHaven work from one workspace.</p></div><div class="capitalPlan"><span>Current access</span><strong id="capitalPlanName">Partner Access</strong><span id="capitalPlanCopy">Loading access level...</span><div class="planTag" id="capitalPlanTag">Loading</div></div></div>
      <section class="panel"><div class="panelHead"><div><div class="eyebrow">WORKSPACE</div><h2>Capital Readiness Products</h2><p>Select one of your submitted opportunities. Every product below operates from the same Deal Passport data.</p></div></div><div class="capitalControls"><label>Opportunity<select id="capitalDealSelect"></select></label><button type="button" id="capitalRefresh" class="capitalRefresh">Refresh workspace</button></div><div id="capitalMetrics" class="capitalMetrics"></div><div id="capitalProducts" class="capitalProducts"></div><div id="capitalOutput" class="capitalOutput hidden"><div class="capitalOutputHead"><h3 id="capitalOutputTitle">Output</h3><div class="capitalOutputActions"><button type="button" id="capitalCopy" class="capitalBtn">Copy</button><button type="button" id="capitalDownload" class="capitalBtn">Download TXT</button><button type="button" id="capitalCloseOutput" class="capitalBtn">Close</button></div></div><div id="capitalOutputBody" class="capitalOutputBody"></div></div></section>`;
    main.appendChild(section);
    $('capitalDealSelect').onchange=async()=>{selectedDealId=$('capitalDealSelect').value;await loadDocs();renderWorkspace()};
    $('capitalRefresh').onclick=refresh;
    $('capitalCloseOutput').onclick=()=>$('capitalOutput').classList.add('hidden');
    $('capitalCopy').onclick=async()=>{try{await navigator.clipboard.writeText($('capitalOutputBody').textContent||'');$('capitalCopy').textContent='Copied';setTimeout(()=>$('capitalCopy').textContent='Copy',1200)}catch(_){}};
    $('capitalDownload').onclick=downloadOutput;
  }

  function showCapital(){
    document.querySelectorAll('.section').forEach(s=>s.classList.remove('active'));document.querySelectorAll('.navBtn').forEach(b=>b.classList.toggle('active',b.dataset.section==='capital'));$('capitalSection')?.classList.add('active');
    if($('pageTitle'))$('pageTitle').textContent='Capital Suite';if($('pageSub'))$('pageSub').textContent='Institutional packaging, diligence, mandate strategy, and managed capital-readiness services.';if($('topSubmit'))$('topSubmit').style.display='none';window.scrollTo({top:0,behavior:'smooth'});
  }

  async function loadDocs(){
    docs=[];const d=selectedDeal();if(!d||!user)return;
    try{const folder=`${user.id}/${d.id}`;const {data,error}=await sb.storage.from('deal-documents').list(folder,{limit:100,sortBy:{column:'name',order:'asc'}});if(!error)docs=(data||[]).filter(x=>x.name&&x.id)}catch(_){}
  }
  function selectedDeal(){return deals.find(d=>String(d.id)===String(selectedDealId))||null}
  function requestFor(type){return requests.find(r=>String(r.deal_id)===String(selectedDealId)&&r.service_type===type&&!['declined','completed'].includes(r.status))}

  function renderWorkspace(){
    if(!member)return;
    const paid=member.membership==='paid';$('capitalPlanName').textContent=paid?'Institutional Access':'Partner Preview';$('capitalPlanCopy').textContent=paid?'Full software outputs enabled. Higher-touch OuterHaven services are scoped separately.':'Preview software outputs and request Institutional Access or managed services.';$('capitalPlanTag').textContent=paid?'Paid':'Pilot';
    const select=$('capitalDealSelect');if(select){select.innerHTML=deals.length?deals.map(d=>`<option value="${esc(d.id)}" ${String(d.id)===String(selectedDealId)?'selected':''}>${esc(d.title)} · ${esc(money(d.deal_size))}</option>`).join(''):'<option value="">No submitted opportunities</option>'}
    const d=selectedDeal();if(!d){$('capitalMetrics').innerHTML='<div class="empty" style="grid-column:1/-1">Submit an opportunity first to unlock the Capital Suite.</div>';$('capitalProducts').innerHTML='';return}
    const r=readiness(d),ranked=rankedMandates(d),strong=ranked.filter(x=>x.score>=75).length;
    $('capitalMetrics').innerHTML=[['Readiness',r.score+'%',r.tier],['Strong Mandates',strong,`${ranked.filter(x=>x.score>=50).length} potential`],['Data Room',docs.length,docs.length===1?'document':'documents'],['Service Requests',requests.filter(x=>String(x.deal_id)===String(d.id)&&!['declined','completed'].includes(x.status)).length,'active requests']].map(x=>`<article class="capitalMetric"><span>${esc(x[0])}</span><strong>${esc(x[1])}</strong><small>${esc(x[2])}</small></article>`).join('');
    const products=[
      ['institutional_package','IP','Institutional Package','Software Output','Create a standardized investor-facing package from the deal record.',['Executive teaser','Investment brief','Key transaction metrics','Investment considerations'],'Generate Package'],
      ['diligence_audit','DA','Diligence Audit','Software + Review','See what an institutional counterparty is likely to ask for before distribution.',['Data-room gap map','Financial disclosure checks','Authority / transaction checks','Priority missing items'],'Run Audit'],
      ['mandate_strategy','MS','Mandate Strategy','Software + Review','Rank the opportunity against published buy-side criteria and explain the fit.',['Top buyer profiles','Fit percentages','Pass / fail dimensions','Coverage summary'],'Build Strategy'],
      ['capital_stack_review','CS','Capital Stack Review','Managed Service','Frame plausible capital pathways before introducing the opportunity to capital.',['Structure pathways','Debt / equity considerations','Capital-source mapping','OuterHaven human review'],'Preview + Request'],
      ['managed_capital_readiness','MR','Managed Capital Readiness','Managed Service','A higher-touch engagement to convert an incomplete transaction package into a distribution-ready institutional opportunity.',['Readiness remediation','Materials architecture','Diligence coordination','Distribution preparation'],'Request Scope']
    ];
    $('capitalProducts').innerHTML=products.map(p=>{
      const req=requestFor(p[0]);const software=['institutional_package','diligence_audit','mandate_strategy','capital_stack_review'].includes(p[0]);
      return`<article class="capitalProduct"><div class="capitalProductTop"><div class="capitalProductIcon">${p[1]}</div><span class="capitalProductTag">${p[3]}</span></div><h3>${p[2]}</h3><p>${p[4]}</p><ul class="capitalFeatureList">${p[5].map(x=>`<li>${esc(x)}</li>`).join('')}</ul><div class="capitalActions">${software?`<button type="button" class="capitalBtn primary" data-cap-generate="${p[0]}">${p[6]}</button>`:''}<button type="button" class="capitalBtn" data-cap-request="${p[0]}" ${req?'disabled':''}>${req?cap(req.status):'Request OuterHaven Review'}</button></div>${req?`<div class="capitalReqStatus">Request received · ${esc(cap(req.status))}</div>`:''}</article>`
    }).join('');
    $('capitalProducts').querySelectorAll('[data-cap-generate]').forEach(b=>b.onclick=()=>generateOutput(b.dataset.capGenerate));
    $('capitalProducts').querySelectorAll('[data-cap-request]').forEach(b=>b.onclick=()=>createRequest(b.dataset.capRequest,b));
  }

  function packageText(d){
    const r=readiness(d),ranked=rankedMandates(d).slice(0,5);
    return`OUTERHAVEN INSTITUTIONAL PACKAGE\n\nOPPORTUNITY\n${d.title}\n${d.company||'Company not specified'}\n\nTRANSACTION SNAPSHOT\nCapital Ask: ${money(d.deal_size)}\nStructure: ${d.transaction_type||'Not specified'}\nSector: ${d.sector||'Not specified'}\nGeography: ${d.geography||'Not specified'}\nRevenue: ${money(d.revenue)}\nEBITDA: ${money(d.ebitda)}\nSeller Relationship: ${d.seller_relationship||'Not specified'}\nInstitutional Readiness: ${r.score}% · ${r.tier}\n\nEXECUTIVE TEASER\n${d.summary||'No opportunity summary supplied.'}\n\nMANDATE COVERAGE\n${ranked.map((x,i)=>`${i+1}. ${x.box.title} · ${x.score}% · ${range(x.box)} · ${x.box.geography}`).join('\n')}\n\nREADINESS GAPS\n${r.gaps.length?r.gaps.map(x=>'• '+x).join('\n'):'No material completeness gaps detected by the software screen.'}\n\nDATA ROOM\n${docs.length?docs.map(x=>'• '+x.name.replace(/^[0-9a-f-]{36}-/i,'')).join('\n'):'No supporting documents detected.'}\n\nSCREENING NOTE\nThis package is generated from information supplied through the OuterHaven originator portal. It is a screening and preparation record, not investment approval or a representation that any investor will transact.`;
  }
  function auditText(d){
    const r=readiness(d);const names=docs.map(x=>norm(x.name)).join(' ');
    const checks=[
      ['Seller authority',!!d.authority_confirmed,'Confirm authority before distribution'],['Capital ask',Number(d.deal_size)>0,'Define exact capital requirement'],['Revenue',Number(d.revenue)>0,'Provide current revenue / scale'],['EBITDA',Number(d.ebitda)>0,'Provide EBITDA or operating earnings'],['CIM / teaser',/cim|memorandum|teaser|deck/.test(names),'Attach current CIM, teaser, or investment deck'],['Financial model',/financial|model|forecast|budget/.test(names),'Attach model, forecast, or historical financials'],['Quality / audit support',/qoe|quality of earnings|audit|statement/.test(names),'Add QoE, audited statements, or equivalent support'],['Ownership / corporate',/cap table|ownership|org chart|corporate/.test(names),'Add cap table / ownership / corporate structure'],['Institutional narrative',String(d.summary||'').length>=300,'Expand thesis, rationale, ownership and use of proceeds']
    ];
    return`OUTERHAVEN DILIGENCE AUDIT\n\n${d.title}\nInstitutional Readiness: ${r.score}% · ${r.tier}\n\nCHECKLIST\n${checks.map(c=>`${c[1]?'PASS':'GAP '} · ${c[0]}${c[1]?'':` · ${c[2]}`}`).join('\n')}\n\nPRIORITY REMEDIATION\n${r.gaps.length?r.gaps.map((g,i)=>`${i+1}. ${g}`).join('\n'):'No material completeness gaps detected by the current screen.'}\n\nDOCUMENTS DETECTED\n${docs.length?docs.map(x=>'• '+x.name.replace(/^[0-9a-f-]{36}-/i,'')).join('\n'):'None'}\n\nNOTE\nThis audit tests completeness and internal presentation readiness based on portal fields and document metadata. It does not replace legal, financial, tax, technical, or investment due diligence.`;
  }
  function mandateText(d){
    const ranked=rankedMandates(d).slice(0,10);return`OUTERHAVEN MANDATE STRATEGY\n\n${d.title}\n${money(d.deal_size)} · ${d.sector} · ${d.geography} · ${d.transaction_type}\n\nTOP PUBLISHED MANDATES\n${ranked.map((x,i)=>`${i+1}. ${x.box.title}\n   Fit: ${x.score}%\n   Target: ${range(x.box)} · ${x.box.geography}\n   ${x.tests.map(t=>`${t.ok?'PASS':'MISS'} ${t.label}`).join(' | ')}`).join('\n\n')}\n\nCOVERAGE SUMMARY\n75%+ strong fits: ${rankedMandates(d).filter(x=>x.score>=75).length}\n50%+ potential fits: ${rankedMandates(d).filter(x=>x.score>=50).length}\nPublished mandates tested: ${boxes.length}\n\nNOTE\nPublished mandate fit is a screening aid. OuterHaven decides whether an opportunity is appropriate for controlled distribution and which relationships should receive it.`;
  }
  function stackText(d){
    const type=norm(d.transaction_type),ask=Number(d.deal_size||0);let paths=[];
    if(/debt/.test(type))paths=['Senior / unitranche credit as the primary capital source','Structured or mezzanine capital where leverage or collateral profile requires flexibility','Equity or sponsor capital used to improve lender coverage where required'];
    else if(/joint venture/.test(type))paths=['JV equity with aligned operating / strategic partner','Preferred equity where economics need downside protection','Senior asset-level or corporate debt paired with sponsor equity'];
    else if(/acquisition|sale/.test(type))paths=['Sponsor / buyer equity paired with acquisition debt','Structured equity or preferred capital to reduce common-equity requirement','Seller rollover or deferred consideration where commercially appropriate'];
    else paths=['Common / minority growth equity','Preferred or structured equity','Debt plus equity blend where cash-flow support permits'];
    return`OUTERHAVEN CAPITAL STACK PRE-ASSESSMENT\n\n${d.title}\nCapital Requirement: ${money(ask)}\nCurrent Structure: ${d.transaction_type||'Not specified'}\nRevenue: ${money(d.revenue)}\nEBITDA: ${money(d.ebitda)}\n\nPOTENTIAL STRUCTURING PATHS\n${paths.map((x,i)=>`${i+1}. ${x}`).join('\n')}\n\nCAPITAL COVERAGE\nPublished mandates with 75%+ fit: ${rankedMandates(d).filter(x=>x.score>=75).length}\nPublished mandates with 50%+ fit: ${rankedMandates(d).filter(x=>x.score>=50).length}\n\nNEXT OUTERHAVEN REVIEW\nA human capital-stack review should test leverage capacity, collateral, sponsor equity, control rights, investor return requirements, valuation, use of proceeds, and closing constraints before any structure is treated as actionable.\n\nNOTE\nThis is a conceptual structuring screen, not financing advice, a commitment, or an offer of securities.`;
  }

  function generateOutput(type){
    const d=selectedDeal();if(!d)return;let title='',text='';
    if(type==='institutional_package'){title='Institutional Package';text=packageText(d)}
    if(type==='diligence_audit'){title='Diligence Audit';text=auditText(d)}
    if(type==='mandate_strategy'){title='Mandate Strategy';text=mandateText(d)}
    if(type==='capital_stack_review'){title='Capital Stack Pre-Assessment';text=stackText(d)}
    if(member.membership!=='paid'&&text.length>1800){text=text.slice(0,1800)+'\n\n--- PARTNER PREVIEW ---\nFull software output and export are enabled for paid Institutional Access. Use Request OuterHaven Review to scope the next step.'}
    $('capitalOutputTitle').textContent=title;$('capitalOutputBody').textContent=text;$('capitalOutput').classList.remove('hidden');$('capitalOutput').scrollIntoView({behavior:'smooth',block:'start'});
  }
  function downloadOutput(){
    const text=$('capitalOutputBody').textContent||'';if(!text)return;const blob=new Blob([text],{type:'text/plain;charset=utf-8'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=(($('capitalOutputTitle').textContent||'outerhaven-output').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''))+'.txt';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),500)
  }

  async function createRequest(type,button){
    const d=selectedDeal();if(!d||!user)return;button.disabled=true;const labels={institutional_package:'Institutional Package',diligence_audit:'Diligence Audit',mandate_strategy:'Mandate Strategy',capital_stack_review:'Capital Stack Review',managed_capital_readiness:'Managed Capital Readiness'};
    const notes=`Requested from Capital Suite for ${d.title}. Current ask ${money(d.deal_size)}. Requested product: ${labels[type]||type}.`;
    const {error}=await sb.from('capital_service_requests').insert({member_id:user.id,deal_id:d.id,service_type:type,notes});
    if(error){alert(error.message);button.disabled=false;return}
    await loadData();renderWorkspace();
  }

  async function loadData(){
    const auth=await sb.auth.getSession();user=auth.data.session?.user||null;if(!user)return;
    const [mr,dr,br,rr]=await Promise.all([sb.from('members').select('*').eq('id',user.id).maybeSingle(),sb.from('deals').select('*').eq('owner_id',user.id).order('created_at',{ascending:false}),sb.from('buy_boxes').select('*').eq('published',true),sb.from('capital_service_requests').select('*').eq('member_id',user.id).order('created_at',{ascending:false})]);
    if(mr.error)throw mr.error;if(dr.error)throw dr.error;if(br.error)throw br.error;if(rr.error)throw rr.error;member=mr.data;deals=dr.data||[];boxes=br.data||[];requests=rr.data||[];
    if(!selectedDealId||!deals.some(d=>String(d.id)===String(selectedDealId)))selectedDealId=deals.find(d=>d.status!=='draft')?.id||deals[0]?.id||null;
    await loadDocs();
  }
  async function refresh(){try{await loadData();renderWorkspace()}catch(e){console.error('capital suite',e)}}

  async function init(){installStyles();installUI();try{await loadData();renderWorkspace()}catch(e){console.error('capital suite init',e)}setInterval(()=>refresh(),60000)}
  init();
})();