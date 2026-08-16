const baseOpenPersonModalSellModel=openPersonModal;

mapPerson=function(r){return{id:r.id,name:r.name,type:r.relationship_type,side:r.primary_side,thesis:r.thesis||'',hasLinkedIn:r.has_linkedin,notes:r.notes||'',pipelineStage:r.pipeline_stage||'New Relationship',interestDealSize:r.interest_deal_size||'',interestOpportunity:r.interest_opportunity||'',sellSideKind:r.sell_side_kind||'multi_deal'}};
mapOpp=function(r){return{id:r.id,contactId:r.person_id,company:r.title,side:r.side,owner:r.owner_name||'',stage:r.stage,priority:r.priority,size:r.opportunity_size||'',sector:r.sector||'',next:r.next_step||'',nextOwner:r.next_step_owner||'',dueDate:r.due_date||'',notes:r.notes||'',createdAt:r.created_at,updatedAt:r.updated_at,pipelineStage:r.pipeline_stage||'',pipelineActive:!!r.pipeline_active}};

function installSellSideModelUI(){
  const sideInput=$('personSideInput');
  if(sideInput&&!$('personSellKindWrap')){
    const sideLabel=sideInput.closest('label');
    sideLabel.insertAdjacentHTML('afterend',`<label id="personSellKindWrap" class="sellConditional">Sell-Side Profile<select id="personSellKindInput"><option value="multi_deal">Multi-Deal Originator / Sell-Side Partner</option><option value="direct_sponsor">Direct Sponsor / Founder</option></select></label><label id="personSponsorOppWrap" class="sellConditional hidden">Primary Opportunity<input id="personSponsorOppInput" placeholder="Example: Philippines Luxury Resort Raise"></label><label id="personSponsorSizeWrap" class="sellConditional hidden">Raise / Opportunity Size<input id="personSponsorSizeInput" placeholder="$150M"></label>`);
  }
  if(!$('sellTypeModal'))document.body.insertAdjacentHTML('beforeend',`<div id="sellTypeModal" class="modal hidden"><div class="modalCard small"><div class="modalHead"><div><div class="eyebrow">SELL-SIDE PROFILE</div><h2 id="sellTypeModalTitle">Relationship Model</h2></div><button id="closeSellTypeModal" class="iconBtn" type="button">×</button></div><form id="sellTypeForm" class="form"><input id="sellTypePersonId" type="hidden"><div class="formGrid"><label class="span2">Relationship Model<select id="sellTypeKindInput"><option value="multi_deal">Multi-Deal Originator / Sell-Side Partner</option><option value="direct_sponsor">Direct Sponsor / Founder</option></select></label><label id="sellTypeOppWrap" class="span2 sellConditional hidden">Single Opportunity<input id="sellTypeOppInput" placeholder="Opportunity name"></label><label id="sellTypeSizeWrap" class="span2 sellConditional hidden">Raise / Opportunity Size<input id="sellTypeSizeInput" placeholder="$150M"></label></div><p id="sellTypeExplain" class="typeExplain"></p><div class="modalActions"><button id="cancelSellType" type="button" class="ghost">Cancel</button><button class="primary" type="submit">Save Profile Type</button></div></form></div></div>`);
  if(!$('sourceDealModal'))document.body.insertAdjacentHTML('beforeend',`<div id="sourceDealModal" class="modal hidden"><div class="modalCard small"><div class="modalHead"><div><div class="eyebrow">NEW SELL-SIDE OPPORTUNITY</div><h2 id="sourceDealModalTitle">Add Opportunity</h2></div><button id="closeSourceDealModal" class="iconBtn" type="button">×</button></div><form id="sourceDealForm" class="form"><input id="sourceDealPersonId" type="hidden"><div class="formGrid"><label class="span2">Sell-Side Source<input id="sourceDealPersonName" class="readonlySource" readonly></label><label class="span2">Opportunity<input id="sourceDealName" required placeholder="Company, project, or raise"></label><label class="span2">Raise / Opportunity Size<input id="sourceDealSize" required placeholder="$25M, $100M, etc."></label></div><p class="typeExplain">The source relationship stays in Opportunity Received. This deal gets its own card and can move through the pipeline independently.</p><div class="modalActions"><button id="cancelSourceDeal" type="button" class="ghost">Cancel</button><button class="primary" type="submit">Add Opportunity</button></div></form></div></div>`);
}
installSellSideModelUI();

