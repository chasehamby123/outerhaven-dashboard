(function(){
  const ENDPOINT='https://xanyalooekgrywntxfxn.supabase.co/functions/v1/capital-request';
  const PUBLISHABLE='sb_publishable_gERy66FrPLr7BQdAxCjnDA_78EMAWR2';
  const $=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  const token=new URLSearchParams(location.search).get('t')||'';
  let request=null;

  async function call(action,extra={}){
    const res=await fetch(ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json','apikey':PUBLISHABLE},body:JSON.stringify({action,token,...extra})});
    let data={};try{data=await res.json()}catch(_){data={error:'Unexpected response'}}
    if(!res.ok){const err=new Error(data.error||'Could not process request');err.status=res.status;err.data=data;throw err}
    return data;
  }
  function showClosed(title,copy,error=false){$('requestBody').innerHTML=`<div class="status ${error?'error':''}"><strong>${esc(title)}</strong><p>${esc(copy)}</p></div>`}
  function formatExpiry(v){try{return new Date(v).toLocaleString(undefined,{month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'})}catch(_){return''}}
  async function load(){
    if(!token){showClosed('This request link is invalid.','Ask the sender for a new secure request link.',true);$('dealName').textContent='Secure request';return}
    try{
      request=await call('get');
      $('dealName').textContent=request.deal_name||'Private opportunity';
      $('requestBody').innerHTML=`<div class="ey">${esc(request.question_label||'Information requested')}</div><h1>${esc(request.question_label||'Information requested')}</h1><p class="prompt">${esc(request.prompt||'Please provide the requested information.')}</p><textarea id="answer" class="input" placeholder="Short factual answer"></textarea><div class="actions"><button id="submitAnswer" class="btn" type="button">Submit Answer</button><span class="help">Link expires ${esc(formatExpiry(request.expires_at))}</span></div>`;
      $('submitAnswer').onclick=submit;
    }catch(err){
      const st=err?.status;
      if(st===409){$('dealName').textContent=err?.data?.deal_name||'Private opportunity';showClosed('This request is already complete.','No further action is needed.');return}
      if(st===410){showClosed('This request has expired.','Ask the sender for a new secure request link.',true);return}
      showClosed('This request link is invalid.','Ask the sender for a new secure request link.',true);
    }
  }
  async function submit(){
    const answer=String($('answer')?.value||'').trim();if(!answer){$('answer')?.focus();return}
    const btn=$('submitAnswer');btn.disabled=true;btn.textContent='Submitting…';
    try{await call('respond',{answer});showClosed('Answer received.','The response has been added directly to the deal record. No further action is needed.');}
    catch(err){if(err?.status===409)showClosed('This request is already complete.','No further action is needed.');else if(err?.status===410)showClosed('This request has expired.','Ask the sender for a new secure request link.',true);else{btn.disabled=false;btn.textContent='Submit Answer';showClosed('Could not submit the answer.','Please retry or ask the sender for a new secure request link.',true)}}
  }
  load();
})();
