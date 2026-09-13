(function(){
  if(window.__outerhavenNavGuardsV2)return;
  window.__outerhavenNavGuardsV2=true;

  const copy={
    home:['Overview','Bring in a deal once. Build the package, complete diligence, and move it toward qualified capital.'],
    submit:['New Deal','Start with source material or add the core transaction details manually.'],
    submissions:['Deals','Track your opportunities, source materials, review status, and Capital Suite progress.'],
    mandates:['Buyer Mandates','Review the buy boxes Outerhaven is actively sourcing against.'],
    capital:['Capital Suite','One deal. One next action. Investor-ready materials.']
  };

  function applyCopy(section){
    const c=copy[section];if(!c)return;
    const title=document.getElementById('pageTitle'),sub=document.getElementById('pageSub'),top=document.getElementById('topSubmit');
    if(title)title.textContent=c[0];
    if(sub)sub.textContent=c[1];
    if(top){top.textContent='+ New Deal';top.style.display=(section==='submit'||section==='capital')?'none':''}
  }

  function guardPortal(){
    const app=document.getElementById('app');
    const capitalBtn=document.querySelector('.navBtn[data-section="capital"]');
    const capitalSection=document.getElementById('capitalSection');
    if(!app||app.classList.contains('hidden')||!capitalBtn||!capitalSection){setTimeout(guardPortal,120);return}
    if(capitalBtn.dataset.capitalGuardedV2)return;
    capitalBtn.dataset.capitalGuardedV2='1';

    capitalBtn.addEventListener('click',e=>{
      e.preventDefault();
      e.stopImmediatePropagation();
      document.querySelectorAll('.section').forEach(s=>s.classList.remove('active'));
      document.querySelectorAll('.navBtn').forEach(b=>b.classList.toggle('active',b===capitalBtn));
      capitalSection.classList.add('active');
      applyCopy('capital');
      window.scrollTo({top:0,behavior:'smooth'});
    },true);

    document.addEventListener('click',e=>{
      const nav=e.target.closest('.navBtn[data-section],[data-go]');
      if(!nav||nav===capitalBtn)return;
      const section=nav.dataset.section||nav.dataset.go;
      if(!copy[section])return;
      setTimeout(()=>applyCopy(section),0);
    },true);

    applyCopy(document.querySelector('.navBtn.active')?.dataset.section||'home');
  }

  if(document.getElementById('app'))guardPortal();
})();