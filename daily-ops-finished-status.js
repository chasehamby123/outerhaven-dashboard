(function(){
  if(window.__outerhavenDailyOpsFinishedStatus)return;
  window.__outerhavenDailyOpsFinishedStatus=true;

  let accounts=[],items=[],dms=[],busy=false,timer=null;

  const style=document.createElement('style');
  style.textContent=`
    #dailyOpsRoot .dailyOpsStatus{display:inline-flex!important;align-items:center;justify-content:center}
    #dailyOpsRoot .dailyOpsStatus.done{border:1px solid #218c4b!important;background:#2e9d57!important;color:#fff!important;box-shadow:0 0 0 3px rgba(46,157,87,.10)}
  `;
  document.head.appendChild(style);

  function localDate(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
  function isPostRequired(a){return (a.posting_days||[]).includes(new Date().getDay())}
  function itemFor(accountId,type){return items.find(x=>x.account_id===accountId&&x.item_type===type)}
  function dmCount(accountId){return dms.filter(x=>x.account_id===accountId).length}
  function isComplete(a){
    const postDone=!isPostRequired(a)||itemFor(a.id,'post')?.status==='done';
    const commentsDone=itemFor(a.id,'comments')?.status==='done';
    const followUpDone=itemFor(a.id,'follow_up')?.status==='done';
    return !!(postDone&&commentsDone&&followUpDone&&dmCount(a.id)===0);
  }

  function apply(){
    document.querySelectorAll('#dailyOpsRoot [data-daily-finished]').forEach(x=>x.remove());
    const cards=[...document.querySelectorAll('#dailyOpsRoot .dailyOpsAccount')];
    if(!cards.length||!accounts.length)return;
    cards.forEach((card,index)=>{
      const account=accounts[index];if(!account)return;
      const status=card.querySelector('.dailyOpsStatus');if(!status)return;
      const complete=isComplete(account);
      status.classList.toggle('done',complete);
      status.textContent=complete?'Complete ✓':'Needs Attention';
      status.title=complete?'All required work for this account is complete.':'This account still has required work or qualified DMs waiting.';
    });
  }

  async function refresh(){
    if(typeof sb==='undefined'||busy)return;
    busy=true;
    try{
      const [a,i,d]=await Promise.all([
        sb.from('daily_ops_accounts').select('id,posting_days,sort_order,created_at').eq('active',true).order('sort_order').order('created_at'),
        sb.from('daily_ops_items').select('account_id,item_type,status').eq('work_date',localDate()),
        sb.from('daily_ops_dms').select('account_id,status').in('status',['needs_reply','replied'])
      ]);
      if(a.error||i.error||d.error){console.error('daily ops completion status',a.error||i.error||d.error);return}
      accounts=a.data||[];items=i.data||[];dms=d.data||[];apply();
    }finally{busy=false}
  }

  function schedule(){clearTimeout(timer);timer=setTimeout(()=>{apply();refresh()},80)}
  function install(){
    new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});
    setTimeout(refresh,500);
    setInterval(refresh,3000);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();