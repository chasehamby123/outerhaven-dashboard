(function(){
  if(window.__outerhavenWalkthroughTuning)return;
  window.__outerhavenWalkthroughTuning=true;

  const style=document.createElement('style');
  style.textContent=`
    .owOverlay{background:rgba(17,19,24,.46)!important}
    @media(min-width:761px){
      .owCard{width:min(430px,calc(100vw - 60px))!important;left:auto!important;right:18px!important;top:18px!important;bottom:auto!important;transform:none!important;max-height:calc(100vh - 36px)!important}
      .owCard.owDockLeft{left:18px!important;right:auto!important}
    }
  `;
  document.head.appendChild(style);

  const exactReplacements=new Map([
    ['Submit Opportunity is where you send a deal to Outerhaven.','Submit Opportunity is where you send a deal to investors.'],
    ['Buyer Thesis shows what our capital network is currently looking for.','Buyer Thesis shows what investors in our network are currently looking for.'],
    ['1. Check the Buyer Thesis before sending a deal','1. Check the Buyer Thesis before sending a deal to investors'],
    ['Submit Opportunity: send us a deal','Submit Opportunity: send a deal to investors'],
    ['Buyer Thesis: see what fits our network','Buyer Thesis: see what fits our investor network'],
    ['Submit the opportunity to Outerhaven only when the diligence step is complete.','Send the opportunity to investors only when the diligence step is complete.']
  ]);

  function rewriteNode(root){
    if(!root)return;
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
    const nodes=[];
    while(walker.nextNode())nodes.push(walker.currentNode);
    for(const node of nodes){
      const replacement=exactReplacements.get(node.nodeValue);
      if(replacement)node.nodeValue=replacement;
    }
  }

  function tune(){
    const card=document.querySelector('.owCard');
    const label=document.querySelector('.owLiveLabel');
    const target=document.querySelector('.owTarget');
    rewriteNode(card);rewriteNode(label);
    if(card&&window.innerWidth>760){
      let dockLeft=false;
      if(target){
        const r=target.getBoundingClientRect();
        dockLeft=(r.left+r.width/2)>window.innerWidth*.58;
      }
      card.classList.toggle('owDockLeft',dockLeft);
    }
  }

  const observer=new MutationObserver(tune);
  observer.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['class']});
  window.addEventListener('resize',tune);
  window.addEventListener('scroll',tune,{passive:true});
  setInterval(tune,250);

  // Treat this as a new tutorial revision so users receive the side-docked,
  // investor-facing walkthrough once automatically.
  const refreshKey='outerhaven_originator_walkthrough_side_tune_v2';
  try{
    if(localStorage.getItem(refreshKey)!=='1'){
      localStorage.setItem(refreshKey,'1');
      setTimeout(()=>{
        tune();
        if(!document.querySelector('.owOverlay'))document.getElementById('owHelp')?.click();
      },900);
    }
  }catch{}
})();