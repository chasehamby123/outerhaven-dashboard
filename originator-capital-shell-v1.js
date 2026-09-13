(function(){
  if(window.__outerhavenCapitalShellV1)return;
  window.__outerhavenCapitalShellV1=true;
  const sb=window.__OUTERHAVEN_ORIGINATOR_SB;if(!sb)return;
  const $=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  let deals=[],selected='';

  function styles(){if($('capitalShellV1Style'))return;const s=document.createElement('style');s.id='capitalShellV1Style';s.textContent=`
    .capitalHero{display:grid;grid-template-columns:1fr;gap:16px;margin-bottom:16px}.capitalHeroCard{border:1px solid #ded2c3;border-radius:15px;background:linear-gradient(135deg,#fcf8f2,#f1e7d9);padding:20px}.capitalHeroCard h2{font-size:24px;margin:4px 0 8px}.capitalHeroCard p{font-size:11px;line-height:1.6;color:#6f6358;margin:0}.capitalControls{display:flex;gap:10px;align-items:end;margin-bottom:15px;flex-wrap:wrap}.capitalControls label{display:grid;gap:5px;font-size:9px;text-transform:uppercase;letter-spacing:.06em;font-weight:850;color:#75685c}.capitalControls select{min-width:330px;max-width:100%;padding:10px 12px;border:1px solid #d7cabb;border-radius:10px;background:#fff;font:inherit;color:#29231e}.capitalRefresh{padding:10px 13px;border:1px solid #d7cabb;border-radius:10px;background:#fffdf9;font:inherit;font-size:10px;font-weight:850;cursor:pointer}.capitalOutput{margin-top:16px;border:1px solid #dfd4c7;border-radius:14px;background:#fff;overflow:hidden}.capitalOutput.hidden{display:none}.capitalOutputHead{display:flex;justify-content:space-between;gap:10px;align-items:center;padding:14px 16px;border-bottom:1px solid #e4dacf;background:#faf8f5}.capitalOutputHead h3{margin:0;font-size:14px}.capitalOutputActions{display:flex;gap:6px;flex-wrap:wrap}.capitalBtn{border:1px solid #cfc1b1;background:#fff;color:#2b251f;border-radius:9px;padding:8px 10px;font:inherit;font-size:9px;font-weight:850;cursor:pointer}.capitalOutputBody{padding:17px;max-height:70vh;overflow:auto}@media(max-width:600px){.capitalControls select{min-width:0;width:100%}.capitalOutputHead{align-items:flex-start;flex-direction:column}}
  `;document.head.appendChild(s)}

  function install(){
    if($('capitalSection'))return true;
    const nav=document.querySelector('.nav'),main=document.querySelector('.main');if(!nav||!main)return false;
    const btn=document.createElement('button');btn.className='navBtn';btn.dataset.section='capital';btn.innerHTML='<span>Capital Suite</span>';nav.appendChild(btn);
    const section=document.createElement('section');section.id='capitalSection';section.className='section';section.innerHTML=`
      <div class="capitalHero"><div class="capitalHeroCard"><div class="eyebrow">OUTERHAVEN CAPITAL SUITE</div><h2>Turn source material into an investor-ready package.</h2><p>Capital Suite shows what is already complete, then gives you one necessary next step at a time.</p></div></div>
      <section class="panel"><div class="panelHead"><div><div class="eyebrow">WORKSPACE</div><h2>Capital Suite</h2><p>Select an opportunity to review package readiness and investor materials.</p></div></div><div class="capitalControls"><label>Opportunity<select id="capitalDealSelect"><option value="">Loading opportunities...</option></select></label><button type="button" id="capitalRefresh" class="capitalRefresh">Refresh</button></div><div id="capitalOutput" class="capitalOutput hidden"><div class="capitalOutputHead"><h3 id="capitalOutputTitle">Investor Material</h3><div class="capitalOutputActions"><button type="button" id="capitalCopy" class="capitalBtn">Copy</button><button type="button" id="capitalDownload" class="capitalBtn">Print / Save PDF</button><button type="button" id="capitalCloseOutput" class="capitalBtn">Close</button></div></div><div id="capitalOutputBody" class="capitalOutputBody"></div></div></section>`;
    main.appendChild(section);
    $('capitalDealSelect').addEventListener('change',e=>{selected=e.target.value});
    $('capitalRefresh').addEventListener('click',refresh);
    $('capitalCloseOutput').addEventListener('click',()=>{$('capitalOutput')?.classList.add('hidden')});
    return true;
  }

  async function loadDeals(){
    const {data:{session}}=await sb.auth.getSession();if(!session)return;
    const {data,error}=await sb.from('deals').select('id,title,company,deal_size,status,updated_at').neq('status','withdrawn').order('updated_at',{ascending:false});
    if(error)throw error;deals=data||[];
    if(!selected||!deals.some(d=>String(d.id)===String(selected)))selected=deals[0]?.id||'';
    const select=$('capitalDealSelect');if(!select)return;
    select.innerHTML=deals.length?deals.map(d=>`<option value="${esc(d.id)}" ${String(d.id)===String(selected)?'selected':''}>${esc(d.title||d.company||'Opportunity')} · ${esc(String(d.status||'').replace(/_/g,' '))}</option>`).join(''):'<option value="">No opportunities available</option>';
    select.value=selected;
  }

  async function refresh(){
    const btn=$('capitalRefresh');if(btn){btn.disabled=true;btn.textContent='Refreshing...'}
    try{await loadDeals();$('capitalDealSelect')?.dispatchEvent(new Event('change',{bubbles:true}))}catch(err){console.error('capital shell refresh',err)}finally{if(btn){btn.disabled=false;btn.textContent='Refresh'}}
  }

  async function boot(){styles();let tries=0;while(!install()&&tries++<50)await new Promise(r=>setTimeout(r,120));if(!$('capitalSection'))return;await refresh()}
  boot();
  window.OuterHavenCapitalShell={refresh};
})();