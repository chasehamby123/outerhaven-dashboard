(function(){
  if(window.__outerhavenDailyOpsV2)return;
  window.__outerhavenDailyOpsV2=true;

  const TASKS=[
    {key:'connections',number:1,title:'Connection Campaign',description:'Send the daily connection campaign. Target: 20 connections across 4 accounts.'},
    {key:'pitch_new_connections',number:2,title:'Message & Pitch New Connections',description:'Message the new connections and move qualified conversations into a real sales discussion.'},
    {key:'warmup',number:3,title:'Warm Up Accounts',description:'Complete the normal warmup activity across every LinkedIn account.'},
    {key:'content_distribution',number:4,title:"Post on Peter's Account + Reposts",description:"Publish on Peter's account, then use the other A.I. post accounts to repost it."},
    {key:'reply_comments',number:5,title:'Reply to Inbound Post Comments',description:'Work the inbound comments directly inside LinkedIn. No individual comment tracking here.'},
    {key:'dm_commenters',number:6,title:'DM People Who Commented',description:'Send DMs to relevant people who engaged with the posts. No individual DM tracking here.'},
    {key:'work_leads',number:7,title:'Work Leads in DM to Set Appointment',description:'Work active DM conversations toward a booked appointment and record the total appointments set.'}
  ];
  const AI_POST_ACCOUNTS=['Tengku','Razeen','Peter','Chase'];
  let role=null,accounts=[],rows=[],channel=null,busy=false;

  const style=document.createElement('style');
  style.textContent=`
    #dailyopsView{padding-bottom:48px}
    .opsV2{display:grid;gap:16px}.opsV2Hero{background:#111827;color:#fff;border-radius:17px;padding:20px;display:flex;justify-content:space-between;gap:18px;align-items:flex-start;flex-wrap:wrap}
    .opsV2Eyebrow{font-size:9px;font-weight:900;letter-spacing:.09em;color:#aeb6c4}.opsV2Hero h2{font-size:21px;margin:5px 0 0}.opsV2Hero p{font-size:11px;color:#c8ced8;margin:6px 0 0;line-height:1.5;max-width:720px}
    .opsV2ProgressWrap{min-width:180px}.opsV2ProgressTop{display:flex;align-items:end;justify-content:space-between;gap:12px}.opsV2ProgressValue{font-size:30px;font-weight:900}.opsV2ProgressLabel{font-size:9px;color:#aeb6c4;text-transform:uppercase;font-weight:850;letter-spacing:.06em}.opsV2ProgressBar{height:7px;border-radius:999px;background:rgba(255,255,255,.15);overflow:hidden;margin-top:9px}.opsV2ProgressFill{height:100%;background:#fff;border-radius:999px;transition:width .2s ease}
    .opsV2Metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.opsV2Metric{background:#fff;border:1px solid #e4e7eb;border-radius:14px;padding:15px}.opsV2Metric .k{font-size:9px;font-weight:900;letter-spacing:.06em;color:#7a8190;text-transform:uppercase}.opsV2Metric .v{font-size:27px;font-weight:900;margin-top:7px}.opsV2Metric .s{font-size:9px;color:#848b97;margin-top:4px;line-height:1.4}
    .opsV2Accounts{background:#fff;border:1px solid #e4e7eb;border-radius:14px;padding:14px 15px}.opsV2AccountsHead{display:flex;justify-content:space-between;align-items:flex-start;gap:10px;flex-wrap:wrap}.opsV2AccountsTitle{font-size:11px;font-weight:900}.opsV2AccountsSub{font-size:9px;color:#7a8190;margin-top:3px}.opsV2AccountStrip{display:flex;gap:7px;flex-wrap:wrap;margin-top:11px}.opsV2AccountBadge{display:inline-flex;align-items:center;gap:5px;padding:6px 8px;border:1px solid #dfe3e8;border-radius:999px;font-size:9px;font-weight:850;color:#4b5563;background:#fafbfc}.opsV2AccountBadge.ai:after{content:'A.I. POSTS';font-size:7px;color:#8a5a00;background:#fff5dd;border-radius:999px;padding:2px 4px}
    .opsV2List{display:grid;gap:11px}.opsV2Task{background:#fff;border:1px solid #e4e7eb;border-radius:15px;padding:15px 16px;display:grid;grid-template-columns:34px minmax(0,1fr) auto;gap:13px;align-items:start}.opsV2Task.done{border-color:#b9ddc5;background:#fbfefc}.opsV2Number{width:31px;height:31px;border-radius:9px;background:#f1f3f6;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:900;color:#596170}.opsV2Task.done .opsV2Number{background:#e8f7ed;color:#237a45}.opsV2TaskTitle{font-size:13px;font-weight:900}.opsV2TaskDesc{font-size:10px;line-height:1.5;color:#747c89;margin-top:4px;max-width:760px}.opsV2Controls{grid-column:2/4;margin-top:4px;padding-top:12px;border-top:1px solid #f0f2f5;display:grid;gap:10px}.opsV2ControlLabel{font-size:9px;font-weight:900;color:#697180;text-transform:uppercase;letter-spacing:.05em}.opsV2ChipRow{display:flex;gap:7px;flex-wrap:wrap}.opsV2Chip{border:1px solid #d8dde5;background:#fff;color:#525b68;border-radius:999px;padding:7px 9px;font-size:9px;font-weight:850;cursor:pointer}.opsV2Chip.active{background:#111827;color:#fff;border-color:#111827}.opsV2Chip small{font-size:7px;opacity:.68;margin-left:3px;text-transform:uppercase}.opsV2CountLine{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.opsV2Count{width:86px!important;padding:8px!important;font-size:12px!important;font-weight:850;text-align:center}.opsV2CountHint{font-size:9px;color:#7a8190}.opsV2DoneBtn{border:1px solid #d6dae0;background:#fff;color:#344054;border-radius:9px;padding:8px 10px;font-size:9px;font-weight:900;cursor:pointer;white-space:nowrap}.opsV2DoneBtn.done{background:#237a45;border-color:#237a45;color:#fff}.opsV2DoneBtn:disabled{opacity:.5;cursor:default}.opsV2Empty{background:#fff;border:1px dashed #ced4dd;border-radius:14px;padding:30px;text-align:center;color:#7b8390;font-size:11px}
    .dailyOpsOnly .sidebar .navBtn:not([data-view="dailyops"]){display:none!important}.dailyOpsOnly .topbar .actions{display:none!important}.dailyOpsOnly #exportBtn{display:none!important}.dailyOpsOnly .sideBottom .smallLabel,.dailyOpsOnly #roleFilter{display:none!important}
    @media(max-width:900px){.opsV2Metrics{grid-template-columns:repeat(2,minmax(0,1fr))}.opsV2Task{grid-template-columns:34px minmax(0,1fr)}.opsV2DoneBtn{grid-column:2;justify-self:start}.opsV2Controls{grid-column:2}}
    @media(max-width:560px){.opsV2Metrics{grid-template-columns:1fr 1fr}.opsV2Hero{padding:17px}.opsV2Task{grid-template-columns:30px minmax(0,1fr);padding:13px}.opsV2Controls{grid-column:1/3}.opsV2DoneBtn{grid-column:1/3;justify-self:stretch}.opsV2Chip{padding:7px 8px}}
  `;
  document.head.appendChild(style);

  const escSafe=v=>typeof esc==='function'?esc(v):String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  const localDate=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
  const todayLabel=()=>new Date().toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'});
  const rowFor=key=>rows.find(x=>x.task_key===key)||null;
  const progressFor=key=>rowFor(key)?.account_progress||{};
  const checkedCount=(key,names)=>names.filter(n=>!!progressFor(key)[n]).length;
  const aiAccountNames=()=>AI_POST_ACCOUNTS.filter(name=>accounts.some(a=>a.owner_name===name));

  function installShell(){
    document.querySelector('[data-view="leadreview"]')?.remove();
    document.getElementById('leadreviewView')?.remove();
    let navBtn=document.querySelector('.navBtn[data-view="dailyops"]');
    if(!navBtn){
      const nav=document.querySelector('.sidebar .nav');
      if(nav){navBtn=document.createElement('button');navBtn.className='navBtn';navBtn.dataset.view='dailyops';navBtn.innerHTML='<span>Daily Ops</span><span id="navDailyOps" class="navCount">7</span>';const first=nav.querySelector('.navBtn');first?first.insertAdjacentElement('afterend',navBtn):nav.appendChild(navBtn)}
    }
    if(navBtn)navBtn.onclick=showDailyOps;
    let section=document.getElementById('dailyopsView');
    if(!section){
      const main=document.querySelector('main.main');
      if(main){section=document.createElement('section');section.id='dailyopsView';section.className='view';section.innerHTML='<div id="dailyOpsRoot" class="opsV2"></div>';main.appendChild(section)}
    }else section.innerHTML='<div id="dailyOpsRoot" class="opsV2"></div>';
  }

  function showDailyOps(){
    document.querySelectorAll('.view').forEach(x=>x.classList.remove('active'));
    document.querySelectorAll('.navBtn').forEach(x=>x.classList.remove('active'));
    document.getElementById('dailyopsView')?.classList.add('active');
    document.querySelector('.navBtn[data-view="dailyops"]')?.classList.add('active');
    if(document.getElementById('pageTitle'))document.getElementById('pageTitle').textContent='Daily Ops';
    if(document.getElementById('pageSub'))document.getElementById('pageSub').textContent='Seven daily LinkedIn responsibilities. Track completion, not individual DMs.';
    load();
  }

  async function resolveRole(){
    for(let i=0;i<40;i++){
      if(window.__outerhavenDashboardRole){role=window.__outerhavenDashboardRole;return role}
      if(typeof sb!=='undefined'){
        try{const {data:{session}}=await sb.auth.getSession();if(session){const r=await sb.rpc('dashboard_role');if(!r.error&&r.data){role=r.data;return role}}}catch{}
      }
      await new Promise(r=>setTimeout(r,250));
    }
    return null;
  }

  async function ensureToday(){
    const date=localDate();
    const existing=new Set(rows.map(x=>x.task_key));
    const missing=TASKS.filter(t=>!existing.has(t.key)).map(t=>({work_date:date,task_key:t.key,status:'due',item_count:0,account_progress:{}}));
    if(!missing.length)return;
    const res=await sb.from('daily_ops_checklist').upsert(missing,{onConflict:'work_date,task_key',ignoreDuplicates:true});
    if(res.error)throw res.error;
    const reread=await sb.from('daily_ops_checklist').select('*').eq('work_date',date);
    if(reread.error)throw reread.error;
    rows=reread.data||[];
  }

  function metricHtml(label,value,sub){return `<div class="opsV2Metric"><div class="k">${escSafe(label)}</div><div class="v">${escSafe(value)}</div><div class="s">${escSafe(sub)}</div></div>`}

  function accountChip(taskKey,name,label=''){
    const active=!!progressFor(taskKey)[name];
    return `<button type="button" class="opsV2Chip ${active?'active':''}" data-task-account="${escSafe(taskKey)}" data-account-name="${escSafe(name)}">${escSafe(name)}${label?`<small>${escSafe(label)}</small>`:''}</button>`;
  }

  function taskControls(task){
    const r=rowFor(task.key);if(!r)return'';
    if(task.key==='connections'){
      return `<div class="opsV2Controls"><div><div class="opsV2ControlLabel">Connections Sent</div><div class="opsV2CountLine"><input class="opsV2Count" data-task-count="${r.id}" type="number" min="0" value="${Number(r.item_count||0)}"><span class="opsV2CountHint">Target: 20 connections across 4 accounts · ${checkedCount('connections',accounts.map(a=>a.owner_name))}/4 accounts selected</span></div></div><div><div class="opsV2ControlLabel">Accounts Used Today</div><div class="opsV2ChipRow">${accounts.map(a=>accountChip('connections',a.owner_name)).join('')}</div></div></div>`;
    }
    if(task.key==='warmup'){
      return `<div class="opsV2Controls"><div><div class="opsV2ControlLabel">Accounts Warmed · ${checkedCount('warmup',accounts.map(a=>a.owner_name))}/${accounts.length}</div><div class="opsV2ChipRow">${accounts.map(a=>accountChip('warmup',a.owner_name)).join('')}</div></div></div>`;
    }
    if(task.key==='content_distribution'){
      const names=aiAccountNames();
      return `<div class="opsV2Controls"><div><div class="opsV2ControlLabel">Content Distribution · ${checkedCount('content_distribution',names)}/${names.length}</div><div class="opsV2ChipRow">${names.map(name=>accountChip('content_distribution',name,name==='Peter'?'Post':'Repost')).join('')}</div></div></div>`;
    }
    if(task.key==='work_leads'){
      return `<div class="opsV2Controls"><div><div class="opsV2ControlLabel">Appointments Set Today</div><div class="opsV2CountLine"><input class="opsV2Count" data-task-count="${r.id}" type="number" min="0" value="${Number(r.item_count||0)}"><span class="opsV2CountHint">Record the outcome only. The conversations stay in LinkedIn.</span></div></div></div>`;
    }
    return'';
  }

  function taskHtml(task){
    const r=rowFor(task.key);if(!r)return'';
    const done=r.status==='done';
    return `<article class="opsV2Task ${done?'done':''}"><div class="opsV2Number">${task.number}</div><div><div class="opsV2TaskTitle">${escSafe(task.title)}</div><div class="opsV2TaskDesc">${escSafe(task.description)}</div></div><button type="button" class="opsV2DoneBtn ${done?'done':''}" data-toggle-task="${r.id}">${done?'Done ✓':'Mark Done'}</button>${taskControls(task)}</article>`;
  }

  function render(){
    const root=document.getElementById('dailyOpsRoot');if(!root)return;
    const done=TASKS.filter(t=>rowFor(t.key)?.status==='done').length;
    const remaining=TASKS.length-done;
    const connectionCount=Number(rowFor('connections')?.item_count||0);
    const warmCount=checkedCount('warmup',accounts.map(a=>a.owner_name));
    const appointments=Number(rowFor('work_leads')?.item_count||0);
    const pct=Math.round((done/TASKS.length)*100);
    if(document.getElementById('navDailyOps'))document.getElementById('navDailyOps').textContent=String(remaining);
    root.innerHTML=`
      <section class="opsV2Hero"><div><div class="opsV2Eyebrow">TODAY · ${escSafe(todayLabel().toUpperCase())}</div><h2>LinkedIn Daily Operations</h2><p>One checklist for the actual work. LinkedIn remains the source of truth for individual comments, DMs, and conversations.</p></div><div class="opsV2ProgressWrap"><div class="opsV2ProgressTop"><div><div class="opsV2ProgressLabel">Daily Completion</div><div class="opsV2ProgressValue">${done}/${TASKS.length}</div></div><div class="opsV2ProgressLabel">${pct}%</div></div><div class="opsV2ProgressBar"><div class="opsV2ProgressFill" style="width:${pct}%"></div></div></div></section>
      <div class="opsV2Metrics">${metricHtml('Tasks Complete',`${done}/7`,remaining?`${remaining} remaining today`:'Daily ops complete')}${metricHtml('Connections Sent',String(connectionCount),'Target: 20 across 4 accounts')}${metricHtml('Accounts Warmed',`${warmCount}/${accounts.length}`,'All active LinkedIn accounts')}${metricHtml('Appointments Set',String(appointments),'Outcome from DM conversations')}</div>
      <section class="opsV2Accounts"><div class="opsV2AccountsHead"><div><div class="opsV2AccountsTitle">LinkedIn Accounts</div><div class="opsV2AccountsSub">A.I. post accounts are marked separately for Peter's post + repost workflow.</div></div><div class="opsV2AccountsSub">${accounts.length} active accounts</div></div><div class="opsV2AccountStrip">${accounts.map(a=>`<span class="opsV2AccountBadge ${AI_POST_ACCOUNTS.includes(a.owner_name)?'ai':''}">${escSafe(a.owner_name)}</span>`).join('')}</div></section>
      <div class="opsV2List">${TASKS.map(taskHtml).join('')}</div>`;
    bind();
  }

  function bind(){
    const root=document.getElementById('dailyOpsRoot');if(!root)return;
    root.querySelectorAll('[data-toggle-task]').forEach(btn=>btn.onclick=()=>toggleTask(btn.dataset.toggleTask,btn));
    root.querySelectorAll('[data-task-account]').forEach(btn=>btn.onclick=()=>toggleAccount(btn.dataset.taskAccount,btn.dataset.accountName));
    root.querySelectorAll('[data-task-count]').forEach(input=>input.onchange=()=>saveCount(input.dataset.taskCount,Number(input.value||0)));
  }

  async function toggleTask(id,button){
    if(button?.disabled)return;
    const r=rows.find(x=>x.id===id);if(!r)return;
    const done=r.status==='done',next=done?'due':'done';
    if(button)button.disabled=true;
    const payload={status:next,completed_at:next==='done'?new Date().toISOString():null,completed_by:next==='done'?(typeof currentUser!=='undefined'?currentUser?.id||null:null):null,updated_at:new Date().toISOString(),updated_by:typeof currentUser!=='undefined'?currentUser?.id||null:null};
    const res=await sb.from('daily_ops_checklist').update(payload).eq('id',id);
    if(res.error){alert(res.error.message);if(button)button.disabled=false;return}
    r.status=next;r.completed_at=payload.completed_at;r.completed_by=payload.completed_by;render();
  }

  async function toggleAccount(taskKey,name){
    const r=rowFor(taskKey);if(!r)return;
    const previous={...(r.account_progress||{})};
    const next={...previous,[name]:!previous[name]};
    r.account_progress=next;render();
    const res=await sb.from('daily_ops_checklist').update({account_progress:next,updated_at:new Date().toISOString(),updated_by:typeof currentUser!=='undefined'?currentUser?.id||null:null}).eq('id',r.id);
    if(res.error){r.account_progress=previous;render();alert(res.error.message)}
  }

  async function saveCount(id,count){
    const r=rows.find(x=>x.id===id);if(!r)return;
    const next=Math.max(0,Math.floor(Number(count)||0));
    const old=r.item_count;r.item_count=next;render();
    const res=await sb.from('daily_ops_checklist').update({item_count:next,updated_at:new Date().toISOString(),updated_by:typeof currentUser!=='undefined'?currentUser?.id||null:null}).eq('id',id);
    if(res.error){r.item_count=old;render();alert(res.error.message)}
  }

  async function load(){
    if(typeof sb==='undefined'||busy||!role)return;
    busy=true;
    try{
      const date=localDate();
      const [a,r]=await Promise.all([
        sb.from('daily_ops_accounts').select('id,owner_name,account_name,active,sort_order').eq('active',true).order('sort_order').order('created_at'),
        sb.from('daily_ops_checklist').select('*').eq('work_date',date).order('task_key')
      ]);
      if(a.error||r.error){console.error('daily ops v2',a.error||r.error);return}
      accounts=a.data||[];rows=r.data||[];
      await ensureToday();render();ensureRealtime();
    }catch(err){console.error('daily ops v2',err)}finally{busy=false}
  }

  function ensureRealtime(){
    if(channel||typeof sb==='undefined')return;
    channel=sb.channel('outerhaven-daily-ops-v2')
      .on('postgres_changes',{event:'*',schema:'public',table:'daily_ops_checklist'},()=>load())
      .on('postgres_changes',{event:'*',schema:'public',table:'daily_ops_accounts'},()=>load())
      .subscribe();
  }

  async function install(){
    installShell();
    role=await resolveRole();if(!['admin','ops'].includes(role))return;
    await load();
    if(role==='ops')showDailyOps();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
