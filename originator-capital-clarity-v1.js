(function(){
  if(window.__outerhavenCapitalClarityV1)return;
  window.__outerhavenCapitalClarityV1=true;

  const CLEAR_LABEL='Sponsor Capital Invested / Committed';
  const CLEAR_HELP='How much capital has the sponsor already invested in this deal, and how much additional sponsor capital is firmly committed? Separate already funded from committed if known. Do not include capital being raised from outside investors.';
  const CLEAR_EXAMPLE='Example: $5M already invested; $10M additional sponsor capital committed.';

  function patch(){
    const root=document.getElementById('capitalSuiteV16Core');
    if(!root)return;

    root.querySelectorAll('.v16FactList span').forEach(el=>{
      if(el.textContent.trim()==='Sponsor Equity')el.textContent=CLEAR_LABEL;
    });

    const next=root.querySelector('.v16Next');
    if(!next)return;
    const heading=next.querySelector('h4');
    if(!heading||!['Sponsor Equity',CLEAR_LABEL].includes(heading.textContent.trim()))return;

    heading.textContent=CLEAR_LABEL;
    const body=next.querySelector('p');
    if(body)body.textContent=CLEAR_HELP;
    const input=next.querySelector('#v16NextFact');
    if(input)input.placeholder=CLEAR_EXAMPLE;

    const oldBtn=next.querySelector('[data-v16-request]');
    if(oldBtn){
      oldBtn.removeAttribute('data-v16-request');
      oldBtn.setAttribute('data-sponsor-capital-request','1');
      oldBtn.textContent='Copy Request';
    }
  }

  document.addEventListener('click',async e=>{
    const btn=e.target.closest('[data-sponsor-capital-request]');
    if(!btn)return;
    e.preventDefault();
    e.stopImmediatePropagation();
    const deal=document.getElementById('capitalDealSelect');
    const dealName=deal?.selectedOptions?.[0]?.textContent?.trim()||'this opportunity';
    const text=`Source Information Request\n\nFor ${dealName}, please provide the sponsor capital contribution:\n\n1. How much capital has the sponsor already invested in the deal?\n2. How much additional sponsor capital is firmly committed?\n3. If possible, separate amounts already funded from amounts committed but not yet funded.\n\nPlease do not include capital being raised from outside investors. A short factual answer is sufficient.`;
    try{
      await navigator.clipboard.writeText(text);
      btn.textContent='Request Copied';
      setTimeout(()=>btn.textContent='Copy Request',1200);
    }catch(_){
      alert(text);
    }
  },true);

  [0,300,900,1800].forEach(ms=>setTimeout(patch,ms));
  document.addEventListener('click',()=>setTimeout(patch,180),true);
  document.addEventListener('change',()=>setTimeout(patch,250),true);
  setInterval(patch,1200);
})();