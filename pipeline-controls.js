function pipelineControlSide(p){
  if(p?.side==='Buy Side') return 'Buy Side';
  if(p?.side==='Sell Side') return 'Sell Side';
  return pipelineSide;
}
function pipelineControlStages(side){return side==='Buy Side'?BUY_PIPELINE:SELL_PIPELINE}
function pipelineRevertTarget(side){return side==='Buy Side'?'NDA Signed + Thesis Captured':'Opportunity Received'}
function canRevertPipeline(p,side,current){
  const stages=pipelineControlStages(side),i=stages.indexOf(current);
  const threshold=side==='Buy Side'?stages.indexOf('Relevant Deal Identified'):stages.indexOf('Initial Interest Identified');
  return i>=threshold&&threshold>=0;
}

renderPipeline=function(){
  const board=$('relationshipPipeline');if(!board)return;
  const stages=pipelineControlStages(pipelineSide),people=peopleForPipeline(pipelineSide);
  board.innerHTML=stages.map(stage=>{
    const ps=people.filter(p=>normalizedStage(p,pipelineSide)===stage);
    return `<section class="pipelineStage"><div class="pipelineStageHead"><div class="pipelineStageName">${esc(stage)}</div><div class="pipelineStageCount">${ps.length}</div></div>${ps.length?ps.map(p=>{
      const task=latestTaskForPerson(p.id),side=pipelineControlSide(p),current=normalizedStage(p,side),stageList=pipelineControlStages(side),idx=stageList.indexOf(current),canAdvance=idx>=0&&idx<stageList.length-1,showRevert=canRevertPipeline(p,side,current);
      return `<article class="pipelinePerson" data-pipeline-person="${p.id}"><div class="pipelinePersonName">${esc(p.name)}</div><div class="pipelinePersonMeta">${esc(p.type||p.side||'Relationship')}</div>${task?`<div class="pipelineNextStep"><div class="pipelineNextStepLabel">NEXT STEP</div><div class="pipelineNextStepText">${esc(task.action)}</div><div class="pipelineNextStepMeta">${esc(task.owner||'Unassigned')}${task.dueDate?` · ${esc(fmtDate(task.dueDate))}`:''}</div></div>`:''}${p.interestDealSize?`<div class="pipelineDetail">Deal size: ${esc(p.interestDealSize)}</div>`:''}${p.interestOpportunity?`<div class="pipelineDetail">Opportunity: ${esc(p.interestOpportunity)}</div>`:''}<div class="pipelinePersonActions pipelineDirectActions">${showRevert?`<button type="button" class="pipelineRevert" data-revert-pipeline="${p.id}">Revert</button>`:''}<button type="button" class="miniAction" data-add-task="${p.id}">+ Next Step</button>${canAdvance?`<button type="button" class="pipelineAdvance" data-advance-pipeline="${p.id}">Advance →</button>`:''}</div></article>`;
    }).join(''):'<div class="pipelineEmpty">No relationships here.</div>'}</section>`;
  }).join('');
  document.querySelectorAll('.pipelineTab').forEach(b=>b.classList.toggle('active',b.dataset.pipelineSide===pipelineSide));
  bindPipelineActions();
}

bindPipelineActions=function(){
  document.querySelectorAll('[data-pipeline-person]').forEach(el=>el.onclick=e=>{
    if(e.target.closest('[data-add-task],[data-advance-pipeline],[data-revert-pipeline]'))return;
    openPipelineModal(el.dataset.pipelinePerson);
  });
  document.querySelectorAll('[data-add-task]').forEach(el=>el.onclick=e=>{e.stopPropagation();openTaskModal(el.dataset.addTask)});
  document.querySelectorAll('[data-advance-pipeline]').forEach(el=>el.onclick=e=>{e.stopPropagation();advancePipelineDirect(el.dataset.advancePipeline,el)});
  document.querySelectorAll('[data-revert-pipeline]').forEach(el=>el.onclick=e=>{e.stopPropagation();revertPipelineDirect(el.dataset.revertPipeline,el)});
}

async function advancePipelineDirect(id,button){
  if(button?.disabled)return;
  const p=person(id);if(!p)return;
  const side=pipelineControlSide(p),stages=pipelineControlStages(side),current=normalizedStage(p,side),i=stages.indexOf(current);
  if(i<0||i>=stages.length-1)return;
  const next=stages[i+1],payload={pipeline_stage:next};
  if(side==='Sell Side'&&next==='Initial Interest Identified'){
    const value=window.prompt(`Which opportunity is receiving initial interest for ${p.name}?`,p.interestOpportunity||'');
    if(value===null)return;
    if(!value.trim()){alert('Add the opportunity receiving interest before moving into Initial Interest Identified.');return}
    payload.interest_opportunity=value.trim();
  }
  if(side==='Buy Side'&&next==='Buyer Interest Confirmed'){
    const value=window.prompt(`What deal size is ${p.name} interested in?`,p.interestDealSize||'');
    if(value===null)return;
    if(!value.trim()){alert('Add the interested deal size before moving into Buyer Interest Confirmed.');return}
    payload.interest_deal_size=value.trim();
  }
  if(button){button.disabled=true;button.textContent='Moving...'}
  const {error}=await sb.from('people').update(payload).eq('id',id);
  if(error){alert(error.message);if(button){button.disabled=false;button.textContent='Advance →'}return}
  await loadData();
}

async function revertPipelineDirect(id,button){
  if(button?.disabled)return;
  const p=person(id);if(!p)return;
  const side=pipelineControlSide(p),current=normalizedStage(p,side);
  if(!canRevertPipeline(p,side,current))return;
  const target=pipelineRevertTarget(side);
  if(!confirm(`Revert ${p.name} from ${current} back to ${target}?`))return;
  const payload={pipeline_stage:target};
  if(side==='Buy Side')payload.interest_deal_size=null;
  if(side==='Sell Side')payload.interest_opportunity=null;
  if(button){button.disabled=true;button.textContent='Reverting...'}
  const {error}=await sb.from('people').update(payload).eq('id',id);
  if(error){alert(error.message);if(button){button.disabled=false;button.textContent='Revert'}return}
  await loadData();
}

(function loadSellSideModel(){
  if(!document.querySelector('link[href="/sell-side-model.css"]')){
    const l=document.createElement('link');l.rel='stylesheet';l.href='/sell-side-model.css';document.head.appendChild(l);
  }
  if(document.querySelector('script[src="/sell-side-model.js"]'))return;
  const s=document.createElement('script');s.src='/sell-side-model.js';s.async=false;s.onload=()=>{
    if(document.readyState!=='loading'){
      if(window.togglePersonSellFields){$('personSideInput').onchange=togglePersonSellFields;$('personSellKindInput').onchange=togglePersonSellFields;$('personForm').onsubmit=savePerson;}
      if(window.toggleSellTypeModalFields){$('sellTypeKindInput').onchange=toggleSellTypeModalFields;$('sellTypeForm').onsubmit=saveSellType;$('closeSellTypeModal').onclick=()=>$('sellTypeModal').classList.add('hidden');$('cancelSellType').onclick=()=>$('sellTypeModal').classList.add('hidden');}
      if(window.saveSourceDeal){$('sourceDealForm').onsubmit=saveSourceDeal;$('closeSourceDealModal').onclick=()=>$('sourceDealModal').classList.add('hidden');$('cancelSourceDeal').onclick=()=>$('sourceDealModal').classList.add('hidden');}
      if(window.savePipeline)$('pipelineForm').onsubmit=savePipeline;
      if(window.currentUser)loadData();
    }
  };document.body.appendChild(s);
})();