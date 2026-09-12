(function(){
  if(window.__outerhavenMandateTabs)return;
  window.__outerhavenMandateTabs=true;

  const TAB_ORDER=['all','southeast-asia','united-states','north-america','europe','other'];
  const LABELS={
    all:'All',
    'southeast-asia':'Southeast Asia',
    'united-states':'United States',
    'north-america':'North America',
    europe:'Europe',
    other:'Other'
  };
  let active='all';
  let lastSignature='';

  function geographyFor(card){
    const rows=[...card.querySelectorAll('.mandateMeta > div')];
    const row=rows.find(r=>String(r.querySelector('span')?.textContent||'').trim().toLowerCase()==='geography');
    return String(row?.querySelector('b')?.textContent||'').trim();
  }

  function bucketFor(value){
    const g=String(value||'').toLowerCase();
    if(/southeast asia|singapore|malaysia|indonesia|vietnam|philippines|thailand/.test(g))return'southeast-asia';
    if(/united states/.test(g)&&!/canada|north america/.test(g))return'united-states';
    if(/north america|canada/.test(g))return'north-america';
    if(/western europe|europe|united kingdom|\buk\b|dach|germany|austria|switzerland|nordic|sweden|norway|denmark|finland|spain|italy|portugal/.test(g))return'europe';
    return'other';
  }

  function ensureStyles(){
    if(document.getElementById('originatorMandateTabsStyle'))return;
    const style=document.createElement('style');
    style.id='originatorMandateTabsStyle';
    style.textContent=`
      .mandateGeoTabs{display:flex;gap:7px;flex-wrap:wrap;margin:0 0 18px;padding:5px;background:#eee5d9;border:1px solid #e1d5c7;border-radius:13px;width:max-content;max-width:100%}
      .mandateGeoTab{border:0;background:transparent;color:#766b60;border-radius:9px;padding:9px 12px;font:inherit;font-size:11px;font-weight:800;cursor:pointer;display:flex;align-items:center;gap:7px;transition:.16s ease}
      .mandateGeoTab:hover{color:#171511;background:rgba(255,255,255,.48)}
      .mandateGeoTab.active{background:#fffdf9;color:#171511;box-shadow:0 2px 8px rgba(45,35,24,.08)}
      .mandateGeoTab b{min-width:20px;height:20px;padding:0 6px;border-radius:999px;display:grid;place-items:center;background:#dfd3c5;color:#746556;font-size:9px}
      .mandateGeoTab.active b{background:#171511;color:#fffaf3}
      .mandateGeoEmpty{grid-column:1/-1;padding:26px 8px;color:#867a6d;font-size:12px;text-align:center}
      @media(max-width:760px){.mandateGeoTabs{width:100%;overflow-x:auto;flex-wrap:nowrap;padding-bottom:6px}.mandateGeoTab{white-space:nowrap;flex:0 0 auto}}
    `;
    document.head.appendChild(style);
  }

  function render(){
    const cardsRoot=document.getElementById('mandateCards');
    if(!cardsRoot)return;
    const cards=[...cardsRoot.querySelectorAll('.mandateCard')];
    if(!cards.length){
      document.getElementById('mandateGeoTabs')?.remove();
      lastSignature='';
      return;
    }

    const signature=cards.map(c=>geographyFor(c)).join('|');
    const needsRebuild=signature!==lastSignature||cards.some(c=>!c.dataset.geoBucket)||!document.getElementById('mandateGeoTabs');
    if(!needsRebuild)return;
    lastSignature=signature;

    cards.forEach(card=>{card.dataset.geoBucket=bucketFor(geographyFor(card))});
    const counts={all:cards.length,'southeast-asia':0,'united-states':0,'north-america':0,europe:0,other:0};
    cards.forEach(card=>{counts[card.dataset.geoBucket]=(counts[card.dataset.geoBucket]||0)+1});

    let tabs=document.getElementById('mandateGeoTabs');
    if(!tabs){
      tabs=document.createElement('div');
      tabs.id='mandateGeoTabs';
      tabs.className='mandateGeoTabs';
      tabs.setAttribute('role','tablist');
      cardsRoot.insertAdjacentElement('beforebegin',tabs);
      tabs.addEventListener('click',e=>{
        const btn=e.target.closest('[data-geo-tab]');
        if(!btn)return;
        active=btn.dataset.geoTab;
        applyFilter();
      });
    }

    const visibleTabs=TAB_ORDER.filter(key=>key==='all'||counts[key]>0);
    if(!visibleTabs.includes(active))active='all';
    tabs.innerHTML=visibleTabs.map(key=>`<button type="button" class="mandateGeoTab ${key===active?'active':''}" data-geo-tab="${key}" role="tab" aria-selected="${key===active?'true':'false'}"><span>${LABELS[key]}</span><b>${counts[key]}</b></button>`).join('');
    applyFilter();
  }

  function applyFilter(){
    const cardsRoot=document.getElementById('mandateCards');
    if(!cardsRoot)return;
    const cards=[...cardsRoot.querySelectorAll('.mandateCard')];
    let shown=0;
    cards.forEach(card=>{
      const show=active==='all'||card.dataset.geoBucket===active;
      card.style.display=show?'':'none';
      if(show)shown++;
    });
    document.querySelectorAll('#mandateGeoTabs [data-geo-tab]').forEach(btn=>{
      const selected=btn.dataset.geoTab===active;
      btn.classList.toggle('active',selected);
      btn.setAttribute('aria-selected',selected?'true':'false');
    });
    let empty=document.getElementById('mandateGeoEmpty');
    if(!shown){
      if(!empty){empty=document.createElement('div');empty.id='mandateGeoEmpty';empty.className='mandateGeoEmpty';cardsRoot.appendChild(empty)}
      empty.textContent='No active buyer mandates in this geography.';
    }else empty?.remove();
  }

  ensureStyles();
  render();
  setInterval(render,1200);
})();