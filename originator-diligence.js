(function(){
  if(window.__outerhavenOriginatorDiligence)return;
  window.__outerhavenOriginatorDiligence=true;

  const QUESTIONS=[
    ['total_transaction_size','What is the total project or transaction size?','Enter the total project value, development cost, enterprise value, or transaction size.'],
    ['exact_capital_ask','What is the exact capital ask?','Enter the amount of capital currently being sought.'],
    ['capital_structure','Is the ask equity, debt, mezzanine financing, or a combination?','Describe the proposed capital structure.'],
    ['sources_and_uses','Can you provide a basic sources-and-uses breakdown?','A concise breakdown is sufficient.'],
    ['direct_management_connection','Are you directly connected with the management or sponsor team?','State Yes or No and briefly describe the relationship if helpful.'],
    ['exclusive_mandate','Is there a signed exclusive mandate directly with the sponsor or management?','State Yes or No. If yes, add any useful context.'],
    ['time_marketed','How long has the opportunity been marketed?','For example: not yet marketed, 3 weeks, 4 months.'],
    ['other_firms_count','How many other firms are currently representing or circulating it?','Give the number if known, or briefly explain.'],
    ['prior_investor_exposure','Which investors, banks, family offices, or institutions have already seen it?','List known prior exposure so Outerhaven can avoid duplicate outreach.'],
    ['existing_lead_or_commitment','Is there already a lead investor, term sheet, or committed capital?','Describe any lead, term sheet, soft circle, or committed capital.'],
    ['sponsor_track_record','What is the sponsor or management team’s relevant track record?','Summarize relevant completed projects, exits, operating history, or prior transactions.'],
    ['sponsor_capital_contribution','How much capital is the sponsor contributing?','Enter the sponsor equity/contribution amount or percentage if known.']
  ];

  const style=document.createElement('style');
  style.textContent=`
    .ddBack{position:fixed;inset:0;z-index:1800;background:rgba(17,19,24,.48);display:grid;place-items:center;padding:18px}.ddModal{width:min(920px,100%);max-height:92vh;overflow:auto;background:#f7f8fa;border-radius:17px;box-shadow:0 28px 90px rgba(0,0,0,.24)}.ddHead{position:sticky;top:0;z-index:2;background:#fff;border-bottom:1px solid #e4e7eb;padding:17px 19px;display:flex;justify-content:space-between;gap:16px;align-items:flex-start}.ddHead h2{font-size:18px;letter-spacing:-.025em;margin:4px 0}.ddHead p{font-size:9.5px;color:#747d88;line-height:1.55;margin:0;max-width:680px}.ddClose{border:0;background:#f1f3f5;border-radius:8px;width:30px;height:30px;font-size:18px;cursor:pointer}.ddBody{padding:15px 19px 19px}.ddProgress{display:flex;gap:7px;align-items:center;margin-bottom:12px}.ddStep{font-size:8px;font-weight:900;letter-spacing:.08em;color:#fff;background:#111318;border-radius:7px;padding:5px 7px}.ddDeal{font-size:9px;color:#727b86}.ddQuestions{display:grid;gap:9px}.ddQuestion{background:#fff;border:1px solid #e2e6ea;border-radius:12px;padding:11px}.ddQuestion.missing{border-color:#d88787;box-shadow:0 0 0 2px rgba(180,44,44,.05)}.ddQTop{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.ddQTop strong{font-size:10px;line-height:1.45}.ddSource{font-size:7.5px;font-weight:850;border:1px solid #dfe4e8;border-radius:6px;padding:3px 5px;color:#68717c;white-space:nowrap}.ddSource.document{color:#276b49;background:#f0f8f3;border-color:#cfe6d8}.ddSource.opportunity{color:#526987;background:#f3f6fa;border-color:#d8e1eb}.ddHint{font-size:8px;color:#858e99;line-height:1.45;margin:3px 0 7px}.ddQuestion textarea{width:100%;resize:vertical;min-height:58px;border:1px solid #d5dae0;border-radius:8px;padding:8px 9px;font:inherit;font-size:9.5px;line-height:1.45;box-sizing:border-box}.ddQuestion textarea:focus{outline:0;border-color:#9ca5af;box-shadow:0 0 0 3px rgba(17,24,39,.04)}.ddQuestion textarea:disabled{background:#f1f3f5;color:#8a929d}.ddNA{margin-top:6px;display:flex;align-items:center;gap:6px;font-size:8px;color:#727b86}.ddNA input{width:auto}.ddFoot{position:sticky;bottom:0;background:#fff;border-top:1px solid #e2e6ea;padding:12px 19px;display:flex;align-items:center;justify-content:space-between;gap:12px}.ddFootMsg{font-size:8.5px;color:#747d88}.ddFootMsg.error{color:#aa3434}.ddSubmit{border:1px solid #111318;background:#111318;color:#fff;border-radius:9px;padding:9px 13px;font-size:9px;font-weight:900;cursor:pointer}.ddSubmit:disabled{opacity:.55}.ddResume{margin-top:8px;border:1px solid #111318;background:#111318;color:#fff;border-radius:8px;padding:7px 9px;font-size:8px;font-weight:850;cursor:pointer}.ddActionRequired{display:inline-block;margin-top:7px;font-size:8px;font-weight:850;padding:5px 7px;border-radius:7px;background:#fff5e6;color:#8b5f11}.ddToast{position:fixed;right:20px;bottom:20px;z-index:1900;background:#111318;color:#fff;border-radius:10px;padding:10px 13px;font-size:9px;box-shadow:0 10px 35px rgba(0,0,0,.2)}
    @media(max-width:680px){.ddBack{padding:0}.ddModal{height:100vh;max-height:none;border-radius:0}.ddHead,.ddBody,.ddFoot{padding-left:13px;padding-right:13px}.ddQTop{display:block}.ddSource{display:inline-block;margin-top:5px}.ddFoot{align-items:flex-start;flex-direction:column}.ddSubmit{width:100%}}
  `;
  document.head.appendChild(style);

  const originalMetrics=typeof renderMetrics==='function'?renderMetrics:null;
  const originalRecent=typeof renderRecent==='function'?renderRecent:null;
  const originalSubmissions=typeof renderSubmissions==='function'?renderSubmissions:null;
  const parsedAmount=v=>typeof window.__outerhavenParseDealAmount==='function'?window.__outerhavenParseDealAmount(v):Number(String(v||'').replace(/[$,]/g,''))||0;

  function isDraft(s){return (s?.submission_state||'submitted')==='awaiting_diligence'}
  function submittedRows(){return submissions.filter(s=>!isDraft(s))}

  if(originalMetrics){
    renderMetrics=function(){
      const done=submittedRows(),drafts=submissions.filter(isDraft);
      const av=done.length?Math.round(done.reduce((a,s)=>a+Number(s.match_score||0),0)/done.length):0;
      const active=done.filter(s=>['Matching','Buyer Interest','Engagement Active'].includes(s.status)).length;
      const buyer=done.filter(s=>['Buyer Interest','Engagement Active'].includes(s.status)).length;
      const fourth=drafts.length?['Diligence Required',drafts.length,'Finish before submission']:['Buyer Interest',buyer,'Interest or engagement'];
      const rows=[['Submitted',done.length,'Completed opportunities'],['Average Match',av+'%','Across submitted deals'],['Active Matching',active,'Currently progressing'],fourth];
      $('metrics').innerHTML=rows.map(x=>`<article class="metric"><span>${x[0]}</span><strong>${x[1]}</strong><small>${x[2]}</small></article>`).join('');
    };
  }

  if(originalRecent){
    renderRecent=function(){
      const d=submissions.slice(0,4);
      $('recentSubmissions').innerHTML=d.length?d.map(s=>`<div class="recentItem"><div><strong>${esc(s.title)}</strong><span>${esc(money(s.capital_amount))} · ${esc(isDraft(s)?'Diligence Required':s.status)}</span></div><div class="miniScore">${Number(s.match_score||0)}%</div></div>`).join(''):'<div class="empty">No submissions yet. Submit your first opportunity to see it here.</div>';
    };
  }

  if(originalSubmissions){
    renderSubmissions=function(){
      $('submissionCards').innerHTML=submissions.length?submissions.map(s=>{
        const ds=documents.filter(d=>d.submission_id===s.id),draft=isDraft(s);
        return `<article class="submissionCard"><div><h3>${esc(s.title)}</h3><div class="submissionMeta">${esc(s.company_name||'Company not specified')} · ${esc(money(s.capital_amount))} · ${esc(s.sector||'Sector not specified')} · ${esc(s.geography||'Geography not specified')} · Started ${esc(date(s.created_at))}</div>${s.summary?`<div class="submissionSummary">${esc(s.summary)}</div>`:''}<div class="matchWhy">${esc(s.match_explanation||'Match analysis pending.')}</div><div class="docs">${ds.length?ds.map(d=>`<button type="button" class="docBtn" data-doc="${d.id}">${esc(d.file_name)}</button>`).join(''):'<span class="submissionMeta">No supporting documents attached.</span>'}</div>${draft?`<button type="button" class="ddResume" data-dd-resume="${s.id}">Complete Diligence</button>`:''}</div><div class="submissionRight"><div class="matchPct">${Number(s.match_score||0)}%</div><div class="matchLabel">Buyer Thesis Match</div>${draft?'<span class="ddActionRequired">Diligence Required</span>':`<span class="status ${slugStatus(s.status)}">${esc(s.status)}</span>`}</div></article>`;
      }).join(''):'<div class="empty">You have not submitted any opportunities yet.</div>';
      document.querySelectorAll('[data-doc]').forEach(b=>b.onclick=()=>openDocument(b.dataset.doc));
      document.querySelectorAll('[data-dd-resume]').forEach(b=>b.onclick=()=>openDiligence(b.dataset.ddResume));
    };
  }

  function install(){
    const form=$('submissionForm');if(!form||form.dataset.ddInstalled)return false;
    form.dataset.ddInstalled='1';
    form.addEventListener('submit',startStepOne,true);
    const head=form.querySelector('.panelHead h2'),copy=form.querySelector('.panelHead p'),btn=$('submitDeal');
    if(head)head.textContent='Step 1: Opportunity Details';
    if(copy)copy.textContent='Add the core opportunity details. Supporting materials and the opportunity summary are optional. You will complete a short diligence step before it is sent to Outerhaven.';
    if(btn)btn.textContent='Continue to Diligence';
    return true;
  }

  async function startStepOne(ev){
    ev.preventDefault();ev.stopImmediatePropagation();setMessage('');
    const btn=$('submitDeal');if(btn.disabled)return;
    const amount=parsedAmount($('dealAmount').value);
    const payload={originator_user_id:currentUser.id,title:$('dealTitle').value.trim(),company_name:$('dealCompany').value.trim()||null,transaction_type:$('dealType').value,capital_amount:amount||null,capital_amount_range:null,sector:$('dealSector').value.trim()||null,geography:$('dealGeography').value.trim()||null,summary:$('dealSummary').value.trim()||null};
    if(!payload.title||!payload.capital_amount||!payload.sector||!payload.geography||!payload.transaction_type){setMessage('Complete the project name, exact capital ask, sector, geography, and transaction type before continuing.','error');return}
    btn.disabled=true;btn.textContent='Preparing diligence...';
    try{
      const files=[...selectedFiles];
      const docAnswers=await extractFromFiles(files).catch(err=>{console.warn('diligence document extraction',err);return{}});
      const prefill=buildPrefill(payload,docAnswers);
      const {data:submission,error}=await sb.from('originator_submissions').insert({...payload,diligence_answers:prefill}).select('id').single();
      if(error)throw error;
      let uploaded=0,failed=[];
      for(const f of files){
        const path=`${currentUser.id}/${submission.id}/${crypto.randomUUID()}-${safeName(f.name)}`;
        const up=await sb.storage.from('originator-documents').upload(path,f,{upsert:false,contentType:f.type||undefined});
        if(up.error){failed.push(f.name);continue}
        const meta=await sb.from('originator_documents').insert({originator_user_id:currentUser.id,submission_id:submission.id,document_type:/one[-_ ]?pager|pitch|deck/i.test(f.name)?'one_pager':'supporting_material',file_name:f.name,storage_path:path,mime_type:f.type||null,file_size:f.size});
        if(meta.error){failed.push(f.name);await sb.storage.from('originator-documents').remove([path]);continue}
        uploaded++;
      }
      $('submissionForm').reset();selectedFiles=[];renderFileList();renderEstimate();
      await loadData();
      if(failed.length)setMessage(`${failed.length} document${failed.length===1?'':'s'} could not be attached. You can still finish diligence.`,'error');
      openDiligence(submission.id);
    }catch(err){setMessage(err?.message||'Could not start the submission.','error')}
    finally{btn.disabled=false;btn.textContent='Continue to Diligence'}
  }

  function answer(answer='',source='',notApplicable=false){return{answer:String(answer||'').trim(),source:source||'',not_applicable:!!notApplicable}}
  function buildPrefill(payload,docs){
    const a={};
    QUESTIONS.forEach(([key])=>a[key]=answer());
    const type=structureFromOpportunity(payload.transaction_type);
    if(type)a.capital_structure=answer(type,'opportunity');
    if(payload.capital_amount){
      if(/Acquisition|Sale/i.test(payload.transaction_type||''))a.total_transaction_size=answer(money(payload.capital_amount),'opportunity');
      else a.exact_capital_ask=answer(money(payload.capital_amount),'opportunity');
    }
    for(const [k,v] of Object.entries(docs||{}))if(v&&a[k]&&!a[k].answer)a[k]=answer(v,'document');
    return a;
  }
  function structureFromOpportunity(v){
    const t=String(v||'').toLowerCase();
    if(t.includes('equity'))return'Equity';if(t.includes('debt'))return'Debt';if(t.includes('structured'))return'Structured capital / mezzanine';if(t.includes('joint'))return'Joint venture';if(t.includes('strategic'))return'Strategic investment';if(t.includes('acquisition'))return'Acquisition / M&A';if(t.includes('sale'))return'Full or partial sale';return'';
  }

  function openDiligence(id){
    const s=submissions.find(x=>x.id===id);if(!s)return;
    document.querySelector('.ddBack')?.remove();
    const saved=s.diligence_answers&&typeof s.diligence_answers==='object'?s.diligence_answers:{};
    const back=document.createElement('div');back.className='ddBack';
    back.innerHTML=`<div class="ddModal"><div class="ddHead"><div><div class="eyebrow">ORIGINATOR DILIGENCE</div><h2>Complete the opportunity review</h2><p>We pre-filled anything we could identify from your opportunity details and any uploaded materials. Review those answers, complete what is still missing, or mark a question Not Applicable. The opportunity is sent to Outerhaven only after this step is complete.</p></div><button class="ddClose" type="button" aria-label="Close">×</button></div><div class="ddBody"><div class="ddProgress"><span class="ddStep">STEP 2 OF 2</span><span class="ddDeal">${esc(s.title)}</span></div><div class="ddQuestions">${QUESTIONS.map(([key,q,h])=>questionHtml(key,q,h,saved[key])).join('')}</div></div><div class="ddFoot"><div id="ddFootMsg" class="ddFootMsg">All 12 questions require an answer or Not Applicable.</div><button id="ddSubmit" class="ddSubmit" type="button">Submit Opportunity to Outerhaven</button></div></div>`;
    document.body.appendChild(back);
    back.querySelector('.ddClose').onclick=()=>back.remove();
    back.querySelectorAll('[data-dd-na]').forEach(c=>{c.onchange=()=>{const ta=back.querySelector(`[data-dd-answer="${CSS.escape(c.dataset.ddNa)}"]`);if(ta)ta.disabled=c.checked}});
    back.querySelectorAll('[data-dd-answer]').forEach(t=>{t.oninput=()=>t.closest('.ddQuestion')?.classList.remove('missing')});
    back.querySelector('#ddSubmit').onclick=()=>submitDiligence(id,back);
  }

  function questionHtml(key,q,h,v){
    const obj=v&&typeof v==='object'?v:{},value=String(obj.answer||''),na=!!obj.not_applicable,source=obj.source||'';
    const label=source==='document'?'From uploaded materials':source==='opportunity'?'From opportunity details':'';
    return `<section class="ddQuestion" data-dd-question="${key}"><div class="ddQTop"><strong>${esc(q)}</strong>${label?`<span class="ddSource ${esc(source)}">${esc(label)}</span>`:''}</div><div class="ddHint">${esc(h)}</div><textarea data-dd-answer="${key}" ${na?'disabled':''}>${esc(value)}</textarea><label class="ddNA"><input type="checkbox" data-dd-na="${key}" ${na?'checked':''}> Not applicable</label></section>`;
  }

  async function submitDiligence(id,back){
    const answers={},missing=[];
    for(const [key] of QUESTIONS){
      const ta=back.querySelector(`[data-dd-answer="${CSS.escape(key)}"]`),na=back.querySelector(`[data-dd-na="${CSS.escape(key)}"]`),section=back.querySelector(`[data-dd-question="${CSS.escape(key)}"]`);
      const text=(ta?.value||'').trim(),notApplicable=!!na?.checked;
      if(!text&&!notApplicable){missing.push(key);section?.classList.add('missing')}else section?.classList.remove('missing');
      const old=submissions.find(x=>x.id===id)?.diligence_answers?.[key]||{};
      answers[key]={answer:text,not_applicable:notApplicable,source:text===String(old.answer||'').trim()?(old.source||'originator'):'originator'};
    }
    const msg=back.querySelector('#ddFootMsg');
    if(missing.length){msg.textContent=`Complete or mark Not Applicable on the ${missing.length} highlighted question${missing.length===1?'':'s'}.`;msg.className='ddFootMsg error';back.querySelector('.missing')?.scrollIntoView({behavior:'smooth',block:'center'});return}
    const btn=back.querySelector('#ddSubmit');btn.disabled=true;btn.textContent='Submitting...';msg.textContent='Sending completed diligence to Outerhaven...';msg.className='ddFootMsg';
    try{
      const {data,error}=await sb.rpc('complete_originator_diligence',{input_submission_id:id,input_answers:answers});
      if(error)throw error;
      await loadData();back.remove();showSection('submissions');toast('Opportunity submitted to Outerhaven for review.');
    }catch(err){msg.textContent=err?.message||'Could not submit diligence.';msg.className='ddFootMsg error';btn.disabled=false;btn.textContent='Submit Opportunity to Outerhaven'}
  }

  function toast(text){const t=document.createElement('div');t.className='ddToast';t.textContent=text;document.body.appendChild(t);setTimeout(()=>t.remove(),4200)}

  async function extractFromFiles(files){
    let text='';
    for(const f of files){
      const ext=(f.name.split('.').pop()||'').toLowerCase();
      try{if(ext==='pdf')text+='\n'+await pdfText(f);else if(ext==='docx')text+='\n'+await docxText(f);else if(ext==='pptx')text+='\n'+await pptxText(f)}catch(err){console.warn('diligence parse',f.name,err)}
    }
    return extractAnswers(cleanText(text));
  }
  function loadScript(src,test){return new Promise((resolve,reject)=>{if(test())return resolve();const s=document.createElement('script');s.src=src;s.onload=resolve;s.onerror=()=>reject(new Error('Could not load document reader.'));document.head.appendChild(s)})}
  async function pdfText(file){
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',()=>!!window.pdfjsLib);window.pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    const pdf=await window.pdfjsLib.getDocument({data:await file.arrayBuffer()}).promise;let out='';for(let i=1;i<=Math.min(pdf.numPages,20);i++){const p=await pdf.getPage(i),c=await p.getTextContent();out+=c.items.map(x=>x.str).join(' ')+'\n'}return out;
  }
  async function docxText(file){await loadScript('https://cdn.jsdelivr.net/npm/mammoth@1.8.0/mammoth.browser.min.js',()=>!!window.mammoth);const r=await window.mammoth.extractRawText({arrayBuffer:await file.arrayBuffer()});return r.value||''}
  async function pptxText(file){await loadScript('https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js',()=>!!window.JSZip);const z=await window.JSZip.loadAsync(await file.arrayBuffer()),names=Object.keys(z.files).filter(n=>/^ppt\/slides\/slide\d+\.xml$/.test(n)).sort((a,b)=>Number(a.match(/\d+/)?.[0])-Number(b.match(/\d+/)?.[0]));let out='';for(const n of names.slice(0,30)){const xml=await z.file(n).async('text'),doc=new DOMParser().parseFromString(xml,'application/xml');out+=[...doc.getElementsByTagNameNS('*','t')].map(x=>x.textContent).join(' ')+'\n'}return out}
  function cleanText(t){return String(t||'').replace(/\u0000/g,' ').replace(/[ \t]+/g,' ').replace(/\n{3,}/g,'\n\n').trim()}
  function excerptSentence(text,re){const parts=text.split(/(?<=[.!?])\s+|\n+/).map(x=>x.trim()).filter(Boolean);const hit=parts.find(x=>re.test(x));return hit?hit.replace(/\s+/g,' ').slice(0,900):''}
  function section(text,re){const m=text.match(new RegExp('(?:'+re.source+')\\s*[:\\-]?\\s*([\\s\\S]{30,1000}?)(?=\\n\\s*[A-Z][A-Za-z &/]{3,45}(?:\\n|:)|$)','i'));return m?.[1]?.replace(/\s+/g,' ').trim().slice(0,900)||''}
  function amountNear(text,re){const moneyRe=/(?:US\$|USD\s*|\$)\s*([0-9]+(?:\.[0-9]+)?)\s*(billion|bn|b|million|mm|m)?/ig;let m;while((m=moneyRe.exec(text))){const around=text.slice(Math.max(0,m.index-110),Math.min(text.length,moneyRe.lastIndex+110));if(re.test(around)){const u=(m[2]||'').toLowerCase();return '$'+m[1]+(u==='billion'||u==='bn'||u==='b'?'B':u==='million'||u==='mm'||u==='m'?'M':'')}}return''}
  function extractAnswers(text){
    if(!text)return{};const out={};
    out.total_transaction_size=amountNear(text,/total project|project cost|development cost|transaction size|enterprise value|total capitalization/i);
    out.exact_capital_ask=amountNear(text,/capital ask|funding ask|raising|raise of|seeking|capital requirement|required capital|financing request/i);
    if(/mezzanine/i.test(text))out.capital_structure='Mezzanine financing'+(/equity/i.test(text)&&/debt/i.test(text)?' with equity and/or debt components':'');
    else if(/equity raise|growth equity|equity financing/i.test(text)&&/debt financing|senior debt|private credit/i.test(text))out.capital_structure='Combination of equity and debt';
    else if(/equity raise|growth equity|equity financing/i.test(text))out.capital_structure='Equity';
    else if(/debt financing|senior debt|private credit|credit facility/i.test(text))out.capital_structure='Debt';
    out.sources_and_uses=section(text,/sources\s*(?:&|and)\s*uses|use of funds|sources of funds/i);
    const direct=excerptSentence(text,/direct(?:ly)? connected.{0,50}(management|sponsor)|relationship with (the )?(management|sponsor)/i);if(direct)out.direct_management_connection=direct;
    const mandate=excerptSentence(text,/exclusive mandate|exclusively mandated|exclusive engagement/i);if(mandate)out.exclusive_mandate=mandate;
    const marketed=excerptSentence(text,/(marketed|in the market|launched).{0,80}\b\d+\s*(day|week|month|year)s?\b/i);if(marketed)out.time_marketed=marketed;
    const firms=excerptSentence(text,/\b\d+\s+(other\s+)?(firms|advisors|brokers|intermediaries).{0,80}(represent|circulat|market)/i);if(firms)out.other_firms_count=firms;
    const exposure=excerptSentence(text,/(investors?|banks?|family offices?|institutions?).{0,100}(already|previously).{0,80}(seen|reviewed|approached|contacted|circulated)|already (seen|reviewed|approached|contacted).{0,100}(investors?|banks?|family offices?|institutions?)/i);if(exposure)out.prior_investor_exposure=exposure;
    const lead=excerptSentence(text,/lead investor|term sheet|committed capital|capital committed|soft circled/i);if(lead)out.existing_lead_or_commitment=lead;
    out.sponsor_track_record=section(text,/sponsor track record|management track record|track record|selected projects|completed projects/i);
    out.sponsor_capital_contribution=amountNear(text,/sponsor equity|sponsor contribution|sponsor capital|developer equity|co-investment/i);
    Object.keys(out).forEach(k=>{if(!out[k])delete out[k]});return out;
  }

  if(!install()){const timer=setInterval(()=>{if(install())clearInterval(timer)},100);setTimeout(()=>clearInterval(timer),10000)}
})();