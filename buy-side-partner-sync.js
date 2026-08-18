(function(){
  if(window.__outerhavenBuySidePartnerSync)return;
  window.__outerhavenBuySidePartnerSync=true;

  const style=document.createElement('style');
  style.textContent=`
    .partnerMatchNote{grid-column:1/-1;border:1px solid #d8c6b1;background:#f5eadb;border-radius:10px;padding:10px 12px;font-size:10px;line-height:1.5;color:#625342}
    .partnerMatchNote strong{display:block;color:#201d18;margin-bottom:3px}
    .partnerStructureWrap{grid-column:1/-1}.partnerStructureLabel{font-size:11px;color:#70757d;font-weight:650;margin-bottom:7px}.partnerStructureGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}
    .partnerStructureCheck{display:flex;align-items:center;gap:7px;border:1px solid #d8c6b1;background:#fffaf3;border-radius:8px;padding:8px 9px;font-size:10px;color:#42382d}.partnerStructureCheck input{width:auto;margin:0}
    @media(max-width:700px){.partnerStructureGrid{grid-template-columns:1fr}}
  `;
  document.head.appendChild(style);

  const STRUCTURES=['Equity','Debt','Structured Capital','Acquisition','Joint Venture','Strategic Investment','Sale'];
  const byId=id=>document.getElementById(id);
  const splitList=value=>String(value||'').split(/[,;\n]+/).map(v=>v.trim()).filter(Boolean);
  const safeName=name=>String(name||'document').normalize('NFKD').replace(/[^a-zA-Z0-9._-]+/g,'-').replace(/-+/g,'-').slice(-120)||'document';

  function installFields(){
    const form=byId('profileThesisForm');
    if(!form)return false;
    const grid=form.querySelector('.formGrid');
    if(!grid)return false;
    if(!byId('profileThesisMatchSectors')){
      const title=byId('profileThesisTitle')?.closest('label');
      const html=`
        <div class="partnerMatchNote"><strong>Anonymous Partner Matching</strong>These criteria create a buyer-mandate bucket in the originator portal. The buyer name, company, contact information, internal thesis title, notes, and documents are never shown there.</div>
        <label class="span2">Target Sector(s)<input id="profileThesisMatchSectors" required placeholder="Hospitality, Healthcare, Infrastructure"></label>
        <label class="span2">Target Geography(s)<input id="profileThesisMatchGeographies" required placeholder="Southeast Asia, United States, Global"></label>
        <label>Minimum Opportunity Size ($)<input id="profileThesisMatchMin" type="number" min="0" step="1000000" required placeholder="25000000"></label>
        <label>Maximum Opportunity Size ($)<input id="profileThesisMatchMax" type="number" min="0" step="1000000" placeholder="100000000"></label>
        <div class="partnerStructureWrap"><div class="partnerStructureLabel">Accepted Structures</div><div class="partnerStructureGrid">${STRUCTURES.map(v=>`<label class="partnerStructureCheck"><input type="checkbox" name="profileThesisStructure" value="${v}"><span>${v}</span></label>`).join('')}</div></div>`;
      title?.insertAdjacentHTML('afterend',html);
    }
    form.onsubmit=saveStructuredThesis;
    return true;
  }

  async function saveStructuredThesis(e){
    e.preventDefault();
    const form=byId('profileThesisForm');
    const personId=byId('profileThesisPersonId')?.value;
    const file=byId('profileThesisFile')?.files?.[0];
    const title=byId('profileThesisTitle')?.value.trim();
    const notes=byId('profileThesisNotes')?.value.trim()||'';
    const sectors=splitList(byId('profileThesisMatchSectors')?.value);
    const geographies=splitList(byId('profileThesisMatchGeographies')?.value);
    const minSize=Number(byId('profileThesisMatchMin')?.value||0)||null;
    const maxSize=Number(byId('profileThesisMatchMax')?.value||0)||null;
    const structures=[...form.querySelectorAll('input[name="profileThesisStructure"]:checked')].map(x=>x.value);
    const submit=e.submitter||form.querySelector('button[type="submit"]');

    if(!personId||!title||!file)return;
    if(!sectors.length||!geographies.length||!minSize||!structures.length){alert('Add the target sector, geography, minimum opportunity size, and at least one accepted structure.');return}
    if(maxSize&&maxSize<minSize){alert('Maximum opportunity size must be greater than the minimum.');return}

    if(submit){submit.disabled=true;submit.textContent='Importing...'}
    let thesisId=null,storagePath=null;
    try{
      const {data,error}=await sb.from('buy_side_theses').insert({
        person_id:personId,
        title,
        notes,
        created_by:typeof currentUser!=='undefined'?currentUser?.id||null:null,
        match_sectors:sectors,
        match_geographies:geographies,
        match_min_size:minSize,
        match_max_size:maxSize,
        match_structures:structures,
        partner_matching_enabled:true
      }).select('id').single();
      if(error)throw error;
      thesisId=data.id;

      storagePath=`${personId}/theses/${thesisId}/${Date.now()}-${crypto.randomUUID()}-${safeName(file.name)}`;
      const upload=await sb.storage.from('outerhaven-documents').upload(storagePath,file,{cacheControl:'3600',upsert:false,contentType:file.type||undefined});
      if(upload.error)throw upload.error;

      const doc=await sb.from('profile_documents').insert({
        person_id:personId,
        opportunity_id:null,
        thesis_id:thesisId,
        document_type:'thesis',
        file_name:file.name,
        storage_path:storagePath,
        mime_type:file.type||null,
        file_size:file.size||null,
        created_by:typeof currentUser!=='undefined'?currentUser?.id||null:null
      });
      if(doc.error)throw doc.error;

      await sb.from('people').update({thesis:title}).eq('id',personId);
      byId('profileThesisModal')?.classList.add('hidden');
      if(typeof loadData==='function')await loadData();
      if(typeof window.openRelationshipProfile==='function')window.openRelationshipProfile(personId,'profileThesisSection');
    }catch(err){
      if(storagePath)await sb.storage.from('outerhaven-documents').remove([storagePath]);
      if(thesisId)await sb.from('buy_side_theses').delete().eq('id',thesisId);
      alert(err?.message||String(err));
    }finally{
      if(submit){submit.disabled=false;submit.textContent='Import Thesis'}
    }
  }

  let tries=0;
  const boot=()=>{
    if(installFields())return;
    if(++tries<120)setTimeout(boot,100);
  };
  boot();

  const observer=new MutationObserver(()=>installFields());
  observer.observe(document.body,{childList:true,subtree:true});
})();