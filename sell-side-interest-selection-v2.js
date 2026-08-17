(function(){
  if(window.__outerhavenSellSideInterestSelectionV2)return;
  window.__outerhavenSellSideInterestSelectionV2=true;

  const RECEIVED='Opportunity Received';
  const INITIAL_INTEREST='Initial Interest Identified';

  function opportunity(id){return (state.opportunities||[]).find(o=>o.id===id)||null}
  function sourcePerson(o){return o?person(o.contactId):null}
  function isSource(p){
    if(!p||p.side==='Buy Side')return false;
    if(typeof isMultiDealSource==='function')return isMultiDealSource(p);
    return p.sellSideKind!=='direct_sponsor';
  }
  function dealStage(o){return o?.pipelineStage||o?.stage||RECEIVED}
  function isStored(o){return !!o&&o.side==='Sell Side'&&isSource(sourcePerson(o))&&dealStage(o)===RECEIVED}
  function storedFor(personId){
    return (state.opportunities||[]).filter(o=>o.contactId===personId&&isStored(o)).sort((a,b)=>(b.updatedAt||b.createdAt||'').localeCompare(a.updatedAt||a.createdAt||''));
  }

  function ensureModal(){
    if(document.getElementById('initialInterestSelectionModal'))return;
    document.body.insertAdjacentHTML('beforeend',`
      <div id="initialInterestSelectionModal" class="modal hidden">
        <div class="modalCard small">
          <div class="modalHead"><div><div class="eyebrow">INITIAL INTEREST</div><h2 id="initialInterestSelectionTitle">Select Opportunity</h2></div><button id="closeInitialInterestSelection" class="iconBtn" type="button">×</button></div>
          <form id="initialInterestSelectionForm" class="form">
            <input id="initialInterestPersonId" type="hidden">
            <div class="formGrid"><label class="span2">Opportunity Receiving Initial Interest<select id="initialInterestOpportunityId" required></select></label></div>
            <div id="initialInterestSelectionMeta" style="font-size:11px;color:#747c89;margin-top:6px;line-height:1.45"></div>
            <div class="modalActions"><button id="cancelInitialInterestSelection" class="ghost" type="button">Cancel</button><button class="primary" type="submit">Move to Initial Interest</button></div>
          </form>
        </div>
      </div>`);
    const close=()=>document.getElementById('initialInterestSelectionModal')?.classList.add('hidden');
    document.getElementById('closeInitialInterestSelection').onclick=close;
    document.getElementById('cancelInitialInterestSelection').onclick=close;
    document.getElementById('initialInterestOpportunityId').onchange=renderMeta;
    document.getElementById('initialInterestSelectionForm').onsubmit=saveSelection;
  }

  function renderMeta(){
    const pid=document.getElementById('initialInterestPersonId')?.value;
    const oid=document.getElementById('initialInterestOpportunityId')?.value;
    const p=person(pid),o=opportunity(oid),meta=document.getElementById('initialInterestSelectionMeta');
    if(meta)meta.textContent=o?`${o.company}${o.size?` · ${o.size}`:''} will create its own card in Initial Interest Identified. ${p?.name||'The source'} remains in Opportunity Received.`:'';
  }

  function openSelection(personId){
    ensureModal();
    const p=person(personId);if(!p)return;
    const choices=storedFor(personId);
    if(!choices.length){alert(`Add an opportunity under ${p.name} first. Stored opportunities stay off the pipeline until one receives initial interest.`);return}
    document.getElementById('initialInterestPersonId').value=p.id;
    document.getElementById('initialInterestSelectionTitle').textContent=`Advance ${p.name}`;
    document.getElementById('initialInterestOpportunityId').innerHTML=choices.map(o=>`<option value="${esc(o.id)}">${esc(o.company)}${o.size?` · ${esc(o.size)}`:''}</option>`).join('');
    const submit=document.querySelector('#initialInterestSelectionForm button[type="submit"]');
    if(submit){submit.disabled=false;submit.textContent='Move to Initial Interest'}
    renderMeta();
    document.getElementById('initialInterestSelectionModal').classList.remove('hidden');
  }
  window.openSellSideInterestSelection=openSelection;

  async function saveSelection(e){
    e.preventDefault();
    const pid=document.getElementById('initialInterestPersonId').value;
    const oid=document.getElementById('initialInterestOpportunityId').value;
    const p=person(pid),o=opportunity(oid);if(!p||!o||!isStored(o))return;
    const submit=e.submitter;if(submit){submit.disabled=true;submit.textContent='Moving...'}
    const {error}=await sb.from('opportunities').update({pipeline_stage:INITIAL_INTEREST,stage:INITIAL_INTEREST,pipeline_active:true}).eq('id',oid);
    if(error){alert(error.message);if(submit){submit.disabled=false;submit.textContent='Move to Initial Interest'}return}
    await sb.from('people').update({pipeline_stage:RECEIVED,interest_opportunity:o.company}).eq('id',pid);
    document.getElementById('initialInterestSelectionModal').classList.add('hidden');
    await loadData();
  }

  function applyPipelineGate(){
    const board=document.getElementById('relationshipPipeline');if(!board)return;
    board.querySelectorAll('[data-pipeline-deal]').forEach(card=>{
      const o=opportunity(card.dataset.pipelineDeal);
      if(isStored(o))card.remove();
    });
    board.querySelectorAll('[data-pipeline-person]').forEach(card=>{
      const p=person(card.dataset.pipelinePerson);if(!isSource(p))return;
      const current=typeof personSellStage==='function'?personSellStage(p):(p.pipelineStage||RECEIVED);
      if(current!==RECEIVED)return;
      const actions=card.querySelector('.pipelinePersonActions');if(!actions)return;

      // At Opportunity Received, a multi-deal source gets exactly one Advance control:
      // the selector that chooses which stored opportunity has initial interest.
      const selectorButtons=[...actions.querySelectorAll('[data-select-initial-interest]')];
      const keep=selectorButtons.shift()||null;
      selectorButtons.forEach(btn=>btn.remove());
      actions.querySelectorAll('.pipelineAdvance').forEach(btn=>{
        if(btn!==keep)btn.remove();
      });

      if(!keep){
        const btn=document.createElement('button');
        btn.type='button';
        btn.className='pipelineAdvance';
        btn.dataset.selectInitialInterest=p.id;
        btn.textContent='Advance →';
        actions.appendChild(btn);
      }
    });
    board.querySelectorAll('.pipelineStage').forEach(stage=>{
      const count=stage.querySelectorAll(':scope > .pipelinePerson').length;
      const counter=stage.querySelector('.pipelineStageCount');if(counter&&counter.textContent!==String(count))counter.textContent=String(count);
      const empty=stage.querySelector(':scope > .pipelineEmpty');
      if(count===0&&!empty)stage.insertAdjacentHTML('beforeend','<div class="pipelineEmpty">No relationships here.</div>');
      else if(count>0&&empty)empty.remove();
    });
  }

  document.addEventListener('click',e=>{
    const trigger=e.target.closest('[data-select-initial-interest]');
    if(!trigger)return;
    e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();openSelection(trigger.dataset.selectInitialInterest);
  },true);

  if(typeof renderPipeline==='function'){
    const baseRenderPipeline=renderPipeline;
    renderPipeline=function(){baseRenderPipeline();applyPipelineGate()};
  }

  if(typeof advancePersonModel==='function'){
    const baseAdvance=advancePersonModel;
    advancePersonModel=async function(id,button){
      const p=person(id);
      const current=p&&(typeof personSellStage==='function'?personSellStage(p):(p.pipelineStage||RECEIVED));
      if(isSource(p)&&current===RECEIVED){openSelection(id);return}
      return baseAdvance(id,button);
    };
  }

  if(typeof revertSourceDeal==='function'){
    revertSourceDeal=async function(id,button){
      if(button?.disabled)return;const o=opportunity(id);if(!o)return;
      const idx=typeof SELL_PIPELINE!=='undefined'?SELL_PIPELINE.indexOf(dealStage(o)):-1;
      const initialIdx=typeof SELL_PIPELINE!=='undefined'?SELL_PIPELINE.indexOf(INITIAL_INTEREST):-1;
      if(idx<initialIdx)return;
      const p=sourcePerson(o);
      if(!confirm(`Revert ${o.company}${p?` from ${p.name}`:''} back to stored Opportunity Received?`))return;
      if(button){button.disabled=true;button.textContent='Reverting...'}
      const {error}=await sb.from('opportunities').update({pipeline_stage:RECEIVED,stage:RECEIVED,pipeline_active:false}).eq('id',id);
      if(error){alert(error.message);if(button){button.disabled=false;button.textContent='Revert'}return}
      await loadData();
    };
  }

  ensureModal();
  applyPipelineGate();
})();
