(function(){
  if(window.__outerhavenLocationNormalizerV3)return;window.__outerhavenLocationNormalizerV3=true;
  const $=id=>document.getElementById(id);
  const rules=[
    [/\bbali\b/i,'Bali, Indonesia · Southeast Asia'],[/\bjakarta\b/i,'Jakarta, Indonesia · Southeast Asia'],[/\bphuket\b/i,'Phuket, Thailand · Southeast Asia'],[/\bkuala lumpur\b/i,'Kuala Lumpur, Malaysia · Southeast Asia'],[/\bmanila\b/i,'Manila, Philippines · Southeast Asia'],[/\bho chi minh\b|\bhanoi\b/i,'Vietnam · Southeast Asia'],[/\bsingapore\b/i,'Singapore · Southeast Asia']
  ];
  let lock=false;
  function normalize(){if(lock)return;const priority=`${$('dealTitle')?.value||''} ${$('dealCompany')?.value||''} ${String($('dealSummary')?.value||'').slice(0,450)}`;for(const [re,label] of rules){if(!re.test(priority))continue;const geo=$('dealGeography');if(!geo)return;if(geo.value===label)return;lock=true;geo.value=label;geo.dispatchEvent(new Event('input',{bubbles:true}));geo.classList.add('pdfAutofilled');setTimeout(()=>geo.classList.remove('pdfAutofilled'),1600);lock=false;return}}
  function bind(){const ids=['dealTitle','dealCompany','dealSummary'];if(!ids.every(id=>$(id))){setTimeout(bind,200);return}ids.forEach(id=>$(id).addEventListener('input',()=>setTimeout(normalize,0)))}
  bind();
})();