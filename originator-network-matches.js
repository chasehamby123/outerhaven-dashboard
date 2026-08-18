(function(){
  if(window.__outerhavenOriginatorNetworkMatches)return;
  window.__outerhavenOriginatorNetworkMatches=true;

  const MATCH_THRESHOLD=60;
  let buckets=[],matchRows=[],channel=null,loading=false;
  const q=id=>document.getElementById(id);
  const html=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  const norm=v=>String(v||'').trim().toLowerCase();
  const fmtMoney=v=>{const n=Number(v||0);if(!n)return'Flexible';if(n>=1e9)return'$'+(n/1e9).toFixed(n%1e9?1:0)+'B';if(n>=1e6)return'$'+(n/1e6).toFixed(n%1e6?1:0)+'M';return'$'+Math.round(n).toLocaleString()};

  const style=document.createElement('style');
  style.textContent=`
    .avatar{background:#171511!important;color:#ead6ba!important;border:1px solid rgba(0,0,0,.12)!important;box-shadow:0 4px 12px rgba(38,29,19,.12)!important}
    .networkMandatesPanel{margin-top:14px}.networkMandateGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.networkMandateCard{border:1px solid #d8c6b1;background:#f8f0e5;border-radius:12px;padding:13px}.networkMandateTop{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.networkMandateTitle{font-size:11px;font-weight:900;color:#201d18}.networkMandateRange{font-size:10px;font-weight:850;color:#5e5041;white-space:nowrap}.networkMandateRows{display:grid;gap:6px;margin-top:10px}.networkMandateRow{display:grid;grid-template-columns:74px 1fr;gap:8px;font-size:8px;line-height:1.45}.networkMandateRow span{color:#847565;font-weight:800;text-transform:uppercase}.networkMandateRow b{color:#4f4438;font-weight:750}
    .networkMatchBlock{margin-top:10px;border-top:1px solid #e0cfba;padding-top:9px}.networkMatchHead{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:6px}.networkMatchHead span{font-size:8px;text-transform:uppercase;letter-spacing:.07em;color:#7d7063;font-weight:900}.networkMatchHead b{font-size:8px;color:#7d7063}.networkMatchList{display:grid;gap:6px}.networkMatchRow{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:center;background:#f8f0e5;border:1px solid #dfcfbb;border-radius:8px;padding:7px 9px}.networkMatchName{font-size:9px;font-weight:850;color:#3e352c}.networkMatchReasons{font-size:7px;color:#817364;margin-top:2px;line-height:1.4}.networkMatchScore{font-size:13px;font-weight:900;color:#171511}.networkNoMatch{font-size:8px;color:#857769;padding:5px 0}
    .networkLivePreview{margin-top:12px;border-top:1px solid #dfcfbb;padding-top:11px}.networkLivePreviewHead{display:flex;justify-content:space-between;gap:8px;align-items:center;margin-bottom:7px}.networkLivePreviewHead span{font-size:8px;color:#766758;font-weight:900;text-transform:uppercase;letter-spacing:.06em}.networkLivePreviewHead b{font-size:8px;color:#766758}.networkLivePreview .networkMatchRow{background:#f5eadb}
    @media(max-width:760px){.networkMandateGrid{grid-template-columns:1fr}}
  `;
  document.head.appendChild(style);

  function rangeText(b){
    if(b.min_size&&b.max_size)return `${fmtMoney(b.min_size)} – ${fmtMoney(b.max_size)}`;
    if(b.min_size)return `${fmtMoney(b.min_size)}+`;
    if(b.max_size)return `Up to ${fmtMoney(b.max_size)}`;
    return'Flexible size';
  }
  function joined(a,fallback='Flexible'){return Array.isArray(a)&&a.length?a.join(', '):fallback}
  function textMatch(value,list,flex=[]){
    const x=norm(value);if(!Array.isArray(list)||!list.length)return true;
    return list.some(v=>{const y=norm(v);return flex.includes(y)||!y||(x&&y&&(x.includes(y)||y.includes(x)))})
  }
  function structureMatch(type,list){
    if(!Array.isArray(list)||!list.length)return true;
    const t=norm(type);
    return list.some(v=>{const x=norm(v);if(!x)return true;if(t.includes(x)||x.includes(t))return true;
      if(x==='equity'&&t.includes('equity'))return true;
      if(x==='debt'&&t.includes('debt'))return true;
      if((x==='acquisition'||x==='m&a')&&t.includes('acquisition'))return true;
      if(x==='sale'&&t.includes('sale'))return true;
      if(x==='structured capital'&&t.includes('structured'))return true;
      if(x==='joint venture'&&t.includes('joint venture'))return true;
      if(x==='strategic investment'&&t.includes('strategic'))return true;
      return false;
    });
  }
  function scoreInput(b){
    const amount=Number(q('dealAmount')?.value||0),sector=q('dealSector')?.value||'',geo=q('dealGeography')?.value||'',type=q('dealType')?.value||'';
    let score=0,reasons=[];
    if(!b.min_size&&!b.max_size){score+=15;reasons.push('Size flexible')}
    else if(amount&&(!b.min_size||amount>=Number(b.min_size))&&(!b.max_size||amount<=Number(b.max_size))){score+=35;reasons.push('Size aligned')}
    else if(amount&&((b.min_size&&amount>=Number(b.min_size)*.75&&amount<Number(b.min_size))||(b.max_size&&amount>Number(b.max_size)&&amount<=Number(b.max_size)*1.25))){score+=15;reasons.push('Size near range')}
    if(!b.sectors?.length){score+=15;reasons.push('Sector flexible')}else if(textMatch(sector,b.sectors,['all','any','sector agnostic','agnostic'])){score+=30;reasons.push('Sector aligned')}
    if(!b.geographies?.length){score+=10;reasons.push('Geography flexible')}else if(textMatch(geo,b.geographies,['all','any','global','worldwide'])){score+=20;reasons.push('Geography aligned')}
    if(!b.structures?.length){score+=10;reasons.push('Structure flexible')}else if(structureMatch(type,b.structures)){score+=15;reasons.push('Structure aligned')}
    return{score:Math.min(100,score),reasons};
  }

  async function load(){
    if(loading||typeof sb==='undefined')return;loading=true;
    try{
      const [b,m]=await Promise.all([
        sb.from('originator_match_buckets').select('id,anonymous_label,sectors,geographies,min_size,max_size,structures,active,updated_at').eq('active',true).order('anonymous_label'),
        sb.from('originator_submission_matches').select('submission_id,bucket_id,score,match_reasons,updated_at')
      ]);
      if(b.error){console.error('buyer mandate buckets',b.error);return}
      if(m.error){console.error('buyer mandate matches',m.error);return}
      buckets=b.data||[];matchRows=m.data||[];render();
    }finally{loading=false}
  }

  function ensureMandatesPanel(){
    const thesisSection=q('thesisSection');if(!thesisSection)return null;
    let panel=q('networkMandatesPanel');
    if(!panel){
      panel=document.createElement('section');panel.id='networkMandatesPanel';panel.className='panel networkMandatesPanel';
      panel.innerHTML='<div class="panelHead"><div><div class="eyebrow">BUYER MANDATES</div><h2>Current Buyer Mandates</h2><p>Specific mandates currently used to match submitted opportunities.</p></div></div><div id="networkMandateGrid" class="networkMandateGrid"></div>';
      thesisSection.appendChild(panel);
    }
    return panel;
  }
  function renderMandates(){
    ensureMandatesPanel();const grid=q('networkMandateGrid');if(!grid)return;
    grid.innerHTML=buckets.length?buckets.map(b=>`<article class="networkMandateCard"><div class="networkMandateTop"><div class="networkMandateTitle">${html(b.anonymous_label)}</div><div class="networkMandateRange">${html(rangeText(b))}</div></div><div class="networkMandateRows"><div class="networkMandateRow"><span>Sector</span><b>${html(joined(b.sectors))}</b></div><div class="networkMandateRow"><span>Geography</span><b>${html(joined(b.geographies))}</b></div><div class="networkMandateRow"><span>Structure</span><b>${html(joined(b.structures))}</b></div></div></article>`).join(''):'<div class="empty" style="grid-column:1/-1">No specific buyer mandates are published yet. The Outerhaven general thesis still applies.</div>';

    const home=q('homeThesis');
    if(home){home.querySelector('[data-network-mandate-count]')?.remove();home.insertAdjacentHTML('beforeend',`<div class="thesisQuickRow" data-network-mandate-count><span>Live buyer mandates</span><b>${buckets.length}</b></div>`)}
  }

  function matchesForSubmission(id){
    const map=new Map(buckets.map(b=>[b.id,b]));
    return matchRows.filter(r=>r.submission_id===id&&map.has(r.bucket_id)&&Number(r.score)>=MATCH_THRESHOLD).map(r=>({...r,bucket:map.get(r.bucket_id)})).sort((a,b)=>Number(b.score)-Number(a.score));
  }
  function renderSubmissionMatches(){
    if(typeof submissions==='undefined')return;
    const cards=[...document.querySelectorAll('#submissionCards .submissionCard')];
    cards.forEach((card,index)=>{
      const s=submissions[index];if(!s)return;
      const matchLabel=card.querySelector('.matchLabel');if(matchLabel)matchLabel.textContent='Outerhaven Baseline Match';
      card.querySelector('.networkMatchBlock')?.remove();
      const rows=matchesForSubmission(s.id);
      const target=card.firstElementChild;if(!target)return;
      const block=document.createElement('div');block.className='networkMatchBlock';
      block.innerHTML=`<div class="networkMatchHead"><span>Specific Buyer Matches</span><b>${rows.length} match${rows.length===1?'':'es'}</b></div>${rows.length?`<div class="networkMatchList">${rows.slice(0,5).map(r=>`<div class="networkMatchRow"><div><div class="networkMatchName">${html(r.bucket.anonymous_label)}</div><div class="networkMatchReasons">${html((r.match_reasons||[]).join(' · '))}</div></div><div class="networkMatchScore">${Number(r.score||0)}%</div></div>`).join('')}</div>`:`<div class="networkNoMatch">No specific buyer mandate currently reaches the ${MATCH_THRESHOLD}% match threshold.</div>`}`;
      const docs=target.querySelector('.docs');docs?target.insertBefore(block,docs):target.appendChild(block);
    });
  }

  function ensureLivePreview(){
    const checklist=q('fitChecklist');if(!checklist)return null;
    let box=q('networkLivePreview');
    if(!box){box=document.createElement('div');box.id='networkLivePreview';box.className='networkLivePreview';checklist.insertAdjacentElement('afterend',box)}
    return box;
  }
  function renderLivePreview(){
    const box=ensureLivePreview();if(!box)return;
    const amount=Number(q('dealAmount')?.value||0),sector=q('dealSector')?.value.trim()||'',geo=q('dealGeography')?.value.trim()||'',type=q('dealType')?.value||'';
    if(!buckets.length){box.innerHTML='<div class="networkLivePreviewHead"><span>Specific Buyer Mandates</span><b>0 live</b></div><div class="networkNoMatch">No specific mandates have been published yet.</div>';return}
    if(!amount&&!sector&&!geo&&!type){box.innerHTML=`<div class="networkLivePreviewHead"><span>Specific Buyer Mandates</span><b>${buckets.length} live</b></div><div class="networkNoMatch">Add opportunity details to preview buyer-specific fit.</div>`;return}
    const rows=buckets.map(b=>({bucket:b,...scoreInput(b)})).sort((a,b)=>b.score-a.score);
    box.innerHTML=`<div class="networkLivePreviewHead"><span>Specific Buyer Mandates</span><b>${buckets.length} live</b></div><div class="networkMatchList">${rows.slice(0,3).map(r=>`<div class="networkMatchRow"><div><div class="networkMatchName">${html(r.bucket.anonymous_label)}</div><div class="networkMatchReasons">${html(r.reasons.join(' · ')||'Complete more fields')}</div></div><div class="networkMatchScore">${r.score}%</div></div>`).join('')}</div>`;
  }

  function render(){renderMandates();renderSubmissionMatches();renderLivePreview()}

  document.addEventListener('input',e=>{if(['dealAmount','dealSector','dealGeography','dealType'].includes(e.target?.id))renderLivePreview()});
  document.addEventListener('change',e=>{if(['dealAmount','dealSector','dealGeography','dealType'].includes(e.target?.id))renderLivePreview()});

  try{
    if(typeof renderAll==='function'){
      const baseRenderAll=renderAll;
      renderAll=function(){baseRenderAll();setTimeout(render,0)};
    }
  }catch{}

  function realtime(){
    if(channel||typeof sb==='undefined')return;
    channel=sb.channel('originator-network-mandates-v2')
      .on('postgres_changes',{event:'*',schema:'public',table:'originator_match_buckets'},load)
      .on('postgres_changes',{event:'*',schema:'public',table:'originator_submission_matches'},load)
      .subscribe();
  }

  load();realtime();setInterval(load,60000);
})();