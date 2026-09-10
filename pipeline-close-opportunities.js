(function(){
  if(window.__outerhavenPipelineCloseOpportunities)return;
  window.__outerhavenPipelineCloseOpportunities=true;

  const style=document.createElement('style');
  style.textContent=`
    #relationshipPipeline [data-pipeline-deal],
    #relationshipPipeline [data-pipeline-person]{position:relative}
    .pipelineCloseOpportunityBtn{
      position:absolute;
      top:7px;
      right:7px;
      width:20px;
      height:20px;
      padding:0;
      border:0;
      border-radius:5px;
      background:transparent;
      color:#9aa1ab;
      font-size:16px;
      font-weight:500;
      line-height:20px;
      text-align:center;
      cursor:pointer;
      z-index:6;
      transition:background .15s,color .15s;
    }
    .pipelineCloseOpportunityBtn:hover{background:#f1f3f5;color:#606975}
    .pipelineCloseOpportunityBtn:disabled{opacity:.45;cursor:wait}
    #relationshipPipeline [data-pipeline-person] .pipelinePersonName,
    #relationshipPipeline [data-pipeline-deal] .dealCardTitle{padding-right:22px}
  `;
  document.head.appendChild(style);

  function patchPipelineData(){
    if(typeof window.mapPerson==='function'&&!window.mapPerson.__outerhavenPipelineActivePatched){
      const base=window.mapPerson;
      const wrapped=function(r){
        const p=base(r);
        p.pipelineActive=r.pipeline_active!==false;
        return p;
      };
      wrapped.__outerhavenPipelineActivePatched=true;
      window.mapPerson=wrapped;
    }
    if(typeof window.peopleForPipeline==='function'&&!window.peopleForPipeline.__outerhavenPipelineActivePatched){
      const base=window.peopleForPipeline;
      const wrapped=function(side){
        return base(side).filter(p=>p.pipelineActive!==false);
      };
      wrapped.__outerhavenPipelineActivePatched=true;
      window.peopleForPipeline=wrapped;
    }
  }

  function makeCloseButton(kind,id){
    const button=document.createElement('button');
    button.type='button';
    button.className='pipelineCloseOpportunityBtn';
    if(kind==='person')button.dataset.closePipelinePerson=id;
    else button.dataset.closePipelineOpportunity=id;
    button.setAttribute('aria-label','Remove from active pipeline');
    button.title='Remove from active pipeline';
    button.textContent='×';
    return button;
  }

  function addCloseButtons(){
    patchPipelineData();
    const board=document.getElementById('relationshipPipeline');
    if(!board)return;

    board.querySelectorAll('[data-pipeline-person]').forEach(card=>{
      const id=card.dataset.pipelinePerson;
      if(!id||card.querySelector('[data-close-pipeline-person]'))return;
      card.appendChild(makeCloseButton('person',id));
    });

    board.querySelectorAll('[data-pipeline-deal]').forEach(card=>{
      const id=card.dataset.pipelineDeal;
      if(!id||card.querySelector('[data-close-pipeline-opportunity]'))return;
      card.appendChild(makeCloseButton('opportunity',id));
    });
  }

  async function closeRecord(button){
    if(button.disabled)return;
    const personId=button.dataset.closePipelinePerson;
    const opportunityId=button.dataset.closePipelineOpportunity;
    const id=personId||opportunityId;
    if(!id)return;

    button.disabled=true;
    const table=personId?'people':'opportunities';
    const {error}=await sb.from(table).update({pipeline_active:false}).eq('id',id);
    if(error){
      alert(error.message);
      button.disabled=false;
      return;
    }

    if(typeof window.__outerhavenRefreshDashboardMetrics==='function')window.__outerhavenRefreshDashboardMetrics();
    await loadData();
  }

  document.addEventListener('click',function(e){
    const button=e.target.closest('[data-close-pipeline-person],[data-close-pipeline-opportunity]');
    if(!button)return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    closeRecord(button);
  },true);

  const observer=new MutationObserver(addCloseButtons);
  function install(){
    patchPipelineData();
    const board=document.getElementById('relationshipPipeline');
    if(board)observer.observe(board,{childList:true,subtree:true});
    addCloseButtons();
    setInterval(()=>{patchPipelineData();addCloseButtons()},750);
    if(typeof currentUser!=='undefined'&&currentUser&&typeof loadData==='function')loadData();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
