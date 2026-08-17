(function(){
  if(window.__outerhavenDailyOpsV3Adjustments)return;
  window.__outerhavenDailyOpsV3Adjustments=true;

  let inboundRows=[];
  let accounts=[];
  let showAll=false;
  let busy=false;
  let timer=null;
  let lastPanelSig='';

  const style=document.createElement('style');
  style.textContent=`
    .ops3DmPanel{background:#fff;border:1px solid #e4e7eb;border-radius:14px;padding:14px}
    .ops3DmHead{display:flex;justify-content:space-between;gap:10px;align-items:flex-start;flex-wrap:wrap}
    .ops3DmList{display:grid;gap:8px;margin-top:11px}
    .ops3DmCard{padding:11px;border:1px solid #e6e9ee;border-radius:10px;background:#fafbfc}
    .ops3DmTop{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}
    .ops3DmName{font-size:10px;font-weight:900}
    .ops3DmMeta{font-size:8px;color:#7d8591;margin-top:2px}
    .ops3DmText{font-size:11px;line-height:1.5;color:#2f3742;margin-top:8px;white-space:pre-wrap}
  `;
  document.head.appendChild(style);

  const escAdj=v=>typeof esc==='function'?esc(v):String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  const startToday=()=>{const d=new Date();d.setHours(0,0,0,0);return d.toISOString()};
  const cleanReply=v=>String(v||'').replace(/^A lead has replied\s*/i,'').replace(/^Re:\s*/i,'').trim()||'Reply text unavailable';
  const timeLabel=v=>v?new Date(v).toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'}):'';

  function sourceName(source){
    const a=accounts.find(x=>x.source_account_match===source||x.linkedin_url===source);
    return a?.owner_name||'Unmapped account';
  }

  function whatsappCount(){
    const task=[...document.querySelectorAll('.ops3Task')].find(x=>x.querySelector('.ops3Title')?.textContent?.includes('WhatsApp Group Chats')||x.querySelector('.ops3Title')?.textContent?.includes('Set Appointment'));
    const input=task?.querySelector('[data-count]');
    return Number(input?.value||0);
  }

  function panelSignature(){
    return `${showAll?'all':'five'}|${inboundRows.map(d=>`${d.id}:${d.created_at}:${d.reply_text||''}`).join('|')}|${accounts.map(a=>`${a.owner_name}:${a.linkedin_url||''}:${a.source_account_match||''}`).join('|')}`;
  }

  function dmPanelHtml(){
    const rows=showAll?inboundRows:inboundRows.slice(0,5);
    return `<section class="ops3DmPanel" id="ops3InboundDmPanel"><div class="ops3DmHead"><div><b>Inbound DMs Today · ${inboundRows.length}</b><div class="ops3Sub">Read what came in here. The conversations themselves stay in LinkedIn.</div></div>${inboundRows.length>5?`<button id="ops3DmToggle" class="ops3Schedule">${showAll?'Show Latest 5':'View All'}</button>`:''}</div>${rows.length?`<div class="ops3DmList">${rows.map(d=>`<article class="ops3DmCard"><div class="ops3DmTop"><div><div class="ops3DmName">${escAdj(d.name||'Unknown lead')}${d.company_name?` · ${escAdj(d.company_name)}`:''}</div><div class="ops3DmMeta">${escAdj(sourceName(d.source_account))} · ${escAdj(timeLabel(d.created_at))}</div></div></div><div class="ops3DmText">${escAdj(cleanReply(d.reply_text))}</div></article>`).join('')}</div>`:'<div class="ops3Sub" style="margin-top:10px">No inbound DMs captured today.</div>'}</section>`;
  }

  function apply(){
    const root=document.getElementById('dailyOpsRoot');
    if(!root||!root.classList.contains('ops3'))return;

    const metrics=root.querySelector('.ops3Metrics');
    const metricCards=metrics?.querySelectorAll('.ops3Metric');
    if(metricCards?.length>=4){
      const dm=metricCards[1],wa=metricCards[3];
      const dmLabel=dm.querySelector('.ops3Sub'),dmValue=dm.querySelector('b'),dmSmall=dm.querySelector('small');
      if(dmLabel&&dmLabel.textContent!=='Inbound DMs')dmLabel.textContent='Inbound DMs';
      if(dmValue&&dmValue.textContent!==String(inboundRows.length))dmValue.textContent=String(inboundRows.length);
      if(dmSmall&&dmSmall.textContent!=='Captured today')dmSmall.textContent='Captured today';
      const count=whatsappCount();
      const waLabel=wa.querySelector('.ops3Sub'),waValue=wa.querySelector('b'),waSmall=wa.querySelector('small');
      if(waLabel&&waLabel.textContent!=='WhatsApp Groups')waLabel.textContent='WhatsApp Groups';
      if(waValue&&waValue.textContent!==String(count))waValue.textContent=String(count);
      if(waSmall&&waSmall.textContent!=='Group chats created today')waSmall.textContent='Group chats created today';
    }

    const sig=panelSignature();
    let panel=document.getElementById('ops3InboundDmPanel');
    if(!panel&&metrics){
      metrics.insertAdjacentHTML('afterend',dmPanelHtml());
      panel=document.getElementById('ops3InboundDmPanel');
      lastPanelSig=sig;
    }else if(panel&&lastPanelSig!==sig){
      panel.outerHTML=dmPanelHtml();
      panel=document.getElementById('ops3InboundDmPanel');
      lastPanelSig=sig;
    }
    document.getElementById('ops3DmToggle')?.addEventListener('click',()=>{showAll=!showAll;lastPanelSig='';apply()},{once:true});

    const task=[...root.querySelectorAll('.ops3Task')].find(x=>x.querySelector('.ops3Title')?.textContent?.includes('Set Appointment')||x.querySelector('.ops3Title')?.textContent?.includes('WhatsApp Group Chats'));
    if(task){
      const title=task.querySelector('.ops3Title');
      const desc=task.querySelector('.ops3Desc');
      if(title&&title.textContent!=='Work Leads in DM to Create WhatsApp Group Chats')title.textContent='Work Leads in DM to Create WhatsApp Group Chats';
      if(desc&&desc.textContent!=='Work active DM conversations until the qualified relationship is moved into a WhatsApp group chat.')desc.textContent='Work active DM conversations until the qualified relationship is moved into a WhatsApp group chat.';
      const controls=task.querySelector('.ops3Controls');
      const input=controls?.querySelector('[data-count]');
      if(controls&&input){
        const hint=controls.querySelector('.ops3Sub');
        if(hint&&hint.textContent!=='WhatsApp group chats created today')hint.textContent='WhatsApp group chats created today';
      }
    }
  }

  function scheduleApply(){clearTimeout(timer);timer=setTimeout(apply,30)}

  async function loadInbound(){
    if(busy||typeof sb==='undefined')return;
    busy=true;
    try{
      const [i,a]=await Promise.all([
        sb.from('lead_intake').select('id,name,company_name,source_account,reply_text,created_at').gte('created_at',startToday()).order('created_at',{ascending:false}).limit(100),
        sb.from('daily_ops_accounts').select('owner_name,linkedin_url,source_account_match').eq('active',true)
      ]);
      if(i.error||a.error){console.error('daily ops dm viewer',i.error||a.error);return}
      inboundRows=i.data||[];
      accounts=a.data||[];
      apply();
    }finally{busy=false}
  }

  function install(){
    const root=document.getElementById('dailyOpsRoot');
    if(root)new MutationObserver(scheduleApply).observe(root,{childList:true,subtree:true});
    loadInbound();
    if(typeof sb!=='undefined'){
      sb.channel('daily-ops-inbound-viewer').on('postgres_changes',{event:'*',schema:'public',table:'lead_intake'},loadInbound).subscribe();
    }
    setInterval(loadInbound,30000);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();