(function(){
  const SUPABASE_URL='https://xanyalooekgrywntxfxn.supabase.co';
  const SUPABASE_KEY='sb_publishable_gERy66FrPLr7BQdAxCjnDA_78EMAWR2';
  if(!window.supabase){location.replace('/originator-login.html?mode=signin');return}
  const sb=supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
  const $=id=>document.getElementById(id);
  const esc=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
  const cap=v=>String(v||'').replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
  const date=v=>v?new Date(v).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'}):'—';
  let session=null,me=null,members=[],deals=[],boxes=[];

  function parseMoney(value){
    const raw=String(value||'').trim().toLowerCase().replace(/[$,\s]/g,'');
    if(!raw)return null;
    const m=raw.match(/^(\d+(?:\.\d+)?)(k|m|b|thousand|million|billion)?$/i);if(!m)return Number(raw)||null;
    let n=Number(m[1]),s=(m[2]||'').toLowerCase();
    if(s==='k'||s==='thousand')n*=1e3;if(s==='m'||s==='million')n*=1e6;if(s==='b'||s==='billion')n*=1e9;
    return Number.isFinite(n)?n:null;
  }
  function money(v){const n=Number(v||0);if(!n)return'—';if(n>=1e9)return'$'+(n/1e9).toFixed(n%1e9?1:0)+'B';if(n>=1e6)return'$'+(n/1e6).toFixed(n%1e6?1:0)+'M';if(n>=1e3)return'$'+(n/1e3).toFixed(n%1e3?1:0)+'K';return'$'+n.toLocaleString()}
  function range(b){if(b.min_size&&b.max_size)return`${money(b.min_size)}–${money(b.max_size)}`;if(b.min_size)return`${money(b.min_size)}+`;if(b.max_size)return`Up to ${money(b.max_size)}`;return'Flexible'}

  async function init(){
    try{
      const auth=await sb.auth.getSession();session=auth.data.session;
      if(auth.error||!session){location.replace('/originator-login.html?mode=signin');return}
      const mine=await sb.from('members').select('*').eq('id',session.user.id).maybeSingle();
      if(mine.error)throw mine.error;me=mine.data;
      if(!me){await sb.auth.signOut();location.replace('/originator-login.html?mode=signin');return}
      if(me.role!=='admin'||me.status!=='approved'){location.replace(me.status==='approved'?'/originator.html':'/originator-pending.html');return}
      $('adminName').textContent=me.full_name||'Administrator';$('adminEmail').textContent=me.email||session.user.email||'';
      bind();await loadData();
      $('loading').classList.add('hidden');$('adminApp').classList.remove('hidden');
    }catch(err){console.error('originator admin init',err);location.replace('/originator-login.html?mode=signin')}
  }

  function bind(){
    document.querySelectorAll('.adminNav button').forEach(b=>b.onclick=()=>showSection(b.dataset.section));
    $('adminSignout').onclick=async()=>{await sb.auth.signOut();location.replace('/originator-login.html?mode=signin')};
    $('mandateForm').onsubmit=saveMandate;$('cancelMandate').onclick=clearMandateForm;
  }

  function showSection(section){
    document.querySelectorAll('.adminSection').forEach(x=>x.classList.remove('active'));
    document.querySelectorAll('.adminNav button').forEach(x=>x.classList.toggle('active',x.dataset.section===section));
    $(section+'Section').classList.add('active');
    const labels={access:['Access Requests','Approve, decline, or suspend originator access.'],deals:['Deal Review','Review submitted opportunities and update partner-facing status.'],mandates:['Buyer Mandates','Publish and manage the criteria approved originators can see.']};
    $('adminTitle').textContent=labels[section][0];$('adminSub').textContent=labels[section][1];window.scrollTo({top:0,behavior:'smooth'});
  }

  async function loadData(){
    const [mr,dr,br]=await Promise.all([
      sb.from('members').select('*').order('created_at',{ascending:false}),
      sb.from('deals').select('*').order('created_at',{ascending:false}),
      sb.from('buy_boxes').select('*').order('created_at',{ascending:false})
    ]);
    if(mr.error)throw mr.error;if(dr.error)throw dr.error;if(br.error)throw br.error;
    members=mr.data||[];deals=dr.data||[];boxes=br.data||[];renderAll();
  }

  function renderAll(){
    const pending=members.filter(m=>m.role==='originator'&&m.status==='pending').length;
    const approved=members.filter(m=>m.role==='originator'&&m.status==='approved').length;
    const review=deals.filter(d=>['submitted','reviewing','info_requested'].includes(d.status)).length;
    const published=boxes.filter(b=>b.published).length;
    $('adminMetrics').innerHTML=[['Pending Access',pending],['Approved Originators',approved],['Deals in Review',review],['Published Mandates',published]].map(x=>`<article class="metric"><span>${esc(x[0])}</span><strong>${x[1]}</strong></article>`).join('');
    renderMembers();renderDeals();renderBoxes();
  }

  function renderMembers(){
    const rows=members.filter(m=>m.role==='originator');
    $('memberRows').innerHTML=rows.length?rows.map(m=>`<article class="memberRow"><div><div class="rowTitle">${esc(m.full_name||m.email)} <span class="pill ${esc(m.status)}">${esc(cap(m.status))}</span></div><div class="rowMeta">${esc(m.email)} · ${esc(m.firm||'Firm not provided')} · Requested ${esc(date(m.created_at))}</div></div><div class="rowActions"><select data-membership="${m.id}"><option value="pilot" ${m.membership==='pilot'?'selected':''}>Pilot</option><option value="paid" ${m.membership==='paid'?'selected':''}>Paid</option><option value="inactive" ${m.membership==='inactive'?'selected':''}>Inactive</option></select>${m.status!=='approved'?`<button class="btn good" data-member-action="approve" data-id="${m.id}">Approve</button>`:''}${m.status!=='declined'?`<button class="btn bad" data-member-action="decline" data-id="${m.id}">Decline</button>`:''}${m.status==='approved'?`<button class="btn" data-member-action="suspend" data-id="${m.id}">Suspend</button>`:''}${m.status==='suspended'?`<button class="btn good" data-member-action="approve" data-id="${m.id}">Restore</button>`:''}</div></article>`).join(''):'<div class="empty">No originator accounts yet.</div>';
    $('memberRows').querySelectorAll('[data-member-action]').forEach(b=>b.onclick=()=>updateMember(b.dataset.id,b.dataset.memberAction,b));
    $('memberRows').querySelectorAll('[data-membership]').forEach(s=>s.onchange=()=>updateMembership(s.dataset.membership,s.value,s));
  }

  async function updateMember(id,action,button){
    const status={approve:'approved',decline:'declined',suspend:'suspended'}[action];if(!status)return;
    button.disabled=true;
    const selector=document.querySelector(`[data-membership="${id}"]`);const membership=selector?.value||'pilot';
    const {error}=await sb.from('members').update({status,membership}).eq('id',id);
    if(error){alert(error.message);button.disabled=false;return}
    await loadData();
  }

  async function updateMembership(id,membership,select){
    select.disabled=true;const {error}=await sb.from('members').update({membership}).eq('id',id);if(error)alert(error.message);select.disabled=false;if(!error)await loadData();
  }

  function renderDeals(){
    $('dealRows').innerHTML=deals.length?deals.map(d=>{
      const owner=members.find(m=>m.id===d.owner_id);const statuses=['submitted','reviewing','info_requested','accepted','declined','withdrawn'];
      return`<article class="dealRow"><div><div class="rowTitle">${esc(d.title)} <span class="pill ${esc(d.status)}">${esc(cap(d.status))}</span></div><div class="rowMeta">${esc(owner?.full_name||owner?.email||'Unknown originator')} · ${esc(owner?.firm||'')}<br>${esc(money(d.deal_size))} · ${esc(d.sector)} · ${esc(d.geography)} · ${esc(d.transaction_type)}<br>${esc(d.company)} · ${esc(d.seller_relationship)} · ${esc(date(d.created_at))}</div></div><div class="rowActions"><select data-deal-status="${d.id}" ${d.status==='draft'?'disabled':''}>${statuses.map(s=>`<option value="${s}" ${d.status===s?'selected':''}>${cap(s)}</option>`).join('')}</select></div></article>`;
    }).join(''):'<div class="empty">No submitted deals yet.</div>';
    $('dealRows').querySelectorAll('[data-deal-status]').forEach(s=>s.onchange=()=>updateDealStatus(s.dataset.dealStatus,s.value,s));
  }

  async function updateDealStatus(id,status,select){
    select.disabled=true;const {error}=await sb.from('deals').update({status}).eq('id',id);if(error){alert(error.message);select.disabled=false;return}await loadData();
  }

  function renderBoxes(){
    $('boxRows').innerHTML=boxes.length?boxes.map(b=>`<article class="boxRow"><div><div class="rowTitle">${esc(b.title)} <span class="pill ${b.published?'approved':'withdrawn'}">${b.published?'Published':'Hidden'}</span></div><div class="rowMeta">${esc(b.sector)} · ${esc(b.geography)} · ${esc(b.transaction_type)} · ${esc(range(b))}${b.min_ebitda?` · EBITDA ${esc(money(b.min_ebitda))}+`:''}</div></div><div class="rowActions"><button class="btn" data-edit-box="${b.id}">Edit</button><button class="btn bad" data-delete-box="${b.id}">Delete</button></div></article>`).join(''):'<div class="empty">No buyer mandates yet.</div>';
    $('boxRows').querySelectorAll('[data-edit-box]').forEach(b=>b.onclick=()=>editBox(b.dataset.editBox));
    $('boxRows').querySelectorAll('[data-delete-box]').forEach(b=>b.onclick=()=>deleteBox(b.dataset.deleteBox,b));
  }

  function editBox(id){
    const b=boxes.find(x=>x.id===id);if(!b)return;
    $('mandateId').value=b.id;$('mandateTitle').value=b.title||'';$('mandateSector').value=b.sector||'';$('mandateGeography').value=b.geography||'';$('mandateType').value=b.transaction_type||'';$('mandateMin').value=b.min_size||'';$('mandateMax').value=b.max_size||'';$('mandateEbitda').value=b.min_ebitda||'';$('mandateCurrency').value=b.currency||'USD';$('mandateDescription').value=b.description||'';$('mandateRequirements').value=b.requirements||'';$('mandatePublished').checked=!!b.published;$('mandateFormTitle').textContent='Edit Buyer Mandate';$('saveMandate').textContent='Update Mandate';$('mandateMsg').textContent='';window.scrollTo({top:0,behavior:'smooth'});
  }

  function clearMandateForm(){
    $('mandateForm').reset();$('mandateId').value='';$('mandateCurrency').value='USD';$('mandateFormTitle').textContent='New Buyer Mandate';$('saveMandate').textContent='Save Mandate';$('mandateMsg').textContent='';
  }

  async function saveMandate(e){
    e.preventDefault();$('mandateMsg').textContent='';const btn=$('saveMandate');btn.disabled=true;
    const id=$('mandateId').value;
    const payload={title:$('mandateTitle').value.trim(),sector:$('mandateSector').value.trim(),geography:$('mandateGeography').value.trim(),transaction_type:$('mandateType').value.trim(),currency:$('mandateCurrency').value.trim()||'USD',min_size:parseMoney($('mandateMin').value),max_size:parseMoney($('mandateMax').value),min_ebitda:parseMoney($('mandateEbitda').value),description:$('mandateDescription').value.trim(),requirements:$('mandateRequirements').value.trim(),published:$('mandatePublished').checked};
    if(payload.min_size&&payload.max_size&&payload.max_size<payload.min_size){$('mandateMsg').textContent='Maximum size cannot be below minimum size.';btn.disabled=false;return}
    try{
      const result=id?await sb.from('buy_boxes').update(payload).eq('id',id):await sb.from('buy_boxes').insert(payload);
      if(result.error)throw result.error;clearMandateForm();await loadData();
    }catch(err){$('mandateMsg').textContent=err?.message||'Could not save mandate.'}
    finally{btn.disabled=false}
  }

  async function deleteBox(id,button){
    const b=boxes.find(x=>x.id===id);if(!b||!confirm(`Delete buyer mandate "${b.title}"?`))return;
    button.disabled=true;const {error}=await sb.from('buy_boxes').delete().eq('id',id);if(error){alert(error.message);button.disabled=false;return}if($('mandateId').value===id)clearMandateForm();await loadData();
  }

  init();
})();