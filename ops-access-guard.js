(function(){
  if(window.__outerhavenOpsAccessGuard)return;
  window.__outerhavenOpsAccessGuard=true;
  if(typeof handleAuth!=='function')return;

  const adminLoadData=typeof loadData==='function'?loadData:null;
  const adminSubscribe=typeof subscribe==='function'?subscribe:null;

  handleAuth=async function(){
    const {data:{session}}=await sb.auth.getSession();
    if(session){
      if(!(await allowed(session.user.email))){await sb.auth.signOut();showAuth('This email is not approved for the dashboard.');return}
      currentUser=session.user;
      if(document.getElementById('signedInEmail'))document.getElementById('signedInEmail').textContent=session.user.email;
      document.getElementById('authGate')?.classList.add('hidden');
      document.getElementById('loadingScreen')?.classList.add('hidden');
      const {data:role,error}=await sb.rpc('dashboard_role');
      if(error){console.error('dashboard role',error);return}
      window.__outerhavenDashboardRole=role||null;
      if(role==='originator'){
        location.replace('/originator.html');
        return;
      }
      if(!['admin','ops'].includes(role)){
        await sb.auth.signOut();
        showAuth('This account does not have an active Outerhaven dashboard role.');
        return;
      }
      if(role==='ops'){
        document.body.classList.add('dailyOpsOnly');
        loadData=async function(){return};
        subscribe=function(){return};
        return;
      }
      if(adminLoadData){loadData=adminLoadData;await loadData()}
      if(adminSubscribe){subscribe=adminSubscribe;subscribe()}
      loadScript('/relationship-only-person-entry.js');
      loadScript('/buy-side-partner-sync.js');
      loadScript('/buy-side-thesis-status-viewer.js',()=>loadScript('/buy-side-thesis-preview-click-guard.js'));
      loadScript('/opportunity-buyer-matches.js');
      loadScript('/originator-admin.js',()=>loadScript('/originator-preview-admin.js',()=>loadScript('/originator-test-admin.js',()=>loadScript('/originator-review-admin.js',()=>loadScript('/originator-review-diligence-admin.js',()=>loadScript('/originator-production-admin.js'))))));
      return;
    }
    showAuth('');
  };

  function loadScript(src,onload){
    const existing=document.querySelector(`script[src="${src}"]`);
    if(existing){if(onload)existing.addEventListener('load',onload,{once:true});return existing}
    const s=document.createElement('script');s.src=src;s.async=false;if(onload)s.onload=onload;document.head.appendChild(s);return s;
  }

  loadScript('/dashboard-static-metrics.js');
  loadScript('/revenue-dashboard.js');
  loadScript('/ai-image-quick-add.js');
  loadScript('/dashboard-pipeline-regression-guard.js');
  loadScript('/daily-ops-v3.js',()=>loadScript('/daily-ops-v3-adjustments.js',()=>loadScript('/daily-ops-dm-card-viewer.js',()=>loadScript('/daily-ops-post-schedule.js'))));
})();
