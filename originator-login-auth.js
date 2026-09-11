(function(){
  const SUPABASE_URL='https://xanyalooekgrywntxfxn.supabase.co';
  const SUPABASE_KEY='sb_publishable_gERy66FrPLr7BQdAxCjnDA_78EMAWR2';
  const msg=document.getElementById('msg');
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));

  function show(text,type='error'){
    if(!msg)return;
    msg.textContent=text;
    msg.className='msg show '+type;
  }
  if(!window.supabase){show('Authentication service did not load. Refresh the page and try again.');return}
  const sb=supabase.createClient(SUPABASE_URL,SUPABASE_KEY);

  async function getMember(userId){
    for(let i=0;i<4;i++){
      const {data,error}=await sb.from('members').select('id,email,full_name,firm,role,status,membership').eq('id',userId).maybeSingle();
      if(error)throw error;
      if(data)return data;
      if(i<3)await sleep(250*(i+1));
    }
    return null;
  }

  async function routeSession(session){
    if(!session?.user)return false;
    const member=await getMember(session.user.id);
    if(!member){
      await sb.auth.signOut();
      throw new Error('Your partner profile could not be loaded. Please sign in again.');
    }
    if(member.role==='admin'&&member.status==='approved'){
      location.replace('/originator-admin.html');
      return true;
    }
    if(member.role!=='originator'){
      await sb.auth.signOut();
      throw new Error('This account is not authorized for the partner portal.');
    }
    if(member.status==='approved'&&['pilot','paid'].includes(member.membership)){
      location.replace('/originator.html');
      return true;
    }
    location.replace('/originator-pending.html');
    return true;
  }

  const requestedMode=new URLSearchParams(location.search).get('mode');
  if(requestedMode==='create')window.setPartnerMode?.('create');
  else window.setPartnerMode?.('signin');

  sb.auth.getSession().then(async({data,error})=>{
    if(error||!data?.session)return;
    try{await routeSession(data.session)}catch(err){console.error('partner route',err)}
  });

  document.getElementById('signinForm')?.addEventListener('submit',async e=>{
    e.preventDefault();msg.className='msg';
    const email=document.getElementById('signinEmail').value.trim().toLowerCase();
    const password=document.getElementById('signinPassword').value;
    const btn=document.getElementById('signinBtn');
    btn.disabled=true;btn.textContent='Signing in...';
    try{
      const {data,error}=await sb.auth.signInWithPassword({email,password});
      if(error)throw error;
      await routeSession(data.session);
    }catch(err){
      console.error('originator sign in',err);
      show(err?.message||'Could not sign in.');
    }finally{
      btn.disabled=false;btn.textContent='Open Partner Portal';
    }
  });

  document.getElementById('createForm')?.addEventListener('submit',async e=>{
    e.preventDefault();msg.className='msg';
    const fullName=document.getElementById('createName').value.trim();
    const firm=document.getElementById('createFirm').value.trim();
    const email=document.getElementById('createEmail').value.trim().toLowerCase();
    const password=document.getElementById('createPassword').value;
    const confirm=document.getElementById('createConfirm').value;
    const btn=document.getElementById('createBtn');
    if(fullName.length<2){show('Enter your full name.');return}
    if(firm.length<2){show('Enter your firm or organization.');return}
    if(password.length<8){show('Use at least 8 characters for the password.');return}
    if(password!==confirm){show('The passwords do not match.');return}
    btn.disabled=true;btn.textContent='Creating request...';
    try{
      const {data,error}=await sb.auth.signUp({
        email,password,
        options:{
          data:{full_name:fullName,firm},
          emailRedirectTo:location.origin+'/originator-login.html?mode=signin'
        }
      });
      if(error)throw error;
      if(data?.user&&Array.isArray(data.user.identities)&&data.user.identities.length===0){
        show('An account already exists for this email. Use Sign In instead.','info');
        window.setPartnerMode?.('signin');
        document.getElementById('signinEmail').value=email;
        return;
      }
      if(data?.session){
        await routeSession(data.session);
        return;
      }
      show('Account created. Confirm your email, then sign in. Your access request will remain pending until Outerhaven approves it.','good');
      document.getElementById('createForm').reset();
    }catch(err){
      console.error('originator signup',err);
      const text=err?.message||'Could not create your access request.';
      if(/already registered|already been registered|user already exists/i.test(text)){
        show('An account already exists for this email. Use Sign In instead.','info');
        window.setPartnerMode?.('signin');
        document.getElementById('signinEmail').value=email;
      }else show(text);
    }finally{
      btn.disabled=false;btn.textContent='Request Partner Access';
    }
  });

  document.getElementById('forgotPassword')?.addEventListener('click',async()=>{
    let email=document.getElementById('signinEmail').value.trim().toLowerCase();
    if(!email){email=String(window.prompt('Enter the email address for your partner account:')||'').trim().toLowerCase()}
    if(!email)return;
    const btn=document.getElementById('forgotPassword');
    btn.disabled=true;btn.textContent='Sending reset link...';msg.className='msg';
    try{
      const {error}=await sb.auth.resetPasswordForEmail(email,{redirectTo:location.origin+'/originator-update-password.html'});
      if(error)throw error;
      show('If that email has an account, a password reset link has been sent.','good');
    }catch(err){
      console.error('originator password reset',err);
      show('We could not send the reset link right now. Try again or contact Outerhaven for access help.');
    }finally{
      btn.disabled=false;btn.textContent='Forgot password?';
    }
  });
})();