(function(){
  if(window.__outerhavenDashboardStaticMetrics)return;
  window.__outerhavenDashboardStaticMetrics=true;

  let applying=false,revenue={total:0,direct:0,sourced:0,buy:0,loaded:false},refreshing=false,revenueChannel=null;
  const style=document.createElement('style');
  style.textContent=`
    @media(min-width:1001px){#metrics.metrics{grid-template-columns:repeat(5,minmax(0,1fr))}}
    .revenueMetric .metricValue{font-size:27px}.revenueBreakdown{display:grid;gap:3px;margin-top:8px;font-size:9px;color:#70757d}.revenueBreakdownRow{display:flex;justify-content:space-between;gap:8px}.revenueBreakdownRow strong{color:#343b46;font-weight:800}.revenueMetric{cursor:default}
  `;
  document.head.appendChild(style);

  const n=v=>v==null||v===''?null:Number(v);
  function parseMoney(v){
    if(v==null||v==='')return 0;
    if(typeof v==='number')return Number.isFinite(v)?v:0;
    const s=String(v).replace(/,/g,'').trim().toLowerCase();
    const m=s.match(/\$?\s*([0-9]+(?:\.[0-9]+)?)\s*(billion|million|thousand|bn|mm|m|b|k)?/i);
    if(!m)return 0;
    let x=Number(m[1]);const u=(m[2]||'').toLowerCase();
    if(['b','bn','billion'].includes(u))x*=1e9;else if(['m','mm','million'].includes(u))x*=1e6;else if(['k','thousand'].includes(u))x*=1e3;
    return Number.isFinite(x)?x:0;
  }
  function money(v){
    const x=Number(v)||0,a=Math.abs(x);
    if(a>=1e9)return '$'+(x/1e9).toFixed(a>=1e10?1:2).replace(/\.00$/,'').replace(/(\.\d)0$/,'$1')+'B';
    if(a>=1e6)return '$'+(x/1e6).toFixed(a>=1e7?1:2).replace(/\.00$/,'').replace(/(\.\d)0$/,'$1')+'M';
    if(a>=1e3)return '$'+(x/1e3).toFixed(a>=1e5?0:1).replace(/\.0$/,'')+'K';
    return '$'+Math.round(x).toLocaleString();
  }
  function pathFor(o,p){
    if(o.revenue_path)return o.revenue_path;
    if(o.side==='Buy Side')return'buy_side_interest';
    return p?.sell_side_kind==='direct_sponsor'?'direct_sponsor':'sourced_opportunity';
  }
  function termsFor(o,p){
    const path=pathFor(o,p),direct=path==='direct_sponsor';
    const raise=n(o.revenue_raise_amount)??parseMoney(o.opportunity_size);
    const monthly=n(o.revenue_retainer_monthly)??(direct?15000:0);
    const months=n(o.revenue_retainer_months)??(direct?3:0);
    const fixedRetainer=n(o.revenue_retainer_fixed);
    const pct=n(o.revenue_success_fee_percent)??(direct?5:0);
    const fixedSuccess=n(o.revenue_success_fee_fixed);
    const retainer=fixedRetainer!=null?fixedRetainer:monthly*months;
    const success=fixedSuccess!=null?fixedSuccess:raise*pct/100;
    return{path,raise,monthly,months,fixedRetainer,pct,fixedSuccess,retainer,success,total:retainer+success};
  }
  function calculate(rawOpps,rawPeople){
    const people=new Map((rawPeople||[]).map(p=>[p.id,p]));
    const opps=rawOpps||[],sell=opps.filter(o=>o.side==='Sell Side'),buy=opps.filter(o=>o.side==='Buy Side');
    const sellTerms=new Map(sell.map(o=>[o.id,termsFor(o,people.get(o.person_id))]));
    const linked=new Map();
    buy.forEach(o=>{if(o.revenue_linked_sell_side_opportunity_id){const id=o.revenue_linked_sell_side_opportunity_id;if(!linked.has(id))linked.set(id,[]);linked.get(id).push(o)}});
    let direct=0,sourced=0,buyRevenue=0;
    sell.forEach(o=>{
      const t=sellTerms.get(o.id),buyers=linked.get(o.id)||[];
      if(buyers.length){
        let interested=buyers.reduce((sum,b)=>sum+(n(b.revenue_raise_amount)??parseMoney(b.opportunity_size)),0);
        if(interested<=0)interested=t.raise;
        if(t.raise>0)interested=Math.min(interested,t.raise);
        const success=t.fixedSuccess!=null?t.fixedSuccess:interested*t.pct/100;
        buyRevenue+=t.retainer+success;
      }else if(t.path==='direct_sponsor')direct+=t.total;
      else sourced+=t.total;
    });
    buy.filter(o=>!o.revenue_linked_sell_side_opportunity_id).forEach(o=>{buyRevenue+=termsFor(o,people.get(o.person_id)).total});
    return{direct,sourced,buy:buyRevenue,total:direct+sourced+buyRevenue,loaded:true};
  }

  async function refreshRevenue(){
    if(typeof sb==='undefined'||refreshing)return;
    refreshing=true;
    try{
      const [o,p]=await Promise.all([
        sb.from('opportunities').select('id,person_id,side,opportunity_size,revenue_path,revenue_raise_amount,revenue_retainer_monthly,revenue_retainer_months,revenue_retainer_fixed,revenue_success_fee_percent,revenue_success_fee_fixed,revenue_linked_sell_side_opportunity_id'),
        sb.from('people').select('id,sell_side_kind')
      ]);
      if(!o.error&&!p.error)revenue=calculate(o.data||[],p.data||[]);
    }finally{refreshing=false;render()}
  }

  function html(){
    if(typeof state==='undefined'||!state)return'';
    const opportunities=Array.isArray(state.opportunities)?state.opportunities:[];
    const people=Array.isArray(state.people)?state.people:[];
    const rows=[
      ['Active Opportunities',opportunities.length,'Across all opportunities'],
      ['Sell Side',opportunities.filter(o=>o.side==='Sell Side').length,'Sell-side opportunities'],
      ['Buy Side',opportunities.filter(o=>o.side==='Buy Side').length,'Buy-side opportunities'],
      ['LinkedIn Access',people.filter(p=>p.hasLinkedIn).length+'/'+people.length,'People with account access']
    ];
    const base=rows.map(x=>`<article class="metric"><div class="metricLabel">${x[0]}</div><div class="metricValue">${x[1]}</div><div class="metricFoot">${x[2]}</div></article>`).join('');
    const rev=`<article class="metric revenueMetric" title="Projected gross OuterHaven revenue based on recorded opportunity economics"><div class="metricLabel">Projected Revenue</div><div class="metricValue">${revenue.loaded?money(revenue.total):'—'}</div><div class="revenueBreakdown"><div class="revenueBreakdownRow"><span>Direct Sponsors</span><strong>${revenue.loaded?money(revenue.direct):'—'}</strong></div><div class="revenueBreakdownRow"><span>Sourced Deals</span><strong>${revenue.loaded?money(revenue.sourced):'—'}</strong></div><div class="revenueBreakdownRow"><span>Buy-Side Interest</span><strong>${revenue.loaded?money(revenue.buy):'—'}</strong></div></div></article>`;
    return base+rev;
  }
  function render(){
    const el=document.getElementById('metrics');if(!el)return;
    const next=html();if(!next||el.innerHTML===next)return;
    applying=true;el.innerHTML=next;applying=false;
  }
  function ensureRealtime(){
    if(revenueChannel||typeof sb==='undefined')return;
    revenueChannel=sb.channel('outerhaven-revenue-overview-v1')
      .on('postgres_changes',{event:'*',schema:'public',table:'opportunities'},refreshRevenue)
      .on('postgres_changes',{event:'*',schema:'public',table:'people'},refreshRevenue)
      .subscribe();
  }

  if(typeof window.renderMetrics==='function')window.renderMetrics=render;
  else if(typeof renderMetrics==='function')renderMetrics=render;
  window.__outerhavenRefreshDashboardMetrics=refreshRevenue;

  function install(){
    const el=document.getElementById('metrics');
    if(el)new MutationObserver(()=>{if(!applying)queueMicrotask(render)}).observe(el,{childList:true,subtree:true,characterData:true});
    document.getElementById('roleFilter')?.addEventListener('change',()=>setTimeout(render,0));
    render();refreshRevenue();ensureRealtime();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
