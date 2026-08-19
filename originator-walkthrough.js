(function(){
  if(window.__outerhavenOriginatorWalkthrough)return;
  window.__outerhavenOriginatorWalkthrough=true;

  const VERSION='v4-concise';
  let stepIndex=0;
  let overlay=null;
  let currentTarget=null;
  let liveCursor=null;
  let demoTimers=[];
  let diligencePreview=null;

  const style=document.createElement('style');
  style.textContent=`
    .owHelp{position:fixed;right:18px;bottom:18px;z-index:2600;border:1px solid #d7dce1;border-radius:999px;background:#fff;color:#111318;display:flex;align-items:center;gap:9px;padding:12px 16px;font-size:14px;font-weight:850;cursor:pointer;box-shadow:0 10px 30px rgba(17,19,24,.13)}
    .owHelp:before{content:'?';width:23px;height:23px;border-radius:50%;background:#111318;color:#fff;display:grid;place-items:center;font-size:13px;font-weight:900}.owHelp:hover{background:#f6f7f8}
    .owOverlay{position:fixed;inset:0;z-index:4000;background:rgba(17,19,24,.42);pointer-events:none}
    .owCard{width:min(390px,calc(100vw - 36px));background:#fff;border-radius:18px;padding:21px;box-shadow:0 24px 80px rgba(0,0,0,.28);position:fixed;z-index:4010;right:18px;top:18px;max-height:calc(100vh - 36px);overflow:auto;pointer-events:auto}
    .owCard.owLeft{left:18px;right:auto}
    .owEyebrow{font-size:11px;font-weight:900;letter-spacing:.11em;color:#737c87}.owCard h2{font-size:25px;line-height:1.12;letter-spacing:-.03em;margin:7px 0 8px;color:#17191d}.owCard>p{font-size:15px;line-height:1.5;color:#59636f;margin:0}
    .owDo{margin-top:13px;border:1px solid #dde2e7;background:#f7f8fa;border-radius:12px;padding:13px 14px}.owDo strong{display:block;font-size:12px;letter-spacing:.06em;text-transform:uppercase;margin-bottom:6px}.owDo ul{margin:0;padding-left:18px}.owDo li{font-size:14px;line-height:1.45;color:#343b44;padding:2px 0}
    .owLiveBar{margin-top:12px;border:1px solid #dce2e7;border-radius:11px;background:#fff;padding:10px 11px;display:grid;grid-template-columns:1fr auto;gap:10px;align-items:center}.owLiveBar strong{font-size:11px;letter-spacing:.06em;color:#252a30}.owLiveStatus{display:block;font-size:12px;line-height:1.35;color:#6f7882;margin-top:3px}.owReplay{border:1px solid #d4d9df;background:#fff;border-radius:9px;padding:8px 10px;font-size:12px;font-weight:850;color:#353d45;cursor:pointer;white-space:nowrap}.owReplay:hover{background:#f5f6f7}
    .owHint{margin-top:11px;padding:10px 11px;border-radius:10px;background:#fff8e8;border:1px solid #f0dfaf;font-size:13px;line-height:1.45;color:#6d5718}
    .owStep{margin-top:15px;display:flex;align-items:flex-end;justify-content:space-between;gap:12px}.owDots{display:flex;gap:5px;margin-top:6px}.owDot{width:7px;height:7px;border-radius:99px;background:#d8dde2}.owDot.active{width:20px;background:#111318}.owActions{display:flex;gap:7px;flex-wrap:wrap;justify-content:flex-end}.owBtn{border:1px solid #d4d9df;background:#fff;border-radius:9px;padding:10px 12px;font-size:13px;font-weight:850;cursor:pointer}.owBtn.primary{background:#111318;color:#fff;border-color:#111318}.owSkip{border:0;background:transparent;color:#737c87;padding:3px 0;font-size:12px;font-weight:800;cursor:pointer}
    .owTarget{position:relative!important;z-index:4005!important;outline:4px solid #fff!important;box-shadow:0 0 0 7px rgba(255,255,255,.24),0 14px 42px rgba(0,0,0,.28)!important;border-radius:10px!important;pointer-events:none!important}.owTarget:after{content:'';position:absolute;inset:-7px;border:2px solid rgba(255,255,255,.75);border-radius:13px;pointer-events:none;animation:owTargetPulse 1.3s ease-in-out infinite}
    .owLiveCursor{position:fixed;z-index:4008;width:25px;height:33px;background:#fff;clip-path:polygon(0 0,0 100%,34% 72%,52% 98%,66% 90%,49% 67%,100% 67%);filter:drop-shadow(0 2px 1px rgba(0,0,0,.9)) drop-shadow(0 0 1px #111318);transform-origin:3px 3px;pointer-events:none;transition:left .8s cubic-bezier(.2,.72,.2,1),top .8s cubic-bezier(.2,.72,.2,1),transform .16s ease;left:50vw;top:50vh}.owLiveCursor.click{transform:scale(.76)}.owLiveCursor.click:after{content:'';position:absolute;width:34px;height:34px;border:3px solid #fff;border-radius:50%;left:-14px;top:-14px;animation:owClickRing .55s ease-out}
    .owDiligencePreview{position:fixed;z-index:4006;left:calc(230px + 28px);right:430px;top:50%;transform:translateY(-50%);max-height:82vh;overflow:auto;background:#f7f8fa;border-radius:17px;box-shadow:0 28px 90px rgba(0,0,0,.3);pointer-events:none}.owDiligencePreview .odpHead{background:#fff;border-bottom:1px solid #e4e7eb;padding:16px 18px}.owDiligencePreview .odpHead span{font-size:10px;font-weight:900;letter-spacing:.1em;color:#737c87}.owDiligencePreview .odpHead h3{margin:4px 0 4px;font-size:20px}.owDiligencePreview .odpHead p{margin:0;color:#747d88;font-size:12px;line-height:1.45}.owDiligencePreview .odpBody{padding:13px 17px 17px}.owDiligencePreview .odpBadge{display:inline-block;background:#111318;color:#fff;border-radius:7px;padding:5px 7px;font-size:9px;font-weight:900;letter-spacing:.06em;margin-bottom:9px}.owDiligencePreview .odpQuestions{display:grid;gap:8px}.owDiligencePreview .odpQ{background:#fff;border:1px solid #e2e6ea;border-radius:11px;padding:11px}.owDiligencePreview .odpQ strong{display:block;font-size:12px;line-height:1.4}.owDiligencePreview .odpQ span{display:block;margin-top:4px;font-size:10px;color:#858e99}.owDiligencePreview .odpFakeInput{height:34px;border:1px solid #d5dae0;border-radius:8px;margin-top:7px;background:#fff}.owDiligencePreview .odpMore{margin-top:9px;text-align:center;color:#737c87;font-size:11px;font-weight:800}
    @keyframes owTargetPulse{0%,100%{opacity:.55}50%{opacity:1}}@keyframes owClickRing{0%{opacity:1;transform:scale(.35)}100%{opacity:0;transform:scale(1.5)}}
    @media(max-width:1050px){.owDiligencePreview{left:18px;right:420px}}
    @media(max-width:760px){.owHelp{right:12px;bottom:12px;padding:10px 13px;font-size:13px}.owCard,.owCard.owLeft{left:9px!important;right:9px!important;top:9px!important;width:auto!important;max-height:calc(100vh - 18px);padding:18px;border-radius:15px}.owCard h2{font-size:22px}.owCard>p{font-size:14px}.owDo li{font-size:13px}.owLiveBar{grid-template-columns:1fr}.owReplay{width:100%}.owStep{align-items:flex-start;flex-direction:column}.owActions{width:100%}.owBtn{flex:1}.owDiligencePreview{display:none}}
    @media(prefers-reduced-motion:reduce){.owTarget:after{animation:none}.owLiveCursor{transition:none!important}}
  `;
  document.head.appendChild(style);

  const steps=[
    {
      title:'Portal Navigation',
      copy:'Use these four sections to submit deals and track investor activity.',
      actions:['Overview: your dashboard.','Submit Opportunity: send a deal for investor review.','My Submissions: track submitted deals.','Buyer Thesis: see what our network is currently searching for.'],
      section:'home',dock:'right',target:'.navBtn[data-section="home"]',
      path:[
        {selector:'.navBtn[data-section="home"]',status:'Overview'},
        {selector:'.navBtn[data-section="submit"]',status:'Submit Opportunity'},
        {selector:'.navBtn[data-section="submissions"]',status:'My Submissions'},
        {selector:'.navBtn[data-section="thesis"]',status:'Buyer Thesis'}
      ]
    },
    {
      title:'Buyer Thesis',
      copy:'This is what our investor network is currently searching for.',
      actions:['Check the preferred deal size.','Check sector, geography, and structure.','Use the current buyer mandates for more specific opportunities.'],
      section:'thesis',dock:'right',target:'.fullThesis',
      path:[{selector:'.fullThesis',status:'Review the current thesis before submitting a deal'}]
    },
    {
      title:'Submit an Opportunity',
      copy:'Start here when you have a deal you want matched with investors.',
      actions:['Open Submit Opportunity.','Add the deal details.','Attach the main deal materials.'],
      section:'submit',dock:'right',target:'#submissionForm .panelHead',
      path:[{selector:'#submissionForm .panelHead',status:'Step 1: add the opportunity details'}]
    },
    {
      title:'Upload the Deal Materials',
      copy:'Upload the one-pager or pitch deck before filling in the rest of the form.',
      actions:['Click Choose files.','Select the main deck or one-pager.','Wait for the portal to read the document and fill what it can.'],
      section:'submit',dock:'right',target:'#fileDrop',
      path:[{selector:'#chooseFiles',fallback:'#fileDrop',status:'Choose the main deal document',click:true}]
    },
    {
      title:'Review the Deal Details',
      copy:'Check the information pulled from the document before continuing.',
      actions:['Verify the project name and sponsor.','Verify the capital ask, sector, geography, and transaction type.','Correct anything that is missing or wrong.'],
      section:'submit',dock:'right',target:'#submissionForm',
      path:[{selector:'#submissionForm',status:'Review the full form before continuing'}]
    },
    {
      title:'Complete Diligence',
      copy:'After the deal details are correct, continue to the diligence questions.',
      actions:['Click Continue to Diligence.','Answer each question or mark it Not Applicable.','Submit when the diligence section is complete.'],
      section:'submit',dock:'right',target:'#submitDeal',diligence:true,
      path:[{selector:'#submitDeal',status:'Click Continue to Diligence',click:true}]
    },
    {
      title:'Track Your Submissions',
      copy:'Use My Submissions to follow each deal after it is sent for investor review.',
      actions:['Open My Submissions.','Check the current status and match score.','Return here whenever you need to see progress or complete a requested action.'],
      section:'submissions',dock:'right',target:'#submissionCards',
      path:[{selector:'.submissionCard',fallback:'#submissionCards',status:'Your submitted deals appear here'}]
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
    b.id='owHelp';b.className='owHelp';b.type='button';b.textContent='Tutorial';
    b.setAttribute('aria-label','Replay portal tutorial');b.title='Replay portal tutorial';b.onclick=start;
    document.body.appendChild(b);
  }

  function ensureSection(name){if(!name)return;try{if(typeof showSection==='function')showSection(name)}catch{}}
  function elementFor(item){
    if(!item)return null;
    let el=null;
    try{if(item.selector)el=document.querySelector(item.selector)}catch{}
    if(!el&&item.fallback){try{el=document.querySelector(item.fallback)}catch{}}
    return el;
  }

  function clearTarget(){if(currentTarget){currentTarget.classList.remove('owTarget');currentTarget=null}}
  function spotlight(el,scroll=false){
    if(!el)return;
    if(currentTarget&&currentTarget!==el)currentTarget.classList.remove('owTarget');
    currentTarget=el;el.classList.add('owTarget');
    if(scroll){try{el.scrollIntoView({behavior:'smooth',block:'center',inline:'nearest'})}catch{}}
  }

  function clearTimers(){demoTimers.forEach(clearTimeout);demoTimers=[]}
  function clearPreview(){diligencePreview?.remove();diligencePreview=null}
  function removeLiveDemo(){clearTimers();liveCursor?.remove();liveCursor=null;clearPreview()}
  function ensureCursor(){if(!liveCursor){liveCursor=document.createElement('div');liveCursor.className='owLiveCursor';document.body.appendChild(liveCursor)}}
  function setStatus(text){const el=overlay?.querySelector('.owLiveStatus');if(el)el.textContent=text||''}

  function pointAt(el,item){
    if(!el)return;
    ensureCursor();spotlight(el,false);
    const r=el.getBoundingClientRect();
    const x=Math.max(12,Math.min(window.innerWidth-36,r.left+Math.min(r.width*.55,Math.max(18,r.width-18))));
    const y=Math.max(12,Math.min(window.innerHeight-42,r.top+Math.min(r.height*.5,Math.max(15,r.height-15))));
    liveCursor.style.left=`${Math.round(x)}px`;liveCursor.style.top=`${Math.round(y)}px`;
    setStatus(item.status||'Look here');
    if(item.click){
      const t=setTimeout(()=>{if(!liveCursor)return;liveCursor.classList.add('click');const t2=setTimeout(()=>liveCursor?.classList.remove('click'),420);demoTimers.push(t2)},900);demoTimers.push(t);
    }
  }

  function showDiligencePreview(){
    clearPreview();
    diligencePreview=document.createElement('div');
    diligencePreview.className='owDiligencePreview';
    diligencePreview.innerHTML=`<div class="odpHead"><span>ORIGINATOR DILIGENCE</span><h3>Complete the opportunity review</h3><p>Review the pre-filled answers and complete anything that is still missing.</p></div><div class="odpBody"><div class="odpBadge">12 DILIGENCE QUESTIONS</div><div class="odpQuestions"><div class="odpQ"><strong>What is the total project or transaction size?</strong><span>Enter the total project value, development cost, enterprise value, or transaction size.</span><div class="odpFakeInput"></div></div><div class="odpQ"><strong>What is the exact capital ask?</strong><span>Enter the amount of capital currently being sought.</span><div class="odpFakeInput"></div></div><div class="odpQ"><strong>Is the ask equity, debt, mezzanine financing, or a combination?</strong><span>Describe the proposed capital structure.</span><div class="odpFakeInput"></div></div><div class="odpQ"><strong>Can you provide a basic sources-and-uses breakdown?</strong><span>A concise breakdown is sufficient.</span><div class="odpFakeInput"></div></div><div class="odpQ"><strong>Are you directly connected with the management or sponsor team?</strong><span>State Yes or No and briefly describe the relationship if helpful.</span><div class="odpFakeInput"></div></div></div><div class="odpMore">Continue through all 12 questions before submitting.</div></div>`;
    document.body.appendChild(diligencePreview);
    clearTarget();setStatus('These are the diligence questions that open next');
  }

  function playDemo(){
    if(!overlay)return;
    clearTimers();clearPreview();ensureCursor();
    const step=steps[stepIndex];
    const path=(step.path||[]).filter(item=>elementFor(item));
    if(!path.length)return;

    path.forEach((item,i)=>{
      const timer=setTimeout(()=>{
        if(!overlay)return;
        const el=elementFor(item);if(!el)return;
        pointAt(el,item);
        if(step.diligence&&i===path.length-1){
          const previewTimer=setTimeout(()=>{if(overlay)showDiligencePreview()},2300);demoTimers.push(previewTimer);
        }
      },i*2400);demoTimers.push(timer);
    });
  }

  function render(){
    if(!overlay)return;
    removeLiveDemo();clearTarget();
    const step=steps[stepIndex];ensureSection(step.section);
    overlay.innerHTML=`<div class="owCard ${step.dock==='left'?'owLeft':''}" role="dialog" aria-modal="true" aria-label="Originator portal tutorial"><div class="owEyebrow">ORIGINATOR PORTAL TUTORIAL · ${stepIndex+1} OF ${steps.length}</div><h2>${step.title}</h2><p>${step.copy}</p><div class="owDo"><strong>What to do</strong><ul>${step.actions.map(x=>`<li>${x}</li>`).join('')}</ul></div><div class="owLiveBar"><div><strong>ON-SCREEN GUIDE</strong><span class="owLiveStatus">Watch the highlighted area.</span></div><button type="button" class="owReplay" data-ow-replay>Replay</button></div>${step.hint?`<div class="owHint">${step.hint}</div>`:''}<div class="owStep"><div><button type="button" class="owSkip" data-ow-skip>Skip tutorial</button><div class="owDots">${steps.map((_,i)=>`<span class="owDot ${i===stepIndex?'active':''}"></span>`).join('')}</div></div><div class="owActions">${stepIndex?'<button type="button" class="owBtn" data-ow-back>Back</button>':''}<button type="button" class="owBtn primary" data-ow-next>${stepIndex===steps.length-1?'Finish':'Next'}</button></div></div></div>`;
    overlay.querySelector('[data-ow-skip]').onclick=finish;
    overlay.querySelector('[data-ow-back]')?.addEventListener('click',()=>{stepIndex--;render()});
    overlay.querySelector('[data-ow-next]').onclick=()=>{if(stepIndex===steps.length-1)finish();else{stepIndex++;render()}};
    overlay.querySelector('[data-ow-replay]').onclick=playDemo;

    const t=setTimeout(()=>{
      if(!overlay)return;
      const target=elementFor({selector:step.target})||elementFor(step.path?.[0]);
      if(target)spotlight(target,false);
      playDemo();
    },350);demoTimers.push(t);
  }

  function start(){if(overlay)return;stepIndex=0;overlay=document.createElement('div');overlay.className='owOverlay';document.body.appendChild(overlay);render()}
  function finish(){markSeen();removeLiveDemo();clearTarget();overlay?.remove();overlay=null;try{if(typeof showSection==='function')showSection('home')}catch{}}

  window.addEventListener('keydown',ev=>{if(ev.key==='Escape'&&overlay)finish()});

  function boot(){
    const app=document.getElementById('app');if(!app||app.classList.contains('hidden'))return false;
    installHelp();if(!seen())setTimeout(start,650);return true;
  }
  if(!boot()){
    const timer=setInterval(()=>{if(boot())clearInterval(timer)},200);
    setTimeout(()=>clearInterval(timer),15000);
  }
})();