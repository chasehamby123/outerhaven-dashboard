(function(){
  if(window.__outerhavenDailyOpsScheduleAdmin)return;
  window.__outerhavenDailyOpsScheduleAdmin=true;

  const DAYS=[['Sun',0],['Mon',1],['Tue',2],['Wed',3],['Thu',4],['Fri',5],['Sat',6]];
  let role=null;
  let accounts=[];
  let activeAccount=null;
  let injecting=false;

  const style=document.createElement('style');
  style.textContent=`
    .dailyOpsScheduleBtn{border:1px solid #d8dde5;background:#fff;color:#344054;border-radius:7px;padding:6px 8px;font-size:9px;font-weight:800;cursor:pointer}
    .dailyOpsScheduleSummary{font-size:9px;color:#8a919d;margin-top:3px}
    .dailyOpsScheduleModal{position:fixed;inset:0;z-index:10020;display:flex;align-items:center;justify-content:center;padding:20px}
    .dailyOpsScheduleModal.hidden{display:none}
    .dailyOpsScheduleBackdrop{position:absolute;inset:0;background:rgba(17,24,39,.38)}
    .dailyOpsScheduleCard{position:relative;width:min(500px,100%);background:#fff;border:1px solid #dfe3e8;border-radius:16px;box-shadow:0 24px 70px rgba(17,24,39,.18);padding:20px}
    .dailyOpsScheduleHead{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.dailyOpsScheduleHead h3{margin:0;font-size:16px}.dailyOpsScheduleHead p{margin:5px 0 0;font-size:10px;color:#737b88;line-height:1.5}
    .dailyOpsScheduleClose{border:0;background:transparent;font-size:20px;cursor:pointer;color:#667085;padding:0 4px}
    .dailyOpsDayGrid{display:grid;grid-template-columns:repeat(7,1fr);gap:7px;margin-top:18px}.dailyOpsDay{border:1px solid #d7dce3;background:#fff;border-radius:9px;padding:10px 4px;font-size:9px;font-weight:850;color:#596170;cursor:pointer;text-align:center}.dailyOpsDay.active{background:#111827;color:#fff;border-color:#111827}
    .dailyOpsScheduleActions{display:flex;justify-content:flex-end;gap:8px;margin-top:18px}.dailyOpsScheduleActions button{border-radius:9px;padding:9px 12px;font-size:10px;font-weight:850;cursor:pointer}.dailyOpsScheduleCancel{border:1px solid #d8dde5;background:#fff;color:#344054}.dailyOpsScheduleSave{border:1px solid #111827;background:#111827;color:#fff}
    @media(max-width:560px){.dailyOpsDayGrid{grid-template-columns:repeat(4,1fr)}}
  `;
  document.head.appendChild(style);

  function localDate(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
  function scheduleLabel(days){
    const s=[...(days||[])].sort((a,b)=>a-b);
    if(!s.length)return'No posting days';
    if(s.length===7)return'Posts every day';
    if(s.length===5&&[1,2,3,4,5].every(d=>s.includes(d)))return'Posts Mon–Fri';
    return 'Posts '+s.map(d=>DAYS.find(x=>x[1]===d)?.[0]).filter(Boolean).join(', ');
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
    document.getElementById('dailyOpsScheduleTitle').textContent=`Posting Schedule · ${account.owner_name}`;
    const selected=new Set(account.posting_days||[]);
    const grid=document.getElementById('dailyOpsDayGrid');
    grid.innerHTML=DAYS.map(([name,num])=>`<button type="button" class="dailyOpsDay ${selected.has(num)?'active':''}" data-day="${num}">${name}</button>`).join('');
    grid.querySelectorAll('[data-day]').forEach(b=>b.onclick=()=>b.classList.toggle('active'));
    document.getElementById('dailyOpsScheduleModal').classList.remove('hidden');
  }

  async function loadAccounts(){
    if(role!=='admin'||typeof sb==='undefined')return;
    const {data,error}=await sb.from('daily_ops_accounts').select('id,owner_name,account_name,posting_days,sort_order,created_at').eq('active',true).order('sort_order').order('created_at');
    if(error){console.error('daily ops schedule accounts',error);return}
    accounts=data||[];
    injectButtons();
  }

  function injectButtons(){
    if(role!=='admin'||injecting)return;
    const cards=[...document.querySelectorAll('#dailyOpsRoot .dailyOpsAccount')];
    if(!cards.length||!accounts.length)return;
    injecting=true;
    try{
      cards.forEach((card,index)=>{
        const account=accounts[index];if(!account)return;
        const right=card.querySelector('.dailyOpsAccountRight');
        const meta=card.querySelector('.dailyOpsAccountMeta');
        if(meta){
          let summary=meta.parentElement.querySelector('.dailyOpsScheduleSummary');
          if(!summary){summary=document.createElement('div');summary.className='dailyOpsScheduleSummary';meta.insertAdjacentElement('afterend',summary)}
          summary.textContent=scheduleLabel(account.posting_days);
        }
        if(right&&!right.querySelector('[data-edit-schedule]')){
          const b=document.createElement('button');b.type='button';b.className='dailyOpsScheduleBtn';b.dataset.editSchedule=account.id;b.textContent='Edit Schedule';b.onclick=()=>openModal(account);
          const status=right.querySelector('.dailyOpsStatus');status?right.insertBefore(b,status):right.appendChild(b);
        }
      });
    }finally{injecting=false}
  }

  async function saveSchedule(){
    if(!activeAccount)return;
    const btn=document.getElementById('dailyOpsScheduleSave');
    const days=[...document.querySelectorAll('#dailyOpsDayGrid .dailyOpsDay.active')].map(x=>Number(x.dataset.day)).sort((a,b)=>a-b);
    btn.disabled=true;btn.textContent='Saving...';
    try{
      const {error}=await sb.from('daily_ops_accounts').update({posting_days:days,updated_at:new Date().toISOString()}).eq('id',activeAccount.id);
      if(error){alert(error.message);return}

      const today=new Date().getDay();
      const {data:item,error:itemErr}=await sb.from('daily_ops_items').select('id,status').eq('account_id',activeAccount.id).eq('work_date',localDate()).eq('item_type','post').maybeSingle();
      if(itemErr){console.error('daily ops post schedule sync',itemErr)}
      if(item&&item.status!=='done'){
        const status=days.includes(today)?'due':'not_needed';
        const {error:updateErr}=await sb.from('daily_ops_items').update({status,updated_at:new Date().toISOString(),updated_by:typeof currentUser!=='undefined'?currentUser?.id||null:null}).eq('id',item.id);
        if(updateErr)console.error('daily ops post item update',updateErr);
      }

      activeAccount.posting_days=days;
      closeModal();
      await loadAccounts();
      if(typeof window.__outerhavenRefreshDailyOpsSchedule==='function')window.__outerhavenRefreshDailyOpsSchedule();
    }finally{btn.disabled=false;btn.textContent='Save Schedule'}
  }

  let refreshTimer=null;
  function scheduleRefresh(){
    if(role!=='admin')return;
    clearTimeout(refreshTimer);
    refreshTimer=setTimeout(()=>{injectButtons()},80);
  }

  async function install(){
    if(typeof sb==='undefined')return;
    const {data,error}=await sb.rpc('dashboard_role');
    if(error){console.error('daily ops schedule role',error);return}
    role=data||null;
    if(role!=='admin')return;
    ensureModal();
    await loadAccounts();
    new MutationObserver(()=>scheduleRefresh()).observe(document.body,{childList:true,subtree:true});
    window.__outerhavenRefreshDailyOpsSchedule=loadAccounts;
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
