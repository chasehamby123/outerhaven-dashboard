(function(){
  if(window.__outerhavenDailyOpsAdsPowerHandoff)return;
  window.__outerhavenDailyOpsAdsPowerHandoff=true;

  const style=document.createElement('style');
  style.textContent=`
    .dailyOpsDmIdentity{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
    .dailyOpsLeadUrl{font-size:9px;color:#667085;max-width:520px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .dailyOpsCopyUrl{border:1px solid #d7dce3;background:#fff;color:#344054;border-radius:7px;padding:5px 7px;font-size:8px;font-weight:850;cursor:pointer}
    .dailyOpsAdsPowerHint{font-size:9px;font-weight:800;color:#344054;margin-top:5px}
  `;
  document.head.appendChild(style);

  function accountOwner(card){
    return card?.closest('.dailyOpsAccount')?.querySelector('.dailyOpsAccountName')?.textContent?.trim()||'the correct';
  }

  async function copyUrl(button,url){
    try{
      await navigator.clipboard.writeText(url);
      const old=button.textContent;
      button.textContent='Copied';
      setTimeout(()=>button.textContent=old,1200);
    }catch{
      const ta=document.createElement('textarea');
      ta.value=url;ta.style.position='fixed';ta.style.opacity='0';document.body.appendChild(ta);ta.select();
      try{document.execCommand('copy');button.textContent='Copied';setTimeout(()=>button.textContent='Copy URL',1200)}finally{ta.remove()}
    }
  }

  function enhanceDm(card){
    const name=card.querySelector('.dailyOpsDmName');
    if(!name)return;

    const linkedinAnchor=[...card.querySelectorAll('a[href]')].find(a=>/linkedin\.com/i.test(a.href));
    const existing=card.querySelector('.dailyOpsLeadUrl');
    const url=linkedinAnchor?.href||existing?.dataset.url||'';

    if(url&&!existing){
      const identity=document.createElement('div');identity.className='dailyOpsDmIdentity';
      name.parentNode.insertBefore(identity,name);identity.appendChild(name);
      const text=document.createElement('span');text.className='dailyOpsLeadUrl';text.dataset.url=url;text.textContent=url;identity.appendChild(text);
      const copy=document.createElement('button');copy.type='button';copy.className='dailyOpsCopyUrl';copy.textContent='Copy URL';copy.onclick=e=>{e.preventDefault();e.stopPropagation();copyUrl(copy,url)};identity.appendChild(copy);
      const hint=document.createElement('div');hint.className='dailyOpsAdsPowerHint';hint.textContent=`Paste into ${accountOwner(card)}'s account in AdsPower`;identity.insertAdjacentElement('afterend',hint);
    }

    if(linkedinAnchor)linkedinAnchor.remove();
  }

  function clean(){
    const root=document.getElementById('dailyOpsRoot');if(!root)return;
    root.querySelectorAll('.dailyOpsDmCard').forEach(enhanceDm);
    root.querySelectorAll('.dailyOpsOpenLinkedIn,.dailyOpsPostOpen,.dailyOpsPostPerformance a').forEach(x=>x.remove());
    root.querySelectorAll('a[href*="linkedin.com"]').forEach(x=>x.remove());
  }

  let timer=null;
  function schedule(){clearTimeout(timer);timer=setTimeout(clean,35)}
  const observer=new MutationObserver(schedule);
  function install(){observer.observe(document.body,{childList:true,subtree:true});schedule()}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
