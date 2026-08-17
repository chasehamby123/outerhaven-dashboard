(function(){
  if(window.__outerhavenOriginatorReviewAdmin)return;
  window.__outerhavenOriginatorReviewAdmin=true;
  if(window.__outerhavenDashboardRole!=='admin')return;

  let reviewSubs=[],reviewProfiles=[],reviewDocs=[];
  const e=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
  const money=n=>{n=Number(n||0);if(!n)return'—';if(n>=1e9)return'$'+(n/1e9).toFixed(n%1e9?1:0)+'B';return'$'+(n/1e6).toFixed(n%1e6?1:0)+'M'};
  const when=v=>v?new Date(v).toLocaleDateString(undefined,{month:'short',day:'numeric'}):'—';

  const style=document.createElement('style');
  style.textContent=`
    .orReviewPanel{margin-bottom:16px;background:#fff;border:1px solid #e3e6ea;border-radius:14px;padding:15px}.orReviewHead{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:11px}.orReviewHead h2{margin:0;font-size:15px}.orReviewHead p{font-size:9px;color:#7c8590;margin:4px 0 0}.orCount{min-width:28px;height:28px;border-radius:9px;background:#111318;color:#fff;display:grid;place-items:center;font-size:11px;font-weight:900}.orQueue{display:grid;gap:10px}.orCard{border:1px solid #e4e7eb;border-radius:12px;padding:12px}.orCardTop{display:flex;justify-content:space-between;gap:14px}.orTitle{font-size:12px;font-weight:850}.orMeta{font-size:8.5px;color:#7a838e;margin-top:4px;line-height:1.5}.orSummary{font-size:9px;line-height:1.5;color:#535d68;margin-top:8px;max-width:850px}.orScore{text-align:right;min-width:82px}.orScore strong{font-size:21px}.orScore span{display:block;font-size:8px;color:#7f8893}.orActions{display:flex;gap:7px;flex-wrap:wrap;margin-top:10px;padding-top:10px;border-top:1px solid #edf0f2}.orActions button{border:1px solid #d6dbe1;background:#fff;border-radius:8px;padding:7px 9px;font-size:8.5px;font-weight:850;cursor:pointer}.orActions .orAccept{background:#111318;color:#fff;border-color:#111318}.orActions .orReject{color:#a12c2c;border-color:#eccdcd;background:#fff7f7}.orActions .orHold{color:#8a6417;background:#fffaf0;border-color:#eadbb8}.orEmpty{font-size:9px;color:#818a95;padding:10px 2px}.orModalBack{position:fixed;inset:0;background:rgba(18,21,26,.35);z-index:1500;display:grid;place-items:center;padding:20px}.orModal{width:min(520px,100%);background:#fff;border-radius:14px;padding:16px;box-shadow:0 20px 70px rgba(0,0,0,.18)}.orModalHead{display:flex;justify-content:space-between;gap:12px;align-items:center}.orModalHead h3{font-size:14px;margin:0}.orModalHead button{border:0;background:transparent;font-size:20px;cursor:pointer}.orDocs{display:grid;gap:8px;margin-top:12px}.orDoc{display:flex;justify-content:space-between;gap:12px;align-items:center;border:1px solid #e5e8ec;border-radius:9px;padding:9px}.orDoc span{font-size:9px;overflow:hidden;text-overflow:ellipsis}.orDoc button{border:1px solid #d6dbe1;background:#fff;border-radius:7px;padding:6px 8px;font-size:8px;font-weight:800;cursor:pointer}@media(max-width:650px){.orCardTop{display:block}.orScore{text-align:left;margin-top:8px}}
  `;
  document.head.appendChild(style);

  function install(){
    const view=document.getElementById('originatorsView');
    if(!view||document.getElementById('orReviewPanel'))return !!view;
    const grid=view.querySelector('.oaGrid');
    if(!grid)return false;
    const panel=document.createElement('section');
    panel.id='orReviewPanel';panel.className='orReviewPanel';
    panel.innerHTML='<div class="orReviewHead"><div><div class="oaEyebrow">INTAKE REVIEW</div><h2>New Originator Submissions</h2><p>Review new deals before approving them for active buy-side matching.</p></div><div id="orPendingCount" class="orCount">0</div></div><div id="orQueue" class="orQueue"></div>';
    grid.insertAdjacentElement('beforebegin',panel);
    load();
    return true;
  }

  async function load(){
    try{
      const [s,p,d]=await Promise.all([
        sb.from('originator_submissions').select('*').order('created_at',{ascending:false}),
        sb.from('originator_profiles').select('*'),
        sb.from('originator_documents').select('*').order('created_at')
      ]);
      if(s.error||p.error||d.error)throw(s.error||p.error||d.error);
      reviewSubs=s.data||[];reviewProfiles=p.data||[];reviewDocs=d.data||[];render();
    }catch(err){console.error('originator review queue',err)}
  }

  function render(){
    const q=document.getElementById('orQueue');if(!q)return;
    const pending=reviewSubs.filter(x=>(x.review_decision||'pending')==='pending');
    document.getElementById('orPendingCount').textContent=pending.length;
    q.innerHTML=pending.length?pending.map(s=>{
      const p=reviewProfiles.find(x=>x.user_id===s.originator_user_id),docs=reviewDocs.filter(x=>x.submission_id===s.id);
      return `<article class="orCard"><div class="orCardTop"><div><div class="orTitle">${e(s.title)}</div><div class="orMeta">${e(p?.full_name||p?.email||'Originator')} · ${e(money(s.capital_amount))} · ${e(s.sector||'Sector not specified')} · ${e(s.geography||'Geography not specified')} · ${docs.length} material${docs.length===1?'':'s'} · Submitted ${e(when(s.created_at))}</div>${s.summary?`<div class="orSummary">${e(s.summary)}</div>`:''}</div><div class="orScore"><strong>${Number(s.match_score||0)}%</strong><span>Thesis Match</span></div></div><div class="orActions"><button data-or-materials="${s.id}">View Materials</button>${s.internal_opportunity_id?`<button data-or-open="${s.internal_opportunity_id}">Open Internal Record</button>`:''}<button class="orHold" data-or-review="hold" data-id="${s.id}">Hold</button><button class="orReject" data-or-review="rejected" data-id="${s.id}">Reject</button><button class="orAccept" data-or-review="accepted" data-id="${s.id}">Accept for Matching</button></div></article>`;
    }).join(''):'<div class="orEmpty">No new originator submissions are waiting for review.</div>';
    q.querySelectorAll('[data-or-review]').forEach(b=>b.onclick=()=>review(b.dataset.id,b.dataset.orReview,b));
    q.querySelectorAll('[data-or-materials]').forEach(b=>b.onclick=()=>materials(b.dataset.orMaterials));
    q.querySelectorAll('[data-or-open]').forEach(b=>b.onclick=()=>{if(typeof openDetail==='function')openDetail(b.dataset.orOpen)});
  }

  async function review(id,decision,btn){
    const labels={accepted:'accept this opportunity for active matching',hold:'place this opportunity on hold',rejected:'reject this opportunity'};
    if(!confirm(`Are you sure you want to ${labels[decision]}?`))return;
    const old=btn.textContent;btn.disabled=true;btn.textContent='Saving...';
    try{
      const {data,error}=await sb.rpc('admin_review_originator_submission',{input_submission_id:id,input_decision:decision});
      if(error)throw error;
      await load();
      setTimeout(()=>document.querySelector('.navBtn[data-view="originators"]')?.click(),50);
    }catch(err){alert(err?.message||String(err));btn.disabled=false;btn.textContent=old}
  }

  function materials(id){
    const docs=reviewDocs.filter(x=>x.submission_id===id),s=reviewSubs.find(x=>x.id===id);
    const back=document.createElement('div');back.className='orModalBack';
    back.innerHTML=`<div class="orModal"><div class="orModalHead"><div><div class="oaEyebrow">SUBMISSION MATERIALS</div><h3>${e(s?.title||'Opportunity')}</h3></div><button type="button" aria-label="Close">×</button></div><div class="orDocs">${docs.length?docs.map(d=>`<div class="orDoc"><span>${e(d.file_name)}</span><button type="button" data-open-doc="${d.id}">Open</button></div>`).join(''):'<div class="orEmpty">No supporting materials were uploaded.</div>'}</div></div>`;
    document.body.appendChild(back);back.onclick=ev=>{if(ev.target===back||ev.target.closest('.orModalHead button'))back.remove()};
    back.querySelectorAll('[data-open-doc]').forEach(b=>b.onclick=()=>openDoc(b.dataset.openDoc));
  }

  async function openDoc(id){
    const d=reviewDocs.find(x=>x.id===id);if(!d)return;
    const {data,error}=await sb.storage.from('originator-documents').createSignedUrl(d.storage_path,120);
    if(error){alert(error.message);return}window.open(data.signedUrl,'_blank','noopener');
  }

  if(!install()){
    const timer=setInterval(()=>{if(install())clearInterval(timer)},250);
    setTimeout(()=>clearInterval(timer),10000);
  }
  setInterval(()=>{if(document.getElementById('orReviewPanel'))load()},60000);
})();