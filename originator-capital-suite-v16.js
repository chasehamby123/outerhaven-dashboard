(function(){
  if(window.__outerhavenCapitalSuiteV16)return;
  window.__outerhavenCapitalSuiteV16=true;
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
    use_of_proceeds:'Investors need to understand what the requested capital actually funds.',ownership:'Ownership matters when new equity, control or a joint venture is part of the transaction.',existing_debt:'Current leverage is necessary when the transaction itself is a financing or refinancing.',valuation:'Pricing is necessary for a sale or acquisition package to be decision-useful.',sponsor_equity:'Sponsor capital is necessary for a development or structured-capital case where alignment is part of underwriting.',historical_performance:'Historical performance is necessary to underwrite an operating business or stabilized asset.',forecast:'A forward case is necessary when investors are funding growth, development or future cash flow.',exit_strategy:'Repayment or exit is necessary when capital is expected to be returned through a defined path.',asset_value:'Asset value is necessary to frame an operating real-estate transaction.',noi:'NOI or equivalent property cash flow is necessary to underwrite an operating real-estate asset.',project_status:'Development status is necessary to understand what has been completed and what capital still has to accomplish.',development_budget:'The development budget is necessary to understand total cost and remaining capital need.',site_control:'Site control is necessary for a development case because the project cannot be underwritten without control of the underlying site.',collateral_security:'Security is necessary when the transaction is explicitly debt financing.'
  };

  let state={user:null,deal:null,workspace:null,docs:[],effective:{},derived:{},generated:{},generatedMeta:{}};
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
    else {out.push('use_of_proceeds','forecast')}
    return[...new Set(out)];
  }

  function req(id,label,patterns,reason){return{id,label,patterns,reason}}
  function requiredDocs(d){
    const f=flags(d),out=[req('overview','Current deal deck / CIM',[/req-overview-/,/cim/,/memorandum/,/teaser/,/deck/,/one.?pager/,/overview/,/pitch/],'We need one current source document that describes the opportunity we are packaging.')];
    if(f.re&&f.development)out.push(req('development','Development budget or underwriting model',[/req-development-/,/development.?budget/,/construction.?budget/,/project.?budget/,/model/,/forecast/,/pro.?forma/],'A development package needs one source that supports total cost and the forward underwriting case.'));
    else if(f.re)out.push(req('propertyops','Property operating support',[/req-propertyops-/,/noi/,/rent.?roll/,/occupancy/,/revpar/,/adr/,/property.?operating/,/financial/],'An operating real-estate package needs one source supporting current property cash flow or operating performance.'));
    else if(f.sale||f.acq)out.push(req('historicals','Historical financial support',[/req-historicals-/,/financial/,/p.?&.?l/,/income.?statement/,/management.?accounts/,/audit/,/qoe/],'A sale or acquisition package needs a source supporting historical operating performance.'));
    else out.push(req('financial','Financials or forecast/model',[/req-financial-/,/financial/,/model/,/forecast/,/projection/,/pro.?forma/,/p.?&.?l/,/income.?statement/],'A capital-raise package needs at least one financial source supporting the operating or forward case.'));
    return out;
  }

  function laterDiligence(d){
    const f=flags(d),out=[];
    out.push(req('ownership','Ownership / cap table support',[/cap.?table/,/ownership/,/shareholder/,/org.?chart/,/corporate.?structure/],'Supports ownership and control during diligence.'));
    if(f.debt||f.acq||f.re)out.push(req('debt','Debt schedule / financing detail',[/debt.?schedule/,/loan/,/credit.?facility/,/mortgage/,/lender/],'Supports detailed leverage review later in diligence.'));
    if(f.sale||f.acq)out.push(req('transaction','LOI / purchase or sale agreement',[/loi/,/letter.?of.?intent/,/purchase.?agreement/,/sale.?agreement/,/psa/],'Supports final transaction terms once diligence advances.'));
    if(f.re){out.push(req('title','Title / site-control support',[/title/,/deed/,/site.?control/,/leasehold/,/freehold/,/land.?lease/],'Supports legal/property diligence.'));if(f.development)out.push(req('permits','Permits / approvals / project schedule',[/permit/,/approval/,/entitlement/,/project.?schedule/,/construction.?schedule/],'Supports development execution diligence.'));if(f.presale)out.push(req('presales','Pre-sales / reservation support',[/pre.?sale/,/presale/,/reservation/,/contracted.?sale/,/deposit/],'Supports demand claims later in diligence.'));if(f.hospitality)out.push(req('operator','Brand / operator support',[/operator/,/management.?agreement/,/brand/,/marriott/,/hilton/,/hyatt/,/accor/,/ihg/,/st.?regis/,/four.?seasons/],'Supports brand/operator claims later in diligence.'))}
    if(f.debt)out.push(req('security','Security / collateral documentation',[/collateral/,/security/,/guarantee/,/pledge/,/mortgage/],'Supports final credit diligence.'));
    return out;
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
    let rationale=`The transaction is currently structured as ${d?.transaction_type||'a private-market opportunity'}`;if(ask)rationale+=` with ${ask} of stated capital required`;rationale+='.';rationale+=src.use_of_proceeds?` Submitted materials indicate: ${clip(src.use_of_proceeds,260)}`:' The specific use of proceeds will remain flagged until supported by source.';
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
    relevantFacts(d).forEach(k=>{if(filled(saved[k]))eff[k]=saved[k];else if(filled(src[k]))eff[k]=src[k]});
    return{eff,src,gen,gm};
  }

  function docPresent(r){const names=state.docs.map(x=>String(x.name||'').toLowerCase());return names.some(n=>n.includes(`req-${r.id}-`)||r.patterns.some(re=>re.test(n)))}

  function status(){
    const d=state.deal||{},allFacts=relevantFacts(d),mustFacts=requiredFacts(d),mustDocs=requiredDocs(d),later=laterDiligence(d);
    const missingFacts=mustFacts.filter(k=>!filled(state.effective[k])),foundFacts=allFacts.filter(k=>filled(state.effective[k])),missingDocs=mustDocs.filter(r=>!docPresent(r)),presentDocs=mustDocs.length-missingDocs.length;
    const core=[!!(d.title&&d.company),Number(d.deal_size)>0,!!(d.sector&&d.geography&&d.transaction_type),!!d.seller_relationship,!!d.authority_confirmed,String(d.summary||'').trim().length>=120];
    const softwarePct=Math.round(generatedKeys.filter(k=>filled(state.effective[k])).length/generatedKeys.length*100);
    const factPct=Math.round((core.filter(Boolean).length+mustFacts.filter(k=>filled(state.effective[k])).length)/(core.length+mustFacts.length)*100);
    const docPct=mustDocs.length?Math.round(presentDocs/mustDocs.length*100):100;
    const readiness=Math.round(softwarePct*.40+factPct*.35+docPct*.25);
    const actions=[...missingFacts.map(k=>({type:'fact',key:k,label:labels[k],reason:help[k]||'This source fact is necessary for the current transaction package.'})),...missingDocs.map(r=>({type:'doc',req:r,label:r.label,reason:r.reason}))];
    return{allFacts,mustFacts,mustDocs,later,missingFacts,foundFacts,missingDocs,presentDocs,softwarePct,factPct,docPct,readiness,actions,next:actions[0]||null};
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
    if($('capitalSuiteV16Style'))return;const s=document.createElement('style');s.id='capitalSuiteV16Style';s.textContent=`
    #capitalSuiteV15Core,#advisorWorkspaceV14Core,#advisorWorkspaceV13Core,#advisorWorkspaceV12Core,#investorSuiteV11Core,#investorSuiteV10Core,#capitalMetrics,#capitalProducts,.capitalPlan,#institutionalReadiness,.institutionalStrip,.passportBtn{display:none!important}.capitalHero{grid-template-columns:1fr!important}.v16{margin:0 0 22px;font-family:Arial,Helvetica,sans-serif}.v16Hero{display:grid;grid-template-columns:160px 1fr;gap:22px;align-items:center;padding:22px;border:1px solid #d9cfc4;border-radius:16px;background:#fff}.v16Ring{--p:0;width:138px;height:138px;border-radius:50%;display:grid;place-items:center;position:relative;background:conic-gradient(#245b43 calc(var(--p)*1%),#ece7e1 0);margin:auto}.v16Ring:after{content:'';position:absolute;inset:13px;border-radius:50%;background:#fff}.v16Ring div{position:relative;z-index:1;text-align:center}.v16Ring strong{display:block;font-size:33px}.v16Ring span{font-size:6.8px;font-weight:850;letter-spacing:.09em;text-transform:uppercase;color:#786b5e}.v16Hero h3{margin:3px 0 7px;font-size:22px}.v16Hero p{margin:0;color:#6e6258;font-size:10px;line-height:1.55}.v16Stats{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}.v16Stat{padding:9px 11px;border:1px solid #e2d9cf;border-radius:9px;background:#faf8f5}.v16Stat span{font-size:6.4px;text-transform:uppercase;letter-spacing:.07em;font-weight:850;color:#847568}.v16Stat strong{display:block;margin-top:3px;font-size:14px}.v16Panel{margin-top:14px;border:1px solid #d9cfc4;border-radius:15px;background:#fff;overflow:hidden}.v16Head{display:flex;justify-content:space-between;gap:14px;align-items:center;padding:17px 19px;background:#f8f5f0}.v16Head h3{margin:3px 0 3px;font-size:18px}.v16Head p{margin:0;font-size:9px;line-height:1.48;color:#71655b}.v16Body{padding:18px 19px}.v16Actions{display:flex;gap:7px;flex-wrap:wrap}.v16Btn{border:1px solid #cfc3b6;border-radius:8px;padding:8px 10px;background:#fff;color:#2b251f;font:800 8.5px Arial,sans-serif;cursor:pointer}.v16Btn.primary{background:#211d19;color:#fff;border-color:#211d19}.v16Done{display:grid;grid-template-columns:repeat(5,1fr);gap:8px}.v16Done div{padding:12px;border:1px solid #e2dad1;border-radius:10px;background:#fcfbf9}.v16Done strong{display:block;font-size:9px}.v16Done span{display:inline-block;margin-top:6px;padding:4px 6px;border-radius:999px;background:#e8f0ec;color:#356147;font-size:6.1px;font-weight:850;text-transform:uppercase}.v16Next{padding:18px;border:1px solid #d8c9b8;border-radius:13px;background:linear-gradient(135deg,#fffdf9,#f8f2ea)}.v16NextTop{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.v16NextTop span{font-size:7px;font-weight:850;text-transform:uppercase;letter-spacing:.08em;color:#8b745b}.v16Next h4{margin:5px 0 6px;font-size:17px}.v16Next p{margin:0 0 12px;font-size:9px;line-height:1.55;color:#6e6258}.v16Input{width:100%;min-height:74px;box-sizing:border-box;resize:vertical;border:1px solid #d4c7b9;border-radius:9px;padding:10px;font:9.5px/1.5 Arial,sans-serif;background:#fff}.v16Complete{padding:18px;border-radius:12px;background:#edf3ef;color:#355f49}.v16Complete strong{display:block;font-size:14px;margin-bottom:4px}.v16Complete p{margin:0;font-size:9px;line-height:1.5}.v16Outputs{display:grid;grid-template-columns:repeat(4,1fr);gap:9px}.v16Output{padding:14px;border:1px solid #e1d8cf;border-radius:11px}.v16Output h4{margin:0 0 5px;font-size:12px}.v16Output p{margin:0 0 10px;font-size:8px;line-height:1.45;color:#70645a}.v16Details,.v16Later{display:none}.v16Details.open,.v16Later.open{display:block}.v16DetailGrid{display:grid;grid-template-columns:1fr 1fr;gap:9px}.v16Detail{padding:12px;border:1px solid #e3dbd2;border-radius:10px;background:#fcfbf9}.v16Detail label{display:block;margin-bottom:5px;font-size:7px;font-weight:850;text-transform:uppercase;color:#74675c}.v16Detail p{margin:0;white-space:pre-wrap;font-size:8.5px;line-height:1.5;color:#5f564e}.v16FactList{display:flex;gap:6px;flex-wrap:wrap;margin-top:12px}.v16FactList span{padding:5px 7px;border:1px solid #e1d8cf;border-radius:999px;background:#fbfaf8;font-size:7px}.v16LaterItem{padding:9px 0;border-bottom:1px solid #eee7df}.v16LaterItem:last-child{border:0}.v16LaterItem strong{display:block;font-size:8.5px}.v16LaterItem p{margin:3px 0 0;font-size:7.5px;line-height:1.4;color:#7c7066}.v16Upload{display:none}@media(max-width:900px){.v16Hero{grid-template-columns:1fr}.v16Done,.v16Outputs{grid-template-columns:1fr 1fr}.v16DetailGrid{grid-template-columns:1fr}}@media(max-width:600px){.v16Done,.v16Outputs{grid-template-columns:1fr}}`;
    document.head.appendChild(s);
  }

  function patchShell(){
    const nav=qs('.navBtn[data-section="capital"] span');if(nav)nav.textContent='Capital Suite';
    const deals=qs('.navBtn[data-section="submissions"] span');if(deals)deals.textContent='Deals';
    if($('topSubmit'))$('topSubmit').textContent='+ New Deal';
    const hero=$('capitalSection')?.querySelector('.capitalHeroCard');if(hero){const e=hero.querySelector('.eyebrow'),h=hero.querySelector('h2'),p=hero.querySelector('p');if(e)e.textContent='OUTERHAVEN CAPITAL SUITE';if(h)h.textContent='Turn source material into an investor-ready package.';if(p)p.textContent='Capital Suite shows what is already complete, then gives you one necessary next step at a time.'}
    const ph=$('capitalSection')?.querySelector('.panelHead h2');if(ph)ph.textContent='Capital Suite';
    const pp=$('capitalSection')?.querySelector('.panelHead p');if(pp)pp.textContent='Select a deal. The suite keeps the process focused on the next necessary action.';
  }

  function mount(){const panel=$('capitalSection')?.querySelector('.panel'),controls=panel?.querySelector('.capitalControls');if(!panel||!controls)return null;let root=$('capitalSuiteV16Core');if(!root){root=document.createElement('div');root.id='capitalSuiteV16Core';root.className='v16';controls.after(root)}return root}

  function nextStep(sc){
    const n=sc.next;if(!n)return`<div class="v16Complete"><strong>Initial package requirements are complete.</strong><p>Capital Suite has the source information needed for the current investor package. Additional diligence items are tracked separately and do not block these materials.</p></div>`;
    const count=sc.actions.length;
    if(n.type==='fact')return`<div class="v16Next"><div class="v16NextTop"><div><span>Next necessary step · 1 of ${count} remaining</span><h4>${esc(n.label)}</h4></div><span>Source fact</span></div><p>${esc(n.reason)}</p><textarea id="v16NextFact" class="v16Input" placeholder="Add the source-backed answer here. Do not draft a narrative."></textarea><div class="v16Actions" style="margin-top:10px"><button class="v16Btn primary" data-v16-save-next="${esc(n.key)}">Save & Continue</button><button class="v16Btn" data-v16-request>Copy Request</button></div></div>`;
    return`<div class="v16Next"><div class="v16NextTop"><div><span>Next necessary step · 1 of ${count} remaining</span><h4>${esc(n.label)}</h4></div><span>Source document</span></div><p>${esc(n.reason)}</p><input id="v16SourceUpload" class="v16Upload" type="file" accept=".pdf,.docx,.xlsx"><div class="v16Actions"><button class="v16Btn primary" data-v16-upload="${esc(n.req.id)}">Upload This Document</button><button class="v16Btn" data-v16-request>Copy Request</button></div></div>`;
  }

  function requestText(sc){
    const n=sc.next;if(!n)return'The current investor-package requirements are complete.';
    if(n.type==='fact')return`Source Information Request\n\nFor ${state.deal?.title||'this opportunity'}, please provide the following factual information:\n\n${n.label}\n${n.reason}\n\nNo narrative drafting is required.`;
    return`Source Document Request\n\nFor ${state.deal?.title||'this opportunity'}, please provide:\n\n${n.label}\n${n.reason}\n\nNo additional narrative drafting is required.`;
  }

  function render(){
    const root=mount();if(!root||!state.deal)return;patchShell();const sc=status();
    const built=generatedKeys.map(k=>`<div><strong>${esc(labels[k])}</strong><span>Complete</span></div>`).join('');
    const detail=generatedKeys.map(k=>`<div class="v16Detail"><label>${esc(labels[k])}</label><p>${esc(state.effective[k]||'')}</p></div>`).join('');
    const found=sc.foundFacts.length?sc.foundFacts.map(k=>`<span>${esc(labels[k])}</span>`).join(''):'<span>No additional source facts detected yet</span>';
    const later=sc.later.map(r=>`<div class="v16LaterItem"><strong>${esc(r.label)}</strong><p>${esc(r.reason)}</p></div>`).join('')||'<div class="v16LaterItem"><strong>No additional diligence items are currently flagged.</strong></div>';
    root.innerHTML=`
      <section class="v16Hero"><div><div class="v16Ring" style="--p:${sc.readiness}"><div><strong>${sc.readiness}%</strong><span>Package Readiness</span></div></div></div><div><div class="eyebrow">CAPITAL SUITE</div><h3>We show the work already done, then one next step.</h3><p>The readiness score only uses requirements necessary for the current investor package. Later diligence is tracked separately and does not reduce this score.</p><div class="v16Stats"><div class="v16Stat"><span>OuterHaven Work</span><strong>${sc.softwarePct}%</strong></div><div class="v16Stat"><span>Source Facts Captured</span><strong>${sc.foundFacts.length}</strong></div><div class="v16Stat"><span>Required Files Covered</span><strong>${sc.presentDocs}/${sc.mustDocs.length}</strong></div><div class="v16Stat"><span>Necessary Steps Left</span><strong>${sc.actions.length}</strong></div></div></div></section>

      <section class="v16Panel"><div class="v16Head"><div><div class="eyebrow">WHAT OUTERHAVEN HAS DONE</div><h3>Your package is being built before you do more work</h3><p>These investor-facing components are already maintained from the deal record and source material.</p></div><div class="v16Actions"><button class="v16Btn" data-v16-details>View What We Built</button></div></div><div class="v16Body"><div class="v16Done">${built}</div><div class="v16FactList">${found}</div></div><div id="v16Details" class="v16Details"><div class="v16Body"><div class="v16DetailGrid">${detail}</div></div></div></section>

      <section class="v16Panel"><div class="v16Head"><div><div class="eyebrow">NEXT STEP</div><h3>Only deal with what matters now</h3><p>You will see one necessary source item at a time. Completing it automatically advances the suite to the next item.</p></div></div><div class="v16Body">${nextStep(sc)}</div></section>

      <section class="v16Panel"><div class="v16Head"><div><div class="eyebrow">INVESTOR MATERIALS</div><h3>Generate the current package at any point</h3><p>Outputs use the work already completed plus the source information currently available.</p></div></div><div class="v16Body"><div class="v16Outputs"><article class="v16Output"><h4>Investor Teaser</h4><p>First-pass material for initial investor review.</p><button class="v16Btn primary" data-v16-doc="teaser">Generate</button></article><article class="v16Output"><h4>Investment Memorandum</h4><p>Structured investor memo using the current package.</p><button class="v16Btn primary" data-v16-doc="memo">Generate</button></article><article class="v16Output"><h4>Capital Summary</h4><p>Transaction structure, capitalization and sources and uses.</p><button class="v16Btn primary" data-v16-doc="sources">Generate</button></article><article class="v16Output"><h4>Diligence Package</h4><p>Current room index and source checklist.</p><button class="v16Btn primary" data-v16-doc="checklist">Generate</button></article></div></div></section>

      <section class="v16Panel"><div class="v16Head"><div><div class="eyebrow">LATER DILIGENCE</div><h3>${sc.later.length} item${sc.later.length===1?'':'s'} tracked for later</h3><p>These may matter deeper in diligence, but they do not block the initial investor package.</p></div><button class="v16Btn" data-v16-later>View Later Diligence</button></div><div id="v16Later" class="v16Later"><div class="v16Body">${later}</div></div></section>`;
  }

  async function saveNext(key){
    const val=$('v16NextFact')?.value.trim();if(!filled(val)){alert('Please add the source-backed answer before continuing.');return}
    const intake={...(state.workspace?.intake||{})};intake[key]=val;intake.__generated={...(state.generatedMeta||{})};
    const {error}=await sb.from('deal_workspaces').upsert({deal_id:state.deal.id,owner_id:state.user.id,intake,generated_assets:state.workspace?.generated_assets||{},updated_at:new Date().toISOString()},{onConflict:'deal_id'});if(error)throw error;await refresh();
  }

  function safeName(name){return String(name||'document').normalize('NFKD').replace(/[^a-zA-Z0-9._-]+/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'').slice(-120)||'document'}
  function mimeFor(file){const ext=(file.name.split('.').pop()||'').toLowerCase();if(ext==='pdf')return'application/pdf';if(ext==='docx')return'application/vnd.openxmlformats-officedocument.wordprocessingml.document';if(ext==='xlsx')return'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';return file.type||'application/octet-stream'}
  async function uploadCurrent(file,reqId){
    if(!file||!/\.(pdf|docx|xlsx)$/i.test(file.name)){alert('Please choose a PDF, DOCX, or XLSX file.');return}if(file.size>10*1024*1024){alert('File must be 10MB or smaller.');return}
    const path=`${state.user.id}/${state.deal.id}/REQ-${reqId}-${Date.now()}-${safeName(file.name)}`;const {error}=await sb.storage.from('deal-documents').upload(path,file,{contentType:mimeFor(file),upsert:false});if(error)throw error;await refresh();
  }

  async function refresh(){if(loading)return;if(!$('capitalDealSelect')?.value)return;loading=true;try{if(await loadState())render()}catch(e){console.error('capital suite v16',e);const root=mount();if(root)root.innerHTML=`<div class="empty">Could not load Capital Suite. ${esc(e?.message||'Unknown error')}</div>`}finally{loading=false}}
  function schedule(){[0,250,700,1400].forEach(ms=>setTimeout(()=>{patchShell();refresh()},ms))}
  function boot(){styles();patchShell();let n=0;const tick=()=>{n++;patchShell();if($('capitalDealSelect')&&$('capitalSection')?.querySelector('.capitalControls')){schedule();return}if(n<80)setTimeout(tick,250)};tick();setInterval(patchShell,4000)}

  document.addEventListener('click',async e=>{
    if(e.target.closest('.navBtn[data-section="capital"],#capitalRefresh')){schedule();return}
    const details=e.target.closest('[data-v16-details]');if(details){$('v16Details')?.classList.toggle('open');details.textContent=$('v16Details')?.classList.contains('open')?'Hide Details':'View What We Built';return}
    const later=e.target.closest('[data-v16-later]');if(later){$('v16Later')?.classList.toggle('open');later.textContent=$('v16Later')?.classList.contains('open')?'Hide Later Diligence':'View Later Diligence';return}
    const save=e.target.closest('[data-v16-save-next]');if(save){save.disabled=true;try{await saveNext(save.dataset.v16SaveNext)}catch(err){alert(err?.message||'Could not save.')}finally{save.disabled=false}return}
    const request=e.target.closest('[data-v16-request]');if(request){const text=requestText(status());try{await navigator.clipboard.writeText(text);request.textContent='Request Copied';setTimeout(()=>request.textContent='Copy Request',1200)}catch(_){alert(text)}return}
    const up=e.target.closest('[data-v16-upload]');if(up){const input=$('v16SourceUpload');if(!input)return;input.dataset.reqId=up.dataset.v16Upload;input.click();return}
    const doc=e.target.closest('[data-v16-doc]');if(doc){e.preventDefault();e.stopImmediatePropagation();window.OuterHavenCapitalDocsV9?.renderAsset(doc.dataset.v16Doc);return}
  },true);

  document.addEventListener('change',async e=>{
    if(e.target?.id==='capitalDealSelect'){schedule();return}
    if(e.target?.id==='v16SourceUpload'){const file=e.target.files?.[0],reqId=e.target.dataset.reqId;e.target.value='';if(file&&reqId)try{await uploadCurrent(file,reqId)}catch(err){alert(err?.message||'Could not upload file.')}}
  },true);

  window.OuterHavenCapitalSuiteV16={refresh,status:()=>status(),request:()=>requestText(status())};
  boot();
})();