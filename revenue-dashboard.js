(function(){
  if(window.__outerhavenRevenueDashboard)return;
  window.__outerhavenRevenueDashboard=true;

  let role=null,opps=[],people=[],activeId=null,observer=null,applyTimer=null;
  const style=document.createElement('style');
  style.textContent=`
    .revenueTermsBtn{border:1px solid #d6dae0;background:#fff;color:#15171a;border-radius:10px;padding:9px 13px;font-weight:700}
    .revenueSummaryGrid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.revenueSummaryTotal{grid-column:1/-1;background:#f5f6f8;border:1px solid #e4e7eb;border-radius:12px;padding:13px}.revenueSummaryTotal .k,.revenueSummaryCell .k{font-size:9px;color:#70757d;font-weight:800;text-transform:uppercase;letter-spacing:.05em}.revenueSummaryTotal .v{font-size:24px;font-weight:850;margin-top:5px}.revenueSummaryCell{background:#f9fafb;border:1px solid #e4e7eb;border-radius:10px;padding:10px}.revenueSummaryCell .v{font-size:12px;font-weight:750;margin-top:4px}.revenueSummaryNote{font-size:10px;color:#70757d;line-height:1.45;margin-top:8px}
    .revenuePreview{grid-column:1/-1;background:#111827;color:#fff;border-radius:12px;padding:14px}.revenuePreview .k{font-size:9px;color:#b7bec8;text-transform:uppercase;font-weight:850;letter-spacing:.06em}.revenuePreview .v{font-size:25px;font-weight:850;margin-top:5px}.revenuePreview .s{font-size:9px;color:#cdd3db;margin-top:5px;line-height:1.45}.revenueHelp{grid-column:1/-1;font-size:10px;color:#70757d;line-height:1.5;padding:10px 11px;border:1px solid #e4e7eb;background:#f9fafb;border-radius:10px}.revenueLinkedInfo{grid-column:1/-1;font-size:10px;color:#4b5563;background:#eef7ff;border:1px solid #cfe1f3;border-radius:10px;padding:10px 11px;line-height:1.5}.profileRevenueBtn{white-space:nowrap}
  `;
  document.head.appendChild(style);

  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const num=v=>v==null||v===''?null:Number(v);
  const field=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  function parseMoney(v){
    if(v==null||v==='')return 0;if(typeof v==='number')return Number.isFinite(v)?v:0;
    const m=String(v).replace(/,/g,'').toLowerCase().match(/\$?\s*([0-9]+(?:\.[0-9]+)?)\s*(billion|million|thousand|bn|mm|m|b|k)?/i);if(!m)return 0;
    let x=Number(m[1]);const u=(m[2]||'').toLowerCase();if(['b','bn','billion'].includes(u))x*=1e9;else if(['m','mm','million'].includes(u))x*=1e6;else if(['k','thousand'].includes(u))x*=1e3;return x;
  }
  function money(v){const x=Number(v)||0,a=Math.abs(x);if(a>=1e9)return'$'+(x/1e9).toFixed(a>=1e10?1:2).replace(/\.00$/,'').replace(/(\.\d)0$/,'$1')+'B';if(a>=1e6)return'$'+(x/1e6).toFixed(a>=1e7?1:2).replace(/\.00$/,'').replace(/(\.\d)0$/,'$1')+'M';if(a>=1e3)return'$'+(x/1e3).toFixed(a>=1e5?0:1).replace(/\.0$/,'')+'K';return'$'+Math.round(x).toLocaleString()}
  const personFor=o=>people.find(p=>p.id===o?.person_id);
  function pathFor(o){if(o?.revenue_path)return o.revenue_path;if(o?.side==='Buy Side')return'buy_side_interest';return personFor(o)?.sell_side_kind==='direct_sponsor'?'direct_sponsor':'sourced_opportunity'}
  function terms(o){
    const path=pathFor(o),direct=path==='direct_sponsor',raise=num(o?.revenue_raise_amount)??parseMoney(o?.opportunity_size),monthly=num(o?.revenue_retainer_monthly)??(direct?15000:0),months=num(o?.revenue_retainer_months)??(direct?3:0),fixedRetainer=num(o?.revenue_retainer_fixed),pct=num(o?.revenue_success_fee_percent)??(direct?5:0),fixedSuccess=num(o?.revenue_success_fee_fixed),retainer=fixedRetainer!=null?fixedRetainer:monthly*months,success=fixedSuccess!=null?fixedSuccess:raise*pct/100;return{path,raise,monthly,months,fixedRetainer,pct,fixedSuccess,retainer,success,total:retainer+success}
  }
  const pathLabel=p=>p==='direct_sponsor'?'Direct Sponsor / Founder / Developer':p==='sourced_opportunity'?'Sourced Opportunity / Originator':'Buy-Side Interest';

  async function resolveRole(){for(let i=0;i<40;i++){if(window.__outerhavenDashboardRole){role=window.__outerhavenDashboardRole;return role}if(typeof sb!=='undefined'){const r=await sb.rpc('dashboard_role');if(!r.error&&r.data){role=r.data;return role}}await sleep(250)}return null}
  async function refresh(){
    if(typeof sb==='undefined')return;
    const [o,p]=await Promise.all([
      sb.from('opportunities').select('id,person_id,title,side,opportunity_size,revenue_path,revenue_raise_amount,revenue_retainer_monthly,revenue_retainer_months,revenue_retainer_fixed,revenue_success_fee_percent,revenue_success_fee_fixed,revenue_linked_sell_side_opportunity_id,revenue_notes,pipeline_stage').order('updated_at',{ascending:false}),
      sb.from('people').select('id,name,sell_side_kind,primary_side')
    ]);
    if(o.error||p.error){console.error('revenue dashboard',o.error||p.error);return}
    opps=o.data||[];people=p.data||[];apply();
  }

  function ensureModal(){
    if(field('revenueTermsModal'))return;
    const wrap=document.createElement('div');wrap.id='revenueTermsModal';wrap.className='modal hidden';
    wrap.innerHTML=`<div class="modalCard"><div class="modalHead"><div><div class="eyebrow">OPPORTUNITY ECONOMICS</div><h2 id="revenueTermsTitle">Revenue Terms</h2></div><button id="closeRevenueTerms" class="iconBtn" type="button">×</button></div><form id="revenueTermsForm" class="form"><div class="formGrid"><label class="span2">Revenue Path<select id="revenuePath"><option value="direct_sponsor">Direct Sponsor / Founder / Property Developer</option><option value="sourced_opportunity">Sourced Opportunity / Originator</option><option value="buy_side_interest">Buy-Side Interest</option></select></label><label class="span2" id="revenueLinkedWrap">Linked Sell-Side Opportunity<select id="revenueLinkedOpportunity"></select></label><label>Raise / Interested Amount ($)<input id="revenueRaiseAmount" type="number" min="0" step="1000" placeholder="150000000"></label><label>Monthly Retainer ($)<input id="revenueMonthlyRetainer" type="number" min="0" step="100" placeholder="15000"></label><label>Retainer Months<input id="revenueRetainerMonths" type="number" min="0" max="120" step="1" placeholder="3"></label><label>Flat Retainer ($, optional)<input id="revenueFixedRetainer" type="number" min="0" step="100" placeholder="Overrides monthly × months"></label><label>Success Fee (%)<input id="revenueSuccessPercent" type="number" min="0" max="100" step="0.01" placeholder="5"></label><label>Fixed Success Fee ($, optional)<input id="revenueFixedSuccess" type="number" min="0" step="100" placeholder="Overrides percentage"></label><div id="revenueLinkedInfo" class="revenueLinkedInfo hidden"></div><div class="revenuePreview"><div class="k">Projected OuterHaven Revenue</div><div id="revenuePreviewValue" class="v">$0</div><div id="revenuePreviewSub" class="s"></div></div><div id="revenueHelp" class="revenueHelp"></div><label class="span2">Revenue Notes<textarea id="revenueNotes" rows="2" placeholder="Negotiated economics, fee split, special terms..."></textarea></label></div><div class="modalActions"><button id="cancelRevenueTerms" class="ghost" type="button">Cancel</button><button id="saveRevenueTerms" class="primary" type="submit">Save Revenue Terms</button></div></form></div>`;
    document.body.appendChild(wrap);
    field('closeRevenueTerms').onclick=closeModal;field('cancelRevenueTerms').onclick=closeModal;field('revenueTermsForm').onsubmit=save;
    ['revenuePath','revenueLinkedOpportunity','revenueRaiseAmount','revenueMonthlyRetainer','revenueRetainerMonths','revenueFixedRetainer','revenueSuccessPercent','revenueFixedSuccess'].forEach(id=>field(id).addEventListener('input',()=>{if(id==='revenuePath')applyPathDefaults();updateForm()}));
  }
  function closeModal(){field('revenueTermsModal')?.classList.add('hidden');activeId=null}
  function linkedOptions(current){return'<option value="">No linked sell-side opportunity</option>'+opps.filter(o=>o.side==='Sell Side').map(o=>`<option value="${o.id}" ${o.id===current?'selected':''}>${esc(o.title||'Opportunity')} · ${esc(o.opportunity_size||'Size not set')}</option>`).join('')}
  function open(id){
    const o=opps.find(x=>x.id===id);if(!o)return;activeId=id;ensureModal();
    const t=terms(o);field('revenueTermsTitle').textContent=`Revenue Terms · ${o.title}`;field('revenuePath').value=t.path;field('revenueLinkedOpportunity').innerHTML=linkedOptions(o.revenue_linked_sell_side_opportunity_id||'');field('revenueRaiseAmount').value=t.raise||'';field('revenueMonthlyRetainer').value=o.revenue_retainer_monthly??(t.path==='direct_sponsor'?15000:'');field('revenueRetainerMonths').value=o.revenue_retainer_months??(t.path==='direct_sponsor'?3:'');field('revenueFixedRetainer').value=o.revenue_retainer_fixed??'';field('revenueSuccessPercent').value=o.revenue_success_fee_percent??(t.path==='direct_sponsor'?5:'');field('revenueFixedSuccess').value=o.revenue_success_fee_fixed??'';field('revenueNotes').value=o.revenue_notes||'';updateForm();field('revenueTermsModal').classList.remove('hidden')
  }
  function applyPathDefaults(){
    const path=field('revenuePath').value;
    if(path==='direct_sponsor'){
      if(!field('revenueMonthlyRetainer').value)field('revenueMonthlyRetainer').value='15000';
      if(!field('revenueRetainerMonths').value)field('revenueRetainerMonths').value='3';
      if(!field('revenueSuccessPercent').value)field('revenueSuccessPercent').value='5';
    }
  }
  function formValues(){return{path:field('revenuePath').value,linked:field('revenueLinkedOpportunity').value||null,raise:num(field('revenueRaiseAmount').value)??0,monthly:num(field('revenueMonthlyRetainer').value)??0,months:num(field('revenueRetainerMonths').value)??0,fixedRetainer:num(field('revenueFixedRetainer').value),pct:num(field('revenueSuccessPercent').value)??0,fixedSuccess:num(field('revenueFixedSuccess').value)}}
  function updateForm(){
    if(!activeId)return;const v=formValues(),linkedOpp=v.linked?opps.find(o=>o.id===v.linked):null,linkedTerms=linkedOpp?terms(linkedOpp):null,isBuy=v.path==='buy_side_interest';field('revenueLinkedWrap').classList.toggle('hidden',!isBuy);
    let retainer=v.fixedRetainer!=null?v.fixedRetainer:v.monthly*v.months,success=v.fixedSuccess!=null?v.fixedSuccess:v.raise*v.pct/100,total=retainer+success,sub='';
    if(isBuy&&linkedTerms){retainer=linkedTerms.retainer;success=linkedTerms.fixedSuccess!=null?linkedTerms.fixedSuccess:v.raise*linkedTerms.pct/100;total=retainer+success;field('revenueLinkedInfo').classList.remove('hidden');field('revenueLinkedInfo').textContent=`Using ${linkedOpp.title}'s sell-side economics: ${money(linkedTerms.retainer)} retainer + ${linkedTerms.fixedSuccess!=null?money(linkedTerms.fixedSuccess)+' fixed success fee':linkedTerms.pct+'% success fee'}. The dashboard counts this deal once.`;sub='Buy-side interest uses the linked sell-side engagement terms.'}
    else{field('revenueLinkedInfo').classList.add('hidden');field('revenueLinkedInfo').textContent='';sub=v.fixedRetainer!=null||v.fixedSuccess!=null?'Flat amounts override the monthly or percentage calculation where entered.':'Retainer + success fee potential.'}
    field('revenuePreviewValue').textContent=money(total);field('revenuePreviewSub').textContent=sub;
    field('revenueHelp').textContent=v.path==='direct_sponsor'?'Direct sponsor minimum defaults to $15K per month for 3 months plus a 5% success fee. You can increase or override the terms for a specific opportunity.':v.path==='sourced_opportunity'?'For Remo/originator-style deals, enter the economics actually negotiated for that specific opportunity.':'Enter the amount this buyer is interested in and link the sell-side opportunity. OuterHaven will use that deal’s retainer and success-fee terms without double counting it.';
  }
  async function save(e){
    e.preventDefault();const o=opps.find(x=>x.id===activeId);if(!o)return;const v=formValues(),btn=field('saveRevenueTerms');btn.disabled=true;btn.textContent='Saving...';
    try{
      const payload={revenue_path:v.path,revenue_raise_amount:v.raise||null,revenue_retainer_monthly:num(field('revenueMonthlyRetainer').value),revenue_retainer_months:num(field('revenueRetainerMonths').value),revenue_retainer_fixed:num(field('revenueFixedRetainer').value),revenue_success_fee_percent:num(field('revenueSuccessPercent').value),revenue_success_fee_fixed:num(field('revenueFixedSuccess').value),revenue_linked_sell_side_opportunity_id:v.path==='buy_side_interest'?v.linked:null,revenue_notes:field('revenueNotes').value.trim()||null};
      if(v.path==='direct_sponsor'){if(payload.revenue_retainer_monthly==null)payload.revenue_retainer_monthly=15000;if(payload.revenue_retainer_months==null)payload.revenue_retainer_months=3;if(payload.revenue_success_fee_percent==null)payload.revenue_success_fee_percent=5}
      const res=await sb.from('opportunities').update(payload).eq('id',o.id);if(res.error){alert(res.error.message);return}
      closeModal();await refresh();if(typeof window.__outerhavenRefreshDashboardMetrics==='function')await window.__outerhavenRefreshDashboardMetrics();if(typeof loadData==='function')await loadData();
    }finally{btn.disabled=false;btn.textContent='Save Revenue Terms'}
  }

  function summaryHtml(o){
    const t=terms(o),linked=o.revenue_linked_sell_side_opportunity_id?opps.find(x=>x.id===o.revenue_linked_sell_side_opportunity_id):null;let shown=t;
    if(t.path==='buy_side_interest'&&linked){const lt=terms(linked),success=lt.fixedSuccess!=null?lt.fixedSuccess:t.raise*lt.pct/100;shown={...t,retainer:lt.retainer,success,total:lt.retainer+success,pct:lt.pct,fixedSuccess:lt.fixedSuccess}}
    return `<section class="detailSec" data-revenue-summary><div class="detailTitle">REVENUE ECONOMICS</div><div class="revenueSummaryGrid"><div class="revenueSummaryTotal"><div class="k">Projected Revenue</div><div class="v">${money(shown.total)}</div></div><div class="revenueSummaryCell"><div class="k">Revenue Path</div><div class="v">${pathLabel(t.path)}</div></div><div class="revenueSummaryCell"><div class="k">Raise / Interest</div><div class="v">${money(t.raise)}</div></div><div class="revenueSummaryCell"><div class="k">Retainer</div><div class="v">${money(shown.retainer)}</div></div><div class="revenueSummaryCell"><div class="k">Success Fee</div><div class="v">${shown.fixedSuccess!=null?money(shown.success):(shown.pct||0)+'% · '+money(shown.success)}</div></div></div>${linked?`<div class="revenueSummaryNote">Linked to ${esc(linked.title)}. Sell-side economics are counted once in the top revenue card.</div>`:''}</section>`
  }
  function currentDrawerId(){try{if(typeof selectedId!=='undefined'&&selectedId)return selectedId}catch{}const title=field('detailTitle')?.textContent?.trim();return title?opps.find(o=>o.title===title)?.id:null}
  function apply(){
    if(role!=='admin')return;
    const drawer=field('drawer'),drawerId=currentDrawerId();
    if(drawer&&!drawer.classList.contains('hidden')&&drawerId){
      const foot=drawer.querySelector('.drawerFoot');if(foot&&!foot.querySelector('[data-revenue-terms-current]')){const b=document.createElement('button');b.type='button';b.className='revenueTermsBtn';b.dataset.revenueTermsCurrent='';b.textContent='Revenue Terms';b.onclick=()=>open(currentDrawerId());const edit=field('editOpp');edit?foot.insertBefore(b,edit):foot.appendChild(b)}
      const body=field('drawerBody'),o=opps.find(x=>x.id===drawerId);if(body&&o){const next=summaryHtml(o),existing=body.querySelector('[data-revenue-summary]');if(!existing)body.insertAdjacentHTML('beforeend',next);else{const tmp=document.createElement('div');tmp.innerHTML=next;const nextEl=tmp.firstElementChild;if(nextEl&&existing.innerHTML!==nextEl.innerHTML)existing.innerHTML=nextEl.innerHTML}}
    }
    document.querySelectorAll('.profileItemCard').forEach(card=>{const openDeal=card.querySelector('[data-open-deal]');if(!openDeal)return;const actions=openDeal.closest('.profileItemActions');if(actions&&!actions.querySelector('[data-revenue-opportunity]')){const b=document.createElement('button');b.type='button';b.className='profileMiniBtn profileRevenueBtn';b.dataset.revenueOpportunity=openDeal.dataset.openDeal;b.textContent='Revenue Terms';b.onclick=e=>{e.preventDefault();e.stopPropagation();open(b.dataset.revenueOpportunity)};actions.insertBefore(b,openDeal)}});
  }
  function scheduleApply(){clearTimeout(applyTimer);applyTimer=setTimeout(apply,80)}
  async function install(){role=await resolveRole();if(role!=='admin')return;ensureModal();observer=new MutationObserver(scheduleApply);observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});await refresh();sb.channel('outerhaven-revenue-editor-v1').on('postgres_changes',{event:'*',schema:'public',table:'opportunities'},refresh).on('postgres_changes',{event:'*',schema:'public',table:'people'},refresh).subscribe();window.__outerhavenOpenRevenueTerms=open;window.__outerhavenRefreshRevenueEditor=refresh}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
