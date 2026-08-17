const SUPABASE_URL='https://nfcysxqdwpdhrdpgxrlo.supabase.co';
const SUPABASE_KEY='sb_publishable_nBRZvesX4tz7zUPq5QLYfQ__in76dF5';
const sb=supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
let currentUser=null,profile=null,thesis=null,submissions=[],documents=[],selectedFiles=[];
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');

function money(v){const n=Number(v||0);if(!n)return'Not specified';if(n>=1e9)return'$'+(n/1e9).toFixed(n%1e9?1:0)+'B';return'$'+(n/1e6).toFixed(n%1e6?1:0)+'M'}
function date(v){return v?new Date(v).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'}):''}
function slugStatus(v){return String(v||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')}
function friendlyEmailName(email){return String(email||'Originator').split('@')[0].replace(/[._-]+/g,' ').replace(/\b\w/g,c=>c.toUpperCase())}
function setMessage(text,type=''){const el=$('submitMessage');el.textContent=text||'';el.className=`formMessage ${text?'show':''} ${type}`.trim()}

async function init(){
  const {data:{session}}=await sb.auth.getSession();
  if(!session){location.replace('/auth.html');return}
  currentUser=session.user;
  const {data:role,error}=await sb.rpc('dashboard_role');
  if(error||role!=='originator'){
    if(role==='admin'||role==='ops'){location.replace('/shared.html');return}
    await sb.auth.signOut();location.replace('/auth.html');return;
  }
  $('accountEmail').textContent=currentUser.email||'';
  await loadData();
  bind();
  $('loading').classList.add('hidden');$('app').classList.remove('hidden');
  setInterval(()=>loadData(false),60000);
}

async function loadData(render=true){
  const [pr,th,subs,docs]=await Promise.all([
    sb.from('originator_profiles').select('*').eq('user_id',currentUser.id).maybeSingle(),
    sb.from('originator_buyer_thesis').select('*').eq('singleton_key','outerhaven').maybeSingle(),
    sb.from('originator_submissions').select('*').order('created_at',{ascending:false}),
    sb.from('originator_documents').select('*').order('created_at',{ascending:false})
  ]);
  if(pr.error)console.error(pr.error);if(th.error)console.error(th.error);if(subs.error)console.error(subs.error);if(docs.error)console.error(docs.error);
  profile=pr.data||null;thesis=th.data||defaultThesis();submissions=subs.data||[];documents=docs.data||[];
  const displayName=profile?.full_name||friendlyEmailName(currentUser.email);
  $('accountName').textContent=displayName;$('avatar').textContent=(displayName.trim()[0]||'O').toUpperCase();
  if(render)renderAll();
}

function defaultThesis(){return{title:'Outerhaven Institutional Buyer Thesis',summary:'We are broadly sector-agnostic and focus on institutional-scale opportunities of $50M+.',min_transaction_size:50000000,sectors:['Sector agnostic'],geographies:['Global'],structures:['Equity','Debt','Structured Capital','Acquisition Capital','Joint Venture','Strategic Investment','Full or Partial Acquisition'],requirements:'Clear institutional investment case, credible management or sponsorship, a defined capital or transaction need, and sufficient materials for diligence.'}}

function bind(){
  document.querySelectorAll('.navBtn').forEach(b=>b.onclick=()=>showSection(b.dataset.section));
  document.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>showSection(b.dataset.go));
  $('topSubmit').onclick=()=>showSection('submit');
  $('signOut').onclick=async()=>{await sb.auth.signOut();location.replace('/auth.html')};
  $('submissionForm').onsubmit=submitOpportunity;
  const fileInput=$('dealFiles'),drop=$('fileDrop');
  $('chooseFiles').onclick=e=>{e.preventDefault();fileInput.click()};
  drop.onclick=e=>{if(e.target.closest('button'))return;fileInput.click()};
  drop.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();fileInput.click()}};
  fileInput.onchange=()=>addFiles([...fileInput.files]);
  drop.ondragover=e=>{e.preventDefault();drop.classList.add('drag')};drop.ondragleave=()=>drop.classList.remove('drag');
  drop.ondrop=e=>{e.preventDefault();drop.classList.remove('drag');addFiles([...e.dataTransfer.files])};
  ['dealTitle','dealCompany','dealAmount','dealSector','dealGeography','dealType','dealSummary'].forEach(id=>$(id).addEventListener('input',renderEstimate));
  $('dealType').addEventListener('change',renderEstimate);
  renderEstimate();
}

