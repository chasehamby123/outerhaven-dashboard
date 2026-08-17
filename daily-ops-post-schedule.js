(function(){
  if(window.__outerhavenDailyOpsPostSchedule)return;
  window.__outerhavenDailyOpsPostSchedule=true;

  const TZ='Asia/Kuala_Lumpur';
  const DAYS=[['Sun',0],['Mon',1],['Tue',2],['Wed',3],['Thu',4],['Fri',5],['Sat',6]];
  let accounts=[],checklist=null,busy=false,lastSig='';

  const escP=v=>typeof esc==='function'?esc(v):String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  const dayNumber=()=>{const short=new Intl.DateTimeFormat('en-US',{timeZone:TZ,weekday:'short'}).format(new Date());return DAYS.find(d=>d[0]===short)?.[1]??new Date().getDay()};
  const localDate=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
  const scheduleDays=days=>(days||[]).map(Number).sort((a,b)=>a-b).map(n=>DAYS.find(d=>d[1]===n)?.[0]).filter(Boolean).join(', ')||'Schedule not set';
  const timeLabel=t=>{if(!t)return'Time not set';const [h,m]=String(t).split(':').map(Number);const suffix=h>=12?'PM':'AM',hour=((h+11)%12)+1;return `${hour}${m?`:${String(m).padStart(2,'0')}`:''} ${suffix}`};
  const scheduledToday=a=>(a.posting_days||[]).map(Number).includes(dayNumber());
  const key=(kind,name)=>`${kind}:${name}`;
  const progress=()=>checklist?.account_progress||{};

  function accountSchedule(a){return `${scheduleDays(a.posting_days)} · ${timeLabel(a.posting_time)} GMT+08`}

  function postControlsHtml(){
    const posts=accounts.filter(scheduledToday),p=progress();
    const posted=posts.filter(a=>p[key('post',a.owner_name)]).length;
    const repostAccounts=accounts.filter(a=>posts.some(x=>x.id!==a.id));
    const reposted=repostAccounts.filter(a=>p[key('repost',a.owner_name)]).length;
    return `<div class="ops3Controls" data-exact-post-schedule><div class="ops3Sub">Posting schedule uses GMT+08 · Posts ${posted}/${posts.length} · Repost accounts ${reposted}/${repostAccounts.length}</div><div class="ops3Content">${accounts.map(a=>`<div class="ops3ContentRow"><div><div class="ops3ContentName">${escP(a.owner_name)}</div><div class="ops3Sub">${escP(accountSchedule(a))}</div></div><div class="ops3ContentActions">${scheduledToday(a)?`<button class="ops3Chip ${p[key('post',a.owner_name)]?'on':''}" data-post-progress="${escP(key('post',a.owner_name))}">${p[key('post',a.owner_name)]?'Posted ✓':'Mark Posted'}</button>`:'<span class="ops3Muted">No post today</span>'}${posts.some(x=>x.id!==a.id)?`<button class="ops3Chip ${p[key('repost',a.owner_name)]?'on':''}" data-post-progress="${escP(key('repost',a.owner_name))}">${p[key('repost',a.owner_name)]?'Reposts Done ✓':'Reposts Complete'}</button>`:'<span class="ops3Muted">No reposts due</span>'}</div></div>`).join('')}</div></div>`;
  }

  function signature(){return `${dayNumber()}|${checklist?.id||''}|${JSON.stringify(progress())}|${accounts.map(a=>`${a.id}:${(a.posting_days||[]).join(',')}:${a.posting_time||''}`).join('|')}`}

  function apply(){
    const root=document.getElementById('dailyOpsRoot');if(!root||!root.classList.contains('ops3')||!accounts.length)return;
    const badges=root.querySelectorAll('.ops3Accounts .ops3Badge');
    badges.forEach(b=>{const name=b.childNodes[0]?.textContent?.trim()||b.textContent.trim();const a=accounts.find(x=>x.owner_name===name);const small=b.querySelector('small');if(a&&small){const next=accountSchedule(a);if(small.textContent!==next)small.textContent=next}});

    const task=[...root.querySelectorAll('.ops3Task')].find(x=>x.querySelector('.ops3Title')?.textContent==='Posts + Repost Network');
    const old=task?.querySelector('.ops3Controls');
    const sig=signature();
    if(old&&(!old.hasAttribute('data-exact-post-schedule')||lastSig!==sig)){
      old.outerHTML=postControlsHtml();lastSig=sig;
      task.querySelectorAll('[data-post-progress]').forEach(btn=>btn.onclick=()=>toggleProgress(btn.dataset.postProgress));
    }

    const edit=document.getElementById('ops3Edit');
    if(edit&&!edit.dataset.exactScheduleBound){edit.dataset.exactScheduleBound='1';edit.addEventListener('click',()=>setTimeout(augmentScheduleModal,0))}
  }

  async function toggleProgress(k){
    if(!checklist)return;
    const old={...(checklist.account_progress||{})},next={...old,[k]:!old[k]};checklist.account_progress=next;lastSig='';apply();
    const r=await sb.from('daily_ops_checklist').update({account_progress:next,updated_at:new Date().toISOString()}).eq('id',checklist.id);
    if(r.error){checklist.account_progress=old;lastSig='';apply();alert(r.error.message)}
  }

  function augmentScheduleModal(){
    const modal=document.getElementById('ops3Modal');if(!modal||modal.classList.contains('hidden'))return;
    modal.querySelectorAll('.ops3ScheduleRow').forEach(row=>{
      const name=row.querySelector('b')?.textContent?.trim(),a=accounts.find(x=>x.owner_name===name);if(!a||row.querySelector('[data-post-time]'))return;
      row.insertAdjacentHTML('beforeend',`<div style="display:flex;align-items:center;gap:7px;margin-top:7px"><span class="ops3Sub">Posting time</span><input type="time" class="ops3Count" data-post-time="${a.id}" value="${String(a.posting_time||'').slice(0,5)}"><span class="ops3Sub">GMT+08</span></div>`);
    });
    const save=document.getElementById('ops3Save');if(save&&!save.dataset.exactScheduleSave){save.dataset.exactScheduleSave='1';save.onclick=saveExactSchedule}
  }

  async function saveExactSchedule(){
    const btn=document.getElementById('ops3Save');if(btn)btn.disabled=true;
    const results=[];
    for(const a of accounts){
      const days=[...document.querySelectorAll(`[data-a="${a.id}"].ops3Day.on`)].map(b=>Number(b.dataset.d));
      const time=document.querySelector(`[data-post-time="${a.id}"]`)?.value||String(a.posting_time||'').slice(0,5)||null;
      results.push(await sb.from('daily_ops_accounts').update({posting_days:days,posting_time:time,posting_timezone:TZ}).eq('id',a.id));
    }
    if(btn)btn.disabled=false;
    const failed=results.find(r=>r.error);if(failed)return alert(failed.error.message);
    document.getElementById('ops3Modal')?.classList.add('hidden');await load();
  }

  async function load(){
    if(busy||typeof sb==='undefined')return;busy=true;
    try{
      const [a,c]=await Promise.all([
        sb.from('daily_ops_accounts').select('id,owner_name,posting_days,posting_time,posting_timezone,sort_order,created_at').eq('active',true).order('sort_order').order('created_at'),
        sb.from('daily_ops_checklist').select('id,account_progress').eq('work_date',localDate()).eq('task_key','content_distribution').maybeSingle()
      ]);
      if(a.error||c.error){console.error('post schedule',a.error||c.error);return}
      accounts=a.data||[];checklist=c.data||null;lastSig='';apply();
    }finally{busy=false}
  }

  function install(){load();setInterval(()=>{apply();load()},30000)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();