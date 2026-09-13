(function(){
  if(window.__outerhavenRequiredFactValidatorV3)return;
  window.__outerhavenRequiredFactValidatorV3=true;
  const sb=window.__OUTERHAVEN_ORIGINATOR_SB;if(!sb)return;
  const $=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#039;'}[m]));
  const norm=v=>String(v||'').toLowerCase().replace(/[^a-z0-9$%.]+/g,' ').trim();
  const substantive=v=>String(v||'').trim().length>=2;
  const moneyRe=/(?:US\$|USD|\$)\s*\d|\b\d+(?:\.\d+)?\s*(?:k|m|mm|mn|million|b|bn|billion)\b/i;
  const pctRe=/\b\d+(?:\.\d+)?\s*%/;
  const explicitUnknown=/\b(?:unknown|not known|not determined|not finali[sz]ed|tbd|to be determined|not available yet)\b/i;

  const universal=[
    'diligence_total_size',
    'diligence_capital_ask',
    'diligence_capital_structure',
    'diligence_sources_uses',
    'diligence_sponsor_connection',
    'diligence_exclusive_mandate',
    'diligence_marketing_duration',
    'diligence_other_representatives',
    'diligence_prior_exposure',
    'diligence_lead_capital',
    'diligence_sponsor_track_record',
    'sponsor_equity'
  ];

  const labels={
    diligence_total_size:'Total Project / Transaction Size',
    diligence_capital_ask:'Exact Capital Ask',
    diligence_capital_structure:'Capital Structure',
    diligence_sources_uses:'Sources & Uses',
    diligence_sponsor_connection:'Direct Sponsor / Management Access',
    diligence_exclusive_mandate:'Signed Exclusive Mandate',
    diligence_marketing_duration:'Time in Market',
    diligence_other_representatives:'Other Firms Representing / Circulating the Deal',
    diligence_prior_exposure:'Prior Investor / Lender Exposure',
    diligence_lead_capital:'Lead Investor / Term Sheet / Committed Capital',
    diligence_sponsor_track_record:'Sponsor / Management Track Record',
    sponsor_equity:'Sponsor Capital Invested / Committed',
    use_of_proceeds:'Use of Proceeds',ownership:'Ownership & Capitalization',existing_debt:'Existing Debt',valuation:'Valuation / Pricing',historical_performance:'Historical Performance',forecast:'Forecast / Business Plan',asset_value:'Asset Value / Purchase Price',noi:'NOI / Property Cash Flow',project_status:'Project / Development Status',development_budget:'Development / Construction Budget',site_control:'Site Control / Title',collateral_security:'Collateral / Security'
  };

  const questions={
    diligence_total_size:'What is the total project or transaction size? For a development, give the total project cost. For an acquisition or sale, give the purchase price, enterprise value, or total transaction value.',
    diligence_capital_ask:'What is the exact amount of capital being requested?',
    diligence_capital_structure:'Is the capital ask equity, debt, mezzanine financing, or a combination? If it is a combination, give the approximate split.',
    diligence_sources_uses:'Provide a basic sources-and-uses breakdown. State where the capital is coming from and what the capital will fund.',
    diligence_sponsor_connection:'Are you directly connected with the management or sponsor team? Briefly state the relationship.',
    diligence_exclusive_mandate:'Is there a signed exclusive mandate directly with the sponsor or management team? Answer Yes or No and briefly describe the authorization if helpful.',
    diligence_marketing_duration:'How long has the opportunity been marketed? If it has not been marketed yet, say so.',
    diligence_other_representatives:'How many other firms are currently representing or circulating the opportunity? If none, say none.',
    diligence_prior_exposure:'Which investors, banks, family offices, lenders, or institutions have already reviewed or received the opportunity? List names where permitted. If confidentiality prevents naming them, state the type and approximate number.',
    diligence_lead_capital:'Is there already a lead investor, term sheet, or committed capital? State which applies, the amount if known, and the current status.',
    diligence_sponsor_track_record:'What is the sponsor or management team’s relevant track record? Include comparable projects, transactions, operating history, or realized exits where relevant.',
    sponsor_equity:'How much capital has the sponsor already invested in this deal, and how much additional sponsor capital is firmly committed? Separate already funded from committed if known. Do not include capital being raised from outside investors.',
    use_of_proceeds:'Specify what the requested capital will fund. For a development, identify the major uses rather than simply saying “construction.”',
    ownership:'Identify the current ownership or capitalization with enough detail for an investor to understand who owns the business or asset.',
    existing_debt:'Provide the outstanding debt amount and material structure, or explicitly state that there is no existing debt.',
    valuation:'Provide the purchase price, valuation, asking price, multiple, cap rate or other actual pricing framework.',
    historical_performance:'Provide actual historical operating or financial performance, not merely a reference to historical results.',
    forecast:'Provide the key forward assumptions or quantified forecast investors are expected to underwrite.',
    asset_value:'Provide the asset value or purchase price.',
    noi:'Provide current or stabilized NOI or equivalent property cash flow.',
    project_status:'State the actual development stage or milestone, such as pre-groundbreak, permitting, under construction, percentage complete or completion status.',
    development_budget:'Provide the total development / construction budget and, if known, the remaining capital requirement. A reference to “construction costs” alone is not enough.',
    site_control:'State how the site is controlled, such as owned, executed purchase agreement, leasehold or option.',
    collateral_security:'State the actual collateral / security package, guarantees, or explicitly state that the financing is unsecured.'
  };

  const examples={
    diligence_total_size:'Example: Total project cost is $240M.',
    diligence_capital_ask:'Example: $150M of external capital is being raised.',
    diligence_capital_structure:'Example: $100M equity + $50M senior debt.',
    diligence_sources_uses:'Example: Sources: $100M LP equity, $35M debt, $15M sponsor capital. Uses: land, construction, FF&E, fees and reserves.',
    diligence_sponsor_connection:'Example: Yes — direct relationship with the sponsor and CFO.',
    diligence_exclusive_mandate:'Example: No — direct sponsor relationship, but no exclusive mandate.',
    diligence_marketing_duration:'Example: Marketed privately for approximately 6 weeks.',
    diligence_other_representatives:'Example: Two other advisory firms are currently circulating it.',
    diligence_prior_exposure:'Example: Shown to 4 family offices and 2 banks; names available under NDA.',
    diligence_lead_capital:'Example: One lead investor in diligence; no term sheet yet; $20M soft-circled.',
    diligence_sponsor_track_record:'Example: Sponsor has completed 7 hospitality developments totaling $600M.',
    sponsor_equity:'Example: $5M already invested; $10M additional sponsor capital committed.'
  };

  let running=false;

  function flags(d){const t=norm(d?.transaction_type),all=norm(`${d?.sector||''} ${d?.title||''} ${d?.company||''} ${d?.summary||''}`);return{sale:/sale|sell side|divest|exit/.test(t),acq:/acquisition|buyout|purchase|m a/.test(t),debt:/debt|loan|credit|refinanc|unitranche|mezz/.test(t),equity:/equity|growth capital|minority|majority/.test(t),jv:/joint venture|\bjv\b/.test(t),re:/real estate|hospitality|hotel|resort|property|multifamily|self storage|commercial property/.test(all),development:/development|construction|ground up|ground-up|pre sale|pre-sale|presale|pre sold|pre-sold/.test(all)}}
  function transactionRequired(d){const f=flags(d),out=[];if(f.debt){out.push('use_of_proceeds','existing_debt','collateral_security');if(!f.development)out.push('historical_performance');else out.push('development_budget','project_status','site_control')}else if(f.re&&f.development){out.push('use_of_proceeds','development_budget','project_status','site_control')}else if(f.re){out.push('asset_value','noi','site_control');if(f.sale||f.acq)out.push('valuation')}else if(f.sale||f.acq){out.push('valuation','historical_performance')}else if(f.equity||f.jv){out.push('use_of_proceeds','forecast','ownership')}else out.push('use_of_proceeds','forecast');return[...new Set(out)]}
  function sentence(text,re){return String(text||'').replace(/\s+/g,' ').split(/(?<=[.!?;])\s+/).find(x=>re.test(x))||''}
  function context(text,re,radius=190){const s=String(text||'').replace(/\s+/g,' '),m=re.exec(s);if(!m)return'';return s.slice(Math.max(0,m.index-radius),Math.min(s.length,m.index+m[0].length+radius)).trim()}
  function fmtMoney(v){const n=Number(v||0);if(!n)return'';if(n>=1e9)return'$'+(n/1e9).toFixed(n%1e9?1:0)+'B';if(n>=1e6)return'$'+(n/1e6).toFixed(n%1e6?1:0)+'M';if(n>=1e3)return'$'+(n/1e3).toFixed(n%1e3?1:0)+'K';return'$'+n.toLocaleString()}

  function deriveUniversal(d,key){
    const s=String(d?.summary||''),rel=String(d?.seller_relationship||''),type=String(d?.transaction_type||'');
    if(key==='diligence_capital_ask'&&Number(d?.deal_size)>0)return `Capital ask: ${fmtMoney(d.deal_size)}`;
    if(key==='diligence_total_size')return sentence(s,/total project cost|total development cost|total project size|total transaction (?:size|value)|transaction value|enterprise value|purchase price/i)||'';
    if(key==='diligence_capital_structure'){
      if(/equity raise/i.test(type))return'Equity';
      if(/debt financing/i.test(type))return'Debt';
      if(/full or partial sale/i.test(type))return'Equity sale / secondary transaction';
      return sentence(s,/capital stack|capital structure|senior debt|mezzanine|preferred equity|common equity|equity raise|debt financing|debt and equity|equity and debt/i)||'';
    }
    if(key==='diligence_sources_uses')return context(s,/sources?\s*(?:&|and)\s*uses?|sources?:|uses?:/i,240)||'';
    if(key==='diligence_sponsor_connection'){
      if(/direct sponsor\s*\/\s*ownership relationship/i.test(rel))return'Yes — direct sponsor / ownership relationship';
      return sentence(s,/direct(?:ly)? connected|direct relationship|working directly with|direct sponsor access|direct management access/i)||'';
    }
    if(key==='diligence_exclusive_mandate')return sentence(s,/signed exclusive mandate|executed exclusive mandate|exclusive engagement|non-exclusive engagement|nonexclusive engagement|written authorization/i)||'';
    if(key==='diligence_marketing_duration')return sentence(s,/marketed for|in the market for|on the market for|marketed since|launched to market|not yet marketed|has not been marketed/i)||'';
    if(key==='diligence_other_representatives')return sentence(s,/other firms|other advisors|other intermediaries|other brokers|firms currently representing|circulating the opportunity|no other firms|no other advisors/i)||'';
    if(key==='diligence_prior_exposure')return sentence(s,/already (?:seen|reviewed) by|shown to|circulated to|approached (?:by|to)|investors? contacted|banks? contacted|family offices? contacted|institutions? contacted/i)||'';
    if(key==='diligence_lead_capital')return sentence(s,/lead investor|anchor investor|term sheet|committed capital|capital committed|soft circled|soft-circled|commitment/i)||'';
    if(key==='diligence_sponsor_track_record')return sentence(s,/track record|sponsor has completed|management team has completed|projects? delivered|transactions? completed|realized exits?|years of experience/i)||'';
    if(key==='sponsor_equity')return sentence(s,/sponsor equity|sponsor capital|equity contribution|already invested|sponsor invested|cash equity|skin in the game/i)||'';
    return'';
  }

  function deriveTransaction(d,key){const s=String(d?.summary||'');const map={use_of_proceeds:/use of proceeds|proceeds will|funds will|capital will|raise is for/i,ownership:/ownership|owned by|shareholder|cap table|sponsor owns|founder owns|equity split/i,existing_debt:/existing debt|current debt|loan|credit facility|mortgage|leverage/i,valuation:/valuation|purchase price|asking price|enterprise value|equity value|cap rate/i,forecast:/forecast|projected|projection|pro forma|stabilized|expected to grow|expected revenue|expected ebitda|irr|moic/i,asset_value:/asset value|property value|purchase price|appraised value/i,noi:/\bnoi\b|net operating income/i,project_status:/pre[- ]?groundbreak|groundbreak|under construction|construction started|construction complete|development stage|project status|permit|entitlement|% complete/i,development_budget:/development budget|construction budget|total project cost|project cost|hard cost|soft cost|construction cost/i,site_control:/site control|executed psa|purchase agreement|title|freehold|leasehold|land owned|property owned|land acquisition|option/i,collateral_security:/collateral|security package|guarantee|pledge|unsecured/i,historical_performance:/historical revenue|historical ebitda|historical performance|revenue|ebitda/i};if(key==='historical_performance'&&(Number(d?.revenue)>0||Number(d?.ebitda)>0)){const a=[];if(Number(d.revenue)>0)a.push(`Revenue ${fmtMoney(d.revenue)}`);if(Number(d.ebitda)>0)a.push(`EBITDA ${fmtMoney(d.ebitda)}`);return a.join(' · ')}return sentence(s,map[key]||/$a/)}

  function explicitAnswer(v){return /^(?:yes|no|none|zero|not marketed|not yet marketed|no other firms|no other advisors|no term sheet|no committed capital|no lead investor|first[- ]time sponsor)\b/i.test(String(v||'').trim())||explicitUnknown.test(v)}
  function validUniversal(key,value){const v=String(value||'').trim();if(!substantive(v))return false;if(explicitAnswer(v))return true;switch(key){
    case'diligence_total_size':return moneyRe.test(v)||/\b\d+(?:\.\d+)?x\b/i.test(v);
    case'diligence_capital_ask':return moneyRe.test(v);
    case'diligence_capital_structure':return /equity|debt|mezz|preferred|senior|junior|unitranche|hybrid|combination|structured|sale|joint venture|\bjv\b/i.test(v);
    case'diligence_sources_uses':return v.length>=18&&(/sources?/i.test(v)&&/uses?/i.test(v)||((v.match(/\$/g)||[]).length>=2&&/equity|debt|sponsor|capital/i.test(v)));
    case'diligence_sponsor_connection':return /direct|management|sponsor|owner|founder|relationship|connected/i.test(v);
    case'diligence_exclusive_mandate':return /exclusive|mandate|engagement|authorization|authorised|authorized|signed|executed/i.test(v);
    case'diligence_marketing_duration':return /\d|week|month|year|day|since|marketed|launched/i.test(v);
    case'diligence_other_representatives':return /\d|firm|advisor|broker|intermediar|represent|circulat/i.test(v);
    case'diligence_prior_exposure':return v.length>=5;
    case'diligence_lead_capital':return /lead|anchor|term sheet|commit|soft.?circle|capital/i.test(v);
    case'diligence_sponsor_track_record':return v.length>=12;
    case'sponsor_equity':return moneyRe.test(v)||pctRe.test(v)||/\b(?:no sponsor capital|no sponsor equity|zero sponsor capital|none)\b/i.test(v);
    default:return substantive(v);
  }}
  function validTransaction(key,value){const v=String(value||'').trim();if(v.length<8)return false;switch(key){
    case'use_of_proceeds':return v.length>=24&&!/^(?:the\s+)?(?:full\s+)?construction(?:\s+only)?[.!]?$/i.test(v)&&/(construct|acqui|refinanc|working capital|capex|development|land|ff&e|fit.?out|fees|reserve|growth|inventory|debt|purchase)/i.test(v);
    case'development_budget':return moneyRe.test(v)&&/(budget|cost|development|construction|project)/i.test(v);
    case'project_status':return /(pre[- ]?groundbreak|predevelopment|pre-development|planning|design|permitt|entitlement|approved|under construction|construction (?:started|commenced|complete)|groundbreak|\d+\s*%\s*complete|completed|stabilized)/i.test(v);
    case'site_control':return /(owned|ownership|executed\s+(?:psa|purchase agreement)|purchase agreement|under contract|leasehold|lease|option|title|site control|land acquisition)/i.test(v);
    case'existing_debt':return moneyRe.test(v)||/\b(?:no existing debt|no debt|debt[- ]?free|unlevered|unleveraged)\b/i.test(v);
    case'valuation':return moneyRe.test(v)||/\b\d+(?:\.\d+)?x\b/i.test(v)||/\b\d+(?:\.\d+)?\s*%\s*(?:cap rate|yield)/i.test(v);
    case'asset_value':return moneyRe.test(v);
    case'noi':return moneyRe.test(v)&&(/\bnoi\b|net operating income/i.test(v));
    case'historical_performance':return moneyRe.test(v)||(/\b(?:revenue|ebitda|noi|margin|sales)\b/i.test(v)&&/\d/.test(v));
    case'forecast':return /\d/.test(v)&&/(forecast|project|pro forma|revenue|ebitda|noi|irr|moic|growth|occupancy|adr|margin)/i.test(v);
    case'ownership':return pctRe.test(v)||(/\b(?:owned by|ownership|shareholder|founder|sponsor|parent|cap table)\b/i.test(v)&&v.length>=20);
    case'collateral_security':return /(collateral|secured by|security interest|pledge|guarantee|mortgage|lien|unsecured)/i.test(v);
    default:return v.length>=8;
  }}

  function coreDeck(docs){return docs.some(x=>/req-overview|cim|memorandum|teaser|deck|one.?pager|overview|pitch/i.test(String(x.name||'')))}
  function requestText(key,deal){return `Please provide the following diligence information for ${deal?.company||deal?.title||'this opportunity'}:\n\n${questions[key]||labels[key]||key}`}
  function nextMarkup(key,remaining,answeredCore){const core=universal.includes(key);const prefix=core?'CORE DILIGENCE':'TRANSACTION DILIGENCE';return`<div class="v17Next"><div class="eyebrow">${prefix} · ${core?`${answeredCore} OF ${universal.length} CAPTURED`:`${remaining} ITEM${remaining===1?'':'S'} REMAINING`}</div><h4>${esc(labels[key]||key)}</h4><p>${esc(questions[key]||'Provide the source-backed factual information needed for the current package.')}</p><textarea id="v17NextFact" class="v17Input" placeholder="${esc(examples[key]||'Add the factual, source-backed answer here.')}"></textarea><div class="v17Actions" style="margin-top:10px"><button class="v17Btn primary" data-v17-save-next="${esc(key)}">Save & Continue</button><button class="v17Btn" data-v17-request="${esc(key)}">Copy Request</button></div></div>`}

  async function audit(){if(running)return;const id=$('capitalDealSelect')?.value,root=$('capitalSuiteV17Core');if(!id||!root)return;running=true;try{
    const {data:{session}}=await sb.auth.getSession();if(!session)return;
    const [dr,wr,ls]=await Promise.all([sb.from('deals').select('*').eq('id',id).maybeSingle(),sb.from('deal_workspaces').select('intake').eq('deal_id',id).maybeSingle(),sb.storage.from('deal-documents').list(`${session.user.id}/${id}`,{limit:100,sortBy:{column:'name',order:'asc'}})]);
    if(dr.error||wr.error||!dr.data)return;
    const d=dr.data,intake=wr.data?.intake||{},tx=transactionRequired(d),combined=[...new Set([...universal,...tx])],effective={};
    combined.forEach(k=>{const saved=String(intake[k]||'').trim();effective[k]=saved||(universal.includes(k)?deriveUniversal(d,k):deriveTransaction(d,k))});
    const missingUniversal=universal.filter(k=>!validUniversal(k,effective[k]));
    const missingTx=tx.filter(k=>!validTransaction(k,effective[k]));
    const missing=[...missingUniversal,...missingTx.filter(k=>!missingUniversal.includes(k))];
    const answeredCore=universal.length-missingUniversal.length;
    const docs=(ls.error?[]:ls.data||[]).filter(x=>x.name&&x.id),deck=coreDeck(docs);
    const old=window.OuterHavenCapitalSuiteV17?.status?.()||{};
    const softwarePct=Number(old.softwarePct||0);
    const core=[!!(d.title&&d.company),Number(d.deal_size)>0,!!(d.sector&&d.geography&&d.transaction_type),!!d.seller_relationship,!!d.authority_confirmed,String(d.summary||'').trim().length>=120];
    const validCount=combined.filter(k=>universal.includes(k)?validUniversal(k,effective[k]):validTransaction(k,effective[k])).length;
    const factPct=Math.round((core.filter(Boolean).length+validCount)/(core.length+combined.length)*100);
    const sourcePct=deck?100:0,readiness=Math.round(softwarePct*.40+factPct*.45+sourcePct*.15);
    const ring=root.querySelector('.v17Ring');if(ring){ring.style.setProperty('--p',readiness);const s=ring.querySelector('strong');if(s)s.textContent=readiness+'%'}
    root.querySelectorAll('.v17Stat').forEach(x=>{const label=x.querySelector('span')?.textContent?.trim(),strong=x.querySelector('strong');if(!strong)return;if(label==='Necessary Facts Left')strong.textContent=missing.length;if(label==='Core Source Material')strong.textContent=deck?'On File':'Needed'});
    const nextPanel=[...root.querySelectorAll('.v17Panel')].find(p=>p.querySelector('.v17Head .eyebrow')?.textContent?.trim()==='NEXT STEP'),body=nextPanel?.querySelector('.v17Body');
    if(body){if(missing.length)body.innerHTML=nextMarkup(missing[0],missing.length,answeredCore);else if(!deck)body.innerHTML='<div class="v17Next"><div class="eyebrow">NEXT NECESSARY STEP</div><h4>Current deal deck / CIM</h4><p>Upload one current source document that describes the opportunity being packaged.</p><input id="v17RequiredUpload" class="v17Upload" type="file" accept=".pdf,.docx,.xlsx"><div class="v17Actions"><button class="v17Btn primary" data-v17-upload-required>Upload Source Document</button></div></div>';else body.innerHTML=`<div class="v17Complete"><strong>Core diligence and initial package requirements are complete.</strong><p>${answeredCore} of ${universal.length} universal diligence questions are captured, and Capital Suite has the source information needed for the current investor package.</p></div>`}
    const strict={...old,mustFacts:combined,missingFacts:missing,factPct,sourcePct,readiness,next:missing[0]||(!deck?'__deck__':null),coreDiligence:{answered:answeredCore,total:universal.length,missing:missingUniversal}};
    if(window.OuterHavenCapitalSuiteV17)window.OuterHavenCapitalSuiteV17.status=()=>strict;
  }finally{running=false}}

  function schedule(){[80,350,900,1600].forEach(ms=>setTimeout(audit,ms))}
  window.addEventListener('click',e=>{
    const r=e.target?.closest?.('[data-v17-request]');if(!r||!universal.includes(r.dataset.v17Request))return;
    e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
    const id=$('capitalDealSelect')?.value;
    (async()=>{const {data}=await sb.from('deals').select('title,company').eq('id',id).maybeSingle();const text=requestText(r.dataset.v17Request,data);try{await navigator.clipboard.writeText(text);r.textContent='Request Copied';setTimeout(()=>r.textContent='Copy Request',1200)}catch(_){alert(text)}})();
  },true);
  document.addEventListener('click',e=>{if(e.target.closest('.navBtn[data-section="capital"],[data-v17-save-next],[data-v17-upload-required]'))schedule()},true);
  document.addEventListener('change',e=>{if(e.target?.id==='capitalDealSelect'||e.target?.id==='v17RequiredUpload')schedule()},true);
  [700,1500,2800].forEach(ms=>setTimeout(audit,ms));
})();