function isSellSidePerson(p){return p&&(p.side==='Sell Side'||p.side==='Both')}
function isDirectSponsor(p){return isSellSidePerson(p)&&p.sellSideKind==='direct_sponsor'}
function isMultiDealSource(p){return isSellSidePerson(p)&&p.sellSideKind!=='direct_sponsor'}
function sellOpportunityReceivedIndex(){return SELL_PIPELINE.indexOf('Opportunity Received')}
function sellInitialInterestIndex(){return SELL_PIPELINE.indexOf('Initial Interest Identified')}
function personSellStage(p){
  const raw=normalizedStage(p,'Sell Side'),idx=SELL_PIPELINE.indexOf(raw);
  if(isMultiDealSource(p)&&idx>sellOpportunityReceivedIndex())return 'Opportunity Received';
  return raw;
}
function sponsorOpportunity(personId){
  return state.opportunities.find(o=>o.contactId===personId&&o.side==='Sell Side'&&o.pipelineActive)||state.opportunities.find(o=>o.contactId===personId&&o.side==='Sell Side')||null;
}
function sourceDeals(personId){return state.opportunities.filter(o=>o.contactId===personId&&o.side==='Sell Side'&&o.pipelineActive)}
function sellDealStage(o){return SELL_PIPELINE.includes(o.pipelineStage)?o.pipelineStage:'Opportunity Received'}
function latestPersonTask(personId){return latestTaskForPerson(personId)}
function userOwnerName(){return currentUser?.email?.toLowerCase().startsWith('tengku')?'Tengku':'Chase'}
function taskSnippet(task){return task?`<div class="pipelineNextStep"><div class="pipelineNextStepLabel">NEXT STEP</div><div class="pipelineNextStepText">${esc(task.action)}</div><div class="pipelineNextStepMeta">${esc(task.owner||'Unassigned')}${task.dueDate?` · ${esc(fmtDate(task.dueDate))}`:''}</div></div>`:''}

