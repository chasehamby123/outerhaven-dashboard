(function(){
  if(window.__outerhavenOpsAccessGuard)return;
  window.__outerhavenOpsAccessGuard=true;
  if(typeof handleAuth!=='function')return;
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
        return;
      }
      await loadData();
      subscribe();
      return;
    }
    showAuth('');
  };
})();
