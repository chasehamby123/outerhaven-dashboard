(function(){
  if(window.__outerhavenAiImageQuickAdd)return;
  window.__outerhavenAiImageQuickAdd=true;

  let selectedFile=null;
  let imageDataUrl='';
  let extracted=null;
  let analyzing=false;

  const style=document.createElement('style');
  style.textContent=`
    .aiImageBox{border:1px solid #e1e5ea;border-radius:14px;padding:14px;margin-bottom:14px;background:#fff}
    .aiImageHead{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap}
    .aiImageDrop{margin-top:11px;border:1.5px dashed #cfd5dd;border-radius:12px;padding:18px;text-align:center;background:#fafbfc;cursor:pointer;transition:.15s}
    .aiImageDrop.drag{border-color:#111827;background:#f5f6f8}.aiImageDrop strong{display:block;font-size:11px}.aiImageDrop span{font-size:9px;color:#7d8591;display:block;margin-top:4px}
    .aiImageSelected{display:none;gap:12px;align-items:center;margin-top:11px;padding:10px;border:1px solid #e5e8ed;border-radius:10px;background:#fafbfc}
    .aiImageSelected.show{display:flex}.aiImageThumb{width:82px;height:54px;border-radius:8px;object-fit:cover;border:1px solid #dfe3e8;background:#fff}.aiImageFile{min-width:0;flex:1}.aiImageFile b{font-size:10px;display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.aiImageFile small{font-size:8px;color:#7d8591}
    .aiImageActions{display:flex;gap:7px;flex-wrap:wrap;margin-top:11px}.aiImageStatus{font-size:9px;color:#6f7782;margin-top:8px;min-height:14px}.aiImageStatus.error{color:#a33a3a}.aiImageStatus.ok{color:#237a46}
    .aiImagePreview{display:none;margin-top:12px;border-top:1px solid #eceff2;padding-top:12px}.aiImagePreview.show{display:block}.aiImagePreviewGrid{display:grid;grid-template-columns:1fr 1fr;gap:9px}.aiImagePreviewGrid label{font-size:8px;font-weight:850;color:#69717d;display:grid;gap:4px}.aiImagePreviewGrid input,.aiImagePreviewGrid select,.aiImagePreviewGrid textarea{width:100%;box-sizing:border-box;border:1px solid #d9dee5;border-radius:8px;padding:8px;font:inherit;font-size:10px;background:#fff}.aiImagePreviewGrid .span2{grid-column:1/3}.aiImageConfidence{font-size:8px;color:#7d8591;margin-top:7px}.aiImageDuplicate{font-size:9px;color:#8a5a15;margin-top:8px}
    @media(max-width:720px){.aiImagePreviewGrid{grid-template-columns:1fr}.aiImagePreviewGrid .span2{grid-column:1}.aiImageSelected{align-items:flex-start}}
  `;
  document.head.appendChild(style);

  const escImg=v=>typeof esc==='function'?esc(v):String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  const $i=id=>document.getElementById(id);
  const sellStages=()=>typeof SELL_PIPELINE!=='undefined'?SELL_PIPELINE:['New Relationship','Diligence Call Complete','NDA Signed + Buy-Side Thesis Shared','Opportunity Received','Initial Interest Identified','Buy-Side Interest Confirmed','Engagement Active','Closed'];
  const buyStages=()=>typeof BUY_PIPELINE!=='undefined'?BUY_PIPELINE:['New Relationship','Diligence Call Complete','NDA Signed + Thesis Captured','Relevant Deal Identified','Interest Meeting Held','Buyer Interest Confirmed','Engagement Active','Closed'];

  function install(){
    const panel=document.querySelector('#aiView .aiPanel');
    if(!panel||$i('aiImageQuickAdd'))return;
    const hero=panel.querySelector('.aiHero');
    const box=document.createElement('section');
    box.id='aiImageQuickAdd';box.className='aiImageBox';
    box.innerHTML=`<div class="aiImageHead"><div><b>Add from LinkedIn Screenshot</b><div class="hint">Drop, paste, or upload a screenshot. AI will read the person and prepare the relationship record.</div></div></div>
      <input id="aiImageInput" type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden>
      <div id="aiImageDrop" class="aiImageDrop" tabindex="0"><strong>Drop or paste a LinkedIn screenshot here</strong><span>or click to choose an image</span></div>
      <div id="aiImageSelected" class="aiImageSelected"><img id="aiImageThumb" class="aiImageThumb" alt="Selected screenshot"><div class="aiImageFile"><b id="aiImageFileName"></b><small id="aiImageFileSize"></small></div><button id="aiImageClear" type="button" class="ghost">Remove</button></div>
      <div class="aiImageActions"><button id="aiImageAnalyze" type="button" class="primary" disabled>Analyze Screenshot</button></div>
      <div id="aiImageStatus" class="aiImageStatus"></div>
      <div id="aiImagePreview" class="aiImagePreview"><div class="aiImagePreviewGrid">
        <label>Name<input id="aiImgName"></label>
        <label>Relationship Type<input id="aiImgType"></label>
        <label>Company<input id="aiImgCompany"></label>
        <label>Headline / Title<input id="aiImgHeadline"></label>
        <label>Side<select id="aiImgSide"><option>Sell Side</option><option>Buy Side</option></select></label>
        <label id="aiImgKindWrap">Sell-Side Model<select id="aiImgKind"><option value="multi_deal">Multi-Deal Source</option><option value="direct_sponsor">Direct Sponsor / Founder</option></select></label>
        <label class="span2">Pipeline Stage<select id="aiImgStage"></select></label>
        <label class="span2">Notes<textarea id="aiImgNotes" rows="3"></textarea></label>
      </div><div id="aiImgConfidence" class="aiImageConfidence"></div><div id="aiImgDuplicate" class="aiImageDuplicate"></div><div class="aiImageActions"><button id="aiImgAdd" type="button" class="primary">Add Person to Pipeline</button></div></div>`;
    if(hero)hero.insertAdjacentElement('afterend',box);else panel.prepend(box);

    const drop=$i('aiImageDrop'),input=$i('aiImageInput');
    drop.onclick=()=>input.click();
    drop.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();input.click()}};
    input.onchange=()=>setFile(input.files?.[0]||null);
    drop.ondragover=e=>{e.preventDefault();drop.classList.add('drag')};
    drop.ondragleave=()=>drop.classList.remove('drag');
    drop.ondrop=e=>{e.preventDefault();drop.classList.remove('drag');setFile([...e.dataTransfer.files].find(f=>f.type.startsWith('image/'))||null)};
    document.addEventListener('paste',e=>{
      const active=document.querySelector('.view.active');if(active?.id!=='aiView')return;
      const file=[...(e.clipboardData?.files||[])].find(f=>f.type.startsWith('image/'));
      if(file){e.preventDefault();setFile(file)}
    });
    $i('aiImageClear').onclick=clearImage;
    $i('aiImageAnalyze').onclick=analyze;
    $i('aiImgSide').onchange=()=>{renderStages();toggleKind()};
    $i('aiImgAdd').onclick=addPerson;
    health();
  }

  async function health(){
    try{
      const r=await fetch(`${SUPABASE_URL}/functions/v1/ai-image-quick-add?health=1`);
      const j=await r.json();
      if(!j.configured)setStatus('Image AI is installed, but the server still needs an OpenAI API key before analysis can run.','error');
    }catch{}
  }

  function setStatus(text,type=''){
    const el=$i('aiImageStatus');if(!el)return;el.textContent=text||'';el.className=`aiImageStatus ${type}`.trim();
  }

  async function setFile(file){
    if(!file)return;
    if(!file.type.startsWith('image/'))return setStatus('Choose an image file.','error');
    if(file.size>10*1024*1024)return setStatus('Please use an image under 10 MB.','error');
    selectedFile=file;extracted=null;$i('aiImagePreview').classList.remove('show');
    try{imageDataUrl=await resizeToDataUrl(file)}catch{imageDataUrl=await fileToDataUrl(file)}
    $i('aiImageThumb').src=imageDataUrl;$i('aiImageFileName').textContent=file.name||'Pasted screenshot';$i('aiImageFileSize').textContent=`${Math.max(1,Math.round(file.size/1024))} KB`;$i('aiImageSelected').classList.add('show');$i('aiImageAnalyze').disabled=false;setStatus('Ready to analyze.');
  }

  function clearImage(){selectedFile=null;imageDataUrl='';extracted=null;$i('aiImageInput').value='';$i('aiImageSelected').classList.remove('show');$i('aiImagePreview').classList.remove('show');$i('aiImageAnalyze').disabled=true;setStatus('')}
  function fileToDataUrl(file){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result));r.onerror=reject;r.readAsDataURL(file)})}
  async function resizeToDataUrl(file){
    const raw=await fileToDataUrl(file);const img=new Image();await new Promise((res,rej)=>{img.onload=res;img.onerror=rej;img.src=raw});
    const max=1800,scale=Math.min(1,max/Math.max(img.width,img.height));if(scale===1&&file.size<3*1024*1024)return raw;
    const c=document.createElement('canvas');c.width=Math.max(1,Math.round(img.width*scale));c.height=Math.max(1,Math.round(img.height*scale));c.getContext('2d').drawImage(img,0,0,c.width,c.height);return c.toDataURL('image/jpeg',.88);
  }

  async function analyze(){
    if(analyzing||!imageDataUrl)return;
    analyzing=true;const btn=$i('aiImageAnalyze');btn.disabled=true;btn.textContent='Analyzing...';setStatus('Reading screenshot and classifying relationship...');
    try{
      const {data:{session}}=await sb.auth.getSession();
      if(!session)throw new Error('Your dashboard session expired. Sign in again.');
      const context=($i('aiInput')?.value||'').trim();
      const r=await fetch(`${SUPABASE_URL}/functions/v1/ai-image-quick-add`,{method:'POST',headers:{'content-type':'application/json','authorization':`Bearer ${session.access_token}`,'apikey':SUPABASE_KEY},body:JSON.stringify({image_data_url:imageDataUrl,context})});
      const j=await r.json().catch(()=>({}));
      if(!r.ok){
        if(j.error==='openai_not_configured')throw new Error('The screenshot feature is installed, but an OpenAI API key still needs to be connected on the server.');
        throw new Error(j.message||j.detail||'Could not analyze this screenshot.');
      }
      extracted=j.person;fillPreview(extracted);setStatus('Screenshot analyzed. Review the fields, then add the person.','ok');
    }catch(e){setStatus(e?.message||String(e),'error')}
    finally{analyzing=false;btn.disabled=!imageDataUrl;btn.textContent='Analyze Screenshot'}
  }

  function fillPreview(p){
    $i('aiImgName').value=p.name||'';$i('aiImgType').value=p.relationship_type||p.headline||'';$i('aiImgCompany').value=p.company_name||'';$i('aiImgHeadline').value=p.headline||'';$i('aiImgSide').value=p.primary_side==='Buy Side'?'Buy Side':'Sell Side';$i('aiImgKind').value=p.sell_side_kind==='direct_sponsor'?'direct_sponsor':'multi_deal';$i('aiImgNotes').value=p.notes||'';renderStages(p.pipeline_stage||'New Relationship');toggleKind();$i('aiImgConfidence').textContent=p.confidence?`AI confidence: ${Math.round(p.confidence*100)}%`:'AI confidence not provided';checkDuplicate();$i('aiImagePreview').classList.add('show');
  }
  function renderStages(selected){const stages=$i('aiImgSide').value==='Buy Side'?buyStages():sellStages();$i('aiImgStage').innerHTML=stages.map(s=>`<option value="${escImg(s)}">${escImg(s)}</option>`).join('');$i('aiImgStage').value=stages.includes(selected)?selected:'New Relationship'}
  function toggleKind(){$i('aiImgKindWrap').style.display=$i('aiImgSide').value==='Sell Side'?'grid':'none'}
  function checkDuplicate(){const name=$i('aiImgName').value.trim().toLowerCase(),dup=(state.people||[]).find(p=>p.name?.trim().toLowerCase()===name);$i('aiImgDuplicate').textContent=dup?`${dup.name} already exists in People. Saving will update that relationship instead of creating a duplicate.`:'';return dup}

  async function addPerson(){
    const name=$i('aiImgName').value.trim();if(!name)return setStatus('Add the person’s name before saving.','error');
    const side=$i('aiImgSide').value,kind=side==='Sell Side'?$i('aiImgKind').value:'multi_deal';
    const payload={name,relationship_type:$i('aiImgType').value.trim()||$i('aiImgHeadline').value.trim()||(side==='Buy Side'?'Buy-Side Relationship':'Sell-Side Relationship'),primary_side:side,pipeline_stage:$i('aiImgStage').value||'New Relationship',sell_side_kind:kind,has_linkedin:true,company_name:$i('aiImgCompany').value.trim()||null,headline:$i('aiImgHeadline').value.trim()||null,notes:$i('aiImgNotes').value.trim()||null,updated_at:new Date().toISOString()};
    const btn=$i('aiImgAdd');btn.disabled=true;btn.textContent='Saving...';
    try{
      const dup=checkDuplicate();let res;
      if(dup)res=await sb.from('people').update(payload).eq('id',dup.id).select().single();
      else res=await sb.from('people').insert({...payload,created_by:currentUser?.id||null}).select().single();
      if(res.error)throw res.error;
      setStatus(`${name} ${dup?'updated':'added'} in the ${side.toLowerCase()} pipeline.`,'ok');
      clearImage();
      if(typeof loadData==='function')await loadData();
      if(typeof pipelineSide!=='undefined'){pipelineSide=side;if(typeof renderPipeline==='function')renderPipeline()}
    }catch(e){setStatus(e?.message||String(e),'error')}
    finally{btn.disabled=false;btn.textContent='Add Person to Pipeline'}
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();