function renderBuyPipelineCard(p){
  const current=normalizedStage(p,'Buy Side'),stages=BUY_PIPELINE,idx=stages.indexOf(current),task=latestPersonTask(p.id),canAdvance=idx>=0&&idx<stages.length-1,showRevert=idx>=stages.indexOf('Relevant Deal Identified');
  return `<article class="pipelinePerson" data-pipeline-person="${p.id}"><div class="pipelinePersonName">${esc(p.name)}</div><div class="pipelinePersonMeta">${esc(p.type||'Buy-Side Relationship')}</div>${taskSnippet(task)}${p.interestDealSize?`<div class="pipelineDetail">Interested deal size: ${esc(p.interestDealSize)}</div>`:''}<div class="pipelinePersonActions pipelineDirectActions">${showRevert?`<button type="button" class="pipelineRevert" data-revert-person="${p.id}">Revert</button>`:''}<button type="button" class="miniAction" data-add-task="${p.id}">+ Next Step</button>${canAdvance?`<button type="button" class="pipelineAdvance" data-advance-person="${p.id}">Advance →</button>`:''}</div></article>`;
}
function renderSponsorCard(p){
  const current=personSellStage(p),idx=SELL_PIPELINE.indexOf(current),opp=sponsorOpportunity(p.id),task=latestPersonTask(p.id),canAdvance=idx>=0&&idx<SELL_PIPELINE.length-1,showRevert=idx>=sellInitialInterestIndex();
  return `<article class="pipelinePerson" data-pipeline-person="${p.id}"><div class="pipelinePersonName">${esc(p.name)}</div><div class="pipelinePersonMeta">${esc(p.type||'Direct Sponsor / Founder')}</div><span class="modelBadge">Direct Sponsor / Founder</span>${opp?`<div class="sponsorOpportunityBox"><div class="sponsorOpportunityLabel">SINGLE OPPORTUNITY</div><div class="sponsorOpportunityName">${esc(opp.company)}</div><div class="sponsorOpportunitySize">${esc(opp.size||'Size not specified')}</div></div>`:'<div class="pipelineDetail">Single opportunity not set.</div>'}${taskSnippet(task)}<div class="pipelinePersonActions pipelineDirectActions">${showRevert?`<button type="button" class="pipelineRevert" data-revert-person="${p.id}">Revert</button>`:''}<button type="button" class="miniAction" data-add-task="${p.id}">+ Next Step</button>${canAdvance?`<button type="button" class="pipelineAdvance" data-advance-person="${p.id}">Advance →</button>`:''}</div></article>`;
}
function renderSourceContactCard(p){
  const current=personSellStage(p),idx=SELL_PIPELINE.indexOf(current),task=latestPersonTask(p.id),deals=sourceDeals(p.id),atReceived=current==='Opportunity Received';
  return `<article class="pipelinePerson sourceCard" data-pipeline-person="${p.id}"><div class="pipelinePersonName">${esc(p.name)}</div><div class="pipelinePersonMeta">${esc(p.type||'Sell-Side Partner')}</div><span class="modelBadge">Multi-Deal Source</span>${taskSnippet(task)}${atReceived?`<div class="sourceDealCount">${deals.length} tracked opportunit${deals.length===1?'y':'ies'} from this source</div>`:''}<div class="pipelinePersonActions pipelineDirectActions"><button type="button" class="miniAction" data-add-task="${p.id}">+ Next Step</button>${atReceived?`<button type="button" class="pipelineAddDeal" data-add-source-deal="${p.id}">+ Add Opportunity</button>`:idx>=0&&idx<sellOpportunityReceivedIndex()?`<button type="button" class="pipelineAdvance" data-advance-person="${p.id}">Advance →</button>`:''}</div></article>`;
}
function renderSourceDealCard(o){
  const p=person(o.contactId),current=sellDealStage(o),idx=SELL_PIPELINE.indexOf(current),canAdvance=idx>=sellOpportunityReceivedIndex()&&idx<SELL_PIPELINE.length-1,showRevert=idx>=sellInitialInterestIndex();
  return `<article class="pipelinePerson dealPipelineCard" data-pipeline-deal="${o.id}"><div class="dealCardLabel">DEAL VIA ${esc((p?.name||'SELL-SIDE SOURCE').toUpperCase())}</div><div class="dealCardTitle">${esc(o.company)}</div><div class="dealCardSize">${esc(o.size||'Size not specified')}</div><div class="pipelineDealActions">${showRevert?`<button type="button" class="pipelineRevert" data-revert-deal="${o.id}">Revert</button>`:''}<button type="button" class="dealOpenButton" data-open-deal="${o.id}">Open</button>${canAdvance?`<button type="button" class="pipelineAdvance" data-advance-deal="${o.id}">Advance →</button>`:''}</div></article>`;
}

renderPipeline=function(){
  const board=$('relationshipPipeline');if(!board)return;
  const stages=pipelineSide==='Buy Side'?BUY_PIPELINE:SELL_PIPELINE;
  if(pipelineSide==='Buy Side'){
    const people=peopleForPipeline('Buy Side');
    board.innerHTML=stages.map(stage=>{const ps=people.filter(p=>normalizedStage(p,'Buy Side')===stage);return `<section class="pipelineStage"><div class="pipelineStageHead"><div class="pipelineStageName">${esc(stage)}</div><div class="pipelineStageCount">${ps.length}</div></div>${ps.length?ps.map(renderBuyPipelineCard).join(''):'<div class="pipelineEmpty">No relationships here.</div>'}</section>`}).join('');
  }else{
    const people=peopleForPipeline('Sell Side'),direct=people.filter(isDirectSponsor),sources=people.filter(isMultiDealSource),allDeals=state.opportunities.filter(o=>o.side==='Sell Side'&&o.pipelineActive&&isMultiDealSource(person(o.contactId)));
    board.innerHTML=stages.map(stage=>{
      const sponsorCards=direct.filter(p=>personSellStage(p)===stage).map(renderSponsorCard);
      const sourceCards=sources.filter(p=>personSellStage(p)===stage).map(renderSourceContactCard);
      const dealCards=allDeals.filter(o=>sellDealStage(o)===stage).map(renderSourceDealCard);
      const cards=[...sourceCards,...sponsorCards,...dealCards];
      return `<section class="pipelineStage"><div class="pipelineStageHead"><div class="pipelineStageName">${esc(stage)}</div><div class="pipelineStageCount">${cards.length}</div></div>${cards.length?cards.join(''):'<div class="pipelineEmpty">No relationships here.</div>'}</section>`;
    }).join('');
  }
  document.querySelectorAll('.pipelineTab').forEach(b=>b.classList.toggle('active',b.dataset.pipelineSide===pipelineSide));
  bindPipelineActions();
}

