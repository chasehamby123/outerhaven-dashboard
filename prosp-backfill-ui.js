(function(){
  if(window.__outerhavenProspBackfillUI)return;
  window.__outerhavenProspBackfillUI=true;

  const style=document.createElement('style');
  style.textContent=`
    .prospBackfillBox{background:#fff;border:1px solid #e4e7eb;border-radius:14px;padding:16px;margin-bottom:16px}
    .prospBackfillTitle{font-size:13px;font-weight:850}
    .prospBackfillCopy{font-size:10px;color:#747c89;line-height:1.55;margin-top:5px;max-width:760px}
    .prospLiveBadge{display:inline-flex;align-items:center;margin-top:10px;padding:6px 9px;border-radius:999px;background:#eefaf2;color:#237a45;font-size:9px;font-weight:850}
  `;
  document.head.appendChild(style);

  function inject(){
    const view=document.getElementById('leadreviewView');
    if(!view||view.querySelector('[data-prosp-backfill-box]'))return;
    const box=document.createElement('div');
    box.className='prospBackfillBox';
    box.dataset.prospBackfillBox='';
    box.innerHTML=`
      <div class="prospBackfillTitle">Prosp Reply Intake</div>
      <div class="prospBackfillCopy">New LinkedIn replies are automatically sent into OuterHaven for qualification. Prosp's public campaign-lead API does not expose the historical Replied status, so OuterHaven will not scan every campaign lead or open non-replier conversations. Historical replies can be imported separately from a Replied-only export or list.</div>
      <div class="prospLiveBadge">Live reply webhook active</div>`;
    const metrics=view.querySelector('.leadReviewMetrics');
    if(metrics)metrics.insertAdjacentElement('afterend',box);else view.prepend(box);
  }

  let metricsApplying=false;
  function staticMetricsHtml(){
    if(typeof state==='undefined'||!state)return'';
    const d=Array.isArray(state.opportunities)?state.opportunities:[];
    const p=Array.isArray(state.people)?state.people:[];
    const rows=[
      ['Active Opportunities',d.length,'Across all opportunities'],
      ['Sell Side',d.filter(o=>o.side==='Sell Side').length,'Sell-side opportunities'],
      ['Buy Side',d.filter(o=>o.side==='Buy Side').length,'Buy-side opportunities'],
      ['LinkedIn Access',p.filter(x=>x.hasLinkedIn).length+'/'+p.length,'People with account access']
    ];
    return rows.map(x=>`<article class="metric"><div class="metricLabel">${x[0]}</div><div class="metricValue">${x[1]}</div><div class="metricFoot">${x[2]}</div></article>`).join('');
  }

  function applyStaticMetrics(){
    const el=document.getElementById('metrics');
    if(!el||typeof state==='undefined')return;
    const html=staticMetricsHtml();
    if(!html||el.innerHTML===html)return;
    metricsApplying=true;
    el.innerHTML=html;
    metricsApplying=false;
  }

  function installStaticMetrics(){
    const el=document.getElementById('metrics');
    if(!el)return;
    const mo=new MutationObserver(()=>{if(!metricsApplying)queueMicrotask(applyStaticMetrics)});
    mo.observe(el,{childList:true,subtree:true,characterData:true});
    const role=document.getElementById('roleFilter');
    if(role)role.addEventListener('change',()=>setTimeout(applyStaticMetrics,0));
    applyStaticMetrics();
  }

  const observer=new MutationObserver(()=>inject());
  function install(){
    observer.observe(document.body,{childList:true,subtree:true});
    inject();
    installStaticMetrics();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
