(function(){
  if(window.__outerhavenOriginatorTestAdmin)return;
  window.__outerhavenOriginatorTestAdmin=true;
  if(window.__outerhavenDashboardRole!=='admin')return;

  function install(){
    if(document.getElementById('oaTestLoginPanel'))return true;
    const approve=document.getElementById('oaApprovePanel');
    if(!approve)return false;
    const panel=document.createElement('section');
    panel.id='oaTestLoginPanel';
    panel.className='oaPanel';
    panel.innerHTML=`<div class="oaPanelHead"><div><div class="oaEyebrow">TEST ACCESS</div><h2>Test Originator Login</h2><p>Create or reset the confirmed test account without needing a real email inbox.</p></div></div><form id="oaTestLoginForm" class="oaForm"><div style="font-size:9px;color:#69717d">Email: <strong>originator-test@chproduction.org</strong></div><label>Test Password<input id="oaTestPassword" type="password" minlength="10" required placeholder="At least 10 characters"></label><button class="primary" type="submit">Create / Reset Test Login</button><div id="oaTestLoginMsg" class="oaFormMsg"></div></form><div style="margin-top:8px"><button id="oaOpenTestLogin" class="ghost" type="button">Open Partner Login</button></div>`;
    approve.insertAdjacentElement('afterend',panel);
    document.getElementById('oaOpenTestLogin').onclick=()=>window.open('/originator-login.html','_blank','noopener');
    document.getElementById('oaTestLoginForm').onsubmit=resetTest;
    return true;
  }

  async function resetTest(e){
    e.preventDefault();
    const password=document.getElementById('oaTestPassword').value;
    const msg=document.getElementById('oaTestLoginMsg');
    const btn=e.submitter;
    if(password.length<10){msg.textContent='Use at least 10 characters.';msg.className='oaFormMsg error';return}
    btn.disabled=true;btn.textContent='Creating...';msg.textContent='';
    try{
      const {data,error}=await sb.functions.invoke('admin-reset-originator-test',{body:{password}});
      if(error)throw error;
      if(data?.error)throw new Error(data.error);
      msg.textContent='Test login is ready. Use the Sign In tab with originator-test@chproduction.org and this password.';
      msg.className='oaFormMsg ok';
    }catch(err){
      msg.textContent=err?.message||String(err);msg.className='oaFormMsg error';
    }finally{btn.disabled=false;btn.textContent='Create / Reset Test Login'}
  }

  if(!install()){
    const timer=setInterval(()=>{if(install())clearInterval(timer)},250);
    setTimeout(()=>clearInterval(timer),10000);
  }
})();