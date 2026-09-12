(function(){
  if(window.__outerhavenCapitalGenerationV5)return;
  window.__outerhavenCapitalGenerationV5=true;
  const sb=window.__OUTERHAVEN_ORIGINATOR_SB;if(!sb)return;
  const $=id=>document.getElementById(id);
  const norm=v=>String(v||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  const filled=v=>String(v||'').trim().length>=8;
  const money=v=>{const n=Number(v||0);if(!n)return'';if(n>=1e9)return'$'+(n/1e9).toFixed(n%1e9?1:0)+'B';if(n>=1e6)return'$'+(n/1e6).toFixed(n%1e6?1:0)+'M';if(n>=1e3)return'$'+(n/1e3).toFixed(n%1e3?1:0)+'K';return'$'+n.toLocaleString()};
  const keys=['investment_thesis','transaction_rationale','market_position','risks','mitigants'];
  let busy=false;
  function cleanName(v){const o=String(v||'').replace(/\s+/g,' ').trim();if(!o)return'';let s=o.replace(/\.(?:pdf|pptx?|docx?)$/i,'').trim();s=s.replace(/\s*(?:[-–—|:]\s*)?(?:investor\s+pitch\s+deck|pitch\s+deck|investor\s+presentation|investment\s+presentation|investor\s+deck|investment\s+deck|confidential\s+information\s+memorandum|information\s+memorandum|investment\s+memorandum|investor\s+teaser|investment\s+teaser|teaser|cim)\s*$/i,'').trim();return s||o}
  function clean(v){let s=String(v||'').replace(/\u00a0/g,' ').replace(/\s+/g,' ').trim();s=s.replace(/^\s*(?:the\s+)?investment\s+case\s*[:\-–—]?\s*/i,'');return s.trim()}
  function match(text,re,g=1){const m=String(text||'').match(re);return m?String(m[g]||'').trim():''}
  function flags(d){const t=norm(d?.transaction_type),all=norm(`${d?.sector||''} ${d?.title||''} ${d?.company||''} ${d?.summary||''}`);return{debt:/debt|loan|credit|refinanc|unitranche|mezz/.test(t),acq:/acquisition|buyout|purchase|m a/.test(t),sale:/sale|sell side|divest|exit/.test(t),re:/real estate|hospitality|hotel|resort|property|multifamily|self storage|commercial property|branded residence|villa/.test(all),hospitality:/hospitality|hotel|resort|branded residence|villa/.test(all),development:/development|construction|ground up|ground-up|pre sale|pre-sale|presale|pre sold|pre-sold/.test(all)} }
  function facts(d){
    const s=clean(d?.summary||'');
    const moic=match(s,/(\d+(?:\.\d+)?)x\s+(?:LP\s+)?MOIC/i),irr=match(s,/(\d{1,3}(?:\.\d+)?)%\s+(?:LP\s+)?IRR/i),hold=match(s,/(\d+(?:\.\d+)?)\s*[- ]?year\s+hold/i);
    const presaleAmt=match(s,/(\$\s*[\d,.]+\s*(?:M|B))\s+(?:pre[- ]?sold|pre[- ]?sales?|presales?)/i)||match(s,/(\$\s*[\d,.]+\s*(?:M|B))[^.]{0,80}(?:LOI)[^.]{0,80}(?:villa|residential)/i);
    const soldCount=match(s,/(\d+)\s+of\s+(\d+)\s+villas?/i,1),soldTotal=match(s,/(\d+)\s+of\s+(\d+)\s+villas?/i,2);
    const presalePct=match(s,/(\d{1,3}(?:\.\d+)?)%\s+of\s+(?:the\s+)?residential\s+pipeline/i);
    const pipeline=match(s,/(\$\s*[\d,.]+\s*(?:M|B))\s+(?:gross\s+)?residential\s+pipeline/i);
    const keys=match(s,/(\d+)\s*[- ]?key\s+(?:hotel|resort)/i),villas=match(s,/(\d+)\s+(?:branded\s+)?villas?/i);
    const adr=match(s,/ADR\s*(?:of|at|:)??\s*\$\s*([\d,]+)/i)||match(s,/\$\s*([\d,]+)\s+ADR/i);
    const brand=match(s,/\b(St\.?\s*Regis|Marriott|Four Seasons|Mandarin Oriental|Aman|Rosewood|Ritz-Carlton|Hilton|Hyatt|Accor|IHG)\b/i);
    const brandTerm=match(s,/(\d+)\s*[- ]?year\s+term/i);
    const land=match(s,/(\$\s*[\d,.]+\s*(?:M|B))\s+land\s+acquisition/i);
    const sitePSA=/executed\s+PSA/i.test(s),escrow=/earnest\s+funds?\s+in\s+escrow/i.test(s),assignable=/assignable\s+to\s+(?:the\s+)?project\s+SPV/i.test(s);
    const lpSplit=match(s,/(\d{1,3}(?:\.\d+)?)%\s+LP\s*\/\s*(\d{1,3}(?:\.\d+)?)%\s+GP/i,1),gpSplit=match(s,/(\d{1,3}(?:\.\d+)?)%\s+LP\s*\/\s*(\d{1,3}(?:\.\d+)?)%\s+GP/i,2);
    const lpCash=match(s,/(\d{1,3}(?:\.\d+)?)%\s+share\s+of\s+cash\s+equity/i);
    const palawan=/\bPalawan\b/i.test(s)?'Palawan':'';
    const presaleWindow=match(s,/([^.]*(?:pre[- ]?sold|pre[- ]?sale|presale)[^.]{0,180})/i);
    let presaleStatus='';
    if(/\bLOI\b/i.test(presaleWindow)||(/\bLOI\b/i.test(s)&&presaleAmt))presaleStatus='LOI';
    else if(/executed|signed|contracted|purchase agreement|SPA|binding/i.test(presaleWindow))presaleStatus='Contracted';
    if(/deposit|collections?|paid|escrow/i.test(presaleWindow)&&presaleStatus!=='LOI')presaleStatus='Funded / Collected';
    return{moic,irr,hold,presaleAmt,soldCount,soldTotal,presalePct,pipeline,keys,villas,adr,brand,brandTerm,land,sitePSA,escrow,assignable,lpSplit,gpSplit,lpCash,palawan,presaleStatus};
  }
  function presaleInsight(x){
    if(!x.presaleAmt)return'';
    const scope=x.soldCount&&x.soldTotal?` across ${x.soldCount} of ${x.soldTotal} villas`:'';
    if(x.presaleStatus==='LOI')return `${x.presaleAmt.replace(/\s+/g,'')} pre-sale LOI${scope} provides early demand validation and reduces residual sell-through exposure if converted into binding sales.`;
    if(x.presaleStatus==='Funded / Collected')return `${x.presaleAmt.replace(/\s+/g,'')} of pre-sales${scope} provides demand validation and can directly reduce the remaining external capital requirement as deposits and collections are received.`;
    return `${x.presaleAmt.replace(/\s+/g,'')} of contracted pre-sales${scope} provides demand validation and reduces residual inventory exposure; the capital benefit depends on the deposit and collection schedule.`;
  }
  function draft(d){
    const f=flags(d),x=facts(d),ask=money(d?.deal_size),name=cleanName(d?.company||d?.title)||'The opportunity',place=x.palawan||d?.geography||'';
    let investment_thesis='',transaction_rationale='',market_position='';
    if(f.re&&f.development){
      const program=[];if(x.keys)program.push(`${x.keys}-key ${x.brand?x.brand+' ':''}hotel`);if(x.villas)program.push(`${x.villas} branded villas`);
      investment_thesis=`${name} is a luxury real-estate development${place?' in '+place:''}${program.length?' combining '+program.join(' with '):''}.`;
      const drivers=[];if(x.presaleAmt)drivers.push(`${x.presaleAmt.replace(/\s+/g,'')} of referenced pre-sales`);if(x.brand)drivers.push(`${x.brand} brand engagement`);if(x.sitePSA)drivers.push('executed site-control documentation');if(x.moic&&x.irr)drivers.push(`target LP returns of ${x.moic}x MOIC and ${x.irr}% IRR`);
      if(drivers.length)investment_thesis+=` The investment case is supported by ${drivers.join(', ')}.`;
      transaction_rationale=`The capital plan is centered on completing the development and converting the residential and hospitality program into monetizable assets.`;
      const p=presaleInsight(x);if(p)transaction_rationale+=` ${p}`;
      market_position=`The project targets the premium end of the hospitality and branded-residential market${place?' in '+place:''}.`;
      if(x.pipeline)market_position+=` The residential component represents approximately ${x.pipeline.replace(/\s+/g,'')} of gross pipeline.`;
      if(x.adr)market_position+=` Hotel underwriting references an ADR of approximately $${x.adr}.`;
    }else{
      investment_thesis=`${name}${d?.sector?' operates in '+d.sector:''}${d?.geography?' across '+d.geography:''}.`+(ask?` The transaction is seeking ${ask} of capital.`:'');
      transaction_rationale=`The transaction is structured as ${d?.transaction_type||'a private-market investment'}${ask?' with '+ask+' of capital required':''}.`;
      market_position=d?.sector||d?.geography?`The opportunity is positioned within ${d?.sector||'its sector'}${d?.geography?' in '+d.geography:''}.`:'';
    }
    const risk=[];if(f.development)risk.push('Construction completion, schedule and cost control');if(x.presaleAmt)risk.push(x.presaleStatus==='LOI'?'Conversion of pre-sale LOIs into binding sales':'Pre-sale collections and buyer completion');if(f.hospitality)risk.push('Hotel ramp-up and operator execution');if(f.re)risk.push('Asset valuation and exit liquidity');if(f.debt)risk.push('Leverage and refinancing');if(f.acq&&!f.development)risk.push('Transaction execution and diligence');
    const mitig=[];const p=presaleInsight(x);if(p)mitig.push(p);if(x.sitePSA)mitig.push(`Site control is supported by an executed PSA${x.escrow?' with earnest funds in escrow':''}${x.assignable?' and assignability to the project SPV':''}.`);if(x.brand)mitig.push(`${x.brand} brand engagement${x.brandTerm?' references a '+x.brandTerm+'-year term':''}${x.adr?' and supports an approximately $'+x.adr+' ADR underwriting case':''}.`);if(x.lpSplit&&x.gpSplit)mitig.push(`The residual economics reference an ${x.lpSplit}% LP / ${x.gpSplit}% GP split${x.lpCash?' with the LP contributing approximately '+x.lpCash+'% of cash equity':''}.`);
    return{investment_thesis,transaction_rationale,market_position,risks:risk.slice(0,4).join('; ')+(risk.length?'.':''),mitigants:mitig.slice(0,4).join(' ')};
  }
  async function run(){if(busy)return;const id=$('capitalDealSelect')?.value;if(!id)return;busy=true;try{const {data:{session}}=await sb.auth.getSession();if(!session)return;const [dr,wr]=await Promise.all([sb.from('deals').select('*').eq('id',id).maybeSingle(),sb.from('deal_workspaces').select('*').eq('deal_id',id).maybeSingle()]);if(dr.error||wr.error||!dr.data)return;const intake={...(wr.data?.intake||{})},gm=(intake.__generated&&typeof intake.__generated==='object')?{...intake.__generated}:{},gen=draft(dr.data);let changed=false;keys.forEach(k=>{if(!filled(intake[k])||gm[k]){const next=gen[k]||'';if(intake[k]!==next||!gm[k])changed=true;intake[k]=next;gm[k]=true}});intake.__generated=gm;if(!changed&&wr.data)return;await sb.from('deal_workspaces').upsert({deal_id:id,owner_id:session.user.id,intake,generated_assets:wr.data?.generated_assets||{},updated_at:new Date().toISOString()},{onConflict:'deal_id'});setTimeout(()=>window.OuterHavenCapitalSuiteV17?.refresh?.(),80)}finally{busy=false}}
  document.addEventListener('click',e=>{if(e.target.closest('.navBtn[data-section="capital"],#capitalRefresh'))setTimeout(run,350)},true);
  document.addEventListener('change',e=>{if(e.target?.id==='capitalDealSelect')setTimeout(run,220)},true);
  [500,1200,2200].forEach(ms=>setTimeout(run,ms));
})();