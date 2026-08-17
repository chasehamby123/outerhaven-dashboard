(function(){
  if(window.__outerhavenDailyOpsRuntime)return;
  window.__outerhavenDailyOpsRuntime=true;

  const DAYS=[['Sun',0],['Mon',1],['Tue',2],['Wed',3],['Thu',4],['Fri',5],['Sat',6]];
  let role=null,accounts=[],items=[],dms=[],channel=null,busy=false,applyTimer=null,observer=null,activeAccount=null;

  const style=document.createElement('style');
  style.textContent=`
    .dailyOpsScheduleBtn{border:1px solid #d8dde5;background:#fff;color:#344054;border-radius:7px;padding:6px 8px;font-size:9px;font-weight:800;cursor:pointer}
    .dailyOpsScheduleSummary{font-size:9px;color:#8a919d;margin-top:3px}
    .dailyOpsDmIdentity{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
    .dailyOpsLeadUrl{font-size:9px;color:#667085;max-width:520px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .dailyOpsCopyUrl{border:1px solid #d7dce3;background:#fff;color:#344054;border-radius:7px;padding:5px 7px;font-size:8px;font-weight:850;cursor:pointer}
    .dailyOpsAdsPowerHint{font-size:9px;font-weight:800;color:#344054;margin-top:5px}
    .dailyOpsScheduleModal{position:fixed;inset:0;z-index:10020;display:flex;align-items:center;justify-content:center;padding:20px}
    .dailyOpsScheduleModal.hidden{display:none}.dailyOpsScheduleBackdrop{position:absolute;inset:0;background:rgba(17,24,39,.38)}
    .dailyOpsScheduleCard{position:relative;width:min(500px,100%);background:#fff;border:1px solid #dfe3e8;border-radius:16px;box-shadow:0 24px 70px rgba(17,24,39,.18);padding:20px}
    .dailyOpsScheduleHead{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.dailyOpsScheduleHead h3{margin:0;font-size:16px}.dailyOpsScheduleHead p{margin:5px 0 0;font-size:10px;color:#737b88;line-height:1.5}
    .dailyOpsScheduleClose{border:0;background:transparent;font-size:20px;cursor:pointer;color:#667085;padding:0 4px}
    .dailyOpsDayGrid{display:grid;grid-template-columns:repeat(7,1fr);gap:7px;margin-top:18px}.dailyOpsDay{border:1px solid #d7dce3;background:#fff;border-radius:9px;padding:10px 4px;font-size:9px;font-weight:850;color:#596170;cursor:pointer;text-align:center}.dailyOpsDay.active{background:#111827;color:#fff;border-color:#111827}
    .dailyOpsScheduleActions{display:flex;justify-content:flex-end;gap:8px;margin-top:18px}.dailyOpsScheduleActions button{border-radius:9px;padding:9px 12px;font-size:10px;font-weight:850;cursor:pointer}.dailyOpsScheduleCancel{border:1px solid #d8dde5;background:#fff;color:#344054}.dailyOpsScheduleSave{border:1px solid #111827;background:#111827;color:#fff}
    #dailyOpsRoot .dailyOpsStatus.done{background:#2e9d57!important;color:#fff!important}
    @media(max-width:560px){.dailyOpsDayGrid{grid-template-columns:repeat(4,1fr)}}
  `;
  document.head.appendChild(style);

  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const localDate=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
  const itemFor=(accountId,type)=>items.find(x=>x.account_id===accountId&&x.item_type===type);
  const isPostRequired=a=>(a.posting_days||[]).includes(new Date().getDay());
  const activeDmsFor=accountId=>dms.filter(x=>x.account_id===accountId);
  const isComplete=a=>(!isPostRequired(a)||itemFor(a.id,'post')?.status==='done')&&itemFor(a.id,'comments')?.status==='done'&&itemFor(a.id,'follow_up')?.status==='done'&&activeDmsFor(a.id).length===0;

  function scheduleLabel(days){
    const s=[...(days||[])].map(Number).sort((a,b)=>a-b);
    if(!s.length)return'No posting days';
    if(s.length===7)return'Posts every day';
    if(s.length===5&&[1,2,3,4,5].every(d=>s.includes(d)))return'Posts Mon–Fri';
    return 'Posts '+s.map(d=>DAYS.find(x=>x[1]===d)?.[0]).filter(Boolean).join(', ');
  }

  function overviewHtml(){
    const required=accounts.filter(isPostRequired);
    const complete=accounts.filter(isComplete).length;
    const posted=required.filter(a=>itemFor(a.id,'post')?.status==='done').length;
    const ready=dms.filter(x=>x.status==='replied').length;
    return `<div class="dailyOpsMetric"><div class="k">Accounts Complete</div><div class="v">${complete}/${accounts.length}</div><div class="s">All current work cleared</div></div><div class="dailyOpsMetric"><div class="k">Posts Today</div><div class="v">${posted}/${required.length}</div><div class="s">Scheduled posts published</div></div><div class="dailyOpsMetric"><div class="k">DMs Open</div><div class="v">${dms.length}</div><div class="s">Qualified replies still in Daily Ops</div></div><div class="dailyOpsMetric"><div class="k">Ready for WhatsApp</div><div class="v">${ready}</div><div class="s">Replied and awaiting WhatsApp group</div></div>`;
  }

  function ensureModal(){
    if(document.getElementById('dailyOpsScheduleModal'))return;
    const wrap=document.createElement('div');
    wrap.id='dailyOpsScheduleModal';wrap.className='dailyOpsScheduleModal hidden';
    wrap.innerHTML=`<div class="dailyOpsScheduleBackdrop" data-schedule-close></div><div class="dailyOpsScheduleCard"><div class="dailyOpsScheduleHead"><div><h3 id="dailyOpsScheduleTitle">Posting Schedule</h3><p>Select the days this LinkedIn account is expected to publish a post.</p></div><button class="dailyOpsScheduleClose" data-schedule-close type="button">×</button></div><div id="dailyOpsDayGrid" class="dailyOpsDayGrid"></div><div class="dailyOpsScheduleActions"><button class="dailyOpsScheduleCancel" data-schedule-close type="button">Cancel</button><button id="dailyOpsScheduleSave" class="dailyOpsScheduleSave" type="button">Save Schedule</button></div></div>`;
    document.body.appendChild(wrap);
    wrap.querySelectorAll('[data-schedule-close]').forEach(x=>x.onclick=closeModal);
    document.getElementById('dailyOpsScheduleSave').onclick=saveSchedule;
  }
  function closeModal(){document.getElementById('dailyOpsScheduleModal')?.classList.add('hidden');activeAccount=null}
  function openModal(account){
    activeAccount=account;ensureModal();
    const title=document.getElementById('dailyOpsScheduleTitle');if(title)title.textContent=`Posting Schedule · ${account.owner_name}`;
    const selected=new Set((account.posting_days||[]).map(Number));
    const grid=document.getElementById('dailyOpsDayGrid');
    grid.innerHTML=DAYS.map(([name,num])=>`<button type="button" class="dailyOpsDay ${selected.has(num)?'active':''}" data-day="${num}">${name}</button>`).join('');
    grid.querySelectorAll('[data-day]').forEach(b=>b.onclick=()=>b.classList.toggle('active'));
    document.getElementById('dailyOpsScheduleModal').classList.remove('hidden');
  }
  async function saveSchedule(){
    if(!activeAccount||typeof sb==='undefined')return;
    const accountId=activeAccount.id;
    const btn=document.getElementById('dailyOpsScheduleSave');
    const days=[...document.querySelectorAll('#dailyOpsDayGrid .dailyOpsDay.active')].map(x=>Number(x.dataset.day)).sort((a,b)=>a-b);
    btn.disabled=true;btn.textContent='Saving...';
    try{
      const update=await sb.from('daily_ops_accounts').update({posting_days:days}).eq('id',accountId);
      if(update.error){alert(update.error.message);return}
      const status=days.includes(new Date().getDay())?'due':'not_needed';
      const existing=await sb.from('daily_ops_items').select('id,status').eq('account_id',accountId).eq('work_date',localDate()).eq('item_type','post').maybeSingle();
      if(existing.error){alert(existing.error.message);return}
      if(existing.data&&existing.data.status!=='done'){
        const itemUpdate=await sb.from('daily_ops_items').update({status,updated_at:new Date().toISOString(),updated_by:typeof currentUser!=='undefined'?currentUser?.id||null:null}).eq('id',existing.data.id);
        if(itemUpdate.error){alert(itemUpdate.error.message);return}
      }else if(!existing.data){
        const itemInsert=await sb.from('daily_ops_items').insert({account_id:accountId,work_date:localDate(),item_type:'post',status,item_count:0});
        if(itemInsert.error){alert(itemInsert.error.message);return}
      }
      closeModal();
      await refresh();
    }finally{btn.disabled=false;btn.textContent='Save Schedule'}
  }

  async function copyUrl(button,url){
    try{await navigator.clipboard.writeText(url)}catch{
      const ta=document.createElement('textarea');ta.value=url;ta.style.position='fixed';ta.style.opacity='0';document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove();
    }
    button.textContent='Copied';setTimeout(()=>button.textContent='Copy URL',1200);
  }

  function dmIdFor(card){
    const side=card.querySelector('[data-dm]');if(side?.dataset.dm)return side.dataset.dm;
    const replied=card.querySelector('[data-mark-replied]');if(replied?.dataset.markReplied)return replied.dataset.markReplied;
    const promote=card.querySelector('[data-promote-whatsapp]');if(promote?.dataset.promoteWhatsapp)return promote.dataset.promoteWhatsapp;
    return '';
  }
  function enhanceDm(card,account){
    const id=dmIdFor(card),dm=dms.find(x=>x.id===id);
    if(id&&!dm){card.remove();return}
    const name=card.querySelector('.dailyOpsDmName');
    if(name&&dm?.linkedin_url){
      let identity=card.querySelector('.dailyOpsDmIdentity');
      if(!identity){identity=document.createElement('div');identity.className='dailyOpsDmIdentity';name.parentNode.insertBefore(identity,name);identity.appendChild(name)}
      let url=identity.querySelector('.dailyOpsLeadUrl');
      if(!url){url=document.createElement('span');url.className='dailyOpsLeadUrl';identity.appendChild(url)}
      if(url.textContent!==dm.linkedin_url)url.textContent=dm.linkedin_url;
      if(url.title!==dm.linkedin_url)url.title=dm.linkedin_url;
      let copy=identity.querySelector('.dailyOpsCopyUrl');
      if(!copy){copy=document.createElement('button');copy.type='button';copy.className='dailyOpsCopyUrl';copy.textContent='Copy URL';identity.appendChild(copy)}
      copy.onclick=e=>{e.preventDefault();e.stopPropagation();copyUrl(copy,dm.linkedin_url)};
      let hint=card.querySelector('.dailyOpsAdsPowerHint');
      if(!hint){hint=document.createElement('div');hint.className='dailyOpsAdsPowerHint';identity.insertAdjacentElement('afterend',hint)}
      const hintText=account?`Paste into ${account.owner_name}'s account in AdsPower`:'Assign this reply to the correct AdsPower account first';
      if(hint.textContent!==hintText)hint.textContent=hintText;
    }
    card.querySelectorAll('a[href*="linkedin.com"]').forEach(x=>x.remove());
  }

  function apply(){
    const root=document.getElementById('dailyOpsRoot');if(!root)return;
    const metrics=root.querySelector('.dailyOpsMetrics');
    if(metrics&&accounts.length){const next=overviewHtml();if(metrics.innerHTML!==next)metrics.innerHTML=next}
    const cards=[...root.querySelectorAll('.dailyOpsAccount')];
    cards.forEach((card,index)=>{
      const account=accounts[index];if(!account)return;
      const status=card.querySelector('.dailyOpsStatus');
      if(status){
        const complete=isComplete(account),label=complete?'Complete ✓':'Needs Attention';
        if(status.classList.contains('done')!==complete)status.classList.toggle('done',complete);
        if(status.textContent!==label)status.textContent=label;
      }
      const meta=card.querySelector('.dailyOpsAccountMeta');
      if(meta){
        let summary=meta.parentElement.querySelector('.dailyOpsScheduleSummary');
        if(!summary){summary=document.createElement('div');summary.className='dailyOpsScheduleSummary';meta.insertAdjacentElement('afterend',summary)}
        const label=scheduleLabel(account.posting_days);if(summary.textContent!==label)summary.textContent=label;
      }
      if(role==='admin'){
        const right=card.querySelector('.dailyOpsAccountRight');
        if(right&&!right.querySelector('[data-edit-schedule]')){const b=document.createElement('button');b.type='button';b.className='dailyOpsScheduleBtn';b.dataset.editSchedule=account.id;b.textContent='Edit Schedule';b.onclick=()=>openModal(account);status?right.insertBefore(b,status):right.appendChild(b)}
      }
      card.querySelectorAll('.dailyOpsDmCard').forEach(dmCard=>enhanceDm(dmCard,account));
    });
    root.querySelectorAll('.dailyOpsUnassigned .dailyOpsDmCard').forEach(dmCard=>enhanceDm(dmCard,null));
    root.querySelectorAll('.dailyOpsOpenLinkedIn,.dailyOpsPostOpen,.dailyOpsPostPerformance a').forEach(x=>x.remove());
    root.querySelectorAll('a[href*="linkedin.com"]').forEach(x=>x.remove());
  }

  function scheduleApply(){clearTimeout(applyTimer);applyTimer=setTimeout(apply,45)}
  async function resolveRole(){
    for(let i=0;i<40;i++){
      if(window.__outerhavenDashboardRole){role=window.__outerhavenDashboardRole;return role}
      if(typeof sb!=='undefined'){
        try{const {data:{session}}=await sb.auth.getSession();if(session){const r=await sb.rpc('dashboard_role');if(!r.error&&r.data){role=r.data;return role}}}catch{}
      }
      await sleep(250);
    }
    return null;
  }
  async function refresh(){
    if(typeof sb==='undefined'||busy)return;
    busy=true;
    try{
      const [a,i,d]=await Promise.all([
        sb.from('daily_ops_accounts').select('id,owner_name,account_name,posting_days,sort_order,created_at').eq('active',true).order('sort_order').order('created_at'),
        sb.from('daily_ops_items').select('account_id,item_type,status').eq('work_date',localDate()),
        sb.from('daily_ops_dms').select('id,account_id,linkedin_url,status').in('status',['needs_reply','replied']).order('created_at',{ascending:false})
      ]);
      if(a.error||i.error||d.error){console.error('daily ops runtime',a.error||i.error||d.error);return}
      accounts=a.data||[];items=i.data||[];dms=d.data||[];apply();
    }finally{busy=false}
  }
  function ensureRealtime(){
    if(channel||typeof sb==='undefined')return;
    channel=sb.channel('outerhaven-daily-ops-runtime-v1')
      .on('postgres_changes',{event:'*',schema:'public',table:'daily_ops_accounts'},refresh)
      .on('postgres_changes',{event:'*',schema:'public',table:'daily_ops_items'},refresh)
      .on('postgres_changes',{event:'*',schema:'public',table:'daily_ops_dms'},refresh)
      .subscribe();
  }
  async function install(){
    role=await resolveRole();if(!['admin','ops'].includes(role))return;
    ensureModal();
    observer=new MutationObserver(scheduleApply);observer.observe(document.body,{childList:true,subtree:true});
    await refresh();ensureRealtime();
    window.__outerhavenRefreshDailyOpsRuntime=refresh;
    setInterval(refresh,30000);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
