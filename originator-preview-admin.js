(function(){
  if(window.__outerhavenOriginatorPreviewAdmin)return;
  window.__outerhavenOriginatorPreviewAdmin=true;
  if(window.__outerhavenDashboardRole!=='admin')return;
  function install(){
    const hero=document.querySelector('#originatorsView .oaHeroActions');
    if(!hero||document.getElementById('oaPreviewPortal'))return;
    const btn=document.createElement('button');
    btn.id='oaPreviewPortal';btn.className='ghost';btn.type='button';btn.textContent='Preview Originator Portal';
    btn.onclick=()=>window.open('/originator-preview.html','_blank','noopener');
    hero.insertBefore(btn,hero.firstChild);
  }
  install();
  const timer=setInterval(()=>{install();if(document.getElementById('oaPreviewPortal'))clearInterval(timer)},250);
  setTimeout(()=>clearInterval(timer),10000);
})();