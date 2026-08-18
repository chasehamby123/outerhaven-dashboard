(function(){
  if(window.__outerhavenWebsiteInbound)return;
  window.__outerhavenWebsiteInbound=true;
  if(typeof sb==='undefined')return;

  let rows=[],filter='all',loading=false;
  const escHtml=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  const money=v=>{const n=Number(v||0);if(!n)return'—';if(n>=1e9)return'$'+(n/1e9).toFixed(n%1e9?1:0)+'B';if(n>=1e6)return'$'+(n/1e6).toFixed(n%1e6?1:0)+'M';return'$'+Math.round(n).toLocaleString()};
  const when=v=>v?new Date(v).toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}):'';

  const style=document.createElement('style');
  style.textContent=`
    .websiteInboundView .inboundTop{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;margin-bottom:14px}.inboundFilters{display:flex;gap:6px;flex-wrap:wrap}.inboundFilter{border:1px solid #cbb397;background:#fffaf3;color:#594c3f;border-radius:999px;padding:7px 10px;font-size:9px;font-weight:800;cursor:pointer}.inboundFilter.active{background:#171511;color:#fffaf3;border-color:#171511}.inboundGrid{display:grid;gap:10px}.inboundCard{background:#fffaf3;border:1px solid #d8c6b1;border-radius:13px;padding:14px;box-shadow:0 8px 22px rgba(55,43,29,.04)}.inboundCardTop{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:14px}.inboundType{font-size:8px;color:#856f58;font-weight:900;text-transform:uppercase;letter-spacing:.1em}.inboundName{font-size:14px;font-weight:850;margin-top:4px;color:#171511}.inboundMeta{font-size:9px;color:#786f64;margin-top:4px}.inboundTime{font-size:8px;color:#8b7c6b;text-align:right}.inboundDetails{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-top:12px}.inboundDetail{background:#f8f0e5;border:1px solid #dfcfbb;border-radius:8px;padding:8px}.inboundDetail span{display:block;font-size:7px;color:#8b7967;text-transform:uppercase;font-weight:850}.inboundDetail b{display:block;font-size:9px;color:#3c332b;margin-top:3px;overflow-wrap:anywhere}.inboundMessage{font-size:9px;color:#64594e;line-height:1.55;margin-top:10px;padding-top:10px;border-top:1px solid #e2d3c1;white-space:pre-wrap}.inboundActions{display:flex;justify-content:space-between;gap:10px;align-items:center;margin-top:11px}.inboundStatus{font-size:8px;font-weight:850;text-transform:uppercase;letter-spacing:.07em}.inboundStatus.new{color:#9b5f24}.inboundStatus.contacted{color:#536b91}.inboundStatus.qualified{color:#247a4b}.inboundStatus.archived{color:#82786e}.inboundActionBtns{display:flex;gap:5px;flex-wrap:wrap}.inboundAction{border:1px solid #cbb397;background:#fffaf3;color:#514538;border-radius:7px;padding:6px 8px;font-size:8px;font-weight:800;cursor:pointer}.inboundAction.primary{background:#171511;color:#fffaf3;border-color:#171511}.inboundEmpty{padding:36px;text-align:center;color:#827569;font-size:10px;border:1px dashed #d5c1a8;border-radius:12px;background:#f8f0e5}@media(max-width:900px){.inboundDetails{grid-template-columns:repeat(2,1fr)}}@media(max-width:600px){.inboundDetails{grid-template-columns:1fr}.inboundActions{display:block}.inboundActionBtns{margin-top:8px}}
  `;document.head.appendChild(style);

  function install(){
    const nav=document.querySelector('.sidebar .nav'),main=document.querySelector('.main');if(!nav||!main)return false;
    if(!document.querySelector('[data-view="websiteInbound"]')){
      const btn=document.createElement('button');btn.className='navBtn';btn.dataset.view='websiteInbound';btn.innerHTML='<span>Website Inbound</span><span id="navWebsiteInbound" class="navCount">0</span>';
      const ai=nav.querySelector('[data-view="ai"]');ai?nav.insertBefore(btn,ai):nav.appendChild(btn);
      btn.addEventListener('click',()=>openView());
    }
    if(!document.getElementById('websiteInboundView')){
      const section=document.createElement('section');section.id='websiteInboundView';section.className='view websiteInboundView';section.innerHTML=`<div class="inboundTop"><div class="listHead"><div><h2>Website Inbound</h2><p>Opportunity and capital-partner inquiries submitted through the public website.</p></div></div><div class="inboundFilters"><button class="inboundFilter active" data-inbound-filter="all">All</button><button class="inboundFilter" data-inbound-filter="new">New</button><button class="inboundFilter" data-inbound-filter="opportunity">Opportunities</button><button class="inboundFilter" data-inbound-filter="capital_partner">Capital Partners</button></div></div><div id="websiteInboundGrid" class="inboundGrid"></div>`;
      main.appendChild(section);
      section.querySelectorAll('[data-inbound-filter]').forEach(b=>b.addEventListener('click',()=>{filter=b.dataset.inboundFilter;section.querySelectorAll('[data-inbound-filter]').forEach(x=>x.classList.toggle('active',x===b));render()}));
    }
    return true;
  }

  function openView(){
    document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
    document.querySelectorAll('.navBtn').forEach(b=>b.classList.toggle('active',b.dataset.view==='websiteInbound'));
    document.getElementById('websiteInboundView')?.classList.add('active');
    if(document.getElementById('pageTitle'))document.getElementById('pageTitle').textContent='Website Inbound';
    if(document.getElementById('pageSub'))document.getElementById('pageSub').textContent='Review new opportunity and capital-partner inquiries from the public website.';
    load();
  }

  async function load(){
    if(loading)return;loading=true;
    try{
      const {data,error}=await sb.from('website_inquiries').select('*').order('created_at',{ascending:false}).limit(200);
      if(error){console.error('website inbound',error);return}
      rows=data||[];render();
    }finally{loading=false}
  }

  function detail(label,value){return value?`<div class="inboundDetail"><span>${escHtml(label)}</span><b>${escHtml(value)}</b></div>`:''}
  function card(r){
    const isOpp=r.inquiry_type==='opportunity';
    const size=isOpp?money(r.opportunity_size):[r.mandate_min?money(r.mandate_min):'',r.mandate_max?money(r.mandate_max):''].filter(Boolean).join(' – ');
    const detailHtml=[detail(isOpp?'Opportunity':'Mandate',isOpp?r.opportunity_name:(r.company||'Capital Partner')),detail(isOpp?'Transaction Size':'Check Size',size),detail('Sector',r.sector),detail('Geography',r.geography),detail(isOpp?'Structure':'Structures',isOpp?r.transaction_type:(r.structures||[]).join(', ')),detail('Email',r.email),detail('Phone',r.phone),detail('LinkedIn',r.linkedin_url)].join('');
    return `<article class="inboundCard" data-inbound-id="${r.id}"><div class="inboundCardTop"><div><div class="inboundType">${isOpp?'Opportunity Inquiry':'Capital Partner Inquiry'}</div><div class="inboundName">${escHtml(r.name)}${r.company?` · ${escHtml(r.company)}`:''}</div><div class="inboundMeta">${escHtml(r.email)}</div></div><div class="inboundTime">${escHtml(when(r.created_at))}</div></div><div class="inboundDetails">${detailHtml}</div>${r.message?`<div class="inboundMessage">${escHtml(r.message)}</div>`:''}<div class="inboundActions"><div class="inboundStatus ${escHtml(r.status)}">${escHtml(r.status)}</div><div class="inboundActionBtns"><a class="inboundAction" href="mailto:${encodeURIComponent(r.email)}">Email</a>${r.status!=='contacted'?`<button class="inboundAction" data-inbound-status="contacted" data-id="${r.id}">Contacted</button>`:''}${r.status!=='qualified'?`<button class="inboundAction primary" data-inbound-status="qualified" data-id="${r.id}">Qualified</button>`:''}${r.status!=='archived'?`<button class="inboundAction" data-inbound-status="archived" data-id="${r.id}">Archive</button>`:''}</div></div></article>`;
  }
  function render(){
    const grid=document.getElementById('websiteInboundGrid');if(!grid)return;
    const visible=rows.filter(r=>filter==='all'||r.status===filter||r.inquiry_type===filter);
    grid.innerHTML=visible.length?visible.map(card).join(''):'<div class="inboundEmpty">No website inquiries in this view.</div>';
    const count=rows.filter(r=>r.status==='new').length;const navCount=document.getElementById('navWebsiteInbound');if(navCount)navCount.textContent=count;
    grid.querySelectorAll('[data-inbound-status]').forEach(b=>b.addEventListener('click',()=>updateStatus(b.dataset.id,b.dataset.inboundStatus,b)));
  }
  async function updateStatus(id,status,button){
    if(button){button.disabled=true;button.textContent='Saving...'}
    const {error}=await sb.from('website_inquiries').update({status,updated_at:new Date().toISOString()}).eq('id',id);
    if(error){alert(error.message);if(button)button.disabled=false;return}
    const row=rows.find(r=>r.id===id);if(row)row.status=status;render();
  }

  if(install())load();else{const t=setInterval(()=>{if(install()){clearInterval(t);load()}},150);setTimeout(()=>clearInterval(t),10000)}
  setInterval(load,60000);
})();
