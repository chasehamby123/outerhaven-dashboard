(function(){
  if(window.__outerhavenDocumentAutofill)return;
  window.__outerhavenDocumentAutofill=true;

  const style=document.createElement('style');
  style.textContent=`
    .odImport{border:1px solid #dfe4e9;background:#f8fafb;border-radius:13px;padding:13px;margin:0 0 15px}.odImportTop{display:flex;justify-content:space-between;gap:14px;align-items:center}.odImportCopy strong{display:block;font-size:11px}.odImportCopy span{display:block;font-size:8.5px;color:#7b8490;margin-top:4px;line-height:1.45}.odImportBtn{border:1px solid #111318;background:#111318;color:#fff;border-radius:8px;padding:8px 10px;font-size:8.5px;font-weight:850;cursor:pointer;white-space:nowrap}.odImportStatus{font-size:8.5px;color:#69727d;margin-top:8px;min-height:12px}.odImportStatus.ok{color:#247248}.odImportStatus.err{color:#aa3434}.odImportStatus.work{color:#8a6417}.odImportHint{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}.odChip{font-size:7.5px;background:#fff;border:1px solid #e1e5e9;border-radius:6px;padding:4px 6px;color:#6f7883}@media(max-width:650px){.odImportTop{align-items:flex-start;flex-direction:column}.odImportBtn{width:100%}}
  `;
  document.head.appendChild(style);

  function install(){
    const form=document.getElementById('submissionForm');
    const grid=form?.querySelector('.formGrid');
    if(!form||!grid||document.getElementById('odImport'))return !!grid;
    const box=document.createElement('div');
    box.id='odImport';box.className='odImport';
    box.innerHTML=`<div class="odImportTop"><div class="odImportCopy"><div class="eyebrow">FAST START</div><strong>Import One-Pager / Pitch Deck</strong><span>Upload the primary deal document first. We will read the text in your browser and pre-fill the opportunity fields for you to review.</span></div><button id="odImportBtn" type="button" class="odImportBtn">Import & Auto-Fill</button></div><input id="odImportInput" type="file" accept=".pdf,.docx,.pptx" hidden><div class="odImportHint"><span class="odChip">PDF</span><span class="odChip">DOCX</span><span class="odChip">PPTX</span><span class="odChip">No AI/API charge</span></div><div id="odImportStatus" class="odImportStatus"></div>`;
    grid.insertAdjacentElement('beforebegin',box);
    const input=document.getElementById('odImportInput');
    document.getElementById('odImportBtn').onclick=()=>input.click();
    input.onchange=()=>{const f=input.files?.[0];input.value='';if(f)processFile(f)};
    box.ondragover=ev=>{ev.preventDefault()};
    box.ondrop=ev=>{ev.preventDefault();const f=[...(ev.dataTransfer?.files||[])][0];if(f)processFile(f)};
    return true;
  }

  function status(text,type=''){const el=document.getElementById('odImportStatus');if(!el)return;el.textContent=text;el.className='odImportStatus '+type}
  function loadScript(src,test){return new Promise((resolve,reject)=>{if(test())return resolve();const s=document.createElement('script');s.src=src;s.onload=resolve;s.onerror=()=>reject(new Error('Could not load document reader.'));document.head.appendChild(s)})}
  function attachToSubmission(file){
    const input=document.getElementById('dealFiles');if(!input)return;
    const dt=new DataTransfer();dt.items.add(file);input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));
  }

  async function processFile(file){
    const ext=(file.name.split('.').pop()||'').toLowerCase();
    if(!['pdf','docx','pptx'].includes(ext)){status('Auto-fill supports PDF, DOCX, and PPTX files.','err');return}
    if(file.size>15*1024*1024){status('This file is larger than the 15 MB submission limit.','err');return}
    status(`Reading ${file.name}...`,'work');
    try{
      attachToSubmission(file);
      let text='';
      if(ext==='pdf')text=await pdfText(file);
      if(ext==='docx')text=await docxText(file);
      if(ext==='pptx')text=await pptxText(file);
      text=clean(text);
      if(text.length<40){status('The file was attached, but there was not enough readable text to auto-fill. You can still complete the form manually.','err');return}
      const data=parse(text,file.name),count=fill(data);
      status(`${file.name} attached. ${count} field${count===1?'':'s'} auto-filled. Review the details before submitting.`,'ok');
    }catch(err){console.error('document autofill',err);status(`The file was attached, but auto-fill could not read it: ${err?.message||'unknown error'}`,'err')}
  }

  async function pdfText(file){
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',()=>!!window.pdfjsLib);
    window.pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    const pdf=await window.pdfjsLib.getDocument({data:await file.arrayBuffer()}).promise;
    let out='';const max=Math.min(pdf.numPages,20);
    for(let i=1;i<=max;i++){const p=await pdf.getPage(i),c=await p.getTextContent();out+=c.items.map(x=>x.str).join(' ')+'\n'}
    return out;
  }
  async function docxText(file){
    await loadScript('https://cdn.jsdelivr.net/npm/mammoth@1.8.0/mammoth.browser.min.js',()=>!!window.mammoth);
    const r=await window.mammoth.extractRawText({arrayBuffer:await file.arrayBuffer()});return r.value||'';
  }
  async function pptxText(file){
    await loadScript('https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js',()=>!!window.JSZip);
    const zip=await window.JSZip.loadAsync(await file.arrayBuffer());
    const names=Object.keys(zip.files).filter(n=>/^ppt\/slides\/slide\d+\.xml$/.test(n)).sort((a,b)=>Number(a.match(/\d+/)?.[0])-Number(b.match(/\d+/)?.[0]));
    let out='';for(const n of names.slice(0,30)){const xml=await zip.file(n).async('text'),doc=new DOMParser().parseFromString(xml,'application/xml');out+=[...doc.getElementsByTagNameNS('*','t')].map(x=>x.textContent).join(' ')+'\n'}return out;
  }

  function clean(t){return String(t||'').replace(/\u0000/g,' ').replace(/[ \t]+/g,' ').replace(/\n{3,}/g,'\n\n').trim()}
  function fileTitle(name){return name.replace(/\.[^.]+$/,'').replace(/[_-]+/g,' ').replace(/\b(one[ -]?pager|pitch deck|investment deck|teaser|confidential)\b/ig,' ').replace(/\s+/g,' ').trim()}
  function lines(text){return text.split(/\n|\s{3,}/).map(x=>x.trim()).filter(Boolean)}

  function parse(text,name){
    const ls=lines(text),lower=text.toLowerCase();
    let title='';
    for(const l of ls.slice(0,18)){
      if(l.length<4||l.length>100)continue;
      if(/^(confidential|investment opportunity|executive summary|overview|pitch deck|one pager|one-pager|presentation|table of contents)$/i.test(l))continue;
      if(/@|https?:|www\.|\+?\d[\d\s().-]{7,}/.test(l))continue;
      title=l;break;
    }
    if(!title)title=fileTitle(name);

    let company='';
    const companyMatch=text.match(/(?:company|sponsor|issuer|developer|borrower|target)\s*[:\-]\s*([^\n|]{2,90})/i);
    if(companyMatch)company=companyMatch[1].trim().replace(/\s{2,}.*/,'');

    const amount=findAmount(text);
    const sector=findSector(lower);
    const geography=findGeography(lower);
    const type=findType(lower);
    const summary=findSummary(text,ls);
    return{title,company,amount,sector,geography,type,summary};
  }

  function findAmount(text){
    const re=/(?:US\$|USD\s*|\$)\s*([0-9]+(?:\.[0-9]+)?)\s*(billion|bn|b|million|mm|m)?/ig,c=[];let m;
    while((m=re.exec(text))){let n=Number(m[1]),u=(m[2]||'').toLowerCase();if(u==='billion'||u==='bn'||u==='b')n*=1e9;else if(u==='million'||u==='mm'||u==='m')n*=1e6;else if(n<100000)n*=1;const around=text.slice(Math.max(0,m.index-70),Math.min(text.length,re.lastIndex+70)).toLowerCase();let score=n; if(/raise|raising|seeking|capital|transaction|project cost|financing|enterprise value|purchase price|investment/.test(around))score*=3;if(/revenue|ebitda|sales|profit/.test(around))score*=.35;c.push({n,score})}
    c.sort((a,b)=>b.score-a.score);return c[0]?.n||'';
  }
  function findSector(t){
    const map=[['Hospitality / Real Estate',/resort|hotel|hospitality/],['Healthcare / Biotech',/healthcare|biotech|pharma|medical|clinical/],['Data Centers / Digital Infrastructure',/data center|datacenter|digital infrastructure|gpu infrastructure/],['Infrastructure',/infrastructure|toll road|airport|port|utility/],['Energy',/energy|solar|wind|battery|power plant|renewable|oil|gas/],['Industrial / Manufacturing',/industrial|manufactur|factory|machinery/],['Technology / AI',/artificial intelligence|\bai\b|software|saas|technology|cyber/],['Real Estate',/real estate|multifamily|apartment|commercial property|development/],['Financial Services',/fintech|financial services|banking|insurance|payments/],['Mining / Natural Resources',/mining|mineral|gold|copper|lithium/],['Logistics / Transportation',/logistics|transportation|freight|shipping|warehouse/],['Consumer',/consumer|retail|food and beverage|f&b/]];
    return map.find(x=>x[1].test(t))?.[0]||'';
  }
  function findGeography(t){
    const map=[['Southeast Asia',/southeast asia|south east asia/],['United States',/united states|\bu\.s\.\b|\busa\b/],['Philippines',/philippines|filipino/],['Singapore',/singapore/],['Malaysia',/malaysia/],['Indonesia',/indonesia/],['Thailand',/thailand/],['Vietnam',/vietnam/],['United Kingdom',/united kingdom|\bu\.k\.\b/],['Europe',/europe|european union|\beu\b/],['Middle East',/middle east|gcc|gulf cooperation council/],['UAE',/united arab emirates|\buae\b|dubai|abu dhabi/],['Saudi Arabia',/saudi arabia/],['Canada',/canada/],['Australia',/australia/],['Latin America',/latin america/],['Global',/global|worldwide/]];
    return map.find(x=>x[1].test(t))?.[0]||'';
  }
  function findType(t){
    if(/joint venture|\bjv\b/.test(t))return'Joint Venture';
    if(/structured capital|preferred equity|mezzanine|convertible/.test(t))return'Structured Capital';
    if(/debt financing|senior debt|credit facility|loan financing|private credit|refinanc/.test(t))return'Debt Financing';
    if(/strategic investment|strategic investor/.test(t))return'Strategic Investment';
    if(/acquisition|m&a|merger|buyout/.test(t))return'Acquisition / M&A';
    if(/full sale|partial sale|sale of the company|sell-side|divest/.test(t))return'Full or Partial Sale';
    if(/equity raise|capital raise|raising capital|fundrais|growth equity|seeking equity/.test(t))return'Equity Raise';
    return'';
  }
  function findSummary(text,ls){
    const m=text.match(/(?:executive summary|investment overview|opportunity overview|transaction overview)\s*[:\-]?\s*([\s\S]{80,1400}?)(?=\n\s*(?:company overview|investment highlights|transaction|financial|market|team|management|contact|use of funds)\b|$)/i);
    let s=m?.[1]?.trim()||'';
    if(!s){s=ls.filter(x=>x.length>35&&!/@|https?:|www\./i.test(x)).slice(0,5).join(' ')}
    return s.replace(/\s+/g,' ').slice(0,1200).trim();
  }

  function fill(data){
    const fields=[['dealTitle',data.title],['dealCompany',data.company],['dealAmount',data.amount],['dealSector',data.sector],['dealGeography',data.geography],['dealType',data.type],['dealSummary',data.summary]];
    let count=0;
    for(const [id,val] of fields){const el=document.getElementById(id);if(!el||!val||String(el.value||'').trim())continue;el.value=val;el.dispatchEvent(new Event(el.tagName==='SELECT'?'change':'input',{bubbles:true}));count++}
    if(typeof renderEstimate==='function')renderEstimate();
    return count;
  }

  if(!install()){
    const timer=setInterval(()=>{if(install())clearInterval(timer)},200);
    setTimeout(()=>clearInterval(timer),10000);
  }
})();