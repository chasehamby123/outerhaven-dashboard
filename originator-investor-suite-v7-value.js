(function(){
  if(window.__outerhavenInvestorSuiteV7Value)return;window.__outerhavenInvestorSuiteV7Value=true;
  const $=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  const fieldLabels={
    investment_thesis:'Investment thesis',use_of_proceeds:'Use of proceeds',transaction_rationale:'Transaction rationale',ownership:'Ownership / capitalization',existing_debt:'Existing debt',valuation:'Valuation / pricing',historical_performance:'Historical performance',forecast:'Forecast / business plan',market_position:'Market / competitive position',risks:'Key risks',mitigants:'Risk mitigants',exit_strategy:'Exit / repayment strategy',timeline:'Transaction timeline',sponsor_equity:'Sponsor equity / skin in the game',asset_value:'Asset value / purchase price',noi:'NOI / property cash flow',operating_metrics:'Operating metrics'
  };
  const assets=[['teaser','Investor Teaser'],['memo','Investment Memorandum'],['faq','Investor FAQ'],['transaction','Transaction Overview'],['sources','Sources & Uses / Capital Structure'],['ownership','Ownership & Capitalization'],['financial','Financial Overview'],['risks','Risk & Mitigants'],['diligence_index','Data Room Index'],['checklist','Source Material Checklist']];
  function styles(){if($('investorSuiteV7Style'))return;const s=document.createElement('style');s.id='investorSuiteV7Style';s.textContent=`
    #investorSuiteV6>.is6Readiness{display:none!important}.iv7Readiness{display:grid;grid-template-columns:220px 1fr;gap:18px;padding:20px;margin-bottom:16px;border:1px solid #dcd2c7;border-radius:16px;background:#fff}.iv7Gauge{display:grid;place-items:center}.iv7Ring{--p:0;width:164px;height:164px;border-radius:50%;display:grid;place-items:center;position:relative;background:conic-gradient(#2d6a4c calc(var(--p)*1%),#ece7e1 0)}.iv7Ring:after{content:'';position:absolute;inset:13px;border-radius:50%;background:#fff}.iv7Center{position:relative;z-index:1;text-align:center}.iv7Center strong{display:block;font:760 36px/1 "Helvetica Neue",Arial,sans-serif;letter-spacing:-.04em;color:#211d19}.iv7Center span{display:block;margin-top:6px;font:800 7px/1 Arial,sans-serif;letter-spacing:.11em;text-transform:uppercase;color:#817264}.iv7Copy h3{margin:3px 0 7px;font:650 21px/1.18 "Helvetica Neue",Arial,sans-serif;color:#241f1b}.iv7Copy p{margin:0;font:10px/1.58 Arial,sans-serif;color:#6f6358}.iv7Scores{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:15px 0}.iv7Score{padding:11px;border:1px solid #e5ddd4;border-radius:10px;background:#fbfaf8}.iv7Score span{display:block;font:800 6.8px Arial,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:#87796b}.iv7Score strong{display:block;margin-top:4px;font:700 16px Arial,sans-serif;color:#28231f}.iv7Track{height:5px;margin-top:8px;border-radius:99px;overflow:hidden;background:#ece6df}.iv7Track i{display:block;height:100%;border-radius:99px;background:#494039}.iv7Next{padding:10px 11px;border-radius:9px;background:#f4eee6;font:8.8px/1.5 Arial,sans-serif;color:#62564b}.iv7Next strong{color:#2b251f}.iv7ValueStrip{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:0 0 16px}.iv7Value{padding:13px;border:1px solid #e4dbd1;border-radius:11px;background:#fff}.iv7Value span{display:block;font:800 6.8px Arial,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:#88796b}.iv7Value strong{display:block;margin-top:5px;font:650 12px/1.3 "Helvetica Neue",Arial,sans-serif;color:#28231f}.iv7Value p{margin:4px 0 0;font:8.5px/1.45 Arial,sans-serif;color:#73675c}.iv7MemoTag{display:inline-block;padding:5px 7px;border-radius:999px;background:#eee6dc;color:#6f5c47;font:800 6.8px Arial,sans-serif;letter-spacing:.07em;text-transform:uppercase}@media(max-width:850px){.iv7Readiness{grid-template-columns:1fr}.iv7Scores,.iv7ValueStrip{grid-template-columns:1fr 1fr}}@media(max-width:540px){.iv7Scores,.iv7ValueStrip{grid-template-columns:1fr}}
  `;document.head.appendChild(s)}
  const filled=v=>String(v||'').trim().length>=8;
  function calc(st){
    const d=st?.deal||{},i=st?.workspace?.intake||{},g=st?.workspace?.generated_assets||{};
    let core=0,info=0,generated=0;const missing=[];
    const coreChecks=[['Opportunity / company',!!(d.title&&d.company),5],['Capital ask',Number(d.deal_size)>0,5],['Sector / geography / structure',!!(d.sector&&d.geography&&d.transaction_type),7],['Seller relationship',!!d.seller_relationship,4],['Authority confirmation',!!d.authority_confirmed,4],['Opportunity summary',String(d.summary||'').trim().length>=180,5]];
    coreChecks.forEach(([label,ok,pts])=>{if(ok)core+=pts;else missing.push(label)});
    const intakeKeys=Object.keys(fieldLabels);intakeKeys.forEach(k=>{if(filled(i[k]))info+=30/intakeKeys.length;else missing.push(fieldLabels[k])});info=Math.round(info);
    assets.forEach(([k,label])=>{if(g[k]?.ready)generated+=4;else missing.push(label)});
    const total=Math.min(100,core+info+generated);return{total,core,info,generated,missing};
  }
  function renderReadiness(){
    const suite=$('investorSuiteV6'),api=window.OuterHavenInvestorSuiteV6;if(!suite||!api)return false;const st=api.getState?.();if(!st?.deal)return false;
    const sc=calc(st);let panel=$('investorReadinessV7');if(!panel){panel=document.createElement('section');panel.id='investorReadinessV7';panel.className='iv7Readiness';suite.prepend(panel)}
    const next=sc.missing.slice(0,5).join(' · ')||'Nothing. The workspace is complete against the current readiness model.';
    panel.innerHTML=`<div class="iv7Gauge"><div class="iv7Ring" style="--p:${sc.total}"><div class="iv7Center"><strong>${sc.total}%</strong><span>Investor Readiness</span></div></div></div><div class="iv7Copy"><div class="eyebrow">CAPITAL READINESS</div><h3>${sc.total===100?'100% complete inside the Investor Suite':`${100-sc.total} points remain to reach 100%`}</h3><p>This score measures whether the opportunity has enough structured deal data, source information and generated investor materials to function as a complete capital package. Buyer mandate fit is intentionally excluded.</p><div class="iv7Scores"><div class="iv7Score"><span>Core Transaction</span><strong>${sc.core}/30</strong><div class="iv7Track"><i style="width:${Math.round(sc.core/30*100)}%"></i></div></div><div class="iv7Score"><span>Deal Information</span><strong>${sc.info}/30</strong><div class="iv7Track"><i style="width:${Math.round(sc.info/30*100)}%"></i></div></div><div class="iv7Score"><span>Generated Data Room</span><strong>${sc.generated}/40</strong><div class="iv7Track"><i style="width:${Math.round(sc.generated/40*100)}%"></i></div></div></div><div class="iv7Next"><strong>Next to improve readiness:</strong> ${esc(next)}</div></div>`;
    return true;
  }
  function patchProducts(){
    document.querySelectorAll('#capitalProducts .capitalProduct').forEach(card=>{
      const h=card.querySelector('h3');if(!h)return;const title=h.textContent.trim();
      if(title==='Mandate Strategy'||title==='Internal Mandate Strategy'){
        h.textContent='Investment Memorandum';card.removeAttribute('data-internal');const tag=card.querySelector('.capitalProductTag');if(tag){tag.textContent='SOFTWARE OUTPUT';tag.className='capitalProductTag'}
        const p=card.querySelector('p');if(p)p.textContent='Turn the completed workspace into a deeper investor memo covering the thesis, transaction, financial picture, capitalization, risks and execution plan.';
        const items=card.querySelectorAll('.capitalFeatureList li'),copy=['Executive investment case','Transaction & capitalization','Financial / operating view','Risks, mitigants & timeline'];items.forEach((li,i)=>li.textContent=copy[i]||li.textContent);
        const b=card.querySelector('[data-cap-generate]');if(b){b.removeAttribute('data-cap-generate');b.setAttribute('data-iv7-memo','1');b.textContent='Generate Memo'}
      }
      if(h.textContent.trim()==='Investor Teaser'||h.textContent.trim()==='Institutional Package'){
        h.textContent='Investor Teaser';const tag=card.querySelector('.capitalProductTag');if(tag)tag.textContent='INVESTOR-FACING';const p=card.querySelector('p');if(p)p.textContent='Generate a clean investor-facing teaser from the deal and completed data-room workspace. Internal matching data is never included.'
      }
      if(h.textContent.trim()==='Diligence Audit'){const p=card.querySelector('p');if(p)p.textContent='Generate the exact source-material and diligence request list needed to make the room more complete.'}
      if(h.textContent.trim()==='Capital Stack Review'||h.textContent.trim()==='Capital Structure Review'){h.textContent='Capital Structure Review';const p=card.querySelector('p');if(p)p.textContent='Translate the ask, use of proceeds, debt, ownership and sponsor contribution into a practical capitalization view.'}
    });
  }
  function renderValueStrip(){const suite=$('investorSuiteV6');if(!suite)return;let v=$('iv7ValueStrip');if(!v){v=document.createElement('div');v.id='iv7ValueStrip';v.className='iv7ValueStrip';const builder=suite.querySelector('.is6Builder');if(builder)builder.before(v);else suite.appendChild(v)}v.innerHTML=`<div class="iv7Value"><span>Build</span><strong>Complete investor data room</strong><p>One workspace feeds the teaser, memo, FAQ, transaction, financial, risk and diligence documents.</p></div><div class="iv7Value"><span>Improve</span><strong>Readiness moves toward 100%</strong><p>Every missing input has a direct path to completion instead of being another visibility score.</p></div><div class="iv7Value"><span>Protect</span><strong>Internal matching stays internal</strong><p>Mandate intelligence never appears in investor-facing teasers, memos or data-room documents.</p></div>`}
  function patchHero(){const sec=$('capitalSection');if(!sec)return;const hero=sec.querySelector('.capitalHeroCard');if(hero){const h=hero.querySelector('h2');const p=hero.querySelector('p');if(h)h.textContent='Build the complete investor package, not another dashboard score.';if(p)p.textContent='Use one workspace to improve readiness, capture missing deal information, generate investor materials and assemble the data room.'}const ph=sec.querySelector('.panelHead h2');if(ph)ph.textContent='Investor Readiness & Data Room'}
  async function ensure(){
    const sel=$('capitalDealSelect');const api=window.OuterHavenInvestorSuiteV6;if(!sel||!api)return false;if(!sel.value){return false}
    if(!$('investorSuiteV6')){await api.refresh?.();await new Promise(r=>setTimeout(r,150))}
    const ok=renderReadiness();if(ok){patchProducts();renderValueStrip();patchHero()}return ok;
  }
  function schedule(){let tries=0;const tick=async()=>{tries++;const ok=await ensure();if(!ok&&tries<30)setTimeout(tick,300)};tick()}
  styles();schedule();
  document.addEventListener('click',e=>{
    const memo=e.target.closest('[data-iv7-memo]');if(memo){e.preventDefault();e.stopImmediatePropagation();window.OuterHavenCapitalDocsV6?.renderAsset('memo');return}
    if(e.target.closest('.navBtn[data-section="capital"]'))setTimeout(()=>{window.OuterHavenInvestorSuiteV6?.refresh?.().then?.(()=>{});schedule()},180);
    if(e.target.closest('[data-is6-build],[data-is6-save]'))setTimeout(schedule,350);
  },true);
  $('capitalDealSelect')?.addEventListener('change',()=>setTimeout(schedule,220));
})();