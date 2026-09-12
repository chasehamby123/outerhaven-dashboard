(function(){
  if(window.__outerhavenInvestorNameCleanerV1)return;
  window.__outerhavenInvestorNameCleanerV1=true;
  const sb=window.__OUTERHAVEN_ORIGINATOR_SB;
  if(!sb)return;
  const $=id=>document.getElementById(id);

  function cleanName(v){
    const original=String(v||'').replace(/\s+/g,' ').trim();
    if(!original)return'';
    let s=original.replace(/\.(?:pdf|pptx?|docx?)$/i,'').trim();
    const suffix=/\s*(?:[-–—|:]\s*)?(?:investor\s+pitch\s+deck|pitch\s+deck|investor\s+presentation|investment\s+presentation|investor\s+deck|investment\s+deck|confidential\s+information\s+memorandum|information\s+memorandum|investment\s+memorandum|investor\s+teaser|investment\s+teaser|teaser|cim)\s*$/i;
    s=s.replace(suffix,'').trim();
    return s||original;
  }

  function cleanFormField(id){
    const el=$(id);if(!el)return;
    const next=cleanName(el.value);
    if(next&&next!==el.value){el.value=next;el.dispatchEvent(new Event('input',{bubbles:true}))}
  }
  function bindForm(){
    ['dealTitle','dealCompany'].forEach(id=>{
      const el=$(id);if(!el)return;
      if(el.dataset.nameCleanerBound)return;
      el.dataset.nameCleanerBound='1';
      el.addEventListener('change',()=>cleanFormField(id));
      el.addEventListener('blur',()=>cleanFormField(id));
    });
  }

  let cache={id:null,raw:[],clean:[]};
  async function currentNames(){
    const id=$('capitalDealSelect')?.value;
    if(!id)return cache;
    if(cache.id===id)return cache;
    const {data,error}=await sb.from('deals').select('title,company').eq('id',id).maybeSingle();
    if(error||!data)return cache={id,raw:[],clean:[]};
    const raw=[data.title,data.company].filter(Boolean);
    const clean=raw.map(cleanName);
    cache={id,raw,clean};
    return cache;
  }

  function replaceText(root,raw,clean){
    if(!root||!raw||!clean||raw===clean)return;
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
    const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);
    nodes.forEach(n=>{if(n.nodeValue&&n.nodeValue.includes(raw))n.nodeValue=n.nodeValue.split(raw).join(clean)});
  }

  async function sanitizeOutput(){
    const body=$('capitalOutputBody');if(!body)return;
    const names=await currentNames();
    names.raw.forEach((raw,i)=>replaceText(body,raw,names.clean[i]));
  }

  function installPrintCopy(){
    const dl=$('capitalDownload');
    if(dl&&!dl.dataset.cleanerOwned){
      dl.dataset.cleanerOwned='1';
      dl.id='capitalDownloadInvestorClean';
      dl.addEventListener('click',e=>{
        e.preventDefault();e.stopImmediatePropagation();
        sanitizeOutput().then(()=>{
          const body=$('capitalOutputBody');if(!body)return;
          const title=$('capitalOutputTitle')?.textContent||'Investor Material';
          const w=window.open('','_blank');if(!w){window.print();return}
          const styles=$('ohDocV10Style')?.textContent||'';
          w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${title.replace(/[<>]/g,'')}</title><style>${styles}body{margin:0;background:#fff}.oh10{max-width:920px;margin:auto}</style></head><body>${body.innerHTML}<script>window.onload=()=>setTimeout(()=>window.print(),120)<\/script></body></html>`);
          w.document.close();
        });
      },true);
    }
    const cp=$('capitalCopy');
    if(cp&&!cp.dataset.cleanerOwned){
      cp.dataset.cleanerOwned='1';
      cp.id='capitalCopyInvestorClean';
      cp.addEventListener('click',e=>{
        e.preventDefault();e.stopImmediatePropagation();
        sanitizeOutput().then(()=>navigator.clipboard?.writeText($('capitalOutputBody')?.innerText||''));
      },true);
    }
  }

  function wrapDocs(){
    const api=window.OuterHavenCapitalDocsV11||window.OuterHavenCapitalDocsV10||window.OuterHavenCapitalDocsV9;
    if(!api||api.__nameCleanerWrapped)return;
    const original=api.renderAsset.bind(api);
    api.renderAsset=async function(type){
      const result=await original(type);
      await sanitizeOutput();
      installPrintCopy();
      return result;
    };
    api.__nameCleanerWrapped=true;
    window.OuterHavenCapitalDocsV11=api;
    window.OuterHavenCapitalDocsV10=api;
    window.OuterHavenCapitalDocsV9=api;
    window.OuterHavenCapitalDocsV8=api;
  }

  function boot(){bindForm();wrapDocs();installPrintCopy()}
  [0,250,700,1500].forEach(ms=>setTimeout(boot,ms));
  document.addEventListener('click',()=>setTimeout(boot,120),true);
  document.addEventListener('change',e=>{if(e.target?.id==='capitalDealSelect'){cache={id:null,raw:[],clean:[]};setTimeout(boot,120)}},true);
})();
