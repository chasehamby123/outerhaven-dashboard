(function(){
  if(window.__outerhavenDocumentProfiles)return;
  window.__outerhavenDocumentProfiles=true;

  const BUCKET='outerhaven-documents';
  const SELL_NDA_INTERNAL='NDA Signed + Buy-Side Thesis Shared';
  const BUY_THESIS_STAGE='NDA Signed + Thesis Captured';
  let docRealtime=null;
  let activeProfilePersonId=null;

  const stageLabel=(stage,side)=>side==='Sell Side'&&stage===SELL_NDA_INTERNAL?'NDA Signed':stage;
  const thesisForPerson=id=>(state.theses||[]).filter(t=>t.personId===id);
  const docsForOpportunity=id=>(state.documents||[]).filter(d=>d.opportunityId===id).sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''));
  const docsForThesis=id=>(state.documents||[]).filter(d=>d.thesisId===id).sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''));
  const personSellOpportunities=id=>state.opportunities.filter(o=>o.contactId===id&&o.side==='Sell Side'&&o.pipelineActive);
  const prettyDocType=t=>t==='one_pager'?'One-Pager':t==='full_opportunity'?'Full Opportunity':t==='thesis'?'Thesis Document':'Document';
  const fileSize=n=>!n?'':n<1024?`${n} B`:n<1048576?`${(n/1024).toFixed(1)} KB`:`${(n/1048576).toFixed(1)} MB`;
  const safeFileName=n=>String(n||'document').replace(/[^a-zA-Z0-9._-]+/g,'-').replace(/-+/g,'-').slice(-120);
  const profilePerson=()=>person(activeProfilePersonId);

  function mapThesis(r){return{id:r.id,personId:r.person_id,title:r.title,notes:r.notes||'',createdAt:r.created_at,updatedAt:r.updated_at}}
  function mapDocument(r){return{id:r.id,personId:r.person_id,opportunityId:r.opportunity_id,thesisId:r.thesis_id,type:r.document_type,fileName:r.file_name,path:r.storage_path,mime:r.mime_type||'',size:r.file_size||0,createdAt:r.created_at}}

  loadData=async function(){
    const [p,o,t,th,d]=await Promise.all([
      sb.from('people').select('*').order('created_at'),
      sb.from('opportunities').select('*').order('updated_at',{ascending:false}),
      sb.from('tasks').select('*').order('created_at',{ascending:false}),
      sb.from('buy_side_theses').select('*').order('created_at',{ascending:false}),
      sb.from('profile_documents').select('*').order('created_at',{ascending:false})
    ]);
    if(p.error||o.error||t.error||th.error||d.error){console.error(p.error||o.error||t.error||th.error||d.error);return}
    state.people=p.data.map(mapPerson);
    state.opportunities=o.data.map(mapOpp);
    state.tasks=t.data.map(mapTask);
    state.theses=th.data.map(mapThesis);
    state.documents=d.data.map(mapDocument);
    ensureDocRealtime();
    renderAll();
    if(activeProfilePersonId&&!$('relationshipProfileOverlay').classList.contains('hidden'))renderRelationshipProfile(activeProfilePersonId);
  };

  function ensureDocRealtime(){
    if(docRealtime||!currentUser)return;
    docRealtime=sb.channel('outerhaven-profile-documents')
      .on('postgres_changes',{event:'*',schema:'public',table:'buy_side_theses'},()=>loadData())
      .on('postgres_changes',{event:'*',schema:'public',table:'profile_documents'},()=>loadData())
      .subscribe();
  }

  function installProfileUI(){
    if(!$('relationshipProfileOverlay')){
      document.body.insertAdjacentHTML('beforeend',`
        <div id="relationshipProfileOverlay" class="profileOverlay hidden">
          <aside class="relationshipProfile">
            <div class="relationshipProfileHead">
              <div>
                <div class="relationshipProfileEyebrow">RELATIONSHIP PROFILE</div>
                <h2 id="relationshipProfileName"></h2>
                <div id="relationshipProfileMeta" class="relationshipProfileMeta"></div>
              </div>
              <button id="closeRelationshipProfile" class="iconBtn" type="button">×</button>
            </div>
            <div id="relationshipProfileBody" class="relationshipProfileBody"></div>
          </aside>
        </div>
        <div id="profileOpportunityModal" class="modal hidden">
          <div class="modalCard small">
            <div class="modalHead"><div><div class="eyebrow">SELL-SIDE OPPORTUNITY</div><h2 id="profileOpportunityModalTitle">Import Opportunity</h2></div><button id="closeProfileOpportunityModal" class="iconBtn" type="button">×</button></div>
            <form id="profileOpportunityForm" class="form">
              <input id="profileOpportunityPersonId" type="hidden">
              <div class="formGrid">
                <label class="span2">Opportunity Title<input id="profileOpportunityTitle" required placeholder="Company, project, or raise"></label>
                <label class="span2">Raise / Opportunity Size<input id="profileOpportunitySize" required placeholder="$25M, $150M, etc."></label>
                <label>Initial Document Type<select id="profileOpportunityDocType"><option value="one_pager">One-Pager</option><option value="full_opportunity">Full Opportunity</option><option value="other">Other Document</option></select></label>
                <label>Import Document<input id="profileOpportunityFile" class="profileFileInput" type="file" required accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.csv,.txt,.png,.jpg,.jpeg"></label>
                <label class="span2">Notes<textarea id="profileOpportunityNotes" rows="2" placeholder="Optional notes"></textarea></label>
              </div>
              <p class="profileFormHint">The opportunity starts in Opportunity Received. You can then advance that specific deal independently through the sell-side pipeline.</p>
              <div class="modalActions"><button id="cancelProfileOpportunity" class="ghost" type="button">Cancel</button><button class="primary" type="submit">Import Opportunity</button></div>
            </form>
          </div>
        </div>
        <div id="profileThesisModal" class="modal hidden">
          <div class="modalCard small">
            <div class="modalHead"><div><div class="eyebrow">BUY-SIDE THESIS</div><h2 id="profileThesisModalTitle">Import Thesis</h2></div><button id="closeProfileThesisModal" class="iconBtn" type="button">×</button></div>
            <form id="profileThesisForm" class="form">
              <input id="profileThesisPersonId" type="hidden">
              <div class="formGrid">
                <label class="span2">Thesis Title<input id="profileThesisTitle" required placeholder="Example: Southeast Asia Hospitality / $25M-$100M"></label>
                <label class="span2">Import Document<input id="profileThesisFile" class="profileFileInput" type="file" required accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.csv,.txt,.png,.jpg,.jpeg"></label>
                <label class="span2">Notes<textarea id="profileThesisNotes" rows="2" placeholder="Optional thesis notes"></textarea></label>
              </div>
              <div class="modalActions"><button id="cancelProfileThesis" class="ghost" type="button">Cancel</button><button class="primary" type="submit">Import Thesis</button></div>
            </form>
          </div>
        </div>
        <div id="docPreviewOverlay" class="docPreviewOverlay hidden">
          <div class="docPreviewCard">
            <div class="docPreviewHead"><div id="docPreviewTitle" class="docPreviewTitle"></div><button id="closeDocPreview" class="iconBtn" type="button">×</button></div>
            <div id="docPreviewBody" class="docPreviewBody"></div>
          </div>
        </div>
      `);
    }
    $('closeRelationshipProfile').onclick=closeRelationshipProfile;
    $('relationshipProfileOverlay').onclick=e=>{if(e.target===$('relationshipProfileOverlay'))closeRelationshipProfile()};
    $('closeProfileOpportunityModal').onclick=()=>$('profileOpportunityModal').classList.add('hidden');
    $('cancelProfileOpportunity').onclick=()=>$('profileOpportunityModal').classList.add('hidden');
    $('profileOpportunityForm').onsubmit=saveProfileOpportunity;
    $('closeProfileThesisModal').onclick=()=>$('profileThesisModal').classList.add('hidden');
    $('cancelProfileThesis').onclick=()=>$('profileThesisModal').classList.add('hidden');
    $('profileThesisForm').onsubmit=saveProfileThesis;
    $('closeDocPreview').onclick=closeDocPreview;
    $('docPreviewOverlay').onclick=e=>{if(e.target===$('docPreviewOverlay'))closeDocPreview()};
  }
  installProfileUI();

  function profileStage(p){
    const side=p.side==='Buy Side'?'Buy Side':'Sell Side';
    const raw=side==='Sell Side'&&typeof personSellStage==='function'?personSellStage(p):normalizedStage(p,side);
    return stageLabel(raw,side);
  }

  function docSlot(title,docs,parentType,parentId,docType){
    const matches=docs.filter(d=>d.type===docType);
    const d=matches[0]||null;
    return `<div class="profileDocSlot">
      <div class="profileDocLabel">${esc(title)}</div>
      ${d?`<div class="profileDocName">${esc(d.fileName)}</div><div class="profileDocMeta">${esc(fileSize(d.size))}${matches.length>1?` · ${matches.length} versions`:''}</div>
      <div class="profileDocActions"><button class="profileMiniBtn" type="button" data-preview-doc="${d.id}">Preview</button><button class="profileMiniBtn" type="button" data-upload-doc="${parentId}" data-parent-type="${parentType}" data-doc-type="${docType}">Import New</button></div>`
      :`<div class="profileDocMeta" style="margin-top:6px">No file imported.</div><div class="profileDocActions"><button class="profileMiniBtn" type="button" data-upload-doc="${parentId}" data-parent-type="${parentType}" data-doc-type="${docType}">Import ${esc(title)}</button></div>`}
    </div>`;
  }

  function sellOpportunityCard(o){
    const docs=docsForOpportunity(o.id);
    const one=docs.some(d=>d.type==='one_pager'),full=docs.some(d=>d.type==='full_opportunity');
    return `<article class="profileItemCard">
      <div class="profileItemTop"><div><div class="profileItemTitle">${esc(o.company)}</div><div class="profileItemMeta">${esc(o.size||'Size not specified')} · ${esc(contactName(o.contactId))}</div>
      <div class="docStatusPills"><span class="docStatusPill ${one?'ready':''}">One-Pager ${one?'Ready':'Missing'}</span><span class="docStatusPill ${full?'ready':''}">Full Opportunity ${full?'Ready':'Missing'}</span></div></div>
      <span class="profileItemStage">${esc(stageLabel(o.pipelineStage||o.stage,'Sell Side'))}</span></div>
      <div class="profileDocs">${docSlot('One-Pager',docs,'opportunity',o.id,'one_pager')}${docSlot('Full Opportunity',docs,'opportunity',o.id,'full_opportunity')}</div>
      ${docs.filter(d=>!['one_pager','full_opportunity'].includes(d.type)).length?`<div class="profilePreviewStrip">${docs.filter(d=>!['one_pager','full_opportunity'].includes(d.type)).map(d=>`<div class="profilePreviewItem"><div><strong>${esc(d.fileName)}</strong><br><span>${esc(prettyDocType(d.type))} · ${esc(fileSize(d.size))}</span></div><button class="profileMiniBtn" type="button" data-preview-doc="${d.id}">Preview</button></div>`).join('')}</div>`:''}
      <div class="profileItemActions"><button class="profileMiniBtn" type="button" data-upload-doc="${o.id}" data-parent-type="opportunity" data-doc-type="other">Import Other Document</button><button class="profileMiniBtn" type="button" data-open-deal="${o.id}">Open Opportunity</button></div>
    </article>`;
  }

  function thesisCard(t){
    const docs=docsForThesis(t.id);
    return `<article class="profileItemCard">
      <div class="profileItemTop"><div><div class="profileItemTitle">${esc(t.title)}</div><div class="profileItemMeta">${docs.length} document${docs.length===1?'':'s'}</div></div><span class="profileItemStage">Thesis</span></div>
      <div class="profilePreviewStrip">${docs.length?docs.map(d=>`<div class="profilePreviewItem"><div><strong>${esc(d.fileName)}</strong><br><span>${esc(fileSize(d.size))}</span></div><button class="profileMiniBtn" type="button" data-preview-doc="${d.id}">Preview</button></div>`).join(''):'<div class="profileDocMeta">No thesis document imported.</div>'}</div>
      <div class="profileItemActions"><button class="profileMiniBtn" type="button" data-upload-doc="${t.id}" data-parent-type="thesis" data-doc-type="thesis">Import Document</button></div>
      ${t.notes?`<div class="profileNotes" style="margin-top:10px">${esc(t.notes)}</div>`:''}
    </article>`;
  }

  function renderRelationshipProfile(personId,focus){
    const p=person(personId);if(!p)return;
    activeProfilePersonId=personId;
    const isSell=p.side==='Sell Side'||p.side==='Both';
    const isBuy=p.side==='Buy Side'||p.side==='Both';
    const ops=personSellOpportunities(p.id);
    const theses=thesisForPerson(p.id);
    const task=typeof latestTaskForPerson==='function'?latestTaskForPerson(p.id):null;
    $('relationshipProfileName').textContent=p.name;
    $('relationshipProfileMeta').textContent=`${p.type||'Relationship'} · ${p.side||''}`;
    const sellSection=isSell?`<section id="profileOpportunitiesSection" class="profileSection">
      <div class="profileSectionHead"><div><h3>Sell-Side Opportunities</h3><p>${p.sellSideKind==='direct_sponsor'?'Direct sponsor / founder opportunity documents.':'Each opportunity is tracked separately with its own documents and pipeline stage.'}</p></div>
      ${ops.length&&p.sellSideKind!=='direct_sponsor'?'<button class="profileRedBtn" type="button" data-profile-add-opportunity>+ Add Opportunity</button>':''}</div>
      ${ops.length?`<div class="profileItemList">${ops.map(sellOpportunityCard).join('')}</div>`:`<div class="profileEmpty"><div class="profileEmptyTitle">No opportunity documents yet</div><div class="profileEmptyCopy">Import the first document and give the opportunity a title and raise size. After that, you can add more opportunities from this profile.</div><button class="profileImportBtn" type="button" data-profile-add-opportunity>Import Document</button></div>`}
    </section>`:'';
    const buySection=isBuy?`<section id="profileThesisSection" class="profileSection">
      <div class="profileSectionHead"><div><h3>Buy-Side Thesis</h3><p>Keep each mandate or thesis with the source documents attached.</p></div>${theses.length?'<button class="profileRedBtn" type="button" data-profile-add-thesis>+ Add Thesis</button>':''}</div>
      ${theses.length?`<div class="profileItemList">${theses.map(thesisCard).join('')}</div>`:`<div class="profileEmpty"><div class="profileEmptyTitle">No thesis document yet</div><div class="profileEmptyCopy">Import the first thesis document and give it a title. You can add additional theses or mandates afterward.</div><button class="profileImportBtn" type="button" data-profile-add-thesis>Import Document</button></div>`}
    </section>`:'';
    $('relationshipProfileBody').innerHTML=`
      <div class="profileSummaryGrid">
        <div class="profileSummaryBox"><div class="k">Pipeline Stage</div><div class="v">${esc(profileStage(p))}</div></div>
        <div class="profileSummaryBox"><div class="k">LinkedIn Access</div><div class="v">${p.hasLinkedIn?'Yes':'No'}</div></div>
        <div class="profileSummaryBox"><div class="k">Next Step</div><div class="v">${esc(task?.action||'None')}</div></div>
      </div>
      ${sellSection}${buySection}
      ${p.notes?`<section class="profileSection"><div class="profileSectionHead"><div><h3>Relationship Notes</h3></div></div><div class="profileNotes">${esc(p.notes)}</div></section>`:''}
    `;
    bindProfileBody();
    $('relationshipProfileOverlay').classList.remove('hidden');
    if(focus)setTimeout(()=>$(focus)?.scrollIntoView({behavior:'smooth',block:'start'}),30);
  }

  function openRelationshipProfile(personId,focus){renderRelationshipProfile(personId,focus)}
  window.openRelationshipProfile=openRelationshipProfile;
  function closeRelationshipProfile(){$('relationshipProfileOverlay').classList.add('hidden');activeProfilePersonId=null}
  function closeDocPreview(){$('docPreviewOverlay').classList.add('hidden');$('docPreviewBody').innerHTML=''}

  function bindProfileBody(){
    document.querySelectorAll('[data-profile-add-opportunity]').forEach(b=>b.onclick=()=>openProfileOpportunityModal(activeProfilePersonId));
    document.querySelectorAll('[data-profile-add-thesis]').forEach(b=>b.onclick=()=>openProfileThesisModal(activeProfilePersonId));
    document.querySelectorAll('[data-preview-doc]').forEach(b=>b.onclick=()=>previewDocument(b.dataset.previewDoc));
    document.querySelectorAll('[data-upload-doc]').forEach(b=>b.onclick=()=>chooseAndUploadDocument(b.dataset.parentType,b.dataset.uploadDoc,b.dataset.docType));
    document.querySelectorAll('[data-open-deal]').forEach(b=>b.onclick=()=>openDetail(b.dataset.openDeal));
  }

  function openProfileOpportunityModal(personId){
    const p=person(personId);if(!p)return;
    if(p.sellSideKind==='direct_sponsor'&&personSellOpportunities(personId).length){
      renderRelationshipProfile(personId,'profileOpportunitiesSection');return;
    }
    $('profileOpportunityForm').reset();$('profileOpportunityPersonId').value=personId;
    $('profileOpportunityModalTitle').textContent=personSellOpportunities(personId).length?`Add Opportunity · ${p.name}`:`Import First Opportunity · ${p.name}`;
    $('profileOpportunityModal').classList.remove('hidden');
  }
  function openProfileThesisModal(personId){
    const p=person(personId);if(!p)return;
    $('profileThesisForm').reset();$('profileThesisPersonId').value=personId;
    $('profileThesisModalTitle').textContent=thesisForPerson(personId).length?`Add Thesis · ${p.name}`:`Import First Thesis · ${p.name}`;
    $('profileThesisModal').classList.remove('hidden');
  }

  async function uploadDocument({personId,opportunityId=null,thesisId=null,type,file}){
    if(!file)throw new Error('Choose a document to import.');
    const parentType=opportunityId?'opportunities':'theses',parentId=opportunityId||thesisId;
    const path=`${personId}/${parentType}/${parentId}/${Date.now()}-${crypto.randomUUID()}-${safeFileName(file.name)}`;
    const {error:uploadError}=await sb.storage.from(BUCKET).upload(path,file,{cacheControl:'3600',upsert:false,contentType:file.type||undefined});
    if(uploadError)throw uploadError;
    const payload={person_id:personId,opportunity_id:opportunityId,thesis_id:thesisId,document_type:type,file_name:file.name,storage_path:path,mime_type:file.type||null,file_size:file.size||null,created_by:currentUser?.id||null};
    const {error:dbError}=await sb.from('profile_documents').insert(payload);
    if(dbError){await sb.storage.from(BUCKET).remove([path]);throw dbError}
  }

  async function saveProfileOpportunity(e){
    e.preventDefault();
    const personId=$('profileOpportunityPersonId').value,p=person(personId),file=$('profileOpportunityFile').files?.[0];
    if(!p||!file)return;
    const payload={person_id:personId,title:$('profileOpportunityTitle').value.trim(),side:'Sell Side',owner_name:typeof userOwnerName==='function'?userOwnerName():'Chase',stage:'Opportunity Received',priority:'Medium',opportunity_size:$('profileOpportunitySize').value.trim(),sector:'',next_step:'',next_step_owner:'',due_date:null,notes:$('profileOpportunityNotes').value.trim()||`Sourced by ${p.name}`,pipeline_stage:'Opportunity Received',pipeline_active:true,created_by:currentUser?.id||null};
    const submit=e.submitter; if(submit){submit.disabled=true;submit.textContent='Importing...'}
    const {data,error}=await sb.from('opportunities').insert(payload).select('id').single();
    if(error){alert(error.message);if(submit){submit.disabled=false;submit.textContent='Import Opportunity'}return}
    try{await uploadDocument({personId,opportunityId:data.id,type:$('profileOpportunityDocType').value,file})}
    catch(err){await sb.from('opportunities').delete().eq('id',data.id);alert(err.message||String(err));if(submit){submit.disabled=false;submit.textContent='Import Opportunity'}return}
    $('profileOpportunityModal').classList.add('hidden');await loadData();renderRelationshipProfile(personId,'profileOpportunitiesSection');
  }

  async function saveProfileThesis(e){
    e.preventDefault();
    const personId=$('profileThesisPersonId').value,file=$('profileThesisFile').files?.[0];if(!personId||!file)return;
    const title=$('profileThesisTitle').value.trim();
    const submit=e.submitter;if(submit){submit.disabled=true;submit.textContent='Importing...'}
    const {data,error}=await sb.from('buy_side_theses').insert({person_id:personId,title,notes:$('profileThesisNotes').value.trim(),created_by:currentUser?.id||null}).select('id').single();
    if(error){alert(error.message);if(submit){submit.disabled=false;submit.textContent='Import Thesis'}return}
    try{await uploadDocument({personId,thesisId:data.id,type:'thesis',file})}
    catch(err){await sb.from('buy_side_theses').delete().eq('id',data.id);alert(err.message||String(err));if(submit){submit.disabled=false;submit.textContent='Import Thesis'}return}
    await sb.from('people').update({thesis:title}).eq('id',personId);
    $('profileThesisModal').classList.add('hidden');await loadData();renderRelationshipProfile(personId,'profileThesisSection');
  }

  function chooseAndUploadDocument(parentType,parentId,docType){
    const input=document.createElement('input');input.type='file';input.accept='.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.csv,.txt,.png,.jpg,.jpeg';
    input.onchange=async()=>{const file=input.files?.[0];if(!file)return;const p=profilePerson();if(!p)return;
      try{
        if(parentType==='opportunity')await uploadDocument({personId:p.id,opportunityId:parentId,type:docType,file});
        else await uploadDocument({personId:p.id,thesisId:parentId,type:'thesis',file});
        await loadData();renderRelationshipProfile(p.id,parentType==='opportunity'?'profileOpportunitiesSection':'profileThesisSection');
      }catch(err){alert(err.message||String(err))}
    };input.click();
  }

  async function previewDocument(docId){
    const d=(state.documents||[]).find(x=>x.id===docId);if(!d)return;
    const {data,error}=await sb.storage.from(BUCKET).createSignedUrl(d.path,3600);
    if(error){alert(error.message);return}
    const url=data.signedUrl,mime=(d.mime||'').toLowerCase(),name=d.fileName.toLowerCase();
    if(mime.includes('pdf')||name.endsWith('.pdf')){
      $('docPreviewTitle').textContent=d.fileName;$('docPreviewBody').innerHTML=`<iframe src="${esc(url)}"></iframe>`;$('docPreviewOverlay').classList.remove('hidden');
    }else if(mime.startsWith('image/')||/\.(png|jpe?g|gif|webp)$/i.test(name)){
      $('docPreviewTitle').textContent=d.fileName;$('docPreviewBody').innerHTML=`<img src="${esc(url)}" alt="${esc(d.fileName)}">`;$('docPreviewOverlay').classList.remove('hidden');
    }else window.open(url,'_blank','noopener,noreferrer');
  }

  function sellProfileButton(p,current){
    const idx=SELL_PIPELINE.indexOf(current),received=SELL_PIPELINE.indexOf('Opportunity Received');
    return idx>=received?`<button type="button" class="pipelineProfileAction" data-open-profile-opportunities="${p.id}">Add Opportunities</button>`:'';
  }
  function buyProfileButton(p,current){
    const idx=BUY_PIPELINE.indexOf(current),thesis=BUY_PIPELINE.indexOf(BUY_THESIS_STAGE);
    return idx>=thesis?`<button type="button" class="pipelineProfileAction" data-open-profile-thesis="${p.id}">Add Thesis</button>`:'';
  }

  function renderBuyCardWithDocs(p){
    const current=normalizedStage(p,'Buy Side'),idx=BUY_PIPELINE.indexOf(current),task=latestTaskForPerson(p.id),canAdvance=idx>=0&&idx<BUY_PIPELINE.length-1,showRevert=idx>=BUY_PIPELINE.indexOf('Relevant Deal Identified'),theses=thesisForPerson(p.id);
    return `<article class="pipelinePerson" data-pipeline-person="${p.id}"><div class="pipelinePersonName">${esc(p.name)}</div><div class="pipelinePersonMeta">${esc(p.type||'Buy-Side Relationship')}</div>${taskSnippet(task)}${theses.length?`<div class="pipelineDetail">${theses.length} thesis record${theses.length===1?'':'s'} on file</div>`:''}${p.interestDealSize?`<div class="pipelineDetail">Interested deal size: ${esc(p.interestDealSize)}</div>`:''}<div class="pipelinePersonActions pipelineDirectActions">${showRevert?`<button type="button" class="pipelineRevert" data-revert-person="${p.id}">Revert</button>`:''}${buyProfileButton(p,current)}<button type="button" class="miniAction" data-add-task="${p.id}">+ Next Step</button>${canAdvance?`<button type="button" class="pipelineAdvance" data-advance-person="${p.id}">Advance →</button>`:''}</div></article>`;
  }

  function renderSponsorCardWithDocs(p){
    const current=personSellStage(p),idx=SELL_PIPELINE.indexOf(current),opp=sponsorOpportunity(p.id),task=latestTaskForPerson(p.id),canAdvance=idx>=0&&idx<SELL_PIPELINE.length-1,showRevert=idx>=sellInitialInterestIndex(),docs=opp?docsForOpportunity(opp.id):[];
    return `<article class="pipelinePerson" data-pipeline-person="${p.id}"><div class="pipelinePersonName">${esc(p.name)}</div><div class="pipelinePersonMeta">${esc(p.type||'Direct Sponsor / Founder')}</div><span class="modelBadge">Direct Sponsor / Founder</span>${opp?`<div class="sponsorOpportunityBox"><div class="sponsorOpportunityLabel">SINGLE OPPORTUNITY</div><div class="sponsorOpportunityName">${esc(opp.company)}</div><div class="sponsorOpportunitySize">${esc(opp.size||'Size not specified')}</div><div class="docStatusPills"><span class="docStatusPill ${docs.some(d=>d.type==='one_pager')?'ready':''}">One-Pager</span><span class="docStatusPill ${docs.some(d=>d.type==='full_opportunity')?'ready':''}">Full Opportunity</span></div></div>`:'<div class="pipelineDetail">Single opportunity not set.</div>'}${taskSnippet(task)}<div class="pipelinePersonActions pipelineDirectActions">${showRevert?`<button type="button" class="pipelineRevert" data-revert-person="${p.id}">Revert</button>`:''}${sellProfileButton(p,current)}<button type="button" class="miniAction" data-add-task="${p.id}">+ Next Step</button>${canAdvance?`<button type="button" class="pipelineAdvance" data-advance-person="${p.id}">Advance →</button>`:''}</div></article>`;
  }

  function renderSourceCardWithDocs(p){
    const current=personSellStage(p),idx=SELL_PIPELINE.indexOf(current),task=latestTaskForPerson(p.id),deals=sourceDeals(p.id),atReceived=current==='Opportunity Received';
    return `<article class="pipelinePerson sourceCard" data-pipeline-person="${p.id}"><div class="pipelinePersonName">${esc(p.name)}</div><div class="pipelinePersonMeta">${esc(p.type||'Sell-Side Partner')}</div><span class="modelBadge">Multi-Deal Source</span>${taskSnippet(task)}${atReceived?`<div class="sourceDealCount">${deals.length} tracked opportunit${deals.length===1?'y':'ies'} from this source</div>`:''}<div class="pipelinePersonActions pipelineDirectActions">${atReceived?`<button type="button" class="pipelineProfileAction" data-open-profile-opportunities="${p.id}">Add Opportunities</button>`:''}<button type="button" class="miniAction" data-add-task="${p.id}">+ Next Step</button>${idx>=0&&idx<sellOpportunityReceivedIndex()?`<button type="button" class="pipelineAdvance" data-advance-person="${p.id}">Advance →</button>`:''}</div></article>`;
  }

  function renderDealCardWithDocs(o){
    const p=person(o.contactId),current=sellDealStage(o),idx=SELL_PIPELINE.indexOf(current),canAdvance=idx>=sellOpportunityReceivedIndex()&&idx<SELL_PIPELINE.length-1,showRevert=idx>=sellInitialInterestIndex(),task=(state.tasks||[]).filter(t=>t.opportunityId===o.id&&!t.completed).sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''))[0]||null,docs=docsForOpportunity(o.id);
    return `<article class="pipelinePerson dealPipelineCard" data-pipeline-deal="${o.id}"><div class="dealCardLabel">DEAL VIA ${esc((p?.name||'SELL-SIDE SOURCE').toUpperCase())}</div><div class="dealCardTitle">${esc(o.company)}</div><div class="dealCardSize">${esc(o.size||'Size not specified')}</div><div class="docStatusPills"><span class="docStatusPill ${docs.some(d=>d.type==='one_pager')?'ready':''}">One-Pager</span><span class="docStatusPill ${docs.some(d=>d.type==='full_opportunity')?'ready':''}">Full Opportunity</span></div>${taskSnippet(task)}<div class="pipelineDealActions dealTaskActions">${showRevert?`<button type="button" class="pipelineRevert" data-revert-deal="${o.id}">Revert</button>`:''}<button type="button" class="miniAction" data-add-deal-task-person="${o.contactId}" data-add-deal-task-opportunity="${o.id}">+ Next Step</button><button type="button" class="dealOpenButton" data-open-profile-opportunity="${o.contactId}">Profile</button>${canAdvance?`<button type="button" class="pipelineAdvance" data-advance-deal="${o.id}">Advance →</button>`:''}</div></article>`;
  }

  renderPipeline=function(){
    const board=$('relationshipPipeline');if(!board)return;
    const stages=pipelineSide==='Buy Side'?BUY_PIPELINE:SELL_PIPELINE;
    if(pipelineSide==='Buy Side'){
      const people=(state.people||[]).filter(p=>p.side==='Buy Side'||p.side==='Both');
      board.innerHTML=stages.map(stage=>{const ps=people.filter(p=>normalizedStage(p,'Buy Side')===stage);return `<section class="pipelineStage"><div class="pipelineStageHead"><div class="pipelineStageName">${esc(stageLabel(stage,'Buy Side'))}</div><div class="pipelineStageCount">${ps.length}</div></div>${ps.length?ps.map(renderBuyCardWithDocs).join(''):'<div class="pipelineEmpty">No relationships here.</div>'}</section>`}).join('');
    }else{
      const people=(state.people||[]).filter(p=>p.side==='Sell Side'||p.side==='Both'),direct=people.filter(isDirectSponsor),sources=people.filter(isMultiDealSource),allDeals=state.opportunities.filter(o=>o.side==='Sell Side'&&o.pipelineActive&&isMultiDealSource(person(o.contactId)));
      board.innerHTML=stages.map(stage=>{
        const cards=[
          ...sources.filter(p=>personSellStage(p)===stage).map(renderSourceCardWithDocs),
          ...direct.filter(p=>personSellStage(p)===stage).map(renderSponsorCardWithDocs),
          ...allDeals.filter(o=>sellDealStage(o)===stage).map(renderDealCardWithDocs)
        ];
        return `<section class="pipelineStage"><div class="pipelineStageHead"><div class="pipelineStageName">${esc(stageLabel(stage,'Sell Side'))}</div><div class="pipelineStageCount">${cards.length}</div></div>${cards.length?cards.join(''):'<div class="pipelineEmpty">No relationships here.</div>'}</section>`;
      }).join('');
    }
    document.querySelectorAll('.pipelineTab').forEach(b=>b.classList.toggle('active',b.dataset.pipelineSide===pipelineSide));
    bindPipelineActions();
  };

  bindPipelineActions=function(){
    document.querySelectorAll('[data-pipeline-person]').forEach(el=>el.onclick=e=>{if(e.target.closest('button'))return;openRelationshipProfile(el.dataset.pipelinePerson)});
    document.querySelectorAll('[data-open-profile-opportunities]').forEach(el=>el.onclick=e=>{e.stopPropagation();openRelationshipProfile(el.dataset.openProfileOpportunities,'profileOpportunitiesSection')});
    document.querySelectorAll('[data-open-profile-thesis]').forEach(el=>el.onclick=e=>{e.stopPropagation();openRelationshipProfile(el.dataset.openProfileThesis,'profileThesisSection')});
    document.querySelectorAll('[data-open-profile-opportunity]').forEach(el=>el.onclick=e=>{e.stopPropagation();openRelationshipProfile(el.dataset.openProfileOpportunity,'profileOpportunitiesSection')});
    document.querySelectorAll('[data-add-task]').forEach(el=>el.onclick=e=>{e.stopPropagation();openTaskModal(el.dataset.addTask)});
    document.querySelectorAll('[data-add-deal-task-opportunity]').forEach(el=>el.onclick=e=>{e.stopPropagation();openTaskModal(el.dataset.addDealTaskPerson,el.dataset.addDealTaskOpportunity)});
    document.querySelectorAll('[data-complete-task-card]').forEach(el=>el.onclick=e=>{e.stopPropagation();completeTask(el.dataset.completeTaskCard)});
    document.querySelectorAll('[data-advance-person]').forEach(el=>el.onclick=e=>{e.stopPropagation();advancePersonModel(el.dataset.advancePerson,el)});
    document.querySelectorAll('[data-revert-person]').forEach(el=>el.onclick=e=>{e.stopPropagation();revertPersonModel(el.dataset.revertPerson,el)});
    document.querySelectorAll('[data-advance-deal]').forEach(el=>el.onclick=e=>{e.stopPropagation();advanceSourceDeal(el.dataset.advanceDeal,el)});
    document.querySelectorAll('[data-revert-deal]').forEach(el=>el.onclick=e=>{e.stopPropagation();revertSourceDeal(el.dataset.revertDeal,el)});
    document.querySelectorAll('[data-pipeline-deal]').forEach(el=>el.onclick=e=>{if(e.target.closest('button'))return;const o=state.opportunities.find(x=>x.id===el.dataset.pipelineDeal);if(o)openRelationshipProfile(o.contactId,'profileOpportunitiesSection')});
  };

  const oldOpenPipelineModal=openPipelineModal;
  openPipelineModal=function(id){
    const p=person(id);if(!p)return;
    oldOpenPipelineModal(id);
    const side=p.side==='Buy Side'?'Buy Side':p.side==='Sell Side'?'Sell Side':pipelineSide;
    $('pipelineCurrentStage').textContent=stageLabel($('pipelineCurrentStage').textContent,side);
    [...$('pipelineStageInput').options].forEach(o=>o.textContent=stageLabel(o.value,side));
  };

  renderPeople=function(){
    const role=$('roleFilter').value,people=state.people.filter(p=>role==='All'||p.side===role||p.side==='Both');
    $('peopleGrid').innerHTML=people.map(p=>{
      const ops=personSellOpportunities(p.id),ths=thesisForPerson(p.id),stage=profileStage(p);
      const preview=p.side==='Buy Side'?ths.slice(0,3).map(t=>`<div class="personPreviewRow"><strong>${esc(t.title)}</strong><span>${docsForThesis(t.id).length} docs</span></div>`).join(''):ops.slice(0,3).map(o=>`<div class="personPreviewRow"><strong>${esc(o.company)}</strong><span>${esc(o.size||'')}</span></div>`).join('');
      return `<article class="personCard"><div class="personTop"><div><div class="personName">${esc(p.name)}</div><div class="cardSub">${esc(p.type||'Relationship not specified')} · ${esc(p.side||'')}</div><div class="personStage">${esc(stage)}</div></div><label class="linkedinCheck"><input type="checkbox" data-linkedin="${p.id}" ${p.hasLinkedIn?'checked':''}> LinkedIn access</label></div>
      <div class="personPreviewGroup"><div class="personPreviewTitle">${p.side==='Buy Side'?'THESIS / MANDATES':'OPPORTUNITIES'}</div>${preview||'<div class="compactMeta" style="margin-top:7px">No documents attached yet.</div>'}</div>
      <div class="personButtons"><button class="primary" type="button" data-open-person-profile="${p.id}">Open Profile</button><button class="ghost" type="button" data-update-pipeline="${p.id}">Update Pipeline</button><button class="ghost" type="button" data-add-task="${p.id}">+ Next Step</button><button class="ghost" type="button" data-edit-person="${p.id}">Edit Person</button></div></article>`;
    }).join('');
    document.querySelectorAll('[data-linkedin]').forEach(x=>x.onchange=async()=>{await sb.from('people').update({has_linkedin:x.checked}).eq('id',x.dataset.linkedin);await loadData()});
    document.querySelectorAll('[data-open-person-profile]').forEach(x=>x.onclick=()=>openRelationshipProfile(x.dataset.openPersonProfile));
    document.querySelectorAll('[data-edit-person]').forEach(x=>x.onclick=()=>openPersonModal(x.dataset.editPerson));
    document.querySelectorAll('[data-update-pipeline]').forEach(x=>x.onclick=()=>openPipelineModal(x.dataset.updatePipeline));
    document.querySelectorAll('[data-add-task]').forEach(x=>x.onclick=e=>{e.stopPropagation();openTaskModal(x.dataset.addTask)});
  };

  const previousRenderAll=renderAll;
  renderAll=function(){previousRenderAll();renderPipeline();renderPeople()};

  ensureDocRealtime();
  if(currentUser)loadData();
})();