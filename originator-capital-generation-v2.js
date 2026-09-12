(function(){
  if(window.__outerhavenCapitalGenerationV2)return;
  window.__outerhavenCapitalGenerationV2=true;
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
  function clean(v){
    let s=String(v||'').replace(/\u00a0/g,' ').replace(/\s+/g,' ').trim();
    s=s.replace(/^\s*(?:the\s+)?investment\s+case\s*[:\-–—]?\s*/i,'');
    s=s.split(/\s+(?:0?[2-9]|1[0-9])\s+(?=(?:THE\s+)?[A-Z][A-Z0-9&/'’\-]{2,})/)[0];
    s=s.split(/\s+(?:WHY INVEST|MARKET OPPORTUNITY|FINANCIAL OVERVIEW|TRANSACTION OVERVIEW|FOUR INSTITUTIONAL PILLARS)\b/i)[0];
    return s.trim();
  }
  function clip(text,max=380){const s=clean(text);if(s.length<=max)return s;const c=s.slice(0,max),p=Math.max(c.lastIndexOf('. '),c.lastIndexOf('; '));return(p>180?c.slice(0,p+1):c.slice(0,c.lastIndexOf(' ')))+'…'}
  function source(d){
    const s=String(d?.summary||''),out={};
    const map=[['use_of_proceeds',/use of proceeds|proceeds will|funds will|capital will|raise is for/i],['operator_brand',/operator|management agreement|brand engagement|marriott|hilton|hyatt|accor|ihg|four seasons|st regis/i],['presales',/pre sold|pre-sold|pre sale|pre-sale|presale|reservations|contracted sales/i],['site_control',/site control|title|freehold|leasehold|land owned|property owned|land acquisition/i]];
    map.forEach(([k,re])=>{const v=sentence(s,re);if(v)out[k]=clean(v)});return out;
  }
  function draft(d){
    const f=flags(d),src=source(d),ask=money(d?.deal_size),summary=clip(d?.summary,430);
    const title=d?.title||d?.company||'The opportunity';
    const descriptors=[];if(d?.sector)descriptors.push(d.sector);if(d?.geography)descriptors.push(d.geography);

    let investment_thesis=`${title} presents a ${d?.transaction_type||'private-market'} opportunity`;
    if(descriptors.length)investment_thesis+=` in ${descriptors.join(' / ')}`;
    if(ask)investment_thesis+=` seeking ${ask} of capital`;
    investment_thesis+='.';
    if(summary)investment_thesis+=' '+summary;

    let transaction_rationale=`The transaction is structured as ${d?.transaction_type||'a private-market investment'}`;
    if(ask)transaction_rationale+=` with a capital requirement of ${ask}`;
    transaction_rationale+='.';
    if(src.use_of_proceeds)transaction_rationale+=' '+clip(src.use_of_proceeds,300);

    let market_position='';
    if(f.hospitality&&f.development)market_position=`The opportunity combines hospitality and real-estate development exposure${d?.geography?' in '+d.geography:''}, with investor returns tied to development execution, operating performance and asset value creation.`;
    else if(d?.sector||d?.geography)market_position=`The opportunity provides exposure to ${d?.sector||'the sector'}${d?.geography?' in '+d.geography:''}.`;
    if(src.operator_brand)market_position+=(market_position?' ':'')+clip(src.operator_brand,230);
    if(src.presales)market_position+=(market_position?' ':'')+clip(src.presales,230);

    const risk=[];
    if(f.development)risk.push('development execution, construction timing and cost control');
    if(f.presale)risk.push('pre-sale conversion and collection');
    if(f.hospitality)risk.push('operating ramp and brand/operator execution');
    if(f.debt)risk.push('leverage, covenant compliance and refinancing');
    if(f.acq)risk.push('transaction execution and diligence');
    if(f.re)risk.push('asset valuation, site control and exit liquidity');
    risk.push('forecast execution and capital structure');
    const risks=`Key underwriting considerations include ${[...new Set(risk)].join('; ')}.`;

    const mit=[];
    if(src.presales)mit.push('pre-sales or contracted demand');
    if(src.operator_brand)mit.push('brand/operator engagement');
    if(Number(d?.revenue)>0)mit.push(`${money(d.revenue)} of revenue`);
    if(Number(d?.ebitda)>0)mit.push(`${money(d.ebitda)} of EBITDA`);
    if(src.site_control)mit.push('documented site-control information');
    const mitigants=mit.length?`Key mitigating factors include ${mit.join('; ')}.`:'';
    return{investment_thesis,transaction_rationale,market_position,risks,mitigants};
  }

  async function run(){
    if(busy)return;const id=$('capitalDealSelect')?.value;if(!id)return;busy=true;
    try{
      const {data:{session}}=await sb.auth.getSession();if(!session)return;
      const [dr,wr]=await Promise.all([sb.from('deals').select('*').eq('id',id).maybeSingle(),sb.from('deal_workspaces').select('*').eq('deal_id',id).maybeSingle()]);
      if(dr.error||wr.error||!dr.data)return;
      const intake={...(wr.data?.intake||{})},gm=(intake.__generated&&typeof intake.__generated==='object')?{...intake.__generated}:{},gen=draft(dr.data);let changed=false;
      keys.forEach(k=>{
        if(!filled(intake[k])||gm[k]){
          const next=gen[k]||'';
          if(intake[k]!==next||!gm[k])changed=true;
          intake[k]=next;gm[k]=true;
        }
      });
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