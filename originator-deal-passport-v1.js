(function(){
  if(window.__outerhavenDealPassportV1)return;
  window.__outerhavenDealPassportV1=true;

  const sb=window.__OUTERHAVEN_ORIGINATOR_SB;
  if(!sb)return;

  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  const norm=v=>String(v||'').trim().toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  const cap=v=>String(v||'').replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
  const date=v=>v?new Date(v).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'}):'—';
  function money(v){
    const n=Number(v||0);
    if(!n)return'Not provided';
    if(n>=1e9)return'$'+(n/1e9).toFixed(n%1e9?1:0)+'B';
    if(n>=1e6)return'$'+(n/1e6).toFixed(n%1e6?1:0)+'M';
    if(n>=1e3)return'$'+(n/1e3).toFixed(n%1e3?1:0)+'K';
    return'$'+n.toLocaleString();
  }
  function textMatch(input,criterion,globalWords=[]){
    const a=norm(input),b=norm(criterion);
    if(!b)return true;
    if(globalWords.some(w=>b.includes(w)))return true;
    if(!a)return false;
    return a.includes(b)||b.includes(a)||a.split(' ').some(x=>x.length>3&&b.includes(x));
  }
  function scoreBox(input,box){
    const criteria=[];
    const amount=Number(input.deal_size||0);
    if(box.min_size||box.max_size)criteria.push((!box.min_size||amount>=Number(box.min_size))&&(!box.max_size||amount<=Number(box.max_size)));
    criteria.push(textMatch(input.sector,box.sector,['agnostic','all sectors','sector agnostic']));
    criteria.push(textMatch(input.geography,box.geography,['global','worldwide','all geographies']));
    criteria.push(textMatch(input.transaction_type,box.transaction_type,['flexible','all structures','multiple structures']));
    if(box.min_ebitda)criteria.push(Number(input.ebitda||0)>=Number(box.min_ebitda));
    return criteria.length?Math.round(criteria.filter(Boolean).length/criteria.length*100):0;
  }
  function bestFit(d){
    if(!buyBoxes.length)return null;
    return buyBoxes.map(box=>({box,score:scoreBox(d,box)})).sort((a,b)=>b.score-a.score)[0]||null;
  }

  const style=document.createElement('style');
  style.textContent=`
  #submissionCards{display:grid;gap:16px}
  #submissionCards .submissionCard.dealPassportCard{display:block!important;padding:0!important;overflow:hidden;border:1px solid #dfe4ea;border-radius:16px;background:#fff;box-shadow:0 8px 24px rgba(18,28,45,.045);transition:transform .16s ease,box-shadow .16s ease,border-color .16s ease}
  #submissionCards .submissionCard.dealPassportCard:hover{transform:translateY(-1px);border-color:#cfd7e1;box-shadow:0 12px 30px rgba(18,28,45,.07)}
  .dealPassportHead{display:flex;justify-content:space-between;gap:18px;align-items:flex-start;padding:20px 22px 16px}
  .dealPassportTitle{min-width:0}
  .dealPassportTitle h3{margin:0;font-size:18px;line-height:1.2;letter-spacing:-.02em;color:#141922}
  .dealPassportTitle p{margin:6px 0 0;font-size:10px;color:#788392;font-weight:700}
  .dealPassportKpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));background:#131923;color:#fff;border-top:1px solid #131923;border-bottom:1px solid #131923}
  .dealPassportKpi{padding:15px 18px;border-right:1px solid rgba(255,255,255,.1);min-width:0}
  .dealPassportKpi:last-child{border-right:0}
  .dealPassportKpi span{display:block;font-size:8px;letter-spacing:.09em;text-transform:uppercase;color:#929cab;font-weight:900}
  .dealPassportKpi strong{display:block;margin-top:5px;font-size:17px;line-height:1.15;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .dealPassportKpi.fit strong{color:#d7e6ff}
  .dealPassportTraits{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));padding:15px 22px;gap:10px;border-bottom:1px solid #e9edf2;background:#fbfcfd}
  .dealPassportTrait{min-width:0;padding-right:10px;border-right:1px solid #e4e8ed}
  .dealPassportTrait:last-child{border-right:0;padding-right:0}
  .dealPassportTrait span{display:block;font-size:8px;letter-spacing:.06em;text-transform:uppercase;color:#8a94a2;font-weight:900}
  .dealPassportTrait b{display:block;margin-top:4px;font-size:10px;color:#28313d;line-height:1.35;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .dealPassportFooter{display:flex;justify-content:space-between;gap:14px;align-items:center;padding:14px 22px}
  .dealPassportFootMeta{display:flex;align-items:center;gap:10px;flex-wrap:wrap;font-size:9px;color:#7d8794}
  .dealPassportActions{display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:flex-end}
  .dealPassportOpen{border:0;border-radius:9px;background:#151a22;color:#fff;padding:9px 13px;font-size:9px;font-weight:900;letter-spacing:.01em;cursor:pointer;position:relative;z-index:2}
  .dealPassportOpen:hover{background:#242b36}
  .dealPassportManage{display:flex;align-items:center;gap:7px;position:relative;z-index:2}
  .dealPassportAuthority{display:inline-flex;align-items:center;gap:5px;font-weight:800;color:#536170}
  .dealPassportAuthority:before{content:'✓';display:inline-grid;place-items:center;width:14px;height:14px;border-radius:50%;background:#eef7f1;color:#297345;font-size:8px}
  .dealModalHead .eyebrow[data-passport-label='1']{letter-spacing:.13em}
  @media(max-width:900px){.dealPassportKpis,.dealPassportTraits{grid-template-columns:repeat(2,minmax(0,1fr))}.dealPassportKpi:nth-child(2){border-right:0}.dealPassportKpi:nth-child(-n+2){border-bottom:1px solid rgba(255,255,255,.1)}.dealPassportTrait:nth-child(2){border-right:0}.dealPassportTrait:nth-child(-n+2){padding-bottom:10px;border-bottom:1px solid #e4e8ed}.dealPassportFooter{align-items:flex-start;flex-direction:column}.dealPassportActions{width:100%;justify-content:flex-start}}
  @media(max-width:560px){.dealPassportHead{padding:17px}.dealPassportKpis,.dealPassportTraits{grid-template-columns:1fr 1fr}.dealPassportKpi{padding:13px}.dealPassportTraits{padding:13px 17px}.dealPassportFooter{padding:13px 17px}.dealPassportKpi strong{font-size:15px}}
  `;
  document.head.appendChild(style);

  let deals=[],buyBoxes=[],refreshing=false,applyTimer=null,lastLoad=0;

  async function refresh(){
    if(refreshing)return;
    refreshing=true;
    try{
      const {data:{session}}=await sb.auth.getSession();
      if(!session)return;
      const [d,b]=await Promise.all([
        sb.from('deals').select('*').eq('owner_id',session.user.id).order('created_at',{ascending:false}),
        sb.from('buy_boxes').select('*').eq('published',true).order('created_at',{ascending:false})
      ]);
      if(d.error||b.error){console.error('deal passport',d.error||b.error);return}
      deals=d.data||[];buyBoxes=b.data||[];lastLoad=Date.now();apply();
    }finally{refreshing=false}
  }

  function kpi(label,value,extra=''){
    return `<div class="dealPassportKpi ${extra}"><span>${esc(label)}</span><strong title="${esc(value)}">${esc(value)}</strong></div>`;
  }
  function trait(label,value){
    return `<div class="dealPassportTrait"><span>${esc(label)}</span><b title="${esc(value||'Not provided')}">${esc(value||'Not provided')}</b></div>`;
  }

  function transformCard(card,d){
    if(!card||!d||card.dataset.dealPassportV1==='1')return;
    if(typeof card.onclick!=='function'){setTimeout(scheduleApply,30);return}

    const originalOpen=card.onclick;
    const oldEdit=card.querySelector('[data-edit-deal]');
    const oldWithdraw=card.querySelector('[data-withdraw-deal]');
    const editHandler=typeof oldEdit?.onclick==='function'?oldEdit.onclick:null;
    const withdrawHandler=typeof oldWithdraw?.onclick==='function'?oldWithdraw.onclick:null;

    card.dataset.dealPassportV1='1';
    card.classList.add('dealPassportCard');

    const fit=bestFit(d);
    const fitValue=fit?`${fit.score}%`:'—';
    const fitTitle=fit?.box?.title||'No published mandate';
    const canEdit=!!editHandler;
    const canWithdraw=!!withdrawHandler;

    card.innerHTML=`
      <div class="dealPassportHead">
        <div class="dealPassportTitle"><h3>${esc(d.title)}</h3><p>${esc(d.company||'Company not specified')}</p></div>
        <span class="statusPill ${esc(d.status)}">${esc(cap(d.status))}</span>
      </div>
      <div class="dealPassportKpis">
        ${kpi('Capital Ask',money(d.deal_size))}
        ${kpi('Revenue',money(d.revenue))}
        ${kpi('EBITDA',money(d.ebitda))}
        ${kpi('Best Mandate Fit',fitValue,'fit')}
      </div>
      <div class="dealPassportTraits">
        ${trait('Sector',d.sector)}
        ${trait('Geography',d.geography)}
        ${trait('Structure',d.transaction_type)}
        ${trait('Seller Relationship',d.seller_relationship)}
      </div>
      <div class="dealPassportFooter">
        <div class="dealPassportFootMeta"><span>Submitted ${esc(date(d.created_at))}</span><span>•</span><span title="${esc(fitTitle)}">${fit?`Best fit: ${esc(fitTitle)}`:'No published mandate fit'}</span>${d.authority_confirmed?'<span class="dealPassportAuthority">Authority confirmed</span>':''}</div>
        <div class="dealPassportActions"><div class="dealPassportManage">${canEdit?`<button type="button" class="miniBtn" data-passport-edit="${esc(d.id)}">Edit & Resubmit</button>`:''}${canWithdraw?`<button type="button" class="miniBtn danger" data-passport-withdraw="${esc(d.id)}">Withdraw</button>`:''}</div><button type="button" class="dealPassportOpen" data-passport-open="${esc(d.id)}">Deal Passport →</button></div>
      </div>`;

    const openBtn=card.querySelector('[data-passport-open]');
    if(openBtn)openBtn.onclick=e=>{
      e.preventDefault();e.stopPropagation();
      originalOpen({target:card});
    };
    const editBtn=card.querySelector('[data-passport-edit]');
    if(editBtn&&editHandler)editBtn.onclick=e=>{
      e.preventDefault();e.stopPropagation();
      editHandler.call(oldEdit,e);
    };
    const withdrawBtn=card.querySelector('[data-passport-withdraw]');
    if(withdrawBtn&&withdrawHandler)withdrawBtn.onclick=e=>{
      e.preventDefault();e.stopPropagation();
      withdrawHandler.call(oldWithdraw,e);
    };
  }

  function applyModalLabel(){
    const eyebrow=document.querySelector('.dealModalHead .eyebrow');
    if(eyebrow){eyebrow.textContent='DEAL PASSPORT';eyebrow.dataset.passportLabel='1'}
  }

  function apply(){
    applyModalLabel();
    const root=document.getElementById('submissionCards');
    if(!root)return;
    const map=new Map(deals.map(d=>[String(d.id),d]));
    root.querySelectorAll('.submissionCard[data-open-deal]').forEach(card=>transformCard(card,map.get(String(card.dataset.openDeal))));
  }

  function scheduleApply(){
    clearTimeout(applyTimer);
    applyTimer=setTimeout(()=>{
      const root=document.getElementById('submissionCards');
      const needsData=root&&[...root.querySelectorAll('.submissionCard[data-open-deal]')].some(c=>!deals.some(d=>String(d.id)===String(c.dataset.openDeal)));
      if(needsData||Date.now()-lastLoad>45000)refresh();else apply();
    },45);
  }

  function install(){
    const root=document.getElementById('submissionCards');
    if(root)new MutationObserver(scheduleApply).observe(root,{childList:true,subtree:true});
    const modal=document.getElementById('dealModalOverlay');
    if(modal)new MutationObserver(applyModalLabel).observe(modal,{attributes:true,subtree:true,childList:true});
    refresh();
    setInterval(refresh,45000);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
