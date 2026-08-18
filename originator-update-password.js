(function(){
  const msg=document.getElementById('passwordMsg');
  const form=document.getElementById('passwordForm');
  const btn=document.getElementById('savePassword');
  function show(text,type='error'){msg.textContent=text;msg.className='msg show '+type}
  if(!window.supabase){show('Authentication service did not load. Refresh the page and try again.');form.querySelectorAll('input,button').forEach(x=>x.disabled=true);return}

  const sb=supabase.createClient('https://nfcysxqdwpdhrdpgxrlo.supabase.co','sb_publishable_nBRZvesX4tz7zUPq5QLYfQ__in76dF5');
  let recoveryReady=false;

  async function checkSession(){
    const {data:{session}}=await sb.auth.getSession();
    if(session){recoveryReady=true;return true}
    return false;
  }

  sb.auth.onAuthStateChange((event,session)=>{
    if(event==='PASSWORD_RECOVERY'||session)recoveryReady=true;
  });

  setTimeout(async()=>{
    if(!(await checkSession())){
      show('This reset link is invalid or has expired. Request a new password reset from Partner Sign In.');
      form.querySelectorAll('input,button').forEach(x=>x.disabled=true);
    }
  },700);

  form.addEventListener('submit',async e=>{
    e.preventDefault();msg.className='msg';
    const password=document.getElementById('newPassword').value;
    const confirm=document.getElementById('confirmPassword').value;
    if(password.length<8){show('Use at least 8 characters for the password.');return}
    if(password!==confirm){show('The passwords do not match.');return}
    if(!recoveryReady&&!(await checkSession())){show('This reset link is invalid or has expired. Request a new one.');return}
    btn.disabled=true;btn.textContent='Updating...';
    try{
      const {error}=await sb.auth.updateUser({password});if(error)throw error;
      show('Password updated. Returning you to Partner Sign In...','good');
      await sb.auth.signOut();
      setTimeout(()=>location.replace('/originator-login.html?mode=signin'),700);
    }catch(err){show(err?.message||'Could not update the password.');btn.disabled=false;btn.textContent='Update Password'}
  });
})();