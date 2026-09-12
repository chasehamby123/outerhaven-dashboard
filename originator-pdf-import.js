(function(){
  if(window.__outerhavenPdfImport)return;
  window.__outerhavenPdfImport=true;

  const $=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  const clean=v=>String(v||'').replace(/\u00a0/g,' ').replace(/[ \t]+/g,' ').replace(/\n{3,}/g,'\n\n').trim();
  let pdfjsPromise=null;

  function installStyles(){
    if($('pdfImportStyle'))return;
    const style=document.createElement('style');
    style.id='pdfImportStyle';
    style.textContent=`
      .pdfImport{margin:0 0 20px;padding:17px;border:1px solid #d9cabb;border-radius:14px;background:linear-gradient(135deg,#fcf8f2,#f4eadf)}
      .pdfImportTop{display:flex;justify-content:space-between;gap:18px;align-items:flex-start;margin-bottom:12px}
      .pdfImportTop h3{margin:3px 0 4px;font-size:16px;color:#211c17}.pdfImportTop p{margin:0;color:#75685d;font-size:10px;line-height:1.55;max-width:620px}
      .pdfImportBadge{white-space:nowrap;padding:5px 8px;border-radius:999px;background:#211c17;color:#fff8ef;font-size:7px;font-weight:900;letter-spacing:.08em;text-transform:uppercase}
      .pdfImportDrop{border:1px dashed #bda98f;border-radius:12px;background:rgba(255,255,255,.6);padding:18px;display:grid;place-items:center;text-align:center;cursor:pointer;transition:.15s ease;min-height:118px}
      .pdfImportDrop:hover,.pdfImportDrop.drag{background:#fffdfa;border-color:#80684e}.pdfImportDrop.processing{cursor:wait;opacity:.78}
      .pdfImportDrop strong{font-size:12px;color:#2a241e}.pdfImportDrop span{font-size:9px;color:#817467;margin-top:4px}.pdfImportDrop button{margin-top:10px}
      .pdfImportStatus{display:none;margin-top:10px;padding:10px 11px;border-radius:9px;background:#fffdfa;border:1px solid #dfd3c5;font-size:9px;color:#655a50;line-height:1.5}.pdfImportStatus.show{display:block}.pdfImportStatus.good{border-color:#c9d4c6;background:#f5f8f2}.pdfImportStatus.error{border-color:#e0c3bb;background:#fff5f1}
      .pdfImportFields{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}.pdfImportField{padding:4px 7px;border-radius:999px;background:#eee4d8;color:#66594c;font-size:7px;font-weight:850;text-transform:uppercase;letter-spacing:.04em}
      .pdfImportDivider{display:flex;align-items:center;gap:9px;margin:16px 0 2px;color:#9a8c7d;font-size:8px;font-weight:850;text-transform:uppercase;letter-spacing:.08em}.pdfImportDivider:before,.pdfImportDivider:after{content:'';height:1px;background:#dfd4c8;flex:1}
      .pdfAutofilled{outline:2px solid rgba(133,103,68,.18)!important;background:#fffaf2!important;transition:.3s ease}
      @media(max-width:700px){.pdfImportTop{display:block}.pdfImportBadge{display:inline-block;margin-top:9px}}
    `;
    document.head.appendChild(style);
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

  function installUI(){
    const form=$('submissionForm');
    if(!form||$('pdfDealImport'))return false;
    const head=form.querySelector('.panelHead');
    const box=document.createElement('section');
    box.id='pdfDealImport';
    box.className='pdfImport';
    box.innerHTML=`
      <div class="pdfImportTop"><div><div class="eyebrow">DOCUMENT INTELLIGENCE</div><h3>Start with a PDF</h3><p>Upload a CIM, teaser, investment memorandum, or deal deck. OuterHaven will read the document, extract the core transaction information, and pre-fill the submission form for review.</p></div><span class="pdfImportBadge">PDF Auto-Fill</span></div>
      <div id="pdfImportDrop" class="pdfImportDrop" tabindex="0" role="button" aria-label="Upload PDF to autofill opportunity">
        <input id="pdfImportInput" type="file" accept="application/pdf,.pdf" hidden>
        <strong>Drop your deal PDF here</strong>
        <span>CIM, teaser, investment memo, or deck · PDF · up to 10 MB</span>
        <button id="pdfImportChoose" type="button" class="secondaryBtn">Choose PDF</button>
      </div>
      <div id="pdfImportStatus" class="pdfImportStatus" role="status" aria-live="polite"></div>
      <div class="pdfImportDivider">or enter the deal manually</div>`;
    if(head)head.insertAdjacentElement('afterend',box);else form.prepend(box);

    const input=$('pdfImportInput'),drop=$('pdfImportDrop');
    $('pdfImportChoose').onclick=e=>{e.preventDefault();input.click()};
    drop.onclick=e=>{if(e.target.closest('button'))return;input.click()};
    drop.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();input.click()}};
    drop.ondragover=e=>{e.preventDefault();drop.classList.add('drag')};
    drop.ondragleave=()=>drop.classList.remove('drag');
    drop.ondrop=e=>{e.preventDefault();drop.classList.remove('drag');const file=[...e.dataTransfer.files].find(f=>f.type==='application/pdf'||/\.pdf$/i.test(f.name));if(file)processPdf(file);else setStatus('Please drop a PDF file.','error')};
    input.onchange=()=>{const file=input.files?.[0];if(file)processPdf(file);input.value=''};
    return true;
  }

  function setStatus(message,type='',fields=[]){
    const el=$('pdfImportStatus');if(!el)return;
    el.className=`pdfImportStatus show ${type}`.trim();
    el.innerHTML=`${esc(message)}${fields.length?`<div class="pdfImportFields">${fields.map(f=>`<span class="pdfImportField">${esc(f)}</span>`).join('')}</div>`:''}`;
  }

  async function extractText(file){
    const pdfjs=await getPdfjs();
    const bytes=new Uint8Array(await file.arrayBuffer());
    const doc=await pdfjs.getDocument({data:bytes}).promise;
    const pages=[];
    const maxPages=Math.min(doc.numPages,60);
    for(let n=1;n<=maxPages;n++){
      const page=await doc.getPage(n);
      const content=await page.getTextContent();
      let pageText='';
      for(const item of content.items){
        if(!item?.str)continue;
        pageText+=item.str;
        pageText+=item.hasEOL?'\n':' ';
      }
      pages.push(clean(pageText));
    }
    return{pages,text:clean(pages.join('\n\n')),pageCount:doc.numPages};
  }

  function amountFrom(raw){
    if(!raw)return 0;
    const m=String(raw).replace(/,/g,'').match(/(?:US\$|USD|\$)?\s*([0-9]+(?:\.[0-9]+)?)\s*(bn|billion|b|mm|million|m|k|thousand)?/i);
    if(!m)return 0;
    let n=Number(m[1]);const s=(m[2]||'').toLowerCase();
    if(['bn','billion','b'].includes(s))n*=1e9;
    else if(['mm','million','m'].includes(s))n*=1e6;
    else if(['k','thousand'].includes(s))n*=1e3;
    return Number.isFinite(n)?n:0;
  }

  function displayAmount(n){
    n=Number(n||0);if(!n)return'';
    if(n>=1e9)return(n/1e9).toFixed(n%1e9?1:0)+'B';
    if(n>=1e6)return(n/1e6).toFixed(n%1e6?1:0)+'M';
    if(n>=1e3)return(n/1e3).toFixed(n%1e3?1:0)+'K';
    return String(Math.round(n));
  }

  function findMoney(text,labels){
    for(const label of labels){
      const patterns=[
        new RegExp(`(?:${label})\\s*(?:[:\\-–—]|is|of|approximately|approx\\.?|total)?\\s*((?:US\\$|USD|\\$)\\s*[0-9][0-9,.]*\\s*(?:bn|billion|b|mm|million|m|k|thousand)?)`,'i'),
        new RegExp(`(?:${label})[^\\n]{0,55}?((?:US\\$|USD|\\$)\\s*[0-9][0-9,.]*\\s*(?:bn|billion|b|mm|million|m|k|thousand)?)`,'i'),
        new RegExp(`(?:${label})\\s*(?:[:\\-–—]|is|of|approximately|approx\\.?|total)?\\s*([0-9][0-9,.]*\\s*(?:bn|billion|b|mm|million|m|k|thousand))`,'i')
      ];
      for(const re of patterns){const m=text.match(re);if(m){const n=amountFrom(m[1]);if(n>0)return n}}
    }
    return 0;
  }

  function labelValue(text,labels){
    for(const label of labels){
      const re=new RegExp(`(?:^|\\n)\\s*(?:${label})\\s*[:\\-–—]\\s*([^\\n]{2,140})`,'im');
      const m=text.match(re);if(m){const v=clean(m[1]).replace(/\s{2,}/g,' ').trim();if(v)return v}
    }
    return'';
  }

  function firstUsefulLine(text,fileName){
    const bad=/confidential|private and confidential|investment memorandum|information memorandum|presentation|disclaimer|strictly private|prepared for|table of contents|www\.|@|copyright|page \d/i;
    const lines=text.split('\n').map(clean).filter(x=>x.length>=3&&x.length<=110&&!bad.test(x)&&!/^[\d\W]+$/.test(x));
    const preferred=lines.find(x=>/[a-z]/i.test(x)&&x.split(/\s+/).length<=12);
    return preferred||fileName.replace(/\.pdf$/i,'').replace(/[_-]+/g,' ').trim();
  }

  function inferSector(text){
    const x=text.toLowerCase();
    const map=[
      ['Data Centers & Digital Infrastructure',[/data cent(er|re)/,/colocation/,/fiber/,/digital infrastructure/,/telecom tower/]],
      ['Hospitality & Real Estate',[/hotel/,/resort/,/hospitality/,/lodging/,/mixed.use/,/commercial real estate/,/real estate/]],
      ['Healthcare',[/healthcare/,/hospital/,/clinic/,/physician/,/medical device/,/biotech/,/life science/,/behavioral health/]],
      ['Energy & Infrastructure',[/renewable/,/solar/,/wind/,/power generation/,/energy transition/,/midstream/,/utility/,/infrastructure/,/water infrastructure/]],
      ['Technology / Software',[/software/,/saas/,/artificial intelligence/,/\bai\b/,/cybersecurity/,/semiconductor/,/technology platform/]],
      ['Financial Services',[/financial services/,/fintech/,/insurance/,/asset management/,/wealth management/,/payments/]],
      ['Industrials',[/industrial/,/manufactur/,/specialty chemical/,/automation/,/packaging/,/building products/,/distribution/]],
      ['Logistics & Transportation',[/logistics/,/transportation/,/freight/,/warehousing/,/shipping/]],
      ['Aerospace & Defense',[/aerospace/,/defen[sc]e/,/aviation/]],
      ['Natural Resources',[/mining/,/critical mineral/,/natural resources/,/copper/,/lithium/,/gold mine/]],
      ['Consumer',[/consumer/,/restaurant/,/retail/,/franchise/,/food and beverage/]],
      ['Business Services',[/business services/,/professional services/,/staffing/,/outsourcing/]]
    ];
    let best=null,bestHits=0;
    for(const [label,res] of map){const hits=res.filter(r=>r.test(x)).length;if(hits>bestHits){best=label;bestHits=hits}}
    return best||'';
  }

  function inferGeography(text){
    const x=text.toLowerCase(),found=[];
    const countries=[
      ['Singapore','singapore'],['Malaysia','malaysia'],['Philippines','philippines'],['Indonesia','indonesia'],['Vietnam','vietnam'],['Thailand','thailand'],
      ['United States','united states'],['United States','u.s.'],['United States','usa'],['Canada','canada'],['United Kingdom','united kingdom'],['United Kingdom','uk'],
      ['Germany','germany'],['Switzerland','switzerland'],['Austria','austria'],['France','france'],['Spain','spain'],['Italy','italy'],['Netherlands','netherlands'],
      ['UAE','united arab emirates'],['UAE','uae'],['Saudi Arabia','saudi arabia'],['India','india'],['Japan','japan'],['South Korea','south korea'],['Australia','australia'],['Mexico','mexico'],['Brazil','brazil']
    ];
    for(const [label,needle] of countries){if(x.includes(needle)&&!found.includes(label))found.push(label)}
    const sea=found.some(v=>['Singapore','Malaysia','Philippines','Indonesia','Vietnam','Thailand'].includes(v))||/southeast asia|south east asia|\basean\b/.test(x);
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
    if(/full (company )?sale|partial sale|sale of (the )?company|divestiture|business for sale|sell.side m&a/.test(x))return'Full or Partial Sale';
    if(/acquisition|buyout|merger|m&a transaction|acquire /.test(x))return'Acquisition / M&A';
    if(/joint venture|\bjv\b/.test(x))return'Joint Venture';
    if(/mezzanine|preferred equity|convertible|structured capital|structured finance/.test(x))return'Structured Capital';
    if(/senior debt|term loan|credit facility|debt financing|refinanc|private credit|loan facility/.test(x))return'Debt Financing';
    if(/strategic investment|strategic investor|strategic partner/.test(x))return'Strategic Investment';
    if(/equity raise|growth equity|minority equity|capital raise|fundraising|raise of|equity investment/.test(x))return'Equity Raise';
    return'';
  }

  function sectionSnippet(text){
    const headings=['executive summary','investment overview','transaction overview','company overview','opportunity overview','investment highlights','the opportunity','overview'];
    const lower=text.toLowerCase();
    for(const h of headings){
      const i=lower.indexOf(h);if(i<0)continue;
      let s=clean(text.slice(i+h.length,i+h.length+1900));
      s=s.replace(/^[:\-–—\s]+/,'').trim();
      if(s.length>=80)return s.slice(0,1700);
    }
    return clean(text.split('\n').filter(line=>!/confidential|disclaimer|table of contents|copyright/i.test(line)).join(' ')).slice(0,1500);
  }

  function extractFields(text,fileName){
    const explicitCompany=labelValue(text,['company(?: name)?','target(?: company)?','issuer','borrower','portfolio company']);
    const explicitTitle=labelValue(text,['project(?: name)?','opportunity(?: name)?','transaction(?: name)?','deal(?: name)?']);
    const first=firstUsefulLine(text,fileName);
    const company=explicitCompany||first;
    const title=explicitTitle||company||fileName.replace(/\.pdf$/i,'').replace(/[_-]+/g,' ');
    const dealSize=findMoney(text,[
      'capital (?:ask|raise|required|requirement)','funding (?:required|requirement|sought)','investment (?:sought|required)','transaction size','financing (?:sought|required)','equity raise','debt financing','total raise','purchase price'
    ]);
    const revenue=findMoney(text,['ltm revenue','ttm revenue','annual revenue','net revenue','revenue','sales']);
    const ebitda=findMoney(text,['adjusted ebitda','ltm ebitda','ttm ebitda','ebitda']);
    return{
      title:clean(title).slice(0,160),
      company:clean(company).slice(0,180),
      dealSize,
      revenue,
      ebitda,
      sector:inferSector(text),
      geography:inferGeography(text),
      transactionType:inferType(text),
      summary:sectionSnippet(text)
    };
  }

  function setValue(id,value,event='input'){
    const el=$(id);if(!el||value===undefined||value===null||value==='')return false;
    el.value=value;
    el.classList.add('pdfAutofilled');
    el.dispatchEvent(new Event(event,{bubbles:true}));
    setTimeout(()=>el.classList.remove('pdfAutofilled'),1800);
    return true;
  }

  function attachToSupportingMaterials(file){
    const target=$('dealFiles');if(!target)return false;
    try{
      const dt=new DataTransfer();dt.items.add(file);target.files=dt.files;target.dispatchEvent(new Event('change',{bubbles:true}));return true;
    }catch(_){return false}
  }

  function applyFields(fields,file){
    const filled=[];
    if(setValue('dealTitle',fields.title))filled.push('Opportunity');
    if(setValue('dealCompany',fields.company))filled.push('Company');
    if(setValue('dealAmount',displayAmount(fields.dealSize)))filled.push('Capital Ask');
    if(setValue('dealSector',fields.sector))filled.push('Sector');
    if(setValue('dealGeography',fields.geography))filled.push('Geography');
    if(setValue('dealType',fields.transactionType,'change'))filled.push('Structure');
    if(setValue('dealRevenue',displayAmount(fields.revenue)))filled.push('Revenue');
    if(setValue('dealEbitda',displayAmount(fields.ebitda)))filled.push('EBITDA');
    if(setValue('dealSummary',fields.summary))filled.push('Summary');
    const attached=attachToSupportingMaterials(file);
    return{filled,attached};
  }

  async function processPdf(file){
    if(!/\.pdf$/i.test(file.name)&&file.type!=='application/pdf'){setStatus('Only PDF files can be used for deal auto-fill.','error');return}
    if(file.size>10*1024*1024){setStatus('This PDF is larger than the 10 MB portal limit.','error');return}
    const drop=$('pdfImportDrop');drop?.classList.add('processing');
    setStatus(`Reading ${file.name} and extracting transaction data...`);
    try{
      const {text,pageCount}=await extractText(file);
      if(text.length<80)throw new Error('The PDF does not contain enough readable text. It may be image-only or scanned.');
      const fields=extractFields(text,file.name);
      const result=applyFields(fields,file);
      const missing=[];
      if(!fields.dealSize)missing.push('capital ask');if(!fields.sector)missing.push('sector');if(!fields.geography)missing.push('geography');if(!fields.transactionType)missing.push('structure');
      let message=`Imported ${result.filled.length} deal fields from ${pageCount} page${pageCount===1?'':'s'}. Review the extracted values before submitting.`;
      if(result.attached)message+=' The PDF was also added to Supporting Materials.';
      message+=' Seller relationship and seller-side authority remain manual confirmations.';
      if(missing.length)message+=` Could not confidently identify: ${missing.join(', ')}.`;
      setStatus(message,'good',result.filled);
      $('dealTitle')?.scrollIntoView({behavior:'smooth',block:'center'});
    }catch(err){
      console.error('PDF deal import',err);
      setStatus(err?.message||'OuterHaven could not read this PDF. Enter the deal manually or try another document.','error');
    }finally{drop?.classList.remove('processing')}
  }

  function init(){
    installStyles();
    if(!installUI())setTimeout(init,180);
  }
  init();
})();