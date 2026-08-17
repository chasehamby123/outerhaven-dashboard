(function(){
  if(window.__outerhavenDailyOps)return;
  window.__outerhavenDailyOps=true;

  let opsRole=null;
  let opsAccounts=[];
  let opsItems=[];
  let opsChannel=null;
  const TYPES=['post','comments','dms','follow_up','whatsapp'];
  const LABELS={post:'Post Today',comments:'Comments',dms:'DMs',follow_up:'Follow-ups',whatsapp:'WhatsApp Handoffs'};
  const SUBS={post:'Publish the scheduled LinkedIn post and save its URL.',comments:'Check new post comments and respond or move qualified people into DM.',dms:'Work unanswered LinkedIn conversations on this account.',follow_up:'Complete follow-ups that are due today.',whatsapp:'Move qualified relationships into the correct WhatsApp group.'};

  const style=document.createElement('style');
  style.textContent=`
    .dailyOpsWrap{display:grid;gap:16px}
    .dailyOpsTop{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;flex-wrap:wrap}
    .dailyOpsTop h2{margin:0;font-size:18px}.dailyOpsTop p{margin:5px 0 0;color:#747c89;font-size:11px;line-height:1.5}
    .dailyOpsAdminBtn{border:1px solid #d8dde5;background:#fff;border-radius:9px;padding:9px 11px;font-size:10px;font-weight:850;cursor:pointer}
    .dailyOpsMetrics{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
    .dailyOpsMetric{background:#fff;border:1px solid #e4e7eb;border-radius:14px;padding:15px}
    .dailyOpsMetric .k{font-size:9px;font-weight:850;color:#7a8190;text-transform:uppercase;letter-spacing:.07em}
    .dailyOpsMetric .v{font-size:27px;font-weight:850;margin-top:7px}.dailyOpsMetric .s{font-size:9px;color:#848b97;margin-top:4px}
    .dailyOpsAccounts{display:grid;gap:14px}
    .dailyOpsAccount{background:#fff;border:1px solid #e4e7eb;border-radius:15px;overflow:hidden}
    .dailyOpsAccountHead{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:15px 16px;border-bottom:1px solid #edf0f3}
    .dailyOpsAccountName{font-size:14px;font-weight:850}.dailyOpsAccountMeta{font-size:10px;color:#7a8190;margin-top:3px}
    .dailyOpsAccountRight{display:flex;align-items:center;gap:8px}.dailyOpsOpenLinkedIn{font-size:9px;font-weight:800;color:#344054;text-decoration:none;border:1px solid #d8dde5;padding:6px 8px;border-radius:7px}
    .dailyOpsStatus{font-size:9px;font-weight:850;padding:6px 8px;border-radius:999px;background:#fff4e5;color:#8a5700}.dailyOpsStatus.done{background:#eefaf2;color:#237a45}
    .dailyOpsTasks{display:grid}.dailyOpsTask{display:grid;grid-template-columns:minmax(190px,1fr) minmax(120px,180px) 92px;gap:12px;align-items:center;padding:13px 16px;border-bottom:1px solid #f0f2f5}.dailyOpsTask:last-child{border-bottom:0}
    .dailyOpsTask.off{opacity:.48;background:#fafbfc}.dailyOpsTaskTitle{font-size:11px;font-weight:850}.dailyOpsTaskSub{font-size:9px;color:#7b8390;line-height:1.45;margin-top:3px;max-width:620px}
    .dailyOpsCountWrap{display:flex;align-items:center;gap:7px;justify-content:flex-end}.dailyOpsCountWrap span{font-size:9px;color:#7a8190;font-weight:750}.dailyOpsCount{width:64px!important;min-width:64px!important;padding:7px!important;font-size:11px!important;text-align:center}
    .dailyOpsTaskBtn{border:1px solid #d6dae0;background:#fff;border-radius:8px;padding:8px 9px;font-size:9px;font-weight:850;cursor:pointer}.dailyOpsTaskBtn.done{background:#111827;color:#fff;border-color:#111827}.dailyOpsTaskBtn:disabled{opacity:.45;cursor:default}
    .dailyOpsPostUrl{width:100%!important;margin-top:7px!important;padding:7px 8px!important;font-size:9px!important}
    .dailyOpsEmpty{background:#fff;border:1px dashed #ced4dd;border-radius:14px;padding:36px;text-align:center;color:#7b8390;font-size:11px}
    .dailyOpsOnly .sidebar .navBtn:not([data-view="dailyops"]){display:none!important}.dailyOpsOnly .topbar .actions{display:none!important}.dailyOpsOnly #exportBtn{display:none!important}.dailyOpsOnly .sideBottom .smallLabel,.dailyOpsOnly #roleFilter{display:none!important}
    @media(max-width:850px){.dailyOpsMetrics{grid-template-columns:repeat(2,1fr)}.dailyOpsTask{grid-template-columns:1fr 110px}.dailyOpsTaskBtn{grid-column:2}.dailyOpsCountWrap{grid-column:2;grid-row:1}.dailyOpsTask>div:first-child{grid-row:1/3}}
    @media(max-width:560px){.dailyOpsMetrics{grid-template-columns:1fr 1fr}.dailyOpsTask{grid-template-columns:1fr}.dailyOpsCountWrap,.dailyOpsTaskBtn{grid-column:1;grid-row:auto;justify-content:flex-start}.dailyOpsTask>div:first-child{grid-row:auto}.dailyOpsAccountHead{align-items:flex-start}.dailyOpsAccountRight{flex-direction:column;align-items:flex-end}}
  `;
  document.head.appendChild(style);

  function localDate(){const d=new Date();const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),day=String(d.getDate()).padStart(2,'0');return `${y}-${m}-${day}`}
  function todayLabel(){return new Date().toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'})}
  function isPostRequired(a){return (a.posting_days||[]).includes(new Date().getDay())}
  function itemFor(accountId,type){return opsItems.find(x=>x.account_id===accountId&&x.item_type===type)}
  function isRequired(a,type){return type!=='post'||isPostRequired(a)}
  function completeAccount(a){const required=TYPES.filter(t=>isRequired(a,t));return required.every(t=>itemFor(a.id,t)?.status==='done')}

  function showDailyOps(){
    document.querySelectorAll('.view').forEach(x=>x.classList.remove('active'));
    document.querySelectorAll('.navBtn').forEach(x=>x.classList.remove('active'));
    document.getElementById('dailyopsView')?.classList.add('active');
    document.querySelector('.navBtn[data-view="dailyops"]')?.classList.add('active');
    if(document.getElementById('pageTitle'))document.getElementById('pageTitle').textContent='Daily Ops';
    if(document.getElementById('pageSub'))document.getElementById('pageSub').textContent='Run today’s LinkedIn activity across every account.';
    loadOps();
  }

  function installShell(){
    if(document.getElementById('dailyopsView'))return;
    const nav=document.querySelector('.sidebar .nav');
    if(nav){
      const b=document.createElement('button');b.className='navBtn';b.dataset.view='dailyops';b.innerHTML='<span>Daily Ops</span><span id="navDailyOps" class="navCount">0</span>';b.onclick=showDailyOps;
      const first=nav.querySelector('.navBtn');if(first)first.insertAdjacentElement('afterend',b);else nav.appendChild(b);
    }
    const main=document.querySelector('main.main');
    if(main){
      const s=document.createElement('section');s.id='dailyopsView';s.className='view';s.innerHTML='<div id="dailyOpsRoot" class="dailyOpsWrap"></div>';main.appendChild(s);
    }
  }

  async function getRole(){
    const {data,error}=await sb.rpc('dashboard_role');
    if(error){console.error('daily ops role',error);return null}
    return data||null;
  }

  function enforceRole(){
    if(opsRole!=='ops')return;
    document.body.classList.add('dailyOpsOnly');
    showDailyOps();
  }

  async function ensureToday(){
    if(!opsAccounts.length)return;
    const date=localDate();
    const {data,error}=await sb.from('daily_ops_items').select('*').eq('work_date',date);
    if(error){console.error('daily ops items',error);return}
    opsItems=data||[];
    const missing=[];
    for(const a of opsAccounts){
      for(const type of TYPES){
        if(opsItems.some(x=>x.account_id===a.id&&x.item_type===type))continue;
        missing.push({account_id:a.id,work_date:date,item_type:type,status:isRequired(a,type)?'due':'not_needed',item_count:0});
      }
    }
    if(missing.length){
      const ins=await sb.from('daily_ops_items').insert(missing).select('*');
      if(ins.error){console.error('daily ops seed',ins.error);return}
      opsItems.push(...(ins.data||[]));
    }
  }

  async function loadOps(){
    if(!opsRole)return;
    const {data,error}=await sb.from('daily_ops_accounts').select('*').eq('active',true).order('sort_order').order('created_at');
    if(error){console.error('daily ops accounts',error);return}
    opsAccounts=data||[];
    await ensureToday();
    renderOps();
    ensureRealtime();
  }

  function renderMetrics(){
    const requiredPosts=opsAccounts.filter(isPostRequired);
    const posted=requiredPosts.filter(a=>itemFor(a.id,'post')?.status==='done').length;
    const complete=opsAccounts.filter(completeAccount).length;
    const requiredItems=opsAccounts.flatMap(a=>TYPES.filter(t=>isRequired(a,t)).map(t=>itemFor(a.id,t))).filter(Boolean);
    const done=requiredItems.filter(x=>x.status==='done').length;
    const open=requiredItems.length-done;
    return `
      <div class="dailyOpsMetric"><div class="k">Accounts Complete</div><div class="v">${complete}/${opsAccounts.length}</div><div class="s">All required checks finished</div></div>
      <div class="dailyOpsMetric"><div class="k">Posts Today</div><div class="v">${posted}/${requiredPosts.length}</div><div class="s">Scheduled posts published</div></div>
      <div class="dailyOpsMetric"><div class="k">Open Actions</div><div class="v">${open}</div><div class="s">Still needs attention</div></div>
      <div class="dailyOpsMetric"><div class="k">Completed</div><div class="v">${done}</div><div class="s">Checks completed today</div></div>`;
  }

  function taskHtml(a,type){
    const it=itemFor(a.id,type);if(!it)return'';
    const required=isRequired(a,type),done=it.status==='done';
    const controls=type==='post'
      ? `<div>${required?`<input class="dailyOpsPostUrl" data-post-url="${it.id}" value="${esc(it.reference_url||'')}" placeholder="Paste LinkedIn post URL">`:'<span class="compactMeta">No post scheduled</span>'}</div>`
      : `<div class="dailyOpsCountWrap"><span>Handled</span><input class="dailyOpsCount" data-count="${it.id}" type="number" min="0" value="${Number(it.item_count||0)}"></div>`;
    return `<div class="dailyOpsTask ${required?'':'off'}"><div><div class="dailyOpsTaskTitle">${LABELS[type]}</div><div class="dailyOpsTaskSub">${required?SUBS[type]:'Not scheduled for this account today.'}</div></div>${controls}<button class="dailyOpsTaskBtn ${done?'done':''}" data-toggle-item="${it.id}" ${required?'':'disabled'}>${done?'Done ✓':type==='post'?'Mark Posted':'Mark Done'}</button></div>`;
  }

  function accountHtml(a){
    const complete=completeAccount(a);
    return `<article class="dailyOpsAccount"><div class="dailyOpsAccountHead"><div><div class="dailyOpsAccountName">${esc(a.owner_name)}</div><div class="dailyOpsAccountMeta">${esc(a.account_name)} · ${isPostRequired(a)?'Post scheduled today':'No post scheduled today'}</div></div><div class="dailyOpsAccountRight">${a.linkedin_url?`<a class="dailyOpsOpenLinkedIn" href="${esc(a.linkedin_url)}" target="_blank" rel="noopener">Open LinkedIn</a>`:''}<span class="dailyOpsStatus ${complete?'done':''}">${complete?'Complete':'Needs Attention'}</span></div></div><div class="dailyOpsTasks">${TYPES.map(t=>taskHtml(a,t)).join('')}</div></article>`;
  }

  function renderOps(){
    const root=document.getElementById('dailyOpsRoot');if(!root)return;
    const openCount=opsAccounts.reduce((n,a)=>n+TYPES.filter(t=>isRequired(a,t)&&itemFor(a.id,t)?.status!=='done').length,0);
    if(document.getElementById('navDailyOps'))document.getElementById('navDailyOps').textContent=String(openCount);
    root.innerHTML=`<div class="dailyOpsTop"><div><h2>${todayLabel()}</h2><p>Work each LinkedIn account from top to bottom. Counts are the number of conversations or handoffs handled today.</p></div>${opsRole==='admin'?'<button id="dailyOpsAddAccount" class="dailyOpsAdminBtn">+ LinkedIn Account</button>':''}</div><div class="dailyOpsMetrics">${renderMetrics()}</div><div class="dailyOpsAccounts">${opsAccounts.length?opsAccounts.map(accountHtml).join(''):'<div class="dailyOpsEmpty">No active LinkedIn accounts yet.</div>'}</div>`;
    root.querySelectorAll('[data-count]').forEach(x=>x.onchange=()=>saveCount(x.dataset.count,Number(x.value||0)));
    root.querySelectorAll('[data-post-url]').forEach(x=>x.onchange=()=>saveUrl(x.dataset.postUrl,x.value.trim()));
    root.querySelectorAll('[data-toggle-item]').forEach(b=>b.onclick=()=>toggleItem(b.dataset.toggleItem));
    if(document.getElementById('dailyOpsAddAccount'))document.getElementById('dailyOpsAddAccount').onclick=addAccount;
  }

  async function saveCount(id,count){
    const {error}=await sb.from('daily_ops_items').update({item_count:Math.max(0,count),updated_at:new Date().toISOString(),updated_by:currentUser?.id||null}).eq('id',id);if(error)alert(error.message);else await refreshItems();
  }
  async function saveUrl(id,url){
    const {error}=await sb.from('daily_ops_items').update({reference_url:url||null,updated_at:new Date().toISOString(),updated_by:currentUser?.id||null}).eq('id',id);if(error)alert(error.message);else await refreshItems();
  }
  async function toggleItem(id){
    const it=opsItems.find(x=>x.id===id);if(!it)return;
    const next=it.status==='done'?'due':'done';
    if(it.item_type==='post'&&next==='done'&&!it.reference_url){alert('Paste the LinkedIn post URL first so OuterHaven can track the post.');return}
    const payload={status:next,completed_at:next==='done'?new Date().toISOString():null,completed_by:next==='done'?(currentUser?.id||null):null,updated_at:new Date().toISOString(),updated_by:currentUser?.id||null};
    const {error}=await sb.from('daily_ops_items').update(payload).eq('id',id);if(error)alert(error.message);else await refreshItems();
  }
  async function refreshItems(){const {data,error}=await sb.from('daily_ops_items').select('*').eq('work_date',localDate());if(!error){opsItems=data||[];renderOps()}}

  async function addAccount(){
    const owner=prompt('Account owner name, for example Peter');if(!owner?.trim())return;
    const label=prompt('Account label',`${owner.trim()} LinkedIn`)||`${owner.trim()} LinkedIn`;
    const url=prompt('LinkedIn profile URL (optional)','')||'';
    const {error}=await sb.from('daily_ops_accounts').insert({owner_name:owner.trim(),account_name:label.trim(),linkedin_url:url.trim()||null,posting_days:[1,2,3,4,5],sort_order:(opsAccounts.length+1)*10});
    if(error){alert(error.message);return}await loadOps();
  }

  function ensureRealtime(){
    if(opsChannel)return;
    opsChannel=sb.channel('outerhaven-daily-ops').on('postgres_changes',{event:'*',schema:'public',table:'daily_ops_items'},()=>loadOps()).on('postgres_changes',{event:'*',schema:'public',table:'daily_ops_accounts'},()=>loadOps()).subscribe();
  }

  async function install(){
    installShell();
    let tries=0;
    while(!opsRole&&tries<12){opsRole=await getRole();if(!opsRole){await new Promise(r=>setTimeout(r,500));tries++;}}
    if(!opsRole)return;
    enforceRole();
    await loadOps();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
