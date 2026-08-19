(function(){
  if(window.__outerhavenOriginatorAmountFix)return;
  window.__outerhavenOriginatorAmountFix=true;

  let activeFile=null;
  let activeToken=0;
  let strictAsk=null;
  let strictReady=false;
  let userEdited=false;
  let correcting=false;

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

  function valueOf(raw,unit,currency){
    let n=Number(raw),u=String(unit||'').toLowerCase();
    if(['b','bn','billion'].includes(u))n*=1e9;
    else if(['m','mm','million'].includes(u))n*=1e6;
    else if(!currency&&n<1000000)return 0;
    return Number.isFinite(n)?n:0;
  }
  function display(n){if(n>=1e9)return'$'+(n/1e9).toFixed(n%1e9?1:0)+'B';if(n>=1e6)return'$'+(n/1e6).toFixed(n%1e6?1:0)+'M';return'$'+n.toLocaleString()}

  function findCapitalAsk(text){
    const clean=String(text||'').replace(/[ \t]+/g,' ').replace(/\n+/g,' ').trim();
    if(!clean)return 0;
    const amountRe=/(US\$|USD\s*|\$)?\s*([0-9]+(?:\.[0-9]+)?)\s*(billion|bn|b|million|mm|m)?/ig;
    const candidates=[];
    let m;
    while((m=amountRe.exec(clean))){
      const currency=(m[1]||'').trim(),unit=(m[3]||'').toLowerCase();
      if(!currency&&!unit)continue;
      const n=valueOf(m[2],unit,currency);if(!n)continue;
      const left=clean.slice(Math.max(0,m.index-150),m.index).trimEnd();
      const right=clean.slice(amountRe.lastIndex,Math.min(clean.length,amountRe.lastIndex+90)).trimStart();
      const around=clean.slice(Math.max(0,m.index-95),Math.min(clean.length,amountRe.lastIndex+95));
      let score=0;

      if(/(?:exact\s+)?capital\s+(?:ask|raise|requirement|required|needed|sought)(?:\s+(?:is|of))?\s*[:\-–—]?\s*$/i.test(left))score=125;
      else if(/funding\s+(?:ask|raise|requirement|required|needed|request)(?:\s+(?:is|of))?\s*[:\-–—]?\s*$/i.test(left))score=122;
      else if(/(?:currently\s+)?raising(?:\s+(?:capital|funding|financing))?(?:\s+(?:of|approximately|about|up to))?\s*[:\-–—]?\s*$/i.test(left))score=120;
      else if(/(?:looking|seeking)(?:\s+to\s+raise|\s+for)?(?:\s+(?:capital|funding|financing|investment))?(?:\s+(?:of|approximately|about|up to))?\s*[:\-–—]?\s*$/i.test(left))score=118;
      else if(/raise\s+of\s*[:\-–—]?\s*$/i.test(left))score=116;
      else if(/amount\s+(?:being\s+)?raised(?:\s+is)?\s*[:\-–—]?\s*$/i.test(left))score=114;
      else if(/financing\s+(?:request|sought|required|needed)(?:\s+is)?\s*[:\-–—]?\s*$/i.test(left))score=112;
      else if(/investment\s+sought(?:\s+is)?\s*[:\-–—]?\s*$/i.test(left))score=110;

      if(score===0&&/^(?:capital\s+raise|funding\s+(?:ask|requirement)|raise|being\s+raised|financing\s+sought|required\s+capital)\b/i.test(right))score=108;
      if(score===0&&/(?:raise|raising|capital ask|funding ask|funding requirement|capital requirement|seeking capital|seeking funding|amount sought)/i.test(around))score=72;
      if(/\b(?:revenue|ebitda|sales|valuation|enterprise value|gross development value|gdv|project value|project cost|market size|aum|assets under management|total assets)\b/i.test(around)&&score<108)score-=60;
      if(score>=100)candidates.push({n,score,index:m.index});
    }
    candidates.sort((a,b)=>b.score-a.score||a.index-b.index);
    return candidates[0]?.n||0;
  }

  function setStatus(text,type='ok'){
    const el=document.getElementById('odImportStatus');if(!el)return;
    el.textContent=text;el.className='odImportStatus '+type;
  }

  function applyStrictResult(){
    const amount=document.getElementById('dealAmount');
    if(!amount||!activeFile||!strictReady||userEdited||correcting)return;
    correcting=true;
    amount.value=strictAsk?String(strictAsk):'';
    amount.dispatchEvent(new Event('input',{bubbles:true}));
    correcting=false;
    if(strictAsk)setStatus(`${activeFile.name} attached. Detected exact capital ask: ${display(strictAsk)}. Review before continuing.`,'ok');
    else setStatus(`${activeFile.name} attached. We could not confidently identify an exact capital ask, so that field was left blank for confirmation.`,'err');
  }

  async function beginStrictParse(file){
    if(!file)return;
    const token=++activeToken;
    activeFile=file;strictAsk=null;strictReady=false;userEdited=false;
    const amount=document.getElementById('dealAmount');if(amount){amount.value='';amount.dispatchEvent(new Event('input',{bubbles:true}))}
    try{
      const text=await textFrom(file);
      if(token!==activeToken)return;
      strictAsk=findCapitalAsk(text);strictReady=true;applyStrictResult();
    }catch(err){
      console.warn('capital ask strict parse',err);
      if(token!==activeToken)return;
      strictAsk=0;strictReady=true;applyStrictResult();
    }
  }

  function updateAmountLabel(){
    const amount=document.getElementById('dealAmount'),type=document.getElementById('dealType');if(!amount||!type)return;
    const label=amount.closest('label');if(!label)return;
    const sale=/Acquisition|Full or Partial Sale/i.test(type.value||'');
    for(const node of label.childNodes){if(node.nodeType===Node.TEXT_NODE&&node.nodeValue.trim()){node.nodeValue=sale?'Transaction Value':'Exact Capital Ask';break}}
  }

  function install(){
    const input=document.getElementById('odImportInput'),box=document.getElementById('odImport'),amount=document.getElementById('dealAmount'),type=document.getElementById('dealType'),status=document.getElementById('odImportStatus');
    if(!input||!box||!amount||!type||!status)return false;

    input.addEventListener('change',()=>{const file=input.files?.[0];if(file)beginStrictParse(file)},true);
    const oldDrop=box.ondrop;
    box.ondrop=ev=>{const file=[...(ev.dataTransfer?.files||[])][0];if(file)beginStrictParse(file);if(oldDrop)oldDrop.call(box,ev)};

    amount.addEventListener('input',e=>{
      if(correcting)return;
      if(e.isTrusted){userEdited=true;return}
      if(activeFile&&strictReady)queueMicrotask(applyStrictResult);
    },true);

    const observer=new MutationObserver(()=>{
      const text=status.textContent||'';
      if(activeFile&&strictReady&&!userEdited&&!/Detected exact capital ask|could not confidently identify an exact capital ask/i.test(text))setTimeout(applyStrictResult,0);
    });
    observer.observe(status,{childList:true,subtree:true,characterData:true});

    type.addEventListener('change',updateAmountLabel);updateAmountLabel();
    return true;
  }
  if(!install()){const timer=setInterval(()=>{if(install())clearInterval(timer)},150);setTimeout(()=>clearInterval(timer),10000)}
})();