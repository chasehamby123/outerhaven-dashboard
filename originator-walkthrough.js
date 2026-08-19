(function(){
  if(window.__outerhavenOriginatorWalkthrough)return;
  window.__outerhavenOriginatorWalkthrough=true;

  const VERSION='v11-overview-first';
  let stepIndex=0;
  let rail=null;
  let card=null;
  let outline=null;
  let cursor=null;
  let diligencePreview=null;
  let runToken=0;
  let currentTarget=null;
  let scrollFrame=null;

  const style=document.createElement('style');
  style.textContent=`
    .owHelp{position:fixed;right:18px;bottom:18px;z-index:2600;border:1px solid #d7dce1;border-radius:999px;background:#fff;color:#111318;display:flex;align-items:center;gap:9px;padding:12px 16px;font-size:14px;font-weight:850;cursor:pointer;box-shadow:0 10px 30px rgba(17,19,24,.13)}
    .owHelp:before{content:'?';width:23px;height:23px;border-radius:50%;background:#111318;color:#fff;display:grid;place-items:center;font-size:13px;font-weight:900}
    body.owTutorialOpen{overflow-x:hidden}
    body.owTutorialOpen .app{width:calc(100vw - 400px);transition:width .18s ease}
    .owRail{position:fixed;right:0;top:0;bottom:0;width:400px;z-index:5000;background:#f8f9fa;border-left:1px solid #dfe3e7;box-shadow:-16px 0 40px rgba(17,19,24,.08);padding:18px;overflow:auto}
    .owCard{background:#fff;border:1px solid #e0e4e8;border-radius:18px;padding:20px;box-shadow:0 16px 42px rgba(17,19,24,.08)}
    .owEyebrow{font-size:11px;font-weight:900;letter-spacing:.11em;color:#737c87}.owCard h2{font-size:24px;line-height:1.12;letter-spacing:-.03em;margin:7px 0 8px;color:#17191d}.owCard>p{font-size:15px;line-height:1.48;color:#59636f;margin:0}
    .owDo{margin-top:12px;border:1px solid #dde2e7;background:#f7f8fa;border-radius:12px;padding:13px 14px}.owDo strong{display:block;font-size:12px;letter-spacing:.06em;text-transform:uppercase;margin-bottom:6px}.owDo ul{margin:0;padding-left:18px}.owDo li{font-size:14px;line-height:1.42;color:#343b44;padding:2px 0}
    .owGuide{margin-top:12px;border:1px solid #dce2e7;border-radius:11px;background:#fff;padding:10px 11px;display:grid;grid-template-columns:1fr auto;gap:10px;align-items:center}.owGuide strong{font-size:11px;letter-spacing:.06em;color:#252a30}.owStatus{display:block;font-size:12px;line-height:1.35;color:#6f7882;margin-top:3px}.owReplay{border:1px solid #d4d9df;background:#fff;border-radius:9px;padding:8px 10px;font-size:12px;font-weight:850;color:#353d45;cursor:pointer;white-space:nowrap}
    .owStep{margin-top:14px;display:flex;align-items:flex-end;justify-content:space-between;gap:12px}.owDots{display:flex;gap:5px;margin-top:6px}.owDot{width:7px;height:7px;border-radius:99px;background:#d8dde2}.owDot.active{width:20px;background:#111318}.owActions{display:flex;gap:7px;flex-wrap:wrap;justify-content:flex-end}.owBtn{border:1px solid #d4d9df;background:#fff;border-radius:9px;padding:10px 12px;font-size:13px;font-weight:850;cursor:pointer}.owBtn.primary{background:#111318;color:#fff;border-color:#111318}.owSkip{border:0;background:transparent;color:#737c87;padding:3px 0;font-size:12px;font-weight:800;cursor:pointer}
    .owOutline{position:fixed;z-index:4995;border:3px solid #111318;border-radius:10px;box-shadow:0 0 0 4px rgba(255,255,255,.96),0 9px 28px rgba(17,19,24,.16);pointer-events:none;display:none;transition:left .14s ease,top .14s ease,width .14s ease,height .14s ease}
    .owCursor{position:fixed;z-index:5010;width:28px;height:37px;background:#111318;clip-path:polygon(0 0,0 100%,35% 72%,54% 99%,68% 90%,50% 67%,100% 67%);filter:drop-shadow(2px 0 0 #fff) drop-shadow(-2px 0 0 #fff) drop-shadow(0 2px 0 #fff) drop-shadow(0 -2px 0 #fff) drop-shadow(0 2px 4px rgba(0,0,0,.28));pointer-events:none;display:none;transition:left .42s cubic-bezier(.2,.72,.2,1),top .42s cubic-bezier(.2,.72,.2,1),transform .12s ease}
    .owCursor.click{transform:scale(.74)}.owCursor.click:after{content:'';position:absolute;width:36px;height:36px;border:3px solid #fff;border-radius:50%;left:-15px;top:-15px;box-shadow:0 0 0 2px #111318;animation:owClick .36s ease-out}
    .owDiligencePreview{position:fixed;z-index:4998;left:18px;right:418px;top:18px;bottom:18px;overflow:auto;background:#f7f8fa;border:1px solid #dde2e7;border-radius:16px;box-shadow:0 22px 70px rgba(17,19,24,.18)}
    .owDiligencePreview .odpHead{position:sticky;top:0;background:#fff;border-bottom:1px solid #e4e7eb;padding:16px 18px;z-index:2}.owDiligencePreview .odpHead span{font-size:10px;font-weight:900;letter-spacing:.1em;color:#737c87}.owDiligencePreview .odpHead h3{margin:4px 0 4px;font-size:21px}.owDiligencePreview .odpHead p{margin:0;color:#747d88;font-size:12px;line-height:1.45}.owDiligencePreview .odpBody{padding:14px 18px 18px}.owDiligencePreview .odpBadge{display:inline-block;background:#111318;color:#fff;border-radius:7px;padding:5px 7px;font-size:9px;font-weight:900;letter-spacing:.06em;margin-bottom:9px}.owDiligencePreview .odpQuestions{display:grid;grid-template-columns:1fr 1fr;gap:8px}.owDiligencePreview .odpQ{background:#fff;border:1px solid #e2e6ea;border-radius:11px;padding:10px}.owDiligencePreview .odpQ b{display:block;font-size:9px;color:#8a929c;margin-bottom:3px}.owDiligencePreview .odpQ strong{display:block;font-size:11px;line-height:1.38}.owDiligencePreview .odpFakeInput{height:27px;border:1px solid #d8dde2;border-radius:7px;margin-top:7px;background:#fff}
    @keyframes owClick{0%{opacity:1;transform:scale(.35)}100%{opacity:0;transform:scale(1.55)}}
    @media(max-width:1250px) and (min-width:901px){body.owTutorialOpen .app{width:calc(100vw - 340px)}.owRail{width:340px;padding:14px}.owCard{padding:17px}.owCard h2{font-size:22px}.owDiligencePreview{right:358px}}
    @media(max-width:900px){body.owTutorialOpen .app{width:100%}.owRail{left:8px;right:8px;top:auto;bottom:8px;width:auto;height:auto;max-height:52vh;border:1px solid #dfe3e7;border-radius:16px;padding:10px}.owCard{padding:14px}.owDiligencePreview{left:8px;right:8px;top:8px;bottom:54vh}.owDiligencePreview .odpQuestions{grid-template-columns:1fr}.owGuide{grid-template-columns:1fr}.owReplay{width:100%}.owStep{align-items:flex-start;flex-direction:column}.owActions{width:100%}.owBtn{flex:1}}
    @media(prefers-reduced-motion:reduce){.owCursor,.owOutline,body.owTutorialOpen .app{transition:none!important}}
  `;
  document.head.appendChild(style);

  const steps=[
    {
      title:'How the Portal Works',
      copy:'The portal follows one simple deal flow: understand what investors are looking for, submit the opportunity, complete diligence, then track investor activity.',
      actions:[
        'Overview gives you the current picture of your submissions and activity.',
        'Submit Opportunity is where you send a deal and its materials.',
        'My Submissions is where you track whether the deal is matching, receiving interest, or needs action.',
        'Buyer Thesis shows what our investor network is currently searching for.'
      ],
      section:'home',
      path:[
        {selector:'.navBtn[data-section="home"]',status:'1. Overview: your current submission activity'},
        {selector:'.navBtn[data-section="submit"]',status:'2. Submit Opportunity: send the deal and materials'},
        {selector:'.navBtn[data-section="submissions"]',status:'3. My Submissions: track progress and required actions'},
        {selector:'.navBtn[data-section="thesis"]',status:'4. Buyer Thesis: see what the investor network is searching for'}
      ]
    },
    {
      title:'Understand the Buyer Thesis',
      copy:'The Buyer Thesis tells you what our network is actively positioned to review. Use it to decide whether a deal belongs in the portal and how to present it.',
      actions:[
        '$50M+ is the preferred transaction scale. Scale is one of the first filters.',
        'Sector agnostic and global means industry and geography are broad. Do not reject a strong deal just because of its sector or country.',
        'The network can consider equity, debt, structured capital, acquisition capital, joint ventures, strategic investment, and full or partial acquisitions.',
        'The real gate is investability: credible sponsor or management, a defined capital or transaction need, a clear institutional case, and enough material for diligence.'
      ],
      section:'thesis',
      path:[
        {selector:'#thesisMin',status:'Preferred scale: $50M+ is one of the first filters'},
        {selector:'#thesisSectors .tag',fallback:'#thesisSectors',status:'Sector agnostic: sector itself is not the main filter'},
        {selector:'#thesisGeographies .tag',fallback:'#thesisGeographies',status:'Global: geography is intentionally broad'},
        {selector:'#thesisStructures',status:'These are the transaction structures the network can consider'},
        {selector:'#thesisRequirements',status:'This is the real gate: credible sponsor, defined need, institutional case, diligence-ready materials'}
      ]
    },
    {
      title:'Upload the Main Deal Material First',
      copy:'Use the current one-pager or pitch deck first. The portal reads it and uses it to help build the submission.',
      actions:[
        'Upload the best current deck or one-pager.',
        'Let the portal read the document before correcting the fields.',
        'Add supporting documents only if they help investors understand or diligence the deal.'
      ],
      section:'submit',
      path:[{selector:'#chooseFiles',fallback:'#fileDrop',status:'Upload the main deal document here',click:true}]
    },
    {
      title:'Verify the Deal Terms That Matter',
      copy:'Document extraction saves time, but these fields must be accurate before the deal moves forward.',
      actions:[
        'Capital ask: enter the amount actually being raised or transacted.',
        'Transaction type: select the real structure, not the structure you hope investors prefer.',
        'Summary: explain the opportunity, why capital is needed, and what an investor should understand immediately.'
      ],
      section:'submit',
      path:[
        {selector:'#dealAmount',status:'Verify the exact capital ask'},
        {selector:'#dealType',status:'Verify the actual transaction structure'},
        {selector:'#dealSummary',status:'Make the investment case clear in the summary'}
      ]
    },
    {
      title:'Use the Match Score as a Screen',
      copy:'The match score measures alignment with the current buyer thesis. It is not investor interest, approval, or a commitment to fund the deal.',
      actions:[
        'Use the checklist to see what is missing or below thesis.',
        'Fix missing transaction details and supporting materials before continuing.',
        'A strong score still has to pass diligence and investor review.'
      ],
      section:'submit',
      path:[
        {selector:'#estimateRing',status:'This is thesis alignment, not investor interest'},
        {selector:'#fitChecklist',status:'Use this checklist to fix missing or weak information'}
      ]
    },
    {
      title:'Diligence Protects the Investor Outreach',
      copy:'These questions determine whether the deal is ready to be put in front of investors and help prevent duplicate or poorly controlled outreach.',
      actions:[
        'Be precise about your relationship with the sponsor and whether you have a mandate.',
        'Disclose who has already seen the deal and any lead investor, term sheet, or committed capital.',
        'Give accurate information on structure, sources and uses, sponsor track record, and sponsor contribution.'
      ],
      section:'submit',diligence:true,
      path:[{selector:'#submitDeal',status:'Continue here only after the basic deal information is correct',click:true}]
    },
    {
      title:'Track Real Progress in My Submissions',
      copy:'After submission, the status tells you where the deal actually is. The match score only tells you how closely it fits the thesis.',
      actions:[
        'Matching means the opportunity is being worked against the buyer network.',
        'Buyer Interest or Engagement Active means the deal has moved beyond thesis fit.',
        'If the portal shows Diligence Required, finish the existing submission instead of creating a duplicate.'
      ],
      section:'submissions',
      path:[
        {selector:'.submissionCard .status',fallback:'.submissionCard',status:'Status tells you the real stage of the deal'},
        {selector:'.submissionCard .matchPct',fallback:'.submissionCard',status:'Match score is thesis fit, not proof of investor interest'},
        {selector:'.ddResume',fallback:'.submissionCard',status:'If diligence is required, resume this deal instead of resubmitting it'}
      ]
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
  function ensureSection(name){try{if(name&&typeof showSection==='function')showSection(name)}catch{}}
  function elementFor(item){
    let el=null;
    try{if(item?.selector)el=document.querySelector(item.selector)}catch{}
    if(!el&&item?.fallback){try{el=document.querySelector(item.fallback)}catch{}}
    return el;
  }
  function setStatus(text){const s=card?.querySelector('.owStatus');if(s)s.textContent=text||''}
  function inView(el){
    const r=el.getBoundingClientRect();
    const railWidth=window.innerWidth>900?(window.innerWidth<=1250?340:400):0;
    return r.top>=24&&r.bottom<=window.innerHeight-24&&r.left>=0&&r.right<=window.innerWidth-railWidth-12;
  }

  function installHelp(){
    if(document.getElementById('owHelp'))return;
    const b=document.createElement('button');b.id='owHelp';b.className='owHelp';b.type='button';b.textContent='Tutorial';b.setAttribute('aria-label','Replay portal tutorial');b.onclick=start;document.body.appendChild(b);
  }

  function ensureOutline(){if(!outline){outline=document.createElement('div');outline.className='owOutline';document.body.appendChild(outline)}}
  function ensureCursor(){if(!cursor){cursor=document.createElement('div');cursor.className='owCursor';document.body.appendChild(cursor)}}
  function hideGuides(){if(outline)outline.style.display='none';if(cursor)cursor.style.display='none';currentTarget=null}

  function outlineTarget(el){
    ensureOutline();
    const r=el.getBoundingClientRect(),pad=5;
    outline.style.display='block';
    outline.style.left=`${Math.max(2,r.left-pad)}px`;
    outline.style.top=`${Math.max(2,r.top-pad)}px`;
    outline.style.width=`${Math.max(18,r.width+pad*2)}px`;
    outline.style.height=`${Math.max(18,r.height+pad*2)}px`;
  }

  function primeCursor(){
    ensureCursor();
    const rr=rail?.getBoundingClientRect();
    cursor.style.display='block';
    if(window.innerWidth>900){
      cursor.style.left=`${Math.max(10,(rr?.left||window.innerWidth)-36)}px`;
      cursor.style.top=`${Math.round(Math.min(window.innerHeight-46,(rr?.top||0)+118))}px`;
    }else{
      cursor.style.left=`${Math.round(window.innerWidth/2)}px`;
      cursor.style.top=`${Math.max(10,(rr?.top||window.innerHeight)-44)}px`;
    }
  }

  function moveCursor(el){
    ensureCursor();
    const r=el.getBoundingClientRect();
    cursor.style.display='block';
    cursor.style.left=`${Math.round(Math.max(8,Math.min(window.innerWidth-34,r.left+r.width/2-3)))}px`;
    cursor.style.top=`${Math.round(Math.max(8,Math.min(window.innerHeight-42,r.top+r.height/2-3)))}px`;
  }

  function syncGuides(){
    if(!currentTarget||!rail)return;
    outlineTarget(currentTarget);
    moveCursor(currentTarget);
  }

  function scheduleGuideSync(){
    if(scrollFrame)return;
    scrollFrame=requestAnimationFrame(()=>{
      scrollFrame=null;
      syncGuides();
    });
  }

  async function focusItem(item,token,isFirst){
    const el=elementFor(item);if(!el||token!==runToken)return false;
    currentTarget=el;
    outlineTarget(el);
    if(isFirst){primeCursor();await delay(90);if(token!==runToken)return false}
    moveCursor(el);

    if(!inView(el)){
      try{el.scrollIntoView({behavior:'smooth',block:'center',inline:'nearest'})}catch{}
      await delay(340);
      if(token!==runToken)return false;
      syncGuides();
    }

    setStatus(item.status||'Look here');
    await delay(520);
    if(token!==runToken)return false;
    if(item.click){
      cursor.classList.add('click');
      await delay(220);
      cursor.classList.remove('click');
    }
    return true;
  }

  function clearPreview(){diligencePreview?.remove();diligencePreview=null}
  function showDiligencePreview(){
    hideGuides();clearPreview();
    diligencePreview=document.createElement('div');
    diligencePreview.className='owDiligencePreview';
    diligencePreview.innerHTML=`<div class="odpHead"><span>ORIGINATOR DILIGENCE</span><h3>What diligence is checking</h3><p>These 12 questions verify the deal before it is eligible to move into investor outreach.</p></div><div class="odpBody"><div class="odpBadge">12 DILIGENCE QUESTIONS</div><div class="odpQuestions">${diligenceQuestions.map((q,i)=>`<div class="odpQ"><b>QUESTION ${i+1}</b><strong>${q}</strong><div class="odpFakeInput"></div></div>`).join('')}</div></div>`;
    document.body.appendChild(diligencePreview);
    setStatus('These are the questions that determine whether the deal is outreach-ready');
  }

  async function playDemo(){
    const token=++runToken;clearPreview();hideGuides();
    const step=steps[stepIndex];
    for(let i=0;i<step.path.length;i++){
      if(token!==runToken)return;
      const ok=await focusItem(step.path[i],token,i===0);if(!ok)return;
      await delay(i===step.path.length-1?520:650);
    }
    if(step.diligence&&token===runToken)showDiligencePreview();
  }

  function render(){
    ++runToken;clearPreview();hideGuides();
    const step=steps[stepIndex];ensureSection(step.section);
    card.innerHTML=`<div class="owEyebrow">ORIGINATOR PORTAL GUIDE · ${stepIndex+1} OF ${steps.length}</div><h2>${step.title}</h2><p>${step.copy}</p><div class="owDo"><strong>What matters</strong><ul>${step.actions.map(x=>`<li>${x}</li>`).join('')}</ul></div><div class="owGuide"><div><strong>ON-SCREEN GUIDE</strong><span class="owStatus">Watch the cursor move to the important item.</span></div><button type="button" class="owReplay">Replay</button></div><div class="owStep"><div><button type="button" class="owSkip">Skip guide</button><div class="owDots">${steps.map((_,i)=>`<span class="owDot ${i===stepIndex?'active':''}"></span>`).join('')}</div></div><div class="owActions">${stepIndex?'<button type="button" class="owBtn owBack">Back</button>':''}<button type="button" class="owBtn primary owNext">${stepIndex===steps.length-1?'Finish':'Next'}</button></div></div>`;
    card.querySelector('.owSkip').onclick=finish;
    card.querySelector('.owBack')?.addEventListener('click',()=>{stepIndex--;render()});
    card.querySelector('.owNext').onclick=()=>{if(stepIndex===steps.length-1)finish();else{stepIndex++;render()}};
    card.querySelector('.owReplay').onclick=playDemo;
    setTimeout(playDemo,260);
  }

  function start(){
    if(rail)return;
    document.body.classList.add('owTutorialOpen');
    stepIndex=0;
    rail=document.createElement('aside');rail.className='owRail';
    card=document.createElement('div');card.className='owCard';rail.appendChild(card);
    document.body.appendChild(rail);
    render();
  }

  function finish(){
    ++runToken;markSeen();clearPreview();
    if(scrollFrame){cancelAnimationFrame(scrollFrame);scrollFrame=null}
    outline?.remove();outline=null;cursor?.remove();cursor=null;rail?.remove();rail=null;card=null;currentTarget=null;document.body.classList.remove('owTutorialOpen');
    try{if(typeof showSection==='function')showSection('home')}catch{}
  }

  window.addEventListener('scroll',scheduleGuideSync,{passive:true,capture:true});
  window.addEventListener('resize',scheduleGuideSync);
  window.addEventListener('keydown',ev=>{if(ev.key==='Escape'&&rail)finish()});

  function boot(){
    const app=document.getElementById('app');if(!app||app.classList.contains('hidden'))return false;
    installHelp();if(!seen())setTimeout(start,650);return true;
  }
  if(!boot()){const timer=setInterval(()=>{if(boot())clearInterval(timer)},200);setTimeout(()=>clearInterval(timer),15000)}
})();