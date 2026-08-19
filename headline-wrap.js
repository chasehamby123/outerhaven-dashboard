(function(){
  const selectors='h1,h2,.firmStatement,.capitalStatement';
  const connectors=/\b(a|an|and|as|at|by|for|from|in|into|of|on|or|the|to|with)\s+/gi;
  document.querySelectorAll(selectors).forEach(el=>{
    const walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);
    let node;
    while((node=walker.nextNode())){
      node.nodeValue=node.nodeValue.replace(connectors,(match,word)=>word+'\u00a0');
    }
  });
})();
