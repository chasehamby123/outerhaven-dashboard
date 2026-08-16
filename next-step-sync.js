(function(){
  const style=document.createElement('style');
  style.textContent=`
    .pipelineNextStepTop{display:flex;align-items:center;justify-content:space-between;gap:8px}
    .pipelineNextStep .taskDone{padding:4px 7px;font-size:9px;white-space:nowrap}
    .actionItem .taskDone{margin-top:8px;padding:6px 8px;font-size:10px}
    .nextRow .taskDone,.taskRow .taskDone{white-space:nowrap}
    .dealTaskActions{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
  `;
  document.head.appendChild(style);

  const taskTime=t=>t?.createdAt||'';
  const openTasksForPerson=personId=>(state.tasks||[]).filter(t=>t.personId===personId&&!t.completed).sort((a,b)=>taskTime(b).localeCompare(taskTime(a)));
  const latestRelationshipTask=personId=>openTasksForPerson(personId).find(t=>!t.opportunityId)||null;
  const latestTaskForOpportunity=opportunityId=>(state.tasks||[]).filter(t=>t.opportunityId===opportunityId&&!t.completed).sort((a,b)=>taskTime(b).localeCompare(taskTime(a)))[0]||null;
  const opportunityById=id=>state.opportunities.find(o=>o.id===id)||null;

  latestTaskForPerson=function(personId){
    const p=person(personId),relationship=latestRelationshipTask(personId);
    if(relationship)return relationship;
    if(p?.side==='Buy Side')return openTasksForPerson(personId)[0]||null;
    if(typeof isDirectSponsor==='function'&&isDirectSponsor(p)){
      const o=typeof sponsorOpportunity==='function'?sponsorOpportunity(personId):null;
      return o?latestTaskForOpportunity(o.id):null;
    }
    return null;
  };

  function canonicalTaskForOpportunity(o){
    if(!o)return null;
    const specific=latestTaskForOpportunity(o.id);
    if(specific)return specific;
    if(!o.pipelineActive)return latestRelationshipTask(o.contactId);
    return null;
  }

  taskSnippet=function(task){
    return task?`<div class="pipelineNextStep"><div class="pipelineNextStepTop"><div class="pipelineNextStepLabel">NEXT STEP</div><button type="button" class="taskDone" data-complete-task-card="${task.id}">Mark Done</button></div><div class="pipelineNextStepText">${esc(task.action)}</div><div class="pipelineNextStepMeta">${esc(task.owner||'Unassigned')}${task.dueDate?` · ${esc(fmtDate(task.dueDate))}`:''}</div></div>`:'';
  };

  const priorSourceDealCard=typeof renderSourceDealCard==='function'?renderSourceDealCard:null;
  if(priorSourceDealCard){
    renderSourceDealCard=function(o){
      const p=person(o.contactId),current=sellDealStage(o),idx=SELL_PIPELINE.indexOf(current),canAdvance=idx>=sellOpportunityReceivedIndex()&&idx<SELL_PIPELINE.length-1,showRevert=idx>=sellInitialInterestIndex(),task=latestTaskForOpportunity(o.id);
      return `<article class="pipelinePerson dealPipelineCard" data-pipeline-deal="${o.id}"><div class="dealCardLabel">DEAL VIA ${esc((p?.name||'SELL-SIDE SOURCE').toUpperCase())}</div><div class="dealCardTitle">${esc(o.company)}</div><div class="dealCardSize">${esc(o.size||'Size not specified')}</div>${taskSnippet(task)}<div class="pipelineDealActions dealTaskActions">${showRevert?`<button type="button" class="pipelineRevert" data-revert-deal="${o.id}">Revert</button>`:''}<button type="button" class="miniAction" data-add-deal-task-person="${o.contactId}" data-add-deal-task-opportunity="${o.id}">+ Next Step</button><button type="button" class="dealOpenButton" data-open-deal="${o.id}">Open</button>${canAdvance?`<button type="button" class="pipelineAdvance" data-advance-deal="${o.id}">Advance →</button>`:''}</div></article>`;
    };
  }

  bindPipelineActions=function(){
    document.querySelectorAll('[data-pipeline-person]').forEach(el=>el.onclick=e=>{if(e.target.closest('button'))return;openPipelineModal(el.dataset.pipelinePerson)});
    document.querySelectorAll('[data-add-task]').forEach(el=>el.onclick=e=>{e.stopPropagation();openTaskModal(el.dataset.addTask)});
    document.querySelectorAll('[data-add-deal-task-opportunity]').forEach(el=>el.onclick=e=>{e.stopPropagation();openTaskModal(el.dataset.addDealTaskPerson,el.dataset.addDealTaskOpportunity)});
    document.querySelectorAll('[data-complete-task-card]').forEach(el=>el.onclick=e=>{e.stopPropagation();completeTask(el.dataset.completeTaskCard)});
    document.querySelectorAll('[data-advance-person]').forEach(el=>el.onclick=e=>{e.stopPropagation();advancePersonModel(el.dataset.advancePerson,el)});
    document.querySelectorAll('[data-revert-person]').forEach(el=>el.onclick=e=>{e.stopPropagation();revertPersonModel(el.dataset.revertPerson,el)});
    document.querySelectorAll('[data-add-source-deal]').forEach(el=>el.onclick=e=>{e.stopPropagation();openSourceDealModal(el.dataset.addSourceDeal)});
    document.querySelectorAll('[data-advance-deal]').forEach(el=>el.onclick=e=>{e.stopPropagation();advanceSourceDeal(el.dataset.advanceDeal,el)});
    document.querySelectorAll('[data-revert-deal]').forEach(el=>el.onclick=e=>{e.stopPropagation();revertSourceDeal(el.dataset.revertDeal,el)});
    document.querySelectorAll('[data-open-deal]').forEach(el=>el.onclick=e=>{e.stopPropagation();openDetail(el.dataset.openDeal)});
    document.querySelectorAll('[data-pipeline-deal]').forEach(el=>el.onclick=e=>{if(e.target.closest('button'))return;openDetail(el.dataset.pipelineDeal)});
  };

  const baseRenderPipeline=renderPipeline;
  renderPipeline=function(){baseRenderPipeline();bindPipelineActions()};

  if($('taskForm')&&!$('taskOpportunityId'))$('taskForm').insertAdjacentHTML('afterbegin','<input id="taskOpportunityId" type="hidden">');
  openTaskModal=function(personId,opportunityId=null){
    const p=person(personId);if(!p)return;
    $('taskForm').reset();$('taskPersonId').value=p.id;$('taskOpportunityId').value=opportunityId||'';
    const o=opportunityId?opportunityById(opportunityId):null;
    $('taskModalTitle').textContent=o?`Next Step · ${o.company}`:`Next Step · ${p.name}`;
    $('taskOwnerInput').value=currentUser?.email?.toLowerCase().startsWith('tengku')?'Tengku':'Chase';
    $('taskModal').classList.remove('hidden');
  };
  saveTask=async function(e){
    e.preventDefault();
    const payload={person_id:$('taskPersonId').value,opportunity_id:$('taskOpportunityId')?.value||null,action:$('taskActionInput').value.trim(),owner_name:$('taskOwnerInput').value.trim()||null,due_date:$('taskDueInput').value||null,created_by:currentUser?.id||null};
    const {error}=await sb.from('tasks').insert(payload);if(error){alert(error.message);return}
    $('taskModal').classList.add('hidden');await loadData();
  };
  $('taskForm').onsubmit=saveTask;

  renderNext=function(){
    const tasks=activeTasks();
    $('nextBoard').innerHTML=tasks.length?tasks.map(t=>{const p=person(t.personId),o=t.opportunityId?opportunityById(t.opportunityId):null,stage=p?.side==='Buy Side'?normalizedStage(p,'Buy Side'):(typeof personSellStage==='function'?personSellStage(p):normalizedStage(p,'Sell Side'));return `<article class="taskRow"><div><h3>${esc(p?.name||'Unassigned')}</h3><p>${o?`${esc(o.company)} · ${esc(p?.side||'Opportunity')}`:`${esc(p?.side||'Relationship')} · ${esc(stage||'Pipeline')}`}</p></div><div class="nextMain">${esc(t.action)}</div><div class="nextMeta2"><strong>${esc(t.owner||'Unassigned')}</strong><br>Action owner</div><div class="nextMeta2"><strong>${esc(fmtDate(t.dueDate))}</strong><br>Due date</div><button class="taskDone" data-complete-task="${t.id}" type="button">Mark Done</button></article>`}).join(''):'<div class="panel empty">No next steps.</div>';
    document.querySelectorAll('[data-complete-task]').forEach(b=>b.onclick=()=>completeTask(b.dataset.completeTask));
  };

  renderDashboard=function(){
    renderMetrics();renderPipeline();const d=roleData();
    $('dashOps').innerHTML=d.length?d.slice(0,7).map(o=>{const t=canonicalTaskForOpportunity(o);return `<div class="compactRow"><div><div class="compactTitle">${esc(o.company)}</div><div class="compactMeta">${esc(contactName(o.contactId))} · ${esc(o.side)}</div></div><div class="compactCell">${esc(o.stage)}</div><div class="compactCell">${esc(o.owner||'Unassigned')}</div><div class="compactCell">${esc(t?.action||'No next step')}</div><button class="openLink" data-open="${o.id}">Open</button></div>`}).join(''):'<div class="compactMeta">No opportunities.</div>';
    const actions=activeTasks().slice(0,7);
    $('dashNext').innerHTML=actions.length?actions.map(t=>{const p=person(t.personId),o=t.opportunityId?opportunityById(t.opportunityId):null;return `<div class="actionItem"><div class="actionTop"><div class="actionCompany">${esc(o?.company||p?.name||'Unassigned')}</div><span class="taskTag">${o?'Deal Next Step':'Relationship Next Step'}</span></div><div class="actionCopy">${esc(t.action)}</div><div class="actionMeta">${esc(t.owner||'Unassigned')} · ${esc(fmtDate(t.dueDate))}</div><button class="taskDone" data-complete-dashboard-task="${t.id}" type="button">Mark Done</button></div>`}).join(''):'<div class="compactMeta">No next actions.</div>';
    const mx=Math.max(1,...STAGES.map(s=>d.filter(o=>o.stage===s).length));$('stageSummary').innerHTML=STAGES.map(s=>{const c=d.filter(o=>o.stage===s).length;return `<div class="stageBox"><div class="stageName">${esc(s)}</div><div class="stageCount">${c}</div><div class="stageBar"><div class="stageFill" style="width:${Math.round(c/mx*100)}%"></div></div></div>`}).join('');
    bindOpen();document.querySelectorAll('[data-complete-dashboard-task]').forEach(b=>b.onclick=()=>completeTask(b.dataset.completeDashboardTask));
  };

  renderOps=function(){
    const d=filtered();$('resultCount').textContent=`${d.length} opportunit${d.length===1?'y':'ies'}`;
    $('opCards').innerHTML=d.map(o=>{const t=canonicalTaskForOpportunity(o);return `<article class="opCard" data-open="${o.id}"><div class="cardTop"><div><div class="titleRow">${dot(o.priority)}<div class="cardTitle">${esc(o.company)}</div>${badge(o.side)}${badge(o.stage)}</div><div class="cardSub">${esc(contactName(o.contactId))} · ${esc(o.size||'Size not specified')} · ${esc(o.sector||'Type not specified')}</div></div>${badge(o.priority)}</div><div class="nextBox"><div class="nextLabel">NEXT STEP</div><div class="nextCopy">${esc(t?.action||'No next step assigned')}</div><div class="nextMeta">${esc(t?.owner||o.owner||'Unassigned')} · ${esc(fmtDate(t?.dueDate||''))}</div></div><div class="cardFoot"><span>Owner: ${esc(o.owner||'Unassigned')}</span><span>Updated ${esc(fmtDT(o.updatedAt))}</span></div></article>`}).join('');
    $('opTable').innerHTML=d.map(o=>{const t=canonicalTaskForOpportunity(o);return `<tr><td><strong>${esc(o.company)}</strong></td><td>${esc(contactName(o.contactId))}</td><td>${esc(o.side)}</td><td>${esc(o.stage)}</td><td>${esc(o.owner)}</td><td>${esc(o.size||'—')}</td><td>${esc(t?.action||'—')}</td><td><button class="openLink" data-open="${o.id}">Open</button></td></tr>`}).join('');bindOpen();
  };

  const baseOpenOppModal=openOppModal;
  openOppModal=function(id=null){
    baseOpenOppModal(id);
    if(id){const o=opportunityById(id),t=canonicalTaskForOpportunity(o);$('nextInput').value=t?.action||'';$('nextOwnerInput').value=t?.owner||'';$('dueDateInput').value=t?.dueDate||'';}
  };
  saveOpp=async function(e){
    e.preventDefault();const existingId=$('editId').value||null;
    const payload={person_id:$('contactInput').value||null,title:$('companyInput').value.trim(),side:$('editSide').value,owner_name:$('ownerInput').value.trim(),stage:$('editStage').value,priority:$('priorityInput').value,opportunity_size:$('sizeInput').value.trim(),sector:$('sectorInput').value.trim(),next_step:'',next_step_owner:'',due_date:null,notes:$('notesInput').value.trim(),created_by:currentUser.id};
    let savedId=existingId,res;
    if(existingId){res=await sb.from('opportunities').update(payload).eq('id',existingId);}else{res=await sb.from('opportunities').insert(payload).select('id').single();savedId=res.data?.id||null;}
    if(res.error){alert(res.error.message);return}
    const nextText=$('nextInput').value.trim();
    if(nextText&&savedId){
      const current=existingId?canonicalTaskForOpportunity(opportunityById(existingId)):null;
      const taskPayload={person_id:payload.person_id,opportunity_id:current?.opportunityId||savedId,action:nextText,owner_name:$('nextOwnerInput').value.trim()||payload.owner_name||null,due_date:$('dueDateInput').value||null};
      const taskRes=current?await sb.from('tasks').update(taskPayload).eq('id',current.id):await sb.from('tasks').insert({...taskPayload,created_by:currentUser.id});
      if(taskRes.error){alert(taskRes.error.message);return}
    }
    $('oppModal').classList.add('hidden');closeDetail();await loadData();
  };
  $('oppForm').onsubmit=saveOpp;

  renderAll=function(){
    const role=$('roleFilter').value;if(role==='Buy Side'||role==='Sell Side')pipelineSide=role;
    $('navOps').textContent=roleData().length;$('navNext').textContent=activeTasks().length;$('navPeople').textContent=state.people.filter(p=>role==='All'||p.side===role||p.side==='Both').length;
    populateFilters();renderDashboard();renderOps();renderNext();renderPeople();
  };

  if(typeof currentUser!=='undefined'&&currentUser)loadData();
})();