bindPipelineActions=function(){
  document.querySelectorAll('[data-pipeline-person]').forEach(el=>el.onclick=e=>{if(e.target.closest('button'))return;openPipelineModal(el.dataset.pipelinePerson)});
  document.querySelectorAll('[data-add-task]').forEach(el=>el.onclick=e=>{e.stopPropagation();openTaskModal(el.dataset.addTask)});
  document.querySelectorAll('[data-advance-person]').forEach(el=>el.onclick=e=>{e.stopPropagation();advancePersonModel(el.dataset.advancePerson,el)});
  document.querySelectorAll('[data-revert-person]').forEach(el=>el.onclick=e=>{e.stopPropagation();revertPersonModel(el.dataset.revertPerson,el)});
  document.querySelectorAll('[data-add-source-deal]').forEach(el=>el.onclick=e=>{e.stopPropagation();openSourceDealModal(el.dataset.addSourceDeal)});
  document.querySelectorAll('[data-advance-deal]').forEach(el=>el.onclick=e=>{e.stopPropagation();advanceSourceDeal(el.dataset.advanceDeal,el)});
  document.querySelectorAll('[data-revert-deal]').forEach(el=>el.onclick=e=>{e.stopPropagation();revertSourceDeal(el.dataset.revertDeal,el)});
  document.querySelectorAll('[data-open-deal]').forEach(el=>el.onclick=e=>{e.stopPropagation();openDetail(el.dataset.openDeal)});
  document.querySelectorAll('[data-pipeline-deal]').forEach(el=>el.onclick=e=>{if(e.target.closest('button'))return;openDetail(el.dataset.pipelineDeal)});
}

