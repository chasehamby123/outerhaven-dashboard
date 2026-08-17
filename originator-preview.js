const PREVIEW_URL='https://nfcysxqdwpdhrdpgxrlo.supabase.co';
const PREVIEW_KEY='sb_publishable_nBRZvesX4tz7zUPq5QLYfQ__in76dF5';
const sb=supabase.createClient(PREVIEW_URL,PREVIEW_KEY);
let profiles=[],submissions=[],documents=[],thesis=null,selectedUser='';
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
function money(v){const n=Number(v||0);if(!n)return'Not specified';if(n>=1e9)return'$'+(n/1e9).toFixed(n%1e9?1:0)+'B';return'$'+(n/1e6).toFixed(n%1e6?1:0)+'M'}
function date(v){return v?new Date(v).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'}):''}
function slugStatus(v){return String(v||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')}
function defaultThesis(){return{title:'Outerhaven Institutional Buyer Thesis',summary:'We are broadly sector-agnostic and focus on institutional-scale opportunities of $50M+.',min_transaction_size:50000000,sectors:['Sector agnostic'],geographies:['Global'],structures:['Equity','Debt','Structured Capital','Acquisition Capital','Joint Venture','Strategic Investment','Full or Partial Acquisition'],requirements:'Clear institutional investment case, credible management or sponsorship, a defined capital or transaction need, and sufficient materials for diligence.'}}
function currentProfile(){return profiles.find(p=>p.user_id===selectedUser)||null}
function currentSubs(){return selectedUser?submissions.filter(s=>s.originator_user_id===selectedUser):[]}
function currentDocs(){return selectedUser?documents.filter(d=>d.originator_user_id===selectedUser):[]}

async function init(){
  const {data:{session}}=await sb.auth.getSession();
  if(!session){location.replace('/auth.html');return}
  const {data:role,error}=await sb.rpc('dashboard_role');
  if(error||role!=='admin'){location.replace(role==='originator'?'/originator.html':'/shared.html');return}
  $('backToAdmin').onclick=()=>location.href='/shared.html';
  document.querySelectorAll('.navBtn').forEach(b=>b.onclick=()=>showSection(b.dataset.section));
  document.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>showSection(b.dataset.go));
  $('previewOriginator').onchange=()=>{selectedUser=$('previewOriginator').value;history.replaceState(null,'',selectedUser?`?user=${encodeURIComponent(selectedUser)}`:location.pathname);renderAll()};
  await loadData();
  $('loading').classList.add('hidden');$('app').classList.remove('hidden');
}

async function loadData(){
  const [p,s,d,t]=await Promise.all([
    sb.from('originator_profiles').select('*').order('full_name'),
    sb.from('originator_submissions').select('*').order('created_at',{ascending:false}),
    sb.from('originator_documents').select('*').order('created_at',{ascending:false}),
    sb.from('originator_buyer_thesis').select('*').eq('singleton_key','outerhaven').maybeSingle()
  ]);
  const err=p.error||s.error||d.error||t.error;if(err){console.error(err);return}
  profiles=p.data||[];submissions=s.data||[];documents=d.data||[];thesis=t.data||defaultThesis();
  const requested=new URLSearchParams(location.search).get('user')||'';
  if(requested&&profiles.some(x=>x.user_id===requested))selectedUser=requested;
  const sel=$('previewOriginator');
  sel.innerHTML='<option value="">Empty first-login view</option>'+profiles.map(x=>`<option value="${esc(x.user_id)}">${esc(x.full_name||x.email)}${x.company_name?` · ${esc(x.company_name)}`:''}</option>`).join('');
  sel.value=selectedUser;
  renderAll();
}

function showSection(section){
  if(section==='submit')return;
  document.querySelectorAll('.section').forEach(s=>s.classList.remove('active'));
  document.querySelectorAll('.navBtn').forEach(b=>b.classList.toggle('active',b.dataset.section===section));
  const el=$(section+'Section');if(el)el.classList.add('active');
  const labels={home:['Originator Overview','Submit institutional opportunities and track their fit with our current buy-side mandate.'],submissions:['My Submissions','Track every opportunity you have submitted through the partner portal.'],thesis:['Buyer Thesis','See the current criteria we use to assess whether an opportunity fits our buy-side network.']};
  $('pageTitle').textContent=labels[section]?.[0]||'Originator Portal';$('pageSub').textContent=labels[section]?.[1]||'';
  window.scrollTo({top:0,behavior:'smooth'});
}

function renderAll(){
  const p=currentProfile(),subs=currentSubs();
  const name=p?.full_name||'Originator';
  $('accountName').textContent=name;$('accountEmail').textContent=p?.email||'new originator';$('avatar').textContent=(name.trim()[0]||'O').toUpperCase();
  $('navSubmissionCount').textContent=subs.length;
  renderMetrics();renderThesis();renderRecent();renderSubmissions();
}
function renderMetrics(){
  const subs=currentSubs();const av=subs.length?Math.round(subs.reduce((a,s)=>a+Number(s.match_score||0),0)/subs.length):0;
  const active=subs.filter(s=>['Matching','Buyer Interest','Engagement Active'].includes(s.status)).length;
  const buyer=subs.filter(s=>['Buyer Interest','Engagement Active'].includes(s.status)).length;
  const m=[['Submitted',subs.length,'Total opportunities'],['Average Match',av+'%','Across your submissions'],['Active Matching',active,'Currently progressing'],['Buyer Interest',buyer,'Interest or engagement']];
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
  const d=currentSubs().slice(0,4);$('recentSubmissions').innerHTML=d.length?d.map(s=>`<div class="recentItem"><div><strong>${esc(s.title)}</strong><span>${esc(money(s.capital_amount))} · ${esc(s.status)}</span></div><div class="miniScore">${Number(s.match_score||0)}%</div></div>`).join(''):'<div class="empty">No submissions yet. Submit your first opportunity to see it here.</div>';
}
function renderSubmissions(){
  const subs=currentSubs(),docs=currentDocs();
  $('submissionCards').innerHTML=subs.length?subs.map(s=>{const ds=docs.filter(d=>d.submission_id===s.id);return `<article class="submissionCard"><div><h3>${esc(s.title)}</h3><div class="submissionMeta">${esc(s.company_name||'Company not specified')} · ${esc(money(s.capital_amount))} · ${esc(s.sector||'Sector not specified')} · ${esc(s.geography||'Geography not specified')} · Submitted ${esc(date(s.created_at))}</div>${s.summary?`<div class="submissionSummary">${esc(s.summary)}</div>`:''}<div class="matchWhy">${esc(s.match_explanation||'Match analysis pending.')}</div><div class="docs">${ds.length?ds.map(d=>`<button type="button" class="docBtn" data-doc="${d.id}">${esc(d.file_name)}</button>`).join(''):'<span class="submissionMeta">No supporting documents attached.</span>'}</div></div><div class="submissionRight"><div class="matchPct">${Number(s.match_score||0)}%</div><div class="matchLabel">Buyer Thesis Match</div><span class="status ${slugStatus(s.status)}">${esc(s.status)}</span></div></article>`}).join(''):'<div class="empty">You have not submitted any opportunities yet.</div>';
  document.querySelectorAll('[data-doc]').forEach(b=>b.onclick=()=>openDocument(b.dataset.doc));
}
async function openDocument(id){const d=documents.find(x=>x.id===id);if(!d)return;const {data,error}=await sb.storage.from('originator-documents').createSignedUrl(d.storage_path,120);if(error){alert(error.message);return}window.open(data.signedUrl,'_blank','noopener')}
init();