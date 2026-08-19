(function(){
  if(window.__outerhavenOriginatorActivity)return;
  window.__outerhavenOriginatorActivity=true;

  const MATCH_THRESHOLD=75;
  let activityRows=[],matchRows=[],syntheticIds=new Set(),loading=false,channel=null;
  const q=id=>document.getElementById(id);
  const html=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));

  const style=document.createElement('style');
  style.textContent=`
    .oaPanel{margin-top:14px}.oaPanelHead{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;margin-bottom:12px}.oaPanelHead h2{margin:3px 0 0}.oaPanelHead p{margin:4px 0 0;font-size:8.5px;color:#817568;line-height:1.5}.oaLive{font-size:7.5px;font-weight:900;text-transform:uppercase;letter-spacing:.08em;color:#5d5145;border:1px solid #d8c8b5;background:#fbf5ec;border-radius:999px;padding:5px 7px;white-space:nowrap}.oaFeed{display:grid;gap:7px}.oaFeedRow{display:grid;grid-template-columns:9px minmax(0,1fr) auto;gap:9px;align-items:start;border:1px solid #e1d5c6;background:#fbf7f1;border-radius:10px;padding:9px 10px}.oaDot{width:7px;height:7px;border-radius:50%;background:#9b8a78;margin-top:4px;box-shadow:0 0 0 3px rgba(155,138,120,.12)}.oaFeedRow[data-type="buyer_interest"] .oaDot,.oaFeedRow[data-type="engagement_active"] .oaDot{background:#3f7058;box-shadow:0 0 0 3px rgba(63,112,88,.12)}.oaFeedRow[data-type="potential_matches"] .oaDot,.oaFeedRow[data-type="matching_started"] .oaDot,.oaFeedRow[data-type="approved_for_matching"] .oaDot{background:#6f604f;box-shadow:0 0 0 3px rgba(111,96,79,.12)}.oaFeedCopy strong{display:block;font-size:9px;color:#2e2923}.oaFeedCopy span{display:block;font-size:7.8px;color:#807366;margin-top:2px;line-height:1.45}.oaDealName{font-weight:800;color:#5b5045}.oaTime{font-size:7.2px;color:#97897b;white-space:nowrap;padding-top:1px}.oaEmpty{font-size:8.5px;color:#85786c;border:1px dashed #d9ccbd;border-radius:10px;padding:12px;background:#fbf8f4}.oaSubmission{margin-top:10px;border-top:1px solid #e2d7ca;padding-top:10px}.oaSubmissionTop{display:flex;align-items:center;justify-content:space-between;gap:10px}.oaSubmissionTop span{font-size:7.5px;font-weight:900;text-transform:uppercase;letter-spacing:.07em;color:#817467}.oaMatchCount{font-size:7.5px;font-weight:850;color:#66584b}.oaStages{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:4px;margin-top:7px}.oaStage{position:relative;border:1px solid #e0d5c8;background:#f8f4ef;border-radius:7px;padding:6px 4px;text-align:center;font-size:6.8px;font-weight:850;color:#a09386;line-height:1.2}.oaStage.complete{background:#f2ece4;color:#5f5347;border-color:#d8c8b7}.oaStage.current{background:#29241f;color:#fff;border-color:#29241f}.oaTimeline{display:grid;gap:5px;margin-top:7px}.oaTimelineRow{display:grid;grid-template-columns:7px minmax(0,1fr) auto;gap:7px;align-items:start}.oaTimelineDot{width:5px;height:5px;border-radius:50%;background:#ad9d8d;margin-top:4px}.oaTimelineCopy strong{display:block;font-size:7.8px;color:#4b4239}.oaTimelineCopy span{display:block;font-size:7px;color:#897b6e;margin-top:1px;line-height:1.4}.oaTimelineTime{font-size:6.8px;color:#9d9084;white-space:nowrap}.oaStatusPill{font-size:7px;font-weight:900;border:1px solid #d7c7b6;background:#f9f2e9;color:#665646;border-radius:999px;padding:4px 6px;white-space:nowrap}
    @media(max-width:760px){.oaPanelHead{align-items:flex-start}.oaFeedRow{grid-template-columns:9px minmax(0,1fr)}.oaTime{grid-column:2}.oaStages{grid-template-columns:repeat(5,1fr)}.oaStage{font-size:6px;padding:6px 2px}.oaTimelineRow{grid-template-columns:7px minmax(0,1fr)}.oaTimelineTime{grid-column:2}}
  `;
  document.head.appendChild(style);

  function dateTime(v){
    if(!v)return'';
    const d=new Date(v);if(Number.isNaN(d.getTime()))return'';
    return d.toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
  }

  function submissionById(id){return typeof submissions!=='undefined'?submissions.find(s=>s.id===id):null}

  function currentStageIndex(s){
    const status=String(s?.status||'');
    if(status==='Engagement Active')return 4;
    if(status==='Buyer Interest')return 3;
    if(status==='Matching')return 2;
    if((s?.submission_state||'')==='submitted')return 1;
    return 0;
  }

  function statusLabel(s){
    if((s?.submission_state||'')==='awaiting_diligence')return'Diligence Required';
    if(s?.status==='Received'&&s?.review_decision==='pending')return'Under Review';
    return s?.status||'Received';
  }

  function potentialFor(id){
    return matchRows.filter(r=>r.submission_id===id&&syntheticIds.has(r.bucket_id)&&Number(r.score)>=MATCH_THRESHOLD);
  }

  function virtualEvents(s){
    const out=[];
    const matches=potentialFor(s.id);
    if(matches.length){
      const latest=matches.reduce((best,r)=>!best||new Date(r.updated_at)>new Date(best)?r.updated_at:best,null);
      out.push({submission_id:s.id,activity_type:'potential_matches',headline:`${matches.length} potential mandate match${matches.length===1?'':'es'} identified`,detail:`Current mandate scan found ${matches.length} profile${matches.length===1?'':'s'} at ${MATCH_THRESHOLD}%+ fit.`,created_at:latest||s.updated_at||s.created_at,virtual:true});
    }
    const persisted=activityRows.some(a=>a.submission_id===s.id&&a.activity_type==='under_review');
    if(!persisted&&(s.submission_state||'')==='submitted'&&s.status==='Received'&&s.review_decision==='pending'){
      out.push({submission_id:s.id,activity_type:'under_review',headline:'Under review',detail:'Diligence is complete and the opportunity is awaiting Outerhaven review.',created_at:s.diligence_completed_at||s.updated_at||s.created_at,virtual:true});
    }
    return out;
  }

  function eventsFor(s){
    return [...activityRows.filter(a=>a.submission_id===s.id),...virtualEvents(s)].sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
  }

  function allEvents(){
    if(typeof submissions==='undefined')return[];
    return submissions.flatMap(s=>eventsFor(s).map(e=>({...e,deal:s.title||'Opportunity'}))).sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
  }

  function ensureOverview(){
    const home=q('homeSection');if(!home)return null;
    let panel=q('originatorDealActivity');
    if(!panel){
      panel=document.createElement('section');panel.id='originatorDealActivity';panel.className='panel oaPanel';
      panel.innerHTML='<div class="oaPanelHead"><div><div class="eyebrow">DEAL ACTIVITY</div><h2>Recent Activity</h2><p>Live milestones from your opportunities as they move through diligence, review, matching, and investor engagement.</p></div><span class="oaLive">Live Workflow</span></div><div id="originatorActivityFeed" class="oaFeed"></div>';
      const how=home.querySelector('.howItWorks');how?home.insertBefore(panel,how):home.appendChild(panel);
    }
    return panel;
  }

  function feedRow(e){
    return `<div class="oaFeedRow" data-type="${html(e.activity_type)}"><span class="oaDot"></span><div class="oaFeedCopy"><strong>${html(e.headline)}</strong><span><span class="oaDealName">${html(e.deal||'Opportunity')}</span>${e.detail?` · ${html(e.detail)}`:''}</span></div><span class="oaTime">${html(dateTime(e.created_at))}</span></div>`;
  }

  function renderOverview(){
    ensureOverview();const feed=q('originatorActivityFeed');if(!feed)return;
    const rows=allEvents().slice(0,8);
    feed.innerHTML=rows.length?rows.map(feedRow).join(''):'<div class="oaEmpty">Activity will appear here as opportunities move through diligence, review, matching, and investor engagement.</div>';
  }

  function stageHtml(s){
    const names=['Diligence','Review','Matching','Interest','Engagement'];
    const current=currentStageIndex(s);
    return names.map((name,i)=>`<div class="oaStage ${i<current?'complete':i===current?'current':''}">${name}</div>`).join('');
  }

  function timelineRow(e){
    return `<div class="oaTimelineRow"><span class="oaTimelineDot"></span><div class="oaTimelineCopy"><strong>${html(e.headline)}</strong>${e.detail?`<span>${html(e.detail)}</span>`:''}</div><span class="oaTimelineTime">${html(dateTime(e.created_at))}</span></div>`;
  }

  function renderSubmissionActivity(){
    if(typeof submissions==='undefined')return;
    const cards=[...document.querySelectorAll('#submissionCards .submissionCard')];
    cards.forEach((card,index)=>{
      const s=submissions[index];if(!s)return;
      card.querySelector('.oaSubmission')?.remove();
      const target=card.firstElementChild;if(!target)return;
      const matches=potentialFor(s.id),events=eventsFor(s).slice(0,4);
      const block=document.createElement('div');block.className='oaSubmission';
      block.innerHTML=`<div class="oaSubmissionTop"><span>Deal Progress</span><div style="display:flex;align-items:center;gap:6px"><b class="oaMatchCount">${matches.length} potential match${matches.length===1?'':'es'}</b><b class="oaStatusPill">${html(statusLabel(s))}</b></div></div><div class="oaStages">${stageHtml(s)}</div>${events.length?`<div class="oaTimeline">${events.map(timelineRow).join('')}</div>`:''}`;
      const network=target.querySelector('.networkMatchBlock'),docs=target.querySelector('.docs');
      if(network)target.insertBefore(block,network);else if(docs)target.insertBefore(block,docs);else target.appendChild(block);
    });
  }

  function render(){renderOverview();renderSubmissionActivity()}

  async function fetchRows(){
    if(loading||typeof sb==='undefined')return;loading=true;
    try{
      const [a,b,m]=await Promise.all([
        sb.from('originator_submission_activity').select('id,submission_id,activity_type,headline,detail,created_at').order('created_at',{ascending:false}).limit(250),
        sb.from('originator_match_buckets').select('id').eq('active',true).eq('is_synthetic',true),
        sb.from('originator_submission_matches').select('submission_id,bucket_id,score,updated_at').gte('score',MATCH_THRESHOLD).order('updated_at',{ascending:false}).limit(1000)
      ]);
      if(a.error)throw a.error;if(b.error)throw b.error;if(m.error)throw m.error;
      activityRows=a.data||[];syntheticIds=new Set((b.data||[]).map(x=>x.id));matchRows=m.data||[];render();
    }catch(err){console.error('originator activity',err)}finally{loading=false}
  }

  try{
    if(typeof renderAll==='function'){
      const base=renderAll;
      renderAll=function(){base();setTimeout(render,0)};
    }
  }catch{}

  function realtime(){
    if(channel||typeof sb==='undefined')return;
    channel=sb.channel('originator-deal-activity-v1')
      .on('postgres_changes',{event:'*',schema:'public',table:'originator_submission_activity'},fetchRows)
      .on('postgres_changes',{event:'*',schema:'public',table:'originator_submission_matches'},fetchRows)
      .subscribe();
  }

  fetchRows();realtime();setInterval(fetchRows,30000);
})();
// real deal activity timeline v1
