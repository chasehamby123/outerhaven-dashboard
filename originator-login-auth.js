(function(){
  const msg=document.getElementById('msg');
  function show(t,type='error'){msg.textContent=t;msg.className='msg show '+type}
  if(!window.supabase){show('Authentication service did not load. Refresh the page and try again.');return}

  const URL='https://nfcysxqdwpdhrdpgxrlo.supabase.co';
  const KEY='sb_publishable_nBRZvesX4tz7zUPq5QLYfQ__in76dF5';
  const sb=supabase.createClient(URL,KEY);

  async function ensureOriginator(){
    const {data:role,error}=await sb.rpc('dashboard_role');
    if(error)throw error;
    if(role!=='originator'){
      await sb.auth.signOut();
      throw new Error('This account does not have partner portal access.');
    }
    location.replace('/originator.html');
  }

  const requestedMode=new URLSearchParams(location.search).get('mode');
  if(requestedMode==='create')window.setPartnerMode?.('create');
  else if(requestedMode==='signin')window.setPartnerMode?.('signin');

  sb.auth.getSession().then(async({data})=>{
    if(data.session){
      try{await ensureOriginator()}catch{}
    }
  });

  document.getElementById('signinForm').addEventListener('submit',async e=>{
    e.preventDefault();
    msg.className='msg';
    const email=document.getElementById('signinEmail').value.trim().toLowerCase();
    const password=document.getElementById('signinPassword').value;
    const btn=document.getElementById('signinBtn');
    btn.disabled=true;btn.textContent='Signing in...';
    try{
      const {error}=await sb.auth.signInWithPassword({email,password});
      if(error)throw error;
      await ensureOriginator();
    }catch(err){show(err?.message||'Could not sign in.')}
    finally{btn.disabled=false;btn.textContent='Open Partner Portal'}
  });

  document.getElementById('createForm').addEventListener('submit',async e=>{
    e.preventDefault();
    msg.className='msg';
    const name=document.getElementById('createName').value.trim();
    const email=document.getElementById('createEmail').value.trim().toLowerCase();
    const password=document.getElementById('createPassword').value;
    const confirm=document.getElementById('createConfirm').value;
    const btn=document.getElementById('createBtn');
    if(!name){show('Enter your full name.');return}
    if(password!==confirm){show('The passwords do not match.');return}
    if(password.length<8){show('Use at least 8 characters for the password.');return}
    btn.disabled=true;btn.textContent='Creating account...';
    try{
      const signup=await sb.auth.signUp({email,password,options:{data:{full_name:name,account_type:'originator'},emailRedirectTo:location.origin+'/originator-login.html?mode=signin'}});
      if(signup.error)throw signup.error;
      if(signup.data.session){await ensureOriginator();return}
      show('Account created. Check your email to confirm it, then sign in to your partner dashboard.','good');
      window.setPartnerMode('signin');
      document.getElementById('signinEmail').value=email;
    }catch(err){
      const t=err?.message||'Could not create account.';
      if(/already registered|already been registered|user already exists/i.test(t)){
        show('This account already exists. Use Sign In instead.','good');
        window.setPartnerMode('signin');
        document.getElementById('signinEmail').value=email;
      }else show(t);
    }finally{btn.disabled=false;btn.textContent='Create Partner Account'}
  });
})();