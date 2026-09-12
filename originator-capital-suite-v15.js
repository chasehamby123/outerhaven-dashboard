(function(){
  if(window.__outerhavenCapitalSuiteV15)return;
  window.__outerhavenCapitalSuiteV15=true;
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
    use_of_proceeds:'Use of Proceeds',ownership:'Ownership & Capitalization',existing_debt:'Existing Debt',valuation:'Valuation / Pricing',sponsor_equity:'Sponsor Equity',historical_performance:'Historical Performance',forecast:'Forecast / Business Plan',exit_strategy:'Exit / Repayment',timeline:'Timeline',asset_value:'Asset Value / Purchase Price',noi:'NOI / Property Cash Flow',operating_metrics:'Operating Metrics',project_status:'Project / Development Status',development_budget:'Development / Construction Budget',site_control:'Site Control / Title',presales:'Pre-sales / Contracted Sales',operator_brand:'Brand / Operator Status',collateral_security:'Collateral / Security'
  };
  const help={
    use_of_proceeds:'What the capital will fund, acquire, refinance or support.',ownership:'Current owners and capitalization.',existing_debt:'Current lenders, balances, maturities and material obligations.',valuation:'Stated valuation, purchase price or pricing framework.',sponsor_equity:'Sponsor capital already invested or committed.',historical_performance:'Historical revenue, EBITDA, NOI or operating results.',forecast:'Management or sponsor forecast and core assumptions.',exit_strategy:'Expected repayment, refinance or exit path.',timeline:'Key milestones and target timing.',asset_value:'Current asset value or purchase price.',noi:'Current and stabilized property cash flow.',operating_metrics:'Occupancy, ADR, RevPAR, units or other underwriting KPIs.',project_status:'Current execution or development status.',development_budget:'Total development or construction budget.',site_control:'How the property or site is controlled.',presales:'Reservations, pre-sales or contracted sales.',operator_brand:'Brand, operator or management agreement status.',collateral_security:'Collateral, guarantees or security supporting financing.'
  };

  let state={user:null,deal:null,workspace:null,docs:[],effective:{},derived:{},generated:{},generatedMeta:{}};
  let loading=false;

  function flags(d){
    const t=norm(d?.transaction_type),all=norm(`${d?.sector||''} ${d?.title||''} ${d?.company||''} ${d?.summary||''}`);
    return{sale:/sale|sell side|divest|exit/.test(t),acq:/acquisition|buyout|purchase|m a/.test(t),debt:/debt|loan|credit|refinanc|unitranche|mezz/.test(t),equity:/equity|growth capital|minority|majority/.test(t),jv:/joint venture|\bjv\b/.test(t),re:/real estate|hospitality|hotel|resort|property|multifamily|self storage|commercial property/.test(all),hospitality:/hospitality|hotel|resort|branded residence|villa/.test(all),development:/development|construction|ground up|ground-up|pre sale|pre-sale|presale/.test(all),presale:/pre sale|pre-sale|presale|pre sold|pre-sold|contracted sales|reservation/.test(all)};
  }

  function sourceKeys(d){
    const f=flags(d),out=['forecast','timeline','ownership'];
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

  function sourceRequirements(d){
    const f=flags(d),r=[];
    r.push(['overview','CIM / teaser / deal deck',[/cim/,/memorandum/,/teaser/,/deck/,/one.?pager/,/overview/,/pitch/]]);
    if(!f.development||Number(d?.revenue)>0||Number(d?.ebitda)>0)r.push(['historicals','Historical financials / operating statements',[/financial/,/p.?&.?l/,/income.?statement/,/balance.?sheet/,/management.?accounts/,/operating.?statement/,/audit/]]);
    r.push(['model','Forecast / model / business plan',[/model/,/forecast/,/projection/,/pro.?forma/,/business.?plan/,/budget/]]);
    r.push(['ownership','Ownership / cap table / sponsor structure',[/cap.?table/,/ownership/,/shareholder/,/org.?chart/,/corporate.?structure/]]);
    if(f.debt||f.acq||f.re)r.push(['debt','Debt schedule / financing detail',[/debt.?schedule/,/loan/,/credit.?facility/,/mortgage/,/financing.?schedule/,/lender/]]);
    if(f.sale||f.acq)r.push(['transaction','Transaction document / LOI / purchase agreement',[/loi/,/letter.?of.?intent/,/purchase.?agreement/,/sale.?agreement/,/psa/,/transaction.?document/]]);
    if(f.re){
      r.push(['site','Title / site-control support',[/title/,/deed/,/site.?control/,/leasehold/,/freehold/,/land.?lease/,/purchase.?agreement/,/psa/]]);
      if(!f.development)r.push(['propertyops','Property operating support',[/noi/,/rent.?roll/,/occupancy/,/revpar/,/adr/,/property.?operating/]]);
      if(f.development){r.push(['devbudget','Development / construction budget',[/development.?budget/,/construction.?budget/,/project.?budget/,/hard.?cost/,/soft.?cost/]]);r.push(['schedule','Project schedule / permits / approvals',[/project.?schedule/,/construction.?schedule/,/permit/,/approval/,/entitlement/,/planning/]])}
      if(f.presale)r.push(['presales','Pre-sales / reservation support',[/pre.?sale/,/presale/,/reservation/,/contracted.?sale/,/deposit/]]);
      if(f.hospitality)r.push(['operator','Brand / operator support',[/operator/,/management.?agreement/,/brand/,/marriott/,/hilton/,/hyatt/,/accor/,/ihg/,/st.?regis/,/four.?seasons/]])
    }
    if(f.debt)r.push(['collateral','Collateral / security support',[/collateral/,/security/,/guarantee/,/pledge/,/mortgage/]]);
    return r;
  }

  function sentence(text,re){return String(text||'').replace(/\s+/g,' ').split(/(?<=[.!?;])\s+/).find(x=>re.test(x))||''}
  function clip(text,max=380){const s=String(text||'').replace(/\s+/g,' ').replace(/^the investment case\s*/i,'').trim();if(s.length<=max)return s;const c=s.slice(0,max),p=Math.max(c.lastIndexOf('. '),c.lastIndexOf('; '));return(p>180?c.slice(0,p+1):c.slice(0,c.lastIndexOf(' ')))+'…'}

  function deriveSource(d){
    const s=String(d?.summary||''),out={};
    if(Number(d?.revenue)>0||Number(d?.ebitda)>0){const b=[];if(Number(d.revenue)>0)b.push(`Revenue: ${money(d.revenue)}`);if(Number(d.ebitda)>0)b.push(`EBITDA: ${money(d.ebitda)}`);out.historical_performance=b.join(' · ')}
    const map=[['use_of_proceeds',/use of proceeds|proceeds will|funds will|capital will|raise is for/i],['ownership',/ownership|owned by|shareholder|cap table|sponsor owns|founder owns|equity split/i],['existing_debt',/existing debt|current debt|loan|credit facility|mortgage|leverage/i],['valuation',/valuation|purchase price|asking price|enterprise value|equity value|cap rate/i],['forecast',/forecast|projected|projection|pro forma|stabilized|expected to grow|expected revenue|expected ebitda|irr|moic/i],['exit_strategy',/exit|repayment|refinance|sale after|liquidity path|hold period/i],['timeline',/timeline|closing|close by|target close|milestone|completion date|stabilization|year [0-9]/i],['sponsor_equity',/sponsor equity|equity contribution|skin in the game|already invested|sponsor invested/i],['asset_value',/asset value|property value|purchase price|appraised value/i],['noi',/\bnoi\b|net operating income/i],['operating_metrics',/occupancy|\badr\b|revpar|keys|rooms|units|utilization/i],['project_status',/construction|development stage|project status|groundbreak|completion|permit|entitlement/i],['development_budget',/development budget|construction budget|project cost|hard cost|soft cost|construction cost/i],['site_control',/site control|title|freehold|leasehold|land owned|property owned/i],['presales',/pre sold|pre-sold|pre sale|pre-sale|presale|reservations|contracted sales/i],['operator_brand',/operator|management agreement|brand engagement|marriott|hilton|hyatt|accor|ihg|four seasons|st regis/i],['collateral_security',/collateral|security package|guarantee|pledge/i]];
    map.forEach(([k,re])=>{const v=sentence(s,re);if(v)out[k]=v});return out;
  }

  function softwareDraft(d,src){
    const f=flags(d),ask=money(d?.deal_size),summary=clip(d?.summary,420),parts=[];if(d?.sector)parts.push(d.sector);if(d?.geography)parts.push(d.geography);
    let thesis=`${d?.title||d?.company||'The opportunity'} is being prepared as ${d?.transaction_type||'a private-market transaction'}`;if(parts.length)thesis+=` in ${parts.join(' / ')}`;if(ask)thesis+=` with a stated capital requirement of ${ask}`;thesis+='.';if(summary)thesis+=' '+summary;
    let rationale=`The transaction is currently structured as ${d?.transaction_type||'a private-market opportunity'}`;if(ask)rationale+=` with ${ask} of stated capital required`;rationale+='.';rationale+=src.use_of_proceeds?` Submitted materials indicate: ${clip(src.use_of_proceeds,260)}`:' The specific use of proceeds should be confirmed from source before final distribution.';
    let market=`The investor positioning is anchored in the known transaction facts: ${d?.sector||'the stated sector'} exposure in ${d?.geography||'the stated geography'}.`;if(src.operator_brand)market+=` The submitted material references ${clip(src.operator_brand,220)}`;if(src.presales)market+=` It also references ${clip(src.presales,220)}`;market+=' No unsupported market-size or competitive claims are assumed.';
    const risk=[];if(f.development)risk.push('development execution, construction timing and cost control');if(f.presale)risk.push('pre-sale conversion and collection risk');if(f.hospitality)risk.push('brand/operator execution and operating ramp');if(f.debt)risk.push('leverage, covenant and refinancing risk');if(f.acq)risk.push('transaction execution and diligence risk');if(f.re)risk.push('asset valuation, title/site control and exit liquidity');risk.push('forecast accuracy and capital structure execution');
    const risks=`Key diligence areas identified from the transaction structure include ${[...new Set(risk)].join('; ')}. These are underwriting flags, not claims that a problem exists.`;
    const mit=[];if(src.presales)mit.push('pre-sales or contracted demand referenced in source');if(src.operator_brand)mit.push('brand/operator engagement referenced in source');if(Number(d?.revenue)>0)mit.push(`reported revenue of ${money(d.revenue)}`);if(Number(d?.ebitda)>0)mit.push(`reported EBITDA of ${money(d.ebitda)}`);if(src.site_control)mit.push('site-control information referenced in source');
    const mitigants=mit.length?`Documented factors that may mitigate underwriting risk include ${mit.join('; ')}. Each should be verified against supporting source documents before distribution.`:'No unsupported mitigants have been invented. Final materials should only present mitigants tied to submitted facts or supporting documents.';
    return{investment_thesis:thesis,transaction_rationale:rationale,market_position:market,risks,mitigants};
  }

  function buildEffective(d,w){
    const saved=w?.intake||{},src=deriveSource(d),gen=softwareDraft(d,src),gm=(saved.__generated&&typeof saved.__generated==='object')?saved.__generated:{},eff={};
    generatedKeys.forEach(k=>{eff[k]=(filled(saved[k])&&!gm[k])?saved[k]:gen[k]});
    sourceKeys(d).forEach(k=>{if(filled(saved[k]))eff[k]=saved[k];else if(filled(src[k]))eff[k]=src[k]});
    return{eff,src,gen,gm};
  }

  function docPresent(req){const names=state.docs.map(x=>String(x.name||'').toLowerCase());return names.some(n=>req[2].some(re=>re.test(n)))}

  function status(){
    const d=state.deal||{},keys=sourceKeys(d),reqs=sourceRequirements(d),missingFacts=keys.filter(k=>!filled(state.effective[k])),detectedFacts=keys.filter(k=>filled(state.effective[k])),missingDocs=reqs.filter(r=>!docPresent(r)),presentDocs=reqs.length-missingDocs.length;
    const software=generatedKeys.filter(k=>filled(state.effective[k])).length;
    const core=[!!(d.title&&d.company),Number(d.deal_size)>0,!!(d.sector&&d.geography&&d.transaction_type),!!d.seller_relationship,!!d.authority_confirmed,String(d.summary||'').trim().length>=120];
    const factsPct=Math.round((core.filter(Boolean).length+detectedFacts.length)/(core.length+keys.length)*100);
    const docsPct=reqs.length?Math.round(presentDocs/reqs.length*100):100;
    const softwarePct=Math.round(software/generatedKeys.length*100);
    const readiness=Math.round(softwarePct*.30+factsPct*.35+docsPct*.35);
    return{keys,reqs,missingFacts,detectedFacts,missingDocs,presentDocs,software,softwarePct,factsPct,docsPct,readiness};
  }

  async function loadState(){
    const id=$('capitalDealSelect')?.value;if(!id)return false;
    const {data:{session}}=await sb.auth.getSession();if(!session)return false;
    const [dr,wr]=await Promise.all([sb.from('deals').select('*').eq('id',id).maybeSingle(),sb.from('deal_workspaces').select('*').eq('deal_id',id).maybeSingle()]);
    if(dr.error)throw dr.error;if(wr.error)throw wr.error;if(!dr.data)return false;
    const ls=await sb.storage.from('deal-documents').list(`${session.user.id}/${id}`,{limit:100,sortBy:{column:'name',order:'asc'}});
    const built=buildEffective(dr.data,wr.data||null);
    state={user:session.user,deal:dr.data,workspace:wr.data||null,docs:ls.error?[]:(ls.data||[]).filter(x=>x.name&&x.id),effective:built.eff,derived:built.src,generated:built.gen,generatedMeta:built.gm};
    await ensureGeneratedSaved();return true;
  }

  async function ensureGeneratedSaved(){
    const existing={...(state.workspace?.intake||{})},gm={...(state.generatedMeta||{})};let changed=false;
    generatedKeys.forEach(k=>{if(!filled(existing[k])||gm[k]){if(existing[k]!==state.generated[k]||!gm[k])changed=true;existing[k]=state.generated[k];gm[k]=true}});
    existing.__generated=gm;if(!changed&&state.workspace)return;
    const generated_assets=state.workspace?.generated_assets||{};
    const {error}=await sb.from('deal_workspaces').upsert({deal_id:state.deal.id,owner_id:state.user.id,intake:existing,generated_assets,updated_at:new Date().toISOString()},{onConflict:'deal_id'});if(error)throw error;
    state.workspace={...(state.workspace||{}),intake:existing,generated_assets};state.generatedMeta=gm;
  }

  function styles(){
    if($('capitalSuiteV15Style'))return;const s=document.createElement('style');s.id='capitalSuiteV15Style';s.textContent=`
    #advisorWorkspaceV14Core,#advisorWorkspaceV13Core,#advisorWorkspaceV12Core,#investorSuiteV11Core,#investorSuiteV10Core,#capitalMetrics,#capitalProducts,.capitalPlan,#institutionalReadiness,.institutionalStrip,.passportBtn{display:none!important}.capitalHero{grid-template-columns:1fr!important}.v15{margin:0 0 22px;font-family:Arial,Helvetica,sans-serif}.v15Hero{display:grid;grid-template-columns:170px 1fr;gap:22px;align-items:center;padding:22px;border:1px solid #d9cfc4;border-radius:16px;background:#fff}.v15Ring{--p:0;width:145px;height:145px;border-radius:50%;display:grid;place-items:center;position:relative;background:conic-gradient(#245b43 calc(var(--p)*1%),#ece7e1 0);margin:auto}.v15Ring:after{content:'';position:absolute;inset:13px;border-radius:50%;background:#fff}.v15Ring div{position:relative;z-index:1;text-align:center}.v15Ring strong{display:block;font-size:34px}.v15Ring span{font-size:7px;font-weight:850;letter-spacing:.09em;text-transform:uppercase;color:#786b5e}.v15Hero h3{margin:3px 0 7px;font-size:22px}.v15Hero p{margin:0;color:#6e6258;font-size:10px;line-height:1.55}.v15Stats{display:flex;gap:8px;flex-wrap:wrap;margin-top:15px}.v15Stat{padding:9px 11px;border:1px solid #e2d9cf;border-radius:9px;background:#faf8f5}.v15Stat span{font-size:6.5px;text-transform:uppercase;letter-spacing:.07em;font-weight:850;color:#847568}.v15Stat strong{display:block;margin-top:3px;font-size:15px}.v15Panel{margin-top:14px;border:1px solid #d9cfc4;border-radius:15px;background:#fff;overflow:hidden}.v15Head{display:flex;justify-content:space-between;gap:14px;align-items:center;padding:17px 19px;background:#f8f5f0}.v15Head h3{margin:3px 0 3px;font-size:18px}.v15Head p{margin:0;font-size:9px;line-height:1.48;color:#71655b}.v15Body{padding:17px 19px}.v15Actions{display:flex;gap:7px;flex-wrap:wrap}.v15Btn{border:1px solid #cfc3b6;border-radius:8px;padding:8px 10px;background:#fff;color:#2b251f;font:800 8.5px Arial,sans-serif;cursor:pointer}.v15Btn.primary{background:#211d19;color:#fff;border-color:#211d19}.v15Built{display:grid;grid-template-columns:repeat(5,1fr);gap:8px}.v15Built div{padding:12px;border:1px solid #e2dad1;border-radius:10px;background:#fcfbf9}.v15Built strong{display:block;font-size:9px}.v15Built span{display:inline-block;margin-top:6px;padding:4px 6px;border-radius:999px;background:#e8f0ec;color:#356147;font-size:6.2px;font-weight:850;text-transform:uppercase}.v15GapGrid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.v15GapBox{padding:14px;border:1px solid #e4dbd1;border-radius:11px}.v15GapBox h4{margin:0 0 9px;font-size:12px}.v15List{display:grid;gap:7px}.v15Item{display:flex;justify-content:space-between;gap:10px;align-items:center;padding:8px 9px;background:#fbf9f6;border-radius:8px}.v15Item strong{font-size:8.5px}.v15Item span{font-size:6.5px;font-weight:850;text-transform:uppercase;color:#8c5136}.v15Empty{padding:12px;border-radius:9px;background:#edf3ef;color:#3c6650;font-size:8.5px}.v15Outputs{display:grid;grid-template-columns:repeat(4,1fr);gap:9px}.v15Output{padding:14px;border:1px solid #e1d8cf;border-radius:11px}.v15Output h4{margin:0 0 5px;font-size:12px}.v15Output p{margin:0 0 10px;font-size:8px;line-height:1.45;color:#70645a}.v15Review{display:none}.v15Review.open{display:block}.v15ReviewGrid{display:grid;grid-template-columns:1fr 1fr;gap:9px}.v15Field{padding:11px;border:1px solid #e3dbd2;border-radius:9px;background:#fcfbf9}.v15Field label{display:block;margin-bottom:5px;font-size:7px;font-weight:850;text-transform:uppercase;color:#74675c}.v15Field textarea{width:100%;min-height:64px;box-sizing:border-box;resize:vertical;border:1px solid #d5cabf;border-radius:7px;padding:8px;font:9px/1.45 Arial,sans-serif}.v15Field small{display:block;margin-top:5px;color:#887b70;font-size:7px}.v15Upload{display:none}.v15FileRow{margin-top:10px;font-size:7.5px;color:#776a5f}.v15FileRow span{display:inline-block;padding:5px 7px;margin:3px;border:1px solid #e1d8cf;border-radius:999px}@media(max-width:900px){.v15Hero{grid-template-columns:1fr}.v15Built,.v15Outputs{grid-template-columns:1fr 1fr}.v15GapGrid,.v15ReviewGrid{grid-template-columns:1fr}}@media(max-width:600px){.v15Built,.v15Outputs{grid-template-columns:1fr}}
    `;document.head.appendChild(s)}

  function patchShell(){
    const nav=qs('.navBtn[data-section="capital"] span');if(nav)nav.textContent='Capital Suite';
    const deals=qs('.navBtn[data-section="submissions"] span');if(deals)deals.textContent='Deals';
    if($('topSubmit'))$('topSubmit').textContent='+ New Deal';
    const hero=$('capitalSection')?.querySelector('.capitalHeroCard');if(hero){const e=hero.querySelector('.eyebrow'),h=hero.querySelector('h2'),p=hero.querySelector('p');if(e)e.textContent='OUTERHAVEN CAPITAL SUITE';if(h)h.textContent='Turn seller materials into an investor-ready package.';if(p)p.textContent='OuterHaven does the drafting and organization. You only deal with source information that is genuinely missing.'}
    const ph=$('capitalSection')?.querySelector('.panelHead h2');if(ph)ph.textContent='Capital Suite';
    const pp=$('capitalSection')?.querySelector('.panelHead p');if(pp)pp.textContent='Select a deal. Everything below updates from the same source material.';
  }

  function mount(){const panel=$('capitalSection')?.querySelector('.panel'),controls=panel?.querySelector('.capitalControls');if(!panel||!controls)return null;let root=$('capitalSuiteV15Core');if(!root){root=document.createElement('div');root.id='capitalSuiteV15Core';root.className='v15';controls.after(root)}return root}

  function sellerRequest(sc){
    const lines=['Seller / Sponsor Information Request','','To complete the investor package for '+(state.deal?.title||'this opportunity')+', please provide the remaining source information below. No narrative drafting is required.',''];
    if(sc.missingFacts.length){lines.push('INFORMATION');sc.missingFacts.forEach(k=>lines.push('• '+labels[k]));lines.push('')}
    if(sc.missingDocs.length){lines.push('DOCUMENTS');sc.missingDocs.forEach(r=>lines.push('• '+r[1]));lines.push('')}
    if(!sc.missingFacts.length&&!sc.missingDocs.length)return'The current source requirements are complete.';
    lines.push('OuterHaven will use the information and documents to update the package automatically.');return lines.join('\n');
  }

  function gapList(items,type){
    if(!items.length)return'<div class="v15Empty">Nothing else is required here.</div>';
    if(type==='fact')return`<div class="v15List">${items.map(k=>`<div class="v15Item"><strong>${esc(labels[k])}</strong><span>Missing</span></div>`).join('')}</div>`;
    return`<div class="v15List">${items.map(r=>`<div class="v15Item"><strong>${esc(r[1])}</strong><span>Missing</span></div>`).join('')}</div>`;
  }

  function render(){
    const root=mount();if(!root||!state.deal)return;patchShell();const sc=status();
    const built=generatedKeys.map(k=>`<div><strong>${esc(labels[k])}</strong><span>Built</span></div>`).join('');
    const reviewFields=sc.keys.map(k=>`<div class="v15Field"><label>${esc(labels[k])}</label><textarea data-v15-source="${k}" placeholder="Add only if you need to correct or supply this fact">${esc(state.effective[k]||'')}</textarea><small>${esc(help[k]||'Source-backed transaction fact.')}</small></div>`).join('');
    root.innerHTML=`
      <section class="v15Hero"><div><div class="v15Ring" style="--p:${sc.readiness}"><div><strong>${sc.readiness}%</strong><span>Package Readiness</span></div></div></div><div><div class="eyebrow">CAPITAL SUITE</div><h3>Most of the work should already be done.</h3><p>OuterHaven builds the investor narrative from the deal record and source material. The only visible work left is information or evidence that cannot be created responsibly.</p><div class="v15Stats"><div class="v15Stat"><span>Built by OuterHaven</span><strong>${sc.software}/5</strong></div><div class="v15Stat"><span>Source Facts Found</span><strong>${sc.detectedFacts.length}/${sc.keys.length}</strong></div><div class="v15Stat"><span>Source Files Covered</span><strong>${sc.presentDocs}/${sc.reqs.length}</strong></div><div class="v15Stat"><span>Remaining Gaps</span><strong>${sc.missingFacts.length+sc.missingDocs.length}</strong></div></div></div></section>

      <section class="v15Panel"><div class="v15Head"><div><div class="eyebrow">ALREADY BUILT</div><h3>OuterHaven-generated work</h3><p>These components are automatically maintained from the transaction. You do not need to write them.</p></div><div class="v15Actions"><button class="v15Btn" data-v15-review>Review / Correct</button></div></div><div class="v15Body"><div class="v15Built">${built}</div></div></section>

      <section class="v15Panel"><div class="v15Head"><div><div class="eyebrow">ONLY WHAT IS MISSING</div><h3>${sc.missingFacts.length+sc.missingDocs.length?`${sc.missingFacts.length+sc.missingDocs.length} source item${sc.missingFacts.length+sc.missingDocs.length===1?'':'s'} left`:'Source package complete'}</h3><p>If it is missing, request it from the seller or upload it. No investment-writing assignment is pushed back to you.</p></div><div class="v15Actions"><input id="v15SourceUpload" class="v15Upload" type="file" multiple accept=".pdf,.docx,.xlsx"><button class="v15Btn" data-v15-upload>Upload Files</button><button class="v15Btn primary" data-v15-seller>Copy Seller Request</button></div></div><div class="v15Body"><div class="v15GapGrid"><div class="v15GapBox"><h4>Missing Information</h4>${gapList(sc.missingFacts,'fact')}</div><div class="v15GapBox"><h4>Missing Documents</h4>${gapList(sc.missingDocs,'doc')}</div></div><div class="v15FileRow">${state.docs.length?'Files on hand: '+state.docs.map(x=>`<span>${esc(x.name)}</span>`).join(''):'No supporting files are currently stored for this deal.'}</div></div></section>

      <section class="v15Panel"><div class="v15Head"><div><div class="eyebrow">INVESTOR MATERIALS</div><h3>Generate what you need</h3><p>All outputs use the same package. Internal mandate matching stays out of investor-facing documents.</p></div></div><div class="v15Body"><div class="v15Outputs"><article class="v15Output"><h4>Investor Teaser</h4><p>Clean first-pass material for initial investor review.</p><button class="v15Btn primary" data-v15-doc="teaser">Generate</button></article><article class="v15Output"><h4>Investment Memorandum</h4><p>Structured investor memo using the current source-backed package.</p><button class="v15Btn primary" data-v15-doc="memo">Generate</button></article><article class="v15Output"><h4>Capital Summary</h4><p>Transaction structure, capitalization and sources and uses.</p><button class="v15Btn primary" data-v15-doc="sources">Generate</button></article><article class="v15Output"><h4>Diligence Package</h4><p>Data-room index and remaining-source checklist.</p><button class="v15Btn primary" data-v15-doc="checklist">Generate</button></article></div></div></section>

      <section id="v15Review" class="v15Panel v15Review"><div class="v15Head"><div><div class="eyebrow">REVIEW / CORRECT</div><h3>Only open this when something needs changing</h3><p>Detected source facts are used automatically. Correct them here only when the source extraction is wrong or you have new information.</p></div><div class="v15Actions"><button class="v15Btn primary" data-v15-save>Save Changes</button><button class="v15Btn" data-v15-close>Close</button></div></div><div class="v15Body"><div class="v15ReviewGrid">${reviewFields}</div></div></section>`;
  }

  function collect(){const out={...(state.workspace?.intake||{})};document.querySelectorAll('[data-v15-source]').forEach(el=>{out[el.dataset.v15Source]=el.value.trim()});out.__generated={...(state.generatedMeta||{})};return out}
  async function save(){const intake=collect(),generated_assets=state.workspace?.generated_assets||{};const {error}=await sb.from('deal_workspaces').upsert({deal_id:state.deal.id,owner_id:state.user.id,intake,generated_assets,updated_at:new Date().toISOString()},{onConflict:'deal_id'});if(error)throw error;await refresh()}
  function safeName(name){return String(name||'document').normalize('NFKD').replace(/[^a-zA-Z0-9._-]+/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'').slice(-120)||'document'}
  function mimeFor(file){const ext=(file.name.split('.').pop()||'').toLowerCase();if(ext==='pdf')return'application/pdf';if(ext==='docx')return'application/vnd.openxmlformats-officedocument.wordprocessingml.document';if(ext==='xlsx')return'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';return file.type||'application/octet-stream'}
  async function uploadFiles(files){for(const file of files){if(!/\.(pdf|docx|xlsx)$/i.test(file.name)||file.size>10*1024*1024)continue;const path=`${state.user.id}/${state.deal.id}/${Date.now()}-${Math.random().toString(36).slice(2,7)}-${safeName(file.name)}`;const {error}=await sb.storage.from('deal-documents').upload(path,file,{contentType:mimeFor(file),upsert:false});if(error)throw error}await refresh()}
  async function refresh(){if(loading)return;if(!$('capitalDealSelect')?.value)return;loading=true;try{if(await loadState())render()}catch(e){console.error('capital suite v15',e);const root=mount();if(root)root.innerHTML=`<div class="empty">Could not load Capital Suite. ${esc(e?.message||'Unknown error')}</div>`}finally{loading=false}}
  function schedule(){[0,250,700,1400].forEach(ms=>setTimeout(()=>{patchShell();refresh()},ms))}
  function boot(){styles();patchShell();let n=0;const tick=()=>{n++;patchShell();if($('capitalDealSelect')&&$('capitalSection')?.querySelector('.capitalControls')){schedule();return}if(n<80)setTimeout(tick,250)};tick();setInterval(patchShell,4000)}

  document.addEventListener('click',async e=>{
    if(e.target.closest('.navBtn[data-section="capital"],#capitalRefresh')){schedule();return}
    const review=e.target.closest('[data-v15-review]');if(review){$('v15Review')?.classList.add('open');$('v15Review')?.scrollIntoView({behavior:'smooth',block:'start'});return}
    if(e.target.closest('[data-v15-close]')){$('v15Review')?.classList.remove('open');return}
    const saveBtn=e.target.closest('[data-v15-save]');if(saveBtn){saveBtn.disabled=true;try{await save();saveBtn.textContent='Saved'}catch(err){alert(err?.message||'Could not save.')}finally{setTimeout(()=>saveBtn.textContent='Save Changes',900);saveBtn.disabled=false}return}
    const req=e.target.closest('[data-v15-seller]');if(req){const text=sellerRequest(status());try{await navigator.clipboard.writeText(text);req.textContent='Request Copied';setTimeout(()=>req.textContent='Copy Seller Request',1200)}catch(_){alert(text)}return}
    if(e.target.closest('[data-v15-upload]')){$('v15SourceUpload')?.click();return}
    const doc=e.target.closest('[data-v15-doc]');if(doc){e.preventDefault();e.stopImmediatePropagation();window.OuterHavenCapitalDocsV9?.renderAsset(doc.dataset.v15Doc);return}
  },true);
  document.addEventListener('change',async e=>{if(e.target?.id==='capitalDealSelect'){schedule();return}if(e.target?.id==='v15SourceUpload'){const files=[...(e.target.files||[])];e.target.value='';if(files.length)try{await uploadFiles(files)}catch(err){alert(err?.message||'Could not upload source files.')}}},true);

  window.OuterHavenCapitalSuiteV15={refresh,status:()=>status(),sellerRequest:()=>sellerRequest(status())};
  boot();
})();