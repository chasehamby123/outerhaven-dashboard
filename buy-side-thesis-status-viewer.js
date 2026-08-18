(function(){
  if(window.__outerhavenBuySideThesisStatusViewer)return;
  window.__outerhavenBuySideThesisStatusViewer=true;

  const BUCKET='outerhaven-documents';
  let enhancing=false;

  const style=document.createElement('style');
  style.textContent=`
    .pipelineProfileAction.thesisAdded{background:#177245!important;border-color:#177245!important;color:#fff!important}
    .pipelineProfileAction.thesisAdded:hover{background:#115d38!important;border-color:#115d38!important}
    #profileThesisSection .profileItemCard.thesisClickable{cursor:pointer;transition:border-color .15s ease,box-shadow .15s ease,transform .15s ease}
    #profileThesisSection .profileItemCard.thesisClickable:hover{border-color:#b8956f!important;box-shadow:0 7px 20px rgba(70,52,34,.10);transform:translateY(-1px)}
    #profileThesisSection .profileItemCard.thesisClickable .profileItemTitle:after{content:'  View';font-size:9px;font-weight:800;color:#725d45;margin-left:7px}
    .internalDocPreview{width:100%;height:100%;overflow:auto;background:#f3eee7;padding:28px}
    .internalDocPage{width:min(820px,100%);min-height:calc(100% - 20px);margin:0 auto;background:#fffdf9;border:1px solid #ddcfbe;border-radius:10px;box-shadow:0 8px 28px rgba(48,37,24,.09);padding:46px 54px;color:#201d18;font:14px/1.62 Georgia,'Times New Roman',serif}
    .internalDocPage h1,.internalDocPage h2,.internalDocPage h3{font-family:Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#171511;line-height:1.2}
    .internalDocPage h1{font-size:26px}.internalDocPage h2{font-size:20px;margin-top:28px}.internalDocPage h3{font-size:16px;margin-top:22px}
    .internalDocPage p{margin:0 0 12px}.internalDocPage ul,.internalDocPage ol{padding-left:24px}.internalDocPage table{border-collapse:collapse;width:100%;font-family:Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:12px}.internalDocPage td,.internalDocPage th{border:1px solid #d8c6b1;padding:8px;vertical-align:top}
    .internalDocLoading{display:grid;place-items:center;width:100%;height:100%;font-size:12px;color:#786f64}
    .pptPreview{width:min(900px,100%);margin:0 auto;display:grid;gap:18px}.pptSlide{background:#fffdf9;border:1px solid #ddcfbe;border-radius:12px;box-shadow:0 8px 28px rgba(48,37,24,.09);padding:34px 38px;min-height:360px}.pptSlideNo{font:800 9px/1 Inter,ui-sans-serif,sans-serif;color:#8a7967;letter-spacing:.09em;text-transform:uppercase;margin-bottom:18px}.pptText{font:15px/1.55 Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#201d18;margin:0 0 10px;white-space:pre-wrap}
    .internalPreviewError{width:min(620px,90%);margin:auto;background:#fffdf9;border:1px solid #ddcfbe;border-radius:12px;padding:24px;text-align:center;color:#5f5348}.internalPreviewError strong{display:block;color:#201d18;font-size:14px;margin-bottom:7px}.internalPreviewError p{font-size:11px;line-height:1.55;margin:0}
    @media(max-width:700px){.internalDocPreview{padding:10px}.internalDocPage{padding:24px 20px}.pptSlide{padding:24px 20px;min-height:280px}}
  `;
  document.head.appendChild(style);

  function theses(){return Array.isArray(window.state?.theses)?window.state.theses:(typeof state!=='undefined'&&Array.isArray(state.theses)?state.theses:[])}
  function docs(){return Array.isArray(window.state?.documents)?window.state.documents:(typeof state!=='undefined'&&Array.isArray(state.documents)?state.documents:[])}
  function hasThesis(personId){return theses().some(t=>t.personId===personId)}

  function enhancePipeline(){
    if(enhancing)return;enhancing=true;
    try{
      document.querySelectorAll('[data-open-profile-thesis]').forEach(btn=>{
        const personId=btn.dataset.openProfileThesis;
        const added=hasThesis(personId);
        btn.classList.toggle('thesisAdded',added);
        const label=added?'✓ Thesis Added':'Add Thesis';
        if(btn.textContent!==label)btn.textContent=label;
        btn.title=added?'Open thesis profile':'Add buy-side thesis';
      });
    }finally{enhancing=false}
  }

  function enhanceThesisCards(){
    document.querySelectorAll('#profileThesisSection .profileItemCard').forEach(card=>{
      const preview=card.querySelector('[data-preview-doc]');
      card.classList.toggle('thesisClickable',!!preview);
      if(preview)card.dataset.thesisPreviewDoc=preview.dataset.previewDoc;
      else delete card.dataset.thesisPreviewDoc;
    });
  }

  function enhance(){enhancePipeline();enhanceThesisCards()}

  function loadScript(src,test){
    if(test())return Promise.resolve();
    return new Promise((resolve,reject)=>{
      const existing=[...document.scripts].find(s=>s.src===src);
      if(existing){existing.addEventListener('load',resolve,{once:true});existing.addEventListener('error',reject,{once:true});return}
      const s=document.createElement('script');s.src=src;s.async=true;s.onload=resolve;s.onerror=reject;document.head.appendChild(s);
    });
  }

  function previewEls(){
    return{overlay:document.getElementById('docPreviewOverlay'),body:document.getElementById('docPreviewBody'),title:document.getElementById('docPreviewTitle')};
  }

  function showLoading(fileName){
    const {overlay,body,title}=previewEls();if(!overlay||!body||!title)return false;
    title.textContent=fileName||'Thesis';body.innerHTML='<div class="internalDocLoading">Preparing document preview...</div>';overlay.classList.remove('hidden');return true;
  }

  function sanitizeMammothHtml(raw){
    const parsed=new DOMParser().parseFromString(`<div id="root">${raw||''}</div>`,'text/html');
    const root=parsed.getElementById('root');if(!root)return'';
    root.querySelectorAll('script,style,iframe,object,embed,form,input,button,link,meta').forEach(n=>n.remove());
    root.querySelectorAll('*').forEach(el=>{
      [...el.attributes].forEach(a=>{
        const n=a.name.toLowerCase(),v=String(a.value||'').trim().toLowerCase();
        if(n.startsWith('on')||n==='style'||n==='srcdoc'||((n==='href'||n==='src')&&v.startsWith('javascript:')))el.removeAttribute(a.name);
      });
    });
    return root.innerHTML;
  }

  async function fetchBuffer(url){
    const res=await fetch(url,{credentials:'omit'});if(!res.ok)throw new Error(`Could not load document (${res.status}).`);return res.arrayBuffer();
  }

  async function renderDocx(url,d){
    await loadScript('https://cdn.jsdelivr.net/npm/mammoth@1.8.0/mammoth.browser.min.js',()=>!!window.mammoth);
    const buffer=await fetchBuffer(url);
    const result=await window.mammoth.convertToHtml({arrayBuffer:buffer});
    const safe=sanitizeMammothHtml(result.value);
    const {body}=previewEls();body.innerHTML=`<div class="internalDocPreview"><article class="internalDocPage">${safe||'<p>No readable text was found in this document.</p>'}</article></div>`;
  }

  function slideNumber(path){const m=path.match(/slide(\d+)\.xml$/i);return m?Number(m[1]):9999}
  async function renderPptx(url,d){
    await loadScript('https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js',()=>!!window.JSZip);
    const buffer=await fetchBuffer(url),zip=await window.JSZip.loadAsync(buffer);
    const slidePaths=Object.keys(zip.files).filter(p=>/^ppt\/slides\/slide\d+\.xml$/i.test(p)).sort((a,b)=>slideNumber(a)-slideNumber(b));
    const slides=[];
    for(const path of slidePaths){
      const xml=await zip.file(path).async('text');
      const doc=new DOMParser().parseFromString(xml,'application/xml');
      const runs=[...doc.getElementsByTagNameNS('*','t')].map(x=>x.textContent?.trim()).filter(Boolean);
      slides.push(runs);
    }
    const {body}=previewEls();
    body.innerHTML=`<div class="internalDocPreview"><div class="pptPreview">${slides.length?slides.map((runs,i)=>`<section class="pptSlide"><div class="pptSlideNo">Slide ${i+1}</div>${runs.length?runs.map(t=>`<div class="pptText">${escapeHtml(t)}</div>`).join(''):'<div class="pptText">No readable text on this slide.</div>'}</section>`).join(''):'<div class="internalPreviewError"><strong>No slides found</strong><p>The presentation could not be rendered in the dashboard.</p></div>'}</div></div>`;
  }

  async function renderText(url){
    const res=await fetch(url,{credentials:'omit'});if(!res.ok)throw new Error(`Could not load document (${res.status}).`);
    const text=await res.text(),{body}=previewEls();body.innerHTML=`<div class="internalDocPreview"><article class="internalDocPage"><pre style="white-space:pre-wrap;font:13px/1.6 Inter,ui-sans-serif,sans-serif;margin:0">${escapeHtml(text)}</pre></article></div>`;
  }

  function escapeHtml(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}

  async function openInternalPreview(docId){
    const d=docs().find(x=>x.id===docId);if(!d)return false;
    const name=String(d.fileName||'').toLowerCase(),mime=String(d.mime||'').toLowerCase();
    const internal=/\.docx$/i.test(name)||/\.pptx$/i.test(name)||/\.(txt|csv)$/i.test(name)||mime.includes('wordprocessingml')||mime.includes('presentationml')||mime.startsWith('text/');
    if(!internal)return false;
    if(!showLoading(d.fileName))return false;
    try{
      const {data,error}=await sb.storage.from(BUCKET).createSignedUrl(d.path,3600);if(error)throw error;
      if(/\.docx$/i.test(name)||mime.includes('wordprocessingml'))await renderDocx(data.signedUrl,d);
      else if(/\.pptx$/i.test(name)||mime.includes('presentationml'))await renderPptx(data.signedUrl,d);
      else await renderText(data.signedUrl,d);
    }catch(err){
      const {body}=previewEls();if(body)body.innerHTML=`<div class="internalPreviewError"><strong>Preview unavailable</strong><p>${escapeHtml(err?.message||'This document could not be rendered inside the dashboard.')}</p></div>`;
    }
    return true;
  }

  document.addEventListener('click',async e=>{
    const preview=e.target.closest('[data-preview-doc]');
    if(preview){
      const handled=await openInternalPreview(preview.dataset.previewDoc);
      if(handled){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation()}
      return;
    }
    const card=e.target.closest('#profileThesisSection .profileItemCard.thesisClickable');
    if(card&&!e.target.closest('button,input,select,textarea,a')){
      const id=card.dataset.thesisPreviewDoc;if(!id)return;
      e.preventDefault();e.stopPropagation();await openInternalPreview(id);
    }
  },true);

  const observer=new MutationObserver(()=>queueMicrotask(enhance));
  observer.observe(document.documentElement,{childList:true,subtree:true});
  document.addEventListener('DOMContentLoaded',enhance,{once:true});
  setTimeout(enhance,0);
})();