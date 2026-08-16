(function(){
  if(window.__outerhavenProfileModalFlowFix)return;
  window.__outerhavenProfileModalFlowFix=true;

  document.addEventListener('click',function(e){
    const trigger=e.target.closest('[data-profile-add-opportunity],[data-profile-add-thesis]');
    if(!trigger)return;
    const overlay=document.getElementById('relationshipProfileOverlay');
    if(overlay&&!overlay.classList.contains('hidden'))overlay.classList.add('hidden');
  },true);

  const style=document.createElement('style');
  style.textContent=`
    #relationshipPipelinePanel .pipelineTabs{display:flex!important;gap:4px!important;padding:4px!important;background:#f3f4f7!important;border-radius:10px!important}
    #relationshipPipelinePanel .pipelineTab{border:0!important;background:transparent!important;color:#687080!important;padding:8px 14px!important;border-radius:8px!important;font-size:12px!important;font-weight:750!important;cursor:pointer!important;box-shadow:none!important}
    #relationshipPipelinePanel .pipelineTab.active{background:#111827!important;color:#fff!important;box-shadow:0 1px 3px rgba(0,0,0,.12)!important}
    #roleFilter{display:none!important}
  `;
  document.head.appendChild(style);

  function removeLegacySidebarSelector(){
    const role=document.getElementById('roleFilter');
    if(!role)return;
    role.setAttribute('aria-hidden','true');
    role.tabIndex=-1;
    const label=role.previousElementSibling;
    if(label&&label.classList.contains('smallLabel')&&label.textContent.trim().toUpperCase()==='VIEW AS')label.remove();
  }

  function selectedPageSide(){
    const stored=localStorage.getItem('outerhaven-section-side');
    if(stored==='Buy Side'||stored==='Sell Side')return stored;
    if(typeof pipelineSide!=='undefined'&&(pipelineSide==='Buy Side'||pipelineSide==='Sell Side'))return pipelineSide;
    return 'Sell Side';
  }

  function dashboardSide(){
    if(typeof pipelineSide!=='undefined'&&(pipelineSide==='Buy Side'||pipelineSide==='Sell Side'))return pipelineSide;
    return selectedPageSide();
  }

  function tidyDashboardSwitch(){
    removeLegacySidebarSelector();
    const duplicate=document.querySelector('#dashboardView > .sectionSideToolbar');
    if(duplicate)duplicate.remove();
    const side=dashboardSide();
    document.querySelectorAll('#relationshipPipelinePanel .pipelineTab').forEach(btn=>{
      btn.classList.toggle('active',btn.dataset.pipelineSide===side);
      btn.onclick=function(e){
        e.preventDefault();e.stopPropagation();
        const next=btn.dataset.pipelineSide;
        const proxy=document.querySelector(`#opportunitiesView .sectionSideTab[data-section-side="${next}"]`)||document.querySelector(`#peopleView .sectionSideTab[data-section-side="${next}"]`);
        if(proxy){proxy.click();return}
        if(typeof pipelineSide!=='undefined')pipelineSide=next;
        localStorage.setItem('outerhaven-section-side',next);
        if(typeof renderDashboard==='function')renderDashboard();
      };
    });
  }

  if(typeof renderPeople==='function'){
    const profileRenderPeople=renderPeople;
    renderPeople=function(){
      const role=document.getElementById('roleFilter');
      const old=role?.value;
      if(role)role.value=selectedPageSide();
      profileRenderPeople();
      if(role&&old!=null)role.value=old;
      document.querySelectorAll('#peopleView .sectionSideTab').forEach(btn=>{
        btn.classList.toggle('active',btn.dataset.sectionSide===selectedPageSide());
      });
    };
  }

  if(typeof renderDashboard==='function'){
    const baseRenderDashboard=renderDashboard;
    renderDashboard=function(){baseRenderDashboard();tidyDashboardSwitch()};
  }
  if(typeof renderAll==='function'){
    const baseRenderAll=renderAll;
    renderAll=function(){baseRenderAll();tidyDashboardSwitch()};
  }

  removeLegacySidebarSelector();
  tidyDashboardSwitch();
  if(typeof currentUser!=='undefined'&&currentUser&&typeof renderPeople==='function')renderPeople();

  if(!document.querySelector('script[src="/opportunity-stage-manager.js"]')){
    const stageManager=document.createElement('script');
    stageManager.src='/opportunity-stage-manager.js';
    stageManager.async=false;
    document.body.appendChild(stageManager);
  }
})();