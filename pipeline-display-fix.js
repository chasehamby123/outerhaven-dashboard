(function(){
  function install(){
    if(window.__outerhavenPipelineDisplayFix)return;
    if(!window.__outerhavenSectionSideSwitches||typeof renderPipeline!=='function'||typeof renderAll!=='function'||typeof peopleForPipeline!=='function'){
      setTimeout(install,50);return;
    }
    window.__outerhavenPipelineDisplayFix=true;

    peopleForPipeline=function(side){
      return (state.people||[]).filter(p=>p.side===side||p.side==='Both');
    };

    const baseRenderAll=renderAll;
    renderAll=function(){
      const selectedPipelineSide=pipelineSide;
      baseRenderAll();
      pipelineSide=selectedPipelineSide;
      renderPipeline();
    };

    const role=$('roleFilter');
    if(role){
      role.addEventListener('change',()=>{
        setTimeout(()=>renderPipeline(),0);
      });
    }

    renderPipeline();
  }
  install();
})();