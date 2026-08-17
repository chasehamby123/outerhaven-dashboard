(function(){
  if(window.__outerhavenDailyOpsPostMetrics)return;
  window.__outerhavenDailyOpsPostMetrics=true;

  let accounts=[],posts=[],dms=[],postItems=[],channel=null,applyTimer=null;
  const expandedAccounts=new Set();
  const style=document.createElement('style');
  style.textContent=`
    .dailyOpsAutoCount{display:flex;align-items:center;justify-content:flex-end;gap:7px;font-size:9px;color:#7a8190;font-weight:750;flex-wrap:wrap}
    .dailyOpsAutoCount strong{display:inline-flex;min-width:30px;height:28px;padding:0 9px;align-items:center;justify-content:center;border-radius:8px;background:#f2f4f7;color:#252b35;font-size:12px}
    .dailyOpsPostPerformance{display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin-top:8px}
    .dailyOpsPostPerformance span{font-size:8px;font-weight:850;padding:5px 7px;border-radius:999px;background:#f2f4f7;color:#596273}
    .dailyOpsPostPerformance span.primary{background:#eef7ff;color:#225e9a}
    .dailyOpsPostPerformance span.good{background:#eefaf2;color:#237a45}
    .dailyOpsPostPerformance a,.dailyOpsPostsToggle{font-size:8px;font-weight:850;color:#344054;text-decoration:none;border:1px solid #d8dde5;border-radius:7px;padding:5px 7px;background:#fff;cursor:pointer}
    .dailyOpsPostNameField{width:100%!important;margin-top:7px!important;padding:7px 8px!important;font-size:9px!important;border:1px solid #d3d7dc!important;border-radius:8px!important;background:#fff!important}
    .dailyOpsPostHistory{grid-column:1/-1;margin-top:3px;border-top:1px solid #edf0f3;padding-top:10px;display:grid;gap:7px}
    .dailyOpsPostHistoryHead{display:flex;align-items:center;justify-content:space-between;gap:10px;font-size:9px;font-weight:850;color:#626b79}
    .dailyOpsPostHistoryHead span{font-weight:650;color:#8a919d}
    .dailyOpsPostRow{display:grid;grid-template-columns:minmax(180px,1fr) auto auto;gap:12px;align-items:center;background:#f8f9fb;border:1px solid #e8ebef;border-radius:9px;padding:10px 11px}
    .dailyOpsPostTitle{font-size:10px;font-weight:900;color:#303744;line-height:1.35}.dailyOpsPostTitle small{display:block;font-size:8px;font-weight:650;color:#8a919d;margin-top:3px}
    .dailyOpsPostComments{font-size:10px;color:#68717f;white-space:nowrap}.dailyOpsPostComments strong{color:#252b35;font-size:13px;margin-right:3px}
    .dailyOpsPostOpen{font-size:8px;font-weight:850;color:#344054;text-decoration:none;border:1px solid #d8dde5;border-radius:7px;padding:5px 7px;background:#fff;white-space:nowrap}
    .dailyOpsPostHistoryEmpty{font-size:9px;color:#7b8390;border:1px dashed #d6dbe2;border-radius:8px;padding:10px;background:#fafbfc}
    @media(max-width:760px){.dailyOpsPostRow{grid-template-columns:1fr auto}.dailyOpsPostTitle{grid-column:1/-1}.dailyOpsPostOpen{justify-self:start}}
  `;
  document.head.appendChild(style);

  const safe=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  function localDate(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
  function accountPosts(accountId){return posts.filter(p=>p.account_id===accountId).sort((a,b)=>String(b.posted_at||'').localeCompare(String(a.posted_at||'')))}
  function currentPost(accountId){return accountPosts(accountId)[0]||null}
  function postDms(postId){return dms.filter(d=>d.post_id===postId)}
  function postItem(accountId){return postItems.find(i=>i.account_id===accountId)||null}
  function taskByTitle(card,title){return [...card.querySelectorAll('.dailyOpsTask')].find(t=>t.querySelector('.dailyOpsTaskTitle')?.textContent?.trim().startsWith(title))||null}
  function fmtDate(v){if(!v)return'';return new Date(v).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'})}

  async function savePostName(itemId,value){
    const name=value.trim();
    const {error}=await sb.from('daily_ops_items').update({notes:name||null,updated_at:new Date().toISOString(),updated_by:typeof currentUser!=='undefined'&&currentUser?currentUser.id:null}).eq('id',itemId);
    if(error){alert(error.message);return}
    const item=postItems.find(x=>x.id===itemId);if(item)item.notes=name;
    setTimeout(refresh,120);
  }

  function injectPostNameField(postTask,account){
    const item=postItem(account.id);if(!item)return;
    const urlInput=postTask.querySelector('[data-post-url]');if(!urlInput)return;
    const parent=urlInput.parentElement;if(!parent)return;
    let input=parent.querySelector('[data-daily-post-name]');
    if(!input){
      input=document.createElement('input');
      input.className='dailyOpsPostNameField';
      input.dataset.dailyPostName=item.id;
      input.placeholder='Post name, e.g. 900+ Family Offices';
      parent.insertBefore(input,urlInput);
    }
    if(document.activeElement!==input)input.value=item.notes||'';
    input.onchange=()=>savePostName(item.id,input.value);

    const button=postTask.querySelector('[data-toggle-item]');
    if(button&&!button.dataset.postNameGuard){
      button.dataset.postNameGuard='1';
      button.addEventListener('click',e=>{
        if(item.status==='done')return;
        const current=parent.querySelector('[data-daily-post-name]');
        if(!current?.value.trim()){
          e.preventDefault();e.stopImmediatePropagation();
          alert('Add a short post name before marking it posted.');
          current?.focus();
        }
      },true);
    }
  }

  function postRow(post){
    const name=post.post_name||`LinkedIn Post · ${fmtDate(post.posted_at)}`;
    return `<div class="dailyOpsPostRow"><div class="dailyOpsPostTitle">${safe(name)}<small>${safe(fmtDate(post.posted_at))}</small></div><div class="dailyOpsPostComments"><strong>${Number(post.commenter_count||0)}</strong> comments</div>${post.linkedin_post_url?`<a class="dailyOpsPostOpen" href="${safe(post.linkedin_post_url)}" target="_blank" rel="noopener">Open Post</a>`:'<span></span>'}</div>`;
  }

  function historyHtml(account){
    const rows=accountPosts(account.id);
    if(!rows.length)return '<div class="dailyOpsPostHistory"><div class="dailyOpsPostHistoryEmpty">No tracked posts yet. Add the post name and LinkedIn URL under Post Today, then mark it posted.</div></div>';
    const shown=rows.slice(0,8);
    return `<div class="dailyOpsPostHistory"><div class="dailyOpsPostHistoryHead"><div>Recent Posts</div><span>Post name · comments</span></div>${shown.map(postRow).join('')}${rows.length>shown.length?`<div class="dailyOpsPostHistoryEmpty">Showing the latest ${shown.length} of ${rows.length} tracked posts.</div>`:''}</div>`;
  }

  function applyDom(){
    const cards=[...document.querySelectorAll('.dailyOpsAccount')];
    if(!cards.length||!accounts.length)return;
    cards.forEach((card,i)=>{
      const account=accounts[i];if(!account)return;
      const allPosts=accountPosts(account.id);
      const latest=currentPost(account.id);
      const totalComments=allPosts.reduce((n,p)=>n+Number(p.commenter_count||0),0);
      const latestLinked=latest?postDms(latest.id):[];
      const latestQualified=latestLinked.length;
      const latestWhatsapp=latestLinked.filter(x=>x.status==='whatsapp').length;

      const commentsTask=taskByTitle(card,'Comments');
      if(commentsTask){
        const old=commentsTask.querySelector('.dailyOpsCountWrap');
        let auto=commentsTask.querySelector('.dailyOpsAutoCount');
        if(old){auto=document.createElement('div');auto.className='dailyOpsAutoCount';old.replaceWith(auto)}
        if(auto){
          auto.innerHTML=`<span>${allPosts.length} post${allPosts.length===1?'':'s'}</span><strong>${totalComments}</strong><span>comments</span><button type="button" class="dailyOpsPostsToggle" data-post-history-account="${account.id}">${expandedAccounts.has(account.id)?'Hide Posts':'View Posts'}</button>`;
          const btn=auto.querySelector('[data-post-history-account]');
          if(btn)btn.onclick=e=>{e.preventDefault();e.stopPropagation();expandedAccounts.has(account.id)?expandedAccounts.delete(account.id):expandedAccounts.add(account.id);scheduleApply()};
        }
        const sub=commentsTask.querySelector('.dailyOpsTaskSub');
        if(sub)sub.textContent=allPosts.length?'Comments are tracked separately for every LinkedIn post on this account.':'Add a post name and URL first. Each post will keep its own comment count.';
        const existing=commentsTask.querySelector('.dailyOpsPostHistory');
        if(expandedAccounts.has(account.id)){
          if(existing)existing.outerHTML=historyHtml(account);else commentsTask.insertAdjacentHTML('beforeend',historyHtml(account));
        }else if(existing)existing.remove();
      }

      const postTask=taskByTitle(card,'Post Today');
      if(postTask){
        injectPostNameField(postTask,account);
        const left=postTask.firstElementChild;
        if(left){
          let perf=left.querySelector('.dailyOpsPostPerformance');
          if(!latest){if(perf)perf.remove();return}
          if(!perf){perf=document.createElement('div');perf.className='dailyOpsPostPerformance';left.appendChild(perf)}
          perf.innerHTML=`<span class="primary">${Number(latest.commenter_count||0)} comments on latest</span><span>${latestQualified} qualified</span><span class="good">${latestWhatsapp} WhatsApp</span>${latest.linkedin_post_url?`<a href="${safe(latest.linkedin_post_url)}" target="_blank" rel="noopener">Open Latest Post</a>`:''}`;
        }
      }
    });
  }

  function scheduleApply(){clearTimeout(applyTimer);applyTimer=setTimeout(applyDom,50)}

  async function refresh(){
    if(typeof sb==='undefined')return;
    const [a,p,d,i]=await Promise.all([
      sb.from('daily_ops_accounts').select('id,owner_name,sort_order,created_at').eq('active',true).order('sort_order').order('created_at'),
      sb.from('daily_ops_posts').select('id,account_id,linkedin_post_url,post_key,post_name,posted_at,commenter_count').order('posted_at',{ascending:false}).limit(200),
      sb.from('daily_ops_dms').select('id,account_id,post_id,status').not('post_id','is',null),
      sb.from('daily_ops_items').select('id,account_id,notes,status,reference_url').eq('work_date',localDate()).eq('item_type','post')
    ]);
    if(a.error||p.error||d.error||i.error){console.error('daily ops post metrics',a.error||p.error||d.error||i.error);return}
    accounts=a.data||[];posts=p.data||[];dms=d.data||[];postItems=i.data||[];scheduleApply();ensureRealtime();
  }

  function ensureRealtime(){
    if(channel||typeof sb==='undefined')return;
    channel=sb.channel('outerhaven-daily-ops-post-metrics-v3')
      .on('postgres_changes',{event:'*',schema:'public',table:'daily_ops_posts'},refresh)
      .on('postgres_changes',{event:'*',schema:'public',table:'daily_ops_post_commenters'},refresh)
      .on('postgres_changes',{event:'*',schema:'public',table:'daily_ops_dms'},refresh)
      .on('postgres_changes',{event:'*',schema:'public',table:'daily_ops_items'},refresh)
      .subscribe();
  }

  const observer=new MutationObserver(scheduleApply);
  function install(){observer.observe(document.body,{childList:true,subtree:true});setTimeout(refresh,600)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();