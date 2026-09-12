(function(){
  if(window.__outerhavenOriginatorAdmin)return;
  window.__outerhavenOriginatorAdmin=true;
  if(window.__outerhavenDashboardRole!=='admin')return;

  let accessRows=[],profiles=[],submissions=[],documents=[],thesis=null,loading=false;
  const money=n=>{n=Number(n||0);if(!n)return'—';if(n>=1e9)return'$'+(n/1e9).toFixed(n%1e9?1:0)+'B';return'$'+(n/1e6).toFixed(n%1e6?1:0)+'M'};
  const date=v=>v?new Date(v).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'}):'—';
  const avg=a=>a.length?Math.round(a.reduce((s,x)=>s+Number(x.match_score||0),0)/a.length):0;
  const escA=v=>typeof esc==='function'?esc(v):String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));

  const style=document.createElement('style');
  style.textContent=`
    #originatorsView .oaHero{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;margin-bottom:16px}.oaHeroActions{display:flex;gap:8px;flex-wrap:wrap}
    .oaMetrics{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px}.oaMetric{background:#fff;border:1px solid #e3e6ea;border-radius:13px;padding:14px}.oaMetric span{display:block;font-size:9px;font-weight:850;color:#747c87;text-transform:uppercase;letter-spacing:.06em}.oaMetric strong{display:block;font-size:24px;margin-top:5px;letter-spacing:-.03em}.oaMetric small{font-size:9px;color:#8a929d}
    .oaGrid{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(330px,.85fr);gap:16px}.oaStack{display:grid;gap:16px}.oaPanel{background:#fff;border:1px solid #e3e6ea;border-radius:14px;padding:15px}.oaPanelHead{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:12px}.oaPanelHead h2{font-size:15px;margin:0}.oaPanelHead p{font-size:9px;color:#808893;margin:4px 0 0}.oaEyebrow{font-size:8px;font-weight:900;letter-spacing:.09em;color:#858d98;margin-bottom:4px}
    .oaAccessList,.oaSubmissionList{display:grid;gap:9px}.oaAccess{border:1px solid #e7eaee;border-radius:11px;padding:11px;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;align-items:center}.oaAccess strong{font-size:11px}.oaAccess span{display:block;font-size:9px;color:#7b838e;margin-top:3px}.oaAccessStats{display:flex;gap:14px;text-align:right}.oaAccessStats b{display:block;font-size:13px}.oaAccessStats small{font-size:8px;color:#87909a}.oaPending{color:#9a6a17!important}.oaLive{color:#25734b!important}
    .oaSubmission{border:1px solid #e6e9ed;border-radius:11px;padding:12px;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px}.oaSubmission h3{font-size:11px;margin:0}.oaSubmissionMeta{font-size:8.5px;color:#7f8791;margin-top:4px;line-height:1.5}.oaSubmissionWhy{font-size:9px;color:#636c77;line-height:1.45;margin-top:7px}.oaScore{text-align:right;min-width:86px}.oaScore strong{font-size:20px}.oaScore span{display:block;font-size:8px;color:#818a95}.oaStatus{display:inline-block;margin-top:7px;font-size:8px;font-weight:850;padding:5px 7px;border-radius:7px;background:#f1f3f5;color:#5f6873}.oaOpen{margin-top:8px;white-space:nowrap}
    .oaForm{display:grid;gap:9px}.oaFormGrid{display:grid;grid-template-columns:1fr 1fr;gap:9px}.oaForm label{font-size:8px;font-weight:850;color:#69717d;display:grid;gap:4px}.oaForm input,.oaForm textarea{width:100%;box-sizing:border-box;border:1px solid #d8dde3;border-radius:8px;padding:8px;font:inherit;font-size:10px}.oaForm .span2{grid-column:1/3}.oaFormMsg{min-height:14px;font-size:9px;color:#6f7782}.oaFormMsg.error{color:#a33333}.oaFormMsg.ok{color:#247247}
    .oaThesisSummary{border:1px solid #e6e9ed;border-radius:10px;padding:10px;background:#fafbfc;margin-bottom:10px}.oaThesisSummary strong{font-size:18px}.oaThesisSummary span{font-size:8px;color:#7d8590;margin-left:5px}.oaTags{display:flex;gap:5px;flex-wrap:wrap;margin-top:7px}.oaTag{font-size:8px;padding:4px 6px;border-radius:6px;background:#f0f2f4;color:#606975}
    .oaDashboardMount{margin-top:16px}.oaDashRow{display:flex;align-items:center;justify-content:space-between;gap:16px}.oaDashMetrics{display:flex;gap:24px;flex-wrap:wrap}.oaDashMetric span{display:block;font-size:8px;color:#858d98}.oaDashMetric strong{font-size:17px}.oaEmpty{font-size:9px;color:#828b96;padding:14px 2px}.oaCopyNotice{font-size:9px;color:#26734b;margin-top:7px;min-height:13px}
    @media(max-width:980px){.oaGrid{grid-template-columns:1fr}.oaMetrics{grid-template-columns:repeat(2,1fr)}}@media(max-width:650px){.oaMetrics,.oaFormGrid{grid-template-columns:1fr}.oaForm .span2{grid-column:1}.oaAccess,.oaSubmission{grid-template-columns:1fr}.oaAccessStats,.oaScore{text-align:left}.oaHero{flex-direction:column}.oaDashRow{align-items:flex-start;flex-direction:column}}
  `;
  document.head.appendChild(style);

  function install(){
    if(document.getElementById('originatorsView'))return;
    const nav=document.querySelector('.sidebar .nav');
    const peopleBtn=nav?.querySelector('[data-view="people"]');
    if(!nav)return;
    const btn=document.createElement('button');btn.className='navBtn';btn.dataset.view='originators';btn.innerHTML='<span>Originators</span><span id="navOriginators" class="navCount">0</span>';
    peopleBtn?peopleBtn.insertAdjacentElement('afterend',btn):nav.appendChild(btn);
    btn.onclick=()=>showView();

    const main=document.querySelector('main.main');
    const ai=document.getElementById('aiView');
    const view=document.createElement('section');view.id='originatorsView';view.className='view';
    view.innerHTML=`<div class="oaHero"><div><div class="oaEyebrow">PARTNER NETWORK</div><h2 style="margin:0;font-size:19px">Originator Administration</h2><p style="font-size:10px;color:#7c8490;margin:5px 0 0">Manage partner access, submitted deals, materials, and the thesis originators are scored against.</p></div><div class="oaHeroActions"><button id="oaCopyLogin" class="ghost">Copy Partner Login</button><button id="oaApproveTop" class="primary">+ Approve Originator</button></div></div><div id="oaMetrics" class="oaMetrics"></div><div class="oaGrid"><div class="oaStack"><section class="oaPanel"><div class="oaPanelHead"><div><div class="oaEyebrow">ACCESS</div><h2>Deal Originators</h2><p>Approved partner accounts and their submission activity.</p></div></div><div id="oaAccessList" class="oaAccessList"></div></section><section class="oaPanel"><div class="oaPanelHead"><div><div class="oaEyebrow">SUBMISSIONS</div><h2>Originator Opportunities</h2><p>Deals entering Outerhaven through the partner portal.</p></div></div><div id="oaSubmissionList" class="oaSubmissionList"></div></section></div><div class="oaStack"><section id="oaApprovePanel" class="oaPanel"><div class="oaPanelHead"><div><div class="oaEyebrow">INVITE</div><h2>Approve Originator</h2><p>Grant an email access to create an Originator Portal account.</p></div></div><form id="oaApproveForm" class="oaForm"><div class="oaFormGrid"><label>Full Name<input id="oaApproveName" required placeholder="Eduardo Smith"></label><label>Email<input id="oaApproveEmail" type="email" required placeholder="eduardo@firm.com"></label></div><button class="primary" type="submit">Approve Partner Access</button><div id="oaApproveMsg" class="oaFormMsg"></div></form></section><section class="oaPanel"><div class="oaPanelHead"><div><div class="oaEyebrow">BUY-SIDE MANDATE</div><h2>Originator Buyer Thesis</h2><p>This is the thesis shown in the partner portal and used for match scoring.</p></div></div><button id="oaEditThesis" class="ghost">Edit</button></div><div id="oaThesisRead"></div><form id="oaThesisForm" class="oaForm" style="display:none"><div class="oaFormGrid"><label class="span2">Title<input id="oaThesisTitle"></label><label>Minimum Transaction Size<input id="oaThesisMin" type="number" step="1000000"></label><label>Sectors<input id="oaThesisSectors" placeholder="Sector agnostic"></label><label class="span2">Summary<textarea id="oaThesisSummary" rows="3"></textarea></label><label class="span2">Geographies<input id="oaThesisGeo" placeholder="Global"></label><label class="span2">Structures<textarea id="oaThesisStructures" rows="3"></textarea></label><label class="span2">Requirements<textarea id="oaThesisRequirements" rows="4"></textarea></label></div><div style="display:flex;gap:7px"><button class="primary" type="submit">Save Thesis</button><button id="oaCancelThesis" class="ghost" type="button">Cancel</button></div><div id="oaThesisMsg" class="oaFormMsg"></div></form></section></div></div>`;
    ai?main.insertBefore(view,ai):main.appendChild(view);

    const dash=document.getElementById('dashboardView');
    if(dash){const panel=document.createElement('section');panel.className='panel oaDashboardMount';panel.id='oaDashboardMount';panel.innerHTML='<div class="panelHeader"><div><h2>Originator Network</h2><p>Partner submissions entering the opportunity workflow.</p></div><button id="oaDashOpen" class="textBtn">Open admin view</button></div><div id="oaDashBody"></div>';dash.appendChild(panel);document.getElementById('oaDashOpen').onclick=showView}

    document.getElementById('oaApproveTop').onclick=()=>{showView();document.getElementById('oaApprovePanel')?.scrollIntoView({behavior:'smooth',block:'center'});document.getElementById('oaApproveName')?.focus()};
    document.getElementById('oaCopyLogin').onclick=copyLogin;
    document.getElementById('oaApproveForm').onsubmit=approveOriginator;
    document.getElementById('oaEditThesis').onclick=()=>toggleThesis(true);
    document.getElementById('oaCancelThesis').onclick=()=>toggleThesis(false);
    document.getElementById('oaThesisForm').onsubmit=saveThesis;
    load();
    setInterval(()=>{if(window.__outerhavenDashboardRole==='admin')load(false)},60000);
  }

  function showView(){
    document.querySelectorAll('.view').forEach(x=>x.classList.remove('active'));
    document.querySelectorAll('.navBtn').forEach(x=>x.classList.remove('active'));
    document.getElementById('originatorsView')?.classList.add('active');
    document.querySelector('.navBtn[data-view="originators"]')?.classList.add('active');
    document.getElementById('pageTitle').textContent='Originators';
    document.getElementById('pageSub').textContent='Manage partner access, submitted opportunities, match scores, and the buyer thesis.';
    load();
  }

  async function load(render=true){
    if(loading)return;loading=true;
    try{
      const [a,p,s,d,t]=await Promise.all([
        sb.rpc('admin_list_originator_access'),
        sb.from('originator_profiles').select('*').order('created_at',{ascending:false}),
        sb.from('originator_submissions').select('*').order('created_at',{ascending:false}),
        sb.from('originator_documents').select('*').order('created_at',{ascending:false}),
        sb.from('originator_buyer_thesis').select('*').eq('singleton_key','outerhaven').maybeSingle()
      ]);
      const err=a.error||p.error||s.error||d.error||t.error;if(err)throw err;
      accessRows=a.data||[];profiles=p.data||[];submissions=s.data||[];documents=d.data||[];thesis=t.data||null;
      if(render)renderAll();else renderAll();
    }catch(e){console.error('originator admin',e)}finally{loading=false}
  }

  function profileForEmail(email){return profiles.find(p=>String(p.email).toLowerCase()===String(email).toLowerCase())||null}
  function subsForProfile(p){return p?submissions.filter(s=>s.originator_user_id===p.user_id):[]}
  function displayName(a,p){return p?.full_name||a.full_name||a.email}
  function renderAll(){
    const active=submissions.filter(s=>['Matching','Buyer Interest','Engagement Active'].includes(s.status)).length;
    const buyer=submissions.filter(s=>['Buyer Interest','Engagement Active'].includes(s.status)).length;
    document.getElementById('navOriginators').textContent=accessRows.length;
    document.getElementById('oaMetrics').innerHTML=[['Approved Originators',accessRows.length,'Partner access'],['Submitted Deals',submissions.length,'All originator submissions'],['Average Match',avg(submissions)+'%','Current buyer thesis'],['Buyer Interest',buyer,'Interest or engagement']].map(x=>`<article class="oaMetric"><span>${x[0]}</span><strong>${x[1]}</strong><small>${x[2]}</small></article>`).join('');
    document.getElementById('oaAccessList').innerHTML=accessRows.length?accessRows.map(a=>{const p=profileForEmail(a.email),ss=subsForProfile(p),last=ss[0];return `<article class="oaAccess"><div><strong>${escA(displayName(a,p))}</strong><span>${escA(a.email)}${p?.company_name?` · ${escA(p.company_name)}`:''}</span><span class="${p?'oaLive':'oaPending'}">${p?'Portal account active':'Approved · account not created yet'}</span></div><div class="oaAccessStats"><div><b>${ss.length}</b><small>Submissions</small></div><div><b>${avg(ss)}%</b><small>Avg match</small></div><div><b>${last?date(last.created_at):'—'}</b><small>Last deal</small></div></div></article>`}).join(''):'<div class="oaEmpty">No originators approved yet.</div>';
    document.getElementById('oaSubmissionList').innerHTML=submissions.length?submissions.map(s=>{const p=profiles.find(x=>x.user_id===s.originator_user_id),docs=documents.filter(d=>d.submission_id===s.id);return `<article class="oaSubmission"><div><h3>${escA(s.title)}</h3><div class="oaSubmissionMeta">${escA(p?.full_name||p?.email||'Originator')} · ${escA(money(s.capital_amount))} · ${escA(s.sector||'Sector not specified')} · ${escA(s.geography||'Geography not specified')} · ${docs.length} document${docs.length===1?'':'s'} · ${escA(date(s.created_at))}</div><div class="oaSubmissionWhy">${escA(s.match_explanation||'Match analysis pending.')}</div></div><div class="oaScore"><strong>${Number(s.match_score||0)}%</strong><span>Thesis Match</span><span class="oaStatus">${escA(s.status||'Received')}</span>${s.internal_opportunity_id?`<button class="ghost oaOpen" data-oa-open="${s.internal_opportunity_id}">Open Opportunity</button>`:''}</div></article>`}).join(''):'<div class="oaEmpty">No originator submissions yet.</div>';
    document.querySelectorAll('[data-oa-open]').forEach(b=>b.onclick=()=>{const id=b.dataset.oaOpen;if(typeof openDetail==='function')openDetail(id)});
    renderThesis();renderDashboardMount(active);
  }

  function renderDashboardMount(active){
    const el=document.getElementById('oaDashBody');if(!el)return;
    el.innerHTML=`<div class="oaDashRow"><div class="oaDashMetrics"><div class="oaDashMetric"><span>Approved Originators</span><strong>${accessRows.length}</strong></div><div class="oaDashMetric"><span>Submitted Deals</span><strong>${submissions.length}</strong></div><div class="oaDashMetric"><span>Active Matching</span><strong>${active}</strong></div><div class="oaDashMetric"><span>Average Match</span><strong>${avg(submissions)}%</strong></div></div><div style="font-size:9px;color:#7e8792">New portal submissions automatically enter your sell-side workflow at Opportunity Received.</div></div>`;
  }

  function renderThesis(){
    const t=thesis||{};const read=document.getElementById('oaThesisRead');if(!read)return;
    read.innerHTML=`<div class="oaThesisSummary"><strong>${escA(money(t.min_transaction_size||50000000))}+</strong><span>Preferred institutional scale</span><div style="font-size:9px;color:#67717c;margin-top:7px;line-height:1.5">${escA(t.summary||'Broad, sector-agnostic institutional opportunities.')}</div></div><div class="oaEyebrow">SECTORS</div><div class="oaTags">${(t.sectors||['Sector agnostic']).map(x=>`<span class="oaTag">${escA(x)}</span>`).join('')}</div><div class="oaEyebrow" style="margin-top:10px">GEOGRAPHY</div><div class="oaTags">${(t.geographies||['Global']).map(x=>`<span class="oaTag">${escA(x)}</span>`).join('')}</div><div class="oaEyebrow" style="margin-top:10px">STRUCTURES</div><div class="oaTags">${(t.structures||[]).map(x=>`<span class="oaTag">${escA(x)}</span>`).join('')}</div><div style="font-size:9px;color:#68717c;line-height:1.5;margin-top:11px">${escA(t.requirements||'')}</div>`;
  }

  function toggleThesis(editing){
    const form=document.getElementById('oaThesisForm'),read=document.getElementById('oaThesisRead');form.style.display=editing?'grid':'none';read.style.display=editing?'none':'';document.getElementById('oaEditThesis').style.display=editing?'none':'';
    if(editing){const t=thesis||{};document.getElementById('oaThesisTitle').value=t.title||'';document.getElementById('oaThesisMin').value=t.min_transaction_size||50000000;document.getElementById('oaThesisSectors').value=(t.sectors||[]).join(', ');document.getElementById('oaThesisSummary').value=t.summary||'';document.getElementById('oaThesisGeo').value=(t.geographies||[]).join(', ');document.getElementById('oaThesisStructures').value=(t.structures||[]).join(', ');document.getElementById('oaThesisRequirements').value=t.requirements||''}
  }

  async function saveThesis(e){
    e.preventDefault();const msg=document.getElementById('oaThesisMsg');msg.textContent='Saving...';msg.className='oaFormMsg';
    const split=id=>document.getElementById(id).value.split(',').map(x=>x.trim()).filter(Boolean);
    const payload={title:document.getElementById('oaThesisTitle').value.trim(),min_transaction_size:Number(document.getElementById('oaThesisMin').value||50000000),sectors:split('oaThesisSectors'),summary:document.getElementById('oaThesisSummary').value.trim(),geographies:split('oaThesisGeo'),structures:split('oaThesisStructures'),requirements:document.getElementById('oaThesisRequirements').value.trim(),updated_at:new Date().toISOString()};
    const {error}=await sb.from('originator_buyer_thesis').update(payload).eq('singleton_key','outerhaven');if(error){msg.textContent=error.message;msg.className='oaFormMsg error';return}msg.textContent='Buyer thesis updated. Existing match scores were recalculated.';msg.className='oaFormMsg ok';await load();setTimeout(()=>toggleThesis(false),700);
  }

  async function approveOriginator(e){
    e.preventDefault();const name=document.getElementById('oaApproveName').value.trim(),email=document.getElementById('oaApproveEmail').value.trim().toLowerCase(),msg=document.getElementById('oaApproveMsg'),btn=e.submitter;btn.disabled=true;msg.textContent='Approving...';msg.className='oaFormMsg';
    try{const {error}=await sb.rpc('admin_approve_originator',{input_email:email,input_full_name:name});if(error)throw error;msg.textContent=`${name||email} is approved. Send them the Partner Login link.`;msg.className='oaFormMsg ok';e.target.reset();await load()}catch(err){msg.textContent=err?.message||String(err);msg.className='oaFormMsg error'}finally{btn.disabled=false}
  }

  async function copyLogin(){
    const url=location.origin+'/originator-login.html',notice=document.getElementById('oaApproveMsg');
    try{await navigator.clipboard.writeText(url);if(notice){notice.textContent='Partner login link copied.';notice.className='oaFormMsg ok'}}catch{prompt('Copy partner login link:',url)}
  }

  install();
})();