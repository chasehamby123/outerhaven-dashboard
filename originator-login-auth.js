(function(){
  const msg=document.getElementById('msg');
  function show(t,type='error'){msg.textContent=t;msg.className='msg show '+type}
  if(!window.supabase){show('Authentication service did not load. Refresh the page and try again.');return}

  const URL='https://nfcysxqdwpdhrdpgxrlo.supabase.co';
  const KEY='sb_publishable_nBRZvesX4tz7zUPq5QLYfQ__in76dF5';
  const sb=supabase.createClient(URL,KEY);
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));

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
    finally{btn.disabled=false;btn.textContent='Open Partner Dashboard'}
  });

  document.getElementById('createForm').addEventListener('submit',async e=>{
    e.preventDefault();
    msg.className='msg';
    const email=document.getElementById('createEmail').value.trim().toLowerCase();
    const password=document.getElementById('createPassword').value;
    const btn=document.getElementById('createBtn');
    if(password.length<8){show('Use at least 8 characters for the password.');return}
    btn.disabled=true;btn.textContent='Creating account...';
    try{
      const signup=await sb.auth.signUp({email,password,options:{data:{account_type:'originator'}}});
      if(signup.error)throw signup.error;
      if(signup.data.session){await ensureOriginator();return}

      await sleep(250);
      const signin=await sb.auth.signInWithPassword({email,password});
      if(signin.error){
        if(signup.data.user&&Array.isArray(signup.data.user.identities)&&signup.data.user.identities.length===0){
          show('This email already has an account. Use Sign In instead.','good');
          window.setPartnerMode('signin');
          document.getElementById('signinEmail').value=email;
          return;
        }
        throw signin.error;
      }
      await ensureOriginator();
    }catch(err){
      const t=err?.message||'Could not create account.';
      if(/already registered|already been registered|user already exists/i.test(t)){
        show('This email already has an account. Use Sign In instead.','good');
        window.setPartnerMode('signin');
        document.getElementById('signinEmail').value=email;
      }else show(t);
    }finally{btn.disabled=false;btn.textContent='Create Account'}
  });
})();