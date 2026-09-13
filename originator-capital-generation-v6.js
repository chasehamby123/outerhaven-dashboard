(function(){
  if(window.__outerhavenCapitalGenerationV6)return;
  window.__outerhavenCapitalGenerationV6=true;
  const sb=window.__OUTERHAVEN_ORIGINATOR_SB;if(!sb)return;
  const $=id=>document.getElementById(id);
  const generatedKeys=['investment_thesis','transaction_rationale','market_position','risks','mitigants'];
  let busy=false;

  const clean=v=>String(v||'').replace(/\u00a0/g,' ').replace(/\s+/g,' ').trim();
  const norm=v=>clean(v).toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  const has=v=>clean(v).length>0;
  const money=v=>{const n=Number(v||0);if(!n)return'';if(n>=1e9)return'$'+(n/1e9).toFixed(n%1e9?1:0)+'B';if(n>=1e6)return'$'+(n/1e6).toFixed(n%1e6?1:0)+'M';if(n>=1e3)return'$'+(n/1e3).toFixed(n%1e3?1:0)+'K';return'$'+n.toLocaleString()};
  const amountText=v=>{const s=clean(v);const m=s.match(/^\$?\s*(\d+(?:\.\d+)?)\s*(k|m|mm|mn|million|b|bn|billion)$/i);if(!m)return s;let suffix=m[2].toLowerCase();if(['mm','mn','million'].includes(suffix))suffix='M';else if(['b','bn','billion'].includes(suffix))suffix='B';else suffix=suffix.toUpperCase();return'$'+m[1]+suffix};
  const positive=v=>has(v)&&!/^(?:no|none|zero|unknown|tbd|not applicable|n\/a|not yet)\b/i.test(clean(v));
  function cleanName(v){const o=clean(v);if(!o)return'';return o.replace(/\.(?:pdf|pptx?|docx?)$/i,'').replace(/\s*(?:[-–—|:]\s*)?(?:investor\s+pitch\s+deck|pitch\s+deck|investor\s+presentation|investment\s+presentation|investor\s+deck|investment\s+deck|confidential\s+information\s+memorandum|information\s+memorandum|investment\s+memorandum|investor\s+teaser|investment\s+teaser|teaser|cim)\s*$/i,'').trim()||o}
  function match(t,re,g=1){const m=String(t||'').match(re);return m?clean(m[g]||''):''}
  function sentence(t,re){return clean(t).split(/(?<=[.!?;])\s+/).find(x=>re.test(x))||''}
  function flags(d){const t=norm(d?.transaction_type),all=norm(`${d?.sector||''} ${d?.title||''} ${d?.company||''} ${d?.summary||''}`);return{debt:/debt|loan|credit|refinanc|unitranche|mezz/.test(t),acq:/acquisition|buyout|purchase|m a/.test(t),sale:/sale|sell side|divest|exit/.test(t),equity:/equity|growth capital|minority|majority/.test(t),jv:/joint venture|\bjv\b/.test(t),re:/real estate|hospitality|hotel|resort|property|multifamily|self storage|commercial property|branded residence|villa/.test(all),hospitality:/hospitality|hotel|resort|branded residence|villa/.test(all),development:/development|construction|ground up|ground-up|pre sale|pre-sale|presale|pre sold|pre-sold/.test(all)}}
  function presaleFacts(s){
    const txt=clean(s),near=txt.match(/(?:\$\s*[\d,.]+\s*(?:M|B)\s*)?(?:pre[- ]?sold|pre[- ]?sale|presale|reservation)[^.;]{0,220}/i)?.[0]||'';
    const before=match(txt,/(\$\s*[\d,.]+\s*(?:M|B))\s*(?:pre[- ]?sold|pre[- ]?sale|presale)/i);
    const after=match(txt,/(?:pre[- ]?sold|pre[- ]?sale|presale)[^$]{0,45}(\$\s*[\d,.]+\s*(?:M|B))/i);
    const amt=before||after||match(near,/(\$\s*[\d,.]+\s*(?:M|B))/i);
    const soldCount=match(near||txt,/(\d+)\s+of\s+(\d+)\s+villas?/i,1),soldTotal=match(near||txt,/(\d+)\s+of\s+(\d+)\s+villas?/i,2);
    let status='';if(/\bLOI\b|letter of intent/i.test(near))status='LOI';else if(/executed|signed|contracted|purchase agreement|\bSPA\b|binding/i.test(near))status='Contracted';if(/deposit|collections?|paid|funded/i.test(near)&&status!=='LOI')status='Funded / Collected';
    return{amt,soldCount,soldTotal,status};
  }
  function sourceFacts(d){
    const s=clean(d?.summary||''),pre=presaleFacts(s);
    return{
      moic:match(s,/(\d+(?:\.\d+)?)x\s+(?:LP\s+)?MOIC/i),irr:match(s,/(\d{1,3}(?:\.\d+)?)%\s+(?:LP\s+)?IRR/i),hold:match(s,/(\d+(?:\.\d+)?)\s*[- ]?year\s+hold/i),
      pipeline:match(s,/(\$\s*[\d,.]+\s*(?:M|B))\s+(?:gross\s+)?residential\s+pipeline/i),keys:match(s,/(\d+)\s*[- ]?key\s+(?:hotel|resort)/i),villas:match(s,/(\d+)\s+(?:branded\s+)?villas?/i),adr:match(s,/ADR\s*(?:of|at|:)?\s*\$\s*([\d,]+)/i)||match(s,/\$\s*([\d,]+)\s+ADR/i),brand:match(s,/\b(St\.?\s*Regis|Marriott|Four Seasons|Mandarin Oriental|Aman|Rosewood|Ritz-Carlton|Hilton|Hyatt|Accor|IHG)\b/i),brandTerm:match(s,/(\d+)\s*[- ]?year\s+term/i),sitePSA:/executed\s+PSA/i.test(s),escrow:/earnest\s+funds?\s+in\s+escrow/i.test(s),assignable:/assignable\s+to\s+(?:the\s+)?project\s+SPV/i.test(s),pre
    };
  }
  function preSaleSentence(p){if(!p.amt)return'';const scope=p.soldCount&&p.soldTotal?` across ${p.soldCount} of ${p.soldTotal} villas`:'';if(p.status==='LOI')return `${p.amt} pre-sale LOI${scope} provides early demand validation and can reduce residual sell-through exposure as commitments convert into binding sales.`;if(p.status==='Funded / Collected')return `${p.amt} of funded or collected pre-sales${scope} validates demand and can reduce the remaining external capital requirement.`;if(p.status==='Contracted')return `${p.amt} of contracted pre-sales${scope} validates demand and reduces residual inventory exposure, subject to deposit and collection mechanics.`;return `${p.amt} of referenced pre-sales${scope} provides demand validation, with the degree of de-risking dependent on binding status and collection mechanics.`}
  function joined(items){const a=items.map(clean).filter(Boolean);if(!a.length)return'';if(a.length===1)return a[0];if(a.length===2)return`${a[0]} and ${a[1]}`;return`${a.slice(0,-1).join(', ')}, and ${a[a.length-1]}`}
  function draft(d,i){
    const f=flags(d),x=sourceFacts(d),name=cleanName(d.company||d.title)||'The opportunity',ask=amountText(i.diligence_capital_ask)||money(d.deal_size),total=amountText(i.diligence_total_size),structure=clean(i.diligence_capital_structure),uses=clean(i.diligence_sources_uses)||clean(i.use_of_proceeds),track=clean(i.diligence_sponsor_track_record),sponsor=clean(i.sponsor_equity),lead=positive(i.diligence_lead_capital)?clean(i.diligence_lead_capital):'';
    let investment_thesis='',transaction_rationale='',market_position='';
    const risks=[],mitigants=[];

    if(f.re&&f.development){
      const program=joined([x.keys?`${x.keys}-key ${x.brand?x.brand+' ':''}hotel`:'',x.villas?`${x.villas} branded villas`:'']);
      investment_thesis=`${name} is a ${program?program+' ':''}real-estate development${d.geography?' in '+d.geography:''}`;
      if(total)investment_thesis+=` with a referenced total project size of ${total}`;
      if(ask)investment_thesis+=`${total?',':''} seeking ${ask} of ${structure?structure.toLowerCase()+' ':''}capital`;
      investment_thesis+='.';
      const drivers=[];if(x.pre.amt)drivers.push(preSaleSentence(x.pre));if(x.brand)drivers.push(`${x.brand} brand engagement supports premium hospitality positioning${x.adr?` and an approximately $${x.adr} ADR underwriting case`:''}.`);if(x.sitePSA)drivers.push(`Site control is supported by an executed PSA${x.escrow?' with earnest funds in escrow':''}${x.assignable?' and assignability to the project SPV':''}.`);if(x.moic&&x.irr)drivers.push(`The underwriting targets ${x.moic}x LP MOIC and ${x.irr}% LP IRR over ${x.hold?x.hold+' years':'the investment period'}.`);if(drivers.length)investment_thesis+=' '+drivers.slice(0,3).join(' ');
      transaction_rationale=`The capital plan is structured around completing the development and converting the residential and hospitality program into monetizable assets.`;if(uses)transaction_rationale+=` Current sources-and-uses information identifies ${uses.replace(/[.]$/,'')}.`;if(sponsor)transaction_rationale+=` Sponsor capital is referenced at ${sponsor.replace(/[.]$/,'')}.`;if(lead)transaction_rationale+=` Existing lead or committed-capital status: ${lead.replace(/[.]$/,'')}.`;
      market_position=`The project targets the premium hospitality and branded-residential market${d.geography?' in '+d.geography:''}.`;if(x.pipeline)market_position+=` The residential component represents approximately ${x.pipeline} of gross pipeline.`;if(x.adr)market_position+=` Hotel underwriting references an ADR of approximately $${x.adr}.`;if(track)market_position+=` Sponsor experience includes ${track.replace(/[.]$/,'')}.`;
      risks.push('Construction completion, schedule and cost control');if(x.pre.amt)risks.push(x.pre.status==='LOI'?'Conversion of pre-sale LOIs into binding sales':'Buyer completion and collection timing');if(f.hospitality)risks.push('Hotel ramp-up and operator execution');risks.push('Asset valuation and exit liquidity');
      if(x.pre.amt)mitigants.push(preSaleSentence(x.pre));if(x.sitePSA)mitigants.push(`Site control is supported by an executed PSA${x.escrow?' with earnest funds in escrow':''}${x.assignable?' and assignability to the project SPV':''}.`);if(x.brand)mitigants.push(`${x.brand} brand engagement supports the operating and positioning case.`);if(sponsor)mitigants.push(`Sponsor capital is referenced at ${sponsor.replace(/[.]$/,'')}.`);
    }else if(f.debt){
      investment_thesis=`${name}${d.sector?' in '+d.sector:''}${d.geography?' across '+d.geography:''} is seeking ${ask||'capital'}${structure?' through '+structure.toLowerCase():''}.`;
      const perf=clean(i.historical_performance)||[Number(d.revenue)>0?`revenue of ${money(d.revenue)}`:'',Number(d.ebitda)>0?`EBITDA of ${money(d.ebitda)}`:''].filter(Boolean).join(' and ');if(perf)investment_thesis+=` Historical support includes ${perf.replace(/[.]$/,'')}.`;
      transaction_rationale=uses?`Proceeds are intended for ${uses.replace(/[.]$/,'')}.`:`The financing is intended to support the stated transaction and capital plan.`;if(i.collateral_security)transaction_rationale+=` Security is described as ${clean(i.collateral_security).replace(/[.]$/,'')}.`;
      market_position=clean(i.market_position)||`${name} is positioned within ${d.sector||'its operating sector'}${d.geography?' in '+d.geography:''}.`;
      risks.push('Debt-service capacity and downside cash-flow coverage','Covenant, collateral and lien-position risk','Refinancing or repayment execution');if(i.collateral_security)mitigants.push(`The financing references ${clean(i.collateral_security).replace(/[.]$/,'')}.`);if(perf)mitigants.push(`Historical operating support includes ${perf.replace(/[.]$/,'')}.`);
    }else if(f.acq||f.sale){
      investment_thesis=`${name}${d.sector?' in '+d.sector:''}${d.geography?' in '+d.geography:''} is being evaluated as ${d.transaction_type||'a private-market transaction'}`;if(total)investment_thesis+=` at a referenced transaction size of ${total}`;if(ask)investment_thesis+=`${total?',':''} with ${ask} of capital required`;investment_thesis+='.';
      const perf=clean(i.historical_performance)||[Number(d.revenue)>0?`revenue of ${money(d.revenue)}`:'',Number(d.ebitda)>0?`EBITDA of ${money(d.ebitda)}`:''].filter(Boolean).join(' and ');if(perf)investment_thesis+=` Historical performance includes ${perf.replace(/[.]$/,'')}.`;if(i.valuation)investment_thesis+=` Pricing is referenced at ${clean(i.valuation).replace(/[.]$/,'')}.`;
      transaction_rationale=clean(i.transaction_rationale)||`The transaction is structured as ${d.transaction_type||'a private-market transaction'}.`;if(uses)transaction_rationale+=` Capital use: ${uses.replace(/[.]$/,'')}.`;
      market_position=clean(i.market_position)||`${name} is positioned within ${d.sector||'its sector'}${d.geography?' in '+d.geography:''}.`;if(track)market_position+=` Management or sponsor experience includes ${track.replace(/[.]$/,'')}.`;
      risks.push('Quality of earnings and normalization risk','Transaction execution and closing conditions','Customer, supplier or contract concentration','Valuation and exit risk');if(perf)mitigants.push(`Historical performance provides an operating base for underwriting: ${perf.replace(/[.]$/,'')}.`);if(sponsor)mitigants.push(`Sponsor capital is referenced at ${sponsor.replace(/[.]$/,'')}.`);
    }else{
      investment_thesis=`${name}${d.sector?' in '+d.sector:''}${d.geography?' in '+d.geography:''} is seeking ${ask||'growth capital'}${structure?' through '+structure.toLowerCase():''}.`;if(i.forecast)investment_thesis+=` The current business plan references ${clean(i.forecast).replace(/[.]$/,'')}.`;
      transaction_rationale=uses?`Capital is intended for ${uses.replace(/[.]$/,'')}.`:`The capital is intended to support the stated growth and transaction plan.`;if(i.ownership)transaction_rationale+=` Current ownership is described as ${clean(i.ownership).replace(/[.]$/,'')}.`;
      market_position=clean(i.market_position)||`${name} is positioned within ${d.sector||'its sector'}${d.geography?' in '+d.geography:''}.`;if(track)market_position+=` Sponsor or management experience includes ${track.replace(/[.]$/,'')}.`;
      risks.push('Forecast execution and growth delivery','Capital deployment and operating execution','Ownership, governance and dilution risk','Exit and liquidity risk');if(sponsor)mitigants.push(`Sponsor capital is referenced at ${sponsor.replace(/[.]$/,'')}.`);if(i.forecast)mitigants.push(`The investment case is supported by the current business plan and quantified forecast.`);
    }
    return{investment_thesis:clean(investment_thesis),transaction_rationale:clean(transaction_rationale),market_position:clean(market_position),risks:risks.slice(0,4).join('; ')+(risks.length?'.':''),mitigants:mitigants.slice(0,4).join(' ')};
  }

  async function run(){
    if(busy)return;const id=$('capitalDealSelect')?.value;if(!id)return;busy=true;
    try{
      const {data:{session}}=await sb.auth.getSession();if(!session)return;
      const [dr,wr]=await Promise.all([sb.from('deals').select('*').eq('id',id).maybeSingle(),sb.from('deal_workspaces').select('*').eq('deal_id',id).maybeSingle()]);
      if(dr.error||wr.error||!dr.data)return;
      const intake={...(wr.data?.intake||{})},gm=(intake.__generated&&typeof intake.__generated==='object')?{...intake.__generated}:{},gen=draft(dr.data,intake);let changed=false;
      generatedKeys.forEach(k=>{if(!has(intake[k])||gm[k]){if(intake[k]!==gen[k]||!gm[k])changed=true;intake[k]=gen[k]||'';gm[k]=true}});intake.__generated=gm;
      if(!changed&&wr.data)return;
      const {error}=await sb.from('deal_workspaces').upsert({deal_id:id,owner_id:session.user.id,intake,generated_assets:wr.data?.generated_assets||{},updated_at:new Date().toISOString()},{onConflict:'deal_id'});if(error)throw error;
      setTimeout(()=>window.OuterHavenCapitalSuiteV18?.refresh?.(),100);
    }catch(err){console.error('capital generation v6',err)}finally{busy=false}
  }
  function schedule(){[120,550,1300].forEach(ms=>setTimeout(run,ms))}
  document.addEventListener('click',e=>{if(e.target.closest('.navBtn[data-section="capital"],#capitalRefresh,[data-v18-save],[data-v18-edit-save]'))schedule()},true);
  document.addEventListener('change',e=>{if(e.target?.id==='capitalDealSelect')schedule()},true);
  window.addEventListener('focus',()=>setTimeout(run,250));
  [500,1400,2800].forEach(ms=>setTimeout(run,ms));
})();