function showSection(section){
  document.querySelectorAll('.section').forEach(s=>s.classList.remove('active'));
  document.querySelectorAll('.navBtn').forEach(b=>b.classList.toggle('active',b.dataset.section===section));
  const el=$(section+'Section');if(el)el.classList.add('active');
  const labels={home:['Originator Overview','Submit institutional opportunities and track their fit with our current buy-side mandate.'],submit:['Submit Opportunity','Send a one-pager or deal package directly into Outerhaven’s review workflow.'],submissions:['My Submissions','Track every opportunity you have submitted through the partner portal.'],thesis:['Buyer Thesis','See the current criteria we use to assess whether an opportunity fits our buy-side network.']};
  $('pageTitle').textContent=labels[section]?.[0]||'Originator Portal';$('pageSub').textContent=labels[section]?.[1]||'';
  $('topSubmit').style.display=section==='submit'?'none':'';
  window.scrollTo({top:0,behavior:'smooth'});
}

function renderAll(){renderMetrics();renderThesis();renderRecent();renderSubmissions();$('navSubmissionCount').textContent=submissions.length}
function renderMetrics(){
  const avg=submissions.length?Math.round(submissions.reduce((a,s)=>a+Number(s.match_score||0),0)/submissions.length):0;
  const active=submissions.filter(s=>['Matching','Buyer Interest','Engagement Active'].includes(s.status)).length;
  const buyerInterest=submissions.filter(s=>['Buyer Interest','Engagement Active'].includes(s.status)).length;
  const m=[['Submitted',submissions.length,'Total opportunities'],['Average Match',avg+'%','Across your submissions'],['Active Matching',active,'Currently progressing'],['Buyer Interest',buyerInterest,'Interest or engagement']];
  $('metrics').innerHTML=m.map(x=>`<article class="metric"><span>${x[0]}</span><strong>${x[1]}</strong><small>${x[2]}</small></article>`).join('');
}
function renderThesis(){
  const t=thesis||defaultThesis();
  $('homeThesis').innerHTML=`<div class="thesisQuick"><div class="thesisQuickRow"><span>Preferred scale</span><b>${esc(money(t.min_transaction_size))}+</b></div><div class="thesisQuickRow"><span>Sector</span><b>${esc((t.sectors||['Sector agnostic']).join(', '))}</b></div><div class="thesisQuickRow"><span>Geography</span><b>${esc((t.geographies||['Global']).join(', '))}</b></div><div class="thesisQuickRow"><span>Primary filter</span><b>Scale, quality, investability</b></div></div>`;
  $('thesisTitle').textContent=t.title||'';$('thesisSummary').textContent=t.summary||'';$('thesisMin').textContent=money(t.min_transaction_size)+'+';
  $('thesisSectors').innerHTML=(t.sectors||[]).map(v=>`<span class="tag">${esc(v)}</span>`).join('');
  $('thesisGeographies').innerHTML=(t.geographies||[]).map(v=>`<span class="tag">${esc(v)}</span>`).join('');
  $('thesisStructures').innerHTML=(t.structures||[]).map(v=>`<span class="tag">${esc(v)}</span>`).join('');
  $('thesisRequirements').textContent=t.requirements||'';
}
function renderRecent(){
  const d=submissions.slice(0,4);$('recentSubmissions').innerHTML=d.length?d.map(s=>`<div class="recentItem"><div><strong>${esc(s.title)}</strong><span>${esc(money(s.capital_amount))} · ${esc(s.status)}</span></div><div class="miniScore">${Number(s.match_score||0)}%</div></div>`).join(''):'<div class="empty">No submissions yet. Submit your first opportunity to see it here.</div>';
}
function renderSubmissions(){
  $('submissionCards').innerHTML=submissions.length?submissions.map(s=>{
    const ds=documents.filter(d=>d.submission_id===s.id);
    return `<article class="submissionCard"><div><h3>${esc(s.title)}</h3><div class="submissionMeta">${esc(s.company_name||'Company not specified')} · ${esc(money(s.capital_amount))} · ${esc(s.sector||'Sector not specified')} · ${esc(s.geography||'Geography not specified')} · Submitted ${esc(date(s.created_at))}</div>${s.summary?`<div class="submissionSummary">${esc(s.summary)}</div>`:''}<div class="matchWhy">${esc(s.match_explanation||'Match analysis pending.')}</div><div class="docs">${ds.length?ds.map(d=>`<button type="button" class="docBtn" data-doc="${d.id}">${esc(d.file_name)}</button>`).join(''):'<span class="submissionMeta">No supporting documents attached.</span>'}</div></div><div class="submissionRight"><div class="matchPct">${Number(s.match_score||0)}%</div><div class="matchLabel">Buyer Thesis Match</div><span class="status ${slugStatus(s.status)}">${esc(s.status)}</span></div></article>`
  }).join(''):'<div class="empty">You have not submitted any opportunities yet.</div>';
  document.querySelectorAll('[data-doc]').forEach(b=>b.onclick=()=>openDocument(b.dataset.doc));
}

