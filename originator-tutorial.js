(function(){
  if(window.__outerhavenTutorial)return;window.__outerhavenTutorial=true;
  const $=id=>document.getElementById(id);
  const qs=s=>document.querySelector(s);
  const KEY='outerhaven_originator_tutorial_v1';
  let index=0,active=false,currentTarget=null;

  const steps=[
    {
      title:'Welcome to OuterHaven',
      eyebrow:'GUIDED WALKTHROUGH',
      body:'This walkthrough shows the full originator workflow: submit a deal, let the software structure it, improve readiness, build the investor data room, generate investor materials, and track the opportunity through review.',
      center:true
    },
    {
      section:'home',selector:'.navBtn[data-section="home"]',
      eyebrow:'01 · OVERVIEW',title:'Your operating dashboard',
      body:'Overview is the starting point. It shows current demand, recent submissions, and the status of opportunities already moving through the portal.'
    },
    {
      section:'submit',selector:'.navBtn[data-section="submit"]',
      eyebrow:'02 · SUBMIT OPPORTUNITY',title:'Start with the transaction',
      body:'Every workflow begins with a submitted opportunity. You can enter the deal manually, but the fastest path is usually to start with the PDF the seller, sponsor, or advisor already has.'
    },
    {
      section:'submit',selector:'#pdfDealImport',fallback:'#submissionForm',
      eyebrow:'03 · DOCUMENT INTELLIGENCE',title:'Upload the existing deal PDF',
      body:'Drop in a teaser, one-pager, CIM, investment memorandum, or pitch deck. The software reads the document and pre-fills compatible transaction fields. Always review the extracted facts before submitting.'
    },
    {
      section:'submit',selector:'#submissionForm .formGrid',fallback:'#submissionForm',
      eyebrow:'04 · DEAL RECORD',title:'Confirm the facts once',
      body:'Review the company, capital ask, sector, geography, structure, financials, summary, and seller relationship. The portal reuses these facts later so the user should not have to repeatedly enter the same information.'
    },
    {
      section:'submit',selector:'.fitPanel',fallback:'#submissionForm',
      eyebrow:'05 · SCREENING',title:'Mandate fit is a screening aid',
      body:'This panel helps determine whether the opportunity fits currently published buyer criteria. It is not part of the investor-facing package, and mandate fit does not determine Investor Readiness.'
    },
    {
      section:'submissions',selector:'#submissionsSection .panel',
      eyebrow:'06 · MY SUBMISSIONS',title:'Track every opportunity',
      body:'My Submissions is the originator pipeline. Open a deal to review its record, documents, status history, messages, requested information, and whether it can be edited or resubmitted.'
    },
    {
      section:'mandates',selector:'#mandatesSection .panel',
      eyebrow:'07 · BUYER MANDATES',title:'See what capital is looking for',
      body:'Buyer Mandates shows the published buy boxes available to approved originators. Use it to understand size, sector, geography, structure, and EBITDA requirements before submitting an opportunity.'
    },
    {
      section:'capital',selector:'#capitalSection .capitalControls',fallback:'#capitalSection',
      eyebrow:'08 · INVESTOR SUITE',title:'Turn the submission into a usable package',
      body:'Select one of your submitted opportunities here. The Investor Suite starts with the original deal record and then asks only for information that is genuinely relevant to that transaction.'
    },
    {
      section:'capital',selector:'#investorSuiteV10Core .v10Readiness',fallback:'#capitalSection .panel',
      eyebrow:'09 · INVESTOR READINESS',title:'A direct path to 100%',
      body:'The readiness circle measures package completeness, not buyer interest. Core transaction facts, required underwriting information, and generated data-room materials move the score toward 100%.'
    },
    {
      section:'capital',selector:'#investorSuiteV10Core .v10Builder',fallback:'#capitalSection .panel',
      eyebrow:'10 · DATA ROOM BUILDER',title:'Answer the missing underwriting questions once',
      body:'The builder reuses compatible information from the initial submission and asks only for transaction-specific gaps. Real estate, hospitality, debt, equity, M&A, and operating-company deals can require different information.'
    },
    {
      section:'capital',selector:'#investorSuiteV10Core .v10Room',fallback:'#capitalSection .panel',
      eyebrow:'11 · GENERATED DATA ROOM',title:'Create reusable investor materials',
      body:'Build or refresh the room after completing the relevant information. The software can generate the teaser, investment memorandum, investor FAQ, transaction overview, capitalization materials, financial overview, risks, data-room index, and diligence checklist.'
    },
    {
      section:'capital',selector:'#capitalProducts',fallback:'#capitalSection .panel',
      eyebrow:'12 · INVESTOR OUTPUTS',title:'Generate documents for a real purpose',
      body:'These outputs are built from the transaction itself. Internal mandate matching is intentionally excluded from investor-facing materials. Generate a document, review it, then use Print / Save PDF when it is ready to send.'
    },
    {
      title:'That is the full workflow',eyebrow:'TUTORIAL COMPLETE',center:true,
      body:'The intended workflow is simple: submit once → complete the missing transaction information → reach Investor Readiness → build the data room → generate investor materials → track the deal through OuterHaven review. You can replay this tutorial anytime from the Tutorial button in the sidebar.'
    }
  ];

  function installStyles(){
    if($('ohTutorialStyle'))return;
    const s=document.createElement('style');s.id='ohTutorialStyle';s.textContent=`
      .ohTutorialBtn{width:100%;margin:0 0 10px;border:1px solid rgba(255,255,255,.16);border-radius:9px;padding:9px 10px;background:rgba(255,255,255,.06);color:inherit;font:750 9px/1 Arial,sans-serif;letter-spacing:.04em;text-transform:uppercase;cursor:pointer;text-align:left}.ohTutorialBtn:hover{background:rgba(255,255,255,.1)}
      .ohtShade{position:fixed;background:rgba(18,16,14,.76);z-index:100000;pointer-events:auto}.ohtFocus{position:fixed;z-index:100001;border:2px solid #d6b98f;border-radius:12px;box-shadow:0 0 0 4px rgba(214,185,143,.18);pointer-events:none;transition:all .18s ease}.ohtCard{position:fixed;z-index:100003;width:min(390px,calc(100vw - 28px));border:1px solid #cdbda9;border-radius:14px;background:#fffdf9;box-shadow:0 24px 70px rgba(0,0,0,.28);padding:18px;color:#241f1b;font-family:"Helvetica Neue",Arial,sans-serif}.ohtCard.center{top:50%;left:50%;transform:translate(-50%,-50%)}.ohtEyebrow{font:850 7px/1 Arial,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:#917657}.ohtCard h3{margin:7px 0 8px;font:680 20px/1.16 "Helvetica Neue",Arial,sans-serif;letter-spacing:-.02em}.ohtCard p{margin:0;font:400 10.5px/1.65 Arial,sans-serif;color:#695f56}.ohtProgress{display:flex;gap:4px;margin:15px 0 12px}.ohtProgress i{height:3px;flex:1;border-radius:99px;background:#e7dfd6}.ohtProgress i.on{background:#7e694f}.ohtFoot{display:flex;justify-content:space-between;align-items:center;gap:10px}.ohtStep{font:750 7.5px Arial,sans-serif;color:#8a7c6e}.ohtActions{display:flex;gap:6px}.ohtAction{border:1px solid #cfc2b4;border-radius:8px;padding:8px 10px;background:#fff;color:#2b251f;font:800 8.5px Arial,sans-serif;cursor:pointer}.ohtAction.primary{background:#211d19;border-color:#211d19;color:#fff}.ohtAction.ghost{border-color:transparent;background:transparent;color:#7b6e62}.ohtWelcomeBack{position:fixed;right:18px;bottom:18px;z-index:9990;border:1px solid #d8ccbd;border-radius:999px;padding:9px 12px;background:#fffdf9;box-shadow:0 8px 26px rgba(0,0,0,.11);font:800 8px Arial,sans-serif;color:#312a24;cursor:pointer}.ohtWelcomeBack:hover{background:#f7f1e9}
      @media(max-width:700px){.ohtCard{left:14px!important;right:14px!important;width:auto!important;transform:none!important;bottom:14px!important;top:auto!important}.ohtFocus{border-radius:9px}}
    `;document.head.appendChild(s);
  }

  function installButton(){
    if($('tutorialReplay'))return;
    const bottom=qs('.sideBottom');if(!bottom)return;
    const b=document.createElement('button');b.id='tutorialReplay';b.type='button';b.className='ohTutorialBtn';b.textContent='Tutorial / Help';b.onclick=()=>start(0);bottom.prepend(b);
  }

  function installLayer(){
    if($('ohtCard'))return;
    ['Top','Left','Right','Bottom'].forEach(x=>{const d=document.createElement('div');d.id='ohtShade'+x;d.className='ohtShade';d.hidden=true;document.body.appendChild(d)});
    const f=document.createElement('div');f.id='ohtFocus';f.className='ohtFocus';f.hidden=true;document.body.appendChild(f);
    const c=document.createElement('aside');c.id='ohtCard';c.className='ohtCard';c.hidden=true;c.setAttribute('role','dialog');c.setAttribute('aria-modal','true');document.body.appendChild(c);
  }

  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  async function waitFor(selector,timeout=3500){
    if(!selector)return null;const start=Date.now();while(Date.now()-start<timeout){const el=qs(selector);if(el)return el;await sleep(100)}return null;
  }
  async function goSection(name){
    if(!name)return;let b=qs(`.navBtn[data-section="${name}"]`);
    if(!b&&name==='capital'){for(let i=0;i<25&&!b;i++){await sleep(120);b=qs('.navBtn[data-section="capital"]')}}
    if(b&&!b.classList.contains('active')){b.click();await sleep(name==='capital'?450:220)}
  }

  function shades(rect){
    const t=$('ohtShadeTop'),l=$('ohtShadeLeft'),r=$('ohtShadeRight'),b=$('ohtShadeBottom'),f=$('ohtFocus');
    const pad=8,x=Math.max(8,rect.left-pad),y=Math.max(8,rect.top-pad),w=Math.min(innerWidth-x-8,rect.width+pad*2),h=Math.min(innerHeight-y-8,rect.height+pad*2);
    [t,l,r,b,f].forEach(el=>el.hidden=false);
    Object.assign(t.style,{left:'0px',top:'0px',width:'100vw',height:y+'px'});
    Object.assign(b.style,{left:'0px',top:(y+h)+'px',width:'100vw',height:Math.max(0,innerHeight-y-h)+'px'});
    Object.assign(l.style,{left:'0px',top:y+'px',width:x+'px',height:h+'px'});
    Object.assign(r.style,{left:(x+w)+'px',top:y+'px',width:Math.max(0,innerWidth-x-w)+'px',height:h+'px'});
    Object.assign(f.style,{left:x+'px',top:y+'px',width:w+'px',height:h+'px'});
    return{x,y,w,h};
  }
  function fullShade(){
    const t=$('ohtShadeTop'),l=$('ohtShadeLeft'),r=$('ohtShadeRight'),b=$('ohtShadeBottom'),f=$('ohtFocus');
    t.hidden=false;Object.assign(t.style,{left:'0px',top:'0px',width:'100vw',height:'100vh'});[l,r,b,f].forEach(el=>el.hidden=true);
  }
  function hideLayer(){['ohtShadeTop','ohtShadeLeft','ohtShadeRight','ohtShadeBottom','ohtFocus','ohtCard'].forEach(id=>{const el=$(id);if(el)el.hidden=true})}

  function positionCard(box){
    const c=$('ohtCard');if(!c||!box)return;c.classList.remove('center');
    const cw=Math.min(390,innerWidth-28),gap=14;
    let left=box.x+box.w+gap,top=box.y;
    if(left+cw>innerWidth-14)left=Math.max(14,box.x-cw-gap);
    if(top+300>innerHeight-14)top=Math.max(14,innerHeight-314);
    if(innerWidth<700){c.style.left='14px';c.style.top='auto';return}
    c.style.left=left+'px';c.style.top=top+'px';c.style.right='auto';c.style.bottom='auto';c.style.transform='none';
  }

  function renderCard(step){
    const c=$('ohtCard');if(!c)return;c.hidden=false;
    const progress=steps.map((_,i)=>`<i class="${i<=index?'on':''}"></i>`).join('');
    c.innerHTML=`<div class="ohtEyebrow">${step.eyebrow||'OUTERHAVEN TUTORIAL'}</div><h3>${step.title}</h3><p>${step.body}</p><div class="ohtProgress">${progress}</div><div class="ohtFoot"><span class="ohtStep">${index+1} / ${steps.length}</span><div class="ohtActions">${index>0?'<button type="button" class="ohtAction ghost" data-oht="back">Back</button>':''}<button type="button" class="ohtAction ghost" data-oht="skip">Exit</button><button type="button" class="ohtAction primary" data-oht="next">${index===steps.length-1?'Finish':'Next'}</button></div></div>`;
  }

  async function showStep(i){
    if(!active)return;index=Math.max(0,Math.min(i,steps.length-1));const step=steps[index];
    await goSection(step.section);
    renderCard(step);
    if(step.center){currentTarget=null;fullShade();$('ohtCard').classList.add('center');$('ohtCard').style.left='50%';$('ohtCard').style.top='50%';$('ohtCard').style.transform='translate(-50%,-50%)';return}
    let el=await waitFor(step.selector,3000);if(!el&&step.fallback)el=await waitFor(step.fallback,1200);
    if(!el){currentTarget=null;fullShade();$('ohtCard').classList.add('center');$('ohtCard').style.left='50%';$('ohtCard').style.top='50%';$('ohtCard').style.transform='translate(-50%,-50%)';return}
    currentTarget=el;el.scrollIntoView({behavior:'smooth',block:'center'});await sleep(260);const box=shades(el.getBoundingClientRect());positionCard(box);
  }

  async function start(from=0){
    installLayer();active=true;document.documentElement.classList.add('ohTutorialActive');await showStep(from);
  }
  function finish(mark=true){
    active=false;currentTarget=null;hideLayer();document.documentElement.classList.remove('ohTutorialActive');if(mark)try{localStorage.setItem(KEY,'done')}catch(_){}
  }
  function next(){if(index>=steps.length-1){finish(true);return}showStep(index+1)}
  function back(){if(index>0)showStep(index-1)}

  document.addEventListener('click',e=>{const a=e.target.closest('[data-oht]');if(!a)return;const op=a.dataset.oht;if(op==='next')next();else if(op==='back')back();else if(op==='skip')finish(true)},true);
  document.addEventListener('keydown',e=>{if(!active)return;if(e.key==='Escape')finish(true);else if(e.key==='ArrowRight'){e.preventDefault();next()}else if(e.key==='ArrowLeft'){e.preventDefault();back()}},true);
  addEventListener('resize',()=>{if(active&&currentTarget){const box=shades(currentTarget.getBoundingClientRect());positionCard(box)}},{passive:true});
  addEventListener('scroll',()=>{if(active&&currentTarget){const box=shades(currentTarget.getBoundingClientRect());positionCard(box)}},{passive:true});

  async function init(){installStyles();installLayer();let tries=0;while(!qs('.sideBottom')&&tries++<40)await sleep(150);installButton();let seen=false;try{seen=localStorage.getItem(KEY)==='done'}catch(_){}if(!seen){await sleep(900);start(0)}}
  init();
  window.OuterHavenTutorial={start:()=>start(0),finish:()=>finish(true)};
})();