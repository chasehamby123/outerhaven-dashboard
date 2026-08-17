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

  const observer=new MutationObserver(()=>inject());
  function install(){observer.observe(document.body,{childList:true,subtree:true});inject()}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