async function openDocument(id){
  const d=documents.find(x=>x.id===id);if(!d)return;
  const {data,error}=await sb.storage.from('originator-documents').createSignedUrl(d.storage_path,120);
  if(error){alert(error.message);return}window.open(data.signedUrl,'_blank','noopener');
}

function addFiles(files){
  const allowed=['pdf','doc','docx','ppt','pptx'];
  for(const f of files){
    const ext=(f.name.split('.').pop()||'').toLowerCase();
    if(!allowed.includes(ext)){setMessage(`${f.name} is not an accepted document type.`,'error');continue}
    if(f.size>15*1024*1024){setMessage(`${f.name} is larger than 15 MB.`,'error');continue}
    if(!selectedFiles.some(x=>x.name===f.name&&x.size===f.size))selectedFiles.push(f);
  }
  $('dealFiles').value='';renderFileList();renderEstimate();
}
function renderFileList(){
  $('fileList').innerHTML=selectedFiles.map((f,i)=>`<div class="fileChip"><span>${esc(f.name)} · ${Math.max(1,Math.round(f.size/1024))} KB</span><button type="button" data-remove-file="${i}">Remove</button></div>`).join('');
  document.querySelectorAll('[data-remove-file]').forEach(b=>b.onclick=()=>{selectedFiles.splice(Number(b.dataset.removeFile),1);renderFileList();renderEstimate()});
}

