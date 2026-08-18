(function(){
  const SUPABASE_URL='https://nfcysxqdwpdhrdpgxrlo.supabase.co';
  const SUPABASE_KEY='sb_publishable_nBRZvesX4tz7zUPq5QLYfQ__in76dF5';
  const client=window.supabase?.createClient(SUPABASE_URL,SUPABASE_KEY);
  const $=id=>document.getElementById(id);

  function parseMoney(value){
    const raw=String(value||'').trim().toLowerCase().replace(/[$,\s]/g,'');
    if(!raw)return null;
    const m=raw.match(/^([0-9]+(?:\.[0-9]+)?)(k|m|mm|b|bn|thousand|million|billion)?$/i);
    if(!m)return null;
    let n=Number(m[1]);const u=(m[2]||'').toLowerCase();
    if(['k','thousand'].includes(u))n*=1e3;else if(['m','mm','million'].includes(u))n*=1e6;else if(['b','bn','billion'].includes(u))n*=1e9;
    return Number.isFinite(n)?n:null;
  }
  function compactMoney(n){
    n=Number(n||0);if(!n)return'';const clean=x=>String(Math.round(x*100)/100).replace(/\.0+$/,'').replace(/(\.\d*[1-9])0+$/,'$1');
    if(n>=1e9)return clean(n/1e9)+'B';if(n>=1e6)return clean(n/1e6)+'M';if(n>=1e3)return clean(n/1e3)+'K';return String(n);
  }
  function setStatus(form,text,type=''){
    const el=form.querySelector('.formStatus');if(!el)return;el.textContent=text||'';el.className='formStatus '+type;
  }
  function values(form){return Object.fromEntries(new FormData(form).entries())}
  function checked(form,name){return [...form.querySelectorAll(`input[name="${name}"]:checked`)].map(x=>x.value)}
  function normalText(v,max=1200){const s=String(v||'').trim();return s?s.slice(0,max):null}

  async function submitOpportunity(form){
    const v=values(form),size=parseMoney(v.opportunity_size);
    if(!size){setStatus(form,'Enter a valid transaction size such as 30M or 125M.','bad');return}
    const payload={
      inquiry_type:'opportunity',name:normalText(v.name,120),email:normalText(v.email,254),company:normalText(v.company,160),phone:normalText(v.phone,60),linkedin_url:normalText(v.linkedin_url,500),
      opportunity_name:normalText(v.opportunity_name,220),opportunity_size:size,sector:normalText(v.sector,160),geography:normalText(v.geography,160),transaction_type:normalText(v.transaction_type,120),message:normalText(v.message,4000),status:'new',source:'website'
    };
    return insertInquiry(form,payload);
  }
  async function submitCapital(form){
    const v=values(form),min=parseMoney(v.mandate_min),max=parseMoney(v.mandate_max);
    if(v.mandate_min&&!min){setStatus(form,'Enter a valid minimum check size such as 20M.','bad');return}
    if(v.mandate_max&&!max){setStatus(form,'Enter a valid maximum check size such as 150M.','bad');return}
    if(min&&max&&min>max){setStatus(form,'Maximum check size must be greater than the minimum.','bad');return}
    const payload={
      inquiry_type:'capital_partner',name:normalText(v.name,120),email:normalText(v.email,254),company:normalText(v.company,160),phone:normalText(v.phone,60),linkedin_url:normalText(v.linkedin_url,500),
      mandate_min:min,mandate_max:max,sector:normalText(v.sector,300),geography:normalText(v.geography,300),structures:checked(form,'structures'),message:normalText(v.message,4000),status:'new',source:'website'
    };
    return insertInquiry(form,payload);
  }
  async function insertInquiry(form,payload){
    if(form.querySelector('[name="website"]')?.value){form.reset();setStatus(form,'Thank you. Your submission has been received.','good');return}
    if(!client){setStatus(form,'Submission service is unavailable. Please try again shortly.','bad');return}
    const btn=form.querySelector('button[type="submit"]'),original=btn?.textContent;
    if(btn){btn.disabled=true;btn.textContent='Submitting...'}setStatus(form,'Sending to Outerhaven...');
    try{
      const {error}=await client.from('website_inquiries').insert(payload);
      if(error)throw error;
      form.reset();setStatus(form,'Received. Outerhaven will review this and follow up if there is a fit.','good');
    }catch(err){console.error('website inquiry',err);setStatus(form,'We could not send this submission. Please try again.','bad')}
    finally{if(btn){btn.disabled=false;btn.textContent=original}}
  }

  function setIntake(type){
    document.querySelectorAll('.intakeTab').forEach(b=>b.classList.toggle('active',b.dataset.intake===type));
    document.querySelectorAll('.intakeForm').forEach(f=>f.classList.toggle('active',f.dataset.intakeForm===type));
  }

  document.querySelectorAll('.intakeTab').forEach(b=>b.addEventListener('click',()=>setIntake(b.dataset.intake)));
  document.querySelectorAll('[data-open-intake]').forEach(a=>a.addEventListener('click',()=>setIntake(a.dataset.openIntake)));
  $('opportunityForm')?.addEventListener('submit',e=>{e.preventDefault();submitOpportunity(e.currentTarget)});
  $('capitalForm')?.addEventListener('submit',e=>{e.preventDefault();submitCapital(e.currentTarget)});
  document.querySelectorAll('[data-money]').forEach(input=>input.addEventListener('blur',()=>{const n=parseMoney(input.value);if(n)input.value=compactMoney(n)}));

  $('mobileMenuBtn')?.addEventListener('click',()=>document.querySelector('.siteNav')?.classList.toggle('mobileOpen'));
  document.querySelectorAll('.siteNavLinks a').forEach(a=>a.addEventListener('click',()=>document.querySelector('.siteNav')?.classList.remove('mobileOpen')));

  const observer=new IntersectionObserver(entries=>entries.forEach(x=>{if(x.isIntersecting)x.target.classList.add('visible')}),{threshold:.12});
  document.querySelectorAll('.fadeUp').forEach(el=>observer.observe(el));
})();
