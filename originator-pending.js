(function(){
  const SUPABASE_URL='https://xanyalooekgrywntxfxn.supabase.co';
  const SUPABASE_KEY='sb_publishable_gERy66FrPLr7BQdAxCjnDA_78EMAWR2';
  if(!window.supabase){document.getElementById('msg').textContent='Authentication service did not load.';return}
  const sb=supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
  const $=id=>document.getElementById(id);

  async function load(){
    $('msg').textContent='';
    const {data:{session}}=await sb.auth.getSession();
    if(!session){location.replace('/originator-login.html?mode=signin');return}
    const {data:member,error}=await sb.from('members').select('email,full_name,firm,role,status,membership').eq('id',session.user.id).maybeSingle();
    if(error||!member){$('msg').textContent=error?.message||'Your partner profile could not be loaded.';return}
    $('name').textContent=member.full_name||'Not provided';
    $('firm').textContent=member.firm||'Not provided';
    $('email').textContent=member.email||session.user.email||'—';
    $('membership').textContent=(member.membership||'pilot').replace(/\b\w/g,c=>c.toUpperCase());
    $('status').textContent=(member.status||'pending').replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase());

    if(member.role==='admin'&&member.status==='approved'){
      location.replace('/originator-admin.html');return;
    }
    if(member.role==='originator'&&member.status==='approved'&&['pilot','paid'].includes(member.membership)){
      location.replace('/originator.html');return;
    }
    if(member.status==='declined'){
      $('headline').textContent='Access request not approved';
      $('copy').textContent='This account is not currently approved for the Outerhaven partner network. Contact Outerhaven if you believe this status should be reviewed.';
    }else if(member.status==='suspended'){
      $('headline').textContent='Partner access suspended';
      $('copy').textContent='This partner account is currently suspended. Contact Outerhaven for access support.';
    }else{
      $('headline').textContent='Access request under review';
      $('copy').textContent='Your account is active, but submissions and buyer mandates stay locked until Outerhaven approves your partner access.';
    }
  }

  $('refresh').onclick=load;
  $('signOut').onclick=async()=>{await sb.auth.signOut();location.replace('/originator-login.html?mode=signin')};
  load();
})();