function estimate(){
  const amount=Number($('dealAmount').value||0),title=$('dealTitle').value.trim(),company=$('dealCompany').value.trim(),sector=$('dealSector').value.trim(),geo=$('dealGeography').value.trim(),type=$('dealType').value,summary=$('dealSummary').value.trim();
  let score=0;if(amount>=100000000)score+=45;else if(amount>=50000000)score+=40;else if(amount>=25000000)score+=20;else if(amount>0)score+=8;
  if(title&&company)score+=5;if(sector)score+=10;if(geo)score+=10;if(type)score+=10;if(summary.length>=120)score+=10;else if(summary.length>=40)score+=6;if(selectedFiles.length)score+=15;
  return Math.min(100,score);
}
function renderEstimate(){
  const score=estimate(),amount=Number($('dealAmount')?.value||0),summary=$('dealSummary')?.value.trim()||'';
  $('estimateScore').textContent=score+'%';$('estimateRing').style.setProperty('--score',score+'%');
  let label='Complete the submission',copy='Your score updates as you add the details institutional buyers need to evaluate the opportunity.';
  if(score>=85){label='Strong thesis fit';copy='This opportunity appears well aligned with the current Outerhaven mandate, subject to review and diligence.'}
  else if(score>=65){label='Potential fit';copy='The opportunity has meaningful alignment, but additional scale or information may improve its institutional readiness.'}
  else if(score>0){label='Developing fit';copy='Add missing transaction details and supporting materials to improve the fit assessment.'}
  $('estimateLabel').textContent=label;$('estimateCopy').textContent=copy;
  const rows=[['$50M+ preferred scale',amount>=50000000?40:amount>=25000000?20:0,amount>=50000000?'Strong':amount?'Below thesis':'Missing'],['Sector + geography',($('dealSector')?.value.trim()?10:0)+($('dealGeography')?.value.trim()?10:0),$('dealSector')?.value.trim()&&$('dealGeography')?.value.trim()?'Complete':'Incomplete'],['Transaction structure',$('dealType')?.value?10:0,$('dealType')?.value?'Complete':'Missing'],['Opportunity context',summary.length>=120?10:summary.length>=40?6:0,summary.length>=120?'Strong':summary?'Needs detail':'Missing'],['Supporting materials',selectedFiles.length?15:0,selectedFiles.length?`${selectedFiles.length} attached`:'Not attached']];
  $('fitChecklist').innerHTML=rows.map(r=>`<div class="fitCheck ${r[1]>0?'good':'warn'}"><span>${esc(r[0])}</span><span>${esc(r[2])}</span></div>`).join('');
}

function safeName(name){return name.normalize('NFKD').replace(/[^a-zA-Z0-9._-]+/g,'-').replace(/-+/g,'-').slice(-120)||'document'}
async function submitOpportunity(e){
  e.preventDefault();setMessage('');
  const btn=$('submitDeal');if(btn.disabled)return;
  const payload={originator_user_id:currentUser.id,title:$('dealTitle').value.trim(),company_name:$('dealCompany').value.trim()||null,transaction_type:$('dealType').value,capital_amount:Number($('dealAmount').value||0)||null,sector:$('dealSector').value.trim()||null,geography:$('dealGeography').value.trim()||null,summary:$('dealSummary').value.trim()||null};
  if(!payload.title||!payload.capital_amount||!payload.sector||!payload.geography||!payload.transaction_type||!payload.summary){setMessage('Complete the required opportunity fields before submitting.','error');return}
  btn.disabled=true;btn.textContent='Submitting...';
  try{
    const {data:submission,error}=await sb.from('originator_submissions').insert(payload).select('id').single();if(error)throw error;
    let uploaded=0,failed=[];
    for(const f of selectedFiles){
      const path=`${currentUser.id}/${submission.id}/${crypto.randomUUID()}-${safeName(f.name)}`;
      const up=await sb.storage.from('originator-documents').upload(path,f,{upsert:false,contentType:f.type||undefined});
      if(up.error){failed.push(f.name);continue}
      const meta=await sb.from('originator_documents').insert({originator_user_id:currentUser.id,submission_id:submission.id,document_type:/one[-_ ]?pager/i.test(f.name)?'one_pager':'supporting_material',file_name:f.name,storage_path:path,mime_type:f.type||null,file_size:f.size});
      if(meta.error){failed.push(f.name);await sb.storage.from('originator-documents').remove([path]);continue}
      uploaded++;
    }
    $('submissionForm').reset();selectedFiles=[];renderFileList();renderEstimate();
    await loadData();
    setMessage(failed.length?`Opportunity submitted. ${uploaded} document${uploaded===1?'':'s'} uploaded; ${failed.length} file${failed.length===1?'':'s'} could not be attached.`:'Opportunity submitted successfully and sent to Outerhaven for review.','good');
    showSection('submissions');
  }catch(err){console.error(err);setMessage(err?.message||'Could not submit the opportunity.','error')}
  finally{btn.disabled=false;btn.textContent='Submit Opportunity'}
}

init();