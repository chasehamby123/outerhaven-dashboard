(function(){
  if(window.__outerhavenOriginatorNetworkMatchesV2)return;
  window.__outerhavenOriginatorNetworkMatchesV2=true;

  const FLOOR=20000000;
  const MATCH_THRESHOLD=75;
  const PAGE_SIZE=1000;
  let buckets=[],matchRows=[],channel=null,loading=false,previewRows=[],previewTimer=null,previewSeq=0,editingMatchField=false;
  const q=id=>document.getElementById(id);
  const html=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  const parseAmount=v=>typeof window.__outerhavenParseDealAmount==='function'?window.__outerhavenParseDealAmount(v):Number(v||0)||0;
  const fmtMoney=v=>{const n=Number(v||0);if(!n)return'Flexible';if(n>=1e9)return'$'+(n/1e9).toFixed(n%1e9?1:0)+'B';if(n>=1e6)return'$'+(n/1e6).toFixed(n%1e6?1:0)+'M';return'$'+Math.round(n).toLocaleString()};
  const MATCH_TEXT_FIELDS=new Set(['dealAmount','dealSector','dealGeography']);

  const style=document.createElement('style');
  style.textContent=`
    .networkMandatesPanel{margin-top:14px}.networkMandateSummary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px;margin-bottom:11px}.networkMandateMetric{border:1px solid #ded3c4;background:#faf5ee;border-radius:10px;padding:10px}.networkMandateMetric span{display:block;font-size:8px;color:#837568;text-transform:uppercase;font-weight:900;letter-spacing:.06em}.networkMandateMetric strong{display:block;font-size:18px;color:#1f1b17;margin-top:3px}.networkMandateGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.networkMandateCard{border:1px solid #ded3c4;background:#faf5ee;border-radius:11px;padding:11px}.networkMandateTop{display:flex;justify-content:space-between;gap:10px}.networkMandateTitle{font-size:9.5px;font-weight:900;color:#332c25}.networkMandateRange{font-size:8.5px;font-weight:850;color:#756658;white-space:nowrap}.networkMandateRows{display:grid;gap:5px;margin-top:8px}.networkMandateRow{display:grid;grid-template-columns:62px 1fr;gap:7px;font-size:7.5px;line-height:1.4}.networkMandateRow span{color:#8a7a69;text-transform:uppercase;font-weight:900}.networkMandateRow b{color:#5a4d41}.networkMatchBlock{margin-top:10px;border-top:1px solid #e1d5c6;padding-top:9px}.networkMatchHead{display:flex;justify-content:space-between;gap:10px;align-items:center}.networkMatchHead span{font-size:8px;font-weight:900;text-transform:uppercase;color:#77695d;letter-spacing:.06em}.networkMatchHead b{font-size:8px;color:#77695d}.networkMatchList{display:grid;gap:6px;margin-top:6px}.networkMatchRow{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:center;border:1px solid #dfd0bd;background:#f9f1e6;border-radius:8px;padding:7px 9px}.networkMatchName{font-size:8.5px;font-weight:850;color:#42382f}.networkMatchReasons{font-size:7px;color:#837466;margin-top:2px;line-height:1.35}.networkMatchScore{font-size:13px;font-weight:950;color:#171511}.networkNoMatch{font-size:8px;color:#87786a;padding:7px 0}.networkLivePreview{margin-top:11px;border-top:1px solid #ded1c1;padding-top:10px}.networkLivePreviewHead{display:flex;justify-content:space-between;gap:10px}.networkLivePreviewHead span,.networkLivePreviewHead b{font-size:8px;color:#77695d;font-weight:900}.networkLivePreviewHead span{text-transform:uppercase;letter-spacing:.06em}@media(max-width:760px){.networkMandateSummary,.networkMandateGrid{grid-template-columns:1fr}}
  `;
  document.head.appendChild(style);

  function rangeText(b){if(b.min_size&&b.max_size)return`${fmtMoney(b.min_size)} – ${fmtMoney(b.max_size)}`;if(b.min_size)return`${fmtMoney(b.min_size)}+`;return'$20M+'}
  function joined(a,f='Flexible'){return Array.isArray(a)&&a.length?a.join(', '):f}
  function currentInput(){return{amount:parseAmount(q('dealAmount')?.value),sector:q('dealSector')?.value.trim()||'',geo:q('dealGeography')?.value.trim()||'',type:q('dealType')?.value||''}}
  function scoreBand(score){const n=Number(score||0);if(n>=90)return'Excellent mandate fit';if(n>=80)return'Strong mandate fit';if(n>=75)return'Good mandate fit';if(n>=60)return'Possible mandate fit';return'Weak mandate fit'}

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
    try{[buckets,matchRows]=await Promise.all([fetchAllBuckets(),fetchAllMatches()]);renderMandates();renderSubmissionMatches();requestPreview(true)}
    catch(err){console.error('mandate matching universe',err)}finally{loading=false}
  }

  function ensurePanel(){
    const section=q('thesisSection');if(!section)return null;let panel=q('networkMandatesPanel');
    if(!panel){
      panel=document.createElement('section');panel.id='networkMandatesPanel';panel.className='panel networkMandatesPanel';
      panel.innerHTML='<div class="panelHead"><div><div class="eyebrow">BUYER MANDATES</div><h2>Mandate Profiles</h2><p>Opportunity fit is tested by transaction size, sector, geography, and structure.</p></div></div><div id="networkMandateSummary" class="networkMandateSummary"></div><div id="networkMandateGrid" class="networkMandateGrid"></div>';
      section.appendChild(panel)
    }
    return panel;
  }

  function renderMandates(){
    ensurePanel();const grid=q('networkMandateGrid'),summary=q('networkMandateSummary');if(!grid||!summary)return;
    const synthetic=buckets.filter(x=>x.is_synthetic);
    summary.innerHTML=`<div class="networkMandateMetric"><span>Family office profiles</span><strong>${synthetic.length.toLocaleString()}</strong></div><div class="networkMandateMetric"><span>Strong-fit threshold</span><strong>${MATCH_THRESHOLD}%</strong></div><div class="networkMandateMetric"><span>Minimum size</span><strong>$20M</strong></div>`;
    grid.innerHTML=synthetic.map(b=>`<article class="networkMandateCard"><div class="networkMandateTop"><div class="networkMandateTitle">${html(b.anonymous_label)}</div><div class="networkMandateRange">${html(rangeText(b))}</div></div><div class="networkMandateRows"><div class="networkMandateRow"><span>Sector</span><b>${html(joined(b.sectors))}</b></div><div class="networkMandateRow"><span>Geography</span><b>${html(joined(b.geographies))}</b></div><div class="networkMandateRow"><span>Structure</span><b>${html(joined(b.structures))}</b></div></div></article>`).join('');
    const home=q('homeThesis');if(home){home.querySelector('[data-network-mandate-count]')?.remove();home.insertAdjacentHTML('beforeend',`<div class="thesisQuickRow" data-network-mandate-count><span>Family office profiles</span><b>${synthetic.length.toLocaleString()}</b></div>`)}
  }

  function matchesForSubmission(id){
    const map=new Map(buckets.filter(b=>b.is_synthetic).map(b=>[b.id,b]));
    return matchRows.filter(r=>r.submission_id===id&&map.has(r.bucket_id)&&Number(r.score)>=MATCH_THRESHOLD).map(r=>({...r,bucket:map.get(r.bucket_id)})).sort((a,b)=>Number(b.score)-Number(a.score));
  }

  function renderSubmissionMatches(){
    if(typeof submissions==='undefined')return;
    const cards=[...document.querySelectorAll('#submissionCards .submissionCard')];
    cards.forEach((card,index)=>{
      const s=submissions[index];if(!s)return;card.querySelector('.networkMatchBlock')?.remove();
      const rows=matchesForSubmission(s.id),target=card.firstElementChild;if(!target)return;
      const block=document.createElement('div');block.className='networkMatchBlock';
      block.innerHTML=`<div class="networkMatchHead"><span>Mandate Matches</span><b>${rows.length} at ${MATCH_THRESHOLD}%+</b></div>${rows.length?`<div class="networkMatchList">${rows.slice(0,5).map(r=>`<div class="networkMatchRow"><div><div class="networkMatchName">${html(r.bucket.anonymous_label)}</div><div class="networkMatchReasons">${html((r.match_reasons||[]).join(' · '))}</div></div><div class="networkMatchScore">${Number(r.score||0)}%</div></div>`).join('')}</div>`:'<div class="networkNoMatch">No mandate currently reaches the strong-fit threshold.</div>'}`;
      const docs=target.querySelector('.docs');docs?target.insertBefore(block,docs):target.appendChild(block)
    })
  }

  function ensureLive(){
    const checklist=q('fitChecklist');if(!checklist)return null;let box=q('networkLivePreview');
    if(!box){box=document.createElement('div');box.id='networkLivePreview';box.className='networkLivePreview';checklist.insertAdjacentElement('afterend',box)}
    return box;
  }

  function renderPreview(){
    const box=ensureLive();if(!box)return;
    const input=currentInput(),syntheticCount=buckets.filter(x=>x.is_synthetic).length;
    if(input.amount>0&&input.amount<FLOOR){
      box.innerHTML=`<div class="networkLivePreviewHead"><span>Mandate Matching</span><b>${syntheticCount} profiles</b></div><div class="networkNoMatch">0% fit: the opportunity is below the $20M network floor.</div>`;
      applyBest({score:0,anonymous_label:'Below $20M network floor',match_reasons:['No family office profile accepts an opportunity below $20M.']});return;
    }
    if(!input.amount&&!input.sector&&!input.geo&&!input.type){
      box.innerHTML=`<div class="networkLivePreviewHead"><span>Mandate Matching</span><b>${syntheticCount} profiles</b></div><div class="networkNoMatch">Add the transaction details to calculate fit.</div>`;
      applyBest(null);return;
    }
    if(!previewRows.length){
      box.innerHTML=`<div class="networkLivePreviewHead"><span>Mandate Matching</span><b>${syntheticCount} profiles</b></div><div class="networkNoMatch">Calculating current mandate fit...</div>`;return;
    }
    box.innerHTML=`<div class="networkLivePreviewHead"><span>Top mandate fits</span><b>${syntheticCount} profiles tested</b></div><div class="networkMatchList">${previewRows.slice(0,3).map(r=>`<div class="networkMatchRow"><div><div class="networkMatchName">${html(r.anonymous_label)}</div><div class="networkMatchReasons">${html((r.match_reasons||[]).join(' · '))}</div></div><div class="networkMatchScore">${Number(r.score||0)}%</div></div>`).join('')}</div>`;
    applyBest(previewRows[0]);
  }

  function applyBest(best){
    const scoreEl=q('estimateScore'),ring=q('estimateRing'),label=q('estimateLabel'),copy=q('estimateCopy');if(!scoreEl||!ring||!label||!copy)return;
    if(!best){scoreEl.textContent='0%';ring.style.setProperty('--score','0%');const span=ring.querySelector('span');if(span)span.textContent='Mandate Fit';label.textContent='Complete the submission';copy.textContent='Add size, sector, geography, and structure to calculate mandate fit.';return}
    const score=Number(best.score||0);scoreEl.textContent=score+'%';ring.style.setProperty('--score',score+'%');const span=ring.querySelector('span');if(span)span.textContent='Mandate Fit';label.textContent=scoreBand(score);copy.textContent=`${best.anonymous_label}. ${(best.match_reasons||[]).join(' · ')}`;
  }

  function requestPreview(immediate=false){
    clearTimeout(previewTimer);
    if(editingMatchField&&!immediate)return;
    const run=async()=>{
      const input=currentInput(),seq=++previewSeq;
      if(input.amount>0&&input.amount<FLOOR){previewRows=[];renderPreview();return}
      if(!input.amount&&!input.sector&&!input.geo&&!input.type){previewRows=[];renderPreview();return}
      try{
        const {data,error}=await sb.rpc('preview_buyer_mandate_matches',{p_amount:input.amount||null,p_sector:input.sector||null,p_geography:input.geo||null,p_structure:input.type||null,p_limit:5});
        if(error)throw error;if(seq!==previewSeq)return;previewRows=(data||[]).filter(r=>r.is_synthetic);renderPreview();
      }catch(err){if(seq!==previewSeq)return;console.error('buyer mandate preview',err);previewRows=[];renderPreview()}
    };
    if(immediate)run();else previewTimer=setTimeout(run,180);
  }

  document.addEventListener('focusin',e=>{if(MATCH_TEXT_FIELDS.has(e.target?.id))editingMatchField=true});
  document.addEventListener('focusout',e=>{
    if(!MATCH_TEXT_FIELDS.has(e.target?.id))return;
    editingMatchField=false;
    setTimeout(()=>requestPreview(true),0);
  });
  document.addEventListener('change',e=>{if(e.target?.id==='dealType')requestPreview(true)});

  try{
    if(typeof renderEstimate==='function'){
      const base=renderEstimate;
      renderEstimate=function(){base();if(!editingMatchField)requestPreview(false)};
    }
    if(typeof renderAll==='function'){
      const base=renderAll;
      renderAll=function(){base();setTimeout(()=>{renderMandates();renderSubmissionMatches();if(!editingMatchField)requestPreview(true)},0)};
    }
  }catch{}

  function realtime(){
    if(channel||typeof sb==='undefined')return;
    channel=sb.channel('originator-mandate-universe-v7')
      .on('postgres_changes',{event:'*',schema:'public',table:'originator_match_buckets'},load)
      .on('postgres_changes',{event:'*',schema:'public',table:'originator_submission_matches'},load)
      .subscribe();
  }

  load();realtime();setInterval(()=>{if(!editingMatchField)load()},60000);
})();
// exact 42 family office profiles v7
