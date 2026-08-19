(function(){
  if(!window.supabase){location.replace('/originator-login.html?mode=signin');return}
  const client=supabase.createClient('https://nfcysxqdwpdhrdpgxrlo.supabase.co','sb_publishable_nBRZvesX4tz7zUPq5QLYfQ__in76dF5');
  const scripts=['/originator.js','/originator-document-autofill.js','/originator-amount-fix.js','/originator-money-input.js','/originator-diligence.js','/originator-diligence-cleanup.js','/originator-walkthrough.js','/originator-walkthrough-tuning.js','/originator-production-hardening.js','/originator-production-activation.js'];
  function load(src){return new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.async=false;s.onload=resolve;s.onerror=()=>reject(new Error('Could not load '+src));document.body.appendChild(s)})}
  async function start(){
    try{
      const {data:{session}}=await client.auth.getSession();
      if(!session){location.replace('/originator-login.html?mode=signin');return}
      const {data:role,error}=await client.rpc('dashboard_role');
      if(error)throw error;
      if(role==='admin'||role==='ops'){location.replace('/shared.html');return}
      if(role!=='originator'){
        await client.auth.signOut();
        location.replace('/originator-login.html?mode=signin');return;
      }
      for(const src of scripts)await load(src);
    }catch(err){
      console.error('partner entry',err);
      location.replace('/originator-login.html?mode=signin');
    }
  }
  start();
})();