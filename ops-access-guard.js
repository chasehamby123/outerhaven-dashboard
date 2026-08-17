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
      if(role==='ops'){
        document.body.classList.add('dailyOpsOnly');
        loadData=async function(){return};
        subscribe=function(){return};
        return;
      }
      if(adminLoadData){loadData=adminLoadData;await loadData()}
      if(adminSubscribe){subscribe=adminSubscribe;subscribe()}
      return;
    }
    showAuth('');
  };

  if(!document.querySelector('script[src="/daily-ops-overview-fix.js"]')){
    const overview=document.createElement('script');
    overview.src='/daily-ops-overview-fix.js';
    overview.async=false;
    document.head.appendChild(overview);
  }

  if(!document.querySelector('script[src="/daily-ops-schedule-admin.js"]')){
    const schedule=document.createElement('script');
    schedule.src='/daily-ops-schedule-admin.js';
    schedule.async=false;
    document.head.appendChild(schedule);
  }

  if(!document.querySelector('script[src="/daily-ops-adspower-handoff.js"]')){
    const adsPower=document.createElement('script');
    adsPower.src='/daily-ops-adspower-handoff.js';
    adsPower.async=false;
    document.head.appendChild(adsPower);
  }
})();