async function advancePersonModel(id,button){
  if(button?.disabled)return;const p=person(id);if(!p)return;
  if(p.side==='Buy Side'){
    const current=normalizedStage(p,'Buy Side'),i=BUY_PIPELINE.indexOf(current);if(i<0||i>=BUY_PIPELINE.length-1)return;const next=BUY_PIPELINE[i+1],payload={pipeline_stage:next};
    if(next==='Buyer Interest Confirmed'){const value=window.prompt(`What deal size is ${p.name} interested in?`,p.interestDealSize||'');if(value===null)return;if(!value.trim()){alert('Add the interested deal size before moving into Buyer Interest Confirmed.');return}payload.interest_deal_size=value.trim()}
    if(button){button.disabled=true;button.textContent='Moving...'}const {error}=await sb.from('people').update(payload).eq('id',id);if(error){alert(error.message);return}await loadData();return;
  }
  if(isMultiDealSource(p)){
    const current=personSellStage(p),i=SELL_PIPELINE.indexOf(current);if(current==='Opportunity Received'){openSourceDealModal(id);return}if(i<0||i>=sellOpportunityReceivedIndex())return;
    if(button){button.disabled=true;button.textContent='Moving...'}const {error}=await sb.from('people').update({pipeline_stage:SELL_PIPELINE[i+1]}).eq('id',id);if(error){alert(error.message);return}await loadData();return;
  }
  const current=personSellStage(p),i=SELL_PIPELINE.indexOf(current);if(i<0||i>=SELL_PIPELINE.length-1)return;const next=SELL_PIPELINE[i+1];
  if(button){button.disabled=true;button.textContent='Moving...'}const {error}=await sb.from('people').update({pipeline_stage:next,interest_opportunity:null}).eq('id',id);if(error){alert(error.message);return}const opp=sponsorOpportunity(id);if(opp)await sb.from('opportunities').update({pipeline_stage:next,pipeline_active:true}).eq('id',opp.id);await loadData();
}
async function revertPersonModel(id,button){
  if(button?.disabled)return;const p=person(id);if(!p)return;
  if(p.side==='Buy Side'){
    const current=normalizedStage(p,'Buy Side'),idx=BUY_PIPELINE.indexOf(current);if(idx<BUY_PIPELINE.indexOf('Relevant Deal Identified'))return;if(!confirm(`Revert ${p.name} back to NDA Signed + Thesis Captured?`))return;if(button){button.disabled=true;button.textContent='Reverting...'}const {error}=await sb.from('people').update({pipeline_stage:'NDA Signed + Thesis Captured',interest_deal_size:null}).eq('id',id);if(error){alert(error.message);return}await loadData();return;
  }
  if(!isDirectSponsor(p))return;const current=personSellStage(p),idx=SELL_PIPELINE.indexOf(current);if(idx<sellInitialInterestIndex())return;if(!confirm(`Revert ${p.name} back to Opportunity Received?`))return;if(button){button.disabled=true;button.textContent='Reverting...'}const {error}=await sb.from('people').update({pipeline_stage:'Opportunity Received',interest_opportunity:null}).eq('id',id);if(error){alert(error.message);return}const opp=sponsorOpportunity(id);if(opp)await sb.from('opportunities').update({pipeline_stage:'Opportunity Received',pipeline_active:true}).eq('id',opp.id);await loadData();
}
async function advanceSourceDeal(id,button){
  if(button?.disabled)return;const o=state.opportunities.find(x=>x.id===id);if(!o)return;const current=sellDealStage(o),i=SELL_PIPELINE.indexOf(current);if(i<sellOpportunityReceivedIndex()||i>=SELL_PIPELINE.length-1)return;const next=SELL_PIPELINE[i+1];if(button){button.disabled=true;button.textContent='Moving...'}const {error}=await sb.from('opportunities').update({pipeline_stage:next,pipeline_active:true}).eq('id',id);if(error){alert(error.message);return}await loadData();
}
async function revertSourceDeal(id,button){
  if(button?.disabled)return;const o=state.opportunities.find(x=>x.id===id);if(!o)return;const current=sellDealStage(o),i=SELL_PIPELINE.indexOf(current);if(i<sellInitialInterestIndex())return;const p=person(o.contactId);if(!confirm(`Revert ${o.company}${p?` from ${p.name}`:''} back to Opportunity Received?`))return;if(button){button.disabled=true;button.textContent='Reverting...'}const {error}=await sb.from('opportunities').update({pipeline_stage:'Opportunity Received',pipeline_active:true}).eq('id',id);if(error){alert(error.message);return}await loadData();
}

function openSourceDealModal(personId){const p=person(personId);if(!p)return;$('sourceDealForm').reset();$('sourceDealPersonId').value=p.id;$('sourceDealPersonName').value=p.name;$('sourceDealModalTitle').textContent=`Add Opportunity · ${p.name}`;$('sourceDealModal').classList.remove('hidden')}
async function saveSourceDeal(e){e.preventDefault();const personId=$('sourceDealPersonId').value,p=person(personId),name=$('sourceDealName').value.trim(),size=$('sourceDealSize').value.trim();if(!p||!name||!size)return;const payload={person_id:personId,title:name,side:'Sell Side',owner_name:userOwnerName(),stage:'New',priority:'Medium',opportunity_size:size,sector:'',next_step:'',next_step_owner:userOwnerName(),notes:`Sourced by ${p.name}`,pipeline_stage:'Opportunity Received',pipeline_active:true,created_by:currentUser?.id||null};const {error}=await sb.from('opportunities').insert(payload);if(error){alert(error.message);return}$('sourceDealModal').classList.add('hidden');await loadData()}

