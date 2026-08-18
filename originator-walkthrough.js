(function(){
  if(window.__outerhavenOriginatorWalkthrough)return;
  window.__outerhavenOriginatorWalkthrough=true;

  const VERSION='v1';
  let stepIndex=0;
  let overlay=null;
  let currentTarget=null;

  const style=document.createElement('style');
  style.textContent=`
    .owHelp{position:fixed;right:18px;bottom:18px;z-index:2600;width:34px;height:34px;border:1px solid #d9dee4;border-radius:50%;background:#fff;color:#111318;display:grid;place-items:center;font-size:15px;font-weight:900;cursor:pointer;box-shadow:0 8px 24px rgba(17,19,24,.10)}
    .owHelp:hover{background:#f5f7f8}.owOverlay{position:fixed;inset:0;z-index:4000;background:rgba(17,19,24,.48);display:grid;place-items:center;padding:18px}.owCard{width:min(430px,calc(100vw - 32px));background:#fff;border-radius:16px;padding:18px;box-shadow:0 24px 80px rgba(0,0,0,.28);position:relative;z-index:4010}.owEyebrow{font-size:8px;font-weight:900;letter-spacing:.12em;color:#777f89}.owCard h2{font-size:19px;letter-spacing:-.025em;margin:5px 0 7px}.owCard p{font-size:10px;line-height:1.6;color:#5f6873;margin:0}.owStep{margin-top:13px;display:flex;align-items:center;justify-content:space-between;gap:12px}.owDots{display:flex;gap:5px}.owDot{width:6px;height:6px;border-radius:99px;background:#d8dde2}.owDot.active{width:18px;background:#111318}.owActions{display:flex;gap:7px}.owBtn{border:1px solid #d7dce1;background:#fff;border-radius:8px;padding:8px 10px;font-size:8.5px;font-weight:850;cursor:pointer}.owBtn.primary{background:#111318;color:#fff;border-color:#111318}.owSkip{border:0;background:transparent;color:#858d97;padding:6px 0;font-size:8px;font-weight:800;cursor:pointer}.owTarget{position:relative!important;z-index:4005!important;outline:3px solid #fff!important;box-shadow:0 0 0 7px rgba(255,255,255,.22),0 12px 40px rgba(0,0,0,.25)!important;border-radius:10px!important}.owTarget *{position:relative;z-index:1}.owHint{margin-top:9px;padding:8px 9px;border-radius:9px;background:#f5f7f8;font-size:8.5px;line-height:1.5;color:#737c87}
    @media(max-width:700px){.owHelp{right:12px;bottom:12px}.owOverlay{align-items:end;padding:10px}.owCard{width:100%;border-radius:15px}.owTarget{z-index:4005!important}}
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
      copy:'After the opportunity details are confirmed, you will move to a short diligence step. Questions already answered in Step 1 are removed. Complete only the remaining questions, or mark one Not Applicable when appropriate.',
      section:'submit',
      target:'#submissionForm',
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
    b.onclick=()=>start(true);
    document.body.appendChild(b);
  }

  function clearTarget(){if(currentTarget){currentTarget.classList.remove('owTarget');currentTarget=null}}

  function ensureSection(name){
    if(!name)return;
    try{if(typeof showSection==='function')showSection(name)}catch{}
  }

  function targetFor(step){
    if(!step.target)return null;
    return document.querySelector(step.target);
  }

  function render(){
    if(!overlay)return;
    clearTarget();
    const step=steps[stepIndex];
    ensureSection(step.section);

    setTimeout(()=>{
      const target=targetFor(step);
      if(target){
        currentTarget=target;target.classList.add('owTarget');
        try{target.scrollIntoView({behavior:'smooth',block:'center',inline:'nearest'})}catch{}
      }
    },80);

    overlay.innerHTML=`<div class="owCard" role="dialog" aria-modal="true" aria-label="Originator portal walkthrough"><div class="owEyebrow">PORTAL WALKTHROUGH · ${stepIndex+1} OF ${steps.length}</div><h2>${step.title}</h2><p>${step.copy}</p>${step.hint?`<div class="owHint">${step.hint}</div>`:''}<div class="owStep"><div><button type="button" class="owSkip" data-ow-skip>Skip walkthrough</button><div class="owDots">${steps.map((_,i)=>`<span class="owDot ${i===stepIndex?'active':''}"></span>`).join('')}</div></div><div class="owActions">${stepIndex?'<button type="button" class="owBtn" data-ow-back>Back</button>':''}<button type="button" class="owBtn primary" data-ow-next>${stepIndex===steps.length-1?'Finish':'Next'}</button></div></div></div>`;
    overlay.querySelector('[data-ow-skip]').onclick=finish;
    overlay.querySelector('[data-ow-back]')?.addEventListener('click',()=>{stepIndex--;render()});
    overlay.querySelector('[data-ow-next]').onclick=()=>{if(stepIndex===steps.length-1)finish();else{stepIndex++;render()}};
  }

  function start(replay=false){
    if(overlay)return;
    stepIndex=0;
    overlay=document.createElement('div');overlay.className='owOverlay';document.body.appendChild(overlay);
    render();
    if(!replay)markSeen();
  }

  function finish(){
    markSeen();clearTarget();overlay?.remove();overlay=null;
    try{if(typeof showSection==='function')showSection('home')}catch{}
  }

  function boot(){
    const app=document.getElementById('app');
    if(!app||app.classList.contains('hidden'))return false;
    installHelp();
    if(!seen())setTimeout(()=>start(false),500);
    return true;
  }

  if(!boot()){
    const timer=setInterval(()=>{if(boot())clearInterval(timer)},200);
    setTimeout(()=>clearInterval(timer),15000);
  }
})();