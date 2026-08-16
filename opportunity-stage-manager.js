(function(){
  if(window.__outerhavenOpportunityStageManager)return;
  window.__outerhavenOpportunityStageManager=true;

  const OPPORTUNITY_START='Opportunity Received';
  const INITIAL_INTEREST='Initial Interest Identified';

  const style=document.createElement('style');
  style.textContent=`
    .profileMoveStageBtn,.pipelineMoveStageBtn{border:1px solid #d8dce3;background:#fff;color:#394150;border-radius:7px;padding:6px 9px;font-size:10px;font-weight:750;cursor:pointer}
    .profileMoveStageBtn:hover,.pipelineMoveStageBtn:hover{background:#f5f6f8}
    .opportunityStageCurrent{margin:0 0 12px;padding:10px 12px;border:1px solid #e4e7ec;background:#f8f9fb;border-radius:9px;font-size:11px;color:#697180;line-height:1.45}
    .opportunityStageCurrent strong{display:block;color:#252b35;font-size:12px;margin-top:2px}
    .profileStageFocus{outline:2px solid #d6a1a1;outline-offset:3px;transition:outline-color .4s ease}
    .drawerPipelineStatus{margin-bottom:16px;padding:14px;border:1px solid #e3e6eb;background:#f8f9fb;border-radius:11px}
    .drawerPipelineStatusLabel{font-size:10px;font-weight:800;letter-spacing:.08em;color:#777f8d;margin-bottom:7px}
    .drawerPipelineStatusSelect{width:100%;border:1px solid #cfd4dc;background:#fff;color:#252b35;border-radius:8px;padding:9px 10px;font-size:12px;font-weight:700;outline:none;cursor:pointer}
    .drawerPipelineStatusSelect:focus{border-color:#9ea6b3;box-shadow:0 0 0 2px rgba(31,41,55,.06)}
    .drawerPipelineStatusMeta{margin-top:6px;font-size:10px;color:#7a8190}
  `;
  document.head.appendChild(style);

  function stageLabel(stage){return stage==='NDA Signed + Buy-Side Thesis Shared'?'NDA Signed':stage}
  function opportunity(id){return (state.opportunities||[]).find(o=>o.id===id)}
  function opportunityPerson(o){return o?person(o.contactId):null}
  function isDirect(p){return !!p&&typeof isDirectSponsor==='function'&&isDirectSponsor(p)}
  function directOpportunity(p){return p?(state.opportunities||[]).find(o=>o.contactId===p.id&&o.side==='Sell Side'&&o.pipelineActive)||null:null}
  function opportunityStages(o){
    if(o?.side==='Buy Side')return typeof BUY_PIPELINE!=='undefined'?[...BUY_PIPELINE]:['New Relationship','Diligence Call Complete','NDA Signed + Thesis Captured','Relevant Deal Identified','Interest Meeting Held','Engagement Active','Buyer Interest Confirmed','Closed'];
    const p=opportunityPerson(o);
    if(isDirect(p))return [...SELL_PIPELINE];
    const start=SELL_PIPELINE.indexOf(OPPORTUNITY_START);
    return start>=0?SELL_PIPELINE.slice(start):[OPPORTUNITY_START,INITIAL_INTEREST,'Buy-Side Interest Confirmed','Engagement Active','Closed'];
  }

  async function applyOpportunityStage(id,target){
    const o=opportunity(id),p=opportunityPerson(o);if(!o||!target)return{error:new Error('Opportunity not found')};
    const {error}=await sb.from('opportunities').update({pipeline_stage:target,stage:target,pipeline_active:true}).eq('id',id);
    if(error)return{error};

    if(o.side==='Sell Side'&&isDirect(p)){
      const payload={pipeline_stage:target};
      if(SELL_PIPELINE.indexOf(target)<SELL_PIPELINE.indexOf(INITIAL_INTEREST))payload.interest_opportunity=null;
      const personUpdate=await sb.from('people').update(payload).eq('id',p.id);
      if(personUpdate.error)return{error:personUpdate.error};
    }
    return{error:null};
  }

  function installModal(){
    if(document.getElementById('opportunityStageModal'))return;
    document.body.insertAdjacentHTML('beforeend',`
      <div id="opportunityStageModal" class="modal hidden">
        <div class="modalCard small">
          <div class="modalHead">
            <div><div class="eyebrow">OPPORTUNITY PIPELINE</div><h2 id="opportunityStageTitle">Move Opportunity</h2></div>
            <button id="closeOpportunityStageModal" class="iconBtn" type="button">×</button>
          </div>
          <form id="opportunityStageForm" class="form">
            <input id="opportunityStageId" type="hidden">
            <div id="opportunityStageCurrent" class="opportunityStageCurrent"></div>
            <div class="formGrid">
              <label class="span2">Move to Stage<select id="opportunityStageSelect" required></select></label>
            </div>
            <div class="modalActions">
              <button id="cancelOpportunityStage" class="ghost" type="button">Cancel</button>
              <button class="primary" type="submit">Move Opportunity</button>
            </div>
          </form>
        </div>
      </div>
    `);
    document.getElementById('closeOpportunityStageModal').onclick=closeStageModal;
    document.getElementById('cancelOpportunityStage').onclick=closeStageModal;
    document.getElementById('opportunityStageForm').onsubmit=saveOpportunityStage;
  }

  function closeStageModal(){document.getElementById('opportunityStageModal')?.classList.add('hidden')}

  function openStageModal(id){
    installModal();
    const o=opportunity(id);if(!o)return;
    const p=opportunityPerson(o),current=o.pipelineStage||o.stage||OPPORTUNITY_START,stages=opportunityStages(o);
    document.getElementById('opportunityStageId').value=o.id;
    document.getElementById('opportunityStageTitle').textContent=`Move ${o.company}`;
    document.getElementById('opportunityStageCurrent').innerHTML=`Current stage<strong>${esc(stageLabel(current))}</strong>${p?`Source: ${esc(p.name)}`:''}`;
    const select=document.getElementById('opportunityStageSelect');
    select.innerHTML=stages.map(stage=>`<option value="${esc(stage)}">${esc(stageLabel(stage))}</option>`).join('');
    select.value=stages.includes(current)?current:stages[0];
    const submit=document.querySelector('#opportunityStageForm button[type="submit"]');
    if(submit){submit.disabled=false;submit.textContent='Move Opportunity'}
    document.getElementById('opportunityStageModal').classList.remove('hidden');
  }

  async function saveOpportunityStage(e){
    e.preventDefault();
    const id=document.getElementById('opportunityStageId').value;
    const target=document.getElementById('opportunityStageSelect').value;
    if(!id||!target)return;
    const submit=e.submitter;if(submit){submit.disabled=true;submit.textContent='Moving...'}
    const result=await applyOpportunityStage(id,target);
    if(result.error){alert(result.error.message);if(submit){submit.disabled=false;submit.textContent='Move Opportunity'}return}
    closeStageModal();
    await loadData();
  }

  function makeMoveButton(id,className='pipelineMoveStageBtn'){
    const btn=document.createElement('button');
    btn.type='button';btn.className=className;btn.dataset.moveOpportunityStage=id;btn.textContent='Move Stage';
    return btn;
  }

  function enhanceProfileOpportunityCards(){
    document.querySelectorAll('#relationshipProfileBody .profileItemCard [data-open-deal]').forEach(open=>{
      const card=open.closest('.profileItemCard');if(!card)return;
      const id=open.dataset.openDeal;
      card.dataset.profileOpportunityId=id;
      const actions=card.querySelector('.profileItemActions');if(!actions)return;
      if(!actions.querySelector(`[data-move-opportunity-stage="${id}"]`))actions.appendChild(makeMoveButton(id,'profileMoveStageBtn'));
    });
  }

  function enhancePipelineOpportunityCards(){
    document.querySelectorAll('#relationshipPipeline [data-pipeline-deal]').forEach(card=>{
      const id=card.dataset.pipelineDeal;if(!id)return;
      const actions=card.querySelector('.pipelineDealActions')||card.querySelector('.pipelinePersonActions');if(!actions)return;
      if(!actions.querySelector(`[data-move-opportunity-stage="${id}"]`))actions.insertBefore(makeMoveButton(id),actions.firstChild);
    });

    document.querySelectorAll('#relationshipPipeline [data-pipeline-person]').forEach(card=>{
      const p=person(card.dataset.pipelinePerson);if(!p||!isDirect(p))return;
      const o=directOpportunity(p);if(!o)return;
      const actions=card.querySelector('.pipelinePersonActions');if(!actions)return;
      if(!actions.querySelector(`[data-move-opportunity-stage="${o.id}"]`))actions.insertBefore(makeMoveButton(o.id),actions.firstChild);
    });
  }

  function enhanceOpportunityDrawer(id){
    const o=opportunity(id),body=document.getElementById('drawerBody');
    if(!o||!body)return;
    body.querySelector('.drawerPipelineStatus')?.remove();
    const current=o.pipelineStage||o.stage||(o.side==='Sell Side'?OPPORTUNITY_START:'New Relationship');
    const stages=opportunityStages(o);
    const section=document.createElement('section');
    section.className='drawerPipelineStatus';
    section.innerHTML=`<div class="drawerPipelineStatusLabel">PIPELINE STATUS</div><select class="drawerPipelineStatusSelect" data-drawer-pipeline-status="${esc(o.id)}">${stages.map(stage=>`<option value="${esc(stage)}" ${stage===current?'selected':''}>${esc(stageLabel(stage))}</option>`).join('')}</select><div class="drawerPipelineStatusMeta">Change this to move the opportunity directly to another pipeline stage.</div>`;
    body.prepend(section);
    const select=section.querySelector('[data-drawer-pipeline-status]');
    select.onchange=async()=>{
      const target=select.value,previous=current;
      select.disabled=true;
      const result=await applyOpportunityStage(o.id,target);
      if(result.error){alert(result.error.message);select.value=previous;select.disabled=false;return}
      await loadData();
      if(typeof openDetail==='function')openDetail(o.id);
    };
  }

  function focusOpportunityInProfile(id){
    let tries=0;
    const focus=()=>{
      enhanceProfileOpportunityCards();
      const card=document.querySelector(`#relationshipProfileBody [data-profile-opportunity-id="${CSS.escape(id)}"]`);
      if(card){
        card.scrollIntoView({behavior:'smooth',block:'center'});
        card.classList.add('profileStageFocus');
        setTimeout(()=>card.classList.remove('profileStageFocus'),1600);
        return;
      }
      if(++tries<12)setTimeout(focus,60);
    };
    setTimeout(focus,20);
  }

  function openOpportunityProfile(id){
    const o=opportunity(id);if(!o)return;
    if(typeof window.openRelationshipProfile==='function'){
      window.openRelationshipProfile(o.contactId,'profileOpportunitiesSection');
      focusOpportunityInProfile(id);
      return;
    }
    if(typeof openDetail==='function')openDetail(id);
  }

  document.addEventListener('click',function(e){
    const move=e.target.closest('[data-move-opportunity-stage]');
    if(move){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();openStageModal(move.dataset.moveOpportunityStage);return}

    const pipelineDeal=e.target.closest('#relationshipPipeline [data-pipeline-deal]');
    const pipelineOpen=e.target.closest('#relationshipPipeline [data-open-deal]');
    if(pipelineDeal||pipelineOpen){
      const id=pipelineOpen?.dataset.openDeal||pipelineDeal?.dataset.pipelineDeal;
      if(id){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();openOpportunityProfile(id)}
      return;
    }

    const sponsorOpportunity=e.target.closest('#relationshipPipeline .sponsorOpportunityBox');
    if(sponsorOpportunity){
      const personCard=sponsorOpportunity.closest('[data-pipeline-person]');
      const p=personCard?person(personCard.dataset.pipelinePerson):null;
      const o=directOpportunity(p);
      if(o){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();openOpportunityProfile(o.id)}
    }
  },true);

  if(typeof openDetail==='function'){
    const baseOpenDetail=openDetail;
    openDetail=function(id){
      baseOpenDetail(id);
      enhanceOpportunityDrawer(id);
    };
  }

  if(typeof renderPipeline==='function'){
    const baseRenderPipeline=renderPipeline;
    renderPipeline=function(){baseRenderPipeline();enhancePipelineOpportunityCards()};
  }

  const observer=new MutationObserver(()=>{enhanceProfileOpportunityCards();enhancePipelineOpportunityCards()});
  const startObserver=()=>{
    installModal();
    const profileBody=document.getElementById('relationshipProfileBody');
    const pipeline=document.getElementById('relationshipPipeline');
    if(profileBody)observer.observe(profileBody,{childList:true,subtree:true});
    if(pipeline)observer.observe(pipeline,{childList:true,subtree:true});
    enhanceProfileOpportunityCards();
    enhancePipelineOpportunityCards();
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',startObserver,{once:true});else startObserver();
})();