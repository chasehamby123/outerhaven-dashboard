(function(){
  const sb=window.__OUTERHAVEN_ORIGINATOR_SB;
  if(!sb){location.replace('/originator-login.html?mode=signin');return}

  let currentUser=null;
  let member=null;
  let buyBoxes=[];
  let deals=[];
  let selectedFiles=[];
  let editingDealId=null;
  let openDealId=null;

  const $=id=>document.getElementById(id);
  const esc=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
  const norm=v=>String(v||'').trim().toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  const cap=v=>String(v||'').replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
  const date=v=>v?new Date(v).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'}):'—';
  const datetime=v=>v?new Date(v).toLocaleString(undefined,{month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'}):'—';

  function parseMoney(value){
    const raw=String(value||'').trim().toLowerCase().replace(/[$,\s]/g,'');
    if(!raw)return 0;
    const m=raw.match(/^(-?\d+(?:\.\d+)?)(k|m|b|thousand|million|billion)?$/i);
    if(!m)return Number(raw)||0;
    let n=Number(m[1]);
    const suffix=(m[2]||'').toLowerCase();
    if(suffix==='k'||suffix==='thousand')n*=1e3;
    if(suffix==='m'||suffix==='million')n*=1e6;
    if(suffix==='b'||suffix==='billion')n*=1e9;
    return Number.isFinite(n)?n:0;
  }
  function money(v){
    const n=Number(v||0);
    if(!n)return'Not specified';
    if(n>=1e9)return'$'+(n/1e9).toFixed(n%1e9?1:0)+'B';
    if(n>=1e6)return'$'+(n/1e6).toFixed(n%1e6?1:0)+'M';
    if(n>=1e3)return'$'+(n/1e3).toFixed(n%1e3?1:0)+'K';
    return'$'+n.toLocaleString();
  }
  function range(box){
    if(box.min_size&&box.max_size)return`${money(box.min_size)}–${money(box.max_size)}`;
    if(box.min_size)return`${money(box.min_size)}+`;
    if(box.max_size)return`Up to ${money(box.max_size)}`;
    return'Flexible';
  }
  function setMessage(text,type=''){
    const el=$('submitMessage');
    el.textContent=text||'';
    el.className=`formMessage ${text?'show':''} ${type}`.trim();
  }
  function safeName(name){
    return String(name||'document').normalize('NFKD').replace(/[^a-zA-Z0-9._-]+/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'').slice(-120)||'document';
  }
  function mimeFor(file){
    const ext=(file.name.split('.').pop()||'').toLowerCase();
    if(ext==='pdf')return'application/pdf';
    if(ext==='docx')return'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    if(ext==='xlsx')return'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    return file.type||'application/octet-stream';
  }

  async function init(){
    try{
      const {data:{session},error}=await sb.auth.getSession();
      if(error||!session){location.replace('/originator-login.html?mode=signin');return}
      currentUser=session.user;
      await loadData();
      bind();
      $('loading').classList.add('hidden');
      $('app').classList.remove('hidden');
      renderAll();
      setInterval(()=>loadData(true).catch(console.error),45000);
    }catch(err){
      console.error('originator init',err);
      location.replace('/originator-login.html?mode=signin');
    }
  }

  async function loadData(render=false){
    const [memberRes,boxRes,dealRes]=await Promise.all([
      sb.from('members').select('id,email,full_name,firm,role,status,membership').eq('id',currentUser.id).maybeSingle(),
      sb.from('buy_boxes').select('*').eq('published',true).order('created_at',{ascending:false}),
      sb.from('deals').select('*').eq('owner_id',currentUser.id).order('created_at',{ascending:false})
    ]);
    if(memberRes.error)throw memberRes.error;
    if(boxRes.error)throw boxRes.error;
    if(dealRes.error)throw dealRes.error;
    member=memberRes.data;
    buyBoxes=boxRes.data||[];
    deals=dealRes.data||[];
    if(!member||member.role!=='originator'||member.status!=='approved'||!['pilot','paid'].includes(member.membership)){
      location.replace('/originator-pending.html');return;
    }
    $('accountName').textContent=member.full_name||'Originator';
    $('accountEmail').textContent=member.email||currentUser.email||'';
    $('avatar').textContent=(member.full_name?.trim()?.[0]||'O').toUpperCase();
    if(render)renderAll();
  }

  function bind(){
    document.querySelectorAll('.navBtn').forEach(b=>b.onclick=()=>showSection(b.dataset.section));
    document.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>showSection(b.dataset.go));
    $('topSubmit').onclick=()=>{clearEdit();showSection('submit')};
    $('signOut').onclick=async()=>{await sb.auth.signOut();location.replace('/originator-login.html?mode=signin')};
    $('submissionForm').onsubmit=submitOpportunity;
    const fileInput=$('dealFiles'),drop=$('fileDrop');
    $('chooseFiles').onclick=e=>{e.preventDefault();fileInput.click()};
    drop.onclick=e=>{if(e.target.closest('button'))return;fileInput.click()};
    drop.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();fileInput.click()}};
    fileInput.onchange=()=>addFiles([...fileInput.files]);
    drop.ondragover=e=>{e.preventDefault();drop.classList.add('drag')};
    drop.ondragleave=()=>drop.classList.remove('drag');
    drop.ondrop=e=>{e.preventDefault();drop.classList.remove('drag');addFiles([...e.dataTransfer.files])};
    ['dealAmount','dealRevenue','dealEbitda','dealSector','dealGeography'].forEach(id=>$(id).addEventListener('input',renderEstimate));
    ['dealType','sellerRelationship'].forEach(id=>$(id).addEventListener('change',renderEstimate));
    $('closeDealModal').onclick=closeDealModal;
    $('dealModalOverlay').onclick=e=>{if(e.target===$('dealModalOverlay'))closeDealModal()};
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('dealModalOverlay').classList.contains('hidden'))closeDealModal()});
    renderEstimate();
  }

  function showSection(section){
    document.querySelectorAll('.section').forEach(s=>s.classList.remove('active'));
    document.querySelectorAll('.navBtn').forEach(b=>b.classList.toggle('active',b.dataset.section===section));
    const el=$(section+'Section');if(el)el.classList.add('active');
    const labels={
      home:['Originator Overview','Submit private opportunities, review active mandates, and track Outerhaven\'s review process.'],
      submit:[editingDealId?'Update Opportunity':'Submit Opportunity',editingDealId?'Update the requested information and resubmit the opportunity for review.':'Provide the core information Outerhaven needs to review a private opportunity.'],
      submissions:['My Submissions','Track every opportunity submitted through your partner account.'],
      mandates:['Buyer Mandates','Review the buy boxes Outerhaven is actively sourcing against.']
    };
    $('pageTitle').textContent=labels[section]?.[0]||'Originator Portal';
    $('pageSub').textContent=labels[section]?.[1]||'';
    $('topSubmit').style.display=section==='submit'?'none':'';
    window.scrollTo({top:0,behavior:'smooth'});
  }

  function renderAll(){
    renderNotice();renderMetrics();renderHomeMandates();renderRecent();renderSubmissions();renderMandates();renderEstimate();
    $('navSubmissionCount').textContent=deals.length;
    $('navMandateCount').textContent=buyBoxes.length;
  }

  function renderNotice(){
    const pilot=member?.membership==='pilot';
    $('portalNotice').innerHTML=pilot?`<div class="noticeBar"><div><strong>Pilot partner access</strong><span>Your account is approved for the Outerhaven originator portal. Submitted opportunities are reviewed individually before any buyer introduction.</span></div><button type="button" data-go="mandates">Review mandates</button></div>`:'';
    $('portalNotice').querySelector('[data-go]')?.addEventListener('click',()=>showSection('mandates'));
  }

  function renderMetrics(){
    const submitted=deals.filter(d=>d.status!=='draft').length;
    const review=deals.filter(d=>['submitted','reviewing'].includes(d.status)).length;
    const info=deals.filter(d=>d.status==='info_requested').length;
    const accepted=deals.filter(d=>d.status==='accepted').length;
    const m=[['Submitted',submitted,'Total sent for review'],['Under Review',review,'Currently with Outerhaven'],['Info Requested',info,'Needs your response'],['Accepted',accepted,'Approved to advance']];
    $('metrics').innerHTML=m.map(x=>`<article class="metric"><span>${esc(x[0])}</span><strong>${esc(x[1])}</strong><small>${esc(x[2])}</small></article>`).join('');
  }

  function renderHomeMandates(){
    const target=$('homeMandates');
    if(!buyBoxes.length){target.innerHTML='<div class="empty">No buyer mandates are currently published. You can still submit a strong private opportunity for review.</div>';return}
    target.innerHTML=`<div class="thesisQuick">${buyBoxes.slice(0,4).map(b=>`<div class="thesisQuickRow"><span>${esc(b.sector)}</span><b>${esc(range(b))} · ${esc(b.geography)}</b></div>`).join('')}</div>`;
  }

  function renderRecent(){
    const d=deals.slice(0,5);
    $('recentSubmissions').innerHTML=d.length?d.map(x=>`<button type="button" class="recentItem" data-open-deal="${x.id}" style="width:100%;text-align:left;cursor:pointer"><div><strong>${esc(x.title)}</strong><span>${esc(money(x.deal_size))} · ${esc(cap(x.status))}</span></div><span class="statusPill ${esc(x.status)}">${esc(cap(x.status))}</span></button>`).join(''):'<div class="empty">No submissions yet. Submit your first opportunity to begin.</div>';
    bindDealOpeners($('recentSubmissions'));
  }

  function renderSubmissions(){
    const target=$('submissionCards');
    if(!deals.length){target.innerHTML='<div class="empty">You have not submitted any opportunities yet.</div>';return}
    target.innerHTML=deals.map(d=>{
      const fit=bestFitFor(d);
      const canEdit=['draft','info_requested'].includes(d.status);
      const canWithdraw=['submitted','reviewing','info_requested'].includes(d.status);
      return `<article class="submissionCard" tabindex="0" data-open-deal="${d.id}"><div><h3>${esc(d.title)}</h3><div class="submissionMeta">${esc(d.company||'Company not specified')} · ${esc(money(d.deal_size))} · ${esc(d.sector)} · ${esc(d.geography)} · ${esc(date(d.created_at))}</div><div class="submissionSummary">${esc(d.summary||'No summary provided.')}</div><div class="matchWhy">${fit?`Best published mandate fit: ${esc(fit.box.title)} at ${fit.score}%`:'No published mandate match is currently calculated.'}</div><div class="submissionActions">${canEdit?`<button type="button" class="miniBtn" data-edit-deal="${d.id}">Edit & Resubmit</button>`:''}${canWithdraw?`<button type="button" class="miniBtn danger" data-withdraw-deal="${d.id}">Withdraw</button>`:''}</div></div><div class="submissionRight">${fit?`<div class="matchPct">${fit.score}%</div><div class="matchLabel">Best Mandate Fit</div>`:'<div class="matchPct">—</div><div class="matchLabel">Mandate Fit</div>'}<span class="statusPill ${esc(d.status)}">${esc(cap(d.status))}</span></div></article>`;
    }).join('');
    bindDealOpeners(target);
    target.querySelectorAll('[data-edit-deal]').forEach(b=>b.onclick=e=>{e.stopPropagation();editDeal(b.dataset.editDeal)});
    target.querySelectorAll('[data-withdraw-deal]').forEach(b=>b.onclick=e=>{e.stopPropagation();withdrawDeal(b.dataset.withdrawDeal)});
  }

  function renderMandates(){
    const target=$('mandateCards');
    if(!buyBoxes.length){target.innerHTML='<div class="empty" style="grid-column:1/-1">No mandates are published at this time. Outerhaven can still review strong private opportunities outside an active buy box.</div>';return}
    target.innerHTML=buyBoxes.map(b=>`<article class="mandateCard"><div class="mandateCardTop"><div><div class="mandateSector">${esc(b.sector)}</div><h3>${esc(b.title)}</h3></div><div class="mandateScale"><span>Target Scale</span><strong>${esc(range(b))}</strong></div></div><div class="mandateDesc">${esc(b.description||'Active institutional mandate.')}</div><div class="mandateMeta"><div><span>Geography</span><b>${esc(b.geography)}</b></div><div><span>Structure</span><b>${esc(b.transaction_type)}</b></div>${b.min_ebitda?`<div><span>Minimum EBITDA</span><b>${esc(money(b.min_ebitda))}</b></div>`:''}<div><span>Currency</span><b>${esc(b.currency||'USD')}</b></div></div>${b.requirements?`<div class="mandateReq"><strong>Additional criteria:</strong> ${esc(b.requirements)}</div>`:''}</article>`).join('');
  }

  function textMatch(input,criterion,globalWords=[]){
    const a=norm(input),b=norm(criterion);
    if(!b)return true;
    if(globalWords.some(w=>b.includes(w)))return true;
    if(!a)return false;
    return a.includes(b)||b.includes(a)||a.split(' ').some(x=>x.length>3&&b.includes(x));
  }

  function scoreBox(input,box){
    const criteria=[];
    const amount=Number(input.deal_size||0);
    if(box.min_size||box.max_size){criteria.push((!box.min_size||amount>=Number(box.min_size))&&(!box.max_size||amount<=Number(box.max_size)))}
    criteria.push(textMatch(input.sector,box.sector,['agnostic','all sectors','sector agnostic']));
    criteria.push(textMatch(input.geography,box.geography,['global','worldwide','all geographies']));
    criteria.push(textMatch(input.transaction_type,box.transaction_type,['flexible','all structures','multiple structures']));
    if(box.min_ebitda)criteria.push(Number(input.ebitda||0)>=Number(box.min_ebitda));
    const passed=criteria.filter(Boolean).length;
    return criteria.length?Math.round(passed/criteria.length*100):0;
  }

  function bestFitFor(input){
    if(!buyBoxes.length)return null;
    const ranked=buyBoxes.map(box=>({box,score:scoreBox(input,box)})).sort((a,b)=>b.score-a.score);
    return ranked[0]||null;
  }

  function formDeal(){
    return{
      deal_size:parseMoney($('dealAmount').value),
      revenue:parseMoney($('dealRevenue').value),
      ebitda:parseMoney($('dealEbitda').value),
      sector:$('dealSector').value.trim(),
      geography:$('dealGeography').value.trim(),
      transaction_type:$('dealType').value
    };
  }

  function renderEstimate(){
    if(!$('estimateScore'))return;
    const input=formDeal();
    const complete=[input.deal_size,input.sector,input.geography,input.transaction_type].filter(Boolean).length;
    const rows=[['Capital ask',!!input.deal_size],['Sector',!!input.sector],['Geography',!!input.geography],['Transaction structure',!!input.transaction_type]];
    $('fitChecklist').innerHTML=rows.map(r=>`<div class="fitCheck ${r[1]?'good':'warn'}"><span>${esc(r[0])}</span><span>${r[1]?'Complete':'Missing'}</span></div>`).join('');
    if(!buyBoxes.length){
      $('estimateRing').classList.add('noMandates');$('estimateRing').style.setProperty('--score','0%');$('estimateScore').textContent='—';
      $('estimateLabel').textContent='No mandates published';$('estimateCopy').textContent='Outerhaven can still review the opportunity directly.';$('fitMatches').innerHTML='';return;
    }
    if(complete<4){
      $('estimateRing').classList.add('noMandates');$('estimateRing').style.setProperty('--score','0%');$('estimateScore').textContent='—';
      $('estimateLabel').textContent='Complete the matching fields';$('estimateCopy').textContent='Capital ask, sector, geography, and transaction structure are required to compare buyer mandates.';$('fitMatches').innerHTML='';return;
    }
    const ranked=buyBoxes.map(box=>({box,score:scoreBox(input,box)})).sort((a,b)=>b.score-a.score);
    const best=ranked[0];
    $('estimateRing').classList.remove('noMandates');$('estimateRing').style.setProperty('--score',best.score+'%');$('estimateScore').textContent=best.score+'%';
    $('estimateLabel').textContent=best.score>=80?'Strong published fit':best.score>=60?'Potential published fit':'Outside current published criteria';
    $('estimateCopy').textContent=best.score>=60?`Closest current mandate: ${best.box.title}.`:'The opportunity can still be submitted for discretionary review.';
    $('fitMatches').innerHTML=ranked.slice(0,3).map(x=>`<div class="fitMatch"><strong>${esc(x.box.title)}</strong><span>${x.score}%</span></div>`).join('');
  }

  function addFiles(files){
    const allowed=['pdf','docx','xlsx'];
    for(const f of files){
      const ext=(f.name.split('.').pop()||'').toLowerCase();
      if(!allowed.includes(ext)){setMessage(`${f.name} is not an accepted document type.`,'error');continue}
      if(f.size>10*1024*1024){setMessage(`${f.name} is larger than 10 MB.`,'error');continue}
      if(!selectedFiles.some(x=>x.name===f.name&&x.size===f.size))selectedFiles.push(f);
    }
    $('dealFiles').value='';renderFileList();
  }

  function renderFileList(){
    $('fileList').innerHTML=selectedFiles.map((f,i)=>`<div class="fileChip"><span>${esc(f.name)} · ${Math.max(1,Math.round(f.size/1024))} KB</span><button type="button" data-remove-file="${i}">Remove</button></div>`).join('');
    document.querySelectorAll('[data-remove-file]').forEach(b=>b.onclick=()=>{selectedFiles.splice(Number(b.dataset.removeFile),1);renderFileList()});
  }

  async function uploadFiles(dealId){
    const failures=[];
    let uploaded=0;
    for(const file of selectedFiles){
      const path=`${currentUser.id}/${dealId}/${crypto.randomUUID()}-${safeName(file.name)}`;
      const {error}=await sb.storage.from('deal-documents').upload(path,file,{upsert:false,contentType:mimeFor(file)});
      if(error){console.error('document upload',error);failures.push(file.name)}else uploaded++;
    }
    return{uploaded,failures};
  }

  async function submitOpportunity(e){
    e.preventDefault();setMessage('');
    const btn=$('submitDeal');if(btn.disabled)return;
    const payload={
      owner_id:currentUser.id,
      title:$('dealTitle').value.trim(),
      company:$('dealCompany').value.trim(),
      sector:$('dealSector').value.trim(),
      geography:$('dealGeography').value.trim(),
      transaction_type:$('dealType').value,
      currency:'USD',
      deal_size:parseMoney($('dealAmount').value)||null,
      revenue:parseMoney($('dealRevenue').value)||null,
      ebitda:parseMoney($('dealEbitda').value)||null,
      summary:$('dealSummary').value.trim(),
      seller_relationship:$('sellerRelationship').value,
      authority_confirmed:$('authorityConfirmed').checked
    };
    if(!payload.title||!payload.company||!payload.sector||!payload.geography||!payload.transaction_type||!payload.deal_size||!payload.seller_relationship){setMessage('Complete all required transaction fields before submitting.','error');return}
    if(payload.summary.length<40){setMessage('Add a more substantive opportunity summary of at least 40 characters.','error');return}
    if(!payload.authority_confirmed){setMessage('Confirm your seller-side authority before submitting.','error');return}

    btn.disabled=true;btn.textContent=editingDealId?'Resubmitting...':'Submitting...';
    try{
      let dealId=editingDealId;
      if(editingDealId){
        const existing=deals.find(d=>d.id===editingDealId);
        if(!existing||!['draft','info_requested'].includes(existing.status))throw new Error('This opportunity is no longer editable.');
        const {error}=await sb.from('deals').update({...payload,status:existing.status}).eq('id',editingDealId);
        if(error)throw error;
      }else{
        const {data,error}=await sb.from('deals').insert({...payload,status:'draft'}).select('id').single();
        if(error)throw error;
        dealId=data.id;
      }

      const uploadResult=await uploadFiles(dealId);
      const {error:submitError}=await sb.from('deals').update({status:'submitted'}).eq('id',dealId);
      if(submitError)throw submitError;

      $('submissionForm').reset();selectedFiles=[];editingDealId=null;renderFileList();$('submitDeal').textContent='Submit Opportunity';
      await loadData(false);renderAll();showSection('submissions');
      setMessage(uploadResult.failures.length?`Opportunity submitted. ${uploadResult.uploaded} document${uploadResult.uploaded===1?'':'s'} uploaded; ${uploadResult.failures.length} file${uploadResult.failures.length===1?'':'s'} could not be attached.`:'Opportunity submitted successfully and sent to Outerhaven for review.','good');
    }catch(err){
      console.error('submit opportunity',err);
      setMessage(err?.message||'Could not submit the opportunity.','error');
    }finally{
      btn.disabled=false;
      btn.textContent=editingDealId?'Resubmit Opportunity':'Submit Opportunity';
    }
  }

  function editDeal(id){
    const d=deals.find(x=>x.id===id);if(!d||!['draft','info_requested'].includes(d.status))return;
    editingDealId=id;selectedFiles=[];renderFileList();setMessage('');
    $('dealTitle').value=d.title||'';$('dealCompany').value=d.company||'';$('dealAmount').value=d.deal_size||'';$('dealRevenue').value=d.revenue||'';$('dealEbitda').value=d.ebitda||'';$('dealSector').value=d.sector||'';$('dealGeography').value=d.geography||'';$('dealType').value=d.transaction_type||'';$('sellerRelationship').value=d.seller_relationship||'';$('dealSummary').value=d.summary||'';$('authorityConfirmed').checked=!!d.authority_confirmed;
    $('submitDeal').textContent=d.status==='info_requested'?'Resubmit Opportunity':'Save & Submit';
    renderEstimate();showSection('submit');
  }

  function clearEdit(){
    editingDealId=null;selectedFiles=[];$('submissionForm')?.reset();renderFileList();setMessage('');$('submitDeal').textContent='Submit Opportunity';renderEstimate();
  }

  async function withdrawDeal(id){
    const d=deals.find(x=>x.id===id);if(!d||!['submitted','reviewing','info_requested'].includes(d.status))return;
    if(!confirm(`Withdraw "${d.title}" from review?`))return;
    const {error}=await sb.from('deals').update({status:'withdrawn'}).eq('id',id);
    if(error){alert(error.message);return}
    await loadData(false);renderAll();
    if(openDealId===id)await openDeal(id);
  }

  function bindDealOpeners(root){
    root.querySelectorAll('[data-open-deal]').forEach(el=>{
      el.onclick=e=>{if(e.target.closest('[data-edit-deal],[data-withdraw-deal]'))return;openDeal(el.dataset.openDeal)};
      el.onkeydown=e=>{if((e.key==='Enter'||e.key===' ')&&!e.target.closest('button')){e.preventDefault();openDeal(el.dataset.openDeal)}};
    });
  }

  async function listDealDocuments(dealId){
    const folder=`${currentUser.id}/${dealId}`;
    const {data,error}=await sb.storage.from('deal-documents').list(folder,{limit:100,sortBy:{column:'name',order:'asc'}});
    if(error){console.error('list documents',error);return[]}
    return(data||[]).filter(x=>x.name&&x.id).map(x=>({...x,path:`${folder}/${x.name}`}));
  }

  async function openDocument(path){
    const {data,error}=await sb.storage.from('deal-documents').createSignedUrl(path,120);
    if(error){alert(error.message);return}
    window.open(data.signedUrl,'_blank','noopener,noreferrer');
  }

  async function openDeal(id){
    const d=deals.find(x=>x.id===id);if(!d)return;
    openDealId=id;
    $('dealModalTitle').textContent=d.title;
    $('dealModalBody').innerHTML='<div class="empty">Loading opportunity record...</div>';
    $('dealModalOverlay').classList.remove('hidden');$('dealModalOverlay').setAttribute('aria-hidden','false');
    const [eventRes,messageRes,docs]=await Promise.all([
      sb.from('events').select('*').eq('deal_id',id).order('created_at',{ascending:true}),
      sb.from('messages').select('*').eq('deal_id',id).order('created_at',{ascending:true}),
      listDealDocuments(id)
    ]);
    const events=eventRes.data||[],messages=messageRes.data||[];
    const canEdit=['draft','info_requested'].includes(d.status),canWithdraw=['submitted','reviewing','info_requested'].includes(d.status),canMessage=d.status!=='draft';
    $('dealModalBody').innerHTML=`
      <div class="detailGrid">
        <div class="detailBox"><span>Status</span><b>${esc(cap(d.status))}</b></div><div class="detailBox"><span>Capital Ask</span><b>${esc(money(d.deal_size))}</b></div><div class="detailBox"><span>Submitted</span><b>${esc(date(d.created_at))}</b></div>
        <div class="detailBox"><span>Company</span><b>${esc(d.company)}</b></div><div class="detailBox"><span>Sector</span><b>${esc(d.sector)}</b></div><div class="detailBox"><span>Geography</span><b>${esc(d.geography)}</b></div>
        <div class="detailBox"><span>Structure</span><b>${esc(d.transaction_type)}</b></div><div class="detailBox"><span>Revenue</span><b>${esc(money(d.revenue))}</b></div><div class="detailBox"><span>EBITDA</span><b>${esc(money(d.ebitda))}</b></div>
      </div>
      <section class="detailSection"><div class="detailSectionHead"><h3>Opportunity Summary</h3><span class="statusPill ${esc(d.status)}">${esc(cap(d.status))}</span></div><div class="detailCopy">${esc(d.summary)}</div><div class="detailCopy" style="margin-top:9px"><strong>Seller relationship:</strong> ${esc(d.seller_relationship)}</div></section>
      <section class="detailSection"><div class="detailSectionHead"><h3>Supporting Documents</h3></div><div id="modalDocuments" class="documentList">${docs.length?docs.map((f,i)=>`<button type="button" class="documentLink" data-doc-index="${i}">${esc(f.name.replace(/^[0-9a-f-]{36}-/i,''))}</button>`).join(''):'<span class="submissionMeta">No documents attached.</span>'}</div></section>
      <section class="detailSection"><div class="detailSectionHead"><h3>Activity</h3></div><div class="timeline">${events.length?events.map(ev=>`<div class="timelineItem"><span class="timelineDot"></span><b>${esc(cap(ev.action))}</b><time>${esc(datetime(ev.created_at))}</time></div>`).join(''):'<div class="submissionMeta">No activity recorded yet.</div>'}</div></section>
      <section class="detailSection"><div class="detailSectionHead"><h3>Messages</h3></div><div id="modalMessages" class="messageList">${messages.length?messages.map(m=>`<div class="message ${m.author_id===currentUser.id?'own':''}"><div class="messageTop"><span>${m.author_id===currentUser.id?'You':'Outerhaven'}</span><span>${esc(datetime(m.created_at))}</span></div><div class="messageBody">${esc(m.body)}</div></div>`).join(''):'<div class="submissionMeta">No messages yet.</div>'}</div>${canMessage?`<form id="messageForm" class="messageComposer"><textarea id="messageBody" maxlength="6000" required placeholder="Send a note or response to Outerhaven..."></textarea><button class="primaryBtn" type="submit">Send</button></form>`:''}</section>
      <div class="submissionActions" style="margin-top:22px">${canEdit?`<button type="button" class="miniBtn" id="modalEditDeal">Edit & Resubmit</button>`:''}${canWithdraw?`<button type="button" class="miniBtn danger" id="modalWithdrawDeal">Withdraw Opportunity</button>`:''}</div>`;
    docs.forEach((f,i)=>$(`modalDocuments`)?.querySelector(`[data-doc-index="${i}"]`)?.addEventListener('click',()=>openDocument(f.path)));
    $('modalEditDeal')?.addEventListener('click',()=>{closeDealModal();editDeal(id)});
    $('modalWithdrawDeal')?.addEventListener('click',async()=>{await withdrawDeal(id);closeDealModal()});
    $('messageForm')?.addEventListener('submit',async e=>{
      e.preventDefault();
      const body=$('messageBody').value.trim();if(!body)return;
      const button=e.currentTarget.querySelector('button');button.disabled=true;
      const {error}=await sb.from('messages').insert({deal_id:id,author_id:currentUser.id,body});
      if(error){alert(error.message);button.disabled=false;return}
      await openDeal(id);
    });
  }

  function closeDealModal(){
    openDealId=null;$('dealModalOverlay').classList.add('hidden');$('dealModalOverlay').setAttribute('aria-hidden','true');$('dealModalBody').innerHTML='';
  }

  init();
})();