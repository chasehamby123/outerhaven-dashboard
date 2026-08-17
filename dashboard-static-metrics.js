(function(){
  if(window.__outerhavenDashboardStaticMetrics)return;
  window.__outerhavenDashboardStaticMetrics=true;

  function render(){
    const el=document.getElementById('metrics');
    if(!el||typeof state==='undefined'||!state)return;
    const opportunities=Array.isArray(state.opportunities)?state.opportunities:[];
    const people=Array.isArray(state.people)?state.people:[];
    const rows=[
      ['Active Opportunities',opportunities.length,'Across all opportunities'],
      ['Sell Side',opportunities.filter(o=>o.side==='Sell Side').length,'Sell-side opportunities'],
      ['Buy Side',opportunities.filter(o=>o.side==='Buy Side').length,'Buy-side opportunities'],
      ['LinkedIn Access',people.filter(p=>p.hasLinkedIn).length+'/'+people.length,'People with account access']
    ];
    el.innerHTML=rows.map(x=>`<article class="metric"><div class="metricLabel">${x[0]}</div><div class="metricValue">${x[1]}</div><div class="metricFoot">${x[2]}</div></article>`).join('');
  }

  if(typeof window.renderMetrics==='function')window.renderMetrics=render;
  else if(typeof renderMetrics==='function')renderMetrics=render;

  const observer=new MutationObserver(()=>queueMicrotask(render));
  function install(){
    const el=document.getElementById('metrics');
    if(el)observer.observe(el,{childList:true,subtree:true,characterData:true});
    document.getElementById('roleFilter')?.addEventListener('change',()=>setTimeout(render,0));
    render();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
