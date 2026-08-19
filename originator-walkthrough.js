(function(){
  if(window.__outerhavenOriginatorWalkthrough)return;
  window.__outerhavenOriginatorWalkthrough=true;

  const VERSION='v6-spotlight';
  let stepIndex=0;
  let root=null;
  let card=null;
  let spot=null;
  let cursor=null;
  let currentTarget=null;
  let runToken=0;
  let diligencePreview=null;

  const style=document.createElement('style');
  style.textContent=`
    .owHelp{position:fixed;right:18px;bottom:18px;z-index:2600;border:1px solid #d7dce1;border-radius:999px;background:#fff;color:#111318;display:flex;align-items:center;gap:9px;padding:12px 16px;font-size:14px;font-weight:850;cursor:pointer;box-shadow:0 10px 30px rgba(17,19,24,.13)}
    .owHelp:before{content:'?';width:23px;height:23px;border-radius:50%;background:#111318;color:#fff;display:grid;place-items:center;font-size:13px;font-weight:900}.owHelp:hover{background:#f6f7f8}
    .owRoot{position:fixed;inset:0;z-index:4000;pointer-events:none}
    .owSpot{position:fixed;z-index:4001;border:3px solid #fff;border-radius:12px;box-shadow:0 0 0 9999px rgba(17,19,24,.44),0 12px 42px rgba(0,0,0,.24);pointer-events:none;transition:left .26s ease,top .26s ease,width .26s ease,height .26s ease;display:none}
    .owSpot:after{content:'';position:absolute;inset:-7px;border:2px solid rgba(255,255,255,.55);border-radius:16px;animation:owPulse 1.4s ease-in-out infinite}
    .owCard{width:min(380px,calc(100vw - 36px));background:#fff;border-radius:18px;padding:20px;box-shadow:0 24px 80px rgba(0,0,0,.30);position:fixed;z-index:4010;max-height:calc(100vh - 36px);overflow:auto;pointer-events:auto;transition:left .22s ease,right .22s ease,top .22s ease,bottom .22s ease}
    .owEyebrow{font-size:11px;font-weight:900;letter-spacing:.11em;color:#737c87}.owCard h2{font-size:24px;line-height:1.12;letter-spacing:-.03em;margin:7px 0 8px;color:#17191d}.owCard>p{font-size:15px;line-height:1.48;color:#59636f;margin:0}
    .owDo{margin-top:12px;border:1px solid #dde2e7;background:#f7f8fa;border-radius:12px;padding:13px 14px}.owDo strong{display:block;font-size:12px;letter-spacing:.06em;text-transform:uppercase;margin-bottom:6px}.owDo ul{margin:0;padding-left:18px}.owDo li{font-size:14px;line-height:1.42;color:#343b44;padding:2px 0}
    .owGuide{margin-top:12px;border:1px solid #dce2e7;border-radius:11px;background:#fff;padding:10px 11px;display:grid;grid-template-columns:1fr auto;gap:10px;align-items:center}.owGuide strong{font-size:11px;letter-spacing:.06em;color:#252a30}.owStatus{display:block;font-size:12px;line-height:1.35;color:#6f7882;margin-top:3px}.owReplay{border:1px solid #d4d9df;background:#fff;border-radius:9px;padding:8px 10px;font-size:12px;font-weight:850;color:#353d45;cursor:pointer;white-space:nowrap}.owReplay:hover{background:#f5f6f7}
    .owStep{margin-top:14px;display:flex;align-items:flex-end;justify-content:space-between;gap:12px}.owDots{display:flex;gap:5px;margin-top:6px}.owDot{width:7px;height:7px;border-radius:99px;background:#d8dde2}.owDot.active{width:20px;background:#111318}.owActions{display:flex;gap:7px;flex-wrap:wrap;justify-content:flex-end}.owBtn{border:1px solid #d4d9df;background:#fff;border-radius:9px;padding:10px 12px;font-size:13px;font-weight:850;cursor:pointer}.owBtn.primary{background:#111318;color:#fff;border-color:#111318}.owSkip{border:0;background:transparent;color:#737c87;padding:3px 0;font-size:12px;font-weight:800;cursor:pointer}
    .owCursor{position:fixed;z-index:4008;width:25px;height:33px;background:#fff;clip-path:polygon(0 0,0 100%,34% 72%,52% 98%,66% 90%,49% 67%,100% 67%);filter:drop-shadow(0 2px 1px rgba(0,0,0,.9)) drop-shadow(0 0 1px #111318);transform-origin:3px 3px;pointer-events:none;transition:left .9s cubic-bezier(.2,.72,.2,1),top .9s cubic-bezier(.2,.72,.2,1),transform .16s ease;display:none}.owCursor.click{transform:scale(.76)}.owCursor.click:after{content:'';position:absolute;width:34px;height:34px;border:3px solid #fff;border-radius:50%;left:-14px;top:-14px;animation:owClick .55s ease-out}
    .owDiligencePreview{position:fixed;z-index:4007;left:max(248px,22px);right:420px;top:50%;transform:translateY(-50%);max-height:86vh;overflow:auto;background:#f7f8fa;border:1px solid #e1e5e9;border-radius:17px;box-shadow:0 28px 90px rgba(0,0,0,.32);pointer-events:none}.owDiligencePreview .odpHead{background:#fff;border-bottom:1px solid #e4e7eb;padding:15px 17px}.owDiligencePreview .odpHead span{font-size:10px;font-weight:900;letter-spacing:.1em;color:#737c87}.owDiligencePreview .odpHead h3{margin:4px 0 3px;font-size:20px}.owDiligencePreview .odpHead p{margin:0;color:#747d88;font-size:12px;line-height:1.4}.owDiligencePreview .odpBody{padding:12px 15px 15px}.owDiligencePreview .odpBadge{display:inline-block;background:#111318;color:#fff;border-radius:7px;padding:5px 7px;font-size:9px;font-weight:900;letter-spacing:.06em;margin-bottom:9px}.owDiligencePreview .odpQuestions{display:grid;grid-template-columns:1fr 1fr;gap:7px}.owDiligencePreview .odpQ{background:#fff;border:1px solid #e2e6ea;border-radius:10px;padding:9px 10px}.owDiligencePreview .odpQ b{display:block;font-size:9px;color:#8a929c;margin-bottom:3px}.owDiligencePreview .odpQ strong{display:block;font-size:11px;line-height:1.35}.owDiligencePreview .odpFakeInput{height:24px;border:1px solid #d8dde2;border-radius:7px;margin-top:6px;background:#fff}
    @keyframes owPulse{0%,100%{opacity:.5}50%{opacity:1}}@keyframes owClick{0%{opacity:1;transform:scale(.35)}100%{opacity:0;transform:scale(1.5)}}
    @media(max-width:1100px){.owDiligencePreview{left:18px;right:410px}.owCard{width:min(360px,calc(100vw - 28px))}}
    @media(max-width:760px){.owCard{left:9px!important;right:9px!important;top:9px!important;bottom:auto!important;width:auto!important;max-height:calc(100vh - 18px);padding:18px;border-radius:15px}.owCard h2{font-size:22px}.owCard>p{font-size:14px}.owDo li{font-size:13px}.owGuide{grid-template-columns:1fr}.owReplay{width:100%}.owStep{align-items:flex-start;flex-direction:column}.owActions{width:100%}.owBtn{flex:1}.owDiligencePreview{display:none}}
    @media(prefers-reduced-motion:reduce){.owSpot:after{animation:none}.owSpot,.owCursor,.owCard{transition:none!important}}
  `;
  document.head.appendChild(style);

  const steps=[
    {
      title:'Portal Navigation',
      copy:'Use these four sections to submit deals and track investor activity.',
      actions:['Overview: your dashboard.','Submit Opportunity: send a deal for investor review.','My Submissions: track submitted deals.','Buyer Thesis: see what our network is currently searching for.'],
      section:'home',
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
      actions:['Check the preferred deal size.','Check the sectors and structures currently in scope.','Compare your deal against the thesis before submitting.'],
      section:'thesis',
      path:[
        {selector:'#thesisMin',status:'Preferred deal size'},
        {selector:'#thesisSectors',status:'Current sector focus'},
        {selector:'#thesisStructures',status:'Structures the network is considering'}
      ]
    },
    {
      title:'Submit an Opportunity',
      copy:'Start here when you have a deal you want matched with investors.',
      actions:['Open Submit Opportunity.','Enter the basic deal information.','Attach the main deal materials.'],
      section:'submit',
      path:[{selector:'#dealTitle',status:'Start with the opportunity name'}]
    },
    {
      title:'Upload the Deal Materials',
      copy:'Upload the one-pager or pitch deck so the portal can read the deal first.',
      actions:['Click Choose files.','Select the main deck or one-pager.','Wait for the portal to fill what it can.'],
      section:'submit',
      path:[{selector:'#chooseFiles',fallback:'#fileDrop',status:'Choose the main deal document',click:true}]
    },
    {
      title:'Review the Deal Details',
      copy:'Check the information pulled from the document before continuing.',
      actions:['Verify the project and sponsor.','Verify the capital ask, sector, geography, and structure.','Correct anything missing or wrong.'],
      section:'submit',
      path:[{selector:'#dealAmount',status:'Verify the capital ask before continuing'}]
    },
    {
      title:'Complete Diligence',
      copy:'Once the deal details are correct, continue to diligence.',
      actions:['Click Continue to Diligence.','Answer all 12 questions or mark one Not Applicable.','Submit when diligence is complete.'],
      section:'submit',diligence:true,
      path:[{selector:'#submitDeal',status:'Click Continue to Diligence',click:true}]
    },
    {
      title:'Track Your Submissions',
      copy:'Use My Submissions to follow a deal after it is sent for investor review.',
      actions:['Open My Submissions.','Check the current status and match score.','Complete any requested action from here.'],
      section:'submissions',
      path:[{selector:'.submissionCard',fallback:'#submissionsSection .panelHead',status:'Submitted deals and their status appear here'}]
    }
  ];

  const diligenceQuestions=[
    'What is the total project or transaction size?',
    'What is the exact capital ask?',
    'Is the ask equity, debt, mezzanine financing, or a combination?',
    'Can you provide a basic sources-and-uses breakdown?',
    'Are you directly connected with the management or sponsor team?',
    'Is there a signed exclusive mandate directly with the sponsor or management?',
    'How long has the opportunity been marketed?',
    'How many other firms are currently representing or circulating it?',
    'Which investors, banks, family offices, or institutions have already seen it?',
    'Is there already a lead investor, term sheet, or committed capital?',
    'What is the sponsor or management team’s relevant track record?',
    'How much capital is the sponsor contributing?'
  ];

  function storageKey(){
    let id='originator';
    try{if(typeof currentUser!=='undefined'&&currentUser?.id)id=currentUser.id;else id=document.getElementById('accountEmail')?.textContent?.trim()||id}catch{}
    return `outerhaven_originator_walkthrough_${VERSION}_${id}`;
  }
  function seen(){try{return localStorage.getItem(storageKey())==='1'}catch{return false}}
  function markSeen(){try{localStorage.setItem(storageKey(),'1')}catch{}}
  function delay(ms){return new Promise(resolve=>setTimeout(resolve,ms))}

  function installHelp(){
    if(document.getElementById('owHelp'))return;
    const b=document.createElement('button');b.id='owHelp';b.className='owHelp';b.type='button';b.textContent='Tutorial';b.setAttribute('aria-label','Replay portal tutorial');b.onclick=start;document.body.appendChild(b);
  }

  function ensureSection(name){try{if(name&&typeof showSection==='function')showSection(name)}catch{}}
  function elementFor(item){
    let el=null;
    try{if(item?.selector)el=document.querySelector(item.selector)}catch{}
    if(!el&&item?.fallback){try{el=document.querySelector(item.fallback)}catch{}}
    return el;
  }
  function inView(el){const r=el.getBoundingClientRect();return r.top>=45&&r.bottom<=window.innerHeight-45&&r.left>=0&&r.right<=window.innerWidth}

  function ensureCursor(){if(!cursor){cursor=document.createElement('div');cursor.className='owCursor';document.body.appendChild(cursor)}}
  function setStatus(text){const s=card?.querySelector('.owStatus');if(s)s.textContent=text||''}

  function positionCardFor(rect){
    if(!card||window.innerWidth<=760)return;
    const vw=window.innerWidth,vh=window.innerHeight,gap=18;
    card.style.left='auto';card.style.right='auto';card.style.top='18px';card.style.bottom='auto';
    const cw=card.offsetWidth||380,ch=Math.min(card.offsetHeight||500,vh-36);
    const center=rect.left+rect.width/2;
    const leftRoom=rect.left-gap;
    const rightRoom=vw-rect.right-gap;
    if(leftRoom>=cw+10&&center>vw*.42){card.style.left='18px';return}
    if(rightRoom>=cw+10){card.style.right='18px';return}
    if(center>vw/2){card.style.left='18px';return}
    card.style.right='18px';
  }

  function positionSpot(el){
    if(!spot||!el)return;
    const r=el.getBoundingClientRect();
    const pad=8;
    spot.style.display='block';
    spot.style.left=`${Math.max(3,r.left-pad)}px`;
    spot.style.top=`${Math.max(3,r.top-pad)}px`;
    spot.style.width=`${Math.min(window.innerWidth-6,r.width+pad*2)}px`;
    spot.style.height=`${Math.min(window.innerHeight-6,r.height+pad*2)}px`;
    positionCardFor(r);
  }

  function primeCursor(){
    ensureCursor();
    const r=card?.getBoundingClientRect();if(!r)return;
    cursor.style.display='block';
    const cardOnLeft=r.left<window.innerWidth/2;
    cursor.style.left=`${Math.round(cardOnLeft?r.right+12:r.left-30)}px`;
    cursor.style.top=`${Math.round(Math.min(window.innerHeight-45,r.top+82))}px`;
  }

  function moveCursor(el){
    ensureCursor();
    const r=el.getBoundingClientRect();
    const x=Math.max(12,Math.min(window.innerWidth-36,r.left+r.width/2));
    const y=Math.max(12,Math.min(window.innerHeight-42,r.top+r.height/2));
    cursor.style.display='block';
    cursor.style.left=`${Math.round(x)}px`;cursor.style.top=`${Math.round(y)}px`;
  }

  async function focusItem(item,token){
    const el=elementFor(item);if(!el||token!==runToken)return false;
    currentTarget=el;
    if(!inView(el)){
      spot.style.display='none';
      try{el.scrollIntoView({behavior:'smooth',block:'center',inline:'nearest'})}catch{}
      await delay(700);if(token!==runToken)return false;
    }
    positionSpot(el);primeCursor();setStatus(item.status||'Look here');
    await delay(220);if(token!==runToken)return false;
    moveCursor(el);
    await delay(980);if(token!==runToken)return false;
    if(item.click){cursor.classList.add('click');await delay(380);cursor.classList.remove('click')}
    return true;
  }

  function clearPreview(){diligencePreview?.remove();diligencePreview=null}
  function showDiligencePreview(){
    spot.style.display='none';currentTarget=null;
    diligencePreview=document.createElement('div');diligencePreview.className='owDiligencePreview';
    diligencePreview.innerHTML=`<div class="odpHead"><span>ORIGINATOR DILIGENCE</span><h3>What opens after Continue to Diligence</h3><p>These are the 12 questions the originator completes before the deal is sent for investor review.</p></div><div class="odpBody"><div class="odpBadge">12 DILIGENCE QUESTIONS</div><div class="odpQuestions">${diligenceQuestions.map((q,i)=>`<div class="odpQ"><b>QUESTION ${i+1}</b><strong>${q}</strong><div class="odpFakeInput"></div></div>`).join('')}</div></div>`;
    document.body.appendChild(diligencePreview);setStatus('These 12 diligence questions open next');
    if(card&&window.innerWidth>760){card.style.left='auto';card.style.right='18px';card.style.top='18px'}
  }

  async function playDemo(){
    const token=++runToken;clearPreview();
    if(!card||!spot)return;
    const step=steps[stepIndex];
    for(let i=0;i<step.path.length;i++){
      if(token!==runToken)return;
      const ok=await focusItem(step.path[i],token);if(!ok)return;
      await delay(i===step.path.length-1?1450:2100);
    }
    if(step.diligence&&token===runToken){showDiligencePreview()}
  }

  function render(){
    ++runToken;clearPreview();currentTarget=null;
    if(cursor){cursor.remove();cursor=null}
    const step=steps[stepIndex];ensureSection(step.section);
    root.innerHTML='<div class="owSpot"></div><div class="owCard"></div>';
    spot=root.querySelector('.owSpot');card=root.querySelector('.owCard');
    card.innerHTML=`<div class="owEyebrow">ORIGINATOR PORTAL TUTORIAL · ${stepIndex+1} OF ${steps.length}</div><h2>${step.title}</h2><p>${step.copy}</p><div class="owDo"><strong>What to do</strong><ul>${step.actions.map(x=>`<li>${x}</li>`).join('')}</ul></div><div class="owGuide"><div><strong>ON-SCREEN GUIDE</strong><span class="owStatus">Watch the cursor move to the highlighted item.</span></div><button type="button" class="owReplay">Replay</button></div><div class="owStep"><div><button type="button" class="owSkip">Skip tutorial</button><div class="owDots">${steps.map((_,i)=>`<span class="owDot ${i===stepIndex?'active':''}"></span>`).join('')}</div></div><div class="owActions">${stepIndex?'<button type="button" class="owBtn owBack">Back</button>':''}<button type="button" class="owBtn primary owNext">${stepIndex===steps.length-1?'Finish':'Next'}</button></div></div>`;
    card.querySelector('.owSkip').onclick=finish;
    card.querySelector('.owBack')?.addEventListener('click',()=>{stepIndex--;render()});
    card.querySelector('.owNext').onclick=()=>{if(stepIndex===steps.length-1)finish();else{stepIndex++;render()}};
    card.querySelector('.owReplay').onclick=playDemo;
    card.style.right='18px';card.style.top='18px';
    setTimeout(playDemo,420);
  }

  function start(){
    if(root)return;stepIndex=0;root=document.createElement('div');root.className='owRoot';document.body.appendChild(root);render();
  }
  function finish(){
    ++runToken;markSeen();clearPreview();cursor?.remove();cursor=null;root?.remove();root=null;card=null;spot=null;currentTarget=null;try{if(typeof showSection==='function')showSection('home')}catch{}
  }

  window.addEventListener('resize',()=>{if(root&&currentTarget)positionSpot(currentTarget)});
  window.addEventListener('keydown',ev=>{if(ev.key==='Escape'&&root)finish()});

  function boot(){const app=document.getElementById('app');if(!app||app.classList.contains('hidden'))return false;installHelp();if(!seen())setTimeout(start,650);return true}
  if(!boot()){const timer=setInterval(()=>{if(boot())clearInterval(timer)},200);setTimeout(()=>clearInterval(timer),15000)}
})();