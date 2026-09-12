(function(){
  if(window.__outerhavenInvestorSuiteV8Stable)return;window.__outerhavenInvestorSuiteV8Stable=true;
  const $=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#039;'}[m]));
  const filled=v=>String(v||'').trim().length>=8;
  const fieldLabels={
    investment_thesis:'Investment thesis',use_of_proceeds:'Use of proceeds',transaction_rationale:'Transaction rationale',ownership:'Ownership / capitalization',existing_debt:'Existing debt',valuation:'Valuation / pricing',historical_performance:'Historical performance',forecast:'Forecast / business plan',market_position:'Market / competitive position',risks:'Key risks',mitigants:'Risk mitigants',exit_strategy:'Exit / repayment strategy',timeline:'Transaction timeline',sponsor_equity:'Sponsor equity / skin in the game',asset_value:'Asset value / purchase price',noi:'NOI / property cash flow',operating_metrics:'Operating metrics'
  };
  const assets=[['teaser','Investor Teaser'],['memo','Investment Memorandum'],['faq','Investor FAQ'],['transaction','Transaction Overview'],['sources','Sources & Uses / Capital Structure'],['ownership','Ownership & Capitalization'],['financial','Financial Overview'],['risks','Risk & Mitigants'],['diligence_index','Data Room Index'],['checklist','Source Material Checklist']];

  function styles(){
    if($('investorSuiteV8StableStyle'))return;
    const s=document.createElement('style');s.id='investorSuiteV8StableStyle';s.textContent=`
      #investorSuiteV6>#investorReadinessV7,#investorSuiteV6>.is6Readiness{display:none!important}
      .iv8Stable{display:grid;grid-template-columns:220px 1fr;gap:18px;padding:20px;margin:0 0 16px;border:1px solid #dcd2c7;border-radius:16px;background:#fff;position:relative;z-index:2}
      .iv8Gauge{display:grid;place-items:center}.iv8Ring{--p:0;width:164px;height:164px;border-radius:50%;display:grid;place-items:center;position:relative;background:conic-gradient(#2d6a4c calc(var(--p)*1%),#ece7e1 0)}.iv8Ring:after{content:'';position:absolute;inset:13px;border-radius:50%;background:#fff}.iv8Center{position:relative;z-index:1;text-align:center}.iv8Center strong{display:block;font:760 36px/1 "Helvetica Neue",Arial,sans-serif;letter-spacing:-.04em;color:#211d19}.iv8Center span{display:block;margin-top:6px;font:800 7px/1 Arial,sans-serif;letter-spacing:.11em;text-transform:uppercase;color:#817264}
      .iv8Copy h3{margin:3px 0 7px;font:650 21px/1.18 "Helvetica Neue",Arial,sans-serif;color:#241f1b}.iv8Copy p{margin:0;font:10px/1.58 Arial,sans-serif;color:#6f6358}.iv8Scores{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:15px 0}.iv8Score{padding:11px;border:1px solid #e5ddd4;border-radius:10px;background:#fbfaf8}.iv8Score span{display:block;font:800 6.8px Arial,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:#87796b}.iv8Score strong{display:block;margin-top:4px;font:700 16px Arial,sans-serif;color:#28231f}.iv8Track{height:5px;margin-top:8px;border-radius:99px;overflow:hidden;background:#ece6df}.iv8Track i{display:block;height:100%;border-radius:99px;background:#494039}.iv8Next{padding:10px 11px;border-radius:9px;background:#f4eee6;font:8.8px/1.5 Arial,sans-serif;color:#62564b}.iv8Next strong{color:#2b251f}
      @media(max-width:850px){.iv8Stable{grid-template-columns:1fr}.iv8Scores{grid-template-columns:1fr 1fr}}@media(max-width:540px){.iv8Scores{grid-template-columns:1fr}}
    `;document.head.appendChild(s)
  }

  function calc(st){
    const d=st?.deal||{},i=st?.workspace?.intake||{},g=st?.workspace?.generated_assets||{};
    let core=0,info=0,generated=0;const missing=[];
    const coreChecks=[['Opportunity / company',!!(d.title&&d.company),5],['Capital ask',Number(d.deal_size)>0,5],['Sector / geography / structure',!!(d.sector&&d.geography&&d.transaction_type),7],['Seller relationship',!!d.seller_relationship,4],['Authority confirmation',!!d.authority_confirmed,4],['Opportunity summary',String(d.summary||'').trim().length>=180,5]];
    coreChecks.forEach(([label,ok,pts])=>{if(ok)core+=pts;else missing.push(label)});
    const keys=Object.keys(fieldLabels);keys.forEach(k=>{if(filled(i[k]))info+=30/keys.length;else missing.push(fieldLabels[k])});info=Math.round(info);
    assets.forEach(([k,label])=>{if(g[k]?.ready)generated+=4;else missing.push(label)});
    return{total:Math.min(100,core+info+generated),core,info,generated,missing};
  }

  function ensureMount(){
    const metrics=$('capitalMetrics');if(!metrics||!metrics.parentNode)return null;
    let panel=$('investorReadinessV8Stable');
    if(!panel){panel=document.createElement('section');panel.id='investorReadinessV8Stable';panel.className='iv8Stable';metrics.parentNode.insertBefore(panel,metrics)}
    return panel;
  }

  function render(){
    const api=window.OuterHavenInvestorSuiteV6,sel=$('capitalDealSelect');if(!api||!sel?.value)return false;
    const st=api.getState?.();if(!st?.deal||String(st.deal.id)!==String(sel.value))return false;
    const panel=ensureMount();if(!panel)return false;
    const sc=calc(st),next=sc.missing.slice(0,5).join(' · ')||'Nothing. The workspace is complete against the current readiness model.';
    panel.innerHTML=`<div class="iv8Gauge"><div class="iv8Ring" style="--p:${sc.total}"><div class="iv8Center"><strong>${sc.total}%</strong><span>Investor Readiness</span></div></div></div><div class="iv8Copy"><div class="eyebrow">CAPITAL READINESS</div><h3>${sc.total===100?'100% complete inside the Investor Suite':`${100-sc.total} points remain to reach 100%`}</h3><p>This measures package completeness, not buyer interest. Complete the transaction data, provide the source facts, and let the software build the investor materials to reach 100%.</p><div class="iv8Scores"><div class="iv8Score"><span>Core Transaction</span><strong>${sc.core}/30</strong><div class="iv8Track"><i style="width:${Math.round(sc.core/30*100)}%"></i></div></div><div class="iv8Score"><span>Deal Information</span><strong>${sc.info}/30</strong><div class="iv8Track"><i style="width:${Math.round(sc.info/30*100)}%"></i></div></div><div class="iv8Score"><span>Generated Data Room</span><strong>${sc.generated}/40</strong><div class="iv8Track"><i style="width:${Math.round(sc.generated/40*100)}%"></i></div></div></div><div class="iv8Next"><strong>Next to improve readiness:</strong> ${esc(next)}</div></div>`;
    return true;
  }

  async function sync(){
    const api=window.OuterHavenInvestorSuiteV6,sel=$('capitalDealSelect');if(!api||!sel?.value)return false;
    const st=api.getState?.();if(!st?.deal||String(st.deal.id)!==String(sel.value)){try{await api.refresh?.()}catch(_){} }
    return render();
  }
  function schedule(delays=[0,120,350,800,1500]){delays.forEach(ms=>setTimeout(sync,ms))}

  styles();schedule([0,200,500,1000,1800,3000]);
  document.addEventListener('click',e=>{
    if(e.target.closest('.navBtn[data-section="capital"]'))schedule([120,350,800,1400]);
    if(e.target.closest('[data-is6-build],[data-is6-save],[data-is6-open],[data-iv7-memo]'))schedule([250,600,1200]);
    if(e.target.closest('#capitalRefresh'))schedule([250,650,1200]);
  },true);
  document.addEventListener('change',e=>{if(e.target?.id==='capitalDealSelect')schedule([150,400,900,1500])},true);
})();