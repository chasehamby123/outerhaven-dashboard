(function(){
  if(window.__outerhavenDailyOpsLinkedInSyncUI)return;
  window.__outerhavenDailyOpsLinkedInSyncUI=true;

  let applying=false;
  const style=document.createElement('style');
  style.textContent=`
    .opsLinkedInSyncBtn{border:1px solid #151a22;background:#151a22;color:#fff;border-radius:9px;padding:7px 10px;font-size:9px;font-weight:850;cursor:pointer}
    .opsLinkedInSyncBtn:disabled{opacity:.55;cursor:wait}
    .opsLinkedInSyncStatus{font-size:8px;color:#6f7988;margin-top:7px;line-height:1.45}
    .opsLinkedInSyncStatus.good{color:#287243}.opsLinkedInSyncStatus.bad{color:#a13f34}
  `;
  document.head.appendChild(style);

  function performancePanel(){
    return [...document.querySelectorAll('#dailyOpsRoot .ops4Panel')].find(p=>p.querySelector('h3')?.textContent?.trim()==='Post KPI Dashboard')||null;
  }

  function apply(){
    if(applying)return;applying=true;
    try{
      const panel=performancePanel();if(!panel)return;
      const head=panel.querySelector('.ops4Head');if(!head)return;
      let tools=head.querySelector('.opsLinkedInTools');
      if(!tools){
        tools=document.createElement('div');tools.className='opsLinkedInTools';tools.style.cssText='display:flex;gap:7px;align-items:center;flex-wrap:wrap';
        const existing=head.querySelector('#ops4Refresh');
        if(existing)tools.appendChild(existing);
        head.appendChild(tools);
      }
      if(!tools.querySelector('#opsLinkedInSync')){
        const b=document.createElement('button');b.id='opsLinkedInSync';b.className='opsLinkedInSyncBtn';b.textContent='Sync LinkedIn';
        b.onclick=runSync;tools.prepend(b);
      }
      if(!panel.querySelector('#opsLinkedInSyncStatus')){
        const s=document.createElement('div');s.id='opsLinkedInSyncStatus';s.className='opsLinkedInSyncStatus';
        s.textContent='LinkedIn post and comment metrics sync from the backend scraper. Full comment threads refresh only when engagement changes.';
        head.insertAdjacentElement('afterend',s);
      }
    }finally{applying=false}
  }

  async function runSync(){
    const b=document.getElementById('opsLinkedInSync');
    const s=document.getElementById('opsLinkedInSyncStatus');
    if(!b||typeof sb==='undefined')return;
    b.disabled=true;b.textContent='Syncing…';
    if(s){s.className='opsLinkedInSyncStatus';s.textContent='Checking all mapped LinkedIn profiles and refreshing changed comment threads. This can take a minute.'}
    try{
      const {data,error}=await sb.functions.invoke('daily-ops-linkedin-sync',{body:{max_posts:5,comment_batch_limit:10}});
      if(error)throw error;
      if(!data?.ok)throw new Error(data?.message||data?.error||'LinkedIn sync failed');
      const deferred=Number(data.comment_posts_deferred||0);
      if(s){
        s.className='opsLinkedInSyncStatus good';
        s.textContent=`Sync complete · ${Number(data.profiles_checked||0)} profiles · ${Number(data.posts_saved||0)} posts updated · ${Number(data.comment_posts_processed||0)} comment threads refreshed · ${Number(data.comment_records_saved||0)} comment/reply records${deferred?` · ${deferred} thread${deferred===1?'':'s'} queued for the next sync`:''}`;
      }
      const refresh=document.querySelector('#ops4Refresh');
      if(refresh)refresh.click();
    }catch(e){
      console.error('LinkedIn sync',e);
      if(s){s.className='opsLinkedInSyncStatus bad';s.textContent=`Sync failed: ${e?.message||String(e)}`}
    }finally{b.disabled=false;b.textContent='Sync LinkedIn'}
  }

  function install(){
    const root=document.getElementById('dailyOpsRoot');
    if(root)new MutationObserver(()=>setTimeout(apply,25)).observe(root,{childList:true,subtree:true});
    setTimeout(apply,800);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