function toggleSellTypeModalFields(){const direct=$('sellTypeKindInput').value==='direct_sponsor';$('sellTypeOppWrap').classList.toggle('hidden',!direct);$('sellTypeSizeWrap').classList.toggle('hidden',!direct);$('sellTypeExplain').textContent=direct?'This person has one primary raise or transaction. Their single opportunity moves with them through the sell-side pipeline.':'This person can source multiple deals. Once they reach Opportunity Received, their relationship stays there while each deal moves independently.'}
function openSellTypeModal(id){const p=person(id);if(!p)return;const opp=sponsorOpportunity(id);$('sellTypePersonId').value=id;$('sellTypeModalTitle').textContent=`Sell-Side Profile · ${p.name}`;$('sellTypeKindInput').value=p.sellSideKind||'multi_deal';$('sellTypeOppInput').value=isDirectSponsor(p)&&opp?opp.company:'';$('sellTypeSizeInput').value=isDirectSponsor(p)&&opp?opp.size:'';toggleSellTypeModalFields();$('sellTypeModal').classList.remove('hidden')}
async function saveSellType(e){e.preventDefault();const id=$('sellTypePersonId').value,p=person(id);if(!p)return;const kind=$('sellTypeKindInput').value;let stage=personSellStage(p);if(kind==='multi_deal'&&SELL_PIPELINE.indexOf(stage)>sellOpportunityReceivedIndex())stage='Opportunity Received';if(kind==='direct_sponsor'){const name=$('sellTypeOppInput').value.trim(),size=$('sellTypeSizeInput').value.trim();if(!name||!size){alert('A direct sponsor or founder needs one opportunity and its size.');return}let opp=sponsorOpportunity(id);if(opp){const {error}=await sb.from('opportunities').update({title:name,opportunity_size:size,pipeline_active:true,pipeline_stage:stage}).eq('id',opp.id);if(error){alert(error.message);return}for(const extra of state.opportunities.filter(o=>o.contactId===id&&o.id!==opp.id&&o.pipelineActive))await sb.from('opportunities').update({pipeline_active:false}).eq('id',extra.id)}else{const {error}=await sb.from('opportunities').insert({person_id:id,title:name,side:'Sell Side',owner_name:userOwnerName(),stage:'New',priority:'Medium',opportunity_size:size,sector:'',pipeline_stage:stage,pipeline_active:true,created_by:currentUser?.id||null});if(error){alert(error.message);return}}}
  const {error}=await sb.from('people').update({sell_side_kind:kind,pipeline_stage:stage}).eq('id',id);if(error){alert(error.message);return}$('sellTypeModal').classList.add('hidden');await loadData()}

function togglePersonSellFields(){const side=$('personSideInput').value,show=side==='Sell Side'||side==='Both',direct=$('personSellKindInput').value==='direct_sponsor';$('personSellKindWrap').classList.toggle('hidden',!show);$('personSponsorOppWrap').classList.toggle('hidden',!(show&&direct));$('personSponsorSizeWrap').classList.toggle('hidden',!(show&&direct))}
openPersonModal=function(id=null){baseOpenPersonModalSellModel(id);const p=id?person(id):null,opp=p?sponsorOpportunity(p.id):null;$('personSellKindInput').value=p?.sellSideKind||'multi_deal';$('personSponsorOppInput').value=isDirectSponsor(p)&&opp?opp.company:'';$('personSponsorSizeInput').value=isDirectSponsor(p)&&opp?opp.size:'';togglePersonSellFields()}
savePerson=async function(e){
  e.preventDefault();const id=$('personEditId').value||null,side=$('personSideInput').value,kind=(side==='Sell Side'||side==='Both')?$('personSellKindInput').value:'multi_deal',direct=kind==='direct_sponsor'&&(side==='Sell Side'||side==='Both'),oppName=$('personSponsorOppInput').value.trim(),oppSize=$('personSponsorSizeInput').value.trim();if(direct&&(!oppName||!oppSize)){alert('A direct sponsor or founder needs an opportunity name and opportunity size.');return}
  const payload={name:$('personNameInput').value.trim(),relationship_type:$('personTypeInput').value.trim(),primary_side:side,has_linkedin:$('personLinkedInInput').value==='true',thesis:$('personThesisInput').value.trim(),notes:$('personNotesInput').value.trim(),sell_side_kind:kind,created_by:currentUser.id};let personId=id;
  if(id){const {error}=await sb.from('people').update(payload).eq('id',id);if(error){alert(error.message);return}}else{const {data,error}=await sb.from('people').insert(payload).select().single();if(error){alert(error.message);return}personId=data.id}
  if(direct){let opp=id?sponsorOpportunity(id):null;const stage=id?personSellStage(person(id)):'New Relationship';if(opp){const {error}=await sb.from('opportunities').update({title:oppName,opportunity_size:oppSize,pipeline_active:true,pipeline_stage:stage}).eq('id',opp.id);if(error){alert(error.message);return}}else{const {error}=await sb.from('opportunities').insert({person_id:personId,title:oppName,side:'Sell Side',owner_name:userOwnerName(),stage:'New',priority:'Medium',opportunity_size:oppSize,sector:'',pipeline_stage:stage,pipeline_active:true,created_by:currentUser.id});if(error){alert(error.message);return}}}
  $('personModal').classList.add('hidden');await loadData();
}

