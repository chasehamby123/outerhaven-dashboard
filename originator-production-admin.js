(function(){
  if(window.__outerhavenOriginatorProductionAdmin)return;
  window.__outerhavenOriginatorProductionAdmin=true;
  if(window.__outerhavenDashboardRole!=='admin')return;

  const escP=v=>typeof esc==='function'?esc(v):String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  let loading=false,rows=[];
  const style=document.createElement('style');
  style.textContent=`
    .ohApprovalAdmin{margin:0 0 16px;background:#fff;border:1px solid #d8c6b1;border-radius:14px;padding:15px}.ohApprovalAdminHead{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:11px}.ohApprovalAdminHead h2{font-size:15px;margin:0}.ohApprovalAdminHead p{font-size:9px;color:#7c7165;margin:4px 0 0}.ohApprovalCount{background:#eadbc8;color:#544331;border-radius:999px;padding:6px 8px;font-size:8px;font-weight:900;white-space:nowrap}.ohApprovalList{display:grid;gap:8px}.ohApprovalRow{border:1px solid #e2d4c4;background:#fffaf3;border-radius:10px;padding:11px;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;align-items:center}.ohApprovalRow strong{font-size:10.5px}.ohApprovalRow span{display:block;font-size:8.5px;color:#7b7064;margin-top:3px}.ohApprovalStatus{font-size:8px!important;font-weight:850;color:#9a6a17!important}.ohApprovalAction{border:1px solid #171511;background:#171511;color:#fffaf3;border-radius:8px;padding:7px 9px;font-size:8px;font-weight:850;cursor:pointer}.ohApprovalAction:disabled{opacity:.5}.ohApprovalWait{font-size:8px;color:#8a7762;max-width:160px;text-align:right}.ohApprovalEmpty{font-size:9px;color:#7e7468;padding:6px 1px}@media(max-width:680px){.ohApprovalRow{grid-template-columns:1fr}.ohApprovalWait{text-align:left;max-width:none}}
  `;
  document.head.appendChild(style);

  function install(){
    const view=document.getElementById('originatorsView');if(!view)return false;
    const hero=view.querySelector('.oaHero');
    if(!document.getElementById('ohApprovalAdmin')){
      const panel=document.createElement('section');panel.id='ohApprovalAdmin';panel.className='ohApprovalAdmin';
      panel.innerHTML='<div class="ohApprovalAdminHead"><div><div class="oaEyebrow">SUBMISSION ACCESS</div><h2>Pending Partner Approvals</h2><p>New accounts can enter the portal immediately, but cannot submit opportunities until you approve them here.</p></div><div id="ohApprovalCount" class="ohApprovalCount">0 Pending</div></div><div id="ohApprovalList" class="ohApprovalList"></div>';
      hero?hero.insertAdjacentElement('afterend',panel):view.prepend(panel);
    }
    const oldTop=document.getElementById('oaApproveTop');if(oldTop)oldTop.style.display='none';
    const oldPanel=document.getElementById('oaApprovePanel');if(oldPanel)oldPanel.style.display='none';
    const heroCopy=view.querySelector('.oaHero p');if(heroCopy)heroCopy.textContent='Review partner accounts, approve submission access, and manage originator opportunities and buyer matching.';
    load();return true;
  }

  async function load(){
    if(loading)return;loading=true;
    try{
      const {data,error}=await sb.from('originator_profiles').select('user_id,email,full_name,company_name,profile_completed_at,submission_approved,submission_approved_at,created_at').order('created_at',{ascending:false});
      if(error)throw error;rows=data||[];render();
    }catch(err){console.error('partner approval queue',err)}finally{loading=false}
  }

  function complete(r){const name=String(r.full_name||'').trim(),company=String(r.company_name||'').trim();return name.length>=2&&company.length>=2&&name.toLowerCase()!==String(r.email||'').toLowerCase()}
  function render(){
    const pending=rows.filter(r=>!r.submission_approved),list=document.getElementById('ohApprovalList'),count=document.getElementById('ohApprovalCount');if(!list||!count)return;
    count.textContent=`${pending.length} Pending`;
    list.innerHTML=pending.length?pending.map(r=>`<article class="ohApprovalRow"><div><strong>${escP(complete(r)?r.full_name:r.email)}</strong><span>${escP(r.email)}${r.company_name?` · ${escP(r.company_name)}`:''}</span><span class="ohApprovalStatus">${complete(r)?'Profile complete · ready for approval':'Waiting for name + firm'}</span></div>${complete(r)?`<button type="button" class="ohApprovalAction" data-oh-approve-user="${r.user_id}">Approve Submissions</button>`:'<div class="ohApprovalWait">They can enter the portal, but must finish their profile before approval.</div>'}</article>`).join(''):'<div class="ohApprovalEmpty">No partner accounts are waiting for submission approval.</div>';
    document.querySelectorAll('[data-oh-approve-user]').forEach(b=>b.onclick=()=>approve(b.dataset.ohApproveUser,b));
  }

  async function approve(userId,btn){
    btn.disabled=true;btn.textContent='Approving...';
    try{const {error}=await sb.rpc('admin_set_originator_submission_access',{input_user_id:userId,input_approved:true});if(error)throw error;await load();if(typeof window.loadData==='function')window.loadData().catch?.(()=>{})}catch(err){alert(err?.message||'Could not approve this partner.');btn.disabled=false;btn.textContent='Approve Submissions'}
  }

  if(!install()){const timer=setInterval(()=>{if(install())clearInterval(timer)},200);setTimeout(()=>clearInterval(timer),10000)}
  setInterval(()=>{if(window.__outerhavenDashboardRole==='admin')load()},30000);
})();