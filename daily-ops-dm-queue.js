(function(){
  if(window.__outerhavenDailyOpsDmQueue)return;
  window.__outerhavenDailyOpsDmQueue=true;

  let observer=null,timer=null,applying=false;

  const style=document.createElement('style');
  style.textContent=`
    #dailyOpsRoot .dailyOpsQueuePanel.dailyOpsDmSidebarPanel{
      position:fixed!important;
      top:0!important;
      right:0!important;
      bottom:0!important;
      left:auto!important;
      z-index:10040!important;
      width:min(500px,calc(100vw - 24px))!important;
      max-width:500px!important;
      height:100vh!important;
      box-sizing:border-box!important;
      background:#f7f8fa!important;
      border:0!important;
      border-left:1px solid #dde2e8!important;
      box-shadow:-18px 0 55px rgba(17,24,39,.18)!important;
      padding:0 16px 22px!important;
      display:block!important;
      overflow-y:auto!important;
      overscroll-behavior:contain;
    }
    .dailyOpsDmSidebarHead{
      position:sticky;top:0;z-index:3;
      margin:0 -16px 14px;padding:16px;
      display:flex;align-items:flex-start;justify-content:space-between;gap:12px;
      background:rgba(255,255,255,.97);backdrop-filter:blur(10px);
      border-bottom:1px solid #e4e7eb;
    }
    .dailyOpsDmSidebarTitle{font-size:15px;font-weight:900;color:#111827}
    .dailyOpsDmSidebarSub{font-size:9px;color:#747c89;margin-top:4px;line-height:1.45}
    .dailyOpsDmSidebarClose{width:31px;height:31px;display:inline-flex;align-items:center;justify-content:center;border:1px solid #d8dde5;background:#fff;color:#475467;border-radius:8px;font-size:18px;line-height:1;cursor:pointer;flex:0 0 auto}
    #dailyOpsRoot .dailyOpsQueuePanel.dailyOpsDmSidebarPanel>.dailyOpsDmCard{display:grid!important;margin:0 0 10px!important;padding:13px!important;border-radius:12px!important;box-shadow:0 1px 2px rgba(16,24,40,.03)}
    #dailyOpsRoot .dailyOpsQueuePanel.dailyOpsDmSidebarPanel>.dailyOpsQueueEmpty{margin-top:10px}
    .dailyOpsIgnoreBtn{border:1px solid #d92d20!important;background:#fff1f0!important;color:#b42318!important}
    .dailyOpsIgnoreBtn:hover{background:#fee4e2!important}
    .dailyOpsIgnoreBtn:disabled{opacity:.55;cursor:default!important}
    #dailyOpsDmSidebarBackdrop{position:fixed;inset:0;z-index:10030;background:rgba(17,24,39,.30);backdrop-filter:blur(1px)}
    body.dailyOpsDmSidebarOpen{overflow:hidden!important}
    @media(max-width:560px){
      #dailyOpsRoot .dailyOpsQueuePanel.dailyOpsDmSidebarPanel{width:100vw!important;max-width:none!important;padding:0 12px 18px!important}
      .dailyOpsDmSidebarHead{margin:0 -12px 12px;padding:14px 12px}
    }
  `;
  document.head.appendChild(style);

  function dmId(card){
    return card.querySelector('[data-dm]')?.dataset.dm||card.querySelector('[data-mark-replied]')?.dataset.markReplied||card.querySelector('[data-promote-whatsapp]')?.dataset.promoteWhatsapp||'';
  }
  function dmName(card){return card.querySelector('.dailyOpsDmName')?.textContent?.trim()||'Reply'}
  function directCards(panel){return [...panel.children].filter(x=>x.classList?.contains('dailyOpsDmCard'))}
  function accountCard(panel){return panel.closest('.dailyOpsAccount')}
  function accountName(panel){return accountCard(panel)?.querySelector('.dailyOpsAccountName')?.textContent?.trim()||'LinkedIn'}
  function openButton(panel){return accountCard(panel)?.querySelector('[data-open-dms]')||null}

  function closeSidebar(panel){
    const button=openButton(panel);
    if(button&&typeof button.onclick==='function'){
      button.onclick();
      cleanupBackdrop();
      return;
    }
    if(button){
      button.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true}));
      cleanupBackdrop();
      return;
    }
    panel.remove();
    cleanupBackdrop();
  }

  function ensureBackdrop(panel){
    let backdrop=document.getElementById('dailyOpsDmSidebarBackdrop');
    if(!backdrop){
      backdrop=document.createElement('div');
      backdrop.id='dailyOpsDmSidebarBackdrop';
      document.body.appendChild(backdrop);
    }
    backdrop.onclick=()=>closeSidebar(panel);
    document.body.classList.add('dailyOpsDmSidebarOpen');
  }
  function cleanupBackdrop(){
    if(document.querySelector('#dailyOpsRoot .dailyOpsQueuePanel'))return;
    document.getElementById('dailyOpsDmSidebarBackdrop')?.remove();
    document.body.classList.remove('dailyOpsDmSidebarOpen');
  }

  async function ignoreDm(id,card){
    if(!id||typeof sb==='undefined')return;
    const name=dmName(card);
    if(!confirm(`Ignore ${name} as unqualified? This removes the reply from Daily Ops and does not add it to the CRM.`))return;
    const btn=card.querySelector('[data-ignore-dm]');
    if(btn){btn.disabled=true;btn.textContent='Ignoring...'}
    const {error}=await sb.rpc('ignore_daily_ops_dm',{dm_id:id});
    if(error){
      alert(error.message);
      if(btn){btn.disabled=false;btn.textContent='Ignore'}
      return;
    }
    const panel=card.closest('.dailyOpsQueuePanel');
    card.remove();
    if(panel){
      const cards=directCards(panel);
      updateHeader(panel,cards.length);
      if(!cards.length)closeSidebar(panel);
    }
    if(typeof window.__outerhavenRefreshDailyOpsRuntime==='function')window.__outerhavenRefreshDailyOpsRuntime();
  }

  function ensureIgnore(card){
    const id=dmId(card);if(!id)return;
    const actions=card.querySelector('.dailyOpsDmActions');if(!actions)return;
    let btn=actions.querySelector('[data-ignore-dm]');
    if(!btn){
      btn=document.createElement('button');
      btn.type='button';
      btn.className='dailyOpsIgnoreBtn';
      btn.dataset.ignoreDm=id;
      btn.textContent='Ignore';
      actions.insertBefore(btn,actions.firstChild);
    }
    btn.onclick=e=>{e.preventDefault();e.stopPropagation();ignoreDm(id,card)};
  }

  function updateHeader(panel,count){
    let head=panel.querySelector(':scope > .dailyOpsDmSidebarHead');
    if(!head){
      head=document.createElement('div');
      head.className='dailyOpsDmSidebarHead';
      panel.prepend(head);
    }
    const owner=accountName(panel);
    const html=`<div><div class="dailyOpsDmSidebarTitle">${owner} DMs</div><div class="dailyOpsDmSidebarSub">${count} open ${count===1?'reply':'replies'} · Scroll to review every conversation.</div></div><button type="button" class="dailyOpsDmSidebarClose" aria-label="Close DMs">×</button>`;
    if(head.innerHTML!==html)head.innerHTML=html;
    head.querySelector('.dailyOpsDmSidebarClose').onclick=()=>closeSidebar(panel);
  }

  function decoratePanel(panel){
    panel.classList.add('dailyOpsDmSidebarPanel');
    const cards=directCards(panel);
    cards.forEach(card=>{
      card.style.display='grid';
      ensureIgnore(card);
    });
    updateHeader(panel,cards.length);
    ensureBackdrop(panel);
  }

  function apply(){
    if(applying)return;
    applying=true;
    try{
      observer?.disconnect();
      const panels=[...document.querySelectorAll('#dailyOpsRoot .dailyOpsQueuePanel')];
      panels.forEach(decoratePanel);
      if(!panels.length)cleanupBackdrop();
    }finally{
      applying=false;
      if(observer)observer.observe(document.body,{childList:true,subtree:true});
    }
  }
  function schedule(){clearTimeout(timer);timer=setTimeout(apply,35)}
  function install(){
    observer=new MutationObserver(schedule);
    observer.observe(document.body,{childList:true,subtree:true});
    document.addEventListener('keydown',e=>{
      if(e.key!=='Escape')return;
      const panel=document.querySelector('#dailyOpsRoot .dailyOpsQueuePanel.dailyOpsDmSidebarPanel');
      if(panel)closeSidebar(panel);
    });
    apply();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
