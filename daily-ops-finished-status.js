(function(){
  if(window.__outerhavenDailyOpsFinishedStatus)return;
  window.__outerhavenDailyOpsFinishedStatus=true;

  let accounts=[],items=[],dms=[],busy=false,timer=null;

  const style=document.createElement('style');
  style.textContent=`
    .dailyOpsFinishedBtn{border:1px solid #d7dce3;background:#f2f4f7;color:#8a919d;border-radius:8px;padding:7px 10px;font-size:9px;font-weight:900;cursor:default;white-space:nowrap;transition:.18s ease}
    .dailyOpsFinishedBtn.ready{border-color:#218c4b;background:#2e9d57;color:#fff;box-shadow:0 0 0 3px rgba(46,157,87,.10)}
    #dailyOpsRoot .dailyOpsStatus{display:none!important}
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
    const cards=[...document.querySelectorAll('#dailyOpsRoot .dailyOpsAccount')];
    if(!cards.length||!accounts.length)return;
    cards.forEach((card,index)=>{
      const account=accounts[index];if(!account)return;
      const right=card.querySelector('.dailyOpsAccountRight');if(!right)return;
      let btn=right.querySelector('[data-daily-finished]');
      if(!btn){
        btn=document.createElement('button');
        btn.type='button';
        btn.className='dailyOpsFinishedBtn';
        btn.dataset.dailyFinished=account.id;
        btn.setAttribute('aria-disabled','true');
        right.appendChild(btn);
      }
      const complete=isComplete(account);
      btn.classList.toggle('ready',complete);
      btn.textContent=complete?'Finished ✓':'Finished';
      btn.title=complete?'All required work for this account is complete.':'Finish the required post, comments, follow-ups, and qualified DMs for this account.';
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
      if(a.error||i.error||d.error){console.error('daily ops finished status',a.error||i.error||d.error);return}
      accounts=a.data||[];items=i.data||[];dms=d.data||[];apply();
    }finally{busy=false}
  }

  function schedule(){clearTimeout(timer);timer=setTimeout(()=>{apply();refresh()},80)}
  function install(){
    new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});
    setTimeout(refresh,500);
    setInterval(refresh,5000);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();