const priorOpenPipelineModalSellModel=openPipelineModal;
openPipelineModal=function(id){const p=person(id);priorOpenPipelineModalSellModel(id);if(!p)return;if(isMultiDealSource(p)){$('pipelineStageInput').innerHTML=SELL_PIPELINE.slice(0,sellOpportunityReceivedIndex()+1).map(s=>`<option value="${esc(s)}">${esc(s)}</option>`).join('');$('pipelineStageInput').value=personSellStage(p);$('pipelineCurrentStage').textContent=personSellStage(p)}togglePipelineFields()}
togglePipelineFields=function(){const side=$('pipelineStageInput').dataset.side,stage=$('pipelineStageInput').value;if(side==='Buy Side'){const idx=BUY_PIPELINE.indexOf(stage);$('pipelineDealSizeWrap').classList.toggle('hidden',idx<BUY_PIPELINE.indexOf('Buyer Interest Confirmed'));$('pipelineOpportunityWrap').classList.add('hidden')}else{$('pipelineDealSizeWrap').classList.add('hidden');$('pipelineOpportunityWrap').classList.add('hidden')}}
savePipeline=async function(e){e.preventDefault();const id=$('pipelinePersonId').value,p=person(id);if(!p)return;let stage=$('pipelineStageInput').value;if(isMultiDealSource(p)&&SELL_PIPELINE.indexOf(stage)>sellOpportunityReceivedIndex())stage='Opportunity Received';const payload={pipeline_stage:stage};if(p.side==='Buy Side')payload.interest_deal_size=$('pipelineDealSizeInput').value.trim()||null;const {error}=await sb.from('people').update(payload).eq('id',id);if(error){alert(error.message);return}if(isDirectSponsor(p)){const opp=sponsorOpportunity(id);if(opp)await sb.from('opportunities').update({pipeline_stage:stage,pipeline_active:true}).eq('id',opp.id)}$('pipelineModal').classList.add('hidden');await loadData()}

