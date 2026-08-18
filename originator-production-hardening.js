(function(){
  if(window.__outerhavenOriginatorProductionHardening)return;
  window.__outerhavenOriginatorProductionHardening=true;

  const q=id=>document.getElementById(id);
  const html=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  const parseAmount=v=>typeof window.__outerhavenParseDealAmount==='function'?window.__outerhavenParseDealAmount(v):Number(v||0)||0;
  const compactAmount=v=>typeof window.__outerhavenCompactDealAmount==='function'?window.__outerhavenCompactDealAmount(v):String(v||'');

  const style=document.createElement('style');
  style.textContent=`
    .ohApprovalBanner{margin:0 0 16px;border:1px solid #d8c6b1;background:#f8efe3;border-radius:13px;padding:12px 14px;display:flex;justify-content:space-between;align-items:center;gap:14px}.ohApprovalBanner strong{font-size:10px;color:#201d18}.ohApprovalBanner span{display:block;font-size:8.5px;color:#75695d;margin-top:3px;line-height:1.5}.ohApprovalBadge{font-size:8px;font-weight:900;text-transform:uppercase;letter-spacing:.07em;background:#eadbc8;color:#5f4b35;border-radius:999px;padding:6px 8px;white-space:nowrap}.navBtn.ohLocked{opacity:.48}.ohProfileBack,.ohDraftBack{position:fixed;inset:0;z-index:2300;background:rgba(23,21,17,.54);display:grid;place-items:center;padding:18px}.ohProfileCard,.ohDraftCard{width:min(620px,100%);max-height:92vh;overflow:auto;background:#fffaf3;border:1px solid #d8c6b1;border-radius:16px;box-shadow:0 28px 90px rgba(0,0,0,.2);padding:20px}.ohProfileCard h2,.ohDraftCard h2{margin:4px 0 7px;font-size:20px;color:#201d18}.ohProfileCard p,.ohDraftCard p{font-size:9px;color:#786f64;line-height:1.55;margin:0 0 15px}.ohForm{display:grid;gap:10px}.ohFormGrid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.ohForm label{display:grid;gap:5px;font-size:8px;font-weight:850;color:#655b50}.ohForm input,.ohForm textarea,.ohForm select{width:100%;box-sizing:border-box;border:1px solid #d8c6b1;background:#fff;border-radius:8px;padding:9px 10px;font:inherit;font-size:10px;color:#201d18}.ohForm textarea{resize:vertical}.ohSpan2{grid-column:1/3}.ohActions{display:flex;justify-content:flex-end;gap:8px;margin-top:4px}.ohPrimary,.ohSecondary,.ohDanger{border-radius:8px;padding:8px 10px;font-size:8.5px;font-weight:850;cursor:pointer}.ohPrimary{background:#171511;color:#fff;border:1px solid #171511}.ohSecondary{background:#fffaf3;color:#171511;border:1px solid #cdb99f}.ohDanger{background:#fff4f1;color:#9c3c2e;border:1px solid #e2b9af}.ohPrimary:disabled,.ohSecondary:disabled,.ohDanger:disabled{opacity:.5}.ohMsg{min-height:13px;font-size:8.5px;color:#75695d}.ohMsg.err{color:#9b3f35}.ohMsg.ok{color:#26724c}.ohDraftActions{display:flex;gap:6px;flex-wrap:wrap;margin-top:9px}.ohDraftActions button{border:1px solid #d4c0a7;background:#fffaf3;color:#3d3329;border-radius:7px;padding:6px 8px;font-size:7.8px;font-weight:850;cursor:pointer}.ohDraftActions button.ohDeleteDraft{color:#9a3d31;border-color:#e0b6ac;background:#fff5f2}.ohManualFallback{font-size:8px;color:#817468;line-height:1.45;margin-top:8px}.ohToast{position:fixed;right:18px;bottom:18px;z-index:2400;background:#171511;color:#fffaf3;border-radius:9px;padding:10px 12px;font-size:9px;box-shadow:0 10px 35px rgba(0,0,0,.2)}
    @media(max-width:680px){.ohApprovalBanner{align-items:flex-start;flex-direction:column}.ohProfileBack,.ohDraftBack{padding:0}.ohProfileCard,.ohDraftCard{width:100%;height:100vh;max-height:none;border-radius:0;padding:16px}.ohFormGrid{grid-template-columns:1fr}.ohSpan2{grid-column:1}.ohActions{flex-direction:column}.ohActions button{width:100%}}
  `;
  document.head.appendChild(style);

  function isProfileComplete(){
    if(!profile||!currentUser)return false;
    const name=String(profile.full_name||'').trim();
    const company=String(profile.company_name||'').trim();
    const email=String(currentUser.email||'').trim().toLowerCase();
    return name.length>=2&&company.length>=2&&name.toLowerCase()!==email;
  }
  function isApproved(){return !!profile?.submission_approved}

  function toast(text){const el=document.createElement('div');el.className='ohToast';el.textContent=text;document.body.appendChild(el);setTimeout(()=>el.remove(),3600)}

  function ensureApprovalBanner(){
    const top=document.querySelector('main.main .topbar');if(!top)return;
    let banner=q('ohApprovalBanner');
    if(isApproved()){banner?.remove();return}
    if(!banner){banner=document.createElement('div');banner.id='ohApprovalBanner';banner.className='ohApprovalBanner';top.insertAdjacentElement('afterend',banner)}
    banner.innerHTML=`<div><strong>${isProfileComplete()?'Partner profile pending approval':'Complete your partner profile'}</strong><span>${isProfileComplete()?'You can review buyer mandates and your workspace now. Opportunity submission unlocks after Outerhaven approves your partner profile.':'Add your name and firm to finish setting up your partner profile.'}</span></div><div class="ohApprovalBadge">${isProfileComplete()?'Pending Approval':'Profile Required'}</div>`;
  }

  function applyApprovalState(){
    if(!currentUser)return;
    ensureApprovalBanner();
    const locked=!isApproved();
    const submitNav=document.querySelector('.navBtn[data-section="submit"]');
    if(submitNav){submitNav.classList.toggle('ohLocked',locked);submitNav.setAttribute('aria-disabled',locked?'true':'false');submitNav.title=locked?'Outerhaven approval is required before submitting opportunities.':''}
    const top=q('topSubmit');
    if(top){top.disabled=locked;top.textContent=locked?'Awaiting Approval':'+ Submit Opportunity'}
    if(!isProfileComplete())openProfileSetup();
  }

  function openProfileSetup(){
    if(q('ohProfileBack')||!currentUser)return;
    const back=document.createElement('div');back.id='ohProfileBack';back.className='ohProfileBack';
    const currentName=String(profile?.full_name||'').trim();
    const usableName=currentName.toLowerCase()===String(currentUser.email||'').toLowerCase()?'':currentName;
    back.innerHTML=`<div class="ohProfileCard"><div class="eyebrow">PARTNER PROFILE</div><h2>Complete your profile</h2><p>Add the name and firm Outerhaven should associate with your submissions. This is required once, then your account moves into the approval queue.</p><form id="ohProfileForm" class="ohForm"><div class="ohFormGrid"><label>Full Name<input id="ohProfileName" required maxlength="120" value="${html(usableName)}" placeholder="Your full name"></label><label>Firm / Company<input id="ohProfileCompany" required maxlength="160" value="${html(profile?.company_name||'')}" placeholder="Firm or company"></label></div><div id="ohProfileMsg" class="ohMsg"></div><div class="ohActions"><button id="ohProfileSignOut" class="ohSecondary" type="button">Sign Out</button><button id="ohProfileSave" class="ohPrimary" type="submit">Save Profile</button></div></form></div>`;
    document.body.appendChild(back);
    q('ohProfileSignOut').onclick=async()=>{await sb.auth.signOut();location.replace('/originator-login.html?mode=signin')};
    q('ohProfileForm').onsubmit=async e=>{
      e.preventDefault();const btn=q('ohProfileSave'),msg=q('ohProfileMsg');btn.disabled=true;btn.textContent='Saving...';msg.textContent='';msg.className='ohMsg';
      const name=q('ohProfileName').value.trim(),company=q('ohProfileCompany').value.trim();
      try{const {error}=await sb.rpc('originator_update_profile',{input_full_name:name,input_company_name:company});if(error)throw error;await loadData(true);back.remove();toast(isApproved()?'Profile updated.':'Profile complete. Your account is pending approval.')}catch(err){msg.textContent=err?.message||'Could not save profile.';msg.className='ohMsg err'}finally{btn.disabled=false;btn.textContent='Save Profile'}
    };
  }

  function draft(s){return (s?.submission_state||'submitted')==='awaiting_diligence'}

  function decorateDraftCards(){
    const cards=[...document.querySelectorAll('#submissionCards .submissionCard')];
    cards.forEach((card,index)=>{
      const s=submissions[index];if(!s||!draft(s))return;
      const target=card.firstElementChild;if(!target||target.querySelector('.ohDraftActions'))return;
      const actions=document.createElement('div');actions.className='ohDraftActions';
      actions.innerHTML=`<button type="button" data-oh-edit-draft="${s.id}">Edit Details</button><button type="button" data-oh-add-doc="${s.id}">Add Document</button><button type="button" class="ohDeleteDraft" data-oh-delete-draft="${s.id}">Delete Draft</button>`;
      target.appendChild(actions);
    });
    document.querySelectorAll('[data-oh-edit-draft]').forEach(b=>b.onclick=()=>openDraftEditor(b.dataset.ohEditDraft));
    document.querySelectorAll('[data-oh-add-doc]').forEach(b=>b.onclick=()=>addDocumentToDraft(b.dataset.ohAddDoc));
    document.querySelectorAll('[data-oh-delete-draft]').forEach(b=>b.onclick=()=>deleteDraft(b.dataset.ohDeleteDraft));
  }

  function openDraftEditor(id){
    const s=submissions.find(x=>x.id===id);if(!s||!draft(s))return;
    document.querySelector('.ohDraftBack')?.remove();
    const back=document.createElement('div');back.className='ohDraftBack';
    const types=['Equity Raise','Debt Financing','Structured Capital','Acquisition / M&A','Joint Venture','Strategic Investment','Full or Partial Sale','Other'];
    back.innerHTML=`<div class="ohDraftCard"><div class="eyebrow">EDIT DRAFT</div><h2>${html(s.title)}</h2><p>Correct the opportunity details before completing diligence. Buyer matching will recalculate from the updated information.</p><form id="ohDraftForm" class="ohForm"><div class="ohFormGrid"><label class="ohSpan2">Opportunity / Project Name<input id="ohDraftTitle" required value="${html(s.title||'')}"></label><label>Company / Sponsor<input id="ohDraftCompany" value="${html(s.company_name||'')}"></label><label>Capital / Transaction Size<input id="ohDraftAmount" required inputmode="decimal" value="${html(compactAmount(s.capital_amount)||s.capital_amount||'')}" placeholder="30M"></label><label>Sector<input id="ohDraftSector" required value="${html(s.sector||'')}"></label><label>Geography<input id="ohDraftGeo" required value="${html(s.geography||'')}"></label><label class="ohSpan2">Transaction Type<select id="ohDraftType" required>${types.map(v=>`<option ${v===s.transaction_type?'selected':''}>${html(v)}</option>`).join('')}</select></label><label class="ohSpan2">Opportunity Summary<textarea id="ohDraftSummary" rows="6" required>${html(s.summary||'')}</textarea></label></div><div id="ohDraftMsg" class="ohMsg"></div><div class="ohActions"><button id="ohDraftCancel" class="ohSecondary" type="button">Cancel</button><button id="ohDraftSave" class="ohPrimary" type="submit">Save Changes</button></div></form></div>`;
    document.body.appendChild(back);q('ohDraftCancel').onclick=()=>back.remove();
    q('ohDraftForm').onsubmit=async e=>{
      e.preventDefault();const amount=parseAmount(q('ohDraftAmount').value),msg=q('ohDraftMsg'),btn=q('ohDraftSave');
      if(!amount){msg.textContent='Enter a valid transaction size such as 30M or 30000000.';msg.className='ohMsg err';return}
      btn.disabled=true;btn.textContent='Saving...';
      try{
        const {error}=await sb.rpc('originator_update_draft',{input_submission_id:id,input_title:q('ohDraftTitle').value.trim(),input_company_name:q('ohDraftCompany').value.trim(),input_transaction_type:q('ohDraftType').value,input_capital_amount:amount,input_sector:q('ohDraftSector').value.trim(),input_geography:q('ohDraftGeo').value.trim(),input_summary:q('ohDraftSummary').value.trim()});
        if(error)throw error;await loadData(true);back.remove();toast('Draft details updated.')
      }catch(err){msg.textContent=err?.message||'Could not update draft.';msg.className='ohMsg err'}finally{btn.disabled=false;btn.textContent='Save Changes'}
    };
  }

  function addDocumentToDraft(id){
    const s=submissions.find(x=>x.id===id);if(!s||!draft(s))return;if(!isApproved()){toast('Outerhaven approval is required before uploading submission materials.');return}
    const input=document.createElement('input');input.type='file';input.accept='.pdf,.doc,.docx,.ppt,.pptx';input.multiple=true;input.hidden=true;document.body.appendChild(input);
    input.onchange=async()=>{const files=[...input.files];input.remove();if(!files.length)return;let uploaded=0,failed=[];
      for(const f of files){const ext=(f.name.split('.').pop()||'').toLowerCase();if(!['pdf','doc','docx','ppt','pptx'].includes(ext)||f.size>15*1024*1024){failed.push(f.name);continue}
        const path=`${currentUser.id}/${id}/${crypto.randomUUID()}-${safeName(f.name)}`;
        const up=await sb.storage.from('originator-documents').upload(path,f,{upsert:false,contentType:f.type||undefined});if(up.error){failed.push(f.name);continue}
        const meta=await sb.from('originator_documents').insert({originator_user_id:currentUser.id,submission_id:id,document_type:/one[-_ ]?pager|pitch|deck/i.test(f.name)?'one_pager':'supporting_material',file_name:f.name,storage_path:path,mime_type:f.type||null,file_size:f.size});
        if(meta.error){failed.push(f.name);await sb.storage.from('originator-documents').remove([path]);continue}uploaded++;
      }
      await loadData(true);toast(failed.length?`${uploaded} uploaded. ${failed.length} file${failed.length===1?'':'s'} could not be attached.`:`${uploaded} document${uploaded===1?'':'s'} added to the draft.`);
    };input.click();
  }

  async function deleteDraft(id){
    const s=submissions.find(x=>x.id===id);if(!s||!draft(s))return;
    if(!confirm(`Delete the draft “${s.title}”? This removes its uploaded materials too.`))return;
    const ds=documents.filter(d=>d.submission_id===id),paths=ds.map(d=>d.storage_path).filter(Boolean);
    try{
      if(paths.length){const rm=await sb.storage.from('originator-documents').remove(paths);if(rm.error)throw rm.error}
      const {error}=await sb.rpc('originator_delete_draft',{input_submission_id:id});if(error)throw error;await loadData(true);toast('Draft deleted.')
    }catch(err){alert(err?.message||'Could not delete the draft.')}
  }

  function addAutofillFallback(){
    const box=q('odImport');if(!box||box.querySelector('.ohManualFallback'))return;
    const note=document.createElement('div');note.className='ohManualFallback';note.textContent='If a scanned, protected, or unusually formatted file cannot be read, it will stay attached and you can complete the fields manually.';box.appendChild(note);
  }

  const baseShowSection=typeof showSection==='function'?showSection:null;
  if(baseShowSection){showSection=function(section){if(section==='submit'&&!isApproved()){toast(isProfileComplete()?'Your partner profile is pending Outerhaven approval.':'Complete your partner profile before submitting opportunities.');return baseShowSection('home')}return baseShowSection(section)}}

  const baseRenderAll=typeof renderAll==='function'?renderAll:null;
  if(baseRenderAll){renderAll=function(){baseRenderAll();applyApprovalState();setTimeout(()=>{decorateDraftCards();addAutofillFallback()},0)}}

  const baseLoadData=typeof loadData==='function'?loadData:null;
  if(baseLoadData){loadData=async function(render=true){const out=await baseLoadData(render);applyApprovalState();setTimeout(decorateDraftCards,0);return out}}

  const baseBind=typeof bind==='function'?bind:null;
  if(baseBind){bind=function(){baseBind();const sign=q('signOut');if(sign)sign.onclick=async()=>{await sb.auth.signOut();location.replace('/originator-login.html?mode=signin')}}}

  const observer=new MutationObserver(()=>{decorateDraftCards();addAutofillFallback()});
  observer.observe(document.documentElement,{childList:true,subtree:true});
})();