(function(){
  if(window.__outerhavenSecureRequestV1)return;
  window.__outerhavenSecureRequestV1=true;
  const sb=window.__OUTERHAVEN_ORIGINATOR_SB;if(!sb)return;
  const $=id=>document.getElementById(id);

  function install(){
    const requestBtn=document.querySelector('#capitalSuiteV18Core .v18Next [data-v18-request]');
    if(!requestBtn)return;
    const actions=requestBtn.closest('.v18Actions');if(!actions)return;
    let secure=actions.querySelector('[data-secure-request]');
    if(!secure){
      secure=document.createElement('button');
      secure.type='button';
      secure.className='v18Btn';
      secure.dataset.secureRequest=requestBtn.dataset.v18Request||'';
      secure.textContent='Create Secure Link';
      requestBtn.before(secure);
    }else secure.dataset.secureRequest=requestBtn.dataset.v18Request||'';
  }

  function schedule(){[0,180,550,1200].forEach(ms=>setTimeout(install,ms))}
  async function copyLink(url,button){
    try{await navigator.clipboard.writeText(url);button.textContent='Secure Link Copied'}
    catch(_){window.prompt('Copy this secure request link:',url);button.textContent='Secure Link Ready'}
    let note=button.closest('.v18Next')?.querySelector('.v18SecureNote');
    if(!note){note=document.createElement('div');note.className='v18SecureNote';note.style.cssText='margin-top:10px;font:700 8px/1.45 Arial;color:#d7d0c8;word-break:break-word';button.closest('.v18Next')?.appendChild(note)}
    if(note)note.textContent='Private 7-day request link ready. Send it to the sponsor or management contact. Their answer will flow directly into this deal.';
    setTimeout(()=>{if(button.isConnected)button.textContent='Create Secure Link'},2400);
  }

  document.addEventListener('click',async e=>{
    const button=e.target.closest('[data-secure-request]');
    if(button){
      e.preventDefault();e.stopPropagation();
      const key=button.dataset.secureRequest,dealId=$('capitalDealSelect')?.value;
      if(!key||!dealId)return;
      button.disabled=true;button.textContent='Creating…';
      try{
        const {data,error}=await sb.functions.invoke('capital-request',{body:{action:'create',deal_id:dealId,question_key:key}});
        if(error)throw error;if(!data?.token)throw new Error('Secure link was not created.');
        const url=`${location.origin}/capital-request.html?t=${encodeURIComponent(data.token)}`;
        await copyLink(url,button);
      }catch(err){console.error('secure request',err);alert(err?.message||'Could not create secure request link.');button.textContent='Create Secure Link'}
      finally{button.disabled=false}
      return;
    }
    if(e.target.closest('.navBtn[data-section="capital"],#capitalRefresh,[data-v18-save],[data-v18-tab]'))schedule();
  },true);
  document.addEventListener('change',e=>{if(e.target?.id==='capitalDealSelect')schedule()},true);
  [0,350,900,1800,3200].forEach(ms=>setTimeout(install,ms));
})();
