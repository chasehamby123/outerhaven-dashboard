(function(){
  if(window.__outerhavenDailyOpsWhatsappCleanup)return;
  window.__outerhavenDailyOpsWhatsappCleanup=true;

  function updateVisibleCounts(accountCard){
    if(!accountCard)return;
    const remaining=accountCard.querySelectorAll('.dailyOpsQueuePanel .dailyOpsDmCard').length;
    const badge=accountCard.querySelector('.dailyOpsTaskTitle .dailyOpsQueueCount');
    if(badge){badge.textContent=String(remaining);badge.classList.toggle('zero',remaining===0)}
    const meta=accountCard.querySelector('.dailyOpsAccountMeta');
    if(meta){
      const parts=meta.textContent.split(' · ');
      const label=parts[0]||'';
      meta.textContent=`${label} · ${remaining} qualified DM${remaining===1?'':'s'} open`;
    }
    const panel=accountCard.querySelector('.dailyOpsQueuePanel');
    if(panel&&remaining===0)panel.innerHTML='<div class="dailyOpsQueueEmpty">No qualified replies are waiting on this account.</div>';
  }

  async function confirmAndRemove(button,id){
    const card=button.closest('.dailyOpsDmCard');
    const accountCard=button.closest('.dailyOpsAccount');
    for(let i=0;i<12;i++){
      await new Promise(r=>setTimeout(r,300));
      if(typeof sb==='undefined')return;
      const {data,error}=await sb.from('daily_ops_dms').select('status,whatsapp_added_at').eq('id',id).maybeSingle();
      if(error)return;
      if(data?.status==='whatsapp'||data?.whatsapp_added_at){
        card?.remove();
        updateVisibleCounts(accountCard);
        window.__outerhavenRefreshDailyOpsFinished?.();
        return;
      }
    }
  }

  document.addEventListener('click',e=>{
    const button=e.target.closest('[data-promote-whatsapp]');
    if(!button)return;
    const id=button.dataset.promoteWhatsapp;
    if(id)confirmAndRemove(button,id);
  },true);
})();