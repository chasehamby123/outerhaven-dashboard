(function(){
  if(window.__outerhavenOpportunityBuyerMatches)return;
  window.__outerhavenOpportunityBuyerMatches=true;

  const FLOOR=20000000;
  let opportunityMatchMap=new Map();
  let loaded=false;
  let channel=null;
  let refreshTimer=null;

  const style=document.createElement('style');
  style.textContent=`
    .oppBuyerMatch{margin-top:9px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;border:1px solid #dfcfbb;background:#f8f0e5;border-radius:9px;padding:7px 9px;color:#4e4338}
    .oppBuyerMatch .obmLabel{font-size:7.5px;font-weight:900;letter-spacing:.07em;text-transform:uppercase;color:#806f5d}
    .oppBuyerMatch .obmScore{font-size:13px;font-weight:950;color:#171511}
    .oppBuyerMatch .obmCount{font-size:8px;color:#7a6c5e;font-weight:750}
    .oppBuyerMatch.floor{background:#f5f5f4;border-color:#dededb}.oppBuyerMatch.floor .obmScore{color:#77736d}
    .obmTable{white-space:nowrap}.obmTable strong{font-size:11px}.obmTable span{display:block;font-size:7.5px;color:#7c7369;margin-top:2px}
    .obmHero{border:1px solid #dfcfbb;background:#f8f0e5;border-radius:12px;padding:12px;margin-bottom:10px}.obmHeroTop{display:flex;align-items:flex-end;justify-content:space-between;gap:12px}.obmHeroTop span{font-size:8px;font-weight:900;letter-spacing:.07em;text-transform:uppercase;color:#806f5d}.obmHeroTop strong{font-size:25px;line-height:1;color:#171511}.obmHeroTitle{font-size:10px;font-weight:850;color:#3f372f;margin-top:7px}.obmHeroReason{font-size:8px;line-height:1.45;color:#786b5f;margin-top:4px}.obmTopList{display:grid;gap:6px;margin-top:9px}.obmTopRow{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:center;border:1px solid #e3d4c3;background:#fffaf4;border-radius:8px;padding:7px 8px}.obmTopName{font-size:8.5px;font-weight:850;color:#433a32}.obmTopReason{font-size:7px;color:#84776b;margin-top:2px;line-height:1.35}.obmTopScore{font-size:12px;font-weight:900;color:#171511}.obmDisclosure{font-size:7.5px;line-height:1.45;color:#85796e;margin-top:8px}
  `;
  document.head.appendChild(style);

  function e(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}
  function rec(id){return opportunityMatchMap.get(String(id))||null}
  function floorBlocked(r){return Array.isArray(r?.buyer_match_reasons)&&r.buyer_match_reasons.includes('Below $20M network floor')}
  function isModeled(r){return String(r?.buyer_match_label||'').startsWith('Modeled Mandate')}
  function labelFor(r){return isModeled(r)?'Modeled Buyer Match':'Buyer Match'}
  function reasonText(r){return Array.isArray(r?.buyer_match_reasons)&&r.buyer_match_reasons.length?r.buyer_match_reasons.join(' · '):'Add more structured opportunity details to improve matching accuracy.'}

  async function loadState(){
    if(typeof sb==='undefined')return false;
    const {data,error}=await sb.from('opportunities').select('id,side,opportunity_size,sector,geography,transaction_type,buyer_match_score,buyer_match_count,buyer_match_label,buyer_match_reasons,buyer_match_updated_at');
    if(error){
      if(!/jwt|auth|permission|row-level/i.test(error.message||''))console.error('opportunity buyer matching',error);
      return false;
    }
    opportunityMatchMap=new Map((data||[]).map(r=>[String(r.id),r]));
    loaded=true;
    decorateCards();decorateTable();
    if(typeof selectedId!=='undefined'&&selectedId)decorateDrawer(selectedId);
    return true;
  }

  function installFormFields(){
    const grid=document.querySelector('#oppForm .formGrid');
    if(!grid||document.getElementById('opportunityGeographyInput'))return;
    const sector=document.getElementById('sectorInput')?.closest('label');
    if(!sector)return;
    sector.insertAdjacentHTML('afterend',`<label>Geography<input id="opportunityGeographyInput" placeholder="United States, Southeast Asia, Global..."></label><label>Transaction Structure<input id="opportunityStructureInput" placeholder="Equity, Debt, Joint Venture..."></label>`);
  }

  const baseOpenOppModal=typeof openOppModal==='function'?openOppModal:null;
  if(baseOpenOppModal){
    openOppModal=function(id=null){
      baseOpenOppModal(id);
      installFormFields();
      const r=id?rec(id):null;
      const g=document.getElementById('opportunityGeographyInput'),t=document.getElementById('opportunityStructureInput');
      if(g)g.value=r?.geography||'';
      if(t)t.value=r?.transaction_type||'';
    };
  }

  saveOpp=async function(ev){
    ev.preventDefault();
    installFormFields();
    const id=document.getElementById('editId').value||null;
    const payload={
      person_id:document.getElementById('contactInput').value||null,
      title:document.getElementById('companyInput').value.trim(),
      side:document.getElementById('editSide').value,
      owner_name:document.getElementById('ownerInput').value.trim(),
      stage:document.getElementById('editStage').value,
      priority:document.getElementById('priorityInput').value,
      opportunity_size:document.getElementById('sizeInput').value.trim(),
      sector:document.getElementById('sectorInput').value.trim(),
      geography:document.getElementById('opportunityGeographyInput')?.value.trim()||null,
      transaction_type:document.getElementById('opportunityStructureInput')?.value.trim()||null,
      next_step:document.getElementById('nextInput').value.trim(),
      next_step_owner:document.getElementById('nextOwnerInput').value.trim(),
      due_date:document.getElementById('dueDateInput').value||null,
      notes:document.getElementById('notesInput').value.trim(),
      created_by:currentUser.id
    };
    const res=id?await sb.from('opportunities').update(payload).eq('id',id):await sb.from('opportunities').insert(payload);
    if(res.error){alert(res.error.message);return}
    document.getElementById('oppModal').classList.add('hidden');
    if(typeof closeDetail==='function')closeDetail();
    await loadData();
    await loadState();
  };

  const baseRenderOps=typeof renderOps==='function'?renderOps:null;
  if(baseRenderOps){
    renderOps=function(){baseRenderOps();decorateCards();decorateTable()};
  }

  const baseOpenDetail=typeof openDetail==='function'?openDetail:null;
  if(baseOpenDetail){
    openDetail=function(id){baseOpenDetail(id);decorateDrawer(id)};
  }

  function badgeHtml(r){
    if(!r||r.side!=='Sell Side')return'';
    if(floorBlocked(r))return `<div class="oppBuyerMatch floor"><span class="obmLabel">Buyer Network</span><strong class="obmScore">0%</strong><span class="obmCount">No mandate accepts opportunities below $20M</span></div>`;
    const score=Number(r.buyer_match_score||0),count=Number(r.buyer_match_count||0);
    return `<div class="oppBuyerMatch"><span class="obmLabel">${e(labelFor(r))}</span><strong class="obmScore">${score}%</strong><span class="obmCount">${count} mandate${count===1?'':'s'} at 60%+ fit</span></div>`;
  }

  function decorateCards(){
    document.querySelectorAll('#opCards .opCard[data-open]').forEach(card=>{
      card.querySelector('.oppBuyerMatch')?.remove();
      const r=rec(card.dataset.open),sub=card.querySelector('.cardSub');
      if(r&&sub)sub.insertAdjacentHTML('afterend',badgeHtml(r));
    });
  }

  function decorateTable(){
    const table=document.querySelector('#opTableWrap table');if(!table)return;
    const head=table.querySelector('thead tr');
    if(head&&!head.querySelector('[data-obm-head]')){
      const th=document.createElement('th');th.dataset.obmHead='1';th.textContent='Buyer Match';head.insertBefore(th,head.lastElementChild);
    }
    document.querySelectorAll('#opTable tr').forEach(row=>{
      row.querySelector('[data-obm-cell]')?.remove();
      const id=row.querySelector('[data-open]')?.dataset.open,r=rec(id);if(!id||!r)return;
      const td=document.createElement('td');td.dataset.obmCell='1';td.className='obmTable';
      td.innerHTML=floorBlocked(r)?'<strong>0%</strong><span>$20M floor</span>':`<strong>${Number(r.buyer_match_score||0)}%</strong><span>${Number(r.buyer_match_count||0)} matches</span>`;
      row.insertBefore(td,row.lastElementChild);
    });
  }

  async function topMatches(id){
    const {data,error}=await sb.from('opportunity_buyer_matches').select('bucket_id,score,match_reasons').eq('opportunity_id',id).order('score',{ascending:false}).limit(5);
    if(error||!data?.length)return[];
    const ids=data.map(x=>x.bucket_id);
    const b=await sb.from('originator_match_buckets').select('id,anonymous_label,is_synthetic').in('id',ids);
    if(b.error)return[];
    const map=new Map((b.data||[]).map(x=>[x.id,x]));
    return data.map(x=>({...x,bucket:map.get(x.bucket_id)})).filter(x=>x.bucket);
  }

  function decorateDrawer(id){
    const body=document.getElementById('drawerBody'),r=rec(id);if(!body||!r||r.side!=='Sell Side')return;
    body.querySelector('[data-obm-detail]')?.remove();
    const section=document.createElement('section');section.className='detailSec';section.dataset.obmDetail='1';
    if(floorBlocked(r)){
      section.innerHTML=`<div class="detailTitle">BUYER MATCHING</div><div class="obmHero"><div class="obmHeroTop"><span>Network Eligibility</span><strong>0%</strong></div><div class="obmHeroTitle">Below the $20M buyer-network floor</div><div class="obmHeroReason">No buyer mandate in the matching universe accepts an opportunity below $20M.</div></div>`;
    }else{
      section.innerHTML=`<div class="detailTitle">BUYER MATCHING</div><div class="obmHero"><div class="obmHeroTop"><span>${e(labelFor(r))}</span><strong>${Number(r.buyer_match_score||0)}%</strong></div><div class="obmHeroTitle">${e(r.buyer_match_label||'No mandate selected')}</div><div class="obmHeroReason">${e(reasonText(r))}</div><div id="obmTopMatches" class="obmTopList"><div class="obmTopReason">Loading top mandate fits...</div></div><div class="obmDisclosure">Modeled mandates are synthetic matching profiles used to test mandate fit. They are not representations of actual investor interest or capital commitments.</div></div>`;
    }
    const next=[...body.querySelectorAll('.detailSec')].find(x=>x.querySelector('.detailTitle')?.textContent==='NEXT STEP');
    next?body.insertBefore(section,next):body.appendChild(section);
    if(!floorBlocked(r)){
      topMatches(id).then(rows=>{
        if(typeof selectedId!=='undefined'&&String(selectedId)!==String(id))return;
        const box=document.getElementById('obmTopMatches');if(!box)return;
        box.innerHTML=rows.length?rows.map(x=>`<div class="obmTopRow"><div><div class="obmTopName">${e(x.bucket.anonymous_label)}</div><div class="obmTopReason">${e((x.match_reasons||[]).join(' · '))}</div></div><div class="obmTopScore">${Number(x.score||0)}%</div></div>`).join(''):'<div class="obmTopReason">No mandate matches are available yet.</div>';
      });
    }
  }

  function install(){
    installFormFields();
    const form=document.getElementById('oppForm');if(form)form.onsubmit=saveOpp;
    loadState();
    if(!channel&&typeof sb!=='undefined'){
      channel=sb.channel('internal-opportunity-buyer-matches-v1')
        .on('postgres_changes',{event:'*',schema:'public',table:'opportunities'},()=>scheduleRefresh())
        .on('postgres_changes',{event:'*',schema:'public',table:'opportunity_buyer_matches'},()=>scheduleRefresh())
        .subscribe();
    }
  }

  function scheduleRefresh(){clearTimeout(refreshTimer);refreshTimer=setTimeout(loadState,180)}

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(install,0));
  else setTimeout(install,0);
  let attempts=0;const retry=setInterval(()=>{attempts++;if(typeof currentUser!=='undefined'&&currentUser){loadState().then(ok=>{if(ok)clearInterval(retry)})}if(attempts>40)clearInterval(retry)},250);
})();