(function(){
  if(window.__outerhavenInstitutional)return;
  window.__outerhavenInstitutional=true;
  const sb=window.__OUTERHAVEN_ORIGINATOR_SB;
  if(!sb)return;

  let currentUser=null;
  let deals=[];
  let boxes=[];
  let docsByDeal=new Map();
  let refreshing=false;

  const $=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  const norm=v=>String(v||'').trim().toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  const cap=v=>String(v||'').replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
  const money=v=>{const n=Number(v||0);if(!n)return'Not specified';if(n>=1e9)return'$'+(n/1e9).toFixed(n%1e9?1:0)+'B';if(n>=1e6)return'$'+(n/1e6).toFixed(n%1e6?1:0)+'M';if(n>=1e3)return'$'+(n/1e3).toFixed(n%1e3?1:0)+'K';return'$'+n.toLocaleString()};
  const date=v=>v?new Date(v).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'}):'—';

  function parseMoney(value){
    const raw=String(value||'').trim().toLowerCase().replace(/[$,\s]/g,'');
    if(!raw)return 0;
    const m=raw.match(/^(\d+(?:\.\d+)?)(k|m|b|thousand|million|billion)?$/i);
    if(!m)return Number(raw)||0;
    let n=Number(m[1]);
    const suffix=(m[2]||'').toLowerCase();
    if(suffix==='k'||suffix==='thousand')n*=1e3;
    if(suffix==='m'||suffix==='million')n*=1e6;
    if(suffix==='b'||suffix==='billion')n*=1e9;
    return Number.isFinite(n)?n:0;
  }

  function textMatch(input,criterion,globalWords=[]){
    const a=norm(input),b=norm(criterion);
    if(!b)return true;
    if(globalWords.some(w=>b.includes(w)))return true;
    if(!a)return false;
    return a.includes(b)||b.includes(a)||a.split(' ').some(x=>x.length>3&&b.includes(x));
  }

  function mandateScore(input,box){
    const criteria=[];
    const amount=Number(input.deal_size||0);
    if(box.min_size||box.max_size)criteria.push((!box.min_size||amount>=Number(box.min_size))&&(!box.max_size||amount<=Number(box.max_size)));
    criteria.push(textMatch(input.sector,box.sector,['agnostic','all sectors','sector agnostic']));
    criteria.push(textMatch(input.geography,box.geography,['global','worldwide','all geographies']));
    criteria.push(textMatch(input.transaction_type,box.transaction_type,['flexible','all structures','multiple structures']));
    if(box.min_ebitda)criteria.push(Number(input.ebitda||0)>=Number(box.min_ebitda));
    return criteria.length?Math.round(criteria.filter(Boolean).length/criteria.length*100):0;
  }

  function mandateCoverage(input){
    if(!boxes.length)return{best:null,strong:0,potential:0};
    const ranked=boxes.map(box=>({box,score:mandateScore(input,box)})).sort((a,b)=>b.score-a.score);
    return{
      best:ranked[0]||null,
      strong:ranked.filter(x=>x.score>=75).length,
      potential:ranked.filter(x=>x.score>=50).length
    };
  }

  function relationshipPoints(value){
    const x=norm(value);
    if(/direct seller engagement|exclusive sell side advisor|direct sponsor ownership relationship/.test(x))return 8;
    if(/authorized intermediary/.test(x))return 6;
    if(/other authorized relationship/.test(x))return 5;
    return 0;
  }

  function narrativeSignals(summary){
    const x=norm(summary);
    const checks=[
      /use of proceeds|proceeds|capital will|funds will|raise will/,
      /ownership|owner|shareholder|sponsor|founder/,
      /rationale|reason|purpose|growth|acquisition|expansion|refinanc/,
      /market|customer|contract|pipeline|asset|portfolio|location/
    ];
    return checks.filter(r=>r.test(x)).length;
  }

  function readiness(input,docCount=0){
    let score=0;
    const wins=[];
    const gaps=[];

    if(input.authority_confirmed){score+=12;wins.push('Seller-side authority confirmed')}else gaps.push('Confirm direct seller-side authority');
    const rp=relationshipPoints(input.seller_relationship);
    score+=rp;
    if(rp>=8)wins.push('Direct or exclusive seller relationship');
    else if(rp>0)wins.push('Authorized seller relationship');
    else gaps.push('Define the seller / sponsor relationship');

    if(Number(input.deal_size)>0){score+=6;wins.push('Capital ask defined')}else gaps.push('Define the exact capital ask');
    if(input.sector)score+=4;else gaps.push('Add sector');
    if(input.geography)score+=4;else gaps.push('Add geography');
    if(input.transaction_type)score+=4;else gaps.push('Select transaction structure');
    if(input.company&&input.title)score+=2;else gaps.push('Complete company and opportunity identification');

    if(Number(input.revenue)>0){score+=7;wins.push('Revenue disclosed')}else gaps.push('Add revenue / scale disclosure');
    if(Number(input.ebitda)>0){score+=7;wins.push('EBITDA disclosed')}else gaps.push('Add EBITDA or operating earnings disclosure');
    if(Number(input.revenue)>0&&Number(input.ebitda)>0&&Number(input.ebitda)<=Number(input.revenue)){score+=6;wins.push('Core economics are internally coherent')}
    else if(Number(input.revenue)>0&&Number(input.ebitda)>Number(input.revenue))gaps.push('Reconcile EBITDA exceeding stated revenue');
    else gaps.push('Complete core financial disclosure');

    const summary=String(input.summary||'').trim();
    if(summary.length>=300){score+=8;wins.push('Institutional-length opportunity narrative')}
    else if(summary.length>=150){score+=6;gaps.push('Expand the opportunity narrative for institutional review')}
    else if(summary.length>=40){score+=3;gaps.push('Add more detail on thesis, rationale and capital use')}
    else gaps.push('Provide a substantive opportunity summary');

    const signals=narrativeSignals(summary);
    const narrativePts=Math.min(7,signals*2);
    score+=narrativePts;
    if(signals>=3)wins.push('Narrative covers key institutional context');
    else gaps.push('Address use of proceeds, ownership/sponsor, and transaction rationale');

    if(docCount>=3){score+=15;wins.push('Diligence package attached')}
    else if(docCount===2){score+=10;gaps.push('Add one more core diligence document')}
    else if(docCount===1){score+=6;gaps.push('Add financials/model and supporting diligence')}
    else gaps.push('Attach CIM/teaser, financials/model, or supporting diligence');

    if(Number(input.deal_size)>=20000000){score+=6;wins.push('$20M+ institutional transaction scale')}
    else if(Number(input.deal_size)>0){score+=2;gaps.push('Current capital ask is below Outerhaven’s $20M core range')}

    const coverage=mandateCoverage(input);
    if(coverage.strong>0){score+=4;wins.push(`${coverage.strong} strong published mandate ${coverage.strong===1?'match':'matches'}`)}
    else if(coverage.potential>0){score+=2;gaps.push('No 75%+ published mandate match yet')}
    else gaps.push('No current published mandate coverage identified');

    score=Math.max(0,Math.min(100,score));
    const tier=score>=90?'Institutional':score>=75?'Qualified':score>=60?'Developing':'Incomplete';
    return{score,tier,wins:[...new Set(wins)],gaps:[...new Set(gaps)],coverage};
  }

  function formInput(){
    return{
      title:$('dealTitle')?.value.trim()||'',
      company:$('dealCompany')?.value.trim()||'',
      deal_size:parseMoney($('dealAmount')?.value),
      revenue:parseMoney($('dealRevenue')?.value),
      ebitda:parseMoney($('dealEbitda')?.value),
      sector:$('dealSector')?.value.trim()||'',
      geography:$('dealGeography')?.value.trim()||'',
      transaction_type:$('dealType')?.value||'',
      seller_relationship:$('sellerRelationship')?.value||'',
      summary:$('dealSummary')?.value.trim()||'',
      authority_confirmed:!!$('authorityConfirmed')?.checked
    };
  }

  function installStyles(){
    if($('outerhavenInstitutionalStyle'))return;
    const style=document.createElement('style');
    style.id='outerhavenInstitutionalStyle';
    style.textContent=`
      .institutionalReadiness{margin-top:18px;padding-top:18px;border-top:1px solid #dfd3c6}
      .institutionalReadinessTop{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}
      .institutionalReadiness h4{margin:3px 0 3px;font-size:16px;color:#211c17}
      .institutionalReadiness p{margin:0;color:#766a60;font-size:10px;line-height:1.5}
      .readinessScore{min-width:66px;text-align:right}.readinessScore strong{display:block;font-size:26px;line-height:1;color:#201a15}.readinessScore span{font-size:8px;text-transform:uppercase;letter-spacing:.08em;color:#8b7c6d;font-weight:850}
      .readinessBar{height:7px;border-radius:999px;background:#e8ded2;overflow:hidden;margin:12px 0}.readinessBar i{display:block;height:100%;background:#2d2924;border-radius:inherit;transition:width .2s ease}
      .readinessGaps{display:grid;gap:6px;margin-top:10px}.readinessGap{display:flex;gap:7px;align-items:flex-start;padding:7px 8px;border-radius:8px;background:#f8f2eb;font-size:9px;color:#675c51}.readinessGap:before{content:'+';font-weight:900;color:#9a7041}
      .readinessGood{font-size:9px;color:#63584e;margin-top:8px}.readinessGood strong{color:#28221d}
      .institutionalStrip{margin-top:11px;padding:10px 11px;border:1px solid #e0d5c8;border-radius:10px;background:#fbf7f1;display:grid;grid-template-columns:1fr auto;gap:7px 10px;align-items:center}
      .institutionalStrip strong{font-size:10px}.institutionalStrip small{display:block;color:#7d7165;font-size:8px;margin-top:2px}.institutionalStrip .instScore{font-size:18px;font-weight:900}.institutionalStrip .instBar{grid-column:1/-1;height:5px;background:#e8dfd5;border-radius:999px;overflow:hidden}.institutionalStrip .instBar i{display:block;height:100%;background:#2d2924}
      .passportBtn{margin-top:8px;border:1px solid #cfc1b1;background:#fffdfa;color:#2d2721;border-radius:8px;padding:7px 10px;font:inherit;font-size:9px;font-weight:850;cursor:pointer}.passportBtn:hover{background:#f3ece3}
      .passportOverlay{position:fixed;inset:0;background:rgba(25,20,16,.55);display:grid;place-items:center;z-index:10000;padding:24px}.passportOverlay.hidden{display:none}
      .passportModal{width:min(920px,96vw);max-height:92vh;overflow:auto;background:#fffdf9;border-radius:18px;box-shadow:0 24px 80px rgba(0,0,0,.25)}
      .passportHead{display:flex;justify-content:space-between;gap:20px;padding:24px 26px;border-bottom:1px solid #e5dbcf}.passportHead h2{margin:4px 0 0;font-size:24px}.passportHead p{margin:5px 0 0;color:#786c60;font-size:10px}.passportClose{border:0;background:#eee5db;width:34px;height:34px;border-radius:50%;font-size:21px;cursor:pointer}
      .passportBody{padding:24px 26px 30px}.passportHero{display:grid;grid-template-columns:1.5fr .6fr .6fr;gap:12px;margin-bottom:16px}.passportHero>div,.passportCell{border:1px solid #e2d7cb;border-radius:12px;padding:13px;background:#fbf7f1}.passportHero span,.passportCell span{display:block;font-size:8px;color:#85776a;text-transform:uppercase;letter-spacing:.07em;font-weight:850}.passportHero strong{display:block;font-size:22px;margin-top:4px}.passportGrid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}.passportCell b{display:block;font-size:12px;margin-top:4px;color:#211c17}.passportSection{margin-top:19px}.passportSection h3{font-size:11px;text-transform:uppercase;letter-spacing:.08em;margin:0 0 9px}.passportNarrative{font-size:11px;line-height:1.65;color:#5f554c;white-space:pre-wrap}.passportGaps{display:grid;grid-template-columns:repeat(2,1fr);gap:7px}.passportGap{padding:9px 10px;background:#f7efe6;border-radius:9px;font-size:9px;color:#65594e}.passportDocs{display:flex;flex-wrap:wrap;gap:6px}.passportDoc{font-size:8px;padding:6px 8px;border:1px solid #dfd2c4;border-radius:999px;background:#fff}
      @media(max-width:760px){.passportHero{grid-template-columns:1fr 1fr}.passportHero>div:first-child{grid-column:1/-1}.passportGrid{grid-template-columns:repeat(2,1fr)}.passportGaps{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function renderLiveReadiness(){
    const panel=document.querySelector('.fitPanel');
    if(!panel)return;
    let block=$('institutionalReadiness');
    if(!block){
      block=document.createElement('section');
      block.id='institutionalReadiness';
      block.className='institutionalReadiness';
      panel.appendChild(block);
    }
    const docCount=document.querySelectorAll('#fileList .fileChip').length;
    const r=readiness(formInput(),docCount);
    const gaps=r.gaps.slice(0,5);
    block.innerHTML=`
      <div class="eyebrow">INSTITUTIONAL READINESS</div>
      <div class="institutionalReadinessTop"><div><h4>${esc(r.tier)} readiness</h4><p>Measures whether the opportunity is sufficiently complete for institutional review.</p></div><div class="readinessScore"><strong>${r.score}%</strong><span>Readiness</span></div></div>
      <div class="readinessBar"><i style="width:${r.score}%"></i></div>
      ${gaps.length?`<div class="readinessGaps">${gaps.map(g=>`<div class="readinessGap">${esc(g)}</div>`).join('')}</div>`:`<div class="readinessGood"><strong>Institutional package is materially complete.</strong> Outerhaven review still determines whether it advances.</div>`}
    `;
  }

  function dealById(id){return deals.find(d=>String(d.id)===String(id))}

  function enhanceSubmissionCards(){
    const root=$('submissionCards');
    if(!root||!deals.length)return;
    root.querySelectorAll('.submissionCard[data-open-deal]').forEach(card=>{
      const d=dealById(card.dataset.openDeal);if(!d)return;
      const docs=docsByDeal.get(String(d.id))||[];
      const r=readiness(d,docs.length);
      let strip=card.querySelector('.institutionalStrip');
      if(!strip){
        strip=document.createElement('div');
        strip.className='institutionalStrip';
        const actions=card.querySelector('.submissionActions');
        if(actions)actions.insertAdjacentElement('beforebegin',strip);else card.firstElementChild?.appendChild(strip);
      }
      strip.innerHTML=`<div><strong>${esc(r.tier)} Institutional Readiness</strong><small>${r.gaps.length?esc(r.gaps[0]):'Core package materially complete'}</small></div><div class="instScore">${r.score}%</div><div class="instBar"><i style="width:${r.score}%"></i></div><button type="button" class="passportBtn" data-passport-deal="${esc(d.id)}">View Deal Passport</button>`;
      strip.querySelector('[data-passport-deal]')?.addEventListener('click',e=>{e.stopPropagation();openPassport(d.id)});
    });
  }

  function ensurePassportModal(){
    if($('passportOverlay'))return;
    const overlay=document.createElement('div');
    overlay.id='passportOverlay';
    overlay.className='passportOverlay hidden';
    overlay.innerHTML='<section class="passportModal" role="dialog" aria-modal="true"><header class="passportHead"><div><div class="eyebrow">OUTERHAVEN DEAL PASSPORT</div><h2 id="passportTitle">Opportunity</h2><p id="passportSub"></p></div><button type="button" id="passportClose" class="passportClose" aria-label="Close">×</button></header><div id="passportBody" class="passportBody"></div></section>';
    document.body.appendChild(overlay);
    $('passportClose').onclick=()=>overlay.classList.add('hidden');
    overlay.onclick=e=>{if(e.target===overlay)overlay.classList.add('hidden')};
  }

  function openPassport(id){
    const d=dealById(id);if(!d)return;
    ensurePassportModal();
    const docs=docsByDeal.get(String(d.id))||[];
    const r=readiness(d,docs.length);
    const coverage=r.coverage;
    $('passportTitle').textContent=d.title||'Opportunity';
    $('passportSub').textContent=`Passport ${String(d.id).slice(0,8).toUpperCase()} · ${cap(d.status)} · ${date(d.created_at)}`;
    $('passportBody').innerHTML=`
      <div class="passportHero">
        <div><span>Company / Sponsor</span><strong>${esc(d.company||'Not specified')}</strong></div>
        <div><span>Institutional Readiness</span><strong>${r.score}%</strong></div>
        <div><span>Mandate Coverage</span><strong>${coverage.strong}</strong><small>${coverage.strong===1?'strong match':'strong matches'}</small></div>
      </div>
      <div class="passportGrid">
        <div class="passportCell"><span>Capital Ask</span><b>${esc(money(d.deal_size))}</b></div>
        <div class="passportCell"><span>Structure</span><b>${esc(d.transaction_type||'Not specified')}</b></div>
        <div class="passportCell"><span>Sector</span><b>${esc(d.sector||'Not specified')}</b></div>
        <div class="passportCell"><span>Geography</span><b>${esc(d.geography||'Not specified')}</b></div>
        <div class="passportCell"><span>Revenue</span><b>${esc(money(d.revenue))}</b></div>
        <div class="passportCell"><span>EBITDA</span><b>${esc(money(d.ebitda))}</b></div>
        <div class="passportCell"><span>Seller Relationship</span><b>${esc(d.seller_relationship||'Not specified')}</b></div>
        <div class="passportCell"><span>Best Published Mandate</span><b>${coverage.best?`${esc(coverage.best.box.title)} · ${coverage.best.score}%`:'No active match'}</b></div>
      </div>
      <section class="passportSection"><h3>Opportunity Summary</h3><div class="passportNarrative">${esc(d.summary||'No summary provided.')}</div></section>
      <section class="passportSection"><h3>Readiness Gaps</h3>${r.gaps.length?`<div class="passportGaps">${r.gaps.map(g=>`<div class="passportGap">${esc(g)}</div>`).join('')}</div>`:'<div class="passportNarrative">No material completeness gaps detected by the readiness screen.</div>'}</section>
      <section class="passportSection"><h3>Supporting Diligence · ${docs.length}</h3>${docs.length?`<div class="passportDocs">${docs.map(f=>`<span class="passportDoc">${esc(f.name.replace(/^[0-9a-f-]{36}-/i,''))}</span>`).join('')}</div>`:'<div class="passportNarrative">No supporting documents detected in the portal data room.</div>'}</section>
      <section class="passportSection"><h3>Screening Position</h3><div class="passportNarrative">${r.tier} readiness. ${coverage.strong?`${coverage.strong} published mandate ${coverage.strong===1?'match scores':'matches score'} 75% or higher.`:'No published mandate currently scores 75% or higher.'} This passport is a standardized screening record and does not constitute investment approval.</div></section>
    `;
    $('passportOverlay').classList.remove('hidden');
  }

  async function loadDocsForDeal(deal){
    try{
      const folder=`${currentUser.id}/${deal.id}`;
      const {data,error}=await sb.storage.from('deal-documents').list(folder,{limit:100,sortBy:{column:'name',order:'asc'}});
      if(error)return[];
      return(data||[]).filter(x=>x.name&&x.id);
    }catch(_){return[]}
  }

  async function refresh(){
    if(refreshing)return;
    refreshing=true;
    try{
      const {data:{session}}=await sb.auth.getSession();
      if(!session)return;
      currentUser=session.user;
      const [dealRes,boxRes]=await Promise.all([
        sb.from('deals').select('*').eq('owner_id',currentUser.id).order('created_at',{ascending:false}),
        sb.from('buy_boxes').select('*').eq('published',true)
      ]);
      if(!dealRes.error)deals=dealRes.data||[];
      if(!boxRes.error)boxes=boxRes.data||[];
      const entries=await Promise.all(deals.slice(0,50).map(async d=>[String(d.id),await loadDocsForDeal(d)]));
      docsByDeal=new Map(entries);
      renderLiveReadiness();
      enhanceSubmissionCards();
    }catch(e){console.error('institutional layer',e)}finally{refreshing=false}
  }

  function install(){
    installStyles();
    ensurePassportModal();
    const form=$('submissionForm');
    if(!form){setTimeout(install,200);return}
    form.addEventListener('input',renderLiveReadiness);
    form.addEventListener('change',()=>setTimeout(renderLiveReadiness,0));
    $('fileList')?.addEventListener('click',()=>setTimeout(renderLiveReadiness,0));
    document.addEventListener('keydown',e=>{if(e.key==='Escape')$('passportOverlay')?.classList.add('hidden')});
    refresh();
    setInterval(()=>{renderLiveReadiness();enhanceSubmissionCards()},1400);
    setInterval(refresh,45000);
  }

  install();
})();