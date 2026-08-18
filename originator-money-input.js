(function(){
  if(window.__outerhavenOriginatorMoneyInput)return;
  window.__outerhavenOriginatorMoneyInput=true;

  function parseAmount(value){
    if(typeof value==='number')return Number.isFinite(value)?value:0;
    const raw=String(value||'').trim().toLowerCase().replace(/[$,\s]/g,'');
    if(!raw)return 0;
    const m=raw.match(/^([0-9]+(?:\.[0-9]+)?)(k|m|mm|b|bn|thousand|million|billion)?$/i);
    if(!m)return 0;
    let n=Number(m[1]);
    const unit=(m[2]||'').toLowerCase();
    if(['k','thousand'].includes(unit))n*=1e3;
    else if(['m','mm','million'].includes(unit))n*=1e6;
    else if(['b','bn','billion'].includes(unit))n*=1e9;
    return Number.isFinite(n)?n:0;
  }

  function compact(value){
    const n=Number(value||0);if(!n)return'';
    const clean=x=>String(Math.round(x*100)/100).replace(/\.0+$/,'').replace(/(\.\d*[1-9])0+$/,'$1');
    if(Math.abs(n)>=1e9)return clean(n/1e9)+'B';
    if(Math.abs(n)>=1e6)return clean(n/1e6)+'M';
    if(Math.abs(n)>=1e3)return clean(n/1e3)+'K';
    return String(n);
  }

  window.__outerhavenParseDealAmount=parseAmount;
  window.__outerhavenCompactDealAmount=compact;

  function install(){
    const amount=document.getElementById('dealAmount');
    const form=document.getElementById('submissionForm');
    if(!amount||!form)return false;

    amount.type='text';
    amount.inputMode='decimal';
    amount.placeholder='30M';
    amount.autocomplete='off';
    amount.title='Examples: 30M, 75M, 1.2B, or 30000000';

    amount.addEventListener('blur',()=>{
      const parsed=parseAmount(amount.value);
      if(parsed)amount.value=compact(parsed);
    });

    form.addEventListener('submit',()=>{
      const parsed=parseAmount(amount.value);
      if(!parsed)return;
      const shown=compact(parsed);
      amount.value=String(parsed);
      setTimeout(()=>{
        if(amount.value===String(parsed))amount.value=shown;
      },0);
    },true);
    return true;
  }

  if(!install()){
    const timer=setInterval(()=>{if(install())clearInterval(timer)},100);
    setTimeout(()=>clearInterval(timer),10000);
  }
})();