renderPeople=function(){
  const role=$('roleFilter').value,people=state.people.filter(p=>role==='All'||p.side===role||p.side==='Both');
  $('peopleGrid').innerHTML=people.map(p=>{const task=latestPersonTask(p.id),allOps=state.opportunities.filter(o=>o.contactId===p.id),stage=p.side==='Buy Side'?normalizedStage(p,'Buy Side'):personSellStage(p),sell=isSellSidePerson(p),direct=isDirectSponsor(p),sponsor=direct?sponsorOpportunity(p.id):null,deals=isMultiDealSource(p)?sourceDeals(p.id):[];let modelHtml='';if(sell&&direct)modelHtml=`<div class="profileModelSummary"><div class="label">SELL-SIDE MODEL</div><div class="value">Direct Sponsor / Founder</div><div class="sub">${sponsor?`${esc(sponsor.company)} · ${esc(sponsor.size||'Size not specified')}`:'Single opportunity not set'}</div></div>`;else if(sell)modelHtml=`<div class="profileModelSummary"><div class="label">SELL-SIDE MODEL</div><div class="value">Multi-Deal Originator</div><div class="sub">${deals.length} active pipeline opportunit${deals.length===1?'y':'ies'}</div></div>${deals.length?`<div class="profileDealList">${deals.map(o=>`<div class="profileDealItem"><div><strong>${esc(o.company)}</strong><br><span>${esc(o.size||'Size not specified')} · ${esc(sellDealStage(o))}</span></div><button class="openLink" data-open="${o.id}">Open</button></div>`).join('')}</div>`:''}`;const interestHtml=p.side==='Buy Side'&&p.interestDealSize?`<div class="personSection"><label>INTERESTED DEAL SIZE</label><div class="nextBox"><div class="nextCopy">${esc(p.interestDealSize)}</div></div></div>`:'';const opHtml=!sell?`<div class="personOps">${allOps.length?allOps.map(o=>`<div class="miniOp"><div><strong>${esc(o.company)}</strong><br><span>${esc(o.stage)}</span></div><button class="openLink" data-open="${o.id}">Open</button></div>`).join(''):'<div class="compactMeta">No opportunities attached yet.</div>'}</div>`:'';
    return `<article class="personCard"><div class="personTop"><div><div class="personName">${esc(p.name)}</div><div class="cardSub">${esc(p.type||'Relationship not specified')} · ${esc(p.side||'')}</div><div class="personStage">${esc(stage)}</div></div><label class="linkedinCheck"><input type="checkbox" data-linkedin="${p.id}" ${p.hasLinkedIn?'checked':''}> LinkedIn access</label></div>${modelHtml}${task?`<div class="personSection"><label>CURRENT NEXT STEP</label><div class="nextBox"><div class="nextCopy">${esc(task.action)}</div></div></div>`:''}${interestHtml}<div class="personSection"><label>THESIS</label><textarea data-thesis="${p.id}">${esc(p.thesis)}</textarea></div>${opHtml}<div class="personButtons"><button class="ghost" type="button" data-update-pipeline="${p.id}">Update Pipeline</button><button class="ghost" type="button" data-add-task="${p.id}">+ Next Step</button>${sell?`<button class="modelButton" type="button" data-change-sell-type="${p.id}">${direct?'Direct Sponsor':'Multi-Deal Source'}</button>`:''}<button class="ghost" type="button" data-edit-person="${p.id}">Edit Person</button></div></article>`}).join('');
  document.querySelectorAll('[data-linkedin]').forEach(x=>x.onchange=async()=>{await sb.from('people').update({has_linkedin:x.checked}).eq('id',x.dataset.linkedin);await loadData()});document.querySelectorAll('[data-thesis]').forEach(x=>x.onchange=async()=>{await sb.from('people').update({thesis:x.value}).eq('id',x.dataset.thesis)});document.querySelectorAll('[data-edit-person]').forEach(x=>x.onclick=()=>openPersonModal(x.dataset.editPerson));document.querySelectorAll('[data-update-pipeline]').forEach(x=>x.onclick=()=>openPipelineModal(x.dataset.updatePipeline));document.querySelectorAll('[data-add-task]').forEach(x=>x.onclick=e=>{e.stopPropagation();openTaskModal(x.dataset.addTask)});document.querySelectorAll('[data-change-sell-type]').forEach(x=>x.onclick=()=>openSellTypeModal(x.dataset.changeSellType));bindOpen();
}

document.addEventListener('DOMContentLoaded',()=>{
  $('personSideInput').addEventListener('change',togglePersonSellFields);$('personSellKindInput').addEventListener('change',togglePersonSellFields);$('personForm').onsubmit=savePerson;
  $('sellTypeKindInput').addEventListener('change',toggleSellTypeModalFields);$('sellTypeForm').onsubmit=saveSellType;$('closeSellTypeModal').onclick=()=>$('sellTypeModal').classList.add('hidden');$('cancelSellType').onclick=()=>$('sellTypeModal').classList.add('hidden');
  $('sourceDealForm').onsubmit=saveSourceDeal;$('closeSourceDealModal').onclick=()=>$('sourceDealModal').classList.add('hidden');$('cancelSourceDeal').onclick=()=>$('sourceDealModal').classList.add('hidden');
  $('pipelineForm').onsubmit=savePipeline;
});