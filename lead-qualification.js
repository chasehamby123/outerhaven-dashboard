(function(){
  if(window.__outerhavenLeadQualification)return;
  window.__outerhavenLeadQualification=true;

  let leadRows=[];
  let leadRealtime=null;
  let leadFilter='needs_review';

  const style=document.createElement('style');
  style.textContent=`
    .leadReviewMetrics{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:16px}
    .leadReviewMetric{background:#fff;border:1px solid #e4e7eb;border-radius:14px;padding:16px}
    .leadReviewMetric .label{font-size:10px;font-weight:800;color:#7a8190;text-transform:uppercase;letter-spacing:.07em}
    .leadReviewMetric .value{font-size:28px;font-weight:800;margin-top:8px}
    .leadReviewToolbar{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:0 0 12px;flex-wrap:wrap}
    .leadReviewTabs{display:flex;gap:6px;flex-wrap:wrap}
    .leadReviewTab{border:1px solid #d9dde4;background:#fff;border-radius:8px;padding:7px 10px;font-size:10px;font-weight:800;color:#596170}
    .leadReviewTab.active{background:#111827;color:#fff;border-color:#111827}
    .leadReviewList{display:grid;gap:12px}
    .leadReviewCard{background:#fff;border:1px solid #e4e7eb;border-radius:14px;padding:16px}
    .leadReviewTop{display:flex;justify-content:space-between;gap:14px;align-items:flex-start}
    .leadReviewName{font-size:15px;font-weight:850}
    .leadReviewMeta{font-size:11px;color:#737b88;margin-top:4px;line-height:1.45}
    .leadDecision{font-size:9px;font-weight:850;border-radius:999px;padding:5px 7px;background:#f1f3f6;color:#596170;white-space:nowrap}
    .leadDecision.qualified{background:#eefaf2;color:#237a45}
    .leadDecision.review{background:#fff7e8;color:#8a5a00}
    .leadDecision.rejected{background:#fff1f1;color:#a32121}
    .leadReplyBox{margin-top:12px;background:#f7f8fa;border:1px solid #eceef1;border-radius:10px;padding:11px;font-size:12px;line-height:1.5;white-space:pre-wrap}
    .leadReason{font-size:10px;color:#747c89;line-height:1.5;margin-top:9px}
    .leadReviewActions{display:flex;gap:7px;flex-wrap:wrap;margin-top:13px}
    .leadReviewAction{border:1px solid #d6dae0;background:#fff;border-radius:8px;padding:7px 9px;font-size:10px;font-weight:800}
    .leadReviewAction.buy{background:#111827;color:#fff;border-color:#111827}
    .leadReviewAction.sell{background:#b42318;color:#fff;border-color:#b42318}
    .leadReviewAction.reject{color:#a32121;border-color:#efc3c3;background:#fff7f7}
    .leadReviewEmpty{background:#fff;border:1px dashed #cfd4dc;border-radius:14px;padding:34px;text-align:center;color:#777f8a;font-size:12px}
    @media(max-width:700px){.leadReviewMetrics{grid-template-columns:1fr}}
  `;
  document.head.appendChild(style);

  const prettyDecision=d=>d==='qualified_buy_side'?'Qualified Buy Side':d==='qualified_sell_side'?'Qualified Sell Side':d==='not_qualified'?'Not Qualified':'Needs Review';
  const decisionClass=d=>d?.startsWith('qualified_')?'qualified':d==='not_qualified'?'rejected':'review';
  const fmtLeadTime=v=>v?new Date(v).toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}):'';

  function installUI(){
    if(document.querySelector('[data-view="leadreview"]'))return;
    const nav=document.querySelector('.sidebar .nav');
    if(nav){
      const btn=document.createElement('button');
      btn.className='navBtn';btn.dataset.view='leadreview';
      btn.innerHTML='<span>Lead Review</span><span id="navLeadReview" class="navCount">0</span>';
      btn.onclick=()=>showLeadReview();
      nav.appendChild(btn);
    }
    const main=document.querySelector('main.main');
    if(main){
      const section=document.createElement('section');
      section.id='leadreviewView';section.className='view';
      section.innerHTML=`
        <div class="leadReviewMetrics">
          <div class="leadReviewMetric"><div class="label">Needs Review</div><div id="leadReviewNeeds" class="value">0</div></div>
          <div class="leadReviewMetric"><div class="label">Qualified</div><div id="leadReviewQualified" class="value">0</div></div>
          <div class="leadReviewMetric"><div class="label">Rejected</div><div id="leadReviewRejected" class="value">0</div></div>
        </div>
        <div class="leadReviewToolbar">
          <div><strong>Inbound Qualification</strong><div class="compactMeta" style="margin-top:4px">Prosp replies are screened before they enter the relationship pipeline.</div></div>
          <div class="leadReviewTabs">
            <button class="leadReviewTab active" data-lead-filter="needs_review">Needs Review</button>
            <button class="leadReviewTab" data-lead-filter="qualified">Qualified</button>
            <button class="leadReviewTab" data-lead-filter="not_qualified">Rejected</button>
            <button class="leadReviewTab" data-lead-filter="all">All</button>
          </div>
        </div>
        <div id="leadReviewList" class="leadReviewList"></div>`;
      main.appendChild(section);
      section.querySelectorAll('[data-lead-filter]').forEach(b=>b.onclick=()=>{leadFilter=b.dataset.leadFilter;section.querySelectorAll('[data-lead-filter]').forEach(x=>x.classList.toggle('active',x===b));renderLeadReview()});
    }
  }

  function showLeadReview(){
    document.querySelectorAll('.view').forEach(x=>x.classList.remove('active'));
    document.querySelectorAll('.navBtn').forEach(x=>x.classList.remove('active'));
    document.getElementById('leadreviewView')?.classList.add('active');
    document.querySelector('.navBtn[data-view="leadreview"]')?.classList.add('active');
    if($('pageTitle'))$('pageTitle').textContent='Lead Review';
    if($('pageSub'))$('pageSub').textContent='Review ambiguous inbound replies before they enter the OuterHaven pipeline.';
    loadLeadRows();
  }

  async function loadLeadRows(){
    if(!currentUser)return;
    const {data,error}=await sb.from('lead_intake').select('*').order('created_at',{ascending:false}).limit(500);
    if(error){console.error(error);return}
    leadRows=data||[];
    updateLeadCounts();renderLeadReview();ensureLeadRealtime();
  }

  function updateLeadCounts(){
    const needs=leadRows.filter(x=>x.decision==='needs_review').length;
    const qualified=leadRows.filter(x=>x.decision==='qualified_buy_side'||x.decision==='qualified_sell_side').length;
    const rejected=leadRows.filter(x=>x.decision==='not_qualified').length;
    if($('navLeadReview'))$('navLeadReview').textContent=needs;
    if($('leadReviewNeeds'))$('leadReviewNeeds').textContent=needs;
    if($('leadReviewQualified'))$('leadReviewQualified').textContent=qualified;
    if($('leadReviewRejected'))$('leadReviewRejected').textContent=rejected;
  }

  function filteredRows(){
    if(leadFilter==='all')return leadRows;
    if(leadFilter==='qualified')return leadRows.filter(x=>x.decision==='qualified_buy_side'||x.decision==='qualified_sell_side');
    return leadRows.filter(x=>x.decision===leadFilter);
  }

  function renderLeadReview(){
    const host=$('leadReviewList');if(!host)return;
    const rows=filteredRows();
    if(!rows.length){host.innerHTML='<div class="leadReviewEmpty">Nothing in this queue.</div>';return}
    host.innerHTML=rows.map(l=>`<article class="leadReviewCard">
      <div class="leadReviewTop"><div><div class="leadReviewName">${esc(l.name||'Unknown lead')}</div><div class="leadReviewMeta">${esc(l.headline||'No title captured')}${l.company_name?` · ${esc(l.company_name)}`:''}${l.campaign_name?`<br>Campaign: ${esc(l.campaign_name)}`:''}${l.source_account?` · Account: ${esc(l.source_account)}`:''}${l.created_at?` · ${esc(fmtLeadTime(l.created_at))}`:''}</div></div><span class="leadDecision ${decisionClass(l.decision)}">${esc(prettyDecision(l.decision))} · ${Math.round(Number(l.confidence||0)*100)}%</span></div>
      ${l.reply_text?`<div class="leadReplyBox">${esc(l.reply_text)}</div>`:''}
      <div class="leadReason">${esc(l.reason||'No qualification reason recorded.')}${l.linkedin_url?`<br><a href="${esc(l.linkedin_url)}" target="_blank" rel="noopener">Open LinkedIn profile</a>`:''}</div>
      ${l.decision==='needs_review'?`<div class="leadReviewActions"><button class="leadReviewAction buy" data-lead-buy="${l.id}">Buy Side</button><button class="leadReviewAction sell" data-lead-direct="${l.id}">Sell Side · Direct Sponsor</button><button class="leadReviewAction sell" data-lead-source="${l.id}">Sell Side · Deal Source</button><button class="leadReviewAction reject" data-lead-reject="${l.id}">Not Qualified</button></div>`:''}
    </article>`).join('');
    host.querySelectorAll('[data-lead-buy]').forEach(b=>b.onclick=()=>resolveLead(b.dataset.leadBuy,'Buy Side','multi_deal'));
    host.querySelectorAll('[data-lead-direct]').forEach(b=>b.onclick=()=>resolveLead(b.dataset.leadDirect,'Sell Side','direct_sponsor'));
    host.querySelectorAll('[data-lead-source]').forEach(b=>b.onclick=()=>resolveLead(b.dataset.leadSource,'Sell Side','multi_deal'));
    host.querySelectorAll('[data-lead-reject]').forEach(b=>b.onclick=()=>rejectLead(b.dataset.leadReject));
  }

  async function findExisting(l){
    if(l.linkedin_url){const {data}=await sb.from('people').select('id').eq('linkedin_url',l.linkedin_url).maybeSingle();if(data)return data}
    if(l.name){const {data}=await sb.from('people').select('id').ilike('name',l.name).limit(1);if(data?.length)return data[0]}
    return null;
  }

  async function resolveLead(id,side,kind){
    const l=leadRows.find(x=>x.id===id);if(!l)return;
    let existing=await findExisting(l),personId=existing?.id||null;
    const next=l.suggested_next_step||(side==='Buy Side'?'Confirm mandate, sector focus, geography and typical check size.':kind==='direct_sponsor'?'Confirm raise details, materials and diligence requirements.':'Review active mandates and determine which opportunities fit our buy-side network.');
    if(!personId){
      const relationship=side==='Buy Side'?'Investor / Capital':kind==='direct_sponsor'?'Founder / Sponsor':'Deal Originator / Advisor';
      const notes=[l.reply_text?`Latest LinkedIn reply: ${l.reply_text}`:'',l.campaign_name?`Prosp campaign: ${l.campaign_name}`:''].filter(Boolean).join('\n');
      const {data,error}=await sb.from('people').insert({name:l.name||'Unnamed Prosp Lead',relationship_type:relationship,primary_side:side,pipeline_stage:'New Relationship',sell_side_kind:kind,linkedin_url:l.linkedin_url||null,company_name:l.company_name||null,headline:l.headline||null,source:'Prosp',source_campaign:l.campaign_name||null,source_account:l.source_account||null,qualification_confidence:l.confidence||0,qualification_reason:`Manual review: ${l.reason||''}`,last_inbound_message:l.reply_text||null,notes:notes||null,created_by:currentUser.id}).select('id').single();
      if(error){alert(error.message);return}personId=data.id;
      if(next){const task=await sb.from('tasks').insert({person_id:personId,action:next,owner_name:currentUser?.email?.toLowerCase().startsWith('tengku')?'Tengku':'Chase',created_by:currentUser.id});if(task.error)console.error(task.error)}
    }
    const decision=side==='Buy Side'?'qualified_buy_side':'qualified_sell_side';
    const {error}=await sb.from('lead_intake').update({decision,person_id:personId,sell_side_kind:side==='Sell Side'?kind:null,reviewed_by:currentUser.id,reviewed_at:new Date().toISOString(),reason:`Manual review: ${l.reason||''}`}).eq('id',id);
    if(error){alert(error.message);return}
    await loadLeadRows();if(typeof loadData==='function')await loadData();
  }

  async function rejectLead(id){
    const l=leadRows.find(x=>x.id===id);if(!l)return;
    const {error}=await sb.from('lead_intake').update({decision:'not_qualified',reviewed_by:currentUser.id,reviewed_at:new Date().toISOString(),reason:`Manual review: Not qualified. ${l.reason||''}`}).eq('id',id);
    if(error){alert(error.message);return}await loadLeadRows();
  }

  function ensureLeadRealtime(){
    if(leadRealtime||!currentUser)return;
    leadRealtime=sb.channel('outerhaven-lead-intake').on('postgres_changes',{event:'*',schema:'public',table:'lead_intake'},()=>loadLeadRows()).subscribe();
  }

  function install(){
    installUI();
    if(currentUser)loadLeadRows();
    else setTimeout(()=>{if(currentUser)loadLeadRows()},1500);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
