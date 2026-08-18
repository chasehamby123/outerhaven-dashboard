(function(){
  if(window.__outerhavenThesisPreviewClickGuard)return;
  window.__outerhavenThesisPreviewClickGuard=true;

  function documents(){return typeof state!=='undefined'&&Array.isArray(state.documents)?state.documents:[]}
  function isInternal(d){
    if(!d)return false;
    const name=String(d.fileName||'').toLowerCase(),mime=String(d.mime||'').toLowerCase();
    return /\.(docx|pptx|txt|csv)$/i.test(name)||mime.includes('wordprocessingml')||mime.includes('presentationml')||mime.startsWith('text/');
  }

  document.addEventListener('click',e=>{
    const button=e.target.closest('[data-preview-doc]');if(!button)return;
    const d=documents().find(x=>x.id===button.dataset.previewDoc);if(!isInternal(d))return;
    e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
  },true);
})();