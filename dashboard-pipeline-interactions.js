(function(){
  if(window.__outerhavenDashboardPipelineInteractions)return;
  window.__outerhavenDashboardPipelineInteractions=true;

  const baseMapPerson=mapPerson;
  mapPerson=function(r){
    const p=baseMapPerson(r);
    p.waitingOn=r.waiting_on||'';
    return p;
  };
  const baseMapOpp=mapOpp;
  mapOpp=function(r){
    const o=baseMapOpp(r);
    o.waitingOn=r.waiting_on||'';
    return o;
  };

  const style=document.createElement('style');
  style.textContent=`
    .pipelineWaitingWrap{display:flex;align-items:center;margin:9px 0 2px}
    .pipelineWaitingBtn{border:1px solid #d9dde4;background:#f7f8fa;color:#697180;border-radius:8px;padding:6px 9px;font-size:10px;font-weight:800;cursor:pointer;line-height:1.1}
    .pipelineWaitingBtn.waitingUs{border-color:#efc3c3;background:#fff1f1;color:#a32121}
    .pipelineWaitingBtn.waitingThem{border-color:#b9ddc5;background:#eefaf2;color:#237a45}
    .pipelineWaitingBtn:hover{filter:brightness(.985)}
  `;
  document.head.appendChild(style);

  function waitingLabel(value){
    if(value==='us')return 'Waiting on us';
    if(value==='them')return 'Waiting on them';
    return 'Set waiting';
  }
  function waitingClass(value){return value==='us'?'waitingUs':value==='them'?'waitingThem':''}
  function opportunity(id){return (state.opportunities||[]).find(o=>o.id===id)}

  function addWaitingButton(card,kind,id,value){
    if(card.querySelector(`[data-waiting-kind="${kind}"][data-waiting-id="${id}"]`))return;
    const wrap=document.createElement('div');
    wrap.className='pipelineWaitingWrap';
    wrap.innerHTML=`<button type="button" class="pipelineWaitingBtn ${waitingClass(value)}" data-waiting-kind="${kind}" data-waiting-id="${id}">${waitingLabel(value)}</button>`;
    const actions=card.querySelector('.pipelinePersonActions,.pipelineDealActions');
    if(actions)card.insertBefore(wrap,actions);
    else card.appendChild(wrap);
  }

  function enhanceWaitingControls(){
    const board=document.getElementById('relationshipPipeline');
    if(!board)return;
    board.querySelectorAll('[data-pipeline-person]').forEach(card=>{
      const p=person(card.dataset.pipelinePerson);if(!p)return;
      addWaitingButton(card,'person',p.id,p.waitingOn||'');
    });
    board.querySelectorAll('[data-pipeline-deal]').forEach(card=>{
      const o=opportunity(card.dataset.pipelineDeal);if(!o)return;
      addWaitingButton(card,'opportunity',o.id,o.waitingOn||'');
    });
  }

  async function setWaiting(button){
    if(button.disabled)return;
    const kind=button.dataset.waitingKind,id=button.dataset.waitingId;
    const current=kind==='person'?person(id)?.waitingOn:opportunity(id)?.waitingOn;
    const next=current==='us'?'them':'us';
    button.disabled=true;
    button.textContent='Saving...';
    const table=kind==='person'?'people':'opportunities';
    const {error}=await sb.from(table).update({waiting_on:next}).eq('id',id);
    if(error){alert(error.message);button.disabled=false;button.textContent=waitingLabel(current);return}

    if(kind==='person'){
      const p=person(id);
      if(p&&typeof isDirectSponsor==='function'&&isDirectSponsor(p)){
        const linked=(state.opportunities||[]).find(o=>o.contactId===p.id&&o.side==='Sell Side'&&o.pipelineActive);
        if(linked)await sb.from('opportunities').update({waiting_on:next}).eq('id',linked.id);
      }
    }
    await loadData();
  }

  function openPersonProfile(id){
    const p=person(id);if(!p)return;
    window.__outerhavenProfileStageContext={kind:'person',id:p.id};
    if(typeof window.openRelationshipProfile==='function')window.openRelationshipProfile(p.id);
    else if(typeof openPipelineModal==='function')openPipelineModal(p.id);
    setTimeout(()=>window.__outerhavenRefreshProfileInlineStage?.(),0);
  }

  function openOpportunityProfile(id){
    const o=opportunity(id);if(!o)return;
    window.__outerhavenProfileStageContext={kind:'opportunity',id:o.id};
    if(typeof window.openRelationshipProfile==='function')window.openRelationshipProfile(o.contactId,'profileOpportunitiesSection');
    else if(typeof openDetail==='function')openDetail(o.id);
    setTimeout(()=>window.__outerhavenRefreshProfileInlineStage?.(),0);
  }

  window.addEventListener('click',function(e){
    const waiting=e.target.closest('[data-waiting-kind][data-waiting-id]');
    if(waiting){
      e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
      setWaiting(waiting);
      return;
    }

    const board=e.target.closest('#relationshipPipeline');
    if(!board)return;
    if(e.target.closest('button,select,input,textarea,label'))return;

    const deal=e.target.closest('[data-pipeline-deal]');
    if(deal){
      e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
      openOpportunityProfile(deal.dataset.pipelineDeal);
      return;
    }

    const personCard=e.target.closest('[data-pipeline-person]');
    if(personCard){
      e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
      openPersonProfile(personCard.dataset.pipelinePerson);
    }
  },true);

  if(typeof renderPipeline==='function'){
    const baseRenderPipeline=renderPipeline;
    renderPipeline=function(){baseRenderPipeline();enhanceWaitingControls()};
  }

  function loadProfileInlineStage(){
    if(document.querySelector('script[src="/profile-inline-stage.js"]'))return;
    const s=document.createElement('script');
    s.src='/profile-inline-stage.js';
    s.async=false;
    document.body.appendChild(s);
  }

  const observer=new MutationObserver(()=>enhanceWaitingControls());
  function install(){
    const board=document.getElementById('relationshipPipeline');
    if(board)observer.observe(board,{childList:true,subtree:true});
    enhanceWaitingControls();
    loadProfileInlineStage();
    document.querySelector('[data-view="leadreview"]')?.remove();
    document.getElementById('leadreviewView')?.remove();
    if(typeof currentUser!=='undefined'&&currentUser&&typeof loadData==='function')loadData();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
