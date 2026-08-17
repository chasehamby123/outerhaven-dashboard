(function(){
  if(window.__outerhavenDashboardStaticMetrics)return;
  window.__outerhavenDashboardStaticMetrics=true;

  let applying=false;
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
    return rows.map(x=>`<article class="metric"><div class="metricLabel">${x[0]}</div><div class="metricValue">${x[1]}</div><div class="metricFoot">${x[2]}</div></article>`).join('');
  }
  function render(){
    const el=document.getElementById('metrics');if(!el)return;
    const next=html();if(!next||el.innerHTML===next)return;
    applying=true;el.innerHTML=next;applying=false;
  }

  if(typeof window.renderMetrics==='function')window.renderMetrics=render;
  else if(typeof renderMetrics==='function')renderMetrics=render;

  function install(){
    const el=document.getElementById('metrics');
    if(el)new MutationObserver(()=>{if(!applying)queueMicrotask(render)}).observe(el,{childList:true,subtree:true,characterData:true});
    document.getElementById('roleFilter')?.addEventListener('change',()=>setTimeout(render,0));
    render();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
