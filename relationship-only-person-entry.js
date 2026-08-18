(function(){
  if(window.__outerhavenRelationshipOnlyPersonEntry)return;
  window.__outerhavenRelationshipOnlyPersonEntry=true;

  const style=document.createElement('style');
  style.textContent='#personSponsorOppWrap,#personSponsorSizeWrap,#sellTypeOppWrap,#sellTypeSizeWrap{display:none!important}';
  document.head.appendChild(style);

  function ownerName(){
    if(typeof userOwnerName==='function')return userOwnerName();
    return currentUser?.email?.toLowerCase().startsWith('tengku')?'Tengku':'Chase';
  }

  async function saveRelationshipOnly(e){
    e.preventDefault();
    const id=$('personEditId').value||null;
    const side=$('personSideInput').value;
    const kind=(side==='Sell Side'||side==='Both')?$('personSellKindInput').value:'multi_deal';
    const payload={
      name:$('personNameInput').value.trim(),
      relationship_type:$('personTypeInput').value.trim(),
      primary_side:side,
      has_linkedin:$('personLinkedInInput').value==='true',
      thesis:$('personThesisInput').value.trim(),
      notes:$('personNotesInput').value.trim(),
      sell_side_kind:kind,
      created_by:currentUser?.id||null
    };
    const res=id?await sb.from('people').update(payload).eq('id',id):await sb.from('people').insert(payload);
    if(res.error){alert(res.error.message);return}
    $('personModal').classList.add('hidden');
    await loadData();
  }

  async function saveRelationshipTypeOnly(e){
    e.preventDefault();
    const id=$('sellTypePersonId').value;
    const p=person(id);if(!p)return;
    const kind=$('sellTypeKindInput').value;
    let stage=typeof personSellStage==='function'?personSellStage(p):(p.pipelineStage||'New Relationship');
    if(kind==='multi_deal'&&typeof sellOpportunityReceivedIndex==='function'&&SELL_PIPELINE.indexOf(stage)>sellOpportunityReceivedIndex())stage='Opportunity Received';
    const {error}=await sb.from('people').update({sell_side_kind:kind,pipeline_stage:stage}).eq('id',id);
    if(error){alert(error.message);return}
    $('sellTypeModal').classList.add('hidden');
    await loadData();
  }

  async function addRelationshipsOnly(){
    const entries=typeof parseAI==='function'?parseAI():[];
    for(const x of entries){
      let p=(state.people||[]).find(y=>(y.name||'').toLowerCase()===x.name.toLowerCase());
      if(!p){
        const {data,error}=await sb.from('people').insert({
          name:x.name,
          relationship_type:x.type,
          primary_side:x.side,
          notes:x.raw||'',
          sell_side_kind:'multi_deal',
          created_by:currentUser?.id||null
        }).select().single();
        if(error){console.error(error);continue}
        p=typeof mapPerson==='function'?mapPerson(data):data;
      }else if(!p.notes&&x.raw){
        await sb.from('people').update({notes:x.raw}).eq('id',p.id);
      }

      if(x.next){
        const duplicate=(state.tasks||[]).some(t=>t.personId===p.id&&!t.completed&&(t.action||'').trim().toLowerCase()===x.next.trim().toLowerCase());
        if(!duplicate){
          await sb.from('tasks').insert({person_id:p.id,action:x.next.trim(),owner_name:ownerName(),due_date:null,created_by:currentUser?.id||null});
        }
      }
    }
    if($('aiInput'))$('aiInput').value='';
    if($('aiPreview'))$('aiPreview').innerHTML='';
    await loadData();
  }

  function install(){
    const personForm=$('personForm');
    if(personForm)personForm.onsubmit=saveRelationshipOnly;
    const sellTypeForm=$('sellTypeForm');
    if(sellTypeForm)sellTypeForm.onsubmit=saveRelationshipTypeOnly;
    const aiBtn=$('addAiBtn');
    if(aiBtn)aiBtn.onclick=addRelationshipsOnly;

    document.querySelectorAll('.navBtn[data-view="ai"]').forEach(btn=>btn.addEventListener('click',()=>setTimeout(()=>{
      const sub=$('pageSub');
      if(sub)sub.textContent='Paste relationship notes to add people and next steps. Opportunities are added separately.';
    },0)));
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
  else install();
})();
