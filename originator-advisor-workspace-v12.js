(function(){
  if(window.__outerhavenAdvisorWorkspaceV12)return;window.__outerhavenAdvisorWorkspaceV12=true;
  const sb=window.__OUTERHAVEN_ORIGINATOR_SB;if(!sb)return;
  const $=id=>document.getElementById(id), qs=s=>document.querySelector(s);
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  const norm=v=>String(v||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  const filled=v=>String(v||'').trim().length>=8;
  const money=v=>{const n=Number(v||0);if(!n)return'';if(n>=1e9)return'$'+(n/1e9).toFixed(n%1e9?1:0)+'B';if(n>=1e6)return'$'+(n/1e6).toFixed(n%1e6?1:0)+'M';if(n>=1e3)return'$'+(n/1e3).toFixed(n%1e3?1:0)+'K';return'$'+n.toLocaleString()};
  let state={user:null,deal:null,workspace:null,docs:[],effective:{},derived:{}};let loading=false;

  const defs={
    investment_thesis:['Investment thesis','What is the core investment case and why should an investor care?','Investment Case'],
    transaction_rationale:['Why this transaction is happening now','Why is the seller, sponsor or company pursuing this transaction now?','Transaction'],
    use_of_proceeds:['Capital objective / use of proceeds','What exactly will the capital fund, acquire, refinance or support?','Transaction'],
    ownership:['Ownership & capitalization','Who owns the business or asset today, and what does the current capitalization look like?','Ownership & Capital'],
    existing_debt:['Existing debt','List current lenders, balances, rates, maturities, security and material obligations.','Ownership & Capital'],
    valuation:['Valuation / pricing','What valuation, purchase price, asking price, cap rate or pricing framework applies?','Ownership & Capital'],
    sponsor_equity:['Sponsor equity / skin in the game','How much capital has the sponsor already invested and how much additional equity will be contributed?','Ownership & Capital'],
    historical_performance:['Historical performance','Summarize the historical revenue, EBITDA, NOI, growth or other relevant performance.','Financial & Underwriting'],
    forecast:['Forecast / business plan','What does management or the sponsor expect over the next several years, and what assumptions drive it?','Financial & Underwriting'],
    market_position:['Market & competitive position','What makes the opportunity differentiated, defensible or attractive in its market?','Investment Case'],
    risks:['Key risks','What are the material risks an investor should understand before underwriting the opportunity?','Risks & Execution'],
    mitigants:['Risk mitigants','What specifically reduces, offsets or controls the key risks?','Risks & Execution'],
    exit_strategy:['Exit / repayment strategy','How is investor capital expected to be repaid, refinanced, sold or otherwise exited?','Risks & Execution'],
    timeline:['Transaction timeline','What are the key milestones and target timing through close, development or stabilization?','Risks & Execution'],
    asset_value:['Asset value / purchase price','What is the current asset value, purchase price or appraised value?','Asset / Project'],
    noi:['NOI / property cash flow','Provide current and stabilized NOI or equivalent property cash flow.','Financial & Underwriting'],
    operating_metrics:['Operating / property metrics','Provide occupancy, ADR, RevPAR, unit/key count, utilization or other underwriting KPIs.','Financial & Underwriting'],
    project_status:['Project / development status','What has been completed, what remains, and what is the current construction or development status?','Asset / Project'],
    development_budget:['Development / construction budget','What is the total development or construction budget, including material hard and soft costs?','Asset / Project'],
    site_control:['Site control / title / tenure','How is the land or property controlled today, and what title, leasehold or freehold position applies?','Asset / Project'],
    presales:['Pre-sales / contracted sales','What pre-sales, reservations, deposits or contracted sales exist today?','Asset / Project'],
    operator_brand:['Brand / operator status','What hotel brand, operator or management agreement is in place or under negotiation?','Asset / Project'],
    collateral_security:['Collateral / security package','What collateral, guarantees or security support the financing?','Ownership & Capital'],
    management_team:['Management / sponsor team','Who are the key decision-makers, operators or sponsors behind the transaction?','Additional Deal Data'],
    key_contracts:['Key contracts / counterparties','What material customer, supplier, operator, lease, concession or other contracts matter to underwriting?','Additional Deal Data'],
    customer_concentration:['Customer / revenue concentration','Describe material customer, tenant, channel or revenue concentration, if relevant.','Additional Deal Data'],
    regulatory:['Regulatory / licensing considerations','What permits, licenses, approvals or regulatory matters should an investor understand?','Additional Deal Data'],
    investor_facing_notes:['Additional investor-facing information','Add any other verified facts that should appear in investor materials.','Additional Deal Data'],
    private_advisor_notes:['Private advisor notes','Private notes for your own workflow. These are never inserted into investor-facing materials.','Private Advisor Notes']
  };

  function flags(d){
    const t=norm(d?.transaction_type),all=norm(`${d?.sector||''} ${d?.title||''} ${d?.company||''} ${d?.summary||''}`);
    return{
      sale:/sale|sell side|divest|exit/.test(t),acq:/acquisition|buyout|purchase|m a/.test(t),debt:/debt|loan|credit|refinanc|unitranche|mezz/.test(t),equity:/equity|growth capital|minority|majority/.test(t),jv:/joint venture|\bjv\b/.test(t),
      re:/real estate|hospitality|hotel|resort|property|multifamily|self storage|commercial property/.test(all),hospitality:/hospitality|hotel|resort|branded residence|villa/.test(all),development:/development|construction|ground up|ground-up|pre sale|pre-sale|presale/.test(all),presale:/pre sale|pre-sale|presale|pre sold|pre-sold|contracted sales|reservation/.test(all),operating:!/real estate|hospitality|hotel|resort|property/.test(all)
    }
  }

  function questionKeys(d){
    const f=flags(d),out=['investment_thesis','transaction_rationale','ownership','forecast','market_position','risks','mitigants','timeline'];
    if(!f.development||Number(d?.revenue)>0||Number(d?.ebitda)>0)out.push('historical_performance');
    if(!f.sale||f.acq||f.debt||f.equity||f.jv)out.push('use_of_proceeds');
    if(f.debt||f.acq||f.re)out.push('existing_debt');
    if(f.sale||f.acq||f.equity||f.jv||f.re)out.push('valuation');
    if(!f.sale||f.debt||f.equity||f.jv)out.push('exit_strategy');
    if(f.re||f.jv||f.acq||f.debt)out.push('sponsor_equity');
    if(f.debt)out.push('collateral_security');
    if(f.re){out.push('asset_value','site_control');if(f.development)out.push('project_status','development_budget');else out.push('noi');if(f.hospitality)out.push('operator_brand','operating_metrics');if(f.presale)out.push('presales')}
    return[...new Set(out)]
  }
  function enrichmentKeys(d){const f=flags(d),out=['management_team','key_contracts','regulatory','investor_facing_notes'];if(f.operating)out.push('customer_concentration');out.push('private_advisor_notes');return out}

  function sourceRequirements(d){
    const f=flags(d),r=[];
    r.push(['overview','CIM / teaser / deal deck','01 Investment Materials',[/cim/,/memorandum/,/teaser/,/deck/,/one.?pager/,/overview/],'The core source document investors use to understand the opportunity.']);
    if(!f.development||Number(d?.revenue)>0||Number(d?.ebitda)>0)r.push(['historicals','Historical financials / operating statements','03 Financial & Underwriting',[/financial/,/p.?&.?l/,/income.?statement/,/balance.?sheet/,/management.?accounts/,/operating.?statement/,/audit/],'Source support for historical performance.']);
    r.push(['model','Forecast / model / business plan','03 Financial & Underwriting',[/model/,/forecast/,/projection/,/pro.?forma/,/business.?plan/,/budget/],'Source support for the forward underwriting case.']);
    r.push(['ownership','Ownership / cap table / sponsor structure','02 Transaction & Ownership',[/cap.?table/,/ownership/,/shareholder/,/org.?chart/,/corporate.?structure/],'Shows who owns and controls the company, sponsor or asset.']);
    if(f.debt||f.acq||f.re)r.push(['debt','Debt schedule / financing detail','02 Transaction & Ownership',[/debt.?schedule/,/loan/,/credit.?facility/,/mortgage/,/financing.?schedule/,/lender/],'Needed to understand existing leverage and refinancing requirements.']);
    if(f.sale||f.acq)r.push(['transaction','Transaction document / LOI / purchase agreement','02 Transaction & Ownership',[/loi/,/letter.?of.?intent/,/purchase.?agreement/,/sale.?agreement/,/psa/,/transaction.?document/],'Supports the stated transaction terms and pricing where available.']);
    if(f.re){
      r.push(['site','Title / site-control support','04 Asset & Project',[/title/,/deed/,/site.?control/,/leasehold/,/freehold/,/land.?lease/,/purchase.?agreement/,/psa/],'Confirms control of the underlying property or development site.']);
      if(!f.development)r.push(['propertyops','Property operating support','03 Financial & Underwriting',[/noi/,/rent.?roll/,/occupancy/,/revpar/,/adr/,/property.?operating/],'Supports property-level cash flow and operating assumptions.']);
      if(f.development){
        r.push(['devbudget','Development / construction budget','04 Asset & Project',[/development.?budget/,/construction.?budget/,/project.?budget/,/hard.?cost/,/soft.?cost/],'Supports total project cost and remaining capital needs.']);
        r.push(['schedule','Project schedule / permits / approvals','04 Asset & Project',[/project.?schedule/,/construction.?schedule/,/permit/,/approval/,/entitlement/,/planning/],'Supports execution timing and development readiness.']);
      }
      if(f.presale)r.push(['presales','Pre-sales / reservation support','05 Commercial',[/pre.?sale/,/presale/,/reservation/,/contracted.?sale/,/deposit/],'Supports the stated pre-sale or contracted demand.']);
      if(f.hospitality)r.push(['operator','Brand / operator support','05 Commercial',[/operator/,/management.?agreement/,/brand/,/marriott/,/hilton/,/hyatt/,/accor/,/ihg/,/st.?regis/,/four.?seasons/],'Supports the hotel brand or operator relationship.']);
    }
    if(f.debt)r.push(['collateral','Collateral / security support','02 Transaction & Ownership',[/collateral/,/security/,/guarantee/,/pledge/,/mortgage/],'Supports the proposed security package for debt capital.']);
    return r
  }

  function sentence(text,r){const parts=String(text||'').replace(/\s+/g,' ').split(/(?<=[.!?;])\s+/);return parts.find(x=>r.test(x))||''}
  function derive(d){
    const s=String(d?.summary||'').trim(),out={},src={};if(s){out.investment_thesis=s;src.investment_thesis='submission summary'}
    if(Number(d?.revenue)>0||Number(d?.ebitda)>0){const b=[];if(Number(d.revenue)>0)b.push(`Revenue: ${money(d.revenue)}`);if(Number(d.ebitda)>0)b.push(`EBITDA: ${money(d.ebitda)}`);out.historical_performance=b.join(' · ');src.historical_performance='submitted financial fields'}
    const map=[['use_of_proceeds',/use of proceeds|proceeds will|funds will|capital will|raise is for/i],['transaction_rationale',/rationale|why now|reason for sale|seeking capital|growth|expansion|refinanc|acquisition|liquidity event|development/i],['ownership',/ownership|owned by|shareholder|cap table|sponsor owns|founder owns/i],['existing_debt',/existing debt|current debt|loan|credit facility|mortgage|leverage/i],['valuation',/valuation|purchase price|asking price|enterprise value|equity value|cap rate/i],['forecast',/forecast|projected|projection|pro forma|stabilized|expected to grow|irr|moic/i],['market_position',/market leader|market position|competitive|competition|demand|scarcity|market size|brand/i],['risks',/risk|challenge|exposure|dependency/i],['mitigants',/mitigant|mitigation|protected by|offset by/i],['exit_strategy',/exit|repayment|refinance|sale after|liquidity path|hold period/i],['timeline',/timeline|closing|close by|target close|milestone|completion date|stabilization|year [0-9]/i],['sponsor_equity',/sponsor equity|equity contribution|skin in the game|already invested|sponsor invested/i],['asset_value',/asset value|property value|purchase price|appraised value/i],['noi',/\bnoi\b|net operating income/i],['operating_metrics',/occupancy|\badr\b|revpar|keys|rooms|units|utilization/i],['project_status',/construction|development stage|project status|groundbreak|completion|permit|entitlement/i],['development_budget',/development budget|construction budget|project cost|hard cost|soft cost|construction cost/i],['site_control',/site control|title|freehold|leasehold|land owned|property owned/i],['presales',/pre sold|pre-sold|pre sale|pre-sale|presale|reservations|contracted sales/i],['operator_brand',/operator|management agreement|brand engagement|marriott|hilton|hyatt|accor|ihg|four seasons|st regis/i]];
    map.forEach(([k,r])=>{const v=sentence(s,r);if(v){out[k]=v;src[k]='submission narrative'}});return{out,src}
  }
  function effective(d,w){const der=derive(d),saved=w?.intake||{},merged={...der.out};Object.entries(saved).forEach(([k,v])=>{if(String(v||'').trim())merged[k]=v});return{eff:merged,derived:der.src}}

  function safeName(name){return String(name||'document').normalize('NFKD').replace(/[^a-zA-Z0-9._-]+/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'').slice(-120)||'document'}
  function mimeFor(file){const ext=(file.name.split('.').pop()||'').toLowerCase();if(ext==='pdf')return'application/pdf';if(ext==='docx')return'application/vnd.openxmlformats-officedocument.wordprocessingml.document';if(ext==='xlsx')return'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';return file.type||'application/octet-stream'}
  function docPresent(req){const names=state.docs.map(x=>String(x.name||'').toLowerCase());return names.some(n=>req[3].some(re=>re.test(n)))}

  function readiness(){
    const d=state.deal||{},i=state.effective||{},qs=questionKeys(d),reqs=sourceRequirements(d);let core=0;const missingData=[],missingDocs=[];
    const checks=[['Opportunity / company',!!(d.title&&d.company),4],['Capital ask',Number(d.deal_size)>0,4],['Sector / geography / structure',!!(d.sector&&d.geography&&d.transaction_type),6],['Seller relationship',!!d.seller_relationship,3],['Seller-side authority',!!d.authority_confirmed,3],['Opportunity summary',String(d.summary||'').trim().length>=120,5]];
    checks.forEach(([l,ok,p])=>{if(ok)core+=p;else missingData.push(l)});
    const complete=qs.filter(k=>filled(i[k])).length,info=qs.length?Math.round(complete/qs.length*40):40;qs.filter(k=>!filled(i[k])).forEach(k=>missingData.push(defs[k][0]));
    const present=reqs.filter(docPresent).length,source=reqs.length?Math.round(present/reqs.length*35):35;reqs.filter(r=>!docPresent(r)).forEach(r=>missingDocs.push(r[1]));
    return{total:Math.min(100,core+info+source),core,info,source,questions:qs,reqs,missingData,missingDocs,present,required:reqs.length}
  }

  async function load(){
    const id=$('capitalDealSelect')?.value;if(!id)return false;const {data:{session}}=await sb.auth.getSession();if(!session)return false;
    const [dr,wr]=await Promise.all([sb.from('deals').select('*').eq('id',id).maybeSingle(),sb.from('deal_workspaces').select('*').eq('deal_id',id).maybeSingle()]);if(dr.error)throw dr.error;if(wr.error)throw wr.error;
    const ls=await sb.storage.from('deal-documents').list(`${session.user.id}/${id}`,{limit:100,sortBy:{column:'name',order:'asc'}});const mix=effective(dr.data,wr.data);
    state={user:session.user,deal:dr.data,workspace:wr.data||null,docs:ls.error?[]:(ls.data||[]).filter(x=>x.name&&x.id),effective:mix.eff,derived:mix.derived};return true
  }

  function styles(){if($('advisorWorkspaceV12Style'))return;const s=document.createElement('style');s.id='advisorWorkspaceV12Style';s.textContent=`
    .navBtn[data-section="submit"]{display:none!important}#institutionalReadiness,.institutionalStrip,.passportBtn,#investorSuiteV11Core,#investorSuiteV10Core,#investorSuiteV9Core,#investorSuiteV6,#investorReadinessV7,#investorReadinessV8Stable,#iv7ValueStrip,#dfyValuePanel,#capitalMetrics,#capitalProducts{display:none!important}.submissionCard .matchWhy,.submissionCard .matchPct,.submissionCard .matchLabel{display:none!important}.capitalHero{grid-template-columns:1fr!important}.capitalPlan{display:none!important}.capitalHeroCard{padding:22px!important}
    .v12{margin:0 0 18px;font-family:Arial,Helvetica,sans-serif}.v12Readiness{display:grid;grid-template-columns:210px 1fr;gap:22px;padding:22px;border:1px solid #d9cfc4;border-radius:16px;background:#fff}.v12Gauge{display:grid;place-items:center}.v12Ring{--p:0;width:168px;height:168px;border-radius:50%;position:relative;display:grid;place-items:center;background:conic-gradient(#245b43 calc(var(--p)*1%),#ebe6df 0)}.v12Ring:after{content:'';position:absolute;inset:14px;border-radius:50%;background:#fff}.v12RingInner{position:relative;z-index:1;text-align:center}.v12RingInner strong{display:block;font-size:38px;letter-spacing:-.04em}.v12RingInner span{display:block;margin-top:5px;font-size:7px;font-weight:800;letter-spacing:.11em;text-transform:uppercase;color:#7d7166}.v12Readiness h3{margin:4px 0 6px;font-size:21px}.v12Readiness p{margin:0;font-size:9.5px;line-height:1.55;color:#6f6359}.v12ScoreGrid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:15px 0}.v12Score{padding:11px;border:1px solid #e3dbd2;border-radius:9px;background:#faf9f7}.v12Score span{font-size:6.7px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#87796b}.v12Score strong{display:block;margin-top:4px;font-size:15px}.v12Track{height:5px;border-radius:99px;background:#ebe5de;overflow:hidden;margin-top:7px}.v12Track i{display:block;height:100%;background:#494039}.v12Next{padding:10px 11px;border-radius:9px;background:#f4eee6;font-size:8.5px;line-height:1.5;color:#66594d}
    .v12Panel{margin-top:14px;border:1px solid #d9cfc4;border-radius:16px;background:#fff;overflow:hidden}.v12Head{display:flex;justify-content:space-between;gap:18px;align-items:center;padding:17px 19px;background:#f8f5f0}.v12Head h3{margin:3px 0 4px;font-size:18px}.v12Head p{margin:0;max-width:720px;font-size:9px;line-height:1.5;color:#70645a}.v12Actions{display:flex;gap:7px;flex-wrap:wrap}.v12Btn{border:1px solid #cfc3b6;border-radius:8px;padding:8px 10px;background:#fff;color:#2a241f;font:800 8.5px Arial,sans-serif;cursor:pointer}.v12Btn.primary{background:#211d19;color:#fff;border-color:#211d19}.v12Btn:disabled{opacity:.45;cursor:not-allowed}.v12Body{padding:18px 19px}.v12Body.hidden{display:none}.v12Status{font-size:8px;color:#7a6e63}.v12Upload{display:none}
    .v12RoomSummary{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:14px}.v12RoomSummary>div{padding:11px;border:1px solid #e6ded5;border-radius:9px;background:#fbfaf8}.v12RoomSummary span{font-size:6.8px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#837669}.v12RoomSummary strong{display:block;margin-top:4px;font-size:15px}.v12Folder{margin:12px 0}.v12FolderTitle{display:flex;align-items:center;gap:8px;margin-bottom:7px}.v12FolderTitle strong{font-size:7px;letter-spacing:.09em;text-transform:uppercase;color:#806b56}.v12FolderTitle i{height:1px;background:#e7dfd7;flex:1}.v12Req{display:grid;grid-template-columns:1fr auto;gap:12px;align-items:center;padding:10px 11px;border:1px solid #e6dfd7;border-radius:9px;background:#fff;margin:6px 0}.v12Req strong{display:block;font-size:9.5px}.v12Req p{margin:3px 0 0;font-size:7.8px;line-height:1.4;color:#817467}.v12Chip{white-space:nowrap;padding:5px 7px;border-radius:999px;font-size:6.8px;font-weight:850;text-transform:uppercase;letter-spacing:.05em}.v12Chip.present{background:#eaf2ec;color:#356147}.v12Chip.missing{background:#f5e9df;color:#8a4e32}.v12Files{margin-top:12px;padding-top:12px;border-top:1px solid #eee7df}.v12FileList{display:flex;gap:6px;flex-wrap:wrap;margin-top:7px}.v12File{padding:5px 7px;border:1px solid #e0d7ce;border-radius:999px;background:#fbfaf8;font-size:7px;color:#6f6258}
    .v12Form{display:grid;grid-template-columns:1fr 1fr;gap:10px}.v12Group{margin:0 0 17px}.v12GroupHead{display:flex;gap:8px;align-items:center;margin-bottom:8px}.v12GroupHead strong{font-size:7px;letter-spacing:.09em;text-transform:uppercase;color:#7c6955}.v12GroupHead i{height:1px;background:#e8e0d7;flex:1}.v12Field{display:grid;gap:5px}.v12Field.wide{grid-column:1/-1}.v12Label{display:flex;justify-content:space-between;gap:8px}.v12Label label{font-size:7px;font-weight:800;letter-spacing:.07em;text-transform:uppercase;color:#75685c}.v12Tag{font-size:6.3px;font-weight:700;padding:3px 5px;border-radius:999px;background:#edf2ec;color:#5f745f}.v12Tag.optional{background:#f2ece4;color:#786952}.v12Tag.private{background:#f4edf3;color:#6f5b69}.v12Field textarea{min-height:82px;resize:vertical;border:1px solid #d7cdc2;border-radius:9px;padding:10px;font:9.5px/1.5 Arial,sans-serif;color:#332d28}.v12Foot{display:flex;justify-content:space-between;gap:12px;align-items:center;margin-top:12px;padding-top:12px;border-top:1px solid #eee7df}.v12Foot span{max-width:670px;font-size:8px;line-height:1.45;color:#7a6e63}
    .v12Outputs{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}.v12Output{padding:14px;border:1px solid #e0d7cd;border-radius:11px;background:#fff}.v12Output span{font-size:6.7px;font-weight:850;letter-spacing:.08em;text-transform:uppercase;color:#846f59}.v12Output h4{margin:6px 0 5px;font-size:13px}.v12Output p{margin:0 0 10px;font-size:8.4px;line-height:1.48;color:#6e6258}.v12OutputActions{display:flex;gap:6px;flex-wrap:wrap}.v12More{margin-top:10px;border-top:1px solid #eee6dd;padding-top:10px}.v12More summary{cursor:pointer;font-size:8px;font-weight:800;color:#62564b}.v12More .v12Actions{margin-top:9px}.v12Distribution{display:grid;grid-template-columns:1fr 1fr;gap:10px}.v12Lane{padding:14px;border:1px solid #e0d7cd;border-radius:11px;background:#fff}.v12Lane span{font-size:6.8px;font-weight:850;letter-spacing:.09em;text-transform:uppercase;color:#8a745d}.v12Lane h4{margin:6px 0 5px;font-size:13px}.v12Lane p{margin:0 0 10px;font-size:8.5px;line-height:1.5;color:#6e6258}
    @media(max-width:900px){.v12Readiness{grid-template-columns:1fr}.v12ScoreGrid,.v12RoomSummary,.v12Form,.v12Outputs,.v12Distribution{grid-template-columns:1fr}}
  `;document.head.appendChild(s)}

  function patchShell(){
    const submitNav=qs('.navBtn[data-section="submit"]');if(submitNav)submitNav.style.display='none';
    const dealsNav=qs('.navBtn[data-section="submissions"] span');if(dealsNav)dealsNav.textContent='Deals';
    const capitalNav=qs('.navBtn[data-section="capital"] span');if(capitalNav)capitalNav.textContent='Advisor Workspace';
    if($('topSubmit'))$('topSubmit').textContent='+ New Deal';
    const subHead=$('submissionsSection')?.querySelector('.panelHead h2');if(subHead)subHead.textContent='Deals';
    const subCopy=$('submissionsSection')?.querySelector('.panelHead p');if(subCopy)subCopy.textContent='Track each opportunity, then open the Advisor Workspace to complete readiness and build the investor package.';
    const recentTitle=$('recentSubmissions')?.closest('.panel')?.querySelector('h2');if(recentTitle)recentTitle.textContent='Recent Deals';
    const recentCopy=$('recentSubmissions')?.closest('.panel')?.querySelector('p');if(recentCopy)recentCopy.textContent='Your most recent opportunities and current review status.';
    const how=qs('.howItWorks .steps');if(how&&!how.dataset.v12){how.dataset.v12='1';how.innerHTML='<article><span>01</span><b>Bring the deal in</b><p>Upload the seller materials or enter the transaction once.</p></article><article><span>02</span><b>Complete readiness</b><p>Fill only the underwriting gaps that actually matter for this transaction.</p></article><article><span>03</span><b>Build the data room</b><p>See exactly which source files are present and which need to come from the seller.</p></article><article><span>04</span><b>Distribute</b><p>Use the finished package with OuterHaven or your own qualified investor relationships.</p></article>'}
    const hero=$('capitalSection')?.querySelector('.capitalHeroCard');if(hero){hero.querySelector('.eyebrow')&&(hero.querySelector('.eyebrow').textContent='OUTERHAVEN ADVISOR WORKSPACE');hero.querySelector('h2')&&(hero.querySelector('h2').textContent='Take a seller package from messy to investor-ready.');hero.querySelector('p')&&(hero.querySelector('p').textContent='Complete the transaction once, organize the source data room, generate the core investor materials, then work the deal through OuterHaven or your own investor relationships.')}
    const ph=$('capitalSection')?.querySelector('.panelHead h2');if(ph)ph.textContent='Deal Workspace';
    const pp=$('capitalSection')?.querySelector('.panelHead p');if(pp)pp.textContent='Select a deal. Readiness, data-room requirements and investor outputs all use the same transaction record.';
    if(qs('.navBtn[data-section="capital"]')?.classList.contains('active')){if($('pageTitle'))$('pageTitle').textContent='Advisor Workspace';if($('pageSub'))$('pageSub').textContent='Investor readiness, source data room and portable investor materials.'}
  }

  function mount(){const panel=$('capitalSection')?.querySelector('.panel'),controls=panel?.querySelector('.capitalControls');if(!panel||!controls)return null;let root=$('advisorWorkspaceV12Core');if(!root){root=document.createElement('div');root.id='advisorWorkspaceV12Core';root.className='v12';controls.after(root)}return root}
  function field(k,wide=false,optional=false){const d=defs[k],i=state.effective||{},saved=state.workspace?.intake||{},pref=!filled(saved[k])&&filled(i[k]),priv=k==='private_advisor_notes';return`<div class="v12Field ${wide?'wide':''}"><div class="v12Label"><label>${esc(d[0])}</label><span>${pref?'<span class="v12Tag">Pre-filled</span>':priv?'<span class="v12Tag private">Private</span>':optional?'<span class="v12Tag optional">Optional</span>':''}</span></div><textarea data-v12-field="${k}" placeholder="${esc(d[1])}">${esc(i[k]||'')}</textarea></div>`}
  function groups(keys,optional=false){const g={};keys.forEach(k=>(g[defs[k][2]]||(g[defs[k][2]]=[])).push(k));return Object.entries(g).map(([name,ks])=>`<section class="v12Group"><div class="v12GroupHead"><strong>${esc(name)}</strong><i></i></div><div class="v12Form">${ks.map((k,i)=>field(k,i<2,optional)).join('')}</div></section>`).join('')}

  function sellerRequest(sc){
    const data=sc.questions.filter(k=>!filled(state.effective?.[k])),docs=sc.reqs.filter(r=>!docPresent(r));if(!data.length&&!docs.length)return'The current transaction-specific information and source-document requirements are complete.';
    let n=1,lines=[`Seller / Sponsor Information Request`,``,`To complete the investor package for ${state.deal?.title||'this opportunity'}, please provide the following items:`,''];
    data.forEach(k=>{lines.push(`${n++}. ${defs[k][0]}`,`   ${defs[k][1]}`,'')});
    docs.forEach(r=>{lines.push(`${n++}. ${r[1]}`,`   ${r[4]}`,'')});
    lines.push('Please include source documents where available. The information will be used to complete the investor-ready data room and materials.');return lines.join('\n')
  }

  function outputCards(sc){
    const i=state.effective||{},d=state.deal||{},core=!!(d.title&&d.company&&d.deal_size&&d.sector&&d.geography&&d.transaction_type),infoRatio=sc.questions.length?sc.questions.filter(k=>filled(i[k])).length/sc.questions.length:1;
    const teaserOk=core&&filled(i.investment_thesis),memoOk=core&&infoRatio>=.65,capitalOk=filled(i.use_of_proceeds)&&(filled(i.existing_debt)||filled(i.sponsor_equity)||filled(i.valuation)||filled(i.asset_value)),dilOk=true;
    return`<div class="v12Outputs">
      <article class="v12Output"><span>Primary Output 01</span><h4>Investor Teaser</h4><p>Concise investor-facing overview for first-pass distribution. Clean, portable, and free of internal mandate data.</p><div class="v12OutputActions"><button class="v12Btn primary" data-v12-doc="teaser" ${teaserOk?'':'disabled'}>${teaserOk?'Generate Teaser':'Complete investment thesis'}</button></div></article>
      <article class="v12Output"><span>Primary Output 02</span><h4>Investment Memorandum</h4><p>Deeper underwriting document built from the completed deal profile, capitalization, financials, execution plan and risks.</p><div class="v12OutputActions"><button class="v12Btn primary" data-v12-doc="memo" ${memoOk?'':'disabled'}>${memoOk?'Generate Memo':'Complete more deal data'}</button></div></article>
      <article class="v12Output"><span>Primary Output 03</span><h4>Capital & Transaction Summary</h4><p>Useful working package for structure, sources and uses, ownership, valuation, debt and transaction mechanics.</p><div class="v12OutputActions"><button class="v12Btn" data-v12-doc="transaction">Transaction Overview</button><button class="v12Btn primary" data-v12-doc="sources" ${capitalOk?'':'disabled'}>${capitalOk?'Capital Summary':'Complete capital inputs'}</button></div></article>
      <article class="v12Output"><span>Primary Output 04</span><h4>Diligence Package</h4><p>Turns the current room into an actionable source-material checklist and index so the advisor knows exactly what remains.</p><div class="v12OutputActions"><button class="v12Btn primary" data-v12-doc="checklist">Diligence Checklist</button><button class="v12Btn" data-v12-doc="diligence_index">Room Index</button></div></article>
    </div><details class="v12More"><summary>Additional exports</summary><div class="v12Actions"><button class="v12Btn" data-v12-doc="faq">Investor FAQ</button><button class="v12Btn" data-v12-doc="ownership">Ownership Summary</button><button class="v12Btn" data-v12-doc="financial">Financial Overview</button><button class="v12Btn" data-v12-doc="risks">Risk & Mitigants</button></div></details>`
  }

  function render(){
    const root=mount();if(!root||!state.deal)return;patchShell();const sc=readiness(),missing=[...sc.missingData,...sc.missingDocs].slice(0,5),next=missing.length?missing.join(' · '):'No readiness gaps remain under the current transaction-specific model.';
    const folders={};sc.reqs.forEach(r=>(folders[r[2]]||(folders[r[2]]=[])).push(r));
    const room=Object.entries(folders).map(([name,rs])=>`<section class="v12Folder"><div class="v12FolderTitle"><strong>${esc(name)}</strong><i></i></div>${rs.map(r=>{const ok=docPresent(r);return`<div class="v12Req"><div><strong>${esc(r[1])}</strong><p>${esc(r[4])}</p></div><span class="v12Chip ${ok?'present':'missing'}">${ok?'Present':'Needs Seller'}</span></div>`}).join('')}</section>`).join('');
    const requiredFields=sc.questions.filter(k=>!filled(state.effective[k])).length,missingSource=sc.reqs.filter(r=>!docPresent(r)).length;
    root.innerHTML=`
      <section class="v12Readiness"><div class="v12Gauge"><div class="v12Ring" style="--p:${sc.total}"><div class="v12RingInner"><strong>${sc.total}%</strong><span>Investor Readiness</span></div></div></div><div><div class="eyebrow">ONE READINESS SCORE</div><h3>${sc.total===100?'Investor-ready package complete':`${100-sc.total} points remain`}</h3><p>This score measures the transaction itself: core deal definition, required underwriting information and source-document coverage. Generated documents do not inflate the score.</p><div class="v12ScoreGrid"><div class="v12Score"><span>Core Transaction</span><strong>${sc.core}/25</strong><div class="v12Track"><i style="width:${Math.round(sc.core/25*100)}%"></i></div></div><div class="v12Score"><span>Required Deal Data</span><strong>${sc.info}/40</strong><div class="v12Track"><i style="width:${Math.round(sc.info/40*100)}%"></i></div></div><div class="v12Score"><span>Source Data Room</span><strong>${sc.source}/35</strong><div class="v12Track"><i style="width:${Math.round(sc.source/35*100)}%"></i></div></div></div><div class="v12Next"><strong>Highest-value next steps:</strong> ${esc(next)}</div></div></section>

      <section class="v12Panel"><div class="v12Head"><div><div class="eyebrow">SOURCE DATA ROOM</div><h3>What you have vs. what an investor will need</h3><p>This is the working room. Requirements change with the transaction instead of forcing every deal through the same generic checklist.</p></div><div class="v12Actions"><input id="v12SourceUpload" class="v12Upload" type="file" multiple accept=".pdf,.docx,.xlsx"><button class="v12Btn" data-v12-upload>Upload Source Files</button><button class="v12Btn" data-v12-seller>Copy Seller Request</button></div></div><div class="v12Body"><div class="v12RoomSummary"><div><span>Required source items</span><strong>${sc.required}</strong></div><div><span>Present</span><strong>${sc.present}</strong></div><div><span>Needs seller</span><strong>${missingSource}</strong></div></div>${room}<div class="v12Files"><strong style="font-size:8px">Uploaded files</strong><div class="v12FileList">${state.docs.length?state.docs.map(x=>`<span class="v12File">${esc(x.name)}</span>`).join(''):'<span class="v12Status">No supporting source files are currently uploaded for this deal.</span>'}</div><div id="v12UploadStatus" class="v12Status" style="margin-top:7px"></div></div></div></section>

      <section class="v12Panel"><div class="v12Head"><div><div class="eyebrow">DEAL DATA</div><h3>Complete the underwriting facts once</h3><p>${requiredFields} required field${requiredFields===1?'':'s'} remain. Information already compatible with the original submission is pre-filled automatically.</p></div><div class="v12Actions"><button class="v12Btn" data-v12-toggle>Open Deal Data</button><button class="v12Btn primary" data-v12-save>Save Deal Data</button></div></div><div id="v12DataBody" class="v12Body hidden">${groups(sc.questions,false)}<section class="v12Group"><div class="v12GroupHead"><strong>Additional Deal Data</strong><i></i></div><div class="v12Form">${enrichmentKeys(state.deal).map(k=>field(k,false,true)).join('')}</div></section><div class="v12Foot"><span>Required fields affect readiness. Optional enrichment improves investor materials without blocking 100%. Private advisor notes never appear in investor-facing outputs.</span><button class="v12Btn primary" data-v12-save>Save Changes</button></div></div></section>

      <section class="v12Panel"><div class="v12Head"><div><div class="eyebrow">INVESTOR MATERIALS</div><h3>Four outputs with a real job</h3><p>No wall of ten “products.” These are the materials an advisor actually needs to prepare, underwrite and distribute the transaction.</p></div></div><div class="v12Body">${outputCards(sc)}</div></section>

      <section class="v12Panel"><div class="v12Head"><div><div class="eyebrow">DISTRIBUTION</div><h3>Use the same prepared deal in both lanes</h3><p>OuterHaven remains an additional capital channel, not a lock-in mechanism.</p></div></div><div class="v12Body"><div class="v12Distribution"><article class="v12Lane"><span>OuterHaven Network</span><h4>Work the opportunity through our network</h4><p>Track the submitted deal, respond to review requests and use OuterHaven's private capital relationships. Internal buyer-fit intelligence stays private.</p><button class="v12Btn primary" data-v12-go="submissions">Open Deal Pipeline</button></article><article class="v12Lane"><span>Your Investor Relationships</span><h4>Take the portable package with you</h4><p>Generate the teaser, memo and transaction materials and use them with your own qualified investor relationships without OuterHaven mandate data appearing in the documents.</p><button class="v12Btn primary" data-v12-doc="teaser" ${filled(state.effective.investment_thesis)?'':'disabled'}>Open Investor Teaser</button></article></div></div></section>`;
  }

  function collect(){const out={...state.effective};document.querySelectorAll('[data-v12-field]').forEach(el=>out[el.dataset.v12Field]=el.value.trim());return out}
  async function save(){if(!state.user||!state.deal)return;const intake=collect(),generated=state.workspace?.generated_assets||{};const {error}=await sb.from('deal_workspaces').upsert({deal_id:state.deal.id,owner_id:state.user.id,intake,generated_assets:generated,updated_at:new Date().toISOString()},{onConflict:'deal_id'});if(error)throw error;await refresh();$('v12DataBody')?.classList.remove('hidden')}
  async function markGenerated(type){if(!state.user||!state.deal)return;const intake=state.workspace?.intake||{},g={...(state.workspace?.generated_assets||{}),[type]:{ready:true,updated_at:new Date().toISOString()}};await sb.from('deal_workspaces').upsert({deal_id:state.deal.id,owner_id:state.user.id,intake,generated_assets:g,updated_at:new Date().toISOString()},{onConflict:'deal_id'});if(state.workspace)state.workspace.generated_assets=g}
  async function uploadFiles(files){if(!state.user||!state.deal)return;const status=$('v12UploadStatus'),allowed=/\.(pdf|docx|xlsx)$/i;let done=0;for(const file of files){if(!allowed.test(file.name)){if(status)status.textContent=`Skipped ${file.name}: PDF, DOCX or XLSX only.`;continue}if(file.size>10*1024*1024){if(status)status.textContent=`Skipped ${file.name}: maximum 10 MB.`;continue}const path=`${state.user.id}/${state.deal.id}/${Date.now()}-${Math.random().toString(36).slice(2,7)}-${safeName(file.name)}`;const {error}=await sb.storage.from('deal-documents').upload(path,file,{contentType:mimeFor(file),upsert:false});if(error)throw error;done++}if(status)status.textContent=`Uploaded ${done} file${done===1?'':'s'}. Rechecking the data room…`;await refresh()}
  async function refresh(){if(loading)return;const id=$('capitalDealSelect')?.value;if(!id)return;loading=true;try{if(await load())render()}catch(e){console.error('advisor workspace v12',e)}finally{loading=false}}
  function schedule(){[0,220,600,1200].forEach(ms=>setTimeout(()=>{patchShell();refresh()},ms))}
  function boot(){styles();patchShell();let n=0;const tick=()=>{n++;patchShell();if($('capitalDealSelect')?.value&&$ ('capitalSection')?.querySelector('.capitalControls')){schedule();return}if(n<60)setTimeout(tick,300)};tick();setInterval(patchShell,4000)}

  document.addEventListener('click',async e=>{
    if(e.target.closest('.navBtn[data-section="capital"],#capitalRefresh')){schedule();return}
    const t=e.target.closest('[data-v12-toggle]');if(t){const b=$('v12DataBody');b?.classList.toggle('hidden');t.textContent=b?.classList.contains('hidden')?'Open Deal Data':'Collapse';return}
    const s=e.target.closest('[data-v12-save]');if(s){s.disabled=true;try{await save();s.textContent='Saved';setTimeout(()=>s.textContent='Save Deal Data',1000)}catch(err){alert(err?.message||'Could not save deal data.')}finally{s.disabled=false}return}
    const up=e.target.closest('[data-v12-upload]');if(up){$('v12SourceUpload')?.click();return}
    const req=e.target.closest('[data-v12-seller]');if(req){const text=sellerRequest(readiness());try{await navigator.clipboard.writeText(text);req.textContent='Seller Request Copied';setTimeout(()=>req.textContent='Copy Seller Request',1400)}catch(_){alert(text)}return}
    const doc=e.target.closest('[data-v12-doc]');if(doc&&!doc.disabled){e.preventDefault();e.stopImmediatePropagation();const type=doc.dataset.v12Doc;await markGenerated(type).catch(()=>{});window.OuterHavenCapitalDocsV9?.renderAsset(type);return}
    const go=e.target.closest('[data-v12-go]');if(go){qs(`.navBtn[data-section="${go.dataset.v12Go}"]`)?.click();return}
  },true);
  document.addEventListener('change',async e=>{if(e.target?.id==='capitalDealSelect'){schedule();return}if(e.target?.id==='v12SourceUpload'){const files=[...(e.target.files||[])];e.target.value='';if(files.length)try{await uploadFiles(files)}catch(err){alert(err?.message||'Could not upload source files.')}}},true);

  window.OuterHavenAdvisorWorkspaceV12={refresh,readiness:()=>readiness(),sellerRequest:()=>sellerRequest(readiness())};boot();
})();