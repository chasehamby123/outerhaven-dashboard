(function(){
  if(window.__outerhavenDocumentControllerV1)return;
  window.__outerhavenDocumentControllerV1=true;

  const $=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  const api=()=>window.OuterHavenCapitalDocsV11||window.OuterHavenCapitalDocsV10||window.OuterHavenCapitalDocsV9||window.OuterHavenCapitalDocsV8||null;

  function currentStyles(){
    return ['ohDocV10Style','ohTeaserV3Style','ohSpecV2Style']
      .map(id=>$(id)?.textContent||'')
      .filter(Boolean)
      .join('\n');
  }

  function printCurrent(){
    const body=$('capitalOutputBody');
    if(!body||!body.innerHTML.trim())return;
    const title=$('capitalOutputTitle')?.textContent?.trim()||'Investor Material';
    const w=window.open('','_blank');
    if(!w){window.print();return}
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>${currentStyles()}body{margin:0;background:#fff!important}article{max-width:920px;margin:0 auto}</style></head><body>${body.innerHTML}<script>window.onload=()=>setTimeout(()=>window.print(),120)<\/script></body></html>`);
    w.document.close();
  }

  async function copyCurrent(){
    const body=$('capitalOutputBody');
    const text=body?.innerText||'';
    if(!text)return;
    try{await navigator.clipboard.writeText(text)}catch(_){return}
    const b=$('capitalCopyCurrent');
    if(b){const old=b.textContent;b.textContent='Copied';setTimeout(()=>b.textContent=old||'Copy Text',1200)}
  }

  function installExportControls(){
    const oldDownload=$('capitalDownload');
    if(oldDownload){
      oldDownload.id='capitalExportCurrent';
      oldDownload.onclick=null;
      oldDownload.textContent='Print / Save PDF';
      oldDownload.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();printCurrent()});
    }
    const oldCopy=$('capitalCopy');
    if(oldCopy){
      oldCopy.id='capitalCopyCurrent';
      oldCopy.onclick=null;
      oldCopy.textContent='Copy Text';
      oldCopy.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();copyCurrent()});
    }
  }

  window.OuterHavenCapitalDocs=api();

  // V17 still references a legacy V9 alias. Intercept its document buttons at
  // the window capture phase and route them through the canonical live API.
  window.addEventListener('click',e=>{
    const btn=e.target?.closest?.('[data-v17-doc]');
    if(!btn)return;
    const live=api();
    if(!live?.renderAsset)return;
    e.preventDefault();
    e.stopPropagation();
    const type=btn.dataset.v17Doc;
    live.renderAsset(type);
    setTimeout(installExportControls,0);
  },true);

  [0,200,700,1500].forEach(ms=>setTimeout(installExportControls,ms));
})();