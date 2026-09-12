(function(){
  if(window.__outerhavenAdvisorWorkspaceV14)return;
  window.__outerhavenAdvisorWorkspaceV14=true;
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
    investment_thesis:['Investment Thesis','OuterHaven drafts the investor case from the submitted transaction and source material.'],
    transaction_rationale:['Transaction Narrative','OuterHaven drafts what is happening, why it matters, and what still needs factual confirmation.'],
    market_position:['Market Positioning','OuterHaven converts known market, asset and operating facts into investor-facing positioning.'],
    risks:['Risk Analysis','OuterHaven identifies transaction-specific underwriting risks without claiming unsupported problems.'],
    mitigants:['Mitigants','OuterHaven uses only mitigants supported by submitted facts or documents.'],
    use_of_proceeds:['Use of Proceeds','What will the capital fund, acquire, refinance or support?'],
    ownership:['Ownership & Capitalization','Who owns the business, sponsor or asset today and what is the current capitalization?'],
    existing_debt:['Existing Debt','Current lenders, balances, rates, maturities, security and material obligations.'],
    valuation:['Valuation / Pricing','Stated valuation, purchase price, asking price, cap rate or pricing framework.'],
    sponsor_equity:['Sponsor Equity','Capital already invested by the sponsor and any additional contribution.'],
    historical_performance:['Historical Performance','Historical revenue, EBITDA, NOI, growth or other relevant results.'],
    forecast:['Forecast / Business Plan','Management or sponsor forecast and the assumptions that drive it.'],
    exit_strategy:['Exit / Repayment','How investor capital is expected to be repaid, refinanced, sold or otherwise exited.'],
    timeline:['Timeline','Key milestones and target timing through close, development, stabilization or exit.'],
    asset_value:['Asset Value / Purchase Price','Current asset value, appraised value or purchase price.'],
    noi:['NOI / Property Cash Flow','Current and stabilized NOI or equivalent property cash flow.'],
    operating_metrics:['Operating Metrics','Occupancy, ADR, RevPAR, unit count, utilization or other underwriting KPIs.'],
    project_status:['Project / Development Status','What has been completed, what remains and the current execution status.'],
    development_budget:['Development / Construction Budget','Total development budget including material hard and soft costs.'],
    site_control:['Site Control / Title','How the property is controlled and what title, leasehold or freehold position applies.'],
    presales:['Pre-sales / Contracted Sales','Reservations, deposits, pre-sales or contracted sales already in place.'],
    operator_brand:['Brand / Operator Status','Hotel brand, operator or management agreement and current status.'],
    collateral_security:['Collateral / Security','Collateral, guarantees or security supporting the financing.'],
    management_team:['Management / Sponsor Team','Key decision-makers, operators and sponsors.'],
    key_contracts:['Key Contracts / Counterparties','Material customer, supplier, operator, lease or other contracts.'],
    regulatory:['Regulatory / Licensing','Permits, licenses, approvals or regulatory matters investors should understand.'],
    investor_facing_notes:['Additional Investor Information','Any other verified facts that should appear in investor materials.'],
    private_advisor_notes:['Private Advisor Notes','Private working notes. Never included in investor-facing materials.']
  };

  let state={user:null,deal:null,workspace:null,docs:[],effective:{},derived:{},generated:{},generatedMeta:{},confirmed:{}};
  let loading=false;

  function flags(d){
    const t=norm(d?.transaction_type);
    const all=norm(`${d?.sector||''} ${d?.title||''} ${d?.company||''} ${d?.summary||''}`);
    return{
      sale:/sale|sell side|divest|exit/.test(t),
      acq:/acquisition|buyout|purchase|m a/.test(t),
      debt:/debt|loan|credit|refinanc|unitranche|mezz/.test(t),
      equity:/equity|growth capital|minority|majority/.test(t),
      jv:/joint venture|\bjv\b/.test(t),
      re:/real estate|hospitality|hotel|resort|property|multifamily|self storage|commercial property/.test(all),
      hospitality:/hospitality|hotel|resort|branded residence|villa/.test(all),
      development:/development|construction|ground up|ground-up|pre sale|pre-sale|presale/.test(all),
      presale:/pre sale|pre-sale|presale|pre sold|pre-sold|contracted sales|reservation/.test(all),
      operating:!/real estate|hospitality|hotel|resort|property/.test(all)
    };
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
    if(f.re){
      out.push('asset_value','site_control');
      if(f.development)out.push('project_status','development_budget'); else out.push('noi');
      if(f.hospitality)out.push('operator_brand','operating_metrics');
      if(f.presale)out.push('presales');
    }
    return [...new Set(out)];
  }

  function sourceRequirements(d){
    const f=flags(d),r=[];
    r.push(['overview','CIM / teaser / deal deck','01 Investment Materials',[/cim/,/memorandum/,/teaser/,/deck/,/one.?pager/,/overview/,/pitch/],'Core source material for the opportunity.']);
    if(!f.development||Number(d?.revenue)>0||Number(d?.ebitda)>0)r.push(['historicals','Historical financials / operating statements','03 Financial & Underwriting',[/financial/,/p.?&.?l/,/income.?statement/,/balance.?sheet/,/management.?accounts/,/operating.?statement/,/audit/],'Supports historical performance.']);
    r.push(['model','Forecast / model / business plan','03 Financial & Underwriting',[/model/,/forecast/,/projection/,/pro.?forma/,/business.?plan/,/budget/],'Supports the forward underwriting case.']);
    r.push(['ownership','Ownership / cap table / sponsor structure','02 Transaction & Ownership',[/cap.?table/,/ownership/,/shareholder/,/org.?chart/,/corporate.?structure/],'Supports ownership and control.']);
    if(f.debt||f.acq||f.re)r.push(['debt','Debt schedule / financing detail','02 Transaction & Ownership',[/debt.?schedule/,/loan/,/credit.?facility/,/mortgage/,/financing.?schedule/,/lender/],'Supports leverage and refinancing analysis.']);
    if(f.sale||f.acq)r.push(['transaction','Transaction document / LOI / purchase agreement','02 Transaction & Ownership',[/loi/,/letter.?of.?intent/,/purchase.?agreement/,/sale.?agreement/,/psa/,/transaction.?document/],'Supports transaction terms and pricing where available.']);
    if(f.re){
      r.push(['site','Title / site-control support','04 Asset & Project',[/title/,/deed/,/site.?control/,/leasehold/,/freehold/,/land.?lease/,/purchase.?agreement/,/psa/],'Confirms control of the property or site.']);
      if(!f.development)r.push(['propertyops','Property operating support','03 Financial & Underwriting',[/noi/,/rent.?roll/,/occupancy/,/revpar/,/adr/,/property.?operating/],'Supports property-level operating assumptions.']);
      if(f.development){
        r.push(['devbudget','Development / construction budget','04 Asset & Project',[/development.?budget/,/construction.?budget/,/project.?budget/,/hard.?cost/,/soft.?cost/],'Supports total project cost and remaining capital needs.']);
        r.push(['schedule','Project schedule / permits / approvals','04 Asset & Project',[/project.?schedule/,/construction.?schedule/,/permit/,/approval/,/entitlement/,/planning/],'Supports execution timing and development readiness.']);
      }
      if(f.presale)r.push(['presales','Pre-sales / reservation support','05 Commercial',[/pre.?sale/,/presale/,/reservation/,/contracted.?sale/,/deposit/],'Supports stated pre-sales or contracted demand.']);
      if(f.hospitality)r.push(['operator','Brand / operator support','05 Commercial',[/operator/,/management.?agreement/,/brand/,/marriott/,/hilton/,/hyatt/,/accor/,/ihg/,/st.?regis/,/four.?seasons/],'Supports the hotel brand or operator relationship.']);
    }
    if(f.debt)r.push(['collateral','Collateral / security support','02 Transaction & Ownership',[/collateral/,/security/,/guarantee/,/pledge/,/mortgage/],'Supports the proposed security package.']);
    return r;
  }

  function sentence(text,re){
    return String(text||'').replace(/\s+/g,' ').split(/(?<=[.!?;])\s+/).find(x=>re.test(x))||'';
  }
  function clip(text,max=380){
    const s=String(text||'').replace(/\s+/g,' ').replace(/^the investment case\s*/i,'').trim();
    if(s.length<=max)return s;
    const c=s.slice(0,max),p=Math.max(c.lastIndexOf('. '),c.lastIndexOf('; '));
    return (p>180?c.slice(0,p+1):c.slice(0,c.lastIndexOf(' ')))+'…';
  }

  function deriveSource(d){
    const s=String(d?.summary||''),out={};
    if(Number(d?.revenue)>0||Number(d?.ebitda)>0){
      const b=[];if(Number(d.revenue)>0)b.push(`Revenue: ${money(d.revenue)}`);if(Number(d.ebitda)>0)b.push(`EBITDA: ${money(d.ebitda)}`);out.historical_performance=b.join(' · ');
    }
    const map=[
      ['use_of_proceeds',/use of proceeds|proceeds will|funds will|capital will|raise is for/i],['ownership',/ownership|owned by|shareholder|cap table|sponsor owns|founder owns|equity split/i],['existing_debt',/existing debt|current debt|loan|credit facility|mortgage|leverage/i],['valuation',/valuation|purchase price|asking price|enterprise value|equity value|cap rate/i],['forecast',/forecast|projected|projection|pro forma|stabilized|expected to grow|expected revenue|expected ebitda|irr|moic/i],['exit_strategy',/exit|repayment|refinance|sale after|liquidity path|hold period/i],['timeline',/timeline|closing|close by|target close|milestone|completion date|stabilization|year [0-9]/i],['sponsor_equity',/sponsor equity|equity contribution|skin in the game|already invested|sponsor invested/i],['asset_value',/asset value|property value|purchase price|appraised value/i],['noi',/\bnoi\b|net operating income/i],['operating_metrics',/occupancy|\badr\b|revpar|keys|rooms|units|utilization/i],['project_status',/construction|development stage|project status|groundbreak|completion|permit|entitlement/i],['development_budget',/development budget|construction budget|project cost|hard cost|soft cost|construction cost/i],['site_control',/site control|title|freehold|leasehold|land owned|property owned/i],['presales',/pre sold|pre-sold|pre sale|pre-sale|presale|reservations|contracted sales/i],['operator_brand',/operator|management agreement|brand engagement|marriott|hilton|hyatt|accor|ihg|four seasons|st regis/i],['collateral_security',/collateral|security package|guarantee|pledge/i]
    ];
    map.forEach(([k,re])=>{const v=sentence(s,re);if(v)out[k]=v});
    return out;
  }

  function softwareDraft(d,src){
    const f=flags(d),ask=money(d?.deal_size),summary=clip(d?.summary,420),parts=[];
    if(d?.sector)parts.push(d.sector);if(d?.geography)parts.push(d.geography);
    let thesis=`${d?.title||d?.company||'The opportunity'} is being prepared as ${d?.transaction_type||'a private-market transaction'}`;
    if(parts.length)thesis+=` in ${parts.join(' / ')}`;if(ask)thesis+=` with a stated capital requirement of ${ask}`;thesis+='.';if(summary)thesis+=' '+summary;
    let rationale=`The transaction is currently structured as ${d?.transaction_type||'a private-market opportunity'}`;if(ask)rationale+=` with ${ask} of stated capital required`;rationale+='.';rationale+=src.use_of_proceeds?` Submitted materials indicate: ${clip(src.use_of_proceeds,260)}`:' The specific seller or sponsor rationale and use of proceeds should be confirmed from source before final distribution.';
    let market=`The investor positioning is anchored in the known transaction facts: ${d?.sector||'the stated sector'} exposure in ${d?.geography||'the stated geography'}.`;if(src.operator_brand)market+=` The submitted material references ${clip(src.operator_brand,220)}`;if(src.presales)market+=` It also references ${clip(src.presales,220)}`;market+=' No market-size or competitive claims are assumed beyond submitted materials.';
    const risk=[];if(f.development)risk.push('development execution, construction timing and cost control');if(f.presale)risk.push('pre-sale conversion and collection risk');if(f.hospitality)risk.push('brand/operator execution and operating ramp');if(f.debt)risk.push('leverage, covenant and refinancing risk');if(f.acq)risk.push('transaction execution and diligence risk');if(f.re)risk.push('asset valuation, title/site control and exit liquidity');if(f.operating)risk.push('revenue durability, margin execution and concentration risk');risk.push('forecast accuracy and capital structure execution');
    const risks=`Key diligence areas identified from the transaction structure include ${[...new Set(risk)].join('; ')}. These are underwriting flags, not claims that a problem exists.`;
    const mit=[];if(src.presales)mit.push('pre-sales or contracted demand referenced in source');if(src.operator_brand)mit.push('brand/operator engagement referenced in source');if(Number(d?.revenue)>0)mit.push(`reported revenue of ${money(d.revenue)}`);if(Number(d?.ebitda)>0)mit.push(`reported EBITDA of ${money(d.ebitda)}`);if(src.site_control)mit.push('site-control information referenced in source');
    const mitigants=mit.length?`Documented factors that may mitigate underwriting risk include ${mit.join('; ')}. Each should be verified against supporting source documents before distribution.`:'No unsupported mitigants have been invented. Final materials should only present mitigants tied to submitted facts or supporting documents.';
    return{investment_thesis:thesis,transaction_rationale:rationale,market_position:market,risks,mitigants};
  }

  function buildEffective(d,w){
    const saved=w?.intake||{},src=deriveSource(d),gen=softwareDraft(d,src);
    const gm=(saved.__generated&&typeof saved.__generated==='object')?saved.__generated:{};
    const confirmed=(saved.__confirmed&&typeof saved.__confirmed==='object')?saved.__confirmed:{};
    const eff={};
    generatedKeys.forEach(k=>{eff[k]=(filled(saved[k])&&!gm[k])?saved[k]:gen[k]});
    sourceKeys(d).forEach(k=>{if(filled(saved[k]))eff[k]=saved[k];else if(filled(src[k]))eff[k]=src[k]});
    ['management_team','key_contracts','regulatory','investor_facing_notes','private_advisor_notes'].forEach(k=>{if(filled(saved[k]))eff[k]=saved[k]});
    return{eff,src,gen,gm,confirmed};
  }

  function docPresent(req){
    const names=state.docs.map(x=>String(x.name||'').toLowerCase());
    return names.some(n=>req[3].some(re=>re.test(n)));
  }

  function readiness(){
    const d=state.deal||{},keys=sourceKeys(d),reqs=sourceRequirements(d);
    const core=[!!(d.title&&d.company),Number(d.deal_size)>0,!!(d.sector&&d.geography&&d.transaction_type),!!d.seller_relationship,!!d.authority_confirmed,String(d.summary||'').trim().length>=120];
    let factEarned=core.filter(Boolean).length,factTotal=core.length;
    keys.forEach(k=>{factTotal++;if(state.confirmed[k])factEarned+=1;else if(filled(state.effective[k]))factEarned+=0.65});
    const facts=Math.round(factEarned/Math.max(1,factTotal)*100);
    const present=reqs.filter(docPresent).length;
    const docs=reqs.length?Math.round(present/reqs.length*100):100;
    const software=Math.round(generatedKeys.filter(k=>filled(state.effective[k])).length/generatedKeys.length*100);
    const evidence=Math.round(facts*0.65+docs*0.35);
    const total=Math.round(software*0.35+evidence*0.65);
    return{software,facts,docs,evidence,total,keys,reqs,present,missingFacts:keys.filter(k=>!filled(state.effective[k])),confirmFacts:keys.filter(k=>filled(state.effective[k])&&!state.confirmed[k]),missingDocs:reqs.filter(r=>!docPresent(r))};
  }

  async function loadState(){
    const id=$('capitalDealSelect')?.value;if(!id)return false;
    const {data:{session}}=await sb.auth.getSession();if(!session)return false;
    const [dr,wr]=await Promise.all([sb.from('deals').select('*').eq('id',id).maybeSingle(),sb.from('deal_workspaces').select('*').eq('deal_id',id).maybeSingle()]);
    if(dr.error)throw dr.error;if(wr.error)throw wr.error;if(!dr.data)return false;
    const ls=await sb.storage.from('deal-documents').list(`${session.user.id}/${id}`,{limit:100,sortBy:{column:'name',order:'asc'}});
    const built=buildEffective(dr.data,wr.data||null);
    state={user:session.user,deal:dr.data,workspace:wr.data||null,docs:ls.error?[]:(ls.data||[]).filter(x=>x.name&&x.id),effective:built.eff,derived:built.src,generated:built.gen,generatedMeta:built.gm,confirmed:built.confirmed};
    await ensureGeneratedSaved();
    return true;
  }

  async function ensureGeneratedSaved(){
    if(!state.user||!state.deal)return;
    const existing={...(state.workspace?.intake||{})};
    const gm={...(state.generatedMeta||{})};
    let changed=false;
    generatedKeys.forEach(k=>{if(!filled(existing[k])||gm[k]){if(existing[k]!==state.generated[k]||!gm[k])changed=true;existing[k]=state.generated[k];gm[k]=true}});
    existing.__generated=gm;
    if(!existing.__confirmed)existing.__confirmed={...(state.confirmed||{})};
    if(!changed&&state.workspace)return;
    const generated_assets=state.workspace?.generated_assets||{};
    const {error}=await sb.from('deal_workspaces').upsert({deal_id:state.deal.id,owner_id:state.user.id,intake:existing,generated_assets,updated_at:new Date().toISOString()},{onConflict:'deal_id'});
    if(error)throw error;
    state.workspace={...(state.workspace||{}),deal_id:state.deal.id,owner_id:state.user.id,intake:existing,generated_assets};
    state.generatedMeta=gm;
  }

  function styles(){
    if($('advisorWorkspaceV14Style'))return;
    const s=document.createElement('style');s.id='advisorWorkspaceV14Style';s.textContent=`
      #advisorWorkspaceV13Core,#advisorWorkspaceV12Core,#investorSuiteV11Core,#investorSuiteV10Core,#capitalMetrics,#capitalProducts,.capitalPlan,#institutionalReadiness,.institutionalStrip,.passportBtn{display:none!important}
      .capitalHero{grid-template-columns:1fr!important}.capitalHeroCard{padding:22px!important}.v14{margin:0 0 20px;font-family:Arial,Helvetica,sans-serif}.v14Hero{display:grid;grid-template-columns:200px 1fr;gap:22px;padding:22px;border:1px solid #d9cfc4;border-radius:16px;background:#fff}.v14Ring{--p:0;width:164px;height:164px;border-radius:50%;display:grid;place-items:center;position:relative;background:conic-gradient(#245b43 calc(var(--p)*1%),#ebe6df 0);margin:auto}.v14Ring:after{content:'';position:absolute;inset:14px;border-radius:50%;background:#fff}.v14Ring>div{position:relative;z-index:1;text-align:center}.v14Ring strong{display:block;font-size:37px;letter-spacing:-.04em}.v14Ring span{font-size:7px;font-weight:850;letter-spacing:.1em;text-transform:uppercase;color:#7b6e62}.v14Hero h3{margin:4px 0 6px;font-size:21px}.v14Hero p{margin:0;font-size:9.5px;line-height:1.6;color:#6f6359}.v14Metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:15px 0}.v14Metric{padding:11px;border:1px solid #e3dbd2;border-radius:9px;background:#faf9f7}.v14Metric span{font-size:6.6px;font-weight:850;letter-spacing:.08em;text-transform:uppercase;color:#87796b}.v14Metric strong{display:block;margin-top:4px;font-size:15px}.v14Next{padding:10px 11px;border-radius:9px;background:#f4eee6;font-size:8.5px;line-height:1.5;color:#66594d}.v14Panel{margin-top:14px;border:1px solid #d9cfc4;border-radius:16px;background:#fff;overflow:hidden}.v14Head{display:flex;justify-content:space-between;gap:16px;align-items:center;padding:17px 19px;background:#f8f5f0}.v14Head h3{margin:3px 0 4px;font-size:18px}.v14Head p{margin:0;max-width:760px;font-size:9px;line-height:1.52;color:#70645a}.v14Body{padding:18px 19px}.v14Actions{display:flex;gap:7px;flex-wrap:wrap}.v14Btn{border:1px solid #cfc3b6;border-radius:8px;padding:8px 10px;background:#fff;color:#2a241f;font:800 8.5px Arial,sans-serif;cursor:pointer}.v14Btn.primary{background:#211d19;color:#fff;border-color:#211d19}.v14Drafts,.v14Facts,.v14Outputs,.v14Optional{display:grid;grid-template-columns:1fr 1fr;gap:10px}.v14Card{padding:14px;border:1px solid #e1d9d0;border-radius:11px;background:#fcfbf9}.v14Top{display:flex;justify-content:space-between;gap:8px;align-items:center}.v14Card h4{margin:0;font-size:12px}.v14Badge{padding:4px 6px;border-radius:999px;font-size:6.2px;font-weight:850;text-transform:uppercase;letter-spacing:.05em}.v14Badge.generated{background:#e8f0ec;color:#356147}.v14Badge.detected{background:#eef0e5;color:#67703f}.v14Badge.required{background:#f5e9df;color:#8a4e32}.v14Badge.confirmed{background:#e8eef5;color:#3f5e7a}.v14Card p{margin:8px 0;font-size:8.8px;line-height:1.56;color:#645a51;white-space:pre-wrap}.v14Card textarea,.v14Optional textarea{width:100%;min-height:78px;resize:vertical;border:1px solid #d7cdc2;border-radius:8px;padding:9px;font:9px/1.5 Arial,sans-serif;box-sizing:border-box}.v14Card small{display:block;margin-top:6px;font-size:7.4px;line-height:1.4;color:#807469}.v14RoomSummary{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:13px}.v14RoomSummary div{padding:10px;border:1px solid #e4ddd5;border-radius:9px;background:#fbfaf8}.v14RoomSummary span{font-size:6.5px;font-weight:850;text-transform:uppercase;letter-spacing:.07em;color:#817367}.v14RoomSummary strong{display:block;margin-top:4px;font-size:15px}.v14Folder{margin:12px 0}.v14FolderTitle{display:flex;gap:8px;align-items:center;margin-bottom:7px}.v14FolderTitle strong{font-size:7px;text-transform:uppercase;letter-spacing:.08em;color:#7f6953}.v14FolderTitle i{height:1px;flex:1;background:#e8e0d8}.v14Req{display:grid;grid-template-columns:1fr auto;gap:12px;align-items:center;padding:10px 11px;border:1px solid #e6dfd7;border-radius:9px;margin:6px 0}.v14Req strong{font-size:9px}.v14Req p{margin:3px 0 0;font-size:7.6px;line-height:1.42;color:#817467}.v14Files{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}.v14File{padding:5px 7px;border:1px solid #dfd6cc;border-radius:999px;background:#fbfaf8;font-size:7px}.v14Output{padding:14px;border:1px solid #e0d7cd;border-radius:11px}.v14Output span{font-size:6.5px;font-weight:850;text-transform:uppercase;letter-spacing:.08em;color:#846f59}.v14Output h4{margin:6px 0 5px;font-size:13px}.v14Output p{margin:0 0 10px;font-size:8.3px;line-height:1.48;color:#6e6258}.v14Optional label{display:block;margin-bottom:5px;font-size:7px;font-weight:850;text-transform:uppercase;letter-spacing:.06em;color:#75685c}.v14Upload{display:none}.v14Note{font-size:8px;line-height:1.45;color:#7a6e63;margin-top:9px}@media(max-width:900px){.v14Hero{grid-template-columns:1fr}.v14Metrics,.v14Drafts,.v14Facts,.v14RoomSummary,.v14Outputs,.v14Optional{grid-template-columns:1fr}}
    `;document.head.appendChild(s);
  }

  function patchShell(){
    const nav=qs('.navBtn[data-section="capital"] span');if(nav)nav.textContent='Advisor Workspace';
    const deals=qs('.navBtn[data-section="submissions"] span');if(deals)deals.textContent='Deals';
    if($('topSubmit'))$('topSubmit').textContent='+ New Deal';
    const hero=$('capitalSection')?.querySelector('.capitalHeroCard');if(hero){const e=hero.querySelector('.eyebrow'),h=hero.querySelector('h2'),p=hero.querySelector('p');if(e)e.textContent='OUTERHAVEN ADVISOR WORKSPACE';if(h)h.textContent='Give us the seller materials. We do the drafting.';if(p)p.textContent='OuterHaven generates the investor narrative, identifies the source gaps, and builds portable materials. You only supply or confirm source truth.'}
    const ph=$('capitalSection')?.querySelector('.panelHead h2');if(ph)ph.textContent='Deal Workspace';
    const pp=$('capitalSection')?.querySelector('.panelHead p');if(pp)pp.textContent='Select a deal. The workspace builds from the same transaction record and source files.';
  }

  function mount(){
    const panel=$('capitalSection')?.querySelector('.panel');
    const controls=panel?.querySelector('.capitalControls');
    if(!panel||!controls)return null;
    let root=$('advisorWorkspaceV14Core');
    if(!root){root=document.createElement('div');root.id='advisorWorkspaceV14Core';root.className='v14';controls.after(root)}
    return root;
  }

  function generatedCard(k){
    const val=state.effective[k]||'';
    const advisorEdited=filled(state.workspace?.intake?.[k])&&!state.generatedMeta[k];
    return `<article class="v14Card"><div class="v14Top"><h4>${esc(labels[k][0])}</h4><span class="v14Badge ${advisorEdited?'confirmed':'generated'}">${advisorEdited?'Advisor Edited':'Software Generated'}</span></div><p>${esc(val)}</p><textarea data-v14-generated="${k}">${esc(val)}</textarea></article>`;
  }

  function factCard(k){
    const val=state.effective[k]||'',confirmed=!!state.confirmed[k],detected=!confirmed&&filled(val);
    const status=confirmed?'Confirmed':detected?'Detected From Source':'Source Required';
    const cls=confirmed?'confirmed':detected?'detected':'required';
    return `<article class="v14Card"><div class="v14Top"><h4>${esc(labels[k][0])}</h4><span class="v14Badge ${cls}">${status}</span></div><textarea data-v14-source="${k}">${esc(val)}</textarea><small>${esc(labels[k][1])}</small>${detected?`<div class="v14Actions" style="margin-top:8px"><button class="v14Btn" data-v14-confirm="${k}">Confirm Detected Fact</button></div>`:''}</article>`;
  }

  function sellerRequest(sc){
    let n=1;const lines=['Seller / Sponsor Information Request','','To complete the source-backed investor package for '+(state.deal?.title||'this opportunity')+', please provide:',''];
    sc.missingFacts.forEach(k=>{lines.push(`${n++}. ${labels[k][0]}`,`   ${labels[k][1]}`,'')});
    sc.missingDocs.forEach(r=>{lines.push(`${n++}. ${r[1]}`,`   ${r[4]}`,'')});
    if(n===1)return'The current source-truth and source-document requirements are complete.';
    lines.push('OuterHaven will use these source facts and documents to update the investor package automatically. No narrative drafting is required from you.');
    return lines.join('\n');
  }

  function render(){
    const root=mount();if(!root||!state.deal)return;
    patchShell();
    const sc=readiness();
    const next=[...sc.missingFacts.map(k=>labels[k][0]),...sc.confirmFacts.map(k=>'Confirm '+labels[k][0]),...sc.missingDocs.map(r=>r[1])].slice(0,5).join(' · ')||'No source gaps remain under the current model.';
    const folders={};sc.reqs.forEach(r=>(folders[r[2]]||(folders[r[2]]=[])).push(r));
    const room=Object.entries(folders).map(([name,items])=>`<section class="v14Folder"><div class="v14FolderTitle"><strong>${esc(name)}</strong><i></i></div>${items.map(r=>`<div class="v14Req"><div><strong>${esc(r[1])}</strong><p>${esc(r[4])}</p></div><span class="v14Badge ${docPresent(r)?'confirmed':'required'}">${docPresent(r)?'Present':'Needs Seller'}</span></div>`).join('')}</section>`).join('');
    root.innerHTML=`
      <section class="v14Hero"><div><div class="v14Ring" style="--p:${sc.total}"><div><strong>${sc.total}%</strong><span>Package Readiness</span></div></div></div><div><div class="eyebrow">VALUE FIRST</div><h3>OuterHaven does the writing. The advisor supplies source truth.</h3><p>Generated narrative is separated from factual evidence. The advisor should not have to write the investment thesis, market story or risk analysis from scratch.</p><div class="v14Metrics"><div class="v14Metric"><span>Software Work</span><strong>${sc.software}%</strong></div><div class="v14Metric"><span>Source Facts</span><strong>${sc.facts}%</strong></div><div class="v14Metric"><span>Source Documents</span><strong>${sc.docs}%</strong></div></div><div class="v14Next"><strong>Next source-backed actions:</strong> ${esc(next)}</div></div></section>
      <section class="v14Panel"><div class="v14Head"><div><div class="eyebrow">OUTERHAVEN DRAFTING</div><h3>Generated from the transaction already submitted</h3><p>Review or edit the software work. The same approved content feeds the memo, teaser and investor FAQ.</p></div><div class="v14Actions"><button class="v14Btn" data-v14-regenerate>Regenerate Draft</button><button class="v14Btn primary" data-v14-save>Save Review</button></div></div><div class="v14Body"><div class="v14Drafts">${generatedKeys.map(generatedCard).join('')}</div></div></section>
      <section class="v14Panel"><div class="v14Head"><div><div class="eyebrow">SOURCE TRUTH</div><h3>Only confirm facts the software cannot responsibly invent</h3><p>Facts already detected in the submission are pre-filled for confirmation. Genuine gaps become seller requests.</p></div><div class="v14Actions"><button class="v14Btn" data-v14-seller>Copy Seller Request</button><button class="v14Btn primary" data-v14-save>Save Source Facts</button></div></div><div class="v14Body"><div class="v14Facts">${sc.keys.map(factCard).join('')}</div></div></section>
      <section class="v14Panel"><div class="v14Head"><div><div class="eyebrow">SOURCE DATA ROOM</div><h3>Evidence behind the package</h3><p>Missing documents become seller requests, not writing assignments for the advisor.</p></div><div class="v14Actions"><input id="v14SourceUpload" class="v14Upload" type="file" multiple accept=".pdf,.docx,.xlsx"><button class="v14Btn" data-v14-upload>Upload Source Files</button></div></div><div class="v14Body"><div class="v14RoomSummary"><div><span>Required Items</span><strong>${sc.reqs.length}</strong></div><div><span>Present</span><strong>${sc.present}</strong></div><div><span>Needs Seller</span><strong>${sc.missingDocs.length}</strong></div></div>${room}<div class="v14Files">${state.docs.length?state.docs.map(x=>`<span class="v14File">${esc(x.name)}</span>`).join(''):'<span class="v14Note">No supporting source files uploaded yet.</span>'}</div><div id="v14UploadStatus" class="v14Note"></div></div></section>
      <section class="v14Panel"><div class="v14Head"><div><div class="eyebrow">INVESTOR MATERIALS</div><h3>Outputs created from the same verified workspace</h3><p>Generated narrative plus confirmed source truth flows directly into the portable investor package.</p></div></div><div class="v14Body"><div class="v14Outputs"><article class="v14Output"><span>Primary Output 01</span><h4>Investor Teaser</h4><p>Clean first-pass investor material generated from the current deal record.</p><button class="v14Btn primary" data-v14-doc="teaser">Generate Teaser</button></article><article class="v14Output"><span>Primary Output 02</span><h4>Investment Memorandum</h4><p>Structured underwriting memo using software drafting plus confirmed source facts.</p><button class="v14Btn primary" data-v14-doc="memo">Generate Memo</button></article><article class="v14Output"><span>Primary Output 03</span><h4>Capital & Transaction Summary</h4><p>Structure, capitalization, sources and uses, ownership and transaction mechanics.</p><div class="v14Actions"><button class="v14Btn" data-v14-doc="transaction">Transaction Overview</button><button class="v14Btn" data-v14-doc="sources">Capital Summary</button></div></article><article class="v14Output"><span>Primary Output 04</span><h4>Diligence Package</h4><p>Source-material checklist and room index showing what supports the investment case.</p><div class="v14Actions"><button class="v14Btn" data-v14-doc="checklist">Checklist</button><button class="v14Btn" data-v14-doc="diligence_index">Room Index</button></div></article></div></div></section>
      <section class="v14Panel"><div class="v14Head"><div><div class="eyebrow">OPTIONAL ENRICHMENT</div><h3>Add only what improves the package</h3><p>These fields never block readiness. Private advisor notes stay private.</p></div></div><div class="v14Body"><div class="v14Optional">${['management_team','key_contracts','regulatory','investor_facing_notes','private_advisor_notes'].map(k=>`<div><label>${esc(labels[k][0])}</label><textarea data-v14-optional="${k}">${esc(state.effective[k]||'')}</textarea></div>`).join('')}</div><div class="v14Actions" style="margin-top:10px"><button class="v14Btn primary" data-v14-save>Save Optional Data</button></div></div></section>`;
  }

  function collect(){
    const out={...(state.workspace?.intake||{})},gm={...(state.generatedMeta||{})},confirmed={...(state.confirmed||{})};
    document.querySelectorAll('[data-v14-generated]').forEach(el=>{const k=el.dataset.v14Generated,v=el.value.trim();out[k]=v;gm[k]=(v===state.generated[k])});
    document.querySelectorAll('[data-v14-source]').forEach(el=>{const k=el.dataset.v14Source,v=el.value.trim();out[k]=v;if(v&&v!==(state.derived[k]||''))confirmed[k]=true});
    document.querySelectorAll('[data-v14-optional]').forEach(el=>out[el.dataset.v14Optional]=el.value.trim());
    out.__generated=gm;out.__confirmed=confirmed;return out;
  }

  async function save(){
    const intake=collect(),generated_assets=state.workspace?.generated_assets||{};
    const {error}=await sb.from('deal_workspaces').upsert({deal_id:state.deal.id,owner_id:state.user.id,intake,generated_assets,updated_at:new Date().toISOString()},{onConflict:'deal_id'});
    if(error)throw error;await refresh();
  }

  async function confirmFact(k){
    const intake=collect();const c=(intake.__confirmed&&typeof intake.__confirmed==='object')?{...intake.__confirmed}:{};c[k]=true;intake.__confirmed=c;
    const {error}=await sb.from('deal_workspaces').upsert({deal_id:state.deal.id,owner_id:state.user.id,intake,generated_assets:state.workspace?.generated_assets||{},updated_at:new Date().toISOString()},{onConflict:'deal_id'});
    if(error)throw error;await refresh();
  }

  async function regenerate(){
    const intake=collect();const gm=(intake.__generated&&typeof intake.__generated==='object')?{...intake.__generated}:{};
    generatedKeys.forEach(k=>{intake[k]=state.generated[k];gm[k]=true});intake.__generated=gm;
    const {error}=await sb.from('deal_workspaces').upsert({deal_id:state.deal.id,owner_id:state.user.id,intake,generated_assets:state.workspace?.generated_assets||{},updated_at:new Date().toISOString()},{onConflict:'deal_id'});
    if(error)throw error;await refresh();
  }

  function safeName(name){return String(name||'document').normalize('NFKD').replace(/[^a-zA-Z0-9._-]+/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'').slice(-120)||'document'}
  function mimeFor(file){const ext=(file.name.split('.').pop()||'').toLowerCase();if(ext==='pdf')return'application/pdf';if(ext==='docx')return'application/vnd.openxmlformats-officedocument.wordprocessingml.document';if(ext==='xlsx')return'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';return file.type||'application/octet-stream'}
  async function uploadFiles(files){
    let done=0;for(const file of files){if(!/\.(pdf|docx|xlsx)$/i.test(file.name)||file.size>10*1024*1024)continue;const path=`${state.user.id}/${state.deal.id}/${Date.now()}-${Math.random().toString(36).slice(2,7)}-${safeName(file.name)}`;const {error}=await sb.storage.from('deal-documents').upload(path,file,{contentType:mimeFor(file),upsert:false});if(error)throw error;done++}
    const status=$('v14UploadStatus');if(status)status.textContent=`Uploaded ${done} file${done===1?'':'s'}. Rechecking source coverage…`;await refresh();
  }

  async function refresh(){
    if(loading)return;const id=$('capitalDealSelect')?.value;if(!id)return;
    loading=true;try{if(await loadState())render()}catch(e){console.error('advisor workspace v14',e);const root=mount();if(root)root.innerHTML=`<div class="empty">Could not load the Advisor Workspace. ${esc(e?.message||'Unknown error')}</div>`}finally{loading=false}
  }

  function schedule(){[0,250,700,1400].forEach(ms=>setTimeout(()=>{patchShell();refresh()},ms))}
  function boot(){styles();patchShell();let n=0;const tick=()=>{n++;patchShell();if($('capitalDealSelect')&&$('capitalSection')?.querySelector('.capitalControls')){schedule();return}if(n<80)setTimeout(tick,250)};tick();setInterval(patchShell,4000)}

  document.addEventListener('click',async e=>{
    if(e.target.closest('.navBtn[data-section="capital"],#capitalRefresh')){schedule();return}
    const saveBtn=e.target.closest('[data-v14-save]');if(saveBtn){saveBtn.disabled=true;try{await save();saveBtn.textContent='Saved';setTimeout(()=>saveBtn.textContent='Save',1000)}catch(err){alert(err?.message||'Could not save.')}finally{saveBtn.disabled=false}return}
    const confirm=e.target.closest('[data-v14-confirm]');if(confirm){confirm.disabled=true;try{await confirmFact(confirm.dataset.v14Confirm)}catch(err){alert(err?.message||'Could not confirm fact.')}finally{confirm.disabled=false}return}
    const regen=e.target.closest('[data-v14-regenerate]');if(regen){regen.disabled=true;try{await regenerate()}catch(err){alert(err?.message||'Could not regenerate draft.')}finally{regen.disabled=false}return}
    const req=e.target.closest('[data-v14-seller]');if(req){const text=sellerRequest(readiness());try{await navigator.clipboard.writeText(text);req.textContent='Seller Request Copied';setTimeout(()=>req.textContent='Copy Seller Request',1400)}catch(_){alert(text)}return}
    const up=e.target.closest('[data-v14-upload]');if(up){$('v14SourceUpload')?.click();return}
    const doc=e.target.closest('[data-v14-doc]');if(doc){e.preventDefault();e.stopImmediatePropagation();await save().catch(()=>{});window.OuterHavenCapitalDocsV9?.renderAsset(doc.dataset.v14Doc);return}
  },true);

  document.addEventListener('change',async e=>{
    if(e.target?.id==='capitalDealSelect'){schedule();return}
    if(e.target?.id==='v14SourceUpload'){const files=[...(e.target.files||[])];e.target.value='';if(files.length)try{await uploadFiles(files)}catch(err){alert(err?.message||'Could not upload source files.')}}
  },true);

  window.OuterHavenAdvisorWorkspaceV14={refresh,readiness:()=>readiness(),sellerRequest:()=>sellerRequest(readiness())};
  boot();
})();