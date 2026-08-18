(function(){
  if(window.__outerhavenOriginatorReviewDiligence)return;
  window.__outerhavenOriginatorReviewDiligence=true;
  if(window.__outerhavenDashboardRole!=='admin')return;

  const QUESTIONS=[
    ['total_transaction_size','Total project / transaction size'],
    ['exact_capital_ask','Exact capital ask'],
    ['capital_structure','Capital structure'],
    ['sources_and_uses','Sources and uses'],
    ['direct_management_connection','Direct management / sponsor connection'],
    ['exclusive_mandate','Signed exclusive mandate'],
    ['time_marketed','Time marketed'],
    ['other_firms_count','Other firms representing / circulating'],
    ['prior_investor_exposure','Prior investor / bank / institution exposure'],
    ['existing_lead_or_commitment','Lead investor / term sheet / committed capital'],
    ['sponsor_track_record','Sponsor / management track record'],
    ['sponsor_capital_contribution','Sponsor capital contribution']
  ];
  let rows=[];
  const esc=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');

  const style=document.createElement('style');
  style.textContent=`.ordGrid{display:grid;gap:8px;margin-top:12px}.ordRow{border:1px solid #e5e8ec;border-radius:9px;padding:9px}.ordRow strong{display:block;font-size:8.5px;margin-bottom:4px}.ordRow p{font-size:9px;line-height:1.5;color:#58616c;margin:0;white-space:pre-wrap}.ordSource{display:inline-block;margin-top:5px;font-size:7px;color:#7c8590;background:#f2f4f6;border-radius:5px;padding:3px 5px}.ordNA{color:#8b5f11!important}.ordComplete{font-size:8px;color:#707984;margin-top:6px}`;
  document.head.appendChild(style);

  async function load(){
    const {data,error}=await sb.from('originator_submissions').select('id,title,diligence_answers,diligence_completed_at,submission_state').eq('submission_state','submitted');
    if(error){console.error('diligence admin',error);return}
    rows=data||[];decorate();
  }

  function decorate(){
    document.querySelectorAll('#orQueue .orCard').forEach(card=>{
      if(card.querySelector('[data-or-diligence]'))return;
      const keyed=card.querySelector('[data-id]');if(!keyed)return;
      const id=keyed.dataset.id;if(!rows.some(x=>x.id===id))return;
      const actions=card.querySelector('.orActions');if(!actions)return;
      const btn=document.createElement('button');btn.type='button';btn.dataset.orDiligence=id;btn.textContent='View Diligence';
      btn.onclick=()=>open(id);actions.insertBefore(btn,actions.firstChild);
    });
  }

  function open(id){
    const row=rows.find(x=>x.id===id);if(!row)return;
    document.querySelector('.ordBack')?.remove();
    const a=row.diligence_answers||{};
    const back=document.createElement('div');back.className='orModalBack ordBack';
    back.innerHTML=`<div class="orModal" style="width:min(720px,100%);max-height:88vh;overflow:auto"><div class="orModalHead"><div><div class="oaEyebrow">COMPLETED ORIGINATOR DILIGENCE</div><h3>${esc(row.title||'Opportunity')}</h3><div class="ordComplete">Completed ${row.diligence_completed_at?new Date(row.diligence_completed_at).toLocaleString():'—'}</div></div><button type="button" aria-label="Close">×</button></div><div class="ordGrid">${QUESTIONS.map(([key,label])=>answerHtml(label,a[key])).join('')}</div></div>`;
    document.body.appendChild(back);
    back.onclick=ev=>{if(ev.target===back||ev.target.closest('.orModalHead button'))back.remove()};
  }

  function answerHtml(label,obj){
    obj=obj&&typeof obj==='object'?obj:{};
    const na=!!obj.not_applicable,text=na?'Not applicable':String(obj.answer||'No answer recorded');
    const source=obj.source==='document'?'Pulled from uploaded materials':obj.source==='opportunity'?'Pulled from opportunity details':obj.source?'Answered by originator':'';
    return `<section class="ordRow"><strong>${esc(label)}</strong><p class="${na?'ordNA':''}">${esc(text)}</p>${source?`<span class="ordSource">${esc(source)}</span>`:''}</section>`;
  }

  load();
  setInterval(decorate,1000);
  setInterval(load,60000);
})();