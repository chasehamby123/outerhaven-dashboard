(function(){
  if(window.__outerhavenDailyOpsOverviewFix)return;
  window.__outerhavenDailyOpsOverviewFix=true;

  let busy=false;
  let timer=null;

  function localDate(){
    const d=new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

  function card(label,value,sub){
    return `<div class="dailyOpsMetric"><div class="k">${label}</div><div class="v">${value}</div><div class="s">${sub}</div></div>`;
  }

  async function renderOverview(){
    const box=document.querySelector('#dailyOpsRoot .dailyOpsMetrics');
    if(!box||typeof sb==='undefined'||busy)return;

    if(box.textContent.trim()==='undefined'){
      box.innerHTML=card('Accounts Complete','—','Loading overview')+card('Posts Today','—','Loading overview')+card('DMs Open','—','Loading overview')+card('Ready for WhatsApp','—','Loading overview');
    }

    busy=true;
    try{
      const [accountsRes,itemsRes,dmsRes]=await Promise.all([
        sb.from('daily_ops_accounts').select('id,posting_days').eq('active',true),
        sb.from('daily_ops_items').select('account_id,item_type,status').eq('work_date',localDate()),
        sb.from('daily_ops_dms').select('account_id,status').in('status',['needs_reply','replied'])
      ]);
      if(accountsRes.error||itemsRes.error||dmsRes.error){
        console.error('daily ops overview',accountsRes.error||itemsRes.error||dmsRes.error);
        return;
      }

      const accounts=accountsRes.data||[];
      const items=itemsRes.data||[];
      const dms=dmsRes.data||[];
      const dow=new Date().getDay();
      const item=(accountId,type)=>items.find(x=>x.account_id===accountId&&x.item_type===type);
      const requiredPosts=accounts.filter(a=>(a.posting_days||[]).includes(dow));
      const posted=requiredPosts.filter(a=>item(a.id,'post')?.status==='done').length;
      const openFor=accountId=>dms.filter(x=>x.account_id===accountId).length;
      const complete=accounts.filter(a=>{
        const postRequired=(a.posting_days||[]).includes(dow);
        const postDone=!postRequired||item(a.id,'post')?.status==='done';
        const commentsDone=item(a.id,'comments')?.status==='done';
        const followUpDone=item(a.id,'follow_up')?.status==='done';
        return postDone&&commentsDone&&followUpDone&&openFor(a.id)===0;
      }).length;
      const ready=dms.filter(x=>x.status==='replied').length;

      box.innerHTML=
        card('Accounts Complete',`${complete}/${accounts.length}`,'All current work cleared')+
        card('Posts Today',`${posted}/${requiredPosts.length}`,'Scheduled posts published')+
        card('DMs Open',String(dms.length),'Qualified replies still in Daily Ops')+
        card('Ready for WhatsApp',String(ready),'Replied and awaiting WhatsApp group');
    }finally{
      busy=false;
    }
  }

  function schedule(){
    clearTimeout(timer);
    timer=setTimeout(renderOverview,60);
  }

  function loadScheduleAdmin(){
    if(document.querySelector('script[src="/daily-ops-schedule-admin.js"]'))return;
    const s=document.createElement('script');
    s.src='/daily-ops-schedule-admin.js';
    s.async=false;
    document.body.appendChild(s);
  }

  const observer=new MutationObserver(()=>schedule());
  function install(){
    observer.observe(document.body,{childList:true,subtree:true,characterData:true});
    schedule();
    setInterval(renderOverview,3000);
    loadScheduleAdmin();
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
