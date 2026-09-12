(function(){
  if(window.__outerhavenInvestorSuiteV6)return;window.__outerhavenInvestorSuiteV6=true;
  const sb=window.__OUTERHAVEN_ORIGINATOR_SB;if(!sb)return;
  const $=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  const norm=v=>String(v||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  let state={user:null,deal:null,workspace:null,docs:[]},busy=false;

  const fields=[
    ['investment_thesis','Investment thesis','Why should an investor care about this opportunity?'],
    ['use_of_proceeds','Use of proceeds','Exactly where will the capital go?'],
    ['transaction_rationale','Transaction rationale','Why is the transaction happening now?'],
    ['ownership','Ownership / capitalization','Current owners, percentages, sponsor/GP/LP structure, existing equity.'],
    ['existing_debt','Existing debt','Lenders, balances, rates, maturities, security and other obligations.'],
    ['valuation','Valuation / pricing','Purchase price, valuation, asking price, cap rate or relevant pricing framework.'],
    ['historical_performance','Historical performance','Key historical revenue, EBITDA, NOI, growth or operating performance.'],
    ['forecast','Forecast / business plan','Forward revenue, EBITDA, NOI, occupancy, growth, stabilization or operating plan.'],
    ['market_position','Market / competitive position','Market size, scarcity, competitive position, customers or demand drivers.'],
    ['risks','Key risks','The material risks an investor should understand.'],
    ['mitigants','Risk mitigants','What specifically reduces or offsets those risks?'],
    ['exit_strategy','Exit / repayment strategy','Expected exit, refinance, sale, recap or repayment path.'],
    ['timeline','Transaction timeline','Key dates, closing target, development/stabilization timeline and milestones.'],
    ['sponsor_equity','Sponsor equity / skin in the game','Capital already invested and additional sponsor contribution.'],
    ['asset_value','Asset value / purchase price','For asset-backed or real-estate deals, current value or purchase price.'],
    ['noi','NOI / property cash flow','Current and stabilized NOI or equivalent asset cash flow.'],
    ['operating_metrics','Operating metrics','Occupancy, ADR, RevPAR, utilization, units, customers or other key KPIs.']
  ];
  const assetDefs=[
    ['teaser','Investor Teaser','01 Investment Materials'],['memo','Investment Memorandum','01 Investment Materials'],['faq','Investor FAQ','01 Investment Materials'],
    ['transaction','Transaction Overview','02 Transaction'],['sources','Sources & Uses / Capital Structure','02 Transaction'],['ownership','Ownership & Capitalization','02 Transaction'],
    ['financial','Financial Overview','03 Financial'],['risks','Risk & Mitigants','04 Diligence'],['diligence_index','Data Room Index','04 Diligence'],['checklist','Source Material Checklist','04 Diligence']
  ];

  function styles(){if($('investorSuiteV6Style'))return;const s=document.createElement('style');s.id='investorSuiteV6Style';s.textContent=`
    #capitalMetrics{display:none!important}.is6{margin:0 0 16px}.is6Readiness{display:grid;grid-template-columns:210px 1fr;gap:18px;padding:20px;border:1px solid #ddd3c8;border-radius:16px;background:#fff}.is6RingWrap{display:grid;place-items:center}.is6Ring{--score:0;width:156px;height:156px;border-radius:50%;display:grid;place-items:center;background:conic-gradient(#25201b calc(var(--score)*1%),#ece7e1 0);position:relative}.is6Ring:after{content:'';position:absolute;inset:13px;background:#fff;border-radius:50%}.is6RingCenter{position:relative;z-index:1;text-align:center}.is6RingCenter strong{display:block;font:750 34px/1 "Helvetica Neue",Arial,sans-serif;color:#211d19}.is6RingCenter span{display:block;margin-top:5px;font:800 7px/1 Arial,sans-serif;letter-spacing:.1em;text-transform:uppercase;color:#887968}.is6Readiness h3{margin:2px 0 7px;font:650 20px/1.15 "Helvetica Neue",Arial,sans-serif;color:#241f1b}.is6Readiness p{margin:0;font:10px/1.55 Arial,sans-serif;color:#71655a}.is6Break{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:15px 0}.is6Break div{padding:10px 11px;border:1px solid #e5ddd4;border-radius:10px;background:#fbfaf8}.is6Break span{display:block;font:800 6.7px Arial,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:#887a6b}.is6Break strong{display:block;margin-top:4px;font:700 15px Arial,sans-serif}.is6Actions{display:flex;gap:8px;flex-wrap:wrap}.is6Btn{border:1px solid #cfc3b5;border-radius:9px;padding:9px 11px;background:#fff;color:#29231e;font:800 9px Arial,sans-serif;cursor:pointer}.is6Btn.primary{background:#211d19;border-color:#211d19;color:#fff}.is6Builder{margin:16px 0;border:1px solid #ddd3c8;border-radius:16px;background:#fff;overflow:hidden}.is6BuilderHead{display:flex;justify-content:space-between;gap:18px;align-items:center;padding:18px 20px;background:#f8f5f0}.is6BuilderHead h3{margin:3px 0 4px;font:650 18px/1.15 "Helvetica Neue",Arial,sans-serif}.is6BuilderHead p{margin:0;font:9.5px/1.5 Arial,sans-serif;color:#706459}.is6BuilderBody{padding:18px 20px}.is6BuilderBody.hidden{display:none}.is6Form{display:grid;grid-template-columns:1fr 1fr;gap:10px}.is6Field{display:grid;gap:5px}.is6Field.wide{grid-column:1/-1}.is6Field label{font:800 7px Arial,sans-serif;letter-spacing:.07em;text-transform:uppercase;color:#75685c}.is6Field textarea{min-height:82px;resize:vertical;border:1px solid #d8cec3;border-radius:9px;padding:10px 11px;font:10px/1.5 Arial,sans-serif;color:#332d28;background:#fff}.is6Field textarea:focus{outline:2px solid #d6c2a8;outline-offset:1px}.is6BuilderFooter{display:flex;justify-content:space-between;gap:12px;align-items:center;margin-top:14px;padding-top:14px;border-top:1px solid #eee7df}.is6BuilderFooter span{font:8.5px/1.45 Arial,sans-serif;color:#7c7065}.is6Room{margin-top:16px}.is6RoomTop{display:flex;justify-content:space-between;align-items:end;gap:12px;margin-bottom:10px}.is6RoomTop h3{margin:0;font:650 16px "Helvetica Neue",Arial,sans-serif}.is6RoomTop span{font:8px Arial,sans-serif;color:#7a6d61}.is6Folder{margin:10px 0;padding:12px;border:1px solid #e3dacf;border-radius:11px;background:#fcfbf9}.is6FolderTitle{font:800 7px Arial,sans-serif;letter-spacing:.09em;text-transform:uppercase;color:#8a755d;margin-bottom:8px}.is6Assets{display:grid;grid-template-columns:repeat(2,1fr);gap:7px}.is6Asset{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:9px 10px;border:1px solid #e7e0d8;border-radius:8px;background:#fff}.is6Asset strong{font:650 9.5px Arial,sans-serif;color:#302923}.is6Asset small{display:block;margin-top:2px;font:7.5px Arial,sans-serif;color:#8a7c6e}.is6Asset button{border:0;border-radius:7px;padding:7px 8px;background:#eee7de;color:#2e2822;font:800 7.5px Arial,sans-serif;cursor:pointer}.is6Asset.ready button{background:#211d19;color:#fff}.is6InternalNote{margin:10px 0 0;padding:10px 11px;border-radius:9px;background:#f4eee6;font:8.5px/1.5 Arial,sans-serif;color:#66594d}.capitalProduct[data-internal='1']{border-style:dashed}.capitalProduct[data-internal='1'] .capitalProductTag{background:#2a2520;color:#fff}@media(max-width:850px){.is6Readiness{grid-template-columns:1fr}.is6Break{grid-template-columns:1fr 1fr}.is6Form,.is6Assets{grid-template-columns:1fr}}`;
    document.head.appendChild(s)}

  function currentDealId(){return $('capitalDealSelect')?.value||''}
  async function loadState(){
    const id=currentDealId();if(!id)return null;
    const {data:{session}}=await sb.auth.getSession();if(!session)return null;
    const [dr,wr]=await Promise.all([
      sb.from('deals').select('*').eq('id',id).maybeSingle(),
      sb.from('deal_workspaces').select('*').eq('deal_id',id).maybeSingle()
    ]);
    if(dr.error)throw dr.error;if(wr.error)throw wr.error;
    const ls=await sb.storage.from('deal-documents').list(`${session.user.id}/${id}`,{limit:100});
    state={user:session.user,deal:dr.data,workspace:wr.data,docs:ls.error?[]:(ls.data||[]).filter(x=>x.name&&x.id)};return state;
  }
  function intake(){return state.workspace?.intake||{}}
  function generated(){return state.workspace?.generated_assets||{}}
  function filled(v){return String(v||'').trim().length>=8}
  function docSignals(){const n=state.docs.map(x=>norm(x.name)).join(' ');return[/cim|memorandum|teaser|deck|one pager/.test(n),/financial|model|forecast|budget|statement/.test(n),/cap table|ownership|org chart|corporate/.test(n),/qoe|quality of earnings|audit/.test(n)]}
  function score(){
    const d=state.deal||{},i=intake(),g=generated();let structured=0,source=0,outputs=0;
    if(d.title&&d.company)structured+=4;if(Number(d.deal_size)>0)structured+=4;if(d.sector&&d.geography&&d.transaction_type)structured+=6;if(d.seller_relationship)structured+=3;if(d.authority_confirmed)structured+=3;if(String(d.summary||'').length>=220)structured+=5;
    const core=['investment_thesis','use_of_proceeds','transaction_rationale','ownership','existing_debt','valuation','historical_performance','forecast','market_position','risks','mitigants','exit_strategy','timeline','sponsor_equity'];
    structured+=Math.round(core.filter(k=>filled(i[k])).length/core.length*10);
    if(Number(d.revenue)>0||filled(i.historical_performance))source+=5;if(Number(d.ebitda)>0||filled(i.noi)||filled(i.forecast))source+=5;source+=docSignals().filter(Boolean).length*3;source+=Math.min(3,state.docs.length);
    const required=assetDefs.map(x=>x[0]);outputs=Math.round(required.filter(k=>g[k]?.ready).length/required.length*40);
    const total=Math.min(100,structured+source+outputs);return{total,structured:Math.min(35,structured),source:Math.min(25,source),outputs};
  }
  function assetStatus(){const d=state.deal||{},i=intake();return{
    teaser:!!(d.deal_size&&d.sector&&d.geography&&(filled(i.investment_thesis)||String(d.summary||'').length>120)),
    memo:!!(filled(i.investment_thesis)&&filled(i.transaction_rationale)&&filled(i.use_of_proceeds)&&filled(i.risks)),
    faq:!!(filled(i.investment_thesis)&&filled(i.use_of_proceeds)&&filled(i.timeline)),
    transaction:!!(d.deal_size&&d.transaction_type&&filled(i.transaction_rationale)),
    sources:!!(d.deal_size&&filled(i.use_of_proceeds)),
    ownership:!!filled(i.ownership),
    financial:!!(Number(d.revenue)>0||Number(d.ebitda)>0||filled(i.historical_performance)||filled(i.forecast)||filled(i.noi)),
    risks:!!(filled(i.risks)&&filled(i.mitigants)),
    diligence_index:true,checklist:true
  }}
  async function saveWorkspace(build=false){
    if(!state.user||!state.deal)return;
    const data={};document.querySelectorAll('[data-is6-field]').forEach(el=>data[el.dataset.is6Field]=el.value.trim());
    let assets=generated();if(build){const s=assetStatus();assets={};Object.keys(s).forEach(k=>assets[k]={ready:!!s[k],updated_at:new Date().toISOString()})}
    const payload={deal_id:state.deal.id,owner_id:state.user.id,intake:data,generated_assets:assets,updated_at:new Date().toISOString()};
    const {error}=await sb.from('deal_workspaces').upsert(payload,{onConflict:'deal_id'});if(error)throw error;
    await refresh();
  }
  function folderHtml(){const g=generated(),groups={};assetDefs.forEach(([k,n,f])=>(groups[f]||(groups[f]=[])).push([k,n]));return Object.entries(groups).map(([folder,items])=>`<div class="is6Folder"><div class="is6FolderTitle">${esc(folder)}</div><div class="is6Assets">${items.map(([k,n])=>{const ready=!!g[k]?.ready;return`<div class="is6Asset ${ready?'ready':''}"><div><strong>${esc(n)}</strong><small>${ready?'Generated from current workspace':'Needs more information'}</small></div><button type="button" data-is6-asset="${k}" ${ready?'':'disabled'}>${ready?'Open':'Incomplete'}</button></div>`}).join('')}</div></div>`).join('')}
  function render(){
    const host=$('capitalMetrics');if(!host||!state.deal)return;let wrap=$('investorSuiteV6');if(!wrap){wrap=document.createElement('div');wrap.id='investorSuiteV6';wrap.className='is6';host.parentNode.insertBefore(wrap,host)}
    const s=score(),i=intake();wrap.innerHTML=`<section class="is6Readiness"><div class="is6RingWrap"><div class="is6Ring" style="--score:${s.total}"><div class="is6RingCenter"><strong>${s.total}%</strong><span>Capital Readiness</span></div></div></div><div><div class="eyebrow">READINESS ENGINE</div><h3>${s.total===100?'100% ready inside the workspace':`${100-s.total} points remain to reach 100%`}</h3><p>Readiness increases when the deal is structured, source information is supplied, and the software builds the investor data room. Internal mandate fit is not part of this score.</p><div class="is6Break"><div><span>Structured Data</span><strong>${s.structured}/35</strong></div><div><span>Source Material</span><strong>${s.source}/25</strong></div><div><span>Generated Data Room</span><strong>${s.outputs}/40</strong></div></div><div class="is6Actions"><button type="button" class="is6Btn primary" data-is6-open>Get to 100%</button><button type="button" class="is6Btn" data-is6-build>Build / Refresh Data Room</button></div></div></section>
    <section class="is6Builder"><div class="is6BuilderHead"><div><div class="eyebrow">DATA ROOM BUILDER</div><h3>Give the software the missing deal context once.</h3><p>These answers feed the teaser, investment memo, transaction overview, financial overview, FAQ, risk memo and diligence index.</p></div><button type="button" class="is6Btn" data-is6-toggle>${$('is6BuilderBody')?.classList.contains('hidden')?'Open Builder':'Collapse'}</button></div><div id="is6BuilderBody" class="is6BuilderBody hidden"><div class="is6Form">${fields.map(([k,l,p],idx)=>`<div class="is6Field ${idx<4?'wide':''}"><label>${esc(l)}</label><textarea data-is6-field="${k}" placeholder="${esc(p)}">${esc(i[k]||'')}</textarea></div>`).join('')}</div><div class="is6BuilderFooter"><span>The software uses only submitted information. It will not invent financials, ownership, authority or transaction facts.</span><div><button type="button" class="is6Btn" data-is6-save>Save Answers</button> <button type="button" class="is6Btn primary" data-is6-build>Build Data Room</button></div></div></div></section>
    <section class="is6Room"><div class="is6RoomTop"><div><div class="eyebrow">GENERATED DATA ROOM</div><h3>Investor materials and diligence workspace</h3></div><span>${Object.values(generated()).filter(x=>x?.ready).length}/${assetDefs.length} generated</span></div>${folderHtml()}<div class="is6InternalNote"><strong>Internal intelligence stays internal.</strong> Mandate matching and buyer-targeting logic remain in the Investor Suite and are never inserted into the teaser, investment memo, FAQ, or other investor-facing data-room documents.</div></section>`;
    patchBase();
  }
  function patchBase(){
    document.querySelector('.navBtn[data-section="capital"] span')?.replaceChildren(document.createTextNode('Investor Suite'));
    const sec=$('capitalSection');if(sec){const hero=sec.querySelector('.capitalHeroCard');if(hero){const e=hero.querySelector('.eyebrow');if(e)e.textContent='OUTERHAVEN INVESTOR SUITE';const h=hero.querySelector('h2');if(h)h.textContent='Build a capital-ready deal and complete investor data room.';const p=hero.querySelector('p');if(p)p.textContent='Move from raw opportunity to structured data room, investor materials, diligence preparation and internal capital strategy in one workspace.'}}
    document.querySelectorAll('#capitalProducts .capitalProduct').forEach(card=>{const h=card.querySelector('h3');if(!h)return;if(h.textContent.trim()==='Institutional Package')h.textContent='Investor Teaser';if(/Mandate Strategy/i.test(h.textContent)){card.dataset.internal='1';const tag=card.querySelector('.capitalProductTag');if(tag)tag.textContent='INTERNAL ONLY';const p=card.querySelector('p');if(p)p.textContent='Internal buyer-targeting intelligence. This never appears in investor-facing documents.'}})
  }
  async function refresh(){if(busy)return;busy=true;try{if(await loadState())render()}catch(e){console.error('investor suite v6',e)}finally{busy=false}}
  function openBuilder(){const b=$('is6BuilderBody');if(b)b.classList.remove('hidden');b?.scrollIntoView({behavior:'smooth',block:'start'})}
  function init(){styles();if(!$('capitalDealSelect')||!$('capitalProducts')){setTimeout(init,250);return}refresh();$('capitalDealSelect').addEventListener('change',()=>setTimeout(refresh,120));$('capitalRefresh')?.addEventListener('click',()=>setTimeout(refresh,200));setTimeout(patchBase,500)}
  document.addEventListener('click',async e=>{
    const t=e.target.closest('[data-is6-toggle]');if(t){const b=$('is6BuilderBody');b?.classList.toggle('hidden');t.textContent=b?.classList.contains('hidden')?'Open Builder':'Collapse';return}
    if(e.target.closest('[data-is6-open]')){openBuilder();return}
    const save=e.target.closest('[data-is6-save]');if(save){save.disabled=true;try{await saveWorkspace(false)}catch(err){alert(err.message)}finally{save.disabled=false}return}
    const build=e.target.closest('[data-is6-build]');if(build){build.disabled=true;try{await saveWorkspace(true);openBuilder()}catch(err){alert(err.message)}finally{build.disabled=false}return}
    const asset=e.target.closest('[data-is6-asset]');if(asset&&!asset.disabled){e.preventDefault();window.OuterHavenCapitalDocsV6?.renderAsset(asset.dataset.is6Asset);return}
    if(e.target.closest('.navBtn[data-section="capital"]'))setTimeout(refresh,180)
  },true);
  window.OuterHavenInvestorSuiteV6={refresh,openBuilder,getState:()=>state};
  init();
})();