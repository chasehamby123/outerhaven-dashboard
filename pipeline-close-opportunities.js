(function(){
  if(window.__outerhavenPipelineCloseOpportunities)return;
  window.__outerhavenPipelineCloseOpportunities=true;

  const hiddenPeople=new Set();
  const hiddenOpportunities=new Set();
  let syncing=false;

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

  function patchAIQuickAdd(){
    if(typeof window.parseEntry!=='function'||window.parseEntry.__outerhavenFamilyOfficeBuySide)return;
    const base=window.parseEntry;
    const wrapped=function(entry){
      const parsed=base(entry);
      if(/\bfam(?:ily|ly)[\s-]+offices?\b/i.test(String(entry||''))){
        parsed.side='Buy Side';
        parsed.type='Family Office';
      }
      return parsed;
    };
    wrapped.__outerhavenFamilyOfficeBuySide=true;
    window.parseEntry=wrapped;
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

  function removeHiddenCards(){
    const board=document.getElementById('relationshipPipeline');
    if(!board)return;
    board.querySelectorAll('[data-pipeline-person]').forEach(card=>{
      if(hiddenPeople.has(card.dataset.pipelinePerson))card.remove();
    });
    board.querySelectorAll('[data-pipeline-deal]').forEach(card=>{
      if(hiddenOpportunities.has(card.dataset.pipelineDeal))card.remove();
    });
  }

  function addCloseButtons(){
    const board=document.getElementById('relationshipPipeline');
    if(!board)return;
    removeHiddenCards();

    board.querySelectorAll('[data-pipeline-person]').forEach(card=>{
      const id=card.dataset.pipelinePerson;
      if(!id||hiddenPeople.has(id)||card.querySelector('[data-close-pipeline-person]'))return;
      card.appendChild(makeCloseButton('person',id));
    });

    board.querySelectorAll('[data-pipeline-deal]').forEach(card=>{
      const id=card.dataset.pipelineDeal;
      if(!id||hiddenOpportunities.has(id)||card.querySelector('[data-close-pipeline-opportunity]'))return;
      card.appendChild(makeCloseButton('opportunity',id));
    });
  }

  async function syncHiddenRecords(){
    if(syncing||typeof sb==='undefined')return;
    syncing=true;
    try{
      const [p,o]=await Promise.all([
        sb.from('people').select('id,pipeline_active').eq('pipeline_active',false),
        sb.from('opportunities').select('id,pipeline_active').eq('pipeline_active',false)
      ]);
      if(!p.error){hiddenPeople.clear();(p.data||[]).forEach(r=>hiddenPeople.add(String(r.id)))}
      if(!o.error){hiddenOpportunities.clear();(o.data||[]).forEach(r=>hiddenOpportunities.add(String(r.id)))}
      removeHiddenCards();
      addCloseButtons();
    }finally{syncing=false}
  }

  async function closeRecord(button){
    if(button.disabled)return;
    const personId=button.dataset.closePipelinePerson;
    const opportunityId=button.dataset.closePipelineOpportunity;
    const id=personId||opportunityId;
    if(!id)return;

    button.disabled=true;
    const card=button.closest('[data-pipeline-person],[data-pipeline-deal]');
    const table=personId?'people':'opportunities';
    const {error}=await sb.from(table).update({pipeline_active:false}).eq('id',id);
    if(error){
      alert(error.message);
      button.disabled=false;
      return;
    }

    if(personId)hiddenPeople.add(String(id));
    else hiddenOpportunities.add(String(id));
    if(card)card.remove();

    if(typeof window.__outerhavenRefreshDashboardMetrics==='function')window.__outerhavenRefreshDashboardMetrics();
    if(typeof loadData==='function')await loadData();
    removeHiddenCards();
  }

  document.addEventListener('click',function(e){
    const button=e.target.closest('[data-close-pipeline-person],[data-close-pipeline-opportunity]');
    if(!button)return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    closeRecord(button);
  },true);

  const observer=new MutationObserver(()=>addCloseButtons());
  function install(){
    patchAIQuickAdd();
    const board=document.getElementById('relationshipPipeline');
    if(board)observer.observe(board,{childList:true,subtree:true});
    addCloseButtons();
    syncHiddenRecords();
    setInterval(()=>{patchAIQuickAdd();syncHiddenRecords()},30000);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
