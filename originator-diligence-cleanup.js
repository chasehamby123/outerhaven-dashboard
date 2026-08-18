(function(){
  if(window.__outerhavenDiligenceCleanup)return;
  window.__outerhavenDiligenceCleanup=true;

  function fmtMoney(v){const n=Number(v||0);if(!n)return'';if(n>=1e9)return'$'+(n/1e9).toFixed(n%1e9?1:0)+'B';return'$'+(n/1e6).toFixed(n%1e6?1:0)+'M'}
  function draftFor(modal){
    const title=modal.querySelector('.ddDeal')?.textContent?.trim()||'';
    try{return submissions.filter(s=>(s.submission_state||'submitted')==='awaiting_diligence'&&s.title===title).sort((a,b)=>new Date(b.created_at)-new Date(a.created_at))[0]||null}catch{return null}
  }
  function hideQuestion(modal,key,value,na=false){
    const section=modal.querySelector(`[data-dd-question="${key}"]`);if(!section)return false;
    const ta=section.querySelector(`[data-dd-answer="${key}"]`),check=section.querySelector(`[data-dd-na="${key}"]`);
    if(ta&&value&&!ta.value.trim())ta.value=value;
    if(na&&check){check.checked=true;if(ta)ta.disabled=true}
    section.style.display='none';section.setAttribute('aria-hidden','true');return true;
  }
  function apply(modal){
    if(!modal||modal.dataset.cleaned==='1')return;
    const s=draftFor(modal);if(!s)return;
    modal.dataset.cleaned='1';
    const type=String(s.transaction_type||'');
    const sale=/Acquisition|Full or Partial Sale/i.test(type);
    let removed=0;

    removed+=hideQuestion(modal,'capital_structure',type||'Other')?1:0;
    if(sale){
      removed+=hideQuestion(modal,'total_transaction_size',fmtMoney(s.capital_amount))?1:0;
      removed+=hideQuestion(modal,'exact_capital_ask','',true)?1:0;
    }else{
      removed+=hideQuestion(modal,'exact_capital_ask',fmtMoney(s.capital_amount))?1:0;
    }

    const visible=Math.max(0,12-removed);
    const head=modal.querySelector('.ddHead p');
    if(head)head.textContent='Questions already answered in Step 1 are removed here. Complete only the additional diligence below, or mark a question Not Applicable when appropriate.';
    const msg=modal.querySelector('#ddFootMsg');
    if(msg)msg.textContent=`Complete the ${visible} additional diligence questions below before sending the opportunity to Outerhaven.`;
  }

  const observer=new MutationObserver(()=>document.querySelectorAll('.ddModal').forEach(apply));
  observer.observe(document.documentElement,{childList:true,subtree:true});
  document.querySelectorAll('.ddModal').forEach(apply);
})();