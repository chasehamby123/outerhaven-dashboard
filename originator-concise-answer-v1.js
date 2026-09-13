(function(){
  if(window.__outerhavenConciseAnswerV1)return;
  window.__outerhavenConciseAnswerV1=true;
  const sb=window.__OUTERHAVEN_ORIGINATOR_SB;if(!sb)return;
  const $=id=>document.getElementById(id);

  function acceptable(key,value){
    const v=String(value||'').trim();
    if(!v)return false;
    if(key==='diligence_total_size'||key==='diligence_capital_ask')return /^(?:\$|usd\s*)?\d+(?:\.\d+)?\s*(?:k|m|mm|mn|million|b|bn|billion)?$/i.test(v)||/^unknown|tbd$/i.test(v);
    if(key==='sponsor_equity')return /\d/.test(v)||/^(?:none|no|zero|unknown|tbd)$/i.test(v);
    return true;
  }

  async function save(key,value){
    const dealId=$('capitalDealSelect')?.value;if(!dealId)return;
    const {data:{session}}=await sb.auth.getSession();if(!session)return;
    const {data:ws,error:readError}=await sb.from('deal_workspaces').select('intake,generated_assets').eq('deal_id',dealId).maybeSingle();
    if(readError)throw readError;
    const intake={...(ws?.intake||{})};intake[key]=String(value).trim();
    const {error}=await sb.from('deal_workspaces').upsert({deal_id:dealId,owner_id:session.user.id,intake,generated_assets:ws?.generated_assets||{},updated_at:new Date().toISOString()},{onConflict:'deal_id'});
    if(error)throw error;
    await window.OuterHavenCapitalSuiteV17?.refresh?.();
    setTimeout(()=>$('capitalDealSelect')?.dispatchEvent(new Event('change',{bubbles:true})),120);
  }

  window.addEventListener('click',async e=>{
    const btn=e.target?.closest?.('[data-v17-save-next]');if(!btn)return;
    const key=btn.dataset.v17SaveNext,val=$('v17NextFact')?.value?.trim()||'';
    e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
    if(!acceptable(key,val)){alert('Please enter the factual answer. Short answers are fine, for example 240M, Yes, No, 2 firms, or 6 weeks.');return}
    btn.disabled=true;
    try{await save(key,val)}catch(err){alert(err?.message||'Could not save.')}finally{btn.disabled=false}
  },true);
})();