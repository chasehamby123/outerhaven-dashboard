(function(){
  if(window.__outerhavenDashboardPipelineInteractions)return;
  window.__outerhavenDashboardPipelineInteractions=true;

  const FOLLOW_UP_MS=48*60*60*1000;

  const baseMapPerson=mapPerson;
  mapPerson=function(r){
    const p=baseMapPerson(r);
    p.waitingOn=r.waiting_on||'';
    p.waitingOnSince=r.waiting_on_since||'';
    return p;
  };
  const baseMapOpp=mapOpp;
  mapOpp=function(r){
    const o=baseMapOpp(r);
    o.waitingOn=r.waiting_on||'';
    o.waitingOnSince=r.waiting_on_since||'';
    return o;
  };

  const style=document.createElement('style');
  style.textContent=`
    .pipelineWaitingWrap{display:flex;align-items:center;margin:9px 0 2px}
    .pipelineWaitingBtn{border:1px solid #d9dde4;background:#f7f8fa;color:#697180;border-radius:8px;padding:6px 9px;font-size:10px;font-weight:800;cursor:pointer;line-height:1.1;transition:.15s}
    .pipelineWaitingBtn.waitingUs{border-color:#e8d6a6;background:#fff9ea;color:#826515}
    .pipelineWaitingBtn.waitingThem{border-color:#b9ddc5;background:#eefaf2;color:#237a45}
    .pipelineWaitingBtn.followUpDue{border-color:#e05252;background:#fff0f0;color:#b42323;font-weight:900;box-shadow:0 0 0 1px rgba(224,82,82,.08)}
    .pipelineWaitingBtn:hover{filter:brightness(.985)}
  `;
  document.head.appendChild(style);

  function opportunity(id){return (state.opportunities||[]).find(o=>o.id===id)}
  function ageMs(since){const t=since?new Date(since).getTime():NaN;return Number.isFinite(t)?Math.max(0,Date.now()-t):0}
  function isFollowUpDue(value,since){return value==='us'&&!!since&&ageMs(since)>=FOLLOW_UP_MS}
  function waitingLabel(value,since){
    if(isFollowUpDue(value,since))return 'Follow Up';
    if(value==='us')return 'Waiting on us';
    if(value==='them')return 'Waiting on them';
    return 'Set waiting';
  }
  function waitingClass(value,since){
    if(isFollowUpDue(value,since))return 'followUpDue';
    return value==='us'?'waitingUs':value==='them'?'waitingThem':'';
  }
  function waitingTitle(value,since){
    if(isFollowUpDue(value,since))return 'Waiting on us for 2+ days. Click after following up to switch this to Waiting on them.';
    if(value==='us'&&since){
      const remaining=Math.max(0,FOLLOW_UP_MS-ageMs(since));
      const hours=Math.max(1,Math.ceil(remaining/3600000));
      return `Follow-up alert in about ${hours} hour${hours===1?'':'s'}.`;
    }
    if(value==='them')return 'Click when responsibility moves back to us.';
    return 'Click to set this to Waiting on us.';
  }

  function syncWaitingButton(card,kind,id,value,since){
    let button=card.querySelector(`[data-waiting-kind="${kind}"][data-waiting-id="${id}"]`);
    if(!button){
      const wrap=document.createElement('div');
      wrap.className='pipelineWaitingWrap';
      wrap.innerHTML=`<button type="button" class="pipelineWaitingBtn" data-waiting-kind="${kind}" data-waiting-id="${id}"></button>`;
      const actions=card.querySelector('.pipelinePersonActions,.pipelineDealActions');
      if(actions)card.insertBefore(wrap,actions);else card.appendChild(wrap);
      button=wrap.querySelector('button');
    }
    const cls=`pipelineWaitingBtn ${waitingClass(value,since)}`.trim();
    const label=waitingLabel(value,since);
    const title=waitingTitle(value,since);
    if(button.className!==cls)button.className=cls;
    if(button.textContent!==label)button.textContent=label;
    if(button.title!==title)button.title=title;
    button.dataset.waitingSince=since||'';
  }

  function enhanceWaitingControls(){
    const board=document.getElementById('relationshipPipeline');
    if(!board)return;
    board.querySelectorAll('[data-pipeline-person]').forEach(card=>{
      const p=person(card.dataset.pipelinePerson);if(!p)return;
      syncWaitingButton(card,'person',p.id,p.waitingOn||'',p.waitingOnSince||'');
    });
    board.querySelectorAll('[data-pipeline-deal]').forEach(card=>{
      const o=opportunity(card.dataset.pipelineDeal);if(!o)return;
      syncWaitingButton(card,'opportunity',o.id,o.waitingOn||'',o.waitingOnSince||'');
    });
  }

  async function setWaiting(button){
    if(button.disabled)return;
    const kind=button.dataset.waitingKind,id=button.dataset.waitingId;
    const record=kind==='person'?person(id):opportunity(id);
    const current=record?.waitingOn||'';
    const currentSince=record?.waitingOnSince||'';
    const next=current==='us'?'them':'us';
    const changedAt=new Date().toISOString();
    button.disabled=true;
    button.textContent='Saving...';
    const table=kind==='person'?'people':'opportunities';
    const {error}=await sb.from(table).update({waiting_on:next,waiting_on_since:changedAt}).eq('id',id);
    if(error){
      alert(error.message);
      button.disabled=false;
      button.textContent=waitingLabel(current,currentSince);
      return;
    }

    if(kind==='person'){
      const p=person(id);
      if(p&&typeof isDirectSponsor==='function'&&isDirectSponsor(p)){
        const linked=(state.opportunities||[]).find(o=>o.contactId===p.id&&o.side==='Sell Side'&&o.pipelineActive);
        if(linked)await sb.from('opportunities').update({waiting_on:next,waiting_on_since:changedAt}).eq('id',linked.id);
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
    setInterval(enhanceWaitingControls,60000);
    loadProfileInlineStage();
    document.querySelector('[data-view="leadreview"]')?.remove();
    document.getElementById('leadreviewView')?.remove();
    if(typeof currentUser!=='undefined'&&currentUser&&typeof loadData==='function')loadData();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
