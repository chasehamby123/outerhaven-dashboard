(function(){
  if(window.__outerhavenProfileModalFlowFix)return;
  window.__outerhavenProfileModalFlowFix=true;

  document.addEventListener('click',function(e){
    const trigger=e.target.closest('[data-profile-add-opportunity],[data-profile-add-thesis]');
    if(!trigger)return;
    const overlay=document.getElementById('relationshipProfileOverlay');
    if(overlay&&!overlay.classList.contains('hidden')){
      overlay.classList.add('hidden');
    }
  },true);
})();