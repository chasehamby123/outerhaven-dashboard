(function(){
  if(window.__outerhavenPipelineRefinements)return;
  window.__outerhavenPipelineRefinements=true;

  const desiredBuyStages=['New Relationship','Diligence Call Complete','NDA Signed + Thesis Captured','Relevant Deal Identified','Interest Meeting Held','Engagement Active','Buyer Interest Confirmed','Closed'];
  BUY_PIPELINE.splice(0,BUY_PIPELINE.length,...desiredBuyStages);

  const style=document.createElement('style');
  style.textContent=`
    .pipelineProfileAction,.profileRedBtn{
      border:1px solid #efc3c3!important;
      background:#fff1f1!important;
      color:#a32121!important;
      border-radius:999px!important;
      padding:5px 9px!important;
      font-size:10px!important;
      font-weight:750!important;
      cursor:pointer!important;
    }
    .pipelineProfileAction:hover,.profileRedBtn:hover{background:#ffe5e5!important}
    .sourceSelectNote{font-size:11px;color:#737b88;line-height:1.5;margin:0 0 4px}
    .sourceSelectPreview{margin-top:8px;padding:10px 11px;border:1px solid #e5e7eb;border-radius:10px;background:#fafbfc}
    .sourceSelectPreview strong{font-size:12px}.sourceSelectPreview span{display:block;font-size:10px;color:#7a8190;margin-top:3px}
  `;
  document.head.appendChild(style);

  if(!$('sourceAdvanceModal')){
    document.body.insertAdjacentHTML('beforeend',`
      <div id="sourceAdvanceModal" class="modal hidden">
        <div class="modalCard small">
          <div class="modalHead">
            <div><div class="eyebrow">ADVANCE SELL-SIDE OPPORTUNITY</div><h2 id="sourceAdvanceTitle">Select Opportunity</h2></div>
            <button id="closeSourceAdvanceModal" class="iconBtn" type="button">×</button>
          </div>
          <form id="sourceAdvanceForm" class="form">
            <input id="sourceAdvancePersonId" type="hidden">
            <p class="sourceSelectNote">Choose one of the opportunities already stored in this relationship's profile. The source stays in Opportunity Received while the selected deal moves forward.</p>
            <div class="formGrid">
              <label class="span2">Opportunity<select id="sourceAdvanceOpportunity" required></select></label>
            </div>
            <div id="sourceAdvancePreview" class="sourceSelectPreview"></div>
            <div class="modalActions"><button id="cancelSourceAdvance" class="ghost" type="button">Cancel</button><button class="primary" type="submit">Advance Selected Opportunity</button></div>
          </form>
        </div>
      </div>
    `);
  }

  function receivedDeals(personId){
    return (state.opportunities||[]).filter(o=>o.contactId===personId&&o.side==='Sell Side'&&o.pipelineActive&&(o.pipelineStage||o.stage)==='Opportunity Received');
  }
  function updateSourceAdvancePreview(){
    const id=$('sourceAdvanceOpportunity').value;
    const o=(state.opportunities||[]).find(x=>x.id===id);
    $('sourceAdvancePreview').innerHTML=o?`<strong>${esc(o.company)}</strong><span>${esc(o.size||'Size not specified')}</span>`:'<span>Select an opportunity.</span>';
  }
  function openSourceAdvance(personId){
    const p=person(personId);if(!p)return;
    const deals=receivedDeals(personId);
    if(!deals.length){
      if(window.openRelationshipProfile)window.openRelationshipProfile(personId,'profileOpportunitiesSection');
      alert(`Add an opportunity to ${p.name}'s profile before advancing one.`);
      return;
    }
    $('sourceAdvancePersonId').value=personId;
    $('sourceAdvanceTitle').textContent=`Select Opportunity · ${p.name}`;
    $('sourceAdvanceOpportunity').innerHTML=deals.map(o=>`<option value="${o.id}">${esc(o.company)}${o.size?` · ${esc(o.size)}`:''}</option>`).join('');
    updateSourceAdvancePreview();
    $('sourceAdvanceModal').classList.remove('hidden');
  }
  async function advanceSelectedSourceOpportunity(e){
    e.preventDefault();
    const id=$('sourceAdvanceOpportunity').value;
    const o=(state.opportunities||[]).find(x=>x.id===id);
    if(!o)return;
    const submit=e.submitter;if(submit){submit.disabled=true;submit.textContent='Moving...'}
    const {error}=await sb.from('opportunities').update({pipeline_stage:'Initial Interest Identified',stage:'Initial Interest Identified'}).eq('id',id);
    if(error){alert(error.message);if(submit){submit.disabled=false;submit.textContent='Advance Selected Opportunity'}return}
    $('sourceAdvanceModal').classList.add('hidden');
    await loadData();
  }
  $('closeSourceAdvanceModal').onclick=()=>$('sourceAdvanceModal').classList.add('hidden');
  $('cancelSourceAdvance').onclick=()=>$('sourceAdvanceModal').classList.add('hidden');
  $('sourceAdvanceOpportunity').onchange=updateSourceAdvancePreview;
  $('sourceAdvanceForm').onsubmit=advanceSelectedSourceOpportunity;

  togglePipelineFields=function(){
    const side=$('pipelineStageInput').dataset.side,stage=$('pipelineStageInput').value,stages=side==='Buy Side'?BUY_PIPELINE:SELL_PIPELINE,index=stages.indexOf(stage);
    const buyConfirmedIndex=BUY_PIPELINE.indexOf('Buyer Interest Confirmed');
    $('pipelineDealSizeWrap').classList.toggle('hidden',!(side==='Buy Side'&&index>=buyConfirmedIndex&&buyConfirmedIndex>=0));
    $('pipelineOpportunityWrap').classList.toggle('hidden',!(side==='Sell Side'&&index>=SELL_PIPELINE.indexOf('Initial Interest Identified')));
  };

  const baseRenderPipeline=renderPipeline;
  renderPipeline=function(){
    baseRenderPipeline();
    refinePipelineDom();
  };

  function refinePipelineDom(){
    document.querySelectorAll('.pipelinePerson[data-pipeline-person]').forEach(card=>{
      const p=person(card.dataset.pipelinePerson);if(!p)return;
      if(typeof isDirectSponsor==='function'&&isDirectSponsor(p)){
        card.querySelectorAll('[data-open-profile-opportunities]').forEach(b=>b.remove());
      }
    });

    document.querySelectorAll('.sourceCard[data-pipeline-person]').forEach(card=>{
      const p=person(card.dataset.pipelinePerson);if(!p)return;
      const current=typeof personSellStage==='function'?personSellStage(p):p.pipelineStage;
      if(current!=='Opportunity Received')return;
      const actions=card.querySelector('.pipelinePersonActions');if(!actions)return;
      if(!actions.querySelector('[data-advance-source-existing]')){
        const btn=document.createElement('button');
        btn.type='button';btn.className='pipelineAdvance';btn.dataset.advanceSourceExisting=p.id;btn.textContent='Advance →';
        actions.appendChild(btn);
      }
    });

    document.querySelectorAll('.pipelineStage').forEach(section=>{
      const name=section.querySelector('.pipelineStageName')?.textContent?.trim();
      if(name==='Opportunity Received')section.querySelectorAll('.dealPipelineCard [data-advance-deal]').forEach(b=>b.remove());
    });

    document.querySelectorAll('[data-advance-source-existing]').forEach(b=>b.onclick=e=>{e.stopPropagation();openSourceAdvance(b.dataset.advanceSourceExisting)});
  }

  const baseRenderAll=renderAll;
  renderAll=function(){baseRenderAll();refinePipelineDom()};

  refinePipelineDom();
  if(typeof currentUser!=='undefined'&&currentUser)renderAll();
})();