(function(){
  if(window.__outerhavenDailyOpsPostMetrics)return;
  window.__outerhavenDailyOpsPostMetrics=true;

  let accounts=[],posts=[],dms=[],channel=null,applyTimer=null;
  const style=document.createElement('style');
  style.textContent=`
    .dailyOpsAutoCount{display:flex;align-items:center;justify-content:flex-end;gap:7px;font-size:9px;color:#7a8190;font-weight:750}
    .dailyOpsAutoCount strong{display:inline-flex;min-width:30px;height:28px;padding:0 9px;align-items:center;justify-content:center;border-radius:8px;background:#f2f4f7;color:#252b35;font-size:12px}
    .dailyOpsPostPerformance{display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin-top:8px}
    .dailyOpsPostPerformance span{font-size:8px;font-weight:850;padding:5px 7px;border-radius:999px;background:#f2f4f7;color:#596273}
    .dailyOpsPostPerformance span.primary{background:#eef7ff;color:#225e9a}
    .dailyOpsPostPerformance span.good{background:#eefaf2;color:#237a45}
    .dailyOpsPostPerformance a{font-size:8px;font-weight:850;color:#344054;text-decoration:none;border:1px solid #d8dde5;border-radius:7px;padding:5px 7px;background:#fff}
  `;
  document.head.appendChild(style);

  function currentPost(accountId){return posts.filter(p=>p.account_id===accountId).sort((a,b)=>String(b.posted_at||'').localeCompare(String(a.posted_at||'')))[0]||null}
  function postDms(postId){return dms.filter(d=>d.post_id===postId)}
  function taskByTitle(card,title){return [...card.querySelectorAll('.dailyOpsTask')].find(t=>t.querySelector('.dailyOpsTaskTitle')?.textContent?.trim().startsWith(title))||null}

  function applyDom(){
    const cards=[...document.querySelectorAll('.dailyOpsAccount')];
    if(!cards.length||!accounts.length)return;
    cards.forEach((card,i)=>{
      const account=accounts[i];if(!account)return;
      const post=currentPost(account.id);
      const commentCount=Number(post?.commenter_count||0);
      const linked=post?postDms(post.id):[];
      const qualified=linked.length;
      const whatsapp=linked.filter(x=>x.status==='whatsapp').length;

      const commentsTask=taskByTitle(card,'Comments');
      if(commentsTask){
        const old=commentsTask.querySelector('.dailyOpsCountWrap');
        if(old){
          const auto=document.createElement('div');auto.className='dailyOpsAutoCount';auto.innerHTML=`<span>Captured</span><strong>${commentCount}</strong>`;old.replaceWith(auto);
        }else{
          const auto=commentsTask.querySelector('.dailyOpsAutoCount');if(auto)auto.innerHTML=`<span>Captured</span><strong>${commentCount}</strong>`;
        }
        const sub=commentsTask.querySelector('.dailyOpsTaskSub');
        if(sub)sub.textContent=post?'Unique commenters captured from the current tracked LinkedIn post.':'Post the LinkedIn URL first. Commenters will populate automatically once Prosp starts capturing them.';
      }

      const postTask=taskByTitle(card,'Post Today');
      if(postTask){
        const left=postTask.firstElementChild;
        if(left){
          let perf=left.querySelector('.dailyOpsPostPerformance');
          if(!post){if(perf)perf.remove();return}
          if(!perf){perf=document.createElement('div');perf.className='dailyOpsPostPerformance';left.appendChild(perf)}
          perf.innerHTML=`<span class="primary">${commentCount} commenter${commentCount===1?'':'s'}</span><span>${qualified} qualified</span><span class="good">${whatsapp} WhatsApp</span>${post.linkedin_post_url?`<a href="${String(post.linkedin_post_url).replaceAll('"','&quot;')}" target="_blank" rel="noopener">Open Post</a>`:''}`;
        }
      }
    });
  }

  function scheduleApply(){clearTimeout(applyTimer);applyTimer=setTimeout(applyDom,40)}

  async function refresh(){
    if(typeof sb==='undefined')return;
    const cutoff=new Date(Date.now()-14*86400000).toISOString();
    const [a,p,d]=await Promise.all([
      sb.from('daily_ops_accounts').select('id,owner_name,sort_order,created_at').eq('active',true).order('sort_order').order('created_at'),
      sb.from('daily_ops_posts').select('id,account_id,linkedin_post_url,posted_at,commenter_count').gte('posted_at',cutoff).order('posted_at',{ascending:false}),
      sb.from('daily_ops_dms').select('id,account_id,post_id,status').not('post_id','is',null)
    ]);
    if(a.error||p.error||d.error){console.error('daily ops post metrics',a.error||p.error||d.error);return}
    accounts=a.data||[];posts=p.data||[];dms=d.data||[];scheduleApply();ensureRealtime();
  }

  function ensureRealtime(){
    if(channel||typeof sb==='undefined')return;
    channel=sb.channel('outerhaven-daily-ops-post-metrics')
      .on('postgres_changes',{event:'*',schema:'public',table:'daily_ops_posts'},refresh)
      .on('postgres_changes',{event:'*',schema:'public',table:'daily_ops_dms'},refresh)
      .subscribe();
  }

  const observer=new MutationObserver(scheduleApply);
  function install(){observer.observe(document.body,{childList:true,subtree:true});setTimeout(refresh,600)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
