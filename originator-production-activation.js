(function(){
  let attempts=0;
  async function activate(){
    attempts++;
    try{
      if(typeof currentUser!=='undefined'&&currentUser&&typeof loadData==='function'){
        const sign=document.getElementById('signOut');
        if(sign)sign.onclick=async()=>{await sb.auth.signOut();location.replace('/originator-login.html?mode=signin')};
        await loadData(true);
        return;
      }
    }catch(err){console.error('partner hardening activation',err)}
    if(attempts<50)setTimeout(activate,100);
  }
  activate();
})();