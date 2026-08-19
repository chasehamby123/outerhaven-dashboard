(function(){
  if(window.__outerhavenOriginatorWalkthrough)return;
  window.__outerhavenOriginatorWalkthrough=true;

  const VERSION='v3-live-screen';
  let stepIndex=0;
  let overlay=null;
  let currentTarget=null;
  let positionTimer=null;
  let demoTimers=[];
  let liveCursor=null;
  let liveLabel=null;

  const style=document.createElement('style');
  style.textContent=`
    .owHelp{position:fixed;right:18px;bottom:18px;z-index:2600;border:1px solid #d7dce1;border-radius:999px;background:#fff;color:#111318;display:flex;align-items:center;gap:9px;padding:12px 16px;font-size:14px;font-weight:850;cursor:pointer;box-shadow:0 10px 30px rgba(17,19,24,.13)}
    .owHelp:before{content:'?';width:23px;height:23px;border-radius:50%;background:#111318;color:#fff;display:grid;place-items:center;font-size:13px;font-weight:900}.owHelp:hover{background:#f6f7f8}
    .owOverlay{position:fixed;inset:0;z-index:4000;background:rgba(17,19,24,.58)}
    .owCard{width:min(500px,calc(100vw - 30px));max-height:calc(100vh - 28px);overflow:auto;background:#fff;border-radius:20px;padding:24px;box-shadow:0 28px 90px rgba(0,0,0,.30);position:fixed;z-index:4010;left:50%;top:50%;transform:translate(-50%,-50%);transition:left .24s ease,top .24s ease,transform .24s ease}
    .owEyebrow{font-size:12px;font-weight:900;letter-spacing:.11em;color:#737c87}.owCard h2{font-size:26px;line-height:1.13;letter-spacing:-.03em;margin:7px 0 10px;color:#17191d}.owCard>p{font-size:16px;line-height:1.62;color:#59636f;margin:0}
    .owDo{margin-top:15px;border:1px solid #dde2e7;background:#f7f8fa;border-radius:13px;padding:15px 16px}.owDo strong{display:block;font-size:13px;letter-spacing:.06em;text-transform:uppercase;margin-bottom:8px}.owDo ol{margin:0;padding-left:21px}.owDo li{font-size:15px;line-height:1.55;color:#343b44;padding:3px 0}
    .owLiveBar{margin-top:14px;border:1px solid #dce2e7;border-radius:12px;background:#fff;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:11px 12px}.owLiveBar strong{font-size:12px;letter-spacing:.06em;color:#252a30}.owLiveBar span{display:block;font-size:12px;line-height:1.4;color:#6f7882;margin-top:2px}.owReplay{border:1px solid #d4d9df;background:#fff;border-radius:9px;padding:8px 10px;font-size:12px;font-weight:850;color:#353d45;cursor:pointer;white-space:nowrap}.owReplay:hover{background:#f5f6f7}
    .owHint{margin-top:12px;padding:12px 13px;border-radius:11px;background:#fff8e8;border:1px solid #f0dfaf;font-size:14px;line-height:1.5;color:#6d5718}
    .owStep{margin-top:17px;display:flex;align-items:flex-end;justify-content:space-between;gap:14px}.owDots{display:flex;gap:6px;margin-top:7px}.owDot{width:7px;height:7px;border-radius:99px;background:#d8dde2}.owDot.active{width:22px;background:#111318}.owActions{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}.owBtn{border:1px solid #d4d9df;background:#fff;border-radius:10px;padding:11px 14px;font-size:14px;font-weight:850;cursor:pointer}.owBtn.primary{background:#111318;color:#fff;border-color:#111318}.owSkip{border:0;background:transparent;color:#737c87;padding:4px 0;font-size:13px;font-weight:800;cursor:pointer}
    .owTarget{position:relative!important;z-index:4005!important;outline:4px solid #fff!important;box-shadow:0 0 0 8px rgba(255,255,255,.25),0 16px 48px rgba(0,0,0,.30)!important;border-radius:11px!important;pointer-events:none!important;transition:box-shadow .2s ease,outline .2s ease}
    .owTarget:after{content:'';position:absolute;inset:-8px;border:2px solid rgba(255,255,255,.72);border-radius:14px;pointer-events:none;animation:owTargetPulse 1.25s ease-in-out infinite}
    .owLiveCursor{position:fixed;z-index:4008;width:26px;height:34px;background:#fff;clip-path:polygon(0 0,0 100%,34% 72%,52% 98%,66% 90%,49% 67%,100% 67%);filter:drop-shadow(0 2px 1px rgba(0,0,0,.9)) drop-shadow(0 0 1px #111318);transform-origin:3px 3px;pointer-events:none;transition:left .72s cubic-bezier(.2,.72,.2,1),top .72s cubic-bezier(.2,.72,.2,1),transform .16s ease;left:50vw;top:50vh}
    .owLiveCursor.click{transform:scale(.78)}
    .owLiveCursor.click:after{content:'';position:absolute;width:34px;height:34px;border:3px solid #fff;border-radius:50%;left:-14px;top:-14px;animation:owClickRing .55s ease-out}
    .owLiveLabel{position:fixed;z-index:4009;max-width:290px;background:#111318;color:#fff;border:1px solid rgba(255,255,255,.18);border-radius:9px;padding:8px 10px;font-size:13px;font-weight:850;line-height:1.35;box-shadow:0 8px 26px rgba(0,0,0,.28);pointer-events:none;opacity:0;transition:left .72s cubic-bezier(.2,.72,.2,1),top .72s cubic-bezier(.2,.72,.2,1),opacity .2s ease}
    @keyframes owTargetPulse{0%,100%{opacity:.55;transform:scale(1)}50%{opacity:1;transform:scale(1.012)}}
    @keyframes owClickRing{0%{opacity:1;transform:scale(.35)}100%{opacity:0;transform:scale(1.5)}}
    @media(max-width:760px){.owHelp{right:12px;bottom:12px;padding:10px 13px;font-size:13px}.owCard{width:calc(100vw - 18px);padding:19px;border-radius:16px}.owCard h2{font-size:23px}.owCard>p{font-size:15px}.owDo li{font-size:14px}.owLiveBar{align-items:flex-start;flex-direction:column}.owReplay{width:100%}.owActions{width:100%}.owStep{align-items:flex-start;flex-direction:column}.owBtn{flex:1}.owTarget{z-index:4005!important}.owLiveLabel{max-width:min(260px,calc(100vw - 24px));font-size:12px}}
    @media(prefers-reduced-motion:reduce){.owTarget:after{animation:none}.owLiveCursor,.owLiveLabel,.owCard{transition:none!important}}
  `;
  document.head.appendChild(style);

  const steps=[
    {
      title:'Start here: the portal only has four main areas',
      copy:'You do not need to learn everything at once. Watch the cursor move across the real menu on your screen. These four buttons are the entire portal.',
      actions:[
        'Overview is your starting page.',
        'Submit Opportunity is where you send a deal to Outerhaven.',
        'My Submissions is where you track deals you already sent.',
        'Buyer Thesis shows what our capital network is currently looking for.'
      ],
      hint:'If you ever get lost, click the Tutorial button in the bottom-right corner and this walkthrough will start again.',
      section:'home',
      target:'.navBtn[data-section="home"]',
      path:[
        {selector:'.navBtn[data-section="home"]',label:'Overview: start here'},
        {selector:'.navBtn[data-section="submit"]',label:'Submit Opportunity: send us a deal',click:true},
        {selector:'.navBtn[data-section="submissions"]',label:'My Submissions: track what you sent',click:true},
        {selector:'.navBtn[data-section="thesis"]',label:'Buyer Thesis: see what fits our network',click:true}
      ]
    },
    {
      title:'1. Check the Buyer Thesis before sending a deal',
      copy:'This lesson is now showing you the real Buyer Thesis page. Follow the cursor across the actual information you should check before you submit anything.',
      actions:[
        'Check the preferred transaction size.',
        'Check the sectors we are looking for.',
        'Check the geographies and transaction structures.',
        'Read the reviewability requirements at the bottom.'
      ],
      hint:'A deal does not have to be identical to the thesis, but you should be able to explain why it is reasonably close.',
      section:'thesis',
      target:'.navBtn[data-section="thesis"]',
      path:[
        {selector:'.navBtn[data-section="thesis"]',label:'Buyer Thesis',click:true},
        {selector:'#thesisMin',label:'First, check Preferred Scale'},
        {selector:'#thesisSectors',label:'Then review the sectors'},
        {selector:'#thesisGeographies',label:'Check the geographies'},
        {selector:'#thesisStructures',label:'Review the structures we can consider'},
        {selector:'#thesisRequirements',label:'Finally, read what makes a deal reviewable'}
      ]
    },
    {
      title:'2. Open Submit Opportunity when you have a deal',
      copy:'You are looking at the real submission screen now. The cursor will show you exactly where the process starts and what appears after you open it.',
      actions:[
        'Use Submit Opportunity in the left menu or the button at the top.',
        'The Step 1: Opportunity Details form is where the deal begins.',
        'Have the main one-pager or pitch deck ready before you continue.'
      ],
      section:'submit',
      target:'.navBtn[data-section="submit"]',
      path:[
        {selector:'.navBtn[data-section="submit"]',label:'Click Submit Opportunity',click:true},
        {selector:'#submissionForm .panelHead',label:'This is Step 1: Opportunity Details'},
        {selector:'#fileDrop',label:'Keep your one-pager or pitch deck ready for this upload area'}
      ]
    },
    {
      title:'3. Upload the one-pager or pitch deck first',
      copy:'Watch the cursor on the actual upload box in your form. Uploading the main document first lets the portal read the deal and fill in details it can identify.',
      actions:[
        'Click Choose files or the upload area.',
        'Select the main one-pager or pitch deck from your computer.',
        'Wait until the file appears as attached.',
        'Then review what the portal filled in for you.'
      ],
      hint:'You can type everything manually if you do not have a deck, but uploading the main document first is usually faster.',
      section:'submit',
      target:'#fileDrop',
      path:[
        {selector:'#fileDrop',label:'This is the real Supporting Materials upload area'},
        {selector:'#chooseFiles',label:'Click Choose files and select the main deal document',click:true},
        {selector:'#fileDrop',label:'After the file attaches, let the portal read it before correcting fields'}
      ]
    },
    {
      title:'4. Read every filled field before continuing',
      copy:'The cursor is moving through the actual opportunity fields on your screen. Read every one. Document extraction saves time, but you are still responsible for making sure the submission is accurate.',
      actions:[
        'Confirm the opportunity name and company or sponsor.',
        'Confirm the capital or transaction size.',
        'Confirm sector, geography, and transaction type.',
        'Read the summary and correct anything wrong or incomplete.'
      ],
      hint:'If the portal could not identify something from the document, type the missing information yourself.',
      section:'submit',
      target:'#dealTitle',
      path:[
        {selector:'#dealTitle',label:'Confirm the Opportunity / Project Name'},
        {selector:'#dealCompany',label:'Confirm the Company / Sponsor'},
        {selector:'#dealAmount',label:'Check the Capital / Transaction Size'},
        {selector:'#dealSector',label:'Check the Sector'},
        {selector:'#dealGeography',label:'Check the Geography'},
        {selector:'#dealType',label:'Confirm the Transaction Type'},
        {selector:'#dealSummary',label:'Read the Opportunity Summary carefully'}
      ]
    },
    {
      title:'5. Continue to the diligence questions',
      copy:'This is the actual button you use after the basic opportunity details are correct. The cursor is pointing at the same control you will click during a real submission.',
      actions:[
        'Click Continue to Diligence at the bottom of the form.',
        'Answer every diligence question as accurately as you can.',
        'Upload additional supporting material when a question calls for it.',
        'Submit the opportunity to Outerhaven only when the diligence step is complete.'
      ],
      section:'submit',
      target:'#submitDeal',
      path:[
        {selector:'#submitDeal',label:'When Step 1 is correct, click Continue to Diligence',click:true},
        {selector:'.formActions',label:'The diligence step opens from this exact part of the real form'}
      ]
    },
    {
      title:'6. Use My Submissions to see what happens next',
      copy:'This is the real My Submissions screen. After a deal is sent, this is where you come back to see its current status, match information, documents, and anything that still needs your attention.',
      actions:[
        'Click My Submissions in the left menu.',
        'Find the opportunity you submitted.',
        'Read its current status and match information.',
        'Open or resume the submission if the portal says more information is required.'
      ],
      hint:'You do not need to resubmit the same deal just to check whether it moved. This page is the running record of your submission.',
      section:'submissions',
      target:'.navBtn[data-section="submissions"]',
      path:[
        {selector:'.navBtn[data-section="submissions"]',label:'Click My Submissions',click:true},
        {selector:'.submissionCard',fallback:'#submissionCards',label:'Your real submitted opportunities appear here'},
        {selector:'#submissionCards',label:'Use this area to track status, match information and next actions'}
      ]
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
    b.setAttribute('aria-label','Replay portal tutorial');b.title='Replay portal tutorial';b.onclick=()=>start();
    document.body.appendChild(b);
  }

  function ensureSection(name){if(!name)return;try{if(typeof showSection==='function')showSection(name)}catch{}}
  function clamp(v,min,max){return Math.max(min,Math.min(max,v))}
  function intersects(a,b,gap=0){return !(a.right+gap<=b.left||a.left-gap>=b.right||a.bottom+gap<=b.top||a.top-gap>=b.bottom)}
  function centerCard(){const card=overlay?.querySelector('.owCard');if(!card)return;card.style.left='50%';card.style.top='50%';card.style.transform='translate(-50%,-50%)'}

  function elementFor(item){
    if(!item)return null;
    let el=null;
    try{if(item.selector)el=document.querySelector(item.selector)}catch{}
    if(!el&&item.fallback){try{el=document.querySelector(item.fallback)}catch{}}
    return el;
  }

  function clearTarget(){
    if(currentTarget){currentTarget.classList.remove('owTarget');currentTarget=null}
  }

  function spotlight(el,scroll=true){
    if(!el)return;
    if(currentTarget&&currentTarget!==el)currentTarget.classList.remove('owTarget');
    currentTarget=el;el.classList.add('owTarget');
    if(scroll){try{el.scrollIntoView({behavior:'smooth',block:'center',inline:'nearest'})}catch{}}
    clearTimeout(positionTimer);
    positionTimer=setTimeout(()=>positionCard(el),360);
  }

  function positionCard(target){
    const card=overlay?.querySelector('.owCard');if(!card)return;
    if(!target||window.innerWidth<760){centerCard();return}
    const vw=window.innerWidth,vh=window.innerHeight,margin=16,gap=24;
    const r=target.getBoundingClientRect();
    const cw=Math.min(card.offsetWidth||500,vw-margin*2),ch=Math.min(card.offsetHeight||620,vh-margin*2);
    const targetRect={left:r.left,top:r.top,right:r.right,bottom:r.bottom};
    const candidates=[
      {left:r.right+gap,top:r.top+(r.height-ch)/2},
      {left:r.left-gap-cw,top:r.top+(r.height-ch)/2},
      {left:r.left+(r.width-cw)/2,top:r.bottom+gap},
      {left:r.left+(r.width-cw)/2,top:r.top-gap-ch}
    ];
    let best=null;
    for(const c of candidates){
      const left=clamp(c.left,margin,vw-cw-margin),top=clamp(c.top,margin,vh-ch-margin);
      const box={left,top,right:left+cw,bottom:top+ch};
      const overlap=intersects(box,targetRect,12),displacement=Math.abs(left-c.left)+Math.abs(top-c.top);
      const score=(overlap?100000:0)+displacement;
      if(!best||score<best.score)best={left,top,score,overlap};
    }
    if(!best||best.overlap){
      const sideLeft=r.left>vw/2;
      const left=sideLeft?margin:Math.max(margin,vw-cw-margin);
      const top=clamp((vh-ch)/2,margin,vh-ch-margin);
      const box={left,top,right:left+cw,bottom:top+ch};
      if(intersects(box,targetRect,8)){centerCard();return}
      card.style.left=`${Math.round(left)}px`;card.style.top=`${Math.round(top)}px`;card.style.transform='none';return;
    }
    card.style.left=`${Math.round(best.left)}px`;card.style.top=`${Math.round(best.top)}px`;card.style.transform='none';
  }

  function clearDemoTimers(){demoTimers.forEach(clearTimeout);demoTimers=[]}
  function removeLiveDemo(){
    clearDemoTimers();
    liveCursor?.remove();liveLabel?.remove();liveCursor=null;liveLabel=null;
  }

  function ensureLiveElements(){
    if(!liveCursor){liveCursor=document.createElement('div');liveCursor.className='owLiveCursor';document.body.appendChild(liveCursor)}
    if(!liveLabel){liveLabel=document.createElement('div');liveLabel.className='owLiveLabel';document.body.appendChild(liveLabel)}
  }

  function cursorPoint(el,item){
    const r=el.getBoundingClientRect();
    let x=r.left+r.width*(item.x??.52),y=r.top+r.height*(item.y??.5);
    x=clamp(x,12,window.innerWidth-36);y=clamp(y,12,window.innerHeight-42);
    return{x,y};
  }

  function moveLiveCursor(el,item){
    if(!el)return;
    ensureLiveElements();
    spotlight(el,false);
    const {x,y}=cursorPoint(el,item);
    liveCursor.style.left=`${Math.round(x)}px`;liveCursor.style.top=`${Math.round(y)}px`;
    liveLabel.textContent=item.label||'Look here';
    const labelLeft=clamp(x+24,12,window.innerWidth-Math.min(300,window.innerWidth-24));
    const labelTop=clamp(y+28,12,window.innerHeight-70);
    liveLabel.style.left=`${Math.round(labelLeft)}px`;liveLabel.style.top=`${Math.round(labelTop)}px`;liveLabel.style.opacity='1';
    positionCard(el);
    if(item.click){
      const t=setTimeout(()=>{
        if(!liveCursor)return;
        liveCursor.classList.add('click');
        const done=setTimeout(()=>liveCursor?.classList.remove('click'),420);demoTimers.push(done);
      },760);demoTimers.push(t);
    }
  }

  function playLiveDemo(){
    if(!overlay)return;
    clearDemoTimers();ensureLiveElements();
    liveLabel.style.opacity='0';
    const step=steps[stepIndex];
    const path=(step.path||[]).filter(item=>elementFor(item));
    if(!path.length){const el=elementFor({selector:step.target});if(el)spotlight(el);return}

    path.forEach((item,i)=>{
      const start=i*1900;
      const timer=setTimeout(()=>{
        if(!overlay)return;
        const el=elementFor(item);if(!el)return;
        try{el.scrollIntoView({behavior:'smooth',block:'center',inline:'nearest'})}catch{}
        const settle=setTimeout(()=>{if(overlay)moveLiveCursor(el,item)},420);demoTimers.push(settle);
      },start);demoTimers.push(timer);
    });
  }

  function render(){
    if(!overlay)return;
    removeLiveDemo();clearTarget();
    const step=steps[stepIndex];ensureSection(step.section);
    overlay.innerHTML=`<div class="owCard" role="dialog" aria-modal="true" aria-label="Originator portal tutorial"><div class="owEyebrow">ORIGINATOR PORTAL TUTORIAL · ${stepIndex+1} OF ${steps.length}</div><h2>${step.title}</h2><p>${step.copy}</p><div class="owDo"><strong>What you should do</strong><ol>${step.actions.map(x=>`<li>${x}</li>`).join('')}</ol></div><div class="owLiveBar"><div><strong>LIVE SCREEN WALKTHROUGH</strong><span>Watch the cursor move over the actual portal behind this card.</span></div><button type="button" class="owReplay" data-ow-replay>Replay screen demo</button></div>${step.hint?`<div class="owHint">${step.hint}</div>`:''}<div class="owStep"><div><button type="button" class="owSkip" data-ow-skip>Skip tutorial</button><div class="owDots">${steps.map((_,i)=>`<span class="owDot ${i===stepIndex?'active':''}"></span>`).join('')}</div></div><div class="owActions">${stepIndex?'<button type="button" class="owBtn" data-ow-back>Back</button>':''}<button type="button" class="owBtn primary" data-ow-next>${stepIndex===steps.length-1?'Finish tutorial':'Next step'}</button></div></div></div>`;
    centerCard();
    overlay.querySelector('[data-ow-skip]').onclick=finish;
    overlay.querySelector('[data-ow-back]')?.addEventListener('click',()=>{stepIndex--;render()});
    overlay.querySelector('[data-ow-next]').onclick=()=>{if(stepIndex===steps.length-1)finish();else{stepIndex++;render()}};
    overlay.querySelector('[data-ow-replay]')?.addEventListener('click',playLiveDemo);

    const initialTimer=setTimeout(()=>{
      if(!overlay)return;
      const target=elementFor({selector:step.target})||elementFor(step.path?.[0]);
      if(target){spotlight(target);const demoTimer=setTimeout(playLiveDemo,620);demoTimers.push(demoTimer)}else{centerCard();playLiveDemo()}
    },160);demoTimers.push(initialTimer);
  }

  function start(){
    if(overlay)return;
    stepIndex=0;overlay=document.createElement('div');overlay.className='owOverlay';document.body.appendChild(overlay);render();
  }

  function finish(){
    markSeen();clearTimeout(positionTimer);removeLiveDemo();clearTarget();overlay?.remove();overlay=null;
    try{if(typeof showSection==='function')showSection('home')}catch{}
  }

  window.addEventListener('resize',()=>{if(overlay&&currentTarget)positionCard(currentTarget)});
  window.addEventListener('scroll',()=>{if(overlay&&currentTarget)positionCard(currentTarget)},{passive:true});
  window.addEventListener('keydown',ev=>{if(ev.key==='Escape'&&overlay)finish()});

  function boot(){
    const app=document.getElementById('app');if(!app||app.classList.contains('hidden'))return false;
    installHelp();if(!seen())setTimeout(()=>start(),650);return true;
  }
  if(!boot()){
    const timer=setInterval(()=>{if(boot())clearInterval(timer)},200);
    setTimeout(()=>clearInterval(timer),15000);
  }
})();