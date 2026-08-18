(function(){
  if(window.__outerhavenDashboardPipelineRegressionGuard)return;
  window.__outerhavenDashboardPipelineRegressionGuard=true;

  function resetOpportunityImportButton(){
    const form=document.getElementById('profileOpportunityForm');
    const submit=form?.querySelector('button[type="submit"]');
    if(!submit)return;
    submit.disabled=false;
    submit.textContent='Import Opportunity';
  }

  function resetThesisImportButton(){
    const form=document.getElementById('profileThesisForm');
    const submit=form?.querySelector('button[type="submit"]');
    if(!submit)return;
    submit.disabled=false;
    submit.textContent='Import Thesis';
  }

  document.addEventListener('click',function(e){
    if(e.target.closest('[data-profile-add-opportunity]'))setTimeout(resetOpportunityImportButton,0);
    if(e.target.closest('[data-profile-add-thesis]'))setTimeout(resetThesisImportButton,0);
  },true);

  let dedupeQueued=false;
  function dedupeSourceAdvanceButtons(){
    dedupeQueued=false;
    document.querySelectorAll('#relationshipPipeline .sourceCard[data-pipeline-person]').forEach(card=>{
      const actions=card.querySelector('.pipelinePersonActions');
      if(!actions)return;
      const advances=[...actions.querySelectorAll('.pipelineAdvance')];
      if(advances.length<2)return;

      const preferred=actions.querySelector('[data-select-initial-interest]')
        ||actions.querySelector('[data-advance-source-existing]')
        ||advances[0];
      advances.forEach(button=>{if(button!==preferred)button.remove()});
    });
  }
  function queueDedupe(){
    if(dedupeQueued)return;
    dedupeQueued=true;
    setTimeout(dedupeSourceAdvanceButtons,0);
  }

  let boardObserver=null;
  function watchPipeline(){
    const board=document.getElementById('relationshipPipeline');
    if(!board)return false;
    if(boardObserver)return true;
    boardObserver=new MutationObserver(queueDedupe);
    boardObserver.observe(board,{childList:true,subtree:true});
    dedupeSourceAdvanceButtons();
    return true;
  }

  function install(){
    resetOpportunityImportButton();
    resetThesisImportButton();
    if(watchPipeline())return;
    const bodyObserver=new MutationObserver(()=>{
      if(watchPipeline())bodyObserver.disconnect();
    });
    bodyObserver.observe(document.body,{childList:true,subtree:true});
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
  else install();
})();
