(function(){
  if(window.__outerhavenInvestorSuiteV9Core)return;window.__outerhavenInvestorSuiteV9Core=true;
  const sb=window.__OUTERHAVEN_ORIGINATOR_SB;if(!sb)return;
  const $=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  const norm=v=>String(v||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  const filled=v=>String(v||'').trim().length>=8;
  const money=v=>{const n=Number(v||0);if(!n)return'';if(n>=1e9)return'$'+(n/1e9).toFixed(n%1e9?1:0)+'B';if(n>=1e6)return'$'+(n/1e6).toFixed(n%1e6?1:0)+'M';if(n>=1e3)return'$'+(n/1e3).toFixed(n%1e3?1:0)+'K';return'$'+n.toLocaleString()};
  let state={user:null,deal:null,workspace:null,docs:[],effective:{},derived:{}};let loading=false;

  const defs={
    investment_thesis:{label:'Investment thesis',prompt:'What is the core investment case and why should an investor care?'},
    use_of_proceeds:{label:'Capital objective / use of proceeds',prompt:'What exactly will the capital fund, acquire, refinance or support?'},
    transaction_rationale:{label:'Why this transaction is happening now',prompt:'Why is the seller, sponsor or company pursuing this transaction now?'},
    ownership:{label:'Ownership & capitalization',prompt:'Who owns the business or asset today, and what does the current capitalization look like?'},
    existing_debt:{label:'Existing debt',prompt:'List current lenders, balances, rates, maturities, security and material obligations.'},
    valuation:{label:'Valuation / pricing',prompt:'What valuation, purchase price, asking price, cap rate or pricing framework applies?'},
    historical_performance:{label:'Historical performance',prompt:'Summarize the historical revenue, EBITDA, NOI, growth and other relevant performance.'},
    forecast:{label:'Forecast / business plan',prompt:'What does management or the sponsor expect over the next several years, and what assumptions drive it?'},
    market_position:{label:'Market & competitive position',prompt:'What makes this opportunity differentiated, defensible or attractive in its market?'},
    risks:{label:'Key risks',prompt:'What are the material risks an investor should understand before underwriting the opportunity?'},
    mitigants:{label:'Risk mitigants',prompt:'What specifically reduces, offsets or controls the key risks?'},
    exit_strategy:{label:'Exit / repayment strategy',prompt:'How is investor capital expected to be repaid, refinanced, sold or otherwise exited?'},
    timeline:{label:'Transaction timeline',prompt:'What are the key milestones and target timing through close, development or stabilization?'},
    sponsor_equity:{label:'Sponsor equity / skin in the game',prompt:'How much capital has the sponsor already invested and how much additional equity will be contributed?'},
    asset_value:{label:'Asset value / purchase price',prompt:'What is the current asset value, purchase price or appraised value?'},
    noi:{label:'NOI / property cash flow',prompt:'Provide current and stabilized NOI or equivalent property cash flow.'},
    operating_metrics:{label:'Property operating metrics',prompt:'Provide occupancy, ADR, RevPAR, unit/key count, utilization and other underwriting KPIs.'}
  };
  const allAssets=[['teaser','Investor Teaser','01 Investment Materials'],['memo','Investment Memorandum','01 Investment Materials'],['faq','Investor FAQ','01 Investment Materials'],['transaction','Transaction Overview','02 Transaction'],['sources','Sources & Uses / Capital Structure','02 Transaction'],['ownership','Ownership & Capitalization','02 Transaction'],['financial','Financial Overview','03 Financial'],['risks','Risk & Mitigants','04 Diligence'],['diligence_index','Data Room Index','04 Diligence'],['checklist','Source Material Checklist','04 Diligence']];

  function styles(){if($('investorSuiteV9Style'))return;const s=document.createElement('style');s.id='investorSuiteV9Style';s.textContent=`
    #investorSuiteV6>.is6Readiness,#investorSuiteV6>.is6Builder,#investorSuiteV6>.is6Room,#investorReadinessV7,#investorReadinessV8Stable,#iv7ValueStrip,#dfyValuePanel,#capitalMetrics{display:none!important}
    .v9Core{margin:0 0 18px}.v9Readiness{display:grid;grid-template-columns:220px 1fr;gap:22px;padding:22px;border:1px solid #d9cfc4;border-radius:17px;background:#fff}.v9Gauge{display:grid;place-items:center}.v9Ring{--p:0;width:170px;height:170px;border-radius:50%;display:grid;place-items:center;position:relative;background:conic-gradient(#245b43 calc(var(--p)*1%),#ebe6df 0)}.v9Ring:after{content:'';position:absolute;inset:14px;border-radius:50%;background:#fff}.v9Center{position:relative;z-index:1;text-align:center}.v9Center strong{display:block;font:760 38px/1 "Helvetica Neue",Arial,sans-serif;letter-spacing:-.045em;color:#201d19}.v9Center span{display:block;margin-top:6px;font:800 7px/1 Arial,sans-serif;letter-spacing:.11em;text-transform:uppercase;color:#827466}.v9Copy h3{margin:3px 0 7px;font:650 22px/1.16 "Helvetica Neue",Arial,sans-serif;color:#24201c}.v9Copy p{margin:0;font:10px/1.6 Arial,sans-serif;color:#6f6359}.v9Scores{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:16px 0}.v9Score{padding:11px 12px;border:1px solid #e3dbd2;border-radius:10px;background:#faf9f7}.v9Score span{display:block;font:800 6.8px Arial,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:#87796b}.v9Score strong{display:block;margin-top:4px;font:700 16px Arial,sans-serif}.v9Track{height:5px;margin-top:8px;border-radius:99px;overflow:hidden;background:#ebe5de}.v9Track i{display:block;height:100%;background:#494039;border-radius:99px}.v9Next{padding:10px 11px;border-radius:9px;background:#f4eee6;font:8.8px/1.5 Arial,sans-serif;color:#62564b}.v9Next strong{color:#2a241f}
    .v9Builder{margin-top:14px;border:1px solid #d9cfc4;border-radius:17px;background:#fff;overflow:hidden}.v9BuilderHead{display:flex;justify-content:space-between;gap:18px;align-items:center;padding:18px 20px;background:#f8f5f0}.v9BuilderHead h3{margin:3px 0 4px;font:650 19px/1.16 "Helvetica Neue",Arial,sans-serif}.v9BuilderHead p{margin:0;max-width:760px;font:9.5px/1.55 Arial,sans-serif;color:#70645a}.v9Actions{display:flex;gap:8px;flex-wrap:wrap}.v9Btn{border:1px solid #cfc3b6;border-radius:9px;padding:9px 11px;background:#fff;color:#2a241f;font:800 9px Arial,sans-serif;cursor:pointer}.v9Btn.primary{background:#211d19;border-color:#211d19;color:#fff}.v9Btn:disabled{opacity:.55;cursor:not-allowed}.v9Body{padding:18px 20px}.v9Body.hidden{display:none}.v9Form{display:grid;grid-template-columns:1fr 1fr;gap:10px}.v9Field{display:grid;gap:5px}.v9Field.wide{grid-column:1/-1}.v9Label{display:flex;justify-content:space-between;gap:8px;align-items:center}.v9Label label{font:800 7px Arial,sans-serif;letter-spacing:.07em;text-transform:uppercase;color:#75685c}.v9Prefill{font:700 6.5px Arial,sans-serif;color:#5f745f;background:#edf2ec;padding:3px 5px;border-radius:999px}.v9Field textarea{min-height:82px;resize:vertical;border:1px solid #d7cdc2;border-radius:9px;padding:10px 11px;font:10px/1.52 Arial,sans-serif;color:#332d28;background:#fff}.v9Field textarea:focus{outline:2px solid #d4c0a5;outline-offset:1px}.v9Footer{display:flex;justify-content:space-between;gap:14px;align-items:center;margin-top:14px;padding-top:14px;border-top:1px solid #eee7df}.v9Footer span{max-width:680px;font:8.5px/1.5 Arial,sans-serif;color:#7a6e63}
    .v9Room{margin-top:16px}.v9RoomTop{display:flex;justify-content:space-between;align-items:end;gap:12px;margin-bottom:10px}.v9RoomTop h3{margin:0;font:650 17px "Helvetica Neue",Arial,sans-serif}.v9RoomTop p{margin:4px 0 0;font:8.5px/1.45 Arial,sans-serif;color:#766a5f}.v9Folder{margin:10px 0;padding:12px;border:1px solid #e2d9cf;border-radius:11px;background:#fcfbf9}.v9FolderTitle{font:800 7px Arial,sans-serif;letter-spacing:.09em;text-transform:uppercase;color:#886f54;margin-bottom:8px}.v9Assets{display:grid;grid-template-columns:repeat(2,1fr);gap:7px}.v9Asset{display:flex;justify-content:space-between;gap:10px;align-items:center;padding:10px;border:1px solid #e6dfd7;border-radius:8px;background:#fff}.v9Asset strong{font:650 9.5px Arial,sans-serif}.v9Asset small{display:block;margin-top:2px;font:7.5px/1.35 Arial,sans-serif;color:#897c6e}.v9Asset button{border:0;border-radius:7px;padding:7px 8px;background:#eee7de;color:#2e2822;font:800 7.5px Arial,sans-serif;cursor:pointer}.v9Asset.ready button{background:#211d19;color:#fff}.v9Asset button:disabled{opacity:.6;cursor:not-allowed}.v9Notice{margin-top:10px;padding:10px 11px;border-radius:9px;background:#f4eee6;font:8.5px/1.5 Arial,sans-serif;color:#66594d}
    @media(max-width:850px){.v9Readiness{grid-template-columns:1fr}.v9Scores,.v9Form,.v9Assets{grid-template-columns:1fr}}`;
    document.head.appendChild(s)}

  function realEstate(d){const s=norm(`${d?.sector||''} ${d?.title||''} ${d?.company||''}`);return /real estate|hospitality|hotel|resort|property|multifamily|self storage|industrial property|commercial property/.test(s)}
  function txFlags(d){const t=norm(d?.transaction_type);return{sale:/sale|sell side|divest|exit/.test(t),acq:/acquisition|buyout|purchase/.test(t),debt:/debt|loan|credit|refinanc|unitranche|mezz/.test(t),equity:/equity|growth capital|minority|majority/.test(t),jv:/joint venture|\bjv\b/.test(t)}}
  function questionKeys(d){
    const f=txFlags(d),re=realEstate(d);const out=['investment_thesis','transaction_rationale','ownership','historical_performance','forecast','market_position','risks','mitigants','timeline'];
    if(!f.sale||f.acq||f.debt||f.equity||f.jv)out.push('use_of_proceeds');
    if(f.debt||f.acq||re)out.push('existing_debt');
    if(f.sale||f.acq||f.equity||f.jv||re)out.push('valuation');
    if(!f.sale||f.debt||f.equity||f.jv)out.push('exit_strategy');
    if(re||f.jv||f.acq||f.debt)out.push('sponsor_equity');
    if(re)out.push('asset_value','noi','operating_metrics');
    return [...new Set(out)];
  }
  function relevantAssets(d){const f=txFlags(d);return allAssets.filter(([k])=>k!=='sources'||(!f.sale||f.acq||f.debt||f.equity||f.jv))}
  function sentence(text,regex){const parts=String(text||'').replace(/\s+/g,' ').split(/(?<=[.!?;])\s+/);return parts.find(x=>regex.test(x))||''}
  function derive(d){
    const s=String(d?.summary||'').trim(),out={},src={};
    if(s){out.investment_thesis=s;src.investment_thesis='submission summary'}
    if(Number(d?.revenue)>0||Number(d?.ebitda)>0){const bits=[];if(Number(d.revenue)>0)bits.push(`Revenue: ${money(d.revenue)}`);if(Number(d.ebitda)>0)bits.push(`EBITDA: ${money(d.ebitda)}`);out.historical_performance=bits.join(' · ');src.historical_performance='submitted financial fields'}
    const map=[
      ['use_of_proceeds',/use of proceeds|proceeds will|funds will|capital will|capital is being raised for|raise is for/i],
      ['transaction_rationale',/rationale|why now|reason for sale|seeking capital|growth|expansion|refinanc|acquisition|liquidity event|development/i],
      ['ownership',/ownership|owned by|shareholder|cap table|sponsor owns|founder owns/i],
      ['existing_debt',/existing debt|current debt|loan|credit facility|mortgage|leverage/i],
      ['valuation',/valuation|purchase price|asking price|enterprise value|equity value|cap rate/i],
      ['forecast',/forecast|projected|projection|pro forma|stabilized|expected to grow|expected revenue|expected ebitda/i],
      ['market_position',/market leader|market position|competitive|competition|demand|scarcity|customer base|market size/i],
      ['risks',/risk|challenge|exposure|dependency/i],
      ['mitigants',/mitigant|mitigation|protected by|offset by/i],
      ['exit_strategy',/exit|repayment|refinance|sale after|liquidity path/i],
      ['timeline',/timeline|closing|close by|target close|milestone|completion date|stabilization/i],
      ['sponsor_equity',/sponsor equity|equity contribution|skin in the game|already invested|sponsor invested/i],
      ['asset_value',/asset value|property value|purchase price|appraised value/i],
      ['noi',/\bnoi\b|net operating income/i],
      ['operating_metrics',/occupancy|\badr\b|revpar|keys|rooms|units|utilization/i]
    ];
    map.forEach(([k,r])=>{const v=sentence(s,r);if(v){out[k]=v;src[k]='submission narrative'}});
    return{out,src}
  }
  function effectiveIntake(d,w){const der=derive(d),saved=w?.intake||{},eff={...der.out,...saved};return{eff,derived:der.src}}

  async function load(){
    const id=$('capitalDealSelect')?.value;if(!id)return false;const {data:{session}}=await sb.auth.getSession();if(!session)return false;
    const [dr,wr]=await Promise.all([sb.from('deals').select('*').eq('id',id).maybeSingle(),sb.from('deal_workspaces').select('*').eq('deal_id',id).maybeSingle()]);if(dr.error)throw dr.error;if(wr.error)throw wr.error;
    const ls=await sb.storage.from('deal-documents').list(`${session.user.id}/${id}`,{limit:100});const mix=effectiveIntake(dr.data,wr.data);
    state={user:session.user,deal:dr.data,workspace:wr.data,docs:ls.error?[]:(ls.data||[]).filter(x=>x.name&&x.id),effective:mix.eff,derived:mix.derived};return true
  }
  function score(){
    const d=state.deal||{},i=state.effective||{},g=state.workspace?.generated_assets||{};let core=0;const missing=[];
    const checks=[['Opportunity / company',!!(d.title&&d.company),5],['Capital ask',Number(d.deal_size)>0,5],['Sector / geography / structure',!!(d.sector&&d.geography&&d.transaction_type),7],['Seller relationship',!!d.seller_relationship,4],['Authority confirmation',!!d.authority_confirmed,4],['Opportunity summary',String(d.summary||'').trim().length>=120,5]];
    checks.forEach(([l,ok,p])=>{if(ok)core+=p;else missing.push(l)});
    const q=questionKeys(d),done=q.filter(k=>filled(i[k]));const info=q.length?Math.round(done.length/q.length*30):30;q.filter(k=>!filled(i[k])).forEach(k=>missing.push(defs[k].label));
    const a=relevantAssets(d),ready=a.filter(([k])=>g[k]?.ready);const generated=a.length?Math.round(ready.length/a.length*40):40;a.filter(([k])=>!g[k]?.ready).forEach(([,l])=>missing.push(l));
    return{total:Math.min(100,core+info+generated),core,info,generated,missing,questions:q,assets:a}
  }
  function assetReady(type,i,d){
    const core=!!(d.title&&d.company&&d.deal_size&&d.sector&&d.geography&&d.transaction_type),all=questionKeys(d).every(k=>filled(i[k]));
    const rules={teaser:core&&filled(i.investment_thesis),memo:core&&all,faq:filled(i.investment_thesis)&&filled(i.transaction_rationale)&&filled(i.timeline)&&filled(i.risks),transaction:core&&filled(i.transaction_rationale),sources:filled(i.use_of_proceeds)&&(filled(i.existing_debt)||filled(i.sponsor_equity)||filled(i.valuation)),ownership:filled(i.ownership),financial:filled(i.historical_performance)&&filled(i.forecast),risks:filled(i.risks)&&filled(i.mitigants),diligence_index:true,checklist:true};return!!rules[type]
  }

  function mount(){const panel=$('capitalSection')?.querySelector('.panel'),controls=panel?.querySelector('.capitalControls');if(!panel||!controls)return null;let root=$('investorSuiteV9Core');if(!root){root=document.createElement('div');root.id='investorSuiteV9Core';root.className='v9Core';controls.after(root)}return root}
  function render(){const root=mount();if(!root||!state.deal)return;const sc=score(),i=state.effective||{},saved=state.workspace?.intake||{};const next=sc.missing.slice(0,5).join(' · ')||'Nothing. The current package is complete against this readiness model.';
    const fields=sc.questions.map((k,idx)=>{const d=defs[k],prefilled=!filled(saved[k])&&filled(i[k]);return`<div class="v9Field ${idx<4?'wide':''}"><div class="v9Label"><label>${esc(d.label)}</label>${prefilled?'<span class="v9Prefill">Pre-filled from submission</span>':''}</div><textarea data-v9-field="${k}" placeholder="${esc(d.prompt)}">${esc(i[k]||'')}</textarea></div>`}).join('');
    const groups={};sc.assets.forEach(([k,n,f])=>(groups[f]||(groups[f]=[])).push([k,n]));const g=state.workspace?.generated_assets||{};const room=Object.entries(groups).map(([f,items])=>`<div class="v9Folder"><div class="v9FolderTitle">${esc(f)}</div><div class="v9Assets">${items.map(([k,n])=>{const ready=!!g[k]?.ready;return`<div class="v9Asset ${ready?'ready':''}"><div><strong>${esc(n)}</strong><small>${ready?'Generated from current workspace':'Complete the relevant inputs, then build the room'}</small></div><button type="button" data-v9-open="${k}" ${ready?'':'disabled'}>${ready?'Open':'Incomplete'}</button></div>`}).join('')}</div></div>`).join('');
    root.innerHTML=`<section class="v9Readiness"><div class="v9Gauge"><div class="v9Ring" style="--p:${sc.total}"><div class="v9Center"><strong>${sc.total}%</strong><span>Investor Readiness</span></div></div></div><div class="v9Copy"><div class="eyebrow">CAPITAL READINESS</div><h3>${sc.total===100?'100% complete inside the Investor Suite':`${100-sc.total} points remain to reach 100%`}</h3><p>This score measures package completeness. It does not measure buyer interest or mandate fit. The software reuses what you already submitted, asks only for transaction-relevant missing information, and then builds the investor data room.</p><div class="v9Scores"><div class="v9Score"><span>Core Transaction</span><strong>${sc.core}/30</strong><div class="v9Track"><i style="width:${Math.round(sc.core/30*100)}%"></i></div></div><div class="v9Score"><span>Required Deal Information</span><strong>${sc.info}/30</strong><div class="v9Track"><i style="width:${Math.round(sc.info/30*100)}%"></i></div></div><div class="v9Score"><span>Generated Data Room</span><strong>${sc.generated}/40</strong><div class="v9Track"><i style="width:${Math.round(sc.generated/40*100)}%"></i></div></div></div><div class="v9Next"><strong>Next to improve readiness:</strong> ${esc(next)}</div></div></section>
    <section class="v9Builder"><div class="v9BuilderHead"><div><div class="eyebrow">DATA ROOM BUILDER</div><h3>Answer only what this transaction actually needs.</h3><p>The builder has already reused compatible information from the original submission. Fill the remaining items once and the same answers feed every investor-facing document below.</p></div><div class="v9Actions"><button type="button" class="v9Btn" data-v9-toggle>Open Builder</button><button type="button" class="v9Btn primary" data-v9-build>Build / Refresh Data Room</button></div></div><div id="v9BuilderBody" class="v9Body hidden"><div class="v9Form">${fields}</div><div class="v9Footer"><span>Only explicit submitted facts are reused. The software will not invent ownership, financials, authority, valuation, property metrics or other source facts.</span><div class="v9Actions"><button type="button" class="v9Btn" data-v9-save>Save Answers</button><button type="button" class="v9Btn primary" data-v9-build>Build Data Room</button></div></div></div></section>
    <section class="v9Room"><div class="v9RoomTop"><div><div class="eyebrow">GENERATED DATA ROOM</div><h3>Reusable investor materials</h3><p>These outputs are built from the transaction itself. Internal mandate matching is never inserted into them.</p></div><span>${sc.assets.filter(([k])=>g[k]?.ready).length}/${sc.assets.length} ready</span></div>${room}<div class="v9Notice"><strong>Internal matching stays internal.</strong> Buyer-fit and mandate intelligence are not part of the teaser, memo, FAQ, transaction overview or other investor-facing documents.</div></section>`;
    patchProducts()
  }
  function patchProducts(){
    document.querySelector('.navBtn[data-section="capital"] span')?.replaceChildren(document.createTextNode('Investor Suite'));
    const hero=$('capitalSection')?.querySelector('.capitalHeroCard');if(hero){hero.querySelector('.eyebrow')&&(hero.querySelector('.eyebrow').textContent='OUTERHAVEN INVESTOR SUITE');hero.querySelector('h2')&&(hero.querySelector('h2').textContent='Build the complete investor package and data room.');hero.querySelector('p')&&(hero.querySelector('p').textContent='Start with the deal you already submitted, add only the missing underwriting information, and let the software produce the reusable investor materials.')}const ph=$('capitalSection')?.querySelector('.panelHead h2');if(ph)ph.textContent='Investor Readiness & Data Room';
    document.querySelectorAll('#capitalProducts .capitalProduct').forEach(card=>{const h=card.querySelector('h3');if(!h)return;const raw=h.textContent.trim();let cfg=null;
      if(/Institutional Package|Investor Teaser/i.test(raw))cfg=['Investor Teaser','INVESTOR-FACING','Generate a concise investor-facing opportunity document from the completed workspace.','teaser','Generate Teaser'];
      else if(/Diligence Audit|Source Material Checklist/i.test(raw))cfg=['Diligence Checklist','SOFTWARE OUTPUT','Generate the exact source-material and diligence request list needed to complete the room.','checklist','Generate Checklist'];
      else if(/Mandate Strategy|Internal Mandate Strategy|Investment Memorandum/i.test(raw))cfg=['Investment Memorandum','INVESTOR-FACING','Generate a deeper investor memo covering the thesis, transaction, economics, ownership, risks and execution plan.','memo','Generate Memo'];
      else if(/Capital Stack Review|Capital Structure Review/i.test(raw))cfg=['Capital Structure Review','SOFTWARE OUTPUT','Turn the capital ask, debt, sponsor equity, valuation and use of proceeds into a practical capitalization view.','sources','Generate Review'];
      else if(/Managed Capital Readiness|Deal Auto-Fix|Investor FAQ/i.test(raw))cfg=['Investor FAQ','INVESTOR-FACING','Generate a clean investor Q&A from the same verified transaction workspace.','faq','Generate FAQ'];
      if(!cfg)return;h.textContent=cfg[0];const tag=card.querySelector('.capitalProductTag');if(tag)tag.textContent=cfg[1];const p=card.querySelector('p');if(p)p.textContent=cfg[2];card.querySelectorAll('[data-cap-request]').forEach(b=>b.remove());const b=card.querySelector('[data-cap-generate],.capitalBtn.primary');if(b){b.removeAttribute('data-cap-generate');b.removeAttribute('data-cap-request');b.setAttribute('data-v9-product',cfg[3]);b.textContent=cfg[4]}
    })
  }
  function collect(){const out={...state.effective};document.querySelectorAll('[data-v9-field]').forEach(el=>out[el.dataset.v9Field]=el.value.trim());return out}
  async function save(build=false){if(!state.user||!state.deal)return;const intake=collect(),existing=state.workspace?.generated_assets||{},assets={...existing};if(build){relevantAssets(state.deal).forEach(([k])=>assets[k]={ready:assetReady(k,intake,state.deal),updated_at:new Date().toISOString()})}const payload={deal_id:state.deal.id,owner_id:state.user.id,intake,generated_assets:assets,updated_at:new Date().toISOString()};const {error}=await sb.from('deal_workspaces').upsert(payload,{onConflict:'deal_id'});if(error)throw error;await refresh();if(build){const b=$('v9BuilderBody');b?.classList.remove('hidden')}}
  async function refresh(){if(loading)return;loading=true;try{if(await load())render()}catch(e){console.error('investor suite v9',e)}finally{loading=false}}
  function schedule(){[0,180,500,1100].forEach(ms=>setTimeout(refresh,ms))}
  function init(){styles();if(!$('capitalDealSelect')||!$('capitalSection')?.querySelector('.capitalControls')){setTimeout(init,250);return}schedule()}
  document.addEventListener('click',async e=>{
    const t=e.target.closest('[data-v9-toggle]');if(t){const b=$('v9BuilderBody');b?.classList.toggle('hidden');t.textContent=b?.classList.contains('hidden')?'Open Builder':'Collapse';return}
    const saveBtn=e.target.closest('[data-v9-save]');if(saveBtn){saveBtn.disabled=true;try{await save(false)}catch(err){alert(err?.message||'Could not save answers.')}finally{saveBtn.disabled=false}return}
    const buildBtn=e.target.closest('[data-v9-build]');if(buildBtn){buildBtn.disabled=true;try{await save(true)}catch(err){alert(err?.message||'Could not build the data room.')}finally{buildBtn.disabled=false}return}
    const open=e.target.closest('[data-v9-open],[data-v9-product]');if(open){e.preventDefault();e.stopImmediatePropagation();const type=open.dataset.v9Open||open.dataset.v9Product;if(type==='sources'&&!relevantAssets(state.deal).some(([k])=>k==='sources')){alert('A Sources & Uses document is not required for this transaction structure.');return}window.OuterHavenCapitalDocsV6?.renderAsset(type);return}
    if(e.target.closest('.navBtn[data-section="capital"],#capitalRefresh'))schedule()
  },true);
  document.addEventListener('change',e=>{if(e.target?.id==='capitalDealSelect')schedule()},true);
  init();
})();