(function(){
  if(window.__outerhavenCapitalGenerationV1)return;
  window.__outerhavenCapitalGenerationV1=true;
  const sb=window.__OUTERHAVEN_ORIGINATOR_SB;
  if(!sb)return;
  const $=id=>document.getElementById(id);
  const norm=v=>String(v||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  const filled=v=>String(v||'').trim().length>=8;
  const money=v=>{const n=Number(v||0);if(!n)return'';if(n>=1e9)return'$'+(n/1e9).toFixed(n%1e9?1:0)+'B';if(n>=1e6)return'$'+(n/1e6).toFixed(n%1e6?1:0)+'M';if(n>=1e3)return'$'+(n/1e3).toFixed(n%1e3?1:0)+'K';return'$'+n.toLocaleString()};
  const keys=['investment_thesis','transaction_rationale','market_position','risks','mitigants'];
  let busy=false;

  function flags(d){
    const t=norm(d?.transaction_type),all=norm(`${d?.sector||''} ${d?.title||''} ${d?.company||''} ${d?.summary||''}`);
    return{debt:/debt|loan|credit|refinanc|unitranche|mezz/.test(t),acq:/acquisition|buyout|purchase|m a/.test(t),re:/real estate|hospitality|hotel|resort|property|multifamily|self storage|commercial property/.test(all),hospitality:/hospitality|hotel|resort|branded residence|villa/.test(all),development:/development|construction|ground up|ground-up|pre sale|pre-sale|presale/.test(all),presale:/pre sale|pre-sale|presale|pre sold|pre-sold|contracted sales|reservation/.test(all)};
  }
  function sentence(text,re){return String(text||'').replace(/\s+/g,' ').split(/(?<=[.!?;])\s+/).find(x=>re.test(x))||''}
  function clip(text,max=380){const s=String(text||'').replace(/\s+/g,' ').replace(/^the investment case\s*/i,'').trim();if(s.length<=max)return s;const c=s.slice(0,max),p=Math.max(c.lastIndexOf('. '),c.lastIndexOf('; '));return(p>180?c.slice(0,p+1):c.slice(0,c.lastIndexOf(' ')))+'…'}
  function source(d){
    const s=String(d?.summary||''),out={};
    const map=[['use_of_proceeds',/use of proceeds|proceeds will|funds will|capital will|raise is for/i],['operator_brand',/operator|management agreement|brand engagement|marriott|hilton|hyatt|accor|ihg|four seasons|st regis/i],['presales',/pre sold|pre-sold|pre sale|pre-sale|presale|reservations|contracted sales/i],['site_control',/site control|title|freehold|leasehold|land owned|property owned|land acquisition/i]];
    map.forEach(([k,re])=>{const v=sentence(s,re);if(v)out[k]=v});return out;
  }
  function draft(d){
    const f=flags(d),src=source(d),ask=money(d?.deal_size),summary=clip(d?.summary,420),parts=[];
    if(d?.sector)parts.push(d.sector);if(d?.geography)parts.push(d.geography);
    let investment_thesis=`${d?.title||d?.company||'The opportunity'} is being prepared as ${d?.transaction_type||'a private-market transaction'}`;if(parts.length)investment_thesis+=` in ${parts.join(' / ')}`;if(ask)investment_thesis+=` with a stated capital requirement of ${ask}`;investment_thesis+='.';if(summary)investment_thesis+=' '+summary;
    let transaction_rationale=`The transaction is currently structured as ${d?.transaction_type||'a private-market opportunity'}`;if(ask)transaction_rationale+=` with ${ask} of stated capital required`;transaction_rationale+='.';transaction_rationale+=src.use_of_proceeds?` Submitted materials indicate: ${clip(src.use_of_proceeds,260)}`:' The specific use of proceeds remains subject to source confirmation.';
    let market_position=`The investor positioning is anchored in the known transaction facts: ${d?.sector||'the stated sector'} exposure in ${d?.geography||'the stated geography'}.`;if(src.operator_brand)market_position+=` The submitted material references ${clip(src.operator_brand,220)}`;if(src.presales)market_position+=` It also references ${clip(src.presales,220)}`;market_position+=' No unsupported market-size or competitive claims are assumed.';
    const risk=[];if(f.development)risk.push('development execution, construction timing and cost control');if(f.presale)risk.push('pre-sale conversion and collection risk');if(f.hospitality)risk.push('brand/operator execution and operating ramp');if(f.debt)risk.push('leverage, covenant and refinancing risk');if(f.acq)risk.push('transaction execution and diligence risk');if(f.re)risk.push('asset valuation, site control and exit liquidity');risk.push('forecast accuracy and capital structure execution');
    const risks=`Key diligence areas identified from the transaction structure include ${[...new Set(risk)].join('; ')}. These are underwriting flags, not claims that a problem exists.`;
    const mit=[];if(src.presales)mit.push('pre-sales or contracted demand referenced in source');if(src.operator_brand)mit.push('brand/operator engagement referenced in source');if(Number(d?.revenue)>0)mit.push(`reported revenue of ${money(d.revenue)}`);if(Number(d?.ebitda)>0)mit.push(`reported EBITDA of ${money(d.ebitda)}`);if(src.site_control)mit.push('site-control information referenced in source');
    const mitigants=mit.length?`Documented factors that may mitigate underwriting risk include ${mit.join('; ')}. Each should be verified against supporting source documents before distribution.`:'No unsupported mitigants have been invented. Final materials should only present mitigants tied to submitted facts or supporting documents.';
    return{investment_thesis,transaction_rationale,market_position,risks,mitigants};
  }

  async function run(){
    if(busy)return;const id=$('capitalDealSelect')?.value;if(!id)return;busy=true;
    try{
      const {data:{session}}=await sb.auth.getSession();if(!session)return;
      const [dr,wr]=await Promise.all([sb.from('deals').select('*').eq('id',id).maybeSingle(),sb.from('deal_workspaces').select('*').eq('deal_id',id).maybeSingle()]);
      if(dr.error||wr.error||!dr.data)return;
      const intake={...(wr.data?.intake||{})},gm=(intake.__generated&&typeof intake.__generated==='object')?{...intake.__generated}:{},gen=draft(dr.data);let changed=false;
      keys.forEach(k=>{if(!filled(intake[k])||gm[k]){if(intake[k]!==gen[k]||!gm[k])changed=true;intake[k]=gen[k];gm[k]=true}});intake.__generated=gm;
      if(!changed&&wr.data)return;
      await sb.from('deal_workspaces').upsert({deal_id:id,owner_id:session.user.id,intake,generated_assets:wr.data?.generated_assets||{},updated_at:new Date().toISOString()},{onConflict:'deal_id'});
      setTimeout(()=>window.OuterHavenCapitalSuiteV17?.refresh?.(),80);
    }finally{busy=false}
  }

  document.addEventListener('click',e=>{if(e.target.closest('.navBtn[data-section="capital"],#capitalRefresh'))setTimeout(run,350)},true);
  document.addEventListener('change',e=>{if(e.target?.id==='capitalDealSelect')setTimeout(run,220)},true);
  [500,1200,2200].forEach(ms=>setTimeout(run,ms));
})();