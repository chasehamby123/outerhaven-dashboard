(function(){
  if(window.__outerhavenProspBackfillUI)return;
  window.__outerhavenProspBackfillUI=true;

  const style=document.createElement('style');
  style.textContent=`
    .prospBackfillBox{background:#fff;border:1px solid #e4e7eb;border-radius:14px;padding:16px;margin-bottom:16px}
    .prospBackfillHead{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;flex-wrap:wrap}
    .prospBackfillTitle{font-size:13px;font-weight:850}
    .prospBackfillCopy{font-size:10px;color:#747c89;line-height:1.5;margin-top:4px;max-width:620px}
    .prospBackfillForm{display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap;margin-top:12px}
    .prospBackfillField{min-width:280px;flex:1;max-width:520px;font-size:10px;font-weight:750;color:#697180}
    .prospBackfillField input{margin-top:5px}
    .prospBackfillBtn{border:1px solid #111827;background:#111827;color:#fff;border-radius:9px;padding:10px 13px;font-size:10px;font-weight:850;white-space:nowrap}
    .prospBackfillBtn:disabled{opacity:.55;cursor:wait}
    .prospBackfillResult{font-size:10px;line-height:1.55;color:#596170;margin-top:10px;padding:10px 11px;background:#f7f8fa;border:1px solid #eceef1;border-radius:9px;display:none;white-space:pre-wrap;word-break:break-word}
    .prospBackfillResult.show{display:block}
    .prospBackfillResult.error{background:#fff1f1;border-color:#efc3c3;color:#a32121}
  `;
  document.head.appendChild(style);

  function inject(){
    const view=document.getElementById('leadreviewView');
    if(!view||view.querySelector('[data-prosp-backfill-box]'))return;
    const box=document.createElement('div');
    box.className='prospBackfillBox';
    box.dataset.prospBackfillBox='';
    box.innerHTML=`
      <div class="prospBackfillHead"><div><div class="prospBackfillTitle">Backfill Existing Prosp Replies</div><div class="prospBackfillCopy">Pull historical campaign leads and LinkedIn conversations from Prosp, then send existing replies through the same OuterHaven qualification layer. The API key is used for this request only and is not saved in the dashboard.</div></div></div>
      <div class="prospBackfillForm">
        <label class="prospBackfillField">Prosp API Key<input id="prospBackfillKey" type="password" autocomplete="off" placeholder="Paste Prosp API key"></label>
        <button id="prospBackfillRun" class="prospBackfillBtn" type="button">Backfill Existing Replies</button>
      </div>
      <div id="prospBackfillResult" class="prospBackfillResult"></div>`;
    const metrics=view.querySelector('.leadReviewMetrics');
    if(metrics)metrics.insertAdjacentElement('afterend',box);else view.prepend(box);
    box.querySelector('#prospBackfillRun').onclick=run;
  }

  function errorDetail(data){
    const bits=[];
    if(data?.error)bits.push(data.error);
    if(data?.prosp_status)bits.push(`Prosp status ${data.prosp_status}`);
    const d=data?.prosp_details;
    if(d){
      if(typeof d==='string')bits.push(d);
      else if(d.message)bits.push(d.message);
      else if(d.error)bits.push(typeof d.error==='string'?d.error:JSON.stringify(d.error));
      else bits.push(JSON.stringify(d));
    }
    return bits.join(' · ')||'Backfill failed';
  }

  async function run(){
    const key=document.getElementById('prospBackfillKey')?.value?.trim();
    const btn=document.getElementById('prospBackfillRun');
    const out=document.getElementById('prospBackfillResult');
    if(!key){alert('Paste your Prosp API key first.');return}
    btn.disabled=true;btn.textContent='Scanning Prosp...';
    out.className='prospBackfillResult show';
    out.textContent='Scanning campaigns, leads and historical LinkedIn conversations. This can take a little while.';
    try{
      const {data,error}=await sb.functions.invoke('prosp-backfill-browser',{body:{api_key:key}});
      document.getElementById('prospBackfillKey').value='';
      if(error)throw error;
      if(!data?.ok){out.className='prospBackfillResult show error';out.textContent=errorDetail(data);return}
      const parts=[
        `${data.campaigns_scanned||0} campaigns scanned`,
        `${data.leads_seen||0} leads checked`,
        `${data.imported||0} historical replies imported`,
        `${data.qualified||0} qualified`,
        `${data.needs_review||0} need review`,
        `${data.rejected||0} rejected`
      ];
      out.className='prospBackfillResult show';
      out.textContent=parts.join(' · ')+(data.hit_scan_limit?' · Scan limit reached. Run it again to continue with remaining leads.':'');
      setTimeout(()=>document.querySelector('.navBtn[data-view="leadreview"]')?.click(),700);
    }catch(e){
      out.className='prospBackfillResult show error';
      out.textContent=e?.message||'Backfill failed. Check the API key and try again.';
    }finally{btn.disabled=false;btn.textContent='Backfill Existing Replies'}
  }

  const observer=new MutationObserver(()=>inject());
  function install(){observer.observe(document.body,{childList:true,subtree:true});inject()}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
