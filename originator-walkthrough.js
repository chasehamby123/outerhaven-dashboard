(function(){
  if(window.__outerhavenOriginatorWalkthrough)return;
  window.__outerhavenOriginatorWalkthrough=true;

  const VERSION='v2-guided';
  let stepIndex=0;
  let overlay=null;
  let currentTarget=null;
  let positionTimer=null;

  const style=document.createElement('style');
  style.textContent=`
    .owHelp{position:fixed;right:18px;bottom:18px;z-index:2600;border:1px solid #d7dce1;border-radius:999px;background:#fff;color:#111318;display:flex;align-items:center;gap:8px;padding:11px 15px;font-size:13px;font-weight:850;cursor:pointer;box-shadow:0 10px 30px rgba(17,19,24,.13)}
    .owHelp:before{content:'?';width:22px;height:22px;border-radius:50%;background:#111318;color:#fff;display:grid;place-items:center;font-size:12px;font-weight:900}.owHelp:hover{background:#f6f7f8}
    .owOverlay{position:fixed;inset:0;z-index:4000;background:rgba(17,19,24,.55)}
    .owCard{width:min(560px,calc(100vw - 30px));max-height:calc(100vh - 28px);overflow:auto;background:#fff;border-radius:20px;padding:24px;box-shadow:0 28px 90px rgba(0,0,0,.30);position:fixed;z-index:4010;left:50%;top:50%;transform:translate(-50%,-50%);transition:left .18s ease,top .18s ease,transform .18s ease}
    .owEyebrow{font-size:11px;font-weight:900;letter-spacing:.11em;color:#737c87}.owCard h2{font-size:25px;line-height:1.12;letter-spacing:-.03em;margin:7px 0 10px;color:#17191d}.owCard>p{font-size:15px;line-height:1.62;color:#59636f;margin:0}
    .owDo{margin-top:15px;border:1px solid #dde2e7;background:#f7f8fa;border-radius:13px;padding:14px 15px}.owDo strong{display:block;font-size:12px;letter-spacing:.06em;text-transform:uppercase;margin-bottom:8px}.owDo ol{margin:0;padding-left:21px}.owDo li{font-size:14px;line-height:1.55;color:#343b44;padding:2px 0}
    .owHint{margin-top:12px;padding:11px 12px;border-radius:11px;background:#fff8e8;border:1px solid #f0dfaf;font-size:13px;line-height:1.5;color:#6d5718}
    .owStep{margin-top:17px;display:flex;align-items:flex-end;justify-content:space-between;gap:14px}.owDots{display:flex;gap:6px;margin-top:7px}.owDot{width:7px;height:7px;border-radius:99px;background:#d8dde2}.owDot.active{width:22px;background:#111318}.owActions{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}.owBtn{border:1px solid #d4d9df;background:#fff;border-radius:10px;padding:10px 13px;font-size:13px;font-weight:850;cursor:pointer}.owBtn.primary{background:#111318;color:#fff;border-color:#111318}.owSkip{border:0;background:transparent;color:#737c87;padding:4px 0;font-size:12px;font-weight:800;cursor:pointer}
    .owTarget{position:relative!important;z-index:4005!important;outline:4px solid #fff!important;box-shadow:0 0 0 8px rgba(255,255,255,.24),0 16px 48px rgba(0,0,0,.28)!important;border-radius:11px!important}.owTarget *{position:relative;z-index:1}

    .owDemo{margin-top:16px;border:1px solid #dfe4e9;border-radius:15px;background:#f3f5f7;overflow:hidden;position:relative}.owDemoTop{height:36px;padding:0 12px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #e1e5e9;background:#fff}.owDemoTop span{font-size:10px;font-weight:900;letter-spacing:.08em;color:#747d87}.owReplay{border:0;background:transparent;font-size:11px;font-weight:800;color:#4d5864;cursor:pointer}.owDemoStage{height:190px;position:relative;overflow:hidden;padding:12px}.owMiniApp{position:absolute;inset:12px;border:1px solid #dde2e7;background:#fff;border-radius:11px;display:grid;grid-template-columns:108px 1fr;overflow:hidden}.owMiniSide{background:#fafbfc;border-right:1px solid #e3e7eb;padding:10px 8px;display:grid;align-content:start;gap:6px}.owMiniBrand{height:15px;width:62px;background:#17191d;border-radius:4px;margin:2px 4px 8px}.owMiniNav{height:24px;border-radius:6px;padding:0 7px;display:flex;align-items:center;font-size:8px;font-weight:800;color:#65707c}.owMiniNav.active{background:#17191d;color:#fff}.owMiniMain{padding:13px;position:relative}.owMiniTitle{width:125px;height:12px;border-radius:4px;background:#1b1e22;margin-bottom:11px}.owMiniLine{height:7px;border-radius:4px;background:#e5e8ec;margin:7px 0}.owMiniLine.short{width:55%}.owMiniLine.med{width:76%}.owMiniPanel{border:1px solid #e2e6ea;border-radius:8px;padding:10px;background:#fff}.owMiniButton{display:inline-flex;align-items:center;justify-content:center;background:#17191d;color:#fff;border-radius:6px;height:26px;padding:0 10px;font-size:8px;font-weight:900}.owMiniButton.light{background:#fff;color:#333;border:1px solid #d8dde2}.owMiniFile{height:66px;border:1px dashed #cdd4db;border-radius:7px;display:grid;place-items:center;align-content:center;gap:6px;background:#fafbfc}.owMiniChip{height:24px;margin-top:7px;border-radius:6px;background:#eef1f4;border:1px solid #e0e4e8;display:flex;align-items:center;padding:0 8px;font-size:8px;font-weight:800;opacity:0}.owMiniField{height:26px;border:1px solid #d9dee4;border-radius:6px;margin-bottom:7px;padding:0 8px;display:flex;align-items:center;font-size:8px;color:#7b848e}.owMiniField.filled{color:#27303a;background:#fbfcfc}.owMiniStatus{display:inline-block;border-radius:99px;padding:4px 7px;background:#fff8e8;color:#7a5c13;font-size:7px;font-weight:900}.owMiniCheck{height:24px;border:1px solid #e0e4e8;border-radius:6px;margin:6px 0;display:flex;align-items:center;gap:7px;padding:0 8px;font-size:8px;font-weight:750}.owMiniCheck:before{content:'✓';width:14px;height:14px;border-radius:50%;display:grid;place-items:center;background:#e9f6ee;color:#247a4b;font-size:8px;font-weight:900}.owCursor{position:absolute;z-index:20;width:22px;height:28px;background:#111318;clip-path:polygon(0 0,0 100%,34% 72%,52% 98%,66% 90%,49% 67%,100% 67%);filter:drop-shadow(0 2px 2px rgba(0,0,0,.24));transform-origin:3px 3px}.owCursor:after{content:'';position:absolute;width:22px;height:22px;border:2px solid #111318;border-radius:50%;left:-9px;top:-9px;opacity:0}.owDemoCaption{position:absolute;left:22px;right:22px;bottom:18px;background:rgba(17,19,24,.92);color:#fff;border-radius:8px;padding:7px 9px;font-size:9px;font-weight:800;text-align:center;z-index:12;opacity:0}

    .owDemo.navigation .owCursor{animation:owNavCursor 5.2s ease-in-out infinite}.owDemo.navigation .owMiniNav:nth-child(3){animation:owNavGlow 5.2s infinite}
    .owDemo.thesis .owCursor{animation:owThesisCursor 5.4s ease-in-out infinite}.owDemo.thesis .owMiniNav:last-child{animation:owThesisGlow 5.4s infinite}.owDemo.thesis .owDemoCaption{animation:owCaption 5.4s infinite}
    .owDemo.start .owCursor{animation:owStartCursor 4.8s ease-in-out infinite}.owDemo.start .owMiniNav:nth-child(3){animation:owStartGlow 4.8s infinite}.owDemo.start .owDemoCaption{animation:owCaption 4.8s infinite}
    .owDemo.upload .owCursor{animation:owUploadCursor 5.5s ease-in-out infinite}.owDemo.upload .owMiniChip{animation:owFileAppear 5.5s infinite}.owDemo.upload .owDemoCaption{animation:owCaption 5.5s infinite}
    .owDemo.review .owCursor{animation:owReviewCursor 5.4s ease-in-out infinite}.owDemo.review .owMiniField.filled{animation:owFieldConfirm 5.4s infinite}.owDemo.review .owDemoCaption{animation:owCaption 5.4s infinite}
    .owDemo.diligence .owCursor{animation:owDiligenceCursor 5.5s ease-in-out infinite}.owDemo.diligence .owDiligencePanel{animation:owDiligencePanel 5.5s infinite}.owDemo.diligence .owDemoCaption{animation:owCaption 5.5s infinite}
    .owDemo.track .owCursor{animation:owTrackCursor 5.2s ease-in-out infinite}.owDemo.track .owMiniNav:nth-child(4){animation:owTrackGlow 5.2s infinite}.owDemo.track .owTrackCard{animation:owTrackCard 5.2s infinite}.owDemo.track .owDemoCaption{animation:owCaption 5.2s infinite}

    @keyframes owNavCursor{0%,12%{left:188px;top:122px}28%{left:52px;top:87px}38%{transform:scale(.82)}44%{transform:scale(1)}60%{left:52px;top:119px}70%{transform:scale(.82)}76%{transform:scale(1)}100%{left:188px;top:122px}}
    @keyframes owNavGlow{0%,24%,50%,100%{background:transparent;color:#65707c}30%,44%{background:#17191d;color:#fff}}
    @keyframes owThesisCursor{0%,14%{left:190px;top:120px}30%{left:55px;top:151px}38%{transform:scale(.8)}44%{transform:scale(1)}100%{left:214px;top:76px}}
    @keyframes owThesisGlow{0%,26%,100%{background:transparent;color:#65707c}32%,60%{background:#17191d;color:#fff}}
    @keyframes owStartCursor{0%,12%{left:205px;top:118px}30%{left:54px;top:88px}39%{transform:scale(.8)}45%{transform:scale(1)}100%{left:190px;top:92px}}
    @keyframes owStartGlow{0%,25%,100%{background:transparent;color:#65707c}31%,62%{background:#17191d;color:#fff}}
    @keyframes owUploadCursor{0%,14%{left:205px;top:120px}34%{left:274px;top:103px}42%{transform:scale(.78)}48%{transform:scale(1)}100%{left:300px;top:145px}}
    @keyframes owFileAppear{0%,45%{opacity:0;transform:translateY(5px)}55%,100%{opacity:1;transform:none}}
    @keyframes owReviewCursor{0%,15%{left:330px;top:140px}32%{left:184px;top:66px}44%{left:184px;top:98px}56%{left:184px;top:130px}100%{left:330px;top:143px}}
    @keyframes owFieldConfirm{0%,30%{box-shadow:none}42%,70%{box-shadow:0 0 0 2px rgba(36,122,75,.2);border-color:#9bc9ae}100%{box-shadow:none}}
    @keyframes owDiligenceCursor{0%,16%{left:190px;top:92px}34%{left:327px;top:151px}42%{transform:scale(.78)}48%{transform:scale(1)}100%{left:295px;top:128px}}
    @keyframes owDiligencePanel{0%,44%{opacity:0;transform:translateY(8px)}54%,100%{opacity:1;transform:none}}
    @keyframes owTrackCursor{0%,14%{left:205px;top:120px}32%{left:54px;top:119px}40%{transform:scale(.8)}46%{transform:scale(1)}100%{left:255px;top:102px}}
    @keyframes owTrackGlow{0%,28%,100%{background:transparent;color:#65707c}34%,62%{background:#17191d;color:#fff}}
    @keyframes owTrackCard{0%,43%{opacity:.15;transform:translateY(8px)}54%,100%{opacity:1;transform:none}}
    @keyframes owCaption{0%,42%{opacity:0;transform:translateY(4px)}52%,82%{opacity:1;transform:none}92%,100%{opacity:0}}

    @media(max-width:760px){.owHelp{right:12px;bottom:12px;padding:10px 13px}.owCard{width:calc(100vw - 18px);padding:19px;border-radius:16px}.owCard h2{font-size:22px}.owCard>p{font-size:14px}.owDo li{font-size:13px}.owDemoStage{height:175px}.owMiniApp{grid-template-columns:92px 1fr}.owActions{width:100%}.owStep{align-items:flex-start;flex-direction:column}.owBtn{flex:1}.owTarget{z-index:4005!important}}
    @media(prefers-reduced-motion:reduce){.owDemo *{animation:none!important}.owCursor{display:none}.owMiniChip,.owDiligencePanel,.owTrackCard,.owDemoCaption{opacity:1!important;transform:none!important}}
  `;
  document.head.appendChild(style);

  const steps=[
    {
      title:'Start here: the portal only has four main areas',
      copy:'You do not need to learn everything at once. The menu on the left is the entire portal: Overview, Submit Opportunity, My Submissions, and Buyer Thesis.',
      actions:[
        'Use Buyer Thesis to check what Outerhaven is looking for.',
        'Use Submit Opportunity when you have a deal to send us.',
        'Use My Submissions after you send a deal to see what is happening.'
      ],
      hint:'If you ever get lost, click the Tutorial button in the bottom-right corner and this walkthrough will start again.',
      demo:'navigation'
    },
    {
      title:'1. Check the Buyer Thesis before sending a deal',
      copy:'The buyer thesis tells you what types of opportunities are most useful to send us. This helps you avoid spending time submitting something that clearly does not fit.',
      actions:[
        'Click Buyer Thesis in the left menu.',
        'Check the preferred transaction size.',
        'Check the sectors, geographies, and transaction structures.',
        'If the deal is reasonably close, continue to Submit Opportunity.'
      ],
      section:'home',
      target:'.navBtn[data-section="thesis"]',
      demo:'thesis'
    },
    {
      title:'2. Click Submit Opportunity to start',
      copy:'When you have a deal you want Outerhaven to review, this is where you begin. You can use the left menu or the Submit Opportunity button at the top of the page.',
      actions:[
        'Click Submit Opportunity.',
        'You will see the opportunity form.',
        'Have the one-pager or pitch deck ready on your computer before you continue.'
      ],
      section:'home',
      target:'.navBtn[data-section="submit"]',
      demo:'start'
    },
    {
      title:'3. Upload the one-pager or pitch deck first',
      copy:'The fastest way to complete a submission is to give the portal the main deal document first. The system reads the document and fills in the opportunity details it can identify.',
      actions:[
        'Click Choose files or the document upload area.',
        'Select the main one-pager or pitch deck from your computer.',
        'Wait for the document to appear as uploaded.',
        'Let the portal fill in the deal information before you start correcting fields.'
      ],
      section:'submit',
      target:'#odImport, #fileDrop',
      hint:'You can still type everything manually if you do not have a deck, but uploading the main document first is usually faster.',
      demo:'upload'
    },
    {
      title:'4. Read every filled field before continuing',
      copy:'Document extraction saves time, but you are still responsible for making sure the submission is accurate. Do not click through without reading what was filled in.',
      actions:[
        'Confirm the opportunity name and company or sponsor.',
        'Confirm the capital or transaction size.',
        'Confirm sector, geography, and transaction type.',
        'Read the opportunity summary and correct anything that is wrong or incomplete.'
      ],
      section:'submit',
      target:'#submissionForm',
      hint:'If the portal could not identify something from the document, simply type the missing information yourself.',
      demo:'review'
    },
    {
      title:'5. Complete the diligence questions',
      copy:'After the basic deal information is correct, the portal asks a short set of diligence questions. These help Outerhaven understand whether the opportunity is ready for institutional review.',
      actions:[
        'Click Continue to Diligence at the bottom of the form.',
        'Answer each diligence question as accurately as you can.',
        'Upload any additional document the question asks for, if you have it.',
        'When everything is complete, submit the opportunity to Outerhaven.'
      ],
      section:'submit',
      target:'.formActions',
      demo:'diligence'
    },
    {
      title:'6. Use My Submissions to see what happens next',
      copy:'Once the deal is submitted, you do not need to resubmit it or message us just to see whether it moved. The status in My Submissions is your running view of the opportunity.',
      actions:[
        'Click My Submissions in the left menu.',
        'Find the opportunity you submitted.',
        'Read its current status and match information.',
        'Open the submission whenever you need to review the documents or progress.'
      ],
      section:'submissions',
      target:'.navBtn[data-section="submissions"]',
      hint:'Statuses change as Outerhaven reviews the opportunity, matches it to the network, receives buyer interest, or moves into an engagement.',
      demo:'track'
    }
  ];

  function demoMarkup(kind){
    const top=`<div class="owDemoTop"><span>WATCH WHAT TO DO</span><button type="button" class="owReplay" data-ow-replay>Replay animation</button></div>`;
    if(kind==='navigation')return `<div class="owDemo navigation">${top}<div class="owDemoStage"><div class="owMiniApp"><div class="owMiniSide"><div class="owMiniBrand"></div><div class="owMiniNav active">Overview</div><div class="owMiniNav">Submit Opportunity</div><div class="owMiniNav">My Submissions</div><div class="owMiniNav">Buyer Thesis</div></div><div class="owMiniMain"><div class="owMiniTitle"></div><div class="owMiniPanel"><div class="owMiniLine"></div><div class="owMiniLine med"></div><div class="owMiniLine short"></div></div></div></div><div class="owCursor"></div></div></div>`;
    if(kind==='thesis')return `<div class="owDemo thesis">${top}<div class="owDemoStage"><div class="owMiniApp"><div class="owMiniSide"><div class="owMiniBrand"></div><div class="owMiniNav active">Overview</div><div class="owMiniNav">Submit Opportunity</div><div class="owMiniNav">My Submissions</div><div class="owMiniNav">Buyer Thesis</div></div><div class="owMiniMain"><div class="owMiniTitle"></div><div class="owMiniPanel"><div class="owMiniLine med"></div><div class="owMiniLine"></div><div class="owMiniLine short"></div></div></div></div><div class="owCursor"></div><div class="owDemoCaption">Check size, sector, geography and structure before submitting.</div></div></div>`;
    if(kind==='start')return `<div class="owDemo start">${top}<div class="owDemoStage"><div class="owMiniApp"><div class="owMiniSide"><div class="owMiniBrand"></div><div class="owMiniNav active">Overview</div><div class="owMiniNav">Submit Opportunity</div><div class="owMiniNav">My Submissions</div><div class="owMiniNav">Buyer Thesis</div></div><div class="owMiniMain"><div class="owMiniTitle"></div><div class="owMiniPanel"><div class="owMiniLine"></div><div class="owMiniLine med"></div><div style="margin-top:12px"><span class="owMiniButton">+ Submit Opportunity</span></div></div></div></div><div class="owCursor"></div><div class="owDemoCaption">Click Submit Opportunity to open the deal form.</div></div></div>`;
    if(kind==='upload')return `<div class="owDemo upload">${top}<div class="owDemoStage"><div class="owMiniApp" style="grid-template-columns:1fr"><div class="owMiniMain"><div class="owMiniTitle"></div><div class="owMiniFile"><div class="owMiniLine short" style="width:130px"></div><span class="owMiniButton light">Choose files</span></div><div class="owMiniChip">Project-Deck.pdf&nbsp;&nbsp; Uploaded</div></div></div><div class="owCursor"></div><div class="owDemoCaption">Upload the main deck first. The portal can then fill in deal details.</div></div></div>`;
    if(kind==='review')return `<div class="owDemo review">${top}<div class="owDemoStage"><div class="owMiniApp" style="grid-template-columns:1fr"><div class="owMiniMain"><div class="owMiniTitle"></div><div class="owMiniField filled">Southeast Asia Resort Portfolio</div><div class="owMiniField filled">$150,000,000</div><div class="owMiniField filled">Hospitality · Southeast Asia</div><div class="owMiniField filled">Equity Raise</div></div></div><div class="owCursor"></div><div class="owDemoCaption">Read each field and correct anything the document reader got wrong.</div></div></div>`;
    if(kind==='diligence')return `<div class="owDemo diligence">${top}<div class="owDemoStage"><div class="owMiniApp" style="grid-template-columns:1fr"><div class="owMiniMain"><div class="owMiniTitle"></div><div class="owMiniLine"></div><div class="owMiniLine med"></div><div style="position:absolute;right:13px;bottom:12px"><span class="owMiniButton">Continue to Diligence</span></div><div class="owMiniPanel owDiligencePanel" style="position:absolute;left:58px;right:58px;top:42px;background:#fff;opacity:0"><div class="owMiniCheck">Financial information confirmed</div><div class="owMiniCheck">Decision-maker access confirmed</div><div class="owMiniCheck">Supporting materials ready</div></div></div></div><div class="owCursor"></div><div class="owDemoCaption">Answer the diligence questions, then submit the opportunity.</div></div></div>`;
    return `<div class="owDemo track">${top}<div class="owDemoStage"><div class="owMiniApp"><div class="owMiniSide"><div class="owMiniBrand"></div><div class="owMiniNav active">Overview</div><div class="owMiniNav">Submit Opportunity</div><div class="owMiniNav">My Submissions</div><div class="owMiniNav">Buyer Thesis</div></div><div class="owMiniMain"><div class="owMiniTitle"></div><div class="owMiniPanel owTrackCard"><span class="owMiniStatus">UNDER REVIEW</span><div class="owMiniLine med"></div><div class="owMiniLine short"></div></div></div></div><div class="owCursor"></div><div class="owDemoCaption">Return to My Submissions whenever you want to check progress.</div></div></div>`;
  }

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
  function clearTarget(){if(currentTarget){currentTarget.classList.remove('owTarget');currentTarget=null}}
  function ensureSection(name){if(!name)return;try{if(typeof showSection==='function')showSection(name)}catch{}}
  function targetFor(step){return step.target?document.querySelector(step.target):null}
  function centerCard(){const card=overlay?.querySelector('.owCard');if(!card)return;card.style.left='50%';card.style.top='50%';card.style.transform='translate(-50%,-50%)'}
  function intersects(a,b,gap=0){return !(a.right+gap<=b.left||a.left-gap>=b.right||a.bottom+gap<=b.top||a.top-gap>=b.bottom)}
  function clamp(v,min,max){return Math.max(min,Math.min(max,v))}

  function positionCard(target){
    const card=overlay?.querySelector('.owCard');if(!card)return;
    if(!target||window.innerWidth<760){centerCard();return}
    const vw=window.innerWidth,vh=window.innerHeight,margin=16,gap=22;
    const r=target.getBoundingClientRect();
    const cw=Math.min(card.offsetWidth||560,vw-margin*2),ch=Math.min(card.offsetHeight||620,vh-margin*2);
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
    if(!best||best.overlap){centerCard();return}
    card.style.left=`${Math.round(best.left)}px`;card.style.top=`${Math.round(best.top)}px`;card.style.transform='none';
  }
  function schedulePosition(target){clearTimeout(positionTimer);positionTimer=setTimeout(()=>positionCard(target),240)}

  function restartDemo(){
    const demo=overlay?.querySelector('.owDemo');if(!demo)return;
    const clone=demo.cloneNode(true);demo.replaceWith(clone);clone.querySelector('[data-ow-replay]')?.addEventListener('click',restartDemo);
  }

  function render(){
    if(!overlay)return;
    clearTarget();
    const step=steps[stepIndex];ensureSection(step.section);
    overlay.innerHTML=`<div class="owCard" role="dialog" aria-modal="true" aria-label="Originator portal tutorial"><div class="owEyebrow">ORIGINATOR PORTAL TUTORIAL · ${stepIndex+1} OF ${steps.length}</div><h2>${step.title}</h2><p>${step.copy}</p><div class="owDo"><strong>What you should do</strong><ol>${step.actions.map(x=>`<li>${x}</li>`).join('')}</ol></div>${demoMarkup(step.demo)}${step.hint?`<div class="owHint">${step.hint}</div>`:''}<div class="owStep"><div><button type="button" class="owSkip" data-ow-skip>Skip tutorial</button><div class="owDots">${steps.map((_,i)=>`<span class="owDot ${i===stepIndex?'active':''}"></span>`).join('')}</div></div><div class="owActions">${stepIndex?'<button type="button" class="owBtn" data-ow-back>Back</button>':''}<button type="button" class="owBtn primary" data-ow-next>${stepIndex===steps.length-1?'Finish tutorial':'Next step'}</button></div></div></div>`;
    centerCard();
    overlay.querySelector('[data-ow-skip]').onclick=finish;
    overlay.querySelector('[data-ow-back]')?.addEventListener('click',()=>{stepIndex--;render()});
    overlay.querySelector('[data-ow-next]').onclick=()=>{if(stepIndex===steps.length-1)finish();else{stepIndex++;render()}};
    overlay.querySelector('[data-ow-replay]')?.addEventListener('click',restartDemo);

    setTimeout(()=>{
      const target=targetFor(step);
      if(target){currentTarget=target;target.classList.add('owTarget');try{target.scrollIntoView({behavior:'smooth',block:'center',inline:'nearest'})}catch{}schedulePosition(target)}else centerCard();
    },100);
  }

  function start(){if(overlay)return;stepIndex=0;overlay=document.createElement('div');overlay.className='owOverlay';document.body.appendChild(overlay);render()}
  function finish(){markSeen();clearTimeout(positionTimer);clearTarget();overlay?.remove();overlay=null;try{if(typeof showSection==='function')showSection('home')}catch{}}

  window.addEventListener('resize',()=>{if(overlay)positionCard(currentTarget)});
  window.addEventListener('scroll',()=>{if(overlay&&currentTarget)positionCard(currentTarget)},{passive:true});

  function boot(){
    const app=document.getElementById('app');if(!app||app.classList.contains('hidden'))return false;
    installHelp();if(!seen())setTimeout(()=>start(),650);return true;
  }
  if(!boot()){
    const timer=setInterval(()=>{if(boot())clearInterval(timer)},200);
    setTimeout(()=>clearInterval(timer),15000);
  }
})();