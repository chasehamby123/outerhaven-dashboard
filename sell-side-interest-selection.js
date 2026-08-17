(function(){
  if(window.__outerhavenSellSideInterestSelection)return;
  window.__outerhavenSellSideInterestSelection=true;

  const RECEIVED='Opportunity Received';
  const INITIAL_INTEREST='Initial Interest Identified';

  const style=document.createElement('style');
  style.textContent=`
    .profileItemCard[data-profile-opportunity-pending="true"] [data-move-opportunity-stage]{display:none!important}
    .pendingPipelineNote{font-size:12px;color:#6f7785;margin-top:7px;line-height:1.45}
    .interestSelectMeta{font-size:11px;color:#747c89;margin-top:6px;line-height:1.45}
  `;
  document.head.appendChild(style);

  function opportunity(id){return (state.opportunities||[]).find(o=>o.id===id)||null}
  function sourcePersonFor(o){return o?person(o.contactId):null}
  function isSourcePerson(p){
    if(!p||p.side==='Buy Side')return false;
    if(typeof isMultiDealSource==='function')return isMultiDealSource(p);
    return p.sellSideKind!=='direct_sponsor';
  }
  function opportunityStage(o){return o?.pipelineStage||o?.stage||RECEIVED}
  function isPendingOpportunity(o){return !!o&&o.side==='Sell Side'&&isSourcePerson(sourcePersonFor(o))&&opportunityStage(o)===RECEIVED}
  function pendingForPerson(personId){
    return (state.opportunities||[]).filter(o=>o.contactId===personId&&isPendingOpportunity(o)).sort((a,b)=>(b.updatedAt||b.createdAt||'').localeCompare(a.updatedAt||a.createdAt||''));
  }

  function installModal(){
    if(document.getElementById('initialInterestSelectionModal'))return;
    document.body.insertAdjacentHTML('beforeend',`
      <div id="initialInterestSelectionModal" class="modal hidden">
        <div class="modalCard small">
          <div class="modalHead">
            <div><div class="eyebrow">INITIAL INTEREST</div><h2 id="initialInterestSelectionTitle">Select Opportunity</h2></div>
            <button id="closeInitialInterestSelection" class="iconBtn" type="button">×</button>
          </div>
          <form id="initialInterestSelectionForm" class="form">
            <input id="initialInterestPersonId" type="hidden">
            <div class="formGrid">
              <label class="span2">Opportunity Receiving Initial Interest<select id="initialInterestOpportunityId" required></select></label>
            </div>
            <div id="initialInterestSelectionMeta" class="interestSelectMeta"></div>
            <div class="modalActions">
              <button id="cancelInitialInterestSelection" class="ghost" type="button">Cancel</button>
              <button class="primary" type="submit">Move to Initial Interest</button>
            </div>
          </form>
        </div>
      </div>
    `);
    document.getElementById('closeInitialInterestSelection').onclick=closeModal;
    document.getElementById('cancelInitialInterestSelection').onclick=closeModal;
    document.getElementById('initialInterestSelectionForm').onsubmit=saveSelection;
    document.getElementById('initialInterestOpportunityId').onchange=renderSelectionMeta;
  }

  function closeModal(){document.getElementById('initialInterestSelectionModal')?.classList.add('hidden')}

  function renderSelectionMeta(){
    const personId=document.getElementById('initialInterestPersonId')?.value;
    const opportunityId=document.getElementById('initialInterestOpportunityId')?.value;
    const p=person(personId),o=opportunity(opportunityId),meta=document.getElementById('initialInterestSelectionMeta');
    if(!meta)return;
    meta.textContent=o?`${o.company}${o.size?` · ${o.size}`:''} will enter the pipeline at Initial Interest Identified. ${p?.name||'The source'} remains the source relationship for the deal.`:'';
  }

  function openSelection(personId){
    installModal();
    const p=person(personId);if(!p)return;
    const pending=pendingForPerson(personId);
    if(!pending.length){
      alert(`Add an opportunity under ${p.name} first. It will stay off the pipeline until you select it here.`);
      return;
    }
    document.getElementById('initialInterestPersonId').value=p.id;
    document.getElementById('initialInterestSelectionTitle').textContent=`Advance ${p.name}`;
    const select=document.getElementById('initialInterestOpportunityId');
    select.innerHTML=pending.map(o=>`<option value="${esc(o.id)}">${esc(o.company)}${o.size?` · ${esc(o.size)}`:''}</option>`).join('');
    const submit=document.querySelector('#initialInterestSelectionForm button[type="submit"]');
    if(submit){submit.disabled=false;submit.textContent='Move to Initial Interest'}
    renderSelectionMeta();
    document.getElementById('initialInterestSelectionModal').classList.remove('hidden');
  }

  async function saveSelection(e){
    e.preventDefault();
    const personId=document.getElementById('initialInterestPersonId').value;
    const opportunityId=document.getElementById('initialInterestOpportunityId').value;
    const p=person(personId),o=opportunity(opportunityId);
    if(!p||!o||!isPendingOpportunity(o))return;
    const submit=e.submitter;
    if(submit){submit.disabled=true;submit.textContent='Moving...'}
    const {error}=await sb.from('opportunities').update({pipeline_stage:INITIAL_INTEREST,stage:INITIAL_INTEREST,pipeline_active:true}).eq('id',opportunityId);
    if(error){alert(error.message);if(submit){submit.disabled=false;submit.textContent='Move to Initial Interest'}return}
    await sb.from('people').update({interest_opportunity:o.company}).eq('id',personId);
    closeModal();
    await loadData();
  }

  function enhancePipeline(){
    const board=document.getElementById('relationshipPipeline');if(!board)return;

    board.querySelectorAll('[data-pipeline-deal]').forEach(card=>{
      const o=opportunity(card.dataset.pipelineDeal);
      if(isPendingOpportunity(o))card.remove();
    });

    board.querySelectorAll('[data-pipeline-person]').forEach(card=>{
      const p=person(card.dataset.pipelinePerson);if(!isSourcePerson(p))return;
      const current=typeof personSellStage==='function'?personSellStage(p):(p.pipelineStage||RECEIVED);
      if(current!==RECEIVED)return;
      const actions=card.querySelector('.pipelinePersonActions');if(!actions)return;
      if(!actions.querySelector('[data-select-initial-interest]')){
        const btn=document.createElement('button');
        btn.type='button';btn.className='pipelineAdvance';btn.dataset.selectInitialInterest=p.id;btn.textContent='Advance →';
        actions.appendChild(btn);
      }
    });

    board.querySelectorAll('.pipelineStage').forEach(stage=>{
      const count=stage.querySelectorAll(':scope > .pipelinePerson').length;
      const counter=stage.querySelector('.pipelineStageCount');if(counter)counter.textContent=String(count);
      const empty=stage.querySelector(':scope > .pipelineEmpty');
      if(count===0&&!empty)stage.insertAdjacentHTML('beforeend','<div class="pipelineEmpty">No relationships here.</div>');
      if(count>0&&empty)empty.remove();
    });
  }

  function enhanceProfile(){
    document.querySelectorAll('#relationshipProfileBody [data-profile-opportunity-id]').forEach(card=>{
      const o=opportunity(card.dataset.profileOpportunityId);if(!o)return;
      const pending=isPendingOpportunity(o);
      card.dataset.profileOpportunityPending=pending?'true':'false';
      if(pending){
        const stage=card.querySelector('.profileItemStage');
        if(stage)stage.textContent='Stored · Not in Pipeline';
      }
    });
  }

  document.addEventListener('click',function(e){
    const trigger=e.target.closest('[data-select-initial-interest]');
    if(!trigger)return;
    e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
    openSelection(trigger.dataset.selectInitialInterest);
  },true);

  if(typeof renderPipeline==='function'){
    const baseRenderPipeline=renderPipeline;
    renderPipeline=function(){baseRenderPipeline();enhancePipeline()};
  }

  if(typeof openDetail==='function'){
    const baseOpenDetail=openDetail;
    openDetail=async function(id){
      await baseOpenDetail(id);
      const o=opportunity(id),body=document.getElementById('drawerBody');
      if(!body||!isPendingOpportunity(o))return;
      body.querySelector('[data-pending-pipeline-note]')?.remove();
      const note=document.createElement('section');
      note.className='detailSec';note.dataset.pendingPipelineNote='true';
      note.innerHTML=`<div class="detailTitle">PIPELINE STATUS</div><div class="pendingPipelineNote">Stored under ${esc(sourcePersonFor(o)?.name||'this relationship')}. This opportunity is not in the pipeline yet. Advance the source relationship and select this opportunity when it receives initial interest.</div>`;
      body.prepend(note);
    };
  }

  const observer=new MutationObserver(()=>{enhancePipeline();enhanceProfile()});
  function install(){
    installModal();
    const board=document.getElementById('relationshipPipeline');
    const profile=document.getElementById('relationshipProfileBody');
    if(board)observer.observe(board,{childList:true,subtree:true});
    if(profile)observer.observe(profile,{childList:true,subtree:true});
    enhancePipeline();enhanceProfile();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
