(function(){
  const SUPABASE_URL='https://xanyalooekgrywntxfxn.supabase.co';
  const SUPABASE_KEY='sb_publishable_gERy66FrPLr7BQdAxCjnDA_78EMAWR2';
  if(!window.supabase){location.replace('/originator-login.html?mode=signin');return}
  const client=supabase.createClient(SUPABASE_URL,SUPABASE_KEY);

  function load(src){
    return new Promise((resolve,reject)=>{
      const s=document.createElement('script');
      s.src=src;s.async=false;s.onload=resolve;s.onerror=()=>reject(new Error('Could not load '+src));
      document.body.appendChild(s);
    });
  }

  async function start(){
    try{
      const {data:{session},error:sessionError}=await client.auth.getSession();
      if(sessionError||!session){location.replace('/originator-login.html?mode=signin');return}
      const {data:member,error}=await client.from('members').select('role,status,membership').eq('id',session.user.id).maybeSingle();
      if(error)throw error;
      if(!member){await client.auth.signOut();location.replace('/originator-login.html?mode=signin');return}
      if(member.role==='admin'&&member.status==='approved'){location.replace('/originator-admin.html');return}
      if(member.role!=='originator'){await client.auth.signOut();location.replace('/originator-login.html?mode=signin');return}
      if(member.status!=='approved'||!['pilot','paid'].includes(member.membership)){location.replace('/originator-pending.html');return}
      window.__OUTERHAVEN_ORIGINATOR_SB=client;
      await load('/originator.js');
      await load('/originator-pdf-import.js');
      await load('/originator-pdf-intelligence-v2.js');
      await load('/outerhaven-matcher-v3.js');
      await load('/originator-matching-ui-v3.js');
      await load('/originator-mandate-tabs.js');
      await load('/originator-institutional.js');
      await load('/originator-capital-suite.js');
      await load('/originator-capital-suite-matching-v3.js');
      await load('/originator-capital-documents-v3.js');
      await load('/originator-nav-guards.js');
    }catch(err){
      console.error('originator entry',err);
      location.replace('/originator-login.html?mode=signin');
    }
  }
  start();
})();