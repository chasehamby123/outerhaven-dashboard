(function(){
  if(window.__outerhavenNavGuardsV2)return;
  window.__outerhavenNavGuardsV2=true;

  function guardPortal(){
    const app=document.getElementById('app');
    const btn=document.querySelector('.navBtn[data-section="capital"]');
    const section=document.getElementById('capitalSection');
    if(!app||app.classList.contains('hidden')||!btn||!section){setTimeout(guardPortal,120);return}
    if(btn.dataset.capitalGuardedV2)return;
    btn.dataset.capitalGuardedV2='1';
    btn.addEventListener('click',e=>{
      e.preventDefault();
      e.stopImmediatePropagation();
      document.querySelectorAll('.section').forEach(s=>s.classList.remove('active'));
      document.querySelectorAll('.navBtn').forEach(b=>b.classList.toggle('active',b===btn));
      section.classList.add('active');
      const title=document.getElementById('pageTitle'),sub=document.getElementById('pageSub'),top=document.getElementById('topSubmit');
      if(title)title.textContent='Capital Suite';
      if(sub)sub.textContent='Turn source materials into investor-ready outputs, one necessary step at a time.';
      if(top)top.style.display='none';
      window.scrollTo({top:0,behavior:'smooth'});
    },true);
  }

  if(document.getElementById('app'))guardPortal();
})();