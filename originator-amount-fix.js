(function(){
  if(window.__outerhavenOriginatorAmountFix)return;
  window.__outerhavenOriginatorAmountFix=true;

  function loadScript(src,test){return new Promise((resolve,reject)=>{if(test())return resolve();const s=document.createElement('script');s.src=src;s.onload=resolve;s.onerror=()=>reject(new Error('Could not load document reader.'));document.head.appendChild(s)})}
  async function pdfText(file){
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',()=>!!window.pdfjsLib);
    window.pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    const pdf=await window.pdfjsLib.getDocument({data:await file.arrayBuffer()}).promise;
    let out='';for(let i=1;i<=Math.min(pdf.numPages,20);i++){const p=await pdf.getPage(i),c=await p.getTextContent();out+=c.items.map(x=>x.str).join(' ')+'\n'}return out;
  }
  async function docxText(file){
    await loadScript('https://cdn.jsdelivr.net/npm/mammoth@1.8.0/mammoth.browser.min.js',()=>!!window.mammoth);
    const r=await window.mammoth.extractRawText({arrayBuffer:await file.arrayBuffer()});return r.value||'';
  }
  async function pptxText(file){
    await loadScript('https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js',()=>!!window.JSZip);
    const z=await window.JSZip.loadAsync(await file.arrayBuffer());
    const names=Object.keys(z.files).filter(n=>/^ppt\/slides\/slide\d+\.xml$/.test(n)).sort((a,b)=>Number(a.match(/\d+/)?.[0])-Number(b.match(/\d+/)?.[0]));
    let out='';for(const n of names.slice(0,30)){const xml=await z.file(n).async('text'),doc=new DOMParser().parseFromString(xml,'application/xml');out+=[...doc.getElementsByTagNameNS('*','t')].map(x=>x.textContent).join(' ')+'\n'}return out;
  }
  async function textFrom(file){const ext=(file.name.split('.').pop()||'').toLowerCase();if(ext==='pdf')return pdfText(file);if(ext==='docx')return docxText(file);if(ext==='pptx')return pptxText(file);return''}

  function valueOf(raw,unit){let n=Number(raw);const u=String(unit||'').toLowerCase();if(['b','bn','billion'].includes(u))n*=1e9;else if(['m','mm','million'].includes(u))n*=1e6;return Number.isFinite(n)?n:0}
  function display(n){if(n>=1e9)return'$'+(n/1e9).toFixed(n%1e9?1:0)+'B';if(n>=1e6)return'$'+(n/1e6).toFixed(n%1e6?1:0)+'M';return'$'+n.toLocaleString()}
  function moneyPattern(){return '(?:US\\$|USD\\s*|\\$)\\s*([0-9]+(?:\\.[0-9]+)?)\\s*(billion|bn|b|million|mm|m)?'}
  function findCapitalAsk(text){
    const clean=String(text||'').replace(/[ \t]+/g,' ').replace(/\n+/g,' ');
    const money=moneyPattern();
    const before=[
      '(?:exact\\s+)?capital\\s+(?:ask|raise|requirement)',
      'funding\\s+(?:ask|requirement|request)',
      '(?:currently\\s+)?raising',
      '(?:looking|seeking)\\s+(?:to\\s+raise|capital|funding|financing|investment)?',
      'raise\\s+of',
      'financing\\s+(?:request|sought|required)',
      'investment\\s+sought',
      'amount\\s+(?:being\\s+)?raised'
    ];
    const candidates=[];
    for(let i=0;i<before.length;i++){
      const re=new RegExp(before[i]+'[^$0-9]{0,45}'+money,'ig');let m;
      while((m=re.exec(clean)))candidates.push({n:valueOf(m[1],m[2]),priority:100-i*3,index:m.index,context:m[0]});
    }
    const after=new RegExp(money+'[^a-z0-9]{0,18}(?:capital\\s+raise|funding\\s+(?:ask|requirement)|raise|being\\s+raised|financing\\s+sought|required\\s+capital)','ig');let a;
    while((a=after.exec(clean)))candidates.push({n:valueOf(a[1],a[2]),priority:88,index:a.index,context:a[0]});
    const explicit=new RegExp('(?:raise|raising|seeking|capital\\s+ask|funding\\s+ask)[^.!?]{0,80}'+money,'ig');let e;
    while((e=explicit.exec(clean)))candidates.push({n:valueOf(e[1],e[2]),priority:78,index:e.index,context:e[0]});
    const bad=/revenue|ebitda|sales|valuation|enterprise value|gross development value|gdv|project value|market size|aum|assets under management|total assets/i;
    for(const c of candidates){const around=clean.slice(Math.max(0,c.index-80),c.index+String(c.context).length+80);if(bad.test(around)&&!/raise|raising|seeking|capital ask|funding ask/i.test(c.context))c.priority-=50}
    const valid=candidates.filter(c=>c.n>0).sort((x,y)=>y.priority-x.priority||x.index-y.index);
    return valid[0]?.n||0;
  }

  function setStatus(text){const el=document.getElementById('odImportStatus');if(el){el.textContent=text;el.className='odImportStatus ok'}}
  async function correctAmount(file,wasBlank){
    const amount=document.getElementById('dealAmount');if(!amount||!file)return;
    try{
      const text=await textFrom(file);const ask=findCapitalAsk(text);
      if(amount.dataset.userEdited==='1')return;
      if(ask){amount.value=String(ask);amount.dispatchEvent(new Event('input',{bubbles:true}));setStatus(`${file.name} attached. Detected capital ask: ${display(ask)}. Review before continuing.`)}
      else if(wasBlank){amount.value='';amount.dispatchEvent(new Event('input',{bubbles:true}));setStatus(`${file.name} attached. We could not confidently identify the capital ask, so that field was left blank for you to confirm.`)}
    }catch(err){console.warn('capital ask correction',err)}
  }

  function updateAmountLabel(){
    const amount=document.getElementById('dealAmount'),type=document.getElementById('dealType');if(!amount||!type)return;
    const label=amount.closest('label');if(!label)return;
    const sale=/Acquisition|Full or Partial Sale/i.test(type.value||'');
    for(const node of label.childNodes){if(node.nodeType===Node.TEXT_NODE&&node.nodeValue.trim()){node.nodeValue=sale?'Transaction Value':'Exact Capital Ask';break}}
  }

  function install(){
    const input=document.getElementById('odImportInput'),box=document.getElementById('odImport'),amount=document.getElementById('dealAmount'),type=document.getElementById('dealType');
    if(!input||!box||!amount||!type)return false;
    amount.addEventListener('input',e=>{if(e.isTrusted)amount.dataset.userEdited='1'},true);
    input.addEventListener('change',()=>{const file=input.files?.[0],wasBlank=!String(amount.value||'').trim();amount.dataset.userEdited='';if(file)setTimeout(()=>correctAmount(file,wasBlank),0)},true);
    const oldDrop=box.ondrop;box.ondrop=ev=>{const file=[...(ev.dataTransfer?.files||[])][0],wasBlank=!String(amount.value||'').trim();amount.dataset.userEdited='';if(oldDrop)oldDrop.call(box,ev);if(file)setTimeout(()=>correctAmount(file,wasBlank),0)};
    type.addEventListener('change',updateAmountLabel);updateAmountLabel();
    return true;
  }
  if(!install()){const timer=setInterval(()=>{if(install())clearInterval(timer)},150);setTimeout(()=>clearInterval(timer),10000)}
})();