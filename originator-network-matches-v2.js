(function(){
  if(window.__outerhavenOriginatorNetworkMatchesV2)return;
  window.__outerhavenOriginatorNetworkMatchesV2=true;

  const FLOOR=20000000;
  const MATCH_THRESHOLD=60;
  const PAGE_SIZE=1000;
  let buckets=[],matchRows=[],channel=null,loading=false;
  const q=id=>document.getElementById(id);
  const html=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  const norm=v=>String(v||'').trim().toLowerCase();
  const parseAmount=v=>typeof window.__outerhavenParseDealAmount==='function'?window.__outerhavenParseDealAmount(v):Number(v||0)||0;
  const fmtMoney=v=>{const n=Number(v||0);if(!n)return'Flexible';if(n>=1e9)return'$'+(n/1e9).toFixed(n%1e9?1:0)+'B';if(n>=1e6)return'$'+(n/1e6).toFixed(n%1e6?1:0)+'M';return'$'+Math.round(n).toLocaleString()};

  const style=document.createElement('style');
  style.textContent=`
    .networkMandatesPanel{margin-top:14px}.networkMandateSummary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px;margin-bottom:11px}.networkMandateMetric{border:1px solid #ded3c4;background:#faf5ee;border-radius:10px;padding:10px}.networkMandateMetric span{display:block;font-size:8px;color:#837568;text-transform:uppercase;font-weight:900;letter-spacing:.06em}.networkMandateMetric strong{display:block;font-size:18px;color:#1f1b17;margin-top:3px}.networkMandateGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.networkMandateCard{border:1px solid #ded3c4;background:#faf5ee;border-radius:11px;padding:11px}.networkMandateTop{display:flex;justify-content:space-between;gap:10px}.networkMandateTitle{font-size:9.5px;font-weight:900;color:#332c25}.networkMandateRange{font-size:8.5px;font-weight:850;color:#756658;white-space:nowrap}.networkMandateRows{display:grid;gap:5px;margin-top:8px}.networkMandateRow{display:grid;grid-template-columns:62px 1fr;gap:7px;font-size:7.5px;line-height:1.4}.networkMandateRow span{color:#8a7a69;text-transform:uppercase;font-weight:900}.networkMandateRow b{color:#5a4d41}.networkModelNote{font-size:8px;line-height:1.5;color:#7a6d61;margin:10px 0 0}.networkMatchBlock{margin-top:10px;border-top:1px solid #e1d5c6;padding-top:9px}.networkMatchHead{display:flex;justify-content:space-between;gap:10px;align-items:center}.networkMatchHead span{font-size:8px;font-weight:900;text-transform:uppercase;color:#77695d;letter-spacing:.06em}.networkMatchHead b{font-size:8px;color:#77695d}.networkMatchList{display:grid;gap:6px;margin-top:6px}.networkMatchRow{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:center;border:1px solid #dfd0bd;background:#f9f1e6;border-radius:8px;padding:7px 9px}.networkMatchName{font-size:8.5px;font-weight:850;color:#42382f}.networkMatchReasons{font-size:7px;color:#837466;margin-top:2px;line-height:1.35}.networkMatchScore{font-size:13px;font-weight:950;color:#171511}.networkNoMatch{font-size:8px;color:#87786a;padding:7px 0}.networkLivePreview{margin-top:11px;border-top:1px solid #ded1c1;padding-top:10px}.networkLivePreviewHead{display:flex;justify-content:space-between;gap:10px}.networkLivePreviewHead span,.networkLivePreviewHead b{font-size:8px;color:#77695d;font-weight:900}.networkLivePreviewHead span{text-transform:uppercase;letter-spacing:.06em}@media(max-width:760px){.networkMandateSummary,.networkMandateGrid{grid-template-columns:1fr}}
  `;
  document.head.appendChild(style);

  function rangeText(b){if(b.min_size&&b.max_size)return`${fmtMoney(b.min_size)} – ${fmtMoney(b.max_size)}`;if(b.min_size)return`${fmtMoney(b.min_size)}+`;return'$20M+'}
  function joined(a,f='Flexible'){return Array.isArray(a)&&a.length?a.join(', '):f}
  function textMatch(value,list,flex=[]){const x=norm(value);if(!Array.isArray(list)||!list.length)return true;return list.some(v=>{const y=norm(v);return flex.includes(y)||!y||(x&&y&&(x.includes(y)||y.includes(x)))})}
  function structureMatch(type,list){if(!Array.isArray(list)||!list.length)return true;const t=norm(type);return list.some(v=>{const x=norm(v);if(!x)return true;if(t&&x&&(t.includes(x)||x.includes(t)))return true;if(x==='equity'&&t.includes('equity'))return true;if(x==='debt'&&t.includes('debt'))return true;if((x==='acquisition'||x==='m&a'||x==='full or partial acquisition')&&t.includes('acquisition'))return true;if((x==='sale'||x==='full or partial sale')&&t.includes('sale'))return true;if(x==='structured capital'&&t.includes('structured'))return true;if(x==='joint venture'&&t.includes('joint'))return true;if(x==='strategic investment'&&t.includes('strategic'))return true;return false})}
  function currentInput(){return{amount:parseAmount(q('dealAmount')?.value),sector:q('dealSector')?.value.trim()||'',geo:q('dealGeography')?.value.trim()||'',type:q('dealType')?.value||'',title:q('dealTitle')?.value.trim()||'',summary:q('dealSummary')?.value.trim()||''}}

  function scoreInput(b){
    const {amount,sector,geo,type}=currentInput();
    if(amount&&amount<FLOOR)return{score:0,reasons:['Below $20M network floor']};
    let score=0,reasons=[];
    if(!amount)reasons.push('Size not specified');
    else if(amount>=Number(b.min_size||FLOOR)&&(!b.max_size||amount<=Number(b.max_size))){score+=35;reasons.push('Size aligned')}
    else if((b.min_size&&amount>=Number(b.min_size)*.75&&amount<Number(b.min_size))||(b.max_size&&amount>Number(b.max_size)&&amount<=Number(b.max_size)*1.25)){score+=15;reasons.push('Size near range')}
    else reasons.push('Size outside range');
    if(!b.sectors?.length){score+=15;reasons.push('Sector flexible')}else if(textMatch(sector,b.sectors,['all','any','sector agnostic','agnostic'])){score+=30;reasons.push('Sector aligned')}else reasons.push('Sector not aligned');
    if(!b.geographies?.length){score+=10;reasons.push('Geography flexible')}else if(textMatch(geo,b.geographies,['all','any','global','worldwide'])){score+=20;reasons.push('Geography aligned')}else reasons.push('Geography not aligned');
    if(!b.structures?.length){score+=10;reasons.push('Structure flexible')}else if(structureMatch(type,b.structures)){score+=15;reasons.push('Structure aligned')}else reasons.push('Structure not aligned');
    return{score:Math.min(100,score),reasons};
  }

  async function fetchAllBuckets(){
    const out=[];let from=0;
    while(true){
      const {data,error}=await sb.from('originator_match_buckets').select('id,anonymous_label,sectors,geographies,min_size,max_size,structures,active,is_synthetic,updated_at').eq('active',true).order('anonymous_label').range(from,from+PAGE_SIZE-1);
      if(error)throw error;out.push(...(data||[]));if(!data||data.length<PAGE_SIZE)break;from+=PAGE_SIZE;
    }
    return out;
  }
  async function fetchAllMatches(){
    const out=[];let from=0;
    while(true){
      const {data,error}=await sb.from('originator_submission_matches').select('submission_id,bucket_id,score,match_reasons,updated_at').range(from,from+PAGE_SIZE-1);
      if(error)throw error;out.push(...(data||[]));if(!data||data.length<PAGE_SIZE)break;from+=PAGE_SIZE;
    }
    return out;
  }

  async function load(){
    if(loading||typeof sb==='undefined')return;loading=true;
    try{[buckets,matchRows]=await Promise.all([fetchAllBuckets(),fetchAllMatches()]);render()}
    catch(err){console.error('mandate matching universe',err)}finally{loading=false}
  }

  function ensurePanel(){
    const section=q('thesisSection');if(!section)return null;let panel=q('networkMandatesPanel');
    if(!panel){panel=document.createElement('section');panel.id='networkMandatesPanel';panel.className='panel networkMandatesPanel';panel.innerHTML='<div class="panelHead"><div><div class="eyebrow">MANDATE MATCHING UNIVERSE</div><h2>Buyer Mandate Profiles</h2><p>Mandate profiles used to test opportunity fit by size, sector, geography, and structure.</p></div></div><div id="networkMandateSummary" class="networkMandateSummary"></div><div id="networkMandateGrid" class="networkMandateGrid"></div><p class="networkModelNote">Modeled mandates are synthetic matching profiles. They test mandate fit and do not represent actual investor interest, approval, or committed capital.</p>';section.appendChild(panel)}return panel;
  }
  function renderMandates(){
    ensurePanel();const grid=q('networkMandateGrid'),summary=q('networkMandateSummary');if(!grid||!summary)return;
    const modeled=buckets.filter(x=>x.is_synthetic),live=buckets.filter(x=>!x.is_synthetic);
    summary.innerHTML=`<div class="networkMandateMetric"><span>Modeled profiles</span><strong>${modeled.length.toLocaleString()}</strong></div><div class="networkMandateMetric"><span>Live shared theses</span><strong>${live.length.toLocaleString()}</strong></div><div class="networkMandateMetric"><span>Minimum size</span><strong>$20M</strong></div>`;
    const sample=[...live,...modeled.slice(0,15)].slice(0,16);
    grid.innerHTML=sample.map(b=>`<article class="networkMandateCard"><div class="networkMandateTop"><div class="networkMandateTitle">${html(b.anonymous_label)}</div><div class="networkMandateRange">${html(rangeText(b))}</div></div><div class="networkMandateRows"><div class="networkMandateRow"><span>Sector</span><b>${html(joined(b.sectors))}</b></div><div class="networkMandateRow"><span>Geography</span><b>${html(joined(b.geographies))}</b></div><div class="networkMandateRow"><span>Structure</span><b>${html(joined(b.structures))}</b></div></div></article>`).join('');
    const home=q('homeThesis');if(home){home.querySelector('[data-network-mandate-count]')?.remove();home.insertAdjacentHTML('beforeend',`<div class="thesisQuickRow" data-network-mandate-count><span>Mandate profiles modeled</span><b>${modeled.length.toLocaleString()}</b></div>`)}
  }

  function matchesForSubmission(id){const map=new Map(buckets.map(b=>[b.id,b]));return matchRows.filter(r=>r.submission_id===id&&map.has(r.bucket_id)&&Number(r.score)>=MATCH_THRESHOLD).map(r=>({...r,bucket:map.get(r.bucket_id)})).sort((a,b)=>Number(b.score)-Number(a.score))}
  function renderSubmissionMatches(){
    if(typeof submissions==='undefined')return;const cards=[...document.querySelectorAll('#submissionCards .submissionCard')];
    cards.forEach((card,index)=>{const s=submissions[index];if(!s)return;card.querySelector('.networkMatchBlock')?.remove();const rows=matchesForSubmission(s.id),target=card.firstElementChild;if(!target)return;const block=document.createElement('div');block.className='networkMatchBlock';block.innerHTML=`<div class="networkMatchHead"><span>Mandate Matches</span><b>${rows.length} at ${MATCH_THRESHOLD}%+</b></div>${rows.length?`<div class="networkMatchList">${rows.slice(0,5).map(r=>`<div class="networkMatchRow"><div><div class="networkMatchName">${html(r.bucket.anonymous_label)}</div><div class="networkMatchReasons">${html((r.match_reasons||[]).join(' · '))}</div></div><div class="networkMatchScore">${Number(r.score||0)}%</div></div>`).join('')}</div>`:'<div class="networkNoMatch">No mandate profile currently reaches the match threshold.</div>'}`;const docs=target.querySelector('.docs');docs?target.insertBefore(block,docs):target.appendChild(block)})
  }

  function ensureLive(){const checklist=q('fitChecklist');if(!checklist)return null;let box=q('networkLivePreview');if(!box){box=document.createElement('div');box.id='networkLivePreview';box.className='networkLivePreview';checklist.insertAdjacentElement('afterend',box)}return box}
  function renderLive(){
    const box=ensureLive();if(!box)return;const input=currentInput();
    if(!buckets.length){box.innerHTML='<div class="networkNoMatch">Mandate universe is loading.</div>';return}
    if(input.amount>0&&input.amount<FLOOR){box.innerHTML=`<div class="networkLivePreviewHead"><span>Mandate Matching</span><b>${buckets.length.toLocaleString()} profiles</b></div><div class="networkNoMatch">0% buyer fit: no mandate profile accepts opportunities below $20M.</div>`;return}
    if(!input.amount&&!input.sector&&!input.geo&&!input.type){box.innerHTML=`<div class="networkLivePreviewHead"><span>Mandate Matching</span><b>${buckets.length.toLocaleString()} profiles</b></div><div class="networkNoMatch">Add deal details to calculate buyer-specific fit.</div>`;return}
    const rows=buckets.map(b=>({bucket:b,...scoreInput(b)})).sort((a,b)=>b.score-a.score);
    box.innerHTML=`<div class="networkLivePreviewHead"><span>Top mandate fits</span><b>${buckets.length.toLocaleString()} profiles scored</b></div><div class="networkMatchList">${rows.slice(0,3).map(r=>`<div class="networkMatchRow"><div><div class="networkMatchName">${html(r.bucket.anonymous_label)}</div><div class="networkMatchReasons">${html(r.reasons.join(' · '))}</div></div><div class="networkMatchScore">${r.score}%</div></div>`).join('')}</div>`;
  }

  function renderBest(){
    const amount=currentInput().amount,scoreEl=q('estimateScore'),ring=q('estimateRing'),label=q('estimateLabel'),copy=q('estimateCopy');if(!scoreEl||!ring||!label||!copy)return;
    if(amount>0&&amount<FLOOR){scoreEl.textContent='0%';ring.style.setProperty('--score','0%');const span=ring.querySelector('span');if(span)span.textContent='Buyer Match';label.textContent='Below $20M network floor';copy.textContent='No buyer mandate profile accepts an opportunity below $20M.';return}
    if(!buckets.length)return;const best=buckets.map(b=>({bucket:b,...scoreInput(b)})).sort((a,b)=>b.score-a.score)[0];if(!best)return;
    scoreEl.textContent=best.score+'%';ring.style.setProperty('--score',best.score+'%');const span=ring.querySelector('span');if(span)span.textContent='Buyer Match';label.textContent=best.bucket.anonymous_label;copy.textContent=`Best current mandate-profile fit. ${best.reasons.join(' · ')}`;
  }

  function render(){renderMandates();renderSubmissionMatches();renderLive();renderBest()}
  document.addEventListener('input',e=>{if(['dealAmount','dealSector','dealGeography','dealType','dealTitle','dealCompany','dealSummary'].includes(e.target?.id)){renderLive();renderBest()}});
  document.addEventListener('change',e=>{if(['dealAmount','dealSector','dealGeography','dealType'].includes(e.target?.id)){renderLive();renderBest()}});

  try{if(typeof renderEstimate==='function'){const base=renderEstimate;renderEstimate=function(){base();queueMicrotask(()=>{renderLive();renderBest()})}}if(typeof renderAll==='function'){const base=renderAll;renderAll=function(){base();setTimeout(render,0)}}}catch{}

  function realtime(){if(channel||typeof sb==='undefined')return;channel=sb.channel('originator-mandate-universe-v4').on('postgres_changes',{event:'*',schema:'public',table:'originator_match_buckets'},load).on('postgres_changes',{event:'*',schema:'public',table:'originator_submission_matches'},load).subscribe()}
  load();realtime();setInterval(load,60000);
})();