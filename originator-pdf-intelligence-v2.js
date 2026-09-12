(function(){
  if(window.__outerhavenPdfIntelligenceV2)return;
  window.__outerhavenPdfIntelligenceV2=true;

  const $=id=>document.getElementById(id);
  const clean=v=>String(v||'').replace(/\u00a0/g,' ').replace(/[ \t]+/g,' ').replace(/\n{3,}/g,'\n\n').trim();
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  const DOC_LABEL_RE=/(?:one[ -]?pager|one[ -]?page(?:r)?(?: overview)?|teaser|investment teaser|deal teaser|confidential teaser|investment memorandum|information memorandum|offering memorandum|executive summary|pitch deck|deal deck|investment opportunity|transaction overview|company overview|project overview|presentation|investor presentation|confidential presentation)/ig;
  let pdfjsPromise=null;
  let tesseractPromise=null;

  function status(message,type='',fields=[]){
    const el=$('pdfImportStatus');if(!el)return;
    el.className=`pdfImportStatus show ${type}`.trim();
    el.innerHTML=`${esc(message)}${fields.length?`<div class="pdfImportFields">${fields.map(f=>`<span class="pdfImportField">${esc(f)}</span>`).join('')}</div>`:''}`;
  }

  async function getPdfjs(){
    if(!pdfjsPromise){
      pdfjsPromise=import('https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs').then(lib=>{
        lib.GlobalWorkerOptions.workerSrc='https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs';
        return lib;
      });
    }
    return pdfjsPromise;
  }

  async function getTesseract(){
    if(!tesseractPromise)tesseractPromise=import('https://cdn.jsdelivr.net/npm/tesseract.js@7/dist/tesseract.esm.min.js');
    return tesseractPromise;
  }

  function sanitizeName(value){
    let s=clean(value)
      .replace(/\.(pdf|pptx?|docx?)$/i,'')
      .replace(/[_]+/g,' ')
      .replace(/\s*[|•·:]\s*/g,' - ')
      .replace(DOC_LABEL_RE,' ')
      .replace(/\b(?:strictly private|private and confidential|confidential|prepared for investors?|for discussion purposes only)\b/ig,' ')
      .replace(/^[\s\-–—:|]+|[\s\-–—:|]+$/g,'')
      .replace(/\s{2,}/g,' ')
      .trim();
    s=s.replace(/^(?:project|opportunity|company|transaction)\s*[:\-–—]\s*/i,'').trim();
    return s;
  }

  function genericOnly(value){
    const s=sanitizeName(value).toLowerCase();
    return !s||/^(?:overview|summary|investment|opportunity|transaction|company|project|capital raise|fundraise|fundraising|confidential)$/i.test(s);
  }

  function lineScore(line,fileStem){
    const raw=clean(line.text||'');
    const s=sanitizeName(raw);
    if(genericOnly(raw)||s.length<2||s.length>95)return-999;
    if(/https?:|www\.|@|copyright|page\s*\d|\$\s*\d|\b(?:revenue|ebitda|valuation|capital|raise|ask|investment size)\b/i.test(s))return-80;
    const words=s.split(/\s+/).filter(Boolean);
    if(words.length>11)return-30;
    let score=0;
    score+=Math.min(24,Number(line.size||0)*1.15);
    score+=Math.min(12,Number(line.yNorm||0)*12);
    if(DOC_LABEL_RE.test(raw)){DOC_LABEL_RE.lastIndex=0;score+=14}else DOC_LABEL_RE.lastIndex=0;
    if(words.length<=5)score+=8;
    if(/^[A-Z0-9&.'\- ]+$/.test(s)&&/[A-Z]/.test(s))score+=6;
    const a=s.toLowerCase().replace(/[^a-z0-9]/g,''),b=fileStem.toLowerCase().replace(/[^a-z0-9]/g,'');
    if(a&&b&&(a.includes(b)||b.includes(a)))score+=12;
    return score;
  }

  function layoutLines(items,viewport){
    const rows=[];
    const usable=(items||[]).filter(i=>i&&i.str&&clean(i.str)).map(i=>({
      text:clean(i.str),x:Number(i.transform?.[4]||0),y:Number(i.transform?.[5]||0),w:Number(i.width||0),size:Math.abs(Number(i.transform?.[3]||i.height||0))
    })).sort((a,b)=>Math.abs(b.y-a.y)>2.8?b.y-a.y:a.x-b.x);
    for(const item of usable){
      let row=rows.find(r=>Math.abs(r.y-item.y)<=Math.max(2.4,Math.min(5,item.size*.28)));
      if(!row){row={y:item.y,items:[]};rows.push(row)}
      row.items.push(item);
    }
    rows.sort((a,b)=>b.y-a.y);
    return rows.map(row=>{
      row.items.sort((a,b)=>a.x-b.x);
      let text='',prev=null,maxSize=0;
      for(const item of row.items){
        if(prev){const gap=item.x-(prev.x+prev.w);text+=gap>Math.max(5,prev.size*.55)?'   ':' '}
        text+=item.text;prev=item;maxSize=Math.max(maxSize,item.size);
      }
      return{text:clean(text),y:row.y,size:maxSize,yNorm:viewport?.height?row.y/viewport.height:0};
    }).filter(x=>x.text);
  }

  function sequentialText(items){
    let out='';
    for(const item of items||[]){if(!item?.str)continue;out+=item.str;out+=item.hasEOL?'\n':' '}
    return clean(out);
  }

  async function renderPageCanvas(page,scale=1.85){
    const viewport=page.getViewport({scale});
    const canvas=document.createElement('canvas');
    canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
    const ctx=canvas.getContext('2d',{alpha:false});
    ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);
    await page.render({canvasContext:ctx,viewport}).promise;
    return canvas;
  }

  async function readPdf(file,onProgress){
    const pdfjs=await getPdfjs();
    const bytes=new Uint8Array(await file.arrayBuffer());
    const doc=await pdfjs.getDocument({data:bytes}).promise;
    const maxPages=Math.min(doc.numPages,60),pages=[];
    for(let n=1;n<=maxPages;n++){
      onProgress?.(`Reading page ${n} of ${maxPages}...`);
      const page=await doc.getPage(n),viewport=page.getViewport({scale:1});
      const content=await page.getTextContent();
      const lines=layoutLines(content.items,viewport);
      const layout=clean(lines.map(x=>x.text).join('\n'));
      const sequential=sequentialText(content.items);
      pages.push({number:n,page,lines,layout,sequential,text:clean(`${layout}\n${sequential}`),ocr:'',usedOcr:false});
    }

    const weak=pages.filter((p,i)=>p.text.replace(/\s/g,'').length<180||(i===0&&p.lines.length<5));
    if(weak.length){
      onProgress?.(`Embedded text is incomplete. Running visual OCR on ${Math.min(weak.length,6)} page${weak.length===1?'':'s'}...`);
      try{
        const T=await getTesseract();
        const worker=await T.createWorker('eng',1,{logger:m=>{if(m?.status==='recognizing text'&&typeof m.progress==='number')onProgress?.(`Visual OCR ${Math.round(m.progress*100)}%...`)}});
        for(const p of weak.slice(0,6)){
          const canvas=await renderPageCanvas(p.page,p.number===1?2.05:1.7);
          const result=await worker.recognize(canvas);
          p.ocr=clean(result?.data?.text||'');
          p.usedOcr=!!p.ocr;
          p.text=clean(`${p.layout}\n${p.sequential}\n${p.ocr}`);
        }
        await worker.terminate();
      }catch(err){console.warn('OuterHaven OCR fallback unavailable',err)}
    }
    const text=clean(pages.map(p=>p.text).join('\n\n'));
    return{doc,pages,text,pageCount:doc.numPages,ocrPages:pages.filter(p=>p.usedOcr).length};
  }

  function amountFrom(raw){
    if(!raw)return 0;
    const normalized=String(raw).replace(/,/g,'').replace(/\bUSD\b/ig,'$').trim();
    const m=normalized.match(/(?:US\$|\$)?\s*([0-9]+(?:\.[0-9]+)?)\s*(bn|billion|bil|b|mm|million|mn|m|k|thousand)?/i);
    if(!m)return 0;
    let n=Number(m[1]);const s=(m[2]||'').toLowerCase();
    if(['bn','billion','bil','b'].includes(s))n*=1e9;
    else if(['mm','million','mn','m'].includes(s))n*=1e6;
    else if(['k','thousand'].includes(s))n*=1e3;
    return Number.isFinite(n)?n:0;
  }

  function displayAmount(n){
    n=Number(n||0);if(!n)return'';
    if(n>=1e9)return`${(n/1e9).toFixed(n%1e9?1:0)}B`;
    if(n>=1e6)return`${(n/1e6).toFixed(n%1e6?1:0)}M`;
    if(n>=1e3)return`${(n/1e3).toFixed(n%1e3?1:0)}K`;
    return String(Math.round(n));
  }

  const MONEY_TOKEN='(?:US\\$|USD|\\$)?\\s*[0-9][0-9,.]*(?:\\.[0-9]+)?\\s*(?:bn|billion|bil|b|mm|million|mn|m|k|thousand)?';
  function findMoneySmart(pages,labels){
    const labelRe=new RegExp(`(?:${labels.join('|')})`,'i');
    for(const page of pages){
      const lines=page.lines?.map(x=>x.text)||[];
      for(let i=0;i<lines.length;i++){
        if(!labelRe.test(lines[i]))continue;
        const same=lines[i].match(new RegExp(MONEY_TOKEN,'i'));
        if(same){const n=amountFrom(same[0]);if(n)return n}
        for(const j of [i+1,i-1,i+2]){
          if(j<0||j>=lines.length)continue;
          const m=lines[j].match(new RegExp(`^\\s*${MONEY_TOKEN}\\s*$|${MONEY_TOKEN}`,'i'));
          if(m){const n=amountFrom(m[0]);if(n)return n}
        }
      }
      const pText=page.text||'';
      const m=pText.match(new RegExp(`(?:${labels.join('|')})[^\\n]{0,75}?(${MONEY_TOKEN})`,'i'));
      if(m){const n=amountFrom(m[1]);if(n)return n}
    }
    return 0;
  }

  function labelValue(text,labels){
    for(const label of labels){
      const patterns=[
        new RegExp(`(?:^|\\n)\\s*(?:${label})\\s*[:\\-–—]\\s*([^\\n]{2,140})`,'im'),
        new RegExp(`(?:${label})\\s{2,}([^\\n]{2,100})`,'i')
      ];
      for(const re of patterns){const m=text.match(re);if(m){const v=clean(m[1]);if(v)return v}}
    }
    return'';
  }

  function bestName(parsed,fileName){
    const stem=sanitizeName(fileName.replace(/\.pdf$/i,''));
    const candidates=[];
    for(const line of parsed.pages?.[0]?.lines||[]){
      const s=sanitizeName(line.text);if(!genericOnly(line.text))candidates.push({value:s,score:lineScore(line,stem)});
    }
    const ocrLines=(parsed.pages?.[0]?.ocr||'').split('\n').map(t=>({text:t,size:9,yNorm:.75}));
    for(const line of ocrLines){const s=sanitizeName(line.text);if(!genericOnly(line.text))candidates.push({value:s,score:lineScore(line,stem)-5})}
    if(stem&&!genericOnly(stem))candidates.push({value:stem,score:15});
    candidates.sort((a,b)=>b.score-a.score);
    return candidates.find(c=>c.score>-50)?.value||stem||'Private Opportunity';
  }

  function inferSector(text){
    const x=text.toLowerCase();
    const groups=[
      ['Data Centers & Digital Infrastructure',[/data cent(er|re)/g,/colocation/g,/hyperscale/g,/fiber/g,/digital infrastructure/g,/telecom tower/g]],
      ['Hospitality & Real Estate',[/hotel/g,/resort/g,/hospitality/g,/lodging/g,/mixed.use/g,/commercial real estate/g,/multifamily/g,/real estate/g]],
      ['Healthcare',[/healthcare/g,/hospital/g,/clinic/g,/physician/g,/medical device/g,/biotech/g,/life science/g,/behavioral health/g]],
      ['Energy & Infrastructure',[/renewable/g,/solar/g,/wind/g,/power generation/g,/energy transition/g,/midstream/g,/utility/g,/infrastructure/g,/water infrastructure/g]],
      ['Technology / Software',[/software/g,/saas/g,/artificial intelligence/g,/\bai\b/g,/cybersecurity/g,/semiconductor/g,/technology platform/g]],
      ['Financial Services',[/financial services/g,/fintech/g,/insurance/g,/asset management/g,/wealth management/g,/payments/g]],
      ['Industrials',[/industrial/g,/manufactur/g,/specialty chemical/g,/automation/g,/packaging/g,/building products/g,/distribution/g]],
      ['Logistics & Transportation',[/logistics/g,/transportation/g,/freight/g,/warehousing/g,/shipping/g]],
      ['Aerospace & Defense',[/aerospace/g,/defen[sc]e/g,/aviation/g]],
      ['Natural Resources',[/mining/g,/critical mineral/g,/natural resources/g,/copper/g,/lithium/g,/gold mine/g]],
      ['Consumer',[/consumer/g,/restaurant/g,/retail/g,/franchise/g,/food and beverage/g]],
      ['Business Services',[/business services/g,/professional services/g,/staffing/g,/outsourcing/g]]
    ];
    let best='',score=0;
    for(const [label,res] of groups){let hits=0;for(const r of res)hits+=(x.match(r)||[]).length;if(hits>score){best=label;score=hits}}
    return best;
  }

  function inferGeography(text){
    const x=text.toLowerCase(),found=[];
    const countries=[['Singapore',/\bsingapore\b/],['Malaysia',/\bmalaysia\b/],['Philippines',/\bphilippines\b/],['Indonesia',/\bindonesia\b/],['Vietnam',/\bvietnam\b/],['Thailand',/\bthailand\b/],['United States',/\bunited states\b|\bu\.s\.\b|\busa\b/],['Canada',/\bcanada\b/],['United Kingdom',/\bunited kingdom\b|\bu\.k\.\b|\buk\b/],['Germany',/\bgermany\b/],['Switzerland',/\bswitzerland\b/],['Austria',/\baustria\b/],['France',/\bfrance\b/],['Spain',/\bspain\b/],['Italy',/\bitaly\b/],['Netherlands',/\bnetherlands\b/],['UAE',/\bunited arab emirates\b|\buae\b/],['Saudi Arabia',/\bsaudi arabia\b/],['India',/\bindia\b/],['Japan',/\bjapan\b/],['South Korea',/\bsouth korea\b/],['Australia',/\baustralia\b/],['Mexico',/\bmexico\b/],['Brazil',/\bbrazil\b/]];
    for(const [label,re] of countries)if(re.test(x)&&!found.includes(label))found.push(label);
    const sea=/southeast asia|south[- ]east asia|\basean\b/.test(x)||found.some(v=>['Singapore','Malaysia','Philippines','Indonesia','Vietnam','Thailand'].includes(v));
    if(sea){const local=found.filter(v=>['Singapore','Malaysia','Philippines','Indonesia','Vietnam','Thailand'].includes(v)).slice(0,3);return local.length?`${local.join(' / ')} · Southeast Asia`:'Southeast Asia'}
    if(found.length)return found.slice(0,3).join(' / ');
    if(/north america/.test(x))return'North America';
    if(/western europe|european union|\beurope\b/.test(x))return'Europe';
    if(/middle east|\bgcc\b|gulf cooperation council/.test(x))return'Middle East / GCC';
    if(/latin america|\blatam\b/.test(x))return'Latin America';
    if(/global|worldwide/.test(x))return'Global';
    return'';
  }

  function inferType(text){
    const x=text.toLowerCase();
    if(/full (company )?sale|partial sale|sale of (the )?company|divestiture|business for sale|sell[- ]side m&a/.test(x))return'Full or Partial Sale';
    if(/acquisition|buyout|merger|m&a transaction|acquire /.test(x))return'Acquisition / M&A';
    if(/joint venture|\bjv\b/.test(x))return'Joint Venture';
    if(/mezzanine|preferred equity|convertible|structured capital|structured finance/.test(x))return'Structured Capital';
    if(/senior debt|term loan|credit facility|debt financing|refinanc|private credit|loan facility/.test(x))return'Debt Financing';
    if(/strategic investment|strategic investor|strategic partner/.test(x))return'Strategic Investment';
    if(/equity raise|growth equity|minority equity|capital raise|fundraising|fund raise|raise of|equity investment/.test(x))return'Equity Raise';
    return'';
  }

  function summaryFrom(parsed,title){
    const text=parsed.text||'';
    const lower=text.toLowerCase();
    for(const h of ['executive summary','investment overview','transaction overview','company overview','opportunity overview','investment highlights','the opportunity']){
      const i=lower.indexOf(h);if(i<0)continue;
      const s=clean(text.slice(i+h.length,i+h.length+1900)).replace(/^[:\-–—\s]+/,'');
      if(s.length>=100)return s.slice(0,1700);
    }
    const reject=/confidential|disclaimer|copyright|table of contents|one[ -]?pager|teaser/i;
    const lines=(parsed.pages?.[0]?.lines||[]).map(x=>x.text).filter(x=>x.length>35&&!reject.test(x)&&sanitizeName(x)!==title);
    return clean(lines.slice(0,8).join(' ')).slice(0,1500)||clean(text).slice(0,1500);
  }

  function extractFields(parsed,fileName){
    const text=parsed.text;
    const explicitCompany=labelValue(text,['company(?: name)?','target(?: company)?','issuer','borrower','portfolio company','sponsor']);
    const explicitTitle=labelValue(text,['project(?: name)?','opportunity(?: name)?','transaction(?: name)?','deal(?: name)?']);
    const autoName=bestName(parsed,fileName);
    const company=sanitizeName(explicitCompany)||autoName;
    const title=sanitizeName(explicitTitle)||autoName;
    return{
      title:title.slice(0,160),company:company.slice(0,180),
      dealSize:findMoneySmart(parsed.pages,['capital (?:ask|raise|required|requirement)','funding (?:required|requirement|sought)','investment (?:sought|required|size)','transaction size','financing (?:sought|required)','equity raise','debt financing','total raise','purchase price','capital requirement']),
      revenue:findMoneySmart(parsed.pages,['ltm revenue','ttm revenue','annual revenue','net revenue','revenue','sales']),
      ebitda:findMoneySmart(parsed.pages,['adjusted ebitda','ltm ebitda','ttm ebitda','ebitda']),
      sector:inferSector(text),geography:inferGeography(text),transactionType:inferType(text),summary:summaryFrom(parsed,title)
    };
  }

  function setValue(id,value,event='input'){
    const el=$(id);if(!el||value===undefined||value===null||value==='')return false;
    el.value=value;el.classList.add('pdfAutofilled');el.dispatchEvent(new Event(event,{bubbles:true}));setTimeout(()=>el.classList.remove('pdfAutofilled'),1800);return true;
  }

  function attachPreservingFiles(file){
    const target=$('dealFiles');if(!target)return false;
    try{
      const dt=new DataTransfer();
      for(const existing of Array.from(target.files||[]))dt.items.add(existing);
      if(!Array.from(target.files||[]).some(f=>f.name===file.name&&f.size===file.size))dt.items.add(file);
      target.files=dt.files;target.dispatchEvent(new Event('change',{bubbles:true}));return true;
    }catch(_){return false}
  }

  async function processPdf(file){
    if(!/\.pdf$/i.test(file.name)&&file.type!=='application/pdf'){status('Only PDF files can be used for deal auto-fill.','error');return}
    if(file.size>10*1024*1024){status('This PDF is larger than the 10 MB portal limit.','error');return}
    const drop=$('pdfImportDrop');drop?.classList.add('processing');
    try{
      status(`Reading ${file.name}...`);
      const parsed=await readPdf(file,msg=>status(msg));
      if(parsed.text.replace(/\s/g,'').length<60)throw new Error('OuterHaven could not recover enough readable text from this PDF. Try a clearer PDF or enter the missing fields manually.');
      const f=extractFields(parsed,file.name),filled=[];
      if(setValue('dealTitle',f.title))filled.push('Opportunity');
      if(setValue('dealCompany',f.company))filled.push('Company');
      if(setValue('dealAmount',displayAmount(f.dealSize)))filled.push('Capital Ask');
      if(setValue('dealSector',f.sector))filled.push('Sector');
      if(setValue('dealGeography',f.geography))filled.push('Geography');
      if(setValue('dealType',f.transactionType,'change'))filled.push('Structure');
      if(setValue('dealRevenue',displayAmount(f.revenue)))filled.push('Revenue');
      if(setValue('dealEbitda',displayAmount(f.ebitda)))filled.push('EBITDA');
      if(setValue('dealSummary',f.summary))filled.push('Summary');
      const attached=attachPreservingFiles(file),missing=[];
      if(!f.dealSize)missing.push('capital ask');if(!f.sector)missing.push('sector');if(!f.geography)missing.push('geography');if(!f.transactionType)missing.push('structure');
      let msg=`Imported ${filled.length} fields from ${parsed.pageCount} page${parsed.pageCount===1?'':'s'}.`;
      if(parsed.ocrPages)msg+=` Visual OCR recovered ${parsed.ocrPages} weak/image-based page${parsed.ocrPages===1?'':'s'}.`;
      if(attached)msg+=' The PDF was added to Supporting Materials.';
      msg+=' Review every extracted value before submitting. Seller relationship and seller-side authority remain manual confirmations.';
      if(missing.length)msg+=` Still needs review: ${missing.join(', ')}.`;
      status(msg,'good',filled);
      $('dealTitle')?.scrollIntoView({behavior:'smooth',block:'center'});
    }catch(err){console.error('OuterHaven PDF intelligence v2',err);status(err?.message||'OuterHaven could not read this PDF.','error')}
    finally{drop?.classList.remove('processing')}
  }

  function takeover(){
    const input=$('pdfImportInput'),drop=$('pdfImportDrop'),choose=$('pdfImportChoose');
    if(!input||!drop||!choose){setTimeout(takeover,180);return}
    const badge=document.querySelector('.pdfImportBadge');if(badge)badge.textContent='Hybrid PDF + OCR';
    const copy=document.querySelector('.pdfImportTop p');if(copy)copy.textContent='Upload a CIM, teaser, one-pager, investment memorandum, or deal deck. OuterHaven reconstructs the page layout and uses visual OCR when embedded PDF text is incomplete.';
    choose.onclick=e=>{e.preventDefault();e.stopPropagation();input.click()};
    drop.onclick=e=>{if(e.target.closest('button'))return;input.click()};
    drop.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();input.click()}};
    drop.ondragover=e=>{e.preventDefault();drop.classList.add('drag')};
    drop.ondragleave=()=>drop.classList.remove('drag');
    drop.ondrop=e=>{e.preventDefault();drop.classList.remove('drag');const file=[...e.dataTransfer.files].find(f=>f.type==='application/pdf'||/\.pdf$/i.test(f.name));if(file)processPdf(file);else status('Please drop a PDF file.','error')};
    input.onchange=()=>{const file=input.files?.[0];if(file)processPdf(file);input.value=''};
  }
  takeover();
})();