(function(){
  if(window.__outerhavenLocationNormalizerV4)return;
  window.__outerhavenLocationNormalizerV4=true;
  const $=id=>document.getElementById(id);
  const rules=[
    [/\bpalawan\b/i,'Palawan, Philippines · Southeast Asia'],
    [/\bbali\b/i,'Bali, Indonesia · Southeast Asia'],
    [/\bjakarta\b/i,'Jakarta, Indonesia · Southeast Asia'],
    [/\bphuket\b/i,'Phuket, Thailand · Southeast Asia'],
    [/\bkuala lumpur\b/i,'Kuala Lumpur, Malaysia · Southeast Asia'],
    [/\bmanila\b/i,'Manila, Philippines · Southeast Asia'],
    [/\bho chi minh\b|\bhanoi\b/i,'Vietnam · Southeast Asia'],
    [/\bsingapore\b/i,'Singapore · Southeast Asia']
  ];
  let lock=false;
  const generic=v=>!String(v||'').trim()||/^(?:southeast asia|south east asia|asean|global|asia|other)$/i.test(String(v||'').trim());
  function normalize(){
    if(lock)return;
    const geo=$('dealGeography');
    if(!geo||geo.dataset.userEditedGeo==='1')return;
    // Never replace a specific geography already supplied by the user or importer.
    if(!generic(geo.value)&&geo.dataset.autoGeo!=='1')return;
    const priority=`${$('dealTitle')?.value||''} ${$('dealCompany')?.value||''} ${String($('dealSummary')?.value||'').slice(0,900)}`;
    for(const [re,label] of rules){
      if(!re.test(priority))continue;
      if(geo.value===label)return;
      lock=true;
      geo.value=label;
      geo.dataset.autoGeo='1';
      geo.dispatchEvent(new Event('input',{bubbles:true}));
      geo.classList.add('pdfAutofilled');
      setTimeout(()=>geo.classList.remove('pdfAutofilled'),1600);
      lock=false;
      return;
    }
  }
  function bind(){
    const geo=$('dealGeography');
    const ids=['dealTitle','dealCompany','dealSummary'];
    if(!geo||!ids.every(id=>$(id))){setTimeout(bind,200);return}
    geo.addEventListener('input',e=>{if(lock)return;if(e.isTrusted){geo.dataset.userEditedGeo='1';delete geo.dataset.autoGeo}});
    ids.forEach(id=>$(id).addEventListener('input',()=>setTimeout(normalize,0)));
    setTimeout(normalize,0);
  }
  bind();
})();