(function(){
  if(window.__outerhavenCapitalGenerationV4)return;
  window.__outerhavenCapitalGenerationV4=true;
  const sb=window.__OUTERHAVEN_ORIGINATOR_SB;
  if(!sb)return;
  const $=id=>document.getElementById(id);
  const norm=v=>String(v||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  const filled=v=>String(v||'').trim().length>=8;
  const money=v=>{const n=Number(v||0);if(!n)return'';if(n>=1e9)return'$'+(n/1e9).toFixed(n%1e9?1:0)+'B';if(n>=1e6)return'$'+(n/1e6).toFixed(n%1e6?1:0)+'M';if(n>=1e3)return'$'+(n/1e3).toFixed(n%1e3?1:0)+'K';return'$'+n.toLocaleString()};
  const keys=['investment_thesis','transaction_rationale','market_position','risks','mitigants'];
  let busy=false;

  function cleanName(v){
    const original=String(v||'').replace(/\s+/g,' ').trim();if(!original)return'';
    let s=original.replace(/\.(?:pdf|pptx?|docx?)$/i,'').trim();
    s=s.replace(/\s*(?:[-–—|:]\s*)?(?:investor\s+pitch\s+deck|pitch\s+deck|investor\s+presentation|investment\s+presentation|investor\s+deck|investment\s+deck|confidential\s+information\s+memorandum|information\s+memorandum|investment\s+memorandum|investor\s+teaser|investment\s+teaser|teaser|cim)\s*$/i,'').trim();
    return s||original;
  }
  function flags(d){
    const t=norm(d?.transaction_type),all=norm(`${d?.sector||''} ${d?.title||''} ${d?.company||''} ${d?.summary||''}`);
    return{debt:/debt|loan|credit|refinanc|unitranche|mezz/.test(t),acq:/acquisition|buyout|purchase|m a/.test(t),sale:/sale|sell side|divest|exit/.test(t),equity:/equity|growth capital|minority|majority/.test(t),jv:/joint venture|\bjv\b/.test(t),re:/real estate|hospitality|hotel|resort|property|multifamily|self storage|commercial property/.test(all),hospitality:/hospitality|hotel|resort|branded residence|villa/.test(all),development:/development|construction|ground up|ground-up|pre sale|pre-sale|presale/.test(all),presale:/pre sale|pre-sale|presale|pre sold|pre-sold|contracted sales|reservation/.test(all)};
  }
  function clean(v){
    let s=String(v||'').replace(/\u00a0/g,' ').replace(/\s+/g,' ').trim();
    s=s.replace(/^\s*(?:the\s+)?investment\s+case\s*[:\-–—]?\s*/i,'');
    s=s.split(/\s+(?:0?[2-9]|1[0-9])\s+(?=(?:THE\s+)?[A-Z][A-Z0-9&/'’\-]{2,})/)[0];
    return s.trim();
  }
  function clip(text,max=420){const s=clean(text);if(s.length<=max)return s;const c=s.slice(0,max),p=Math.max(c.lastIndexOf('. '),c.lastIndexOf('; '));return(p>180?c.slice(0,p+1):c.slice(0,c.lastIndexOf(' ')))+'…'}
  function match(text,re,group=1){const m=String(text||'').match(re);return m?String(m[group]||'').trim():''}
  function sourceFacts(d){
    const s=clean(d?.summary||'');
    const moic=match(s,/(\d+(?:\.\d+)?)x\s+(?:LP\s+)?MOIC/i);
    const irr=match(s,/(\d{1,3}(?:\.\d+)?)%\s+(?:LP\s+)?IRR/i);
    const hold=match(s,/(\d+(?:\.\d+)?)\s*[- ]?year\s+hold/i);
    const presale=match(s,/(\$\s*[\d,.]+\s*(?:M|B))\s+(?:pre[- ]?sold|pre[- ]?sales?)/i);
    const keys=match(s,/(\d+)\s*[- ]?key\s+(?:hotel|resort)/i);
    const villas=match(s,/(\d+)\s+(?:branded\s+)?villas?/i);
    const soldCount=match(s,/(\d+)\s+of\s+(\d+)\s+villas?/i,1);
    const soldTotal=match(s,/(\d+)\s+of\s+(\d+)\s+villas?/i,2);
    const adr=match(s,/ADR\s*(?:of|at|:)??\s*\$\s*([\d,]+)/i)||match(s,/\$\s*([\d,]+)\s+ADR/i);
    const brand=match(s,/\b(St\.?\s*Regis|Marriott|Four Seasons|Mandarin Oriental|Aman|Rosewood|Ritz-Carlton|Hilton|Hyatt|Accor|IHG)\b/i);
    const palawan=/\bPalawan\b/i.test(s)?'Palawan':'';
    const aligned=/contribution[- ]aligned equity split|GP-confirmed[^.]{0,120}equity split|sponsor[^.]{0,80}equity contribution/i.test(s);
    return{moic,irr,hold,presale,keys,villas,soldCount,soldTotal,adr,brand,palawan,aligned};
  }
  function draft(d){
    const f=flags(d),x=sourceFacts(d),ask=money(d?.deal_size),name=cleanName(d?.company||d?.title)||'The opportunity';
    const place=x.palawan||d?.geography||'';
    let investment_thesis='';
    if(f.hospitality&&f.development){
      const asset=[];if(x.keys)asset.push(`${x.keys}-key ${x.brand?x.brand+' ':''}hotel`);if(x.villas)asset.push(`${x.villas} branded villas`);
      investment_thesis=`${name} is a luxury hospitality and branded-residential development${place?' in '+place:''}${asset.length?' combining '+asset.join(' with '):''}.`;
      const economics=[];if(ask)economics.push(`${ask} capital raise`);if(x.presale)economics.push(`${x.presale.replace(/\s+/g,'')} of referenced pre-sales`);if(x.moic)economics.push(`${x.moic}x target LP MOIC`);if(x.irr)economics.push(`${x.irr}% target LP IRR`);if(x.hold)economics.push(`${x.hold}-year hold`);
      if(economics.length)investment_thesis+=` The investment case is underpinned by ${economics.join(', ')}.`;
    }else{
      investment_thesis=`${name}${d?.sector?' operates in '+d.sector:''}${d?.geography?' across '+d.geography:''}.`;
      if(ask)investment_thesis+=` The transaction is seeking ${ask} of capital`+(d?.transaction_type?` through a ${d.transaction_type} structure.`:'.');
      const raw=clip(d?.summary,300);if(raw&&!investment_thesis.includes(raw))investment_thesis+=' '+raw;
    }

    let transaction_rationale='';
    if(f.hospitality&&f.development){
      transaction_rationale=`The capital raise is intended to advance the hotel and residential development through construction and commercialization.`;
      if(x.presale)transaction_rationale+=` Referenced pre-sales of ${x.presale.replace(/\s+/g,'')} provide early demand visibility for the residential component.`;
    }else if(f.acq||f.sale){
      transaction_rationale=`The transaction is structured as ${d?.transaction_type||'an acquisition / sale process'}${ask?' with '+ask+' of capital required':''}.`;
    }else if(f.debt){
      transaction_rationale=`The financing is structured as ${d?.transaction_type||'a debt transaction'}${ask?' with '+ask+' of capital required':''}.`;
    }else{
      transaction_rationale=`The transaction is structured as ${d?.transaction_type||'a private-market investment'}${ask?' with '+ask+' of capital required':''}.`;
    }

    let market_position='';
    if(f.hospitality&&f.development){
      market_position=`The opportunity combines luxury hospitality with branded residential sales${place?' in '+place:''}.`;
      if(x.brand)market_position+=` ${x.brand} branding supports premium positioning for the hotel component.`;
      if(x.adr)market_position+=` The underwriting references an ADR of approximately $${x.adr}.`;
    }else if(d?.sector||d?.geography){
      market_position=`The opportunity is positioned within ${d?.sector||'its sector'}${d?.geography?' in '+d.geography:''}.`;
    }

    const risks=[];
    if(f.development)risks.push('Construction execution and cost control');
    if(f.presale)risks.push('Residential pre-sale conversion and collections');
    if(f.hospitality)risks.push('Hotel opening, ramp-up and operator execution');
    if(f.debt)risks.push('Leverage, covenant compliance and refinancing');
    if(f.acq)risks.push('Transaction execution and diligence');
    if(f.re)risks.push('Asset valuation and exit liquidity');
    if(!risks.length)risks.push('Forecast execution and capital structure');
    const riskText=risks.slice(0,4).join('; ')+'.';

    const mitigants=[];
    if(x.presale)mitigants.push(`${x.presale.replace(/\s+/g,'')} of referenced pre-sales`+(x.soldCount&&x.soldTotal?` across ${x.soldCount} of ${x.soldTotal} villas`:''));
    if(x.brand)mitigants.push(`${x.brand} brand engagement`);
    if(x.aligned)mitigants.push('GP-confirmed contribution-aligned equity structure');
    if(Number(d?.revenue)>0&&!f.development)mitigants.push(`${money(d.revenue)} of revenue`);
    const mitigantText=mitigants.length?mitigants.slice(0,4).join('; ')+'.':'';
    return{investment_thesis,transaction_rationale,market_position,risks:riskText,mitigants:mitigantText};
  }

  async function run(){
    if(busy)return;const id=$('capitalDealSelect')?.value;if(!id)return;busy=true;
    try{
      const {data:{session}}=await sb.auth.getSession();if(!session)return;
      const [dr,wr]=await Promise.all([sb.from('deals').select('*').eq('id',id).maybeSingle(),sb.from('deal_workspaces').select('*').eq('deal_id',id).maybeSingle()]);
      if(dr.error||wr.error||!dr.data)return;
      const intake={...(wr.data?.intake||{})},gm=(intake.__generated&&typeof intake.__generated==='object')?{...intake.__generated}:{},gen=draft(dr.data);let changed=false;
      keys.forEach(k=>{if(!filled(intake[k])||gm[k]){const next=gen[k]||'';if(intake[k]!==next||!gm[k])changed=true;intake[k]=next;gm[k]=true}});
      intake.__generated=gm;
      if(!changed&&wr.data)return;
      await sb.from('deal_workspaces').upsert({deal_id:id,owner_id:session.user.id,intake,generated_assets:wr.data?.generated_assets||{},updated_at:new Date().toISOString()},{onConflict:'deal_id'});
      setTimeout(()=>window.OuterHavenCapitalSuiteV17?.refresh?.(),80);
    }finally{busy=false}
  }
  document.addEventListener('click',e=>{if(e.target.closest('.navBtn[data-section="capital"],#capitalRefresh'))setTimeout(run,350)},true);
  document.addEventListener('change',e=>{if(e.target?.id==='capitalDealSelect')setTimeout(run,220)},true);
  [500,1200,2200].forEach(ms=>setTimeout(run,ms));
})();