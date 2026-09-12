(function(){
  if(window.__outerhavenCapitalSuiteV17)return;
  window.__outerhavenCapitalSuiteV17=true;
  const sb=window.__OUTERHAVEN_ORIGINATOR_SB;
  if(!sb)return;

  const $=id=>document.getElementById(id);
  const qs=s=>document.querySelector(s);
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  const norm=v=>String(v||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  const filled=v=>String(v||'').trim().length>=8;
  const money=v=>{const n=Number(v||0);if(!n)return'';if(n>=1e9)return'$'+(n/1e9).toFixed(n%1e9?1:0)+'B';if(n>=1e6)return'$'+(n/1e6).toFixed(n%1e6?1:0)+'M';if(n>=1e3)return'$'+(n/1e3).toFixed(n%1e3?1:0)+'K';return'$'+n.toLocaleString()};

  const generatedKeys=['investment_thesis','transaction_rationale','market_position','risks','mitigants'];
  const labels={
    investment_thesis:'Investment Thesis',transaction_rationale:'Transaction Narrative',market_position:'Market Positioning',risks:'Risk Analysis',mitigants:'Mitigants',
    use_of_proceeds:'Use of Proceeds',ownership:'Ownership & Capitalization',existing_debt:'Existing Debt',valuation:'Valuation / Pricing',sponsor_equity:'Sponsor Capital Invested / Committed',historical_performance:'Historical Performance',forecast:'Forecast / Business Plan',exit_strategy:'Exit / Repayment',timeline:'Timeline',asset_value:'Asset Value / Purchase Price',noi:'NOI / Property Cash Flow',operating_metrics:'Operating Metrics',project_status:'Project / Development Status',development_budget:'Development / Construction Budget',site_control:'Site Control / Title',presales:'Pre-sales / Contracted Sales',operator_brand:'Brand / Operator Status',collateral_security:'Collateral / Security'
  };
  const help={
    use_of_proceeds:'What will the requested capital actually fund, acquire, refinance or support?',
    ownership:'Who owns the business, sponsor or asset today, and what is the current capitalization?',
    existing_debt:'What debt is currently outstanding, including approximate balances and material lenders if known?',
    valuation:'What valuation, purchase price, asking price or pricing framework is being used?',
    sponsor_equity:'How much capital has the sponsor already invested in this deal, and how much additional sponsor capital is firmly committed? Separate already funded from committed if known. Do not include capital being raised from outside investors.',
    historical_performance:'What historical revenue, EBITDA, NOI or other operating performance should investors underwrite?',
    forecast:'What forward forecast or business plan is management or the sponsor using?',
    exit_strategy:'How is investor capital expected to be repaid, refinanced, sold or otherwise exited?',
    timeline:'What are the key milestones and target timing?',
    asset_value:'What is the current asset value or purchase price?',
    noi:'What is current and stabilized NOI or equivalent property cash flow?',
    project_status:'What has been completed, what remains, and what stage is the project currently in?',
    development_budget:'What is the total development or construction budget and the remaining capital need?',
    site_control:'How is the property/site controlled today: owned, under purchase agreement, leasehold, option, or another structure?',
    collateral_security:'What collateral, guarantees or security support the financing?'
  };

  let state={user:null,deal:null,workspace:null,docs:[],effective:{},generated:{},support:{}};
  let loading=false;

  function flags(d){
    const t=norm(d?.transaction_type),all=norm(`${d?.sector||''} ${d?.title||''} ${d?.company||''} ${d?.summary||''}`);
    return{
      sale:/sale|sell side|divest|exit/.test(t),acq:/acquisition|buyout|purchase|m a/.test(t),debt:/debt|loan|credit|refinanc|unitranche|mezz/.test(t),equity:/equity|growth capital|minority|majority/.test(t),jv:/joint venture|\bjv\b/.test(t),
      re:/real estate|hospitality|hotel|resort|property|multifamily|self storage|commercial property/.test(all),hospitality:/hospitality|hotel|resort|branded residence|villa/.test(all),development:/development|construction|ground up|ground-up|pre sale|pre-sale|presale/.test(all),presale:/pre sale|pre-sale|presale|pre sold|pre-sold|contracted sales|reservation/.test(all)
    };
  }

  function relevantFacts(d){
    const f=flags(d),out=['timeline','ownership','forecast'];
    if(!f.development||Number(d?.revenue)>0||Number(d?.ebitda)>0)out.push('historical_performance');
    if(!f.sale||f.acq||f.debt||f.equity||f.jv)out.push('use_of_proceeds');
    if(f.debt||f.acq||f.re)out.push('existing_debt');
    if(f.sale||f.acq||f.equity||f.jv||f.re)out.push('valuation');
    if(!f.sale||f.debt||f.equity||f.jv)out.push('exit_strategy');
    if(f.re||f.jv||f.acq||f.debt)out.push('sponsor_equity');
    if(f.debt)out.push('collateral_security');
    if(f.re){out.push('asset_value','site_control');if(f.development)out.push('project_status','development_budget');else out.push('noi');if(f.hospitality)out.push('operator_brand','operating_metrics');if(f.presale)out.push('presales')}
    return[...new Set(out)];
  }

  function requiredFacts(d){
    const f=flags(d),out=[];
    if(f.debt){out.push('use_of_proceeds','existing_debt','collateral_security');if(!f.development)out.push('historical_performance');else out.push('development_budget','project_status','site_control')}
    else if(f.re&&f.development){out.push('use_of_proceeds','development_budget','project_status','site_control');if(f.equity||f.jv||f.acq)out.push('sponsor_equity')}
    else if(f.re){out.push('asset_value','noi','site_control');if(f.sale||f.acq)out.push('valuation')}
    else if(f.sale||f.acq){out.push('valuation','historical_performance')}
    else if(f.equity||f.jv){out.push('use_of_proceeds','forecast','ownership')}
    else out.push('use_of_proceeds','forecast');
    return[...new Set(out)];
  }

  function sentence(text,re){return String(text||'').replace(/\s+/g,' ').split(/(?<=[.!?;])\s+/).find(x=>re.test(x))||''}
  function deriveSource(d){
    const s=String(d?.summary||''),out={};
    if(Number(d?.revenue)>0||Number(d?.ebitda)>0){const b=[];if(Number(d.revenue)>0)b.push(`Revenue: ${money(d.revenue)}`);if(Number(d.ebitda)>0)b.push(`EBITDA: ${money(d.ebitda)}`);out.historical_performance=b.join(' · ')}
    const map=[['use_of_proceeds',/use of proceeds|proceeds will|funds will|capital will|raise is for/i],['ownership',/ownership|owned by|shareholder|cap table|sponsor owns|founder owns|equity split/i],['existing_debt',/existing debt|current debt|loan|credit facility|mortgage|leverage/i],['valuation',/valuation|purchase price|asking price|enterprise value|equity value|cap rate/i],['forecast',/forecast|projected|projection|pro forma|stabilized|expected to grow|expected revenue|expected ebitda|irr|moic/i],['exit_strategy',/exit|repayment|refinance|sale after|liquidity path|hold period/i],['timeline',/timeline|closing|close by|target close|milestone|completion date|stabilization|year [0-9]/i],['sponsor_equity',/sponsor equity|equity contribution|skin in the game|already invested|sponsor invested|contribution aligned|cash equity/i],['asset_value',/asset value|property value|purchase price|appraised value/i],['noi',/\bnoi\b|net operating income/i],['operating_metrics',/occupancy|\badr\b|revpar|keys|rooms|units|utilization/i],['project_status',/construction|development stage|project status|groundbreak|completion|permit|entitlement/i],['development_budget',/development budget|construction budget|project cost|hard cost|soft cost|construction cost/i],['site_control',/site control|title|freehold|leasehold|land owned|property owned|land acquisition/i],['presales',/pre sold|pre-sold|pre sale|pre-sale|presale|reservations|contracted sales/i],['operator_brand',/operator|management agreement|brand engagement|marriott|hilton|hyatt|accor|ihg|four seasons|st regis/i],['collateral_security',/collateral|security package|guarantee|pledge/i]];
    map.forEach(([k,re])=>{const v=sentence(s,re);if(v)out[k]=v});return out;
  }

  function buildEffective(d,w){
    const saved=w?.intake||{},src=deriveSource(d),eff={};
    generatedKeys.forEach(k=>{if(filled(saved[k]))eff[k]=saved[k]});
    relevantFacts(d).forEach(k=>{if(filled(saved[k]))eff[k]=saved[k];else if(filled(src[k]))eff[k]=src[k]});
    return{eff,support:(saved.__supporting_docs&&typeof saved.__supporting_docs==='object')?saved.__supporting_docs:{}};
  }

  function currentDeckPresent(){
    const names=state.docs.map(x=>String(x.name||'').toLowerCase());
    return names.some(n=>/cim|memorandum|teaser|deck|one.?pager|overview|pitch/.test(n))||state.docs.length>0;
  }
  function supportModelPresent(){
    const names=state.docs.map(x=>String(x.name||'').toLowerCase());
    return names.some(n=>/req-support-development-|development.?budget|construction.?budget|project.?budget|underwriting|model|forecast|pro.?forma/.test(n));
  }

  function laterDiligence(d){
    const f=flags(d),out=['Ownership / cap table support'];
    if(f.debt||f.acq||f.re)out.push('Debt schedule / financing detail');
    if(f.sale||f.acq)out.push('LOI / purchase or sale agreement');
    if(f.re){out.push('Title / legal site-control support');if(f.development)out.push('Permits / approvals / project schedule');if(f.presale)out.push('Pre-sales / reservation support');if(f.hospitality)out.push('Brand / operator support')}
    if(f.debt)out.push('Security / collateral documentation');
    return out;
  }

  function status(){
    const mustFacts=requiredFacts(state.deal),missingFacts=mustFacts.filter(k=>!filled(state.effective[k]));
    const generatedCount=generatedKeys.filter(k=>filled(state.effective[k])).length;
    const core=[!!(state.deal?.title&&state.deal?.company),Number(state.deal?.deal_size)>0,!!(state.deal?.sector&&state.deal?.geography&&state.deal?.transaction_type),!!state.deal?.seller_relationship,!!state.deal?.authority_confirmed,String(state.deal?.summary||'').trim().length>=120];
    const factPct=Math.round((core.filter(Boolean).length+mustFacts.filter(k=>filled(state.effective[k])).length)/(core.length+mustFacts.length)*100);
    const softwarePct=Math.round(generatedCount/generatedKeys.length*100);
    const sourcePct=currentDeckPresent()?100:0;
    const readiness=Math.round(softwarePct*.45+factPct*.40+sourcePct*.15);
    return{mustFacts,missingFacts,softwarePct,factPct,sourcePct,readiness,next:missingFacts[0]||(!currentDeckPresent()?'__deck__':null)};
  }

  async function loadState(){
    const id=$('capitalDealSelect')?.value;if(!id)return false;
    const {data:{session}}=await sb.auth.getSession();if(!session)return false;
    const [dr,wr]=await Promise.all([sb.from('deals').select('*').eq('id',id).maybeSingle(),sb.from('deal_workspaces').select('*').eq('deal_id',id).maybeSingle()]);
    if(dr.error)throw dr.error;if(wr.error)throw wr.error;if(!dr.data)return false;
    const ls=await sb.storage.from('deal-documents').list(`${session.user.id}/${id}`,{limit:100,sortBy:{column:'name',order:'asc'}});
    const built=buildEffective(dr.data,wr.data||null);
    state={user:session.user,deal:dr.data,workspace:wr.data||null,docs:ls.error?[]:(ls.data||[]).filter(x=>x.name&&x.id),effective:built.eff,generated:{},support:built.support};
    return true;
  }

  function styles(){
    if($('capitalSuiteV17Style'))return;const s=document.createElement('style');s.id='capitalSuiteV17Style';s.textContent=`
    #capitalSuiteV16Core,#capitalSuiteV15Core,#advisorWorkspaceV14Core,#advisorWorkspaceV13Core,#advisorWorkspaceV12Core,#investorSuiteV11Core,#investorSuiteV10Core,#capitalMetrics,#capitalProducts,.capitalPlan,#institutionalReadiness,.institutionalStrip,.passportBtn{display:none!important}.capitalHero{grid-template-columns:1fr!important}.v17{margin:0 0 22px;font-family:Arial,Helvetica,sans-serif}.v17Hero{display:grid;grid-template-columns:160px 1fr;gap:22px;align-items:center;padding:22px;border:1px solid #d9cfc4;border-radius:16px;background:#fff}.v17Ring{--p:0;width:138px;height:138px;border-radius:50%;display:grid;place-items:center;position:relative;background:conic-gradient(#245b43 calc(var(--p)*1%),#ece7e1 0);margin:auto}.v17Ring:after{content:'';position:absolute;inset:13px;border-radius:50%;background:#fff}.v17Ring div{position:relative;z-index:1;text-align:center}.v17Ring strong{display:block;font-size:33px}.v17Ring span{font-size:6.8px;font-weight:850;letter-spacing:.09em;text-transform:uppercase;color:#786b5e}.v17Hero h3{margin:3px 0 7px;font-size:22px}.v17Hero p{margin:0;color:#6e6258;font-size:10px;line-height:1.55}.v17Stats{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}.v17Stat{padding:9px 11px;border:1px solid #e2d9cf;border-radius:9px;background:#faf8f5}.v17Stat span{font-size:6.4px;text-transform:uppercase;letter-spacing:.07em;font-weight:850;color:#847568}.v17Stat strong{display:block;margin-top:3px;font-size:14px}.v17Panel{margin-top:14px;border:1px solid #d9cfc4;border-radius:15px;background:#fff;overflow:hidden}.v17Head{display:flex;justify-content:space-between;gap:14px;align-items:center;padding:17px 19px;background:#f8f5f0}.v17Head h3{margin:3px 0 3px;font-size:18px}.v17Head p{margin:0;font-size:9px;line-height:1.48;color:#71655b}.v17Body{padding:18px 19px}.v17Actions{display:flex;gap:7px;flex-wrap:wrap}.v17Btn{border:1px solid #cfc3b6;border-radius:8px;padding:8px 10px;background:#fff;color:#2b251f;font:800 8.5px Arial,sans-serif;cursor:pointer}.v17Btn.primary{background:#211d19;color:#fff;border-color:#211d19}.v17Done{display:grid;grid-template-columns:repeat(5,1fr);gap:8px}.v17Done div{padding:12px;border:1px solid #e2dad1;border-radius:10px;background:#fcfbf9}.v17Done strong{display:block;font-size:9px}.v17Done span{display:inline-block;margin-top:6px;padding:4px 6px;border-radius:999px;background:#e8f0ec;color:#356147;font-size:6.1px;font-weight:850;text-transform:uppercase}.v17Next,.v17Support{padding:18px;border:1px solid #d8c9b8;border-radius:13px;background:linear-gradient(135deg,#fffdf9,#f8f2ea)}.v17Next h4,.v17Support h4{margin:5px 0 6px;font-size:17px}.v17Next p,.v17Support p{margin:0 0 12px;font-size:9px;line-height:1.55;color:#6e6258}.v17Input{width:100%;min-height:74px;box-sizing:border-box;resize:vertical;border:1px solid #d4c7b9;border-radius:9px;padding:10px;font:9.5px/1.5 Arial,sans-serif;background:#fff}.v17Complete{padding:18px;border-radius:12px;background:#edf3ef;color:#355f49}.v17Complete strong{display:block;font-size:14px;margin-bottom:4px}.v17Complete p{margin:0;font-size:9px;line-height:1.5}.v17Outputs{display:grid;grid-template-columns:repeat(4,1fr);gap:9px}.v17Output{padding:14px;border:1px solid #e1d8cf;border-radius:11px}.v17Output h4{margin:0 0 5px;font-size:12px}.v17Output p{margin:0 0 10px;font-size:8px;line-height:1.45;color:#70645a}.v17Details,.v17Later{display:none}.v17Details.open,.v17Later.open{display:block}.v17DetailGrid{display:grid;grid-template-columns:1fr 1fr;gap:9px}.v17Detail{padding:12px;border:1px solid #e3dbd2;border-radius:10px;background:#fcfbf9}.v17Detail label{display:block;margin-bottom:5px;font-size:7px;font-weight:850;text-transform:uppercase;color:#74675c}.v17Detail p{margin:0;white-space:pre-wrap;font-size:8.5px;line-height:1.5;color:#5f564e}.v17LaterItem{padding:8px 0;border-bottom:1px solid #eee7df;font-size:8.5px}.v17Upload{display:none}.v17ChoiceState{display:inline-block;margin-bottom:9px;padding:5px 7px;border-radius:999px;background:#edf3ef;color:#356147;font-size:6.5px;font-weight:850;text-transform:uppercase}@media(max-width:900px){.v17Hero{grid-template-columns:1fr}.v17Done,.v17Outputs{grid-template-columns:1fr 1fr}.v17DetailGrid{grid-template-columns:1fr}}@media(max-width:600px){.v17Done,.v17Outputs{grid-template-columns:1fr}}`;
    document.head.appendChild(s);
  }

  function patchShell(){
    const nav=qs('.navBtn[data-section="capital"] span');if(nav)nav.textContent='Capital Suite';
    const hero=$('capitalSection')?.querySelector('.capitalHeroCard');if(hero){const e=hero.querySelector('.eyebrow'),h=hero.querySelector('h2'),p=hero.querySelector('p');if(e)e.textContent='OUTERHAVEN CAPITAL SUITE';if(h)h.textContent='Turn source material into an investor-ready package.';if(p)p.textContent='Capital Suite shows what is already complete, then gives you one necessary next step at a time.'}
  }
  function mount(){const panel=$('capitalSection')?.querySelector('.panel'),controls=panel?.querySelector('.capitalControls');if(!panel||!controls)return null;let root=$('capitalSuiteV17Core');if(!root){root=document.createElement('div');root.id='capitalSuiteV17Core';root.className='v17';controls.after(root)}return root}

  function nextStep(sc){
    if(!sc.next)return`<div class="v17Complete"><strong>Initial package requirements are complete.</strong><p>Capital Suite has the source information needed for the current investor package. Supporting documents can strengthen the package without blocking it.</p></div>`;
    if(sc.next==='__deck__')return`<div class="v17Next"><div class="eyebrow">NEXT NECESSARY STEP</div><h4>Current deal deck / CIM</h4><p>We need one current source document that describes the opportunity being packaged.</p><input id="v17RequiredUpload" class="v17Upload" type="file" accept=".pdf,.docx,.xlsx"><div class="v17Actions"><button class="v17Btn primary" data-v17-upload-required>Upload Source Document</button></div></div>`;
    const k=sc.next,example=k==='sponsor_equity'?'Example: $5M already invested; $10M additional sponsor capital committed.':'Add the factual, source-backed answer here.';
    return`<div class="v17Next"><div class="eyebrow">NEXT NECESSARY STEP · 1 OF ${sc.missingFacts.length} REMAINING</div><h4>${esc(labels[k])}</h4><p>${esc(help[k]||'This factual item is necessary for the current transaction package.')}</p><textarea id="v17NextFact" class="v17Input" placeholder="${esc(example)}"></textarea><div class="v17Actions" style="margin-top:10px"><button class="v17Btn primary" data-v17-save-next="${esc(k)}">Save & Continue</button><button class="v17Btn" data-v17-request="${esc(k)}">Copy Request</button></div></div>`;
  }

  function supportCard(){
    const f=flags(state.deal);if(!(f.re&&f.development))return'';
    const uploaded=supportModelPresent(),decision=state.support.development||'';
    if(uploaded)return`<section class="v17Panel"><div class="v17Head"><div><div class="eyebrow">SUPPORTING MATERIAL</div><h3>Detailed budget / financial model</h3><p>A supporting budget/model is on file. This strengthens the underwriting package but is not what makes the initial package usable.</p></div><span class="v17ChoiceState">Supporting file on hand</span></div></section>`;
    const stateLabel=decision==='covered'?'Current materials marked sufficient':decision==='deferred'?'Not available yet':'';
    return`<section class="v17Panel"><div class="v17Head"><div><div class="eyebrow">STRENGTHEN THE PACKAGE · OPTIONAL</div><h3>Detailed budget / financial model</h3><p>The current materials already contain project costs and return assumptions. A detailed budget/model can strengthen underwriting, but a separate file is not automatically required for the initial package.</p></div>${stateLabel?`<span class="v17ChoiceState">${esc(stateLabel)}</span>`:''}</div><div class="v17Body"><div class="v17Support"><h4>How should we treat this?</h4><p>Choose the option that reflects what you actually have. Capital Suite will remember the choice.</p><input id="v17SupportUpload" class="v17Upload" type="file" accept=".pdf,.docx,.xlsx"><div class="v17Actions"><button class="v17Btn primary" data-v17-support-upload>Upload Supporting File</button><button class="v17Btn" data-v17-support-choice="covered">Current Materials Already Cover This</button><button class="v17Btn" data-v17-support-choice="deferred">Not Available Yet</button></div></div></div></section>`;
  }

  function requestText(key){
    const label=labels[key],body=help[key]||'Please provide the factual information needed for the current package.';
    if(key==='sponsor_equity')return`Source Information Request\n\nFor ${state.deal?.title||'this opportunity'}, please provide the sponsor capital contribution:\n\n1. How much capital has the sponsor already invested in the deal?\n2. How much additional sponsor capital is firmly committed?\n3. Separate already funded from committed but not yet funded if known.\n\nDo not include capital being raised from outside investors. A short factual answer is sufficient.`;
    return`Source Information Request\n\nFor ${state.deal?.title||'this opportunity'}, please provide:\n\n${label}\n${body}\n\nA short factual answer is sufficient. No narrative drafting is required.`;
  }

  function render(){
    const root=mount();if(!root||!state.deal)return;patchShell();const sc=status();
    const built=generatedKeys.map(k=>`<div><strong>${esc(labels[k])}</strong><span>${filled(state.effective[k])?'Complete':'Building'}</span></div>`).join('');
    const details=generatedKeys.map(k=>`<div class="v17Detail"><label>${esc(labels[k])}</label><p>${esc(state.effective[k]||'This section will be generated from the current transaction record and source material.')}</p></div>`).join('');
    const later=laterDiligence(state.deal).map(x=>`<div class="v17LaterItem">${esc(x)}</div>`).join('');
    root.innerHTML=`
      <section class="v17Hero"><div><div class="v17Ring" style="--p:${sc.readiness}"><div><strong>${sc.readiness}%</strong><span>Package Readiness</span></div></div></div><div><div class="eyebrow">CAPITAL SUITE</div><h3>See what is already done, then handle one necessary item.</h3><p>Readiness measures the initial investor package. Optional supporting documents and later diligence do not artificially block it.</p><div class="v17Stats"><div class="v17Stat"><span>OuterHaven Work</span><strong>${sc.softwarePct}%</strong></div><div class="v17Stat"><span>Necessary Facts Left</span><strong>${sc.missingFacts.length}</strong></div><div class="v17Stat"><span>Core Source Material</span><strong>${currentDeckPresent()?'On File':'Needed'}</strong></div></div></div></section>
      <section class="v17Panel"><div class="v17Head"><div><div class="eyebrow">WHAT OUTERHAVEN HAS DONE</div><h3>Your package is already being built</h3><p>These are the investor-facing components maintained from the deal and source material.</p></div><button class="v17Btn" data-v17-details>View What We Built</button></div><div class="v17Body"><div class="v17Done">${built}</div></div><div id="v17Details" class="v17Details"><div class="v17Body"><div class="v17DetailGrid">${details}</div></div></div></section>
      <section class="v17Panel"><div class="v17Head"><div><div class="eyebrow">NEXT STEP</div><h3>Only deal with what is necessary now</h3><p>One required source item at a time. Supporting material is handled separately.</p></div></div><div class="v17Body">${nextStep(sc)}</div></section>
      ${supportCard()}
      <section class="v17Panel"><div class="v17Head"><div><div class="eyebrow">INVESTOR MATERIALS</div><h3>Generate the current package</h3><p>Outputs use the work already completed plus source information currently available.</p></div></div><div class="v17Body"><div class="v17Outputs"><article class="v17Output"><h4>Investor Teaser</h4><p>First-pass material for initial investor review.</p><button class="v17Btn primary" data-v17-doc="teaser">Generate</button></article><article class="v17Output"><h4>Investment Memorandum</h4><p>Structured investor memo using the current package.</p><button class="v17Btn primary" data-v17-doc="memo">Generate</button></article><article class="v17Output"><h4>Capital Summary</h4><p>Transaction structure, capitalization and sources and uses.</p><button class="v17Btn primary" data-v17-doc="sources">Generate</button></article><article class="v17Output"><h4>Diligence Package</h4><p>Current room index and source checklist.</p><button class="v17Btn primary" data-v17-doc="checklist">Generate</button></article></div></div></section>
      <section class="v17Panel"><div class="v17Head"><div><div class="eyebrow">LATER DILIGENCE</div><h3>${laterDiligence(state.deal).length} items tracked for later</h3><p>These may matter deeper in diligence, but they do not block the initial investor package.</p></div><button class="v17Btn" data-v17-later>View Later Diligence</button></div><div id="v17Later" class="v17Later"><div class="v17Body">${later}</div></div></section>`;
  }

  async function persistIntake(mutator){
    const intake={...(state.workspace?.intake||{})};mutator(intake);
    const {error}=await sb.from('deal_workspaces').upsert({deal_id:state.deal.id,owner_id:state.user.id,intake,generated_assets:state.workspace?.generated_assets||{},updated_at:new Date().toISOString()},{onConflict:'deal_id'});if(error)throw error;await refresh();
  }
  async function saveNext(key){const val=$('v17NextFact')?.value.trim();if(!filled(val)){alert('Please add the factual answer before continuing.');return}await persistIntake(i=>{i[key]=val})}
  async function saveSupport(choice){await persistIntake(i=>{const s=(i.__supporting_docs&&typeof i.__supporting_docs==='object')?{...i.__supporting_docs}:{};s.development=choice;i.__supporting_docs=s})}
  function safeName(name){return String(name||'document').normalize('NFKD').replace(/[^a-zA-Z0-9._-]+/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'').slice(-120)||'document'}
  function mimeFor(file){const ext=(file.name.split('.').pop()||'').toLowerCase();if(ext==='pdf')return'application/pdf';if(ext==='docx')return'application/vnd.openxmlformats-officedocument.wordprocessingml.document';if(ext==='xlsx')return'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';return file.type||'application/octet-stream'}
  async function upload(file,prefix){if(!file||!/\.(pdf|docx|xlsx)$/i.test(file.name)){alert('Please choose a PDF, DOCX, or XLSX file.');return}if(file.size>10*1024*1024){alert('File must be 10MB or smaller.');return}const path=`${state.user.id}/${state.deal.id}/${prefix}-${Date.now()}-${safeName(file.name)}`;const {error}=await sb.storage.from('deal-documents').upload(path,file,{contentType:mimeFor(file),upsert:false});if(error)throw error;await refresh()}

  async function refresh(){if(loading)return;if(!$('capitalDealSelect')?.value)return;loading=true;try{if(await loadState())render()}catch(e){console.error('capital suite v17',e);const root=mount();if(root)root.innerHTML=`<div class="empty">Could not load Capital Suite. ${esc(e?.message||'Unknown error')}</div>`}finally{loading=false}}
  function schedule(){[0,250,700,1400].forEach(ms=>setTimeout(()=>{patchShell();refresh()},ms))}
  function boot(){styles();patchShell();let n=0;const tick=()=>{n++;patchShell();if($('capitalDealSelect')&&$('capitalSection')?.querySelector('.capitalControls')){schedule();return}if(n<80)setTimeout(tick,250)};tick();setInterval(patchShell,4000)}

  document.addEventListener('click',async e=>{
    if(e.target.closest('.navBtn[data-section="capital"],#capitalRefresh')){schedule();return}
    const d=e.target.closest('[data-v17-details]');if(d){$('v17Details')?.classList.toggle('open');d.textContent=$('v17Details')?.classList.contains('open')?'Hide Details':'View What We Built';return}
    const l=e.target.closest('[data-v17-later]');if(l){$('v17Later')?.classList.toggle('open');l.textContent=$('v17Later')?.classList.contains('open')?'Hide Later Diligence':'View Later Diligence';return}
    const s=e.target.closest('[data-v17-save-next]');if(s){s.disabled=true;try{await saveNext(s.dataset.v17SaveNext)}catch(err){alert(err?.message||'Could not save.')}finally{s.disabled=false}return}
    const r=e.target.closest('[data-v17-request]');if(r){const text=requestText(r.dataset.v17Request);try{await navigator.clipboard.writeText(text);r.textContent='Request Copied';setTimeout(()=>r.textContent='Copy Request',1200)}catch(_){alert(text)}return}
    const c=e.target.closest('[data-v17-support-choice]');if(c){c.disabled=true;try{await saveSupport(c.dataset.v17SupportChoice)}catch(err){alert(err?.message||'Could not save choice.')}finally{c.disabled=false}return}
    if(e.target.closest('[data-v17-support-upload]')){$('v17SupportUpload')?.click();return}
    if(e.target.closest('[data-v17-upload-required]')){$('v17RequiredUpload')?.click();return}
    const doc=e.target.closest('[data-v17-doc]');if(doc){e.preventDefault();e.stopImmediatePropagation();window.OuterHavenCapitalDocsV9?.renderAsset(doc.dataset.v17Doc);return}
  },true);
  document.addEventListener('change',async e=>{
    if(e.target?.id==='capitalDealSelect'){schedule();return}
    if(e.target?.id==='v17SupportUpload'){const file=e.target.files?.[0];e.target.value='';if(file)try{await upload(file,'REQ-support-development')}catch(err){alert(err?.message||'Could not upload file.')}return}
    if(e.target?.id==='v17RequiredUpload'){const file=e.target.files?.[0];e.target.value='';if(file)try{await upload(file,'REQ-overview')}catch(err){alert(err?.message||'Could not upload file.')}}
  },true);

  window.OuterHavenCapitalSuiteV17={refresh,status:()=>status()};
  boot();
})();