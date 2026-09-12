(function(){
  if(window.__outerhavenNavGuards)return;
  window.__outerhavenNavGuards=true;

  function guardPortal(){
    const app=document.getElementById('app');
    const btn=document.querySelector('.navBtn[data-section="capital"]');
    const section=document.getElementById('capitalSection');
    if(!app||app.classList.contains('hidden')||!btn||!section){setTimeout(guardPortal,120);return}
    if(btn.dataset.capitalGuarded)return;
    btn.dataset.capitalGuarded='1';
    btn.addEventListener('click',e=>{
      e.preventDefault();
      e.stopImmediatePropagation();
      document.querySelectorAll('.section').forEach(s=>s.classList.remove('active'));
      document.querySelectorAll('.navBtn').forEach(b=>b.classList.toggle('active',b===btn));
      section.classList.add('active');
      const title=document.getElementById('pageTitle'),sub=document.getElementById('pageSub'),top=document.getElementById('topSubmit');
      if(title)title.textContent='Capital Suite';
      if(sub)sub.textContent='Institutional packaging, diligence, mandate strategy, and managed capital-readiness services.';
      if(top)top.style.display='none';
      window.scrollTo({top:0,behavior:'smooth'});
    },true);
  }

  function guardAdmin(){
    const app=document.getElementById('adminApp');
    const btn=document.querySelector('.adminNav button[data-section="services"]');
    const section=document.getElementById('servicesSection');
    if(!app||app.classList.contains('hidden')||!btn||!section){setTimeout(guardAdmin,120);return}
    if(btn.dataset.servicesGuarded)return;
    btn.dataset.servicesGuarded='1';
    btn.addEventListener('click',e=>{
      e.preventDefault();
      e.stopImmediatePropagation();
      document.querySelectorAll('.adminSection').forEach(s=>s.classList.remove('active'));
      document.querySelectorAll('.adminNav button').forEach(b=>b.classList.toggle('active',b===btn));
      section.classList.add('active');
      const title=document.getElementById('adminTitle'),sub=document.getElementById('adminSub');
      if(title)title.textContent='Capital Services';
      if(sub)sub.textContent='Convert software demand into scoped OuterHaven engagements.';
      window.scrollTo({top:0,behavior:'smooth'});
    },true);
  }

  if(document.getElementById('app'))guardPortal();
  if(document.getElementById('adminApp'))guardAdmin();
})();