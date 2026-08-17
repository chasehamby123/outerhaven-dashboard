(function(){
  if(window.__outerhavenDailyOps)return;
  window.__outerhavenDailyOps=true;

  let opsRole=null;
  let opsAccounts=[];
  let opsItems=[];
  let opsDms=[];
  let opsChannel=null;
  let openQueue={accountId:null,type:null};

  const MANUAL_TYPES=['post','comments','follow_up'];
  const LABELS={post:'Post Today',comments:'Comments',dms:'DMs',follow_up:'Follow-ups',whatsapp:'WhatsApp Handoffs'};
  const SUBS={
    post:'Publish the scheduled LinkedIn post and save its URL.',
    comments:'Check new post comments and respond or move qualified people into DM.',
    dms:'Qualified Prosp replies appear here automatically. Open the queue and reply from the correct LinkedIn account.',
    follow_up:'Complete follow-ups that are due today.',
    whatsapp:'Leads move here after you mark their LinkedIn DM replied. Add them to the correct WhatsApp group.'
  };

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
    .dailyOpsTasks{display:grid}.dailyOpsTask{display:grid;grid-template-columns:minmax(210px,1fr) minmax(120px,190px) 102px;gap:12px;align-items:center;padding:13px 16px;border-bottom:1px solid #f0f2f5}.dailyOpsTask.off{opacity:.48;background:#fafbfc}
    .dailyOpsTaskTitle{display:flex;align-items:center;gap:7px;font-size:11px;font-weight:850}.dailyOpsTaskSub{font-size:9px;color:#7b8390;line-height:1.45;margin-top:3px;max-width:650px}
    .dailyOpsCountWrap{display:flex;align-items:center;gap:7px;justify-content:flex-end}.dailyOpsCountWrap span{font-size:9px;color:#7a8190;font-weight:750}.dailyOpsCount{width:64px!important;min-width:64px!important;padding:7px!important;font-size:11px!important;text-align:center}
    .dailyOpsTaskBtn{border:1px solid #d6dae0;background:#fff;border-radius:8px;padding:8px 9px;font-size:9px;font-weight:850;cursor:pointer}.dailyOpsTaskBtn.done{background:#111827;color:#fff;border-color:#111827}.dailyOpsTaskBtn:disabled{opacity:.45;cursor:default}
    .dailyOpsQueueBtn{border:1px solid #cfd5de;background:#fff;border-radius:8px;padding:8px 9px;font-size:9px;font-weight:850;cursor:pointer}.dailyOpsQueueBtn.active{background:#111827;color:#fff;border-color:#111827}
    .dailyOpsQueueCount{display:inline-flex;align-items:center;justify-content:center;min-width:21px;height:21px;padding:0 6px;border-radius:999px;background:#fff1f1;color:#a32121;font-size:9px;font-weight:900}.dailyOpsQueueCount.ready{background:#eef7ff;color:#225e9a}.dailyOpsQueueCount.zero{background:#f2f4f7;color:#7b8390}
    .dailyOpsPostUrl{width:100%!important;margin-top:7px!important;padding:7px 8px!important;font-size:9px!important}
    .dailyOpsQueuePanel{grid-column:1/-1;background:#f8f9fb;border-top:1px solid #edf0f3;padding:13px 16px;display:grid;gap:9px}
    .dailyOpsQueueEmpty{font-size:10px;color:#7b8390;padding:11px;border:1px dashed #d5dae2;border-radius:9px;background:#fff}
    .dailyOpsDmCard{background:#fff;border:1px solid #e2e6ec;border-radius:11px;padding:12px;display:grid;gap:9px}
    .dailyOpsDmTop{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
    .dailyOpsDmName{font-size:11px;font-weight:900}.dailyOpsDmMeta{font-size:9px;color:#747c89;margin-top:3px;line-height:1.45}
    .dailyOpsDmBadges{display:flex;gap:5px;align-items:center;flex-wrap:wrap;justify-content:flex-end}.dailyOpsDmBadge{font-size:8px;font-weight:850;padding:5px 7px;border-radius:999px;background:#f2f4f7;color:#566070}.dailyOpsDmBadge.buy{background:#eef7ff;color:#225e9a}.dailyOpsDmBadge.sell{background:#f5f0ff;color:#6847a6}
    .dailyOpsReply{font-size:10px;line-height:1.55;color:#343b46;background:#f7f8fa;border-radius:8px;padding:9px 10px;white-space:pre-wrap;word-break:break-word}
    .dailyOpsDmActions{display:flex;align-items:center;justify-content:flex-end;gap:7px;flex-wrap:wrap}.dailyOpsDmActions a,.dailyOpsDmActions button{font-size:9px;font-weight:850;border-radius:8px;padding:7px 9px;text-decoration:none;cursor:pointer}.dailyOpsDmActions a{border:1px solid #d6dae0;color:#344054;background:#fff}.dailyOpsDmActions button{border:1px solid #111827;background:#111827;color:#fff}.dailyOpsDmActions button.secondary{background:#fff;color:#344054;border-color:#d6dae0}
    .dailyOpsUnassigned{background:#fff7e9;border:1px solid #f0d39c;border-radius:14px;padding:14px}.dailyOpsUnassigned h3{font-size:12px;margin:0}.dailyOpsUnassigned p{font-size:9px;color:#7a6846;margin:4px 0 10px}.dailyOpsAssign{display:flex;gap:7px;align-items:center}.dailyOpsAssign select{font-size:9px;padding:7px;border:1px solid #d6dae0;border-radius:7px;background:#fff}.dailyOpsAssign button{font-size:9px;font-weight:850;padding:7px 9px;border:1px solid #111827;background:#111827;color:#fff;border-radius:7px;cursor:pointer}
    .dailyOpsEmpty{background:#fff;border:1px dashed #ced4dd;border-radius:14px;padding:36px;text-align:center;color:#7b8390;font-size:11px}
    .dailyOpsOnly .sidebar .navBtn:not([data-view="dailyops"]){display:none!important}.dailyOpsOnly .topbar .actions{display:none!important}.dailyOpsOnly #exportBtn{display:none!important}.dailyOpsOnly .sideBottom .smallLabel,.dailyOpsOnly #roleFilter{display:none!important}
    @media(max-width:850px){.dailyOpsMetrics{grid-template-columns:repeat(2,1fr)}.dailyOpsTask{grid-template-columns:1fr 120px}.dailyOpsTaskBtn,.dailyOpsQueueBtn{grid-column:2}.dailyOpsCountWrap{grid-column:2;grid-row:1}.dailyOpsTask>div:first-child{grid-row:1/3}}
    @media(max-width:560px){.dailyOpsMetrics{grid-template-columns:1fr 1fr}.dailyOpsTask{grid-template-columns:1fr}.dailyOpsCountWrap,.dailyOpsTaskBtn,.dailyOpsQueueBtn{grid-column:1;grid-row:auto;justify-content:flex-start}.dailyOpsTask>div:first-child{grid-row:auto}.dailyOpsAccountHead{align-items:flex-start}.dailyOpsAccountRight{flex-direction:column;align-items:flex-end}.dailyOpsDmTop{display:grid}.dailyOpsDmBadges{justify-content:flex-start}}
  `;
  document.head.appendChild(style);

  function safeEsc(v){return typeof esc==='function'?esc(v):String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}
  function localDate(){const d=new Date();const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),day=String(d.getDate()).padStart(2,'0');return `${y}-${m}-${day}`}
  function todayLabel(){return new Date().toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'})}
  function isPostRequired(a){return (a.posting_days||[]).includes(new Date().getDay())}
  function itemFor(accountId,type){return opsItems.find(x=>x.account_id===accountId&&x.item_type===type)}
  function dmsFor(accountId,status){return opsDms.filter(x=>x.account_id===accountId&&x.status===status)}
  function unassignedDms(){return opsDms.filter(x=>!x.account_id)}
  function manualComplete(a,type){if(type==='post'&&!isPostRequired(a))return true;return itemFor(a.id,type)?.status==='done'}
  function completeAccount(a){return manualComplete(a,'post')&&manualComplete(a,'comments')&&manualComplete(a,'follow_up')&&dmsFor(a.id,'needs_reply').length===0&&dmsFor(a.id,'replied').length===0}
  function sideLabel(dm){return dm.qualification_decision==='qualified_buy_side'?'Buy Side':'Sell Side'}
  function kindLabel(dm){if(dm.qualification_decision==='qualified_buy_side')return'';return dm.sell_side_kind==='direct_sponsor'?'Direct Sponsor':'Deal Source'}

  function showDailyOps(){
    document.querySelectorAll('.view').forEach(x=>x.classList.remove('active'));
    document.querySelectorAll('.navBtn').forEach(x=>x.classList.remove('active'));
    document.getElementById('dailyopsView')?.classList.add('active');
    document.querySelector('.navBtn[data-view="dailyops"]')?.classList.add('active');
    if(document.getElementById('pageTitle'))document.getElementById('pageTitle').textContent='Daily Ops';
    if(document.getElementById('pageSub'))document.getElementById('pageSub').textContent='Run today’s LinkedIn activity and qualified reply handoffs.';
    loadOps();
  }

  function installShell(){
    if(document.getElementById('dailyopsView'))return;
    const nav=document.querySelector('.sidebar .nav');
    if(nav){const b=document.createElement('button');b.className='navBtn';b.dataset.view='dailyops';b.innerHTML='<span>Daily Ops</span><span id="navDailyOps" class="navCount">0</span>';b.onclick=showDailyOps;const first=nav.querySelector('.navBtn');if(first)first.insertAdjacentElement('afterend',b);else nav.appendChild(b)}
    const main=document.querySelector('main.main');
    if(main){const s=document.createElement('section');s.id='dailyopsView';s.className='view';s.innerHTML='<div id="dailyOpsRoot" class="dailyOpsWrap"></div>';main.appendChild(s)}
  }

  async function getRole(){const {data,error}=await sb.rpc('dashboard_role');if(error){console.error('daily ops role',error);return null}return data||null}
  function enforceRole(){if(opsRole!=='ops')return;document.body.classList.add('dailyOpsOnly');showDailyOps()}

  async function ensureToday(){
    if(!opsAccounts.length)return;
    const date=localDate();
    const {data,error}=await sb.from('daily_ops_items').select('*').eq('work_date',date);
    if(error){console.error('daily ops items',error);return}
    opsItems=data||[];
    const missing=[];
    for(const a of opsAccounts){for(const type of MANUAL_TYPES){if(opsItems.some(x=>x.account_id===a.id&&x.item_type===type))continue;missing.push({account_id:a.id,work_date:date,item_type:type,status:type==='post'&&!isPostRequired(a)?'not_needed':'due',item_count:0})}}
    if(missing.length){const ins=await sb.from('daily_ops_items').insert(missing).select('*');if(ins.error){console.error('daily ops seed',ins.error);return}opsItems.push(...(ins.data||[]))}
  }

  async function loadOps(){
    if(!opsRole)return;
    const [accountsRes,dmsRes]=await Promise.all([
      sb.from('daily_ops_accounts').select('*').eq('active',true).order('sort_order').order('created_at'),
      sb.from('daily_ops_dms').select('*').in('status',['needs_reply','replied']).order('created_at',{ascending:false})
    ]);
    if(accountsRes.error){console.error('daily ops accounts',accountsRes.error);return}
    if(dmsRes.error){console.error('daily ops dms',dmsRes.error);return}
    opsAccounts=accountsRes.data||[];opsDms=dmsRes.data||[];
    await ensureToday();
    renderOps();ensureRealtime();
  }

  function renderMetrics(){
    const requiredPosts=opsAccounts.filter(isPostRequired);
    const posted=requiredPosts.filter(a=>itemFor(a.id,'post')?.status==='done').length;
    const needsReply=opsDms.filter(x=>x.status==='needs_reply').length;
    const readyWhatsapp=opsDms.filter(x=>x.status==='replied').length;
    const complete=opsAccounts.filter(completeAccount).length;
    return `<div class="dailyOpsMetric"><div class="k">Accounts Complete</div><div class="v">${complete}/${opsAccounts.length}</div><div class="s">All current work cleared</div></div><div class="dailyOpsMetric"><div class="k">Posts Today</div><div class="v">${posted}/${requiredPosts.length}</div><div class="s">Scheduled posts published</div></div><div class="dailyOpsMetric"><div class="k">DMs Need Reply</div><div class="v">${needsReply}</div><div class="s">Qualified replies waiting</div></div><div class="dailyOpsMetric"><div class="k">Ready for WhatsApp</div><div class="v">${readyWhatsapp}</div><div class="s">Replied and ready to move</div></div>`;
  }

  function manualTaskHtml(a,type){
    const it=itemFor(a.id,type);if(!it)return'';
    const required=type!=='post'||isPostRequired(a),done=it.status==='done';
    const controls=type==='post'?`<div>${required?`<input class="dailyOpsPostUrl" data-post-url="${it.id}" value="${safeEsc(it.reference_url||'')}" placeholder="Paste LinkedIn post URL">`:'<span class="compactMeta">No post scheduled</span>'}</div>`:`<div class="dailyOpsCountWrap"><span>Handled</span><input class="dailyOpsCount" data-count="${it.id}" type="number" min="0" value="${Number(it.item_count||0)}"></div>`;
    return `<div class="dailyOpsTask ${required?'':'off'}"><div><div class="dailyOpsTaskTitle">${LABELS[type]}</div><div class="dailyOpsTaskSub">${required?SUBS[type]:'Not scheduled for this account today.'}</div></div>${controls}<button class="dailyOpsTaskBtn ${done?'done':''}" data-toggle-item="${it.id}" ${required?'':'disabled'}>${done?'Done ✓':type==='post'?'Mark Posted':'Mark Done'}</button></div>`;
  }

  function queueTaskHtml(a,type){
    const status=type==='dms'?'needs_reply':'replied';
    const count=dmsFor(a.id,status).length;
    const open=openQueue.accountId===a.id&&openQueue.type===type;
    return `<div class="dailyOpsTask"><div><div class="dailyOpsTaskTitle">${LABELS[type]} <span class="dailyOpsQueueCount ${type==='whatsapp'?'ready':''} ${count===0?'zero':''}">${count}</span></div><div class="dailyOpsTaskSub">${SUBS[type]}</div></div><div></div><button class="dailyOpsQueueBtn ${open?'active':''}" data-open-queue="${type}" data-account="${a.id}">${open?'Close':type==='dms'?'Open DMs':'Open Handoffs'}</button></div>${open?queuePanelHtml(a,type):''}`;
  }

  function dmCardHtml(dm,mode){
    const side=sideLabel(dm),kind=kindLabel(dm),confidence=Math.round(Number(dm.qualification_confidence||0)*100);
    const action=mode==='dms'?`<button data-mark-replied="${dm.id}">Mark Replied</button>`:`<button data-mark-whatsapp="${dm.id}">Added to WhatsApp</button>`;
    return `<article class="dailyOpsDmCard"><div class="dailyOpsDmTop"><div><div class="dailyOpsDmName">${safeEsc(dm.lead_name||'Unknown lead')}</div><div class="dailyOpsDmMeta">${safeEsc(dm.company_name||'Company not provided')}${dm.headline?` · ${safeEsc(dm.headline)}`:''}${dm.campaign_name?`<br>${safeEsc(dm.campaign_name)}`:''}</div></div><div class="dailyOpsDmBadges"><span class="dailyOpsDmBadge ${side==='Buy Side'?'buy':'sell'}">${side}</span>${kind?`<span class="dailyOpsDmBadge">${kind}</span>`:''}<span class="dailyOpsDmBadge">${confidence}%</span></div></div><div class="dailyOpsReply">${safeEsc(dm.reply_text||'Reply text unavailable')}</div><div class="dailyOpsDmActions">${dm.linkedin_url?`<a href="${safeEsc(dm.linkedin_url)}" target="_blank" rel="noopener">Open LinkedIn</a>`:''}${mode==='whatsapp'?`<button class="secondary" data-send-back="${dm.id}">Back to DMs</button>`:''}${action}</div></article>`;
  }

  function queuePanelHtml(a,type){
    const status=type==='dms'?'needs_reply':'replied';
    const rows=dmsFor(a.id,status);
    return `<div class="dailyOpsQueuePanel">${rows.length?rows.map(dm=>dmCardHtml(dm,type)).join(''):`<div class="dailyOpsQueueEmpty">${type==='dms'?'No qualified replies are waiting on this account.':'No replied leads are waiting to be added to WhatsApp.'}</div>`}</div>`;
  }

  function accountHtml(a){
    const complete=completeAccount(a),needReply=dmsFor(a.id,'needs_reply').length,ready=dmsFor(a.id,'replied').length;
    return `<article class="dailyOpsAccount"><div class="dailyOpsAccountHead"><div><div class="dailyOpsAccountName">${safeEsc(a.owner_name)}</div><div class="dailyOpsAccountMeta">${safeEsc(a.account_name)} · ${needReply} DM${needReply===1?'':'s'} waiting · ${ready} WhatsApp handoff${ready===1?'':'s'}</div></div><div class="dailyOpsAccountRight">${a.linkedin_url?`<a class="dailyOpsOpenLinkedIn" href="${safeEsc(a.linkedin_url)}" target="_blank" rel="noopener">Open LinkedIn</a>`:''}<span class="dailyOpsStatus ${complete?'done':''}">${complete?'Complete':'Needs Attention'}</span></div></div><div class="dailyOpsTasks">${manualTaskHtml(a,'post')}${manualTaskHtml(a,'comments')}${queueTaskHtml(a,'dms')}${manualTaskHtml(a,'follow_up')}${queueTaskHtml(a,'whatsapp')}</div></article>`;
  }

  function unassignedHtml(){
    const rows=unassignedDms();if(!rows.length)return'';
    return `<section class="dailyOpsUnassigned"><h3>Unassigned Qualified Replies · ${rows.length}</h3><p>OuterHaven could not identify which LinkedIn sender produced these replies. Assign each one once and future replies from that sender will route automatically.</p>${rows.map(dm=>`<article class="dailyOpsDmCard"><div class="dailyOpsDmTop"><div><div class="dailyOpsDmName">${safeEsc(dm.lead_name||'Unknown lead')}</div><div class="dailyOpsDmMeta">${safeEsc(dm.company_name||'Company not provided')} · ${safeEsc(sideLabel(dm))}</div></div></div><div class="dailyOpsReply">${safeEsc(dm.reply_text||'Reply text unavailable')}</div><div class="dailyOpsAssign"><select data-assign-select="${dm.id}"><option value="">Choose LinkedIn account</option>${opsAccounts.map(a=>`<option value="${a.id}">${safeEsc(a.owner_name)}</option>`).join('')}</select><button data-assign-dm="${dm.id}">Assign</button></div></article>`).join('')}</section>`;
  }

  function renderOps(){
    const root=document.getElementById('dailyOpsRoot');if(!root)return;
    const manualOpen=opsAccounts.reduce((n,a)=>n+['post','comments','follow_up'].filter(t=>!manualComplete(a,t)).length,0);
    const queueOpen=opsDms.length;
    if(document.getElementById('navDailyOps'))document.getElementById('navDailyOps').textContent=String(manualOpen+queueOpen);
    root.innerHTML=`<div class="dailyOpsTop"><div><h2>${todayLabel()}</h2><p>Qualified LinkedIn replies flow into the correct account automatically. Reply to them, then move them into WhatsApp when the handoff is complete.</p></div>${opsRole==='admin'?'<button id="dailyOpsAddAccount" class="dailyOpsAdminBtn">+ LinkedIn Account</button>':''}</div><div class="dailyOpsMetrics">${renderMetrics()}</div>${unassignedHtml()}<div class="dailyOpsAccounts">${opsAccounts.length?opsAccounts.map(accountHtml).join(''):'<div class="dailyOpsEmpty">No active LinkedIn accounts yet.</div>'}</div>`;
    bindOps();
  }

  function bindOps(){
    const root=document.getElementById('dailyOpsRoot');if(!root)return;
    root.querySelectorAll('[data-count]').forEach(x=>x.onchange=()=>saveCount(x.dataset.count,Number(x.value||0)));
    root.querySelectorAll('[data-post-url]').forEach(x=>x.onchange=()=>saveUrl(x.dataset.postUrl,x.value.trim()));
    root.querySelectorAll('[data-toggle-item]').forEach(b=>b.onclick=()=>toggleItem(b.dataset.toggleItem));
    root.querySelectorAll('[data-open-queue]').forEach(b=>b.onclick=()=>{const same=openQueue.accountId===b.dataset.account&&openQueue.type===b.dataset.openQueue;openQueue=same?{accountId:null,type:null}:{accountId:b.dataset.account,type:b.dataset.openQueue};renderOps()});
    root.querySelectorAll('[data-mark-replied]').forEach(b=>b.onclick=()=>markReplied(b.dataset.markReplied));
    root.querySelectorAll('[data-mark-whatsapp]').forEach(b=>b.onclick=()=>markWhatsapp(b.dataset.markWhatsapp));
    root.querySelectorAll('[data-send-back]').forEach(b=>b.onclick=()=>sendBackToDms(b.dataset.sendBack));
    root.querySelectorAll('[data-assign-dm]').forEach(b=>b.onclick=()=>{const select=root.querySelector(`[data-assign-select="${b.dataset.assignDm}"]`);if(!select?.value){alert('Choose a LinkedIn account first.');return}assignDm(b.dataset.assignDm,select.value)});
    if(document.getElementById('dailyOpsAddAccount'))document.getElementById('dailyOpsAddAccount').onclick=addAccount;
  }

  async function saveCount(id,count){const {error}=await sb.from('daily_ops_items').update({item_count:Math.max(0,count),updated_at:new Date().toISOString(),updated_by:currentUser?.id||null}).eq('id',id);if(error)alert(error.message);else await refreshItems()}
  async function saveUrl(id,url){const {error}=await sb.from('daily_ops_items').update({reference_url:url||null,updated_at:new Date().toISOString(),updated_by:currentUser?.id||null}).eq('id',id);if(error)alert(error.message);else await refreshItems()}
  async function toggleItem(id){const it=opsItems.find(x=>x.id===id);if(!it)return;const next=it.status==='done'?'due':'done';if(it.item_type==='post'&&next==='done'&&!it.reference_url){alert('Paste the LinkedIn post URL first so OuterHaven can track the post.');return}const payload={status:next,completed_at:next==='done'?new Date().toISOString():null,completed_by:next==='done'?(currentUser?.id||null):null,updated_at:new Date().toISOString(),updated_by:currentUser?.id||null};const {error}=await sb.from('daily_ops_items').update(payload).eq('id',id);if(error)alert(error.message);else await refreshItems()}
  async function refreshItems(){const {data,error}=await sb.from('daily_ops_items').select('*').eq('work_date',localDate());if(!error){opsItems=data||[];renderOps()}}

  async function updateDm(id,payload){const {error}=await sb.from('daily_ops_dms').update({...payload,updated_at:new Date().toISOString()}).eq('id',id);if(error){alert(error.message);return}await refreshDms()}
  async function markReplied(id){await updateDm(id,{status:'replied',replied_at:new Date().toISOString(),replied_by:currentUser?.id||null})}
  async function markWhatsapp(id){await updateDm(id,{status:'whatsapp',whatsapp_added_at:new Date().toISOString(),whatsapp_added_by:currentUser?.id||null})}
  async function sendBackToDms(id){await updateDm(id,{status:'needs_reply',replied_at:null,replied_by:null,whatsapp_added_at:null,whatsapp_added_by:null})}
  async function assignDm(id,accountId){await updateDm(id,{account_id:accountId})}
  async function refreshDms(){const {data,error}=await sb.from('daily_ops_dms').select('*').in('status',['needs_reply','replied']).order('created_at',{ascending:false});if(!error){opsDms=data||[];renderOps()}}

  async function addAccount(){
    const owner=prompt('Account owner name, for example Peter');if(!owner?.trim())return;
    const label=prompt('Account label',`${owner.trim()} LinkedIn`)||`${owner.trim()} LinkedIn`;
    const url=prompt('LinkedIn profile URL. This also helps match Prosp replies to the correct account.','')||'';
    const {error}=await sb.from('daily_ops_accounts').insert({owner_name:owner.trim(),account_name:label.trim(),linkedin_url:url.trim()||null,source_account_match:url.trim()||null,posting_days:[1,2,3,4,5],sort_order:(opsAccounts.length+1)*10});
    if(error){alert(error.message);return}await loadOps();
  }

  function ensureRealtime(){
    if(opsChannel)return;
    opsChannel=sb.channel('outerhaven-daily-ops-v2')
      .on('postgres_changes',{event:'*',schema:'public',table:'daily_ops_items'},()=>loadOps())
      .on('postgres_changes',{event:'*',schema:'public',table:'daily_ops_accounts'},()=>loadOps())
      .on('postgres_changes',{event:'*',schema:'public',table:'daily_ops_dms'},()=>loadOps())
      .subscribe();
  }

  async function install(){
    installShell();
    let tries=0;
    while(!opsRole&&tries<12){opsRole=await getRole();if(!opsRole){await new Promise(r=>setTimeout(r,500));tries++}}
    if(!opsRole)return;
    enforceRole();await loadOps();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
