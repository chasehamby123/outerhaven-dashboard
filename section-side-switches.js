(function(){
  if(window.__outerhavenSectionSideSwitches)return;
  window.__outerhavenSectionSideSwitches=true;

  const style=document.createElement('style');
  style.textContent=`
    .sectionSideToolbar{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-bottom:18px;padding:12px 14px;background:#fff;border:1px solid #e7e9ee;border-radius:12px}
    .sectionSideToolbarLabel{font-size:11px;font-weight:800;letter-spacing:.08em;color:#7a8190}
    .sectionSideTabs{display:flex;gap:4px;padding:4px;background:#f3f4f7;border-radius:10px}
    .sectionSideTab{border:0;background:transparent;color:#687080;padding:8px 14px;border-radius:8px;font-size:12px;font-weight:750;cursor:pointer}
    .sectionSideTab.active{background:#111827;color:#fff;box-shadow:0 1px 3px rgba(0,0,0,.12)}
    .sectionSideEmpty{padding:28px;text-align:center;color:#7b8290;background:#fff;border:1px solid #e7e9ee;border-radius:12px}
  `;
  document.head.appendChild(style);

  const stored=localStorage.getItem('outerhaven-section-side');
  const roleValue=$('roleFilter')?.value;
  let sectionSide=stored==='Buy Side'||stored==='Sell Side'?stored:(roleValue==='Buy Side'||roleValue==='Sell Side'?roleValue:'Sell Side');

  function personMatchesSide(p,side){return !!p&&(p.side===side||p.side==='Both')}
  function opportunityStage(o){return o?.pipelineStage||o?.stage||'New'}
  function sideOpportunities(){return state.opportunities.filter(o=>o.side===sectionSide)}
  function sidePeople(){return state.people.filter(p=>personMatchesSide(p,sectionSide))}
  function sideTasks(){
    return (state.tasks||[]).filter(t=>!t.completed&&personMatchesSide(person(t.personId),sectionSide)).sort((a,b)=>{
      if(a.dueDate&&!b.dueDate)return-1;
      if(!a.dueDate&&b.dueDate)return 1;
      if(a.dueDate&&b.dueDate)return a.dueDate.localeCompare(b.dueDate);
      return (b.createdAt||'').localeCompare(a.createdAt||'');
    });
  }
  function latestOpportunityTask(id){return (state.tasks||[]).filter(t=>!t.completed&&t.opportunityId===id).sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''))[0]||null}
  function latestRelationshipTask(personId){return (state.tasks||[]).filter(t=>!t.completed&&t.personId===personId&&!t.opportunityId).sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''))[0]||null}
  function taskForOpportunity(o){return latestOpportunityTask(o.id)||latestRelationshipTask(o.contactId)||null}

  function toolbarHtml(){return `<div class="sectionSideToolbar"><div class="sectionSideToolbarLabel">PIPELINE SIDE</div><div class="sectionSideTabs"><button type="button" class="sectionSideTab" data-section-side="Buy Side">Buy Side</button><button type="button" class="sectionSideTab" data-section-side="Sell Side">Sell Side</button></div></div>`}
  function installToolbars(){
    ['dashboardView','opportunitiesView','nextstepsView','peopleView'].forEach(id=>{const view=$(id);if(view&&!view.querySelector('.sectionSideToolbar'))view.insertAdjacentHTML('afterbegin',toolbarHtml())});
    const sideSelect=$('sideFilter');if(sideSelect?.closest('label'))sideSelect.closest('label').style.display='none';
    bindSideButtons();syncSideButtons();
  }
  function bindSideButtons(){document.querySelectorAll('[data-section-side]').forEach(btn=>btn.onclick=()=>setSectionSide(btn.dataset.sectionSide))}
  function syncSideButtons(){document.querySelectorAll('[data-section-side]').forEach(btn=>btn.classList.toggle('active',btn.dataset.sectionSide===sectionSide))}
  function updateNavCounts(){
    if($('navOps'))$('navOps').textContent=sideOpportunities().length;
    if($('navNext'))$('navNext').textContent=sideTasks().length;
    if($('navPeople'))$('navPeople').textContent=sidePeople().length;
  }
  function setSectionSide(side){
    if(side!=='Buy Side'&&side!=='Sell Side')return;
    sectionSide=side;
    localStorage.setItem('outerhaven-section-side',side);
    if(typeof pipelineSide!=='undefined')pipelineSide=side;
    syncSideButtons();
    renderDashboard();
    populateFilters();
    renderOps();
    renderNext();
    renderPeople();
    updateNavCounts();
  }

  populateFilters=function(){
    const d=sideOpportunities();
    const stages=[...new Set(d.map(opportunityStage).filter(Boolean))];
    const owners=[...new Set(d.map(o=>o.owner).filter(Boolean))].sort();
    $('stageFilter').innerHTML='<option value="All">All</option>'+stages.map(s=>`<option value="${esc(s)}">${esc(s)}</option>`).join('');
    $('ownerFilter').innerHTML='<option value="All">All</option>'+owners.map(o=>`<option value="${esc(o)}">${esc(o)}</option>`).join('');
    if($('sideFilter'))$('sideFilter').value=sectionSide;
  };

  filtered=function(){
    const q=($('searchInput')?.value||'').toLowerCase(),st=$('stageFilter')?.value||'All',ow=$('ownerFilter')?.value||'All',pr=$('priorityFilter')?.value||'All';
    return sideOpportunities().filter(o=>[
      o.company,contactName(o.contactId),o.side,o.owner,opportunityStage(o),o.size,o.sector,o.notes,taskForOpportunity(o)?.action||''
    ].join(' ').toLowerCase().includes(q)&&(st==='All'||opportunityStage(o)===st)&&(ow==='All'||o.owner===ow)&&(pr==='All'||o.priority===pr));
  };

  renderOps=function(){
    const d=filtered();$('resultCount').textContent=`${d.length} ${sectionSide.toLowerCase()} opportunit${d.length===1?'y':'ies'}`;
    $('opCards').innerHTML=d.length?d.map(o=>{const t=taskForOpportunity(o),stage=opportunityStage(o);return `<article class="opCard" data-open="${o.id}"><div class="cardTop"><div><div class="titleRow">${dot(o.priority)}<div class="cardTitle">${esc(o.company)}</div>${badge(o.side)}${badge(stage)}</div><div class="cardSub">${esc(contactName(o.contactId))} · ${esc(o.size||'Size not specified')} · ${esc(o.sector||'Type not specified')}</div></div>${badge(o.priority)}</div><div class="nextBox"><div class="nextLabel">NEXT STEP</div><div class="nextCopy">${esc(t?.action||'No next step assigned')}</div><div class="nextMeta">${esc(t?.owner||o.owner||'Unassigned')} · ${esc(fmtDate(t?.dueDate||''))}</div></div><div class="cardFoot"><span>Owner: ${esc(o.owner||'Unassigned')}</span><span>Updated ${esc(fmtDT(o.updatedAt))}</span></div></article>`}).join(''):`<div class="sectionSideEmpty">No ${sectionSide.toLowerCase()} opportunities yet.</div>`;
    $('opTable').innerHTML=d.map(o=>{const t=taskForOpportunity(o);return `<tr><td><strong>${esc(o.company)}</strong></td><td>${esc(contactName(o.contactId))}</td><td>${esc(o.side)}</td><td>${esc(opportunityStage(o))}</td><td>${esc(o.owner)}</td><td>${esc(o.size||'—')}</td><td>${esc(t?.action||'—')}</td><td><button class="openLink" data-open="${o.id}">Open</button></td></tr>`}).join('');
    bindOpen();
  };

  const underlyingRenderNext=renderNext;
  renderNext=function(){
    const role=$('roleFilter'),old=role?.value;
    if(role)role.value=sectionSide;
    underlyingRenderNext();
    if(role)role.value=old;
    syncSideButtons();
  };

  const underlyingRenderPeople=renderPeople;
  renderPeople=function(){
    const role=$('roleFilter'),old=role?.value;
    if(role)role.value=sectionSide;
    underlyingRenderPeople();
    if(role)role.value=old;
    syncSideButtons();
  };

  const underlyingRenderDashboard=renderDashboard;
  renderDashboard=function(){
    const role=$('roleFilter'),old=role?.value;
    if(role)role.value=sectionSide;
    if(typeof pipelineSide!=='undefined')pipelineSide=sectionSide;
    underlyingRenderDashboard();
    if(role)role.value=old;

    const d=sideOpportunities();
    const counts={};d.forEach(o=>{const s=opportunityStage(o);counts[s]=(counts[s]||0)+1});
    const stages=Object.keys(counts);
    const mx=Math.max(1,...Object.values(counts));
    if($('stageSummary'))$('stageSummary').innerHTML=stages.length?stages.map(s=>`<div class="stageBox"><div class="stageName">${esc(s)}</div><div class="stageCount">${counts[s]}</div><div class="stageBar"><div class="stageFill" style="width:${Math.round(counts[s]/mx*100)}%"></div></div></div>`).join(''):`<div class="compactMeta">No ${sectionSide.toLowerCase()} opportunity records yet.</div>`;
    syncSideButtons();
  };

  const underlyingRenderAll=renderAll;
  renderAll=function(){
    underlyingRenderAll();
    installToolbars();
    if(typeof pipelineSide!=='undefined')pipelineSide=sectionSide;
    syncSideButtons();
    updateNavCounts();
  };

  const roleFilter=$('roleFilter');
  if(roleFilter)roleFilter.addEventListener('change',()=>{
    if(roleFilter.value==='Buy Side'||roleFilter.value==='Sell Side'){
      sectionSide=roleFilter.value;
      localStorage.setItem('outerhaven-section-side',sectionSide);
      if(typeof pipelineSide!=='undefined')pipelineSide=sectionSide;
      syncSideButtons();
    }
  });

  installToolbars();
  if(typeof currentUser!=='undefined'&&currentUser){
    if(typeof pipelineSide!=='undefined')pipelineSide=sectionSide;
    renderDashboard();
    populateFilters();
    renderOps();
    renderNext();
    renderPeople();
    updateNavCounts();
  }
})();