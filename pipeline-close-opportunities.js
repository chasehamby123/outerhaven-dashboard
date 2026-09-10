(function(){
  if(window.__outerhavenPipelineCloseOpportunities)return;
  window.__outerhavenPipelineCloseOpportunities=true;

  const style=document.createElement('style');
  style.textContent=`
    #relationshipPipeline [data-pipeline-deal]{position:relative}
    .pipelineCloseOpportunityBtn{
      position:absolute;
      top:8px;
      right:8px;
      width:22px;
      height:22px;
      padding:0;
      border:0;
      border-radius:6px;
      background:transparent;
      color:#9aa1ab;
      font-size:17px;
      font-weight:500;
      line-height:22px;
      text-align:center;
      cursor:pointer;
      z-index:3;
      transition:background .15s,color .15s;
    }
    .pipelineCloseOpportunityBtn:hover{background:#f1f3f5;color:#606975}
    .pipelineCloseOpportunityBtn:disabled{opacity:.45;cursor:wait}
  `;
  document.head.appendChild(style);

  function addCloseButtons(){
    const board=document.getElementById('relationshipPipeline');
    if(!board)return;
    board.querySelectorAll('[data-pipeline-deal]').forEach(card=>{
      const id=card.dataset.pipelineDeal;
      if(!id||card.querySelector('[data-close-pipeline-opportunity]'))return;
      const button=document.createElement('button');
      button.type='button';
      button.className='pipelineCloseOpportunityBtn';
      button.dataset.closePipelineOpportunity=id;
      button.setAttribute('aria-label','Remove opportunity from active pipeline');
      button.title='Remove from active pipeline';
      button.textContent='×';
      card.appendChild(button);
    });
  }

  async function closeOpportunity(button){
    if(button.disabled)return;
    const id=button.dataset.closePipelineOpportunity;
    if(!id)return;
    button.disabled=true;
    const {error}=await sb.from('opportunities').update({pipeline_active:false}).eq('id',id);
    if(error){
      alert(error.message);
      button.disabled=false;
      return;
    }
    if(typeof window.__outerhavenRefreshDashboardMetrics==='function')window.__outerhavenRefreshDashboardMetrics();
    await loadData();
  }

  document.addEventListener('click',function(e){
    const button=e.target.closest('[data-close-pipeline-opportunity]');
    if(!button)return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    closeOpportunity(button);
  },true);

  const observer=new MutationObserver(addCloseButtons);
  function install(){
    const board=document.getElementById('relationshipPipeline');
    if(board)observer.observe(board,{childList:true,subtree:true});
    addCloseButtons();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
