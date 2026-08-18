(function(){
  if(window.__outerhavenOriginatorWalkthrough)return;
  window.__outerhavenOriginatorWalkthrough=true;

  const VERSION='v1';
  let stepIndex=0;
  let overlay=null;
  let currentTarget=null;
  let positionTimer=null;

  const style=document.createElement('style');
  style.textContent=`
    .owHelp{position:fixed;right:18px;bottom:18px;z-index:2600;width:34px;height:34px;border:1px solid #d9dee4;border-radius:50%;background:#fff;color:#111318;display:grid;place-items:center;font-size:15px;font-weight:900;cursor:pointer;box-shadow:0 8px 24px rgba(17,19,24,.10)}
    .owHelp:hover{background:#f5f7f8}.owOverlay{position:fixed;inset:0;z-index:4000;background:rgba(17,19,24,.48);padding:0}.owCard{width:min(350px,calc(100vw - 28px));background:#fff;border-radius:16px;padding:18px;box-shadow:0 24px 80px rgba(0,0,0,.28);position:fixed;z-index:4010;left:50%;top:50%;transform:translate(-50%,-50%);transition:left .16s ease,top .16s ease,transform .16s ease}.owEyebrow{font-size:8px;font-weight:900;letter-spacing:.12em;color:#777f89}.owCard h2{font-size:19px;letter-spacing:-.025em;margin:5px 0 7px}.owCard p{font-size:10px;line-height:1.6;color:#5f6873;margin:0}.owStep{margin-top:13px;display:flex;align-items:center;justify-content:space-between;gap:12px}.owDots{display:flex;gap:5px}.owDot{width:6px;height:6px;border-radius:99px;background:#d8dde2}.owDot.active{width:18px;background:#111318}.owActions{display:flex;gap:7px}.owBtn{border:1px solid #d7dce1;background:#fff;border-radius:8px;padding:8px 10px;font-size:8.5px;font-weight:850;cursor:pointer}.owBtn.primary{background:#111318;color:#fff;border-color:#111318}.owSkip{border:0;background:transparent;color:#858d97;padding:6px 0;font-size:8px;font-weight:800;cursor:pointer}.owTarget{position:relative!important;z-index:4005!important;outline:3px solid #fff!important;box-shadow:0 0 0 7px rgba(255,255,255,.22),0 12px 40px rgba(0,0,0,.25)!important;border-radius:10px!important}.owTarget *{position:relative;z-index:1}.owHint{margin-top:9px;padding:8px 9px;border-radius:9px;background:#f5f7f8;font-size:8.5px;line-height:1.5;color:#737c87}
    @media(max-width:700px){.owHelp{right:12px;bottom:12px}.owCard{width:calc(100vw - 20px);border-radius:15px}.owTarget{z-index:4005!important}}
  `;
  document.head.appendChild(style);

  const steps=[
    {
      title:'Welcome to the Originator Portal',
      copy:'This is your workspace for submitting institutional opportunities directly to Outerhaven. You can review our current buyer thesis, send opportunities and supporting materials, complete diligence, and track each submission from one place.',
      hint:'An opportunity is not sent into Outerhaven’s review queue until the diligence step is complete.'
    },
    {
      title:'Start with the Buyer Thesis',
      copy:'This section shows the current mandate we are matching against, including preferred transaction scale, geography, sectors, and structures. Use it as a quick fit check before submitting an opportunity.',
      section:'home',
      target:'.thesisPreview'
    },
    {
      title:'Import the One-Pager or Pitch Deck First',
      copy:'On a new submission, upload the primary one-pager or pitch deck at the top. The portal reads the document and pre-fills the opportunity fields for you. Always review the extracted information, especially the exact capital ask, before continuing.',
      section:'submit',
      target:'#odImport',
      hint:'If the portal cannot confidently identify the exact capital ask, it will leave that field blank for you to confirm.'
    },
    {
      title:'Complete the Remaining Diligence',
      copy:'After the opportunity details are confirmed, click Continue to Diligence. Questions already answered in Step 1 are removed. Complete only the remaining questions, or mark one Not Applicable when appropriate.',
      section:'submit',
      target:'.formActions',
      hint:'This is the final gate. The opportunity is submitted to Outerhaven only after diligence is complete.'
    },
    {
      title:'Track Your Submissions',
      copy:'My Submissions is where you can follow every opportunity you have sent through the portal. You will see the thesis match, supporting documents, and status as the opportunity moves through review, matching, buyer interest, engagement, or close.',
      section:'submissions',
      target:'.navBtn[data-section="submissions"]'
    }
  ];

  function storageKey(){
    let id='originator';
    try{if(typeof currentUser!=='undefined'&&currentUser?.id)id=currentUser.id;else id=document.getElementById('accountEmail')?.textContent?.trim()||id}catch{}
    return `outerhaven_originator_walkthrough_${VERSION}_${id}`;
  }

  function seen(){try{return localStorage.getItem(storageKey())==='1'}catch{return false}}
  function markSeen(){try{localStorage.setItem(storageKey(),'1')}catch{}}

  function installHelp(){
    if(document.getElementById('owHelp'))return;
    const b=document.createElement('button');
    b.id='owHelp';b.className='owHelp';b.type='button';b.textContent='?';
    b.setAttribute('aria-label','Replay portal walkthrough');b.title='Portal walkthrough';
    b.onclick=()=>start();
    document.body.appendChild(b);
  }

  function clearTarget(){if(currentTarget){currentTarget.classList.remove('owTarget');currentTarget=null}}

  function ensureSection(name){
    if(!name)return;
    try{if(typeof showSection==='function')showSection(name)}catch{}
  }

  function targetFor(step){return step.target?document.querySelector(step.target):null}

  function centerCard(){
    const card=overlay?.querySelector('.owCard');if(!card)return;
    card.style.left='50%';card.style.top='50%';card.style.transform='translate(-50%,-50%)';
  }

  function intersects(a,b,gap=0){
    return !(a.right+gap<=b.left||a.left-gap>=b.right||a.bottom+gap<=b.top||a.top-gap>=b.bottom);
  }

  function clamp(v,min,max){return Math.max(min,Math.min(max,v))}

  function positionCard(target){
    const card=overlay?.querySelector('.owCard');if(!card)return;
    if(!target){centerCard();return}

    const vw=window.innerWidth,vh=window.innerHeight,margin=14,gap=20;
    const r=target.getBoundingClientRect();
    const cw=Math.min(card.offsetWidth||350,vw-margin*2),ch=Math.min(card.offsetHeight||260,vh-margin*2);
    const targetRect={left:r.left,top:r.top,right:r.right,bottom:r.bottom};

    const candidates=[
      {name:'right',left:r.right+gap,top:r.top+(r.height-ch)/2},
      {name:'left',left:r.left-gap-cw,top:r.top+(r.height-ch)/2},
      {name:'below',left:r.left+(r.width-cw)/2,top:r.bottom+gap},
      {name:'above',left:r.left+(r.width-cw)/2,top:r.top-gap-ch}
    ];

    let best=null;
    for(const c of candidates){
      const left=clamp(c.left,margin,vw-cw-margin);
      const top=clamp(c.top,margin,vh-ch-margin);
      const box={left,top,right:left+cw,bottom:top+ch};
      const overlap=intersects(box,targetRect,10);
      const displacement=Math.abs(left-c.left)+Math.abs(top-c.top);
      const score=(overlap?100000:0)+displacement;
      if(!best||score<best.score)best={left,top,score,overlap};
    }

    if(!best||best.overlap){
      const safeZones=[
        {left:margin,top:margin},
        {left:vw-cw-margin,top:margin},
        {left:margin,top:vh-ch-margin},
        {left:vw-cw-margin,top:vh-ch-margin}
      ];
      const safe=safeZones.map(p=>{
        const box={left:p.left,top:p.top,right:p.left+cw,bottom:p.top+ch};
        const overlap=intersects(box,targetRect,10);
        const centerDist=Math.hypot((p.left+cw/2)-(r.left+r.width/2),(p.top+ch/2)-(r.top+r.height/2));
        return {...p,overlap,centerDist};
      }).sort((a,b)=>Number(a.overlap)-Number(b.overlap)||b.centerDist-a.centerDist)[0];
      best=safe;
    }

    card.style.left=`${Math.round(clamp(best.left,margin,vw-cw-margin))}px`;
    card.style.top=`${Math.round(clamp(best.top,margin,vh-ch-margin))}px`;
    card.style.transform='none';
  }

  function schedulePosition(target){
    clearTimeout(positionTimer);
    positionTimer=setTimeout(()=>positionCard(target),220);
  }

  function render(){
    if(!overlay)return;
    clearTarget();
    const step=steps[stepIndex];
    ensureSection(step.section);

    overlay.innerHTML=`<div class="owCard" role="dialog" aria-modal="true" aria-label="Originator portal walkthrough"><div class="owEyebrow">PORTAL WALKTHROUGH · ${stepIndex+1} OF ${steps.length}</div><h2>${step.title}</h2><p>${step.copy}</p>${step.hint?`<div class="owHint">${step.hint}</div>`:''}<div class="owStep"><div><button type="button" class="owSkip" data-ow-skip>Skip walkthrough</button><div class="owDots">${steps.map((_,i)=>`<span class="owDot ${i===stepIndex?'active':''}"></span>`).join('')}</div></div><div class="owActions">${stepIndex?'<button type="button" class="owBtn" data-ow-back>Back</button>':''}<button type="button" class="owBtn primary" data-ow-next>${stepIndex===steps.length-1?'Finish':'Next'}</button></div></div></div>`;
    centerCard();

    setTimeout(()=>{
      const target=targetFor(step);
      if(target){
        currentTarget=target;
        target.classList.add('owTarget');
        try{target.scrollIntoView({behavior:'smooth',block:'center',inline:'nearest'})}catch{}
        schedulePosition(target);
      }else centerCard();
    },80);

    overlay.querySelector('[data-ow-skip]').onclick=finish;
    overlay.querySelector('[data-ow-back]')?.addEventListener('click',()=>{stepIndex--;render()});
    overlay.querySelector('[data-ow-next]').onclick=()=>{if(stepIndex===steps.length-1)finish();else{stepIndex++;render()}};
  }

  function start(){
    if(overlay)return;
    stepIndex=0;
    overlay=document.createElement('div');overlay.className='owOverlay';document.body.appendChild(overlay);
    render();
  }

  function finish(){
    markSeen();clearTimeout(positionTimer);clearTarget();overlay?.remove();overlay=null;
    try{if(typeof showSection==='function')showSection('home')}catch{}
  }

  window.addEventListener('resize',()=>{if(overlay)positionCard(currentTarget)});
  window.addEventListener('scroll',()=>{if(overlay&&currentTarget)positionCard(currentTarget)},{passive:true});

  function boot(){
    const app=document.getElementById('app');
    if(!app||app.classList.contains('hidden'))return false;
    installHelp();
    if(!seen())setTimeout(()=>start(),500);
    return true;
  }

  if(!boot()){
    const timer=setInterval(()=>{if(boot())clearInterval(timer)},200);
    setTimeout(()=>clearInterval(timer),15000);
  }
})();