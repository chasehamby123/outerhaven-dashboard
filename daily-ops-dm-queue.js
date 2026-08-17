(function(){
  if(window.__outerhavenDailyOpsDmQueue)return;
  window.__outerhavenDailyOpsDmQueue=true;

  const activeByAccount=new Map();
  let observer=null,timer=null,applying=false;

  const style=document.createElement('style');
  style.textContent=`
    .dailyOpsDmNavigator{display:grid;gap:9px;background:#fff;border:1px solid #e1e5eb;border-radius:10px;padding:10px 11px}
    .dailyOpsDmNavTop{display:flex;align-items:center;justify-content:space-between;gap:10px}
    .dailyOpsDmNavLabel{font-size:9px;font-weight:900;color:#697180;text-transform:uppercase;letter-spacing:.06em}
    .dailyOpsDmNavControls{display:flex;align-items:center;gap:7px}.dailyOpsDmNavCount{font-size:9px;font-weight:850;color:#4b5563;min-width:42px;text-align:center}
    .dailyOpsDmArrow{width:29px;height:29px;display:inline-flex;align-items:center;justify-content:center;border:1px solid #d7dce3;background:#fff;color:#344054;border-radius:8px;font-size:15px;font-weight:900;cursor:pointer}.dailyOpsDmArrow:disabled{opacity:.35;cursor:default}
    .dailyOpsDmTabs{display:flex;align-items:center;gap:6px;overflow-x:auto;padding-bottom:1px}.dailyOpsDmTab{flex:0 0 auto;border:1px solid #dce1e7;background:#f8f9fb;color:#606a78;border-radius:8px;padding:7px 9px;font-size:9px;font-weight:800;cursor:pointer;max-width:180px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.dailyOpsDmTab.active{background:#111827;color:#fff;border-color:#111827}
    .dailyOpsIgnoreBtn{border:1px solid #d92d20!important;background:#fff1f0!important;color:#b42318!important}.dailyOpsIgnoreBtn:hover{background:#fee4e2!important}
    @media(max-width:560px){.dailyOpsDmNavTop{align-items:flex-start}.dailyOpsDmTabs{width:100%}.dailyOpsDmTab{max-width:145px}}
  `;
  document.head.appendChild(style);

  function dmId(card){
    return card.querySelector('[data-dm]')?.dataset.dm||card.querySelector('[data-mark-replied]')?.dataset.markReplied||card.querySelector('[data-promote-whatsapp]')?.dataset.promoteWhatsapp||'';
  }
  function dmName(card){return card.querySelector('.dailyOpsDmName')?.textContent?.trim()||'Reply'}
  function accountKey(panel){return panel.closest('.dailyOpsAccount')?.querySelector('[data-open-dms]')?.dataset.openDms||'queue'}
  function directCards(panel){return [...panel.children].filter(x=>x.classList?.contains('dailyOpsDmCard'))}

  async function ignoreDm(id,card){
    if(!id||typeof sb==='undefined')return;
    const name=dmName(card);
    if(!confirm(`Ignore ${name} as unqualified? This removes the reply from Daily Ops and does not add it to the CRM.`))return;
    const btn=card.querySelector('[data-ignore-dm]');
    if(btn){btn.disabled=true;btn.textContent='Ignoring...'}
    const {error}=await sb.rpc('ignore_daily_ops_dm',{dm_id:id});
    if(error){alert(error.message);if(btn){btn.disabled=false;btn.textContent='Ignore'}return}
    const panel=card.closest('.dailyOpsQueuePanel');
    const key=panel?accountKey(panel):'';
    card.remove();
    if(key)activeByAccount.delete(key);
    if(panel)decoratePanel(panel);
    if(typeof window.__outerhavenRefreshDailyOpsRuntime==='function')window.__outerhavenRefreshDailyOpsRuntime();
  }

  function ensureIgnore(card){
    const id=dmId(card);if(!id)return;
    const actions=card.querySelector('.dailyOpsDmActions');if(!actions)return;
    let btn=actions.querySelector('[data-ignore-dm]');
    if(!btn){
      btn=document.createElement('button');btn.type='button';btn.className='dailyOpsIgnoreBtn';btn.dataset.ignoreDm=id;btn.textContent='Ignore';
      actions.insertBefore(btn,actions.firstChild);
    }
    btn.onclick=e=>{e.preventDefault();e.stopPropagation();ignoreDm(id,card)};
  }

  function setActive(panel,id){
    const cards=directCards(panel);if(!cards.length)return;
    const key=accountKey(panel);
    const ids=cards.map(dmId).filter(Boolean);
    if(!ids.includes(id))id=ids[0]||'';
    if(!id)return;
    activeByAccount.set(key,id);
    cards.forEach(card=>{card.style.display=dmId(card)===id?'':'none'});
    const nav=panel.querySelector(':scope > .dailyOpsDmNavigator');
    if(!nav)return;
    const index=Math.max(0,ids.indexOf(id));
    const count=nav.querySelector('.dailyOpsDmNavCount');if(count)count.textContent=`${index+1} of ${ids.length}`;
    nav.querySelectorAll('.dailyOpsDmTab').forEach(b=>b.classList.toggle('active',b.dataset.dmTarget===id));
    const prev=nav.querySelector('[data-dm-prev]'),next=nav.querySelector('[data-dm-next]');
    if(prev){prev.disabled=ids.length<2;prev.onclick=()=>setActive(panel,ids[(index-1+ids.length)%ids.length])}
    if(next){next.disabled=ids.length<2;next.onclick=()=>setActive(panel,ids[(index+1)%ids.length])}
  }

  function decoratePanel(panel){
    const cards=directCards(panel);
    const old=panel.querySelector(':scope > .dailyOpsDmNavigator');
    if(!cards.length){old?.remove();return}
    cards.forEach(ensureIgnore);
    const key=accountKey(panel),ids=cards.map(dmId).filter(Boolean);
    if(!ids.length)return;
    let active=activeByAccount.get(key);if(!ids.includes(active))active=ids[0];activeByAccount.set(key,active);
    let nav=old;
    if(!nav){nav=document.createElement('div');nav.className='dailyOpsDmNavigator';panel.prepend(nav)}
    const desired=`<div class="dailyOpsDmNavTop"><div class="dailyOpsDmNavLabel">Open Replies</div><div class="dailyOpsDmNavControls"><button type="button" class="dailyOpsDmArrow" data-dm-prev aria-label="Previous reply">‹</button><span class="dailyOpsDmNavCount"></span><button type="button" class="dailyOpsDmArrow" data-dm-next aria-label="Next reply">›</button></div></div><div class="dailyOpsDmTabs">${cards.map(card=>{const id=dmId(card);return `<button type="button" class="dailyOpsDmTab ${id===active?'active':''}" data-dm-target="${id}">${dmName(card).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}</button>`}).join('')}</div>`;
    if(nav.innerHTML!==desired)nav.innerHTML=desired;
    nav.querySelectorAll('[data-dm-target]').forEach(b=>b.onclick=()=>setActive(panel,b.dataset.dmTarget));
    setActive(panel,active);
  }

  function apply(){
    if(applying)return;applying=true;
    try{
      observer?.disconnect();
      document.querySelectorAll('#dailyOpsRoot .dailyOpsQueuePanel').forEach(decoratePanel);
    }finally{
      applying=false;
      if(observer)observer.observe(document.body,{childList:true,subtree:true});
    }
  }
  function schedule(){clearTimeout(timer);timer=setTimeout(apply,40)}
  function install(){observer=new MutationObserver(schedule);observer.observe(document.body,{childList:true,subtree:true});apply()}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
