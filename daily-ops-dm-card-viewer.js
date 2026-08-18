(function(){
  if(window.__outerhavenDailyOpsDmCardViewer)return;
  window.__outerhavenDailyOpsDmCardViewer=true;

  let rows=[],accounts=[],busy=false,timer=null,channel=null;
  const startToday=()=>{const d=new Date();d.setHours(0,0,0,0);return d.toISOString()};
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  const cleanReply=v=>String(v||'').replace(/^\s*A lead has replied\s*/i,'').replace(/^\s*Re:\s*/i,'').trim()||'Reply text not captured.';
  const when=v=>v?new Date(v).toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}):'';

  const style=document.createElement('style');
  style.textContent=`
    #dailyOpsRoot .ops3DmAccount{cursor:pointer;transition:border-color .15s ease,box-shadow .15s ease,transform .15s ease;position:relative}
    #dailyOpsRoot .ops3DmAccount.hasDms:hover{border-color:#9f7f5a!important;box-shadow:0 7px 18px rgba(55,43,29,.09);transform:translateY(-1px)}
    #dailyOpsRoot .ops3DmAccount.hasDms:after{content:'View DMs';display:block;font-size:7px;font-weight:850;color:#7b6855;margin-top:7px;text-transform:uppercase;letter-spacing:.06em}
    #dailyOpsRoot .ops3DmAccount.zero{cursor:default}
    #ops3DmViewerBackdrop{position:fixed;inset:0;z-index:13020;background:rgba(23,21,17,.34);backdrop-filter:blur(1px)}
    #ops3DmViewer{position:fixed;z-index:13030;top:0;right:0;bottom:0;width:min(520px,calc(100vw - 24px));background:#f7f2ea;border-left:1px solid #d8c6b1;box-shadow:-20px 0 55px rgba(31,27,22,.18);overflow-y:auto;color:#201d18}
    .ops3DmViewerHead{position:sticky;top:0;z-index:2;display:flex;justify-content:space-between;gap:14px;align-items:flex-start;padding:18px;background:rgba(255,250,243,.97);backdrop-filter:blur(10px);border-bottom:1px solid #dfcfbb}
    .ops3DmViewerTitle{font-size:16px;font-weight:900;color:#171511}.ops3DmViewerSub{font-size:9px;color:#786f64;margin-top:4px}.ops3DmViewerClose{width:32px;height:32px;border:1px solid #cbb397;background:#fffaf3;color:#4f4438;border-radius:8px;font-size:18px;cursor:pointer}
    .ops3DmViewerBody{padding:14px}.ops3DmViewerEmpty{padding:28px;text-align:center;border:1px dashed #d2bea5;border-radius:12px;background:#fffaf3;color:#786f64;font-size:10px}
    .ops3DmViewerCard{background:#fffaf3;border:1px solid #d8c6b1;border-radius:13px;padding:14px;margin-bottom:10px;box-shadow:0 5px 16px rgba(55,43,29,.04)}
    .ops3DmViewerTop{display:flex;justify-content:space-between;gap:12px}.ops3DmViewerName{font-size:12px;font-weight:900;color:#171511}.ops3DmViewerCompany{font-size:9px;color:#786f64;margin-top:2px}.ops3DmViewerTime{font-size:8px;color:#8d7e6e;white-space:nowrap}.ops3DmViewerHeadline{font-size:8px;color:#76695b;line-height:1.45;margin-top:8px}
    .ops3DmViewerReply{margin-top:11px;padding:11px;background:#f4e8d8;border:1px solid #dfcfbb;border-radius:9px;font-size:10px;line-height:1.55;color:#312b24;white-space:pre-wrap}
    .ops3DmViewerMeta{margin-top:10px;display:grid;gap:5px}.ops3DmViewerUrl{font-size:8px;color:#746553;overflow-wrap:anywhere}.ops3DmViewerActions{display:flex;gap:6px;justify-content:flex-end;margin-top:9px}.ops3DmViewerBtn{border:1px solid #cbb397;background:#fffaf3;color:#514538;border-radius:7px;padding:6px 8px;font-size:8px;font-weight:850;cursor:pointer}
    body.ops3DmViewerOpen{overflow:hidden!important}
    @media(max-width:560px){#ops3DmViewer{width:100vw;max-width:none}.ops3DmViewerHead{padding:15px}.ops3DmViewerBody{padding:11px}}
  `;
  document.head.appendChild(style);

  function sourceName(source){
    const a=accounts.find(x=>x.source_account_match===source||x.linkedin_url===source);
    return a?.owner_name||'Unmapped';
  }
  function rowsFor(owner){return rows.filter(r=>sourceName(r.source_account)===owner)}

  async function copyUrl(button,url){
    if(!url)return;
    try{await navigator.clipboard.writeText(url)}catch{
      const ta=document.createElement('textarea');ta.value=url;ta.style.position='fixed';ta.style.opacity='0';document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove();
    }
    const old=button.textContent;button.textContent='Copied';setTimeout(()=>button.textContent=old,1100);
  }

  function closeViewer(){
    document.getElementById('ops3DmViewer')?.remove();
    document.getElementById('ops3DmViewerBackdrop')?.remove();
    document.body.classList.remove('ops3DmViewerOpen');
  }
  function openViewer(owner){
    closeViewer();
    const list=rowsFor(owner);
    const backdrop=document.createElement('div');backdrop.id='ops3DmViewerBackdrop';backdrop.onclick=closeViewer;document.body.appendChild(backdrop);
    const panel=document.createElement('aside');panel.id='ops3DmViewer';
    panel.innerHTML=`<div class="ops3DmViewerHead"><div><div class="ops3DmViewerTitle">${esc(owner)} DMs</div><div class="ops3DmViewerSub">${list.length} inbound ${list.length===1?'DM':'DMs'} captured today</div></div><button type="button" class="ops3DmViewerClose" aria-label="Close DMs">×</button></div><div class="ops3DmViewerBody">${list.length?list.map(r=>`<article class="ops3DmViewerCard"><div class="ops3DmViewerTop"><div><div class="ops3DmViewerName">${esc(r.name||'LinkedIn Lead')}</div><div class="ops3DmViewerCompany">${esc(r.company_name||'Company not captured')}</div></div><div class="ops3DmViewerTime">${esc(when(r.created_at))}</div></div>${r.headline?`<div class="ops3DmViewerHeadline">${esc(r.headline)}</div>`:''}<div class="ops3DmViewerReply">${esc(cleanReply(r.reply_text))}</div><div class="ops3DmViewerMeta">${r.linkedin_url?`<div class="ops3DmViewerUrl">${esc(r.linkedin_url)}</div>`:''}</div>${r.linkedin_url?`<div class="ops3DmViewerActions"><button type="button" class="ops3DmViewerBtn" data-copy-url="${esc(r.id)}">Copy LinkedIn URL</button></div>`:''}</article>`).join(''):'<div class="ops3DmViewerEmpty">No DMs are currently captured for this account today.</div>'}</div>`;
    document.body.appendChild(panel);document.body.classList.add('ops3DmViewerOpen');
    panel.querySelector('.ops3DmViewerClose').onclick=closeViewer;
    panel.querySelectorAll('[data-copy-url]').forEach(b=>{const r=list.find(x=>x.id===b.dataset.copyUrl);b.onclick=()=>copyUrl(b,r?.linkedin_url)});
  }

  function decorate(){
    const cards=[...document.querySelectorAll('#dailyOpsRoot .ops3DmAccount')];
    cards.forEach(card=>{
      const owner=card.querySelector('.ops3DmAccountName')?.textContent?.trim();
      const count=Number(card.querySelector('.ops3DmAccountCount')?.textContent||0);
      if(!owner)return;
      card.setAttribute('role',count?'button':'group');
      if(count){card.tabIndex=0;card.setAttribute('aria-label',`View ${owner} DMs`);card.onclick=()=>openViewer(owner);card.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openViewer(owner)}}}
      else{card.removeAttribute('tabindex');card.onclick=null;card.onkeydown=null}
    });
  }

  async function refresh(){
    if(busy||typeof sb==='undefined')return;busy=true;
    try{
      const [r,a]=await Promise.all([
        sb.from('lead_intake').select('id,name,company_name,headline,reply_text,linkedin_url,source_account,decision,created_at').gte('created_at',startToday()).order('created_at',{ascending:false}).limit(250),
        sb.from('daily_ops_accounts').select('owner_name,linkedin_url,source_account_match').eq('active',true)
      ]);
      if(r.error||a.error){console.error('daily ops dm viewer',r.error||a.error);return}
      rows=r.data||[];accounts=a.data||[];decorate();
    }finally{busy=false}
  }
  function schedule(){clearTimeout(timer);timer=setTimeout(decorate,45)}
  async function install(){
    const root=document.getElementById('dailyOpsRoot');
    if(root)new MutationObserver(schedule).observe(root,{childList:true,subtree:true});
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&document.getElementById('ops3DmViewer'))closeViewer()});
    await refresh();
    if(typeof sb!=='undefined')channel=sb.channel('daily-ops-dm-card-viewer-v1').on('postgres_changes',{event:'*',schema:'public',table:'lead_intake'},refresh).subscribe();
    setInterval(refresh,30000);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();