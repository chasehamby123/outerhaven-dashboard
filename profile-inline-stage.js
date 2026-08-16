(function(){
  if(window.__outerhavenProfileInlineStage)return;
  window.__outerhavenProfileInlineStage=true;

  const SELL_NDA_INTERNAL='NDA Signed + Buy-Side Thesis Shared';
  const OPPORTUNITY_START='Opportunity Received';

  const style=document.createElement('style');
  style.textContent=`
    .profileStageSelect{width:100%;border:0;background:transparent;color:inherit;font:inherit;font-weight:800;outline:none;cursor:pointer;padding:0 20px 0 0;appearance:auto}
    .profileSummaryBox.stageEditable{cursor:pointer}
    .profileSummaryBox.stageEditable .v{display:block}
    .profileStageSaving{opacity:.55;pointer-events:none}
  `;
  document.head.appendChild(style);

  function stageLabel(stage,side){return side==='Sell Side'&&stage===SELL_NDA_INTERNAL?'NDA Signed':stage}
  function opportunity(id){return (state.opportunities||[]).find(o=>o.id===id)}
  function isDirect(p){return !!p&&typeof isDirectSponsor==='function'&&isDirectSponsor(p)}

  function personStages(p){
    if(!p)return[];
    if(p.side==='Buy Side')return [...BUY_PIPELINE];
    if(isDirect(p))return [...SELL_PIPELINE];
    const end=SELL_PIPELINE.indexOf(OPPORTUNITY_START);
    return end>=0?SELL_PIPELINE.slice(0,end+1):[...SELL_PIPELINE];
  }

  function opportunityStages(o){
    const p=o?person(o.contactId):null;
    if(isDirect(p))return [...SELL_PIPELINE];
    const start=SELL_PIPELINE.indexOf(OPPORTUNITY_START);
    return start>=0?SELL_PIPELINE.slice(start):[...SELL_PIPELINE];
  }

  async function movePerson(id,target,select){
    const p=person(id);if(!p)return;
    select.classList.add('profileStageSaving');
    const {error}=await sb.from('people').update({pipeline_stage:target}).eq('id',id);
    if(error){alert(error.message);select.classList.remove('profileStageSaving');return}

    if(isDirect(p)){
      const linked=(state.opportunities||[]).find(o=>o.contactId===p.id&&o.side==='Sell Side'&&o.pipelineActive);
      if(linked){
        const res=await sb.from('opportunities').update({pipeline_stage:target,stage:target,pipeline_active:true}).eq('id',linked.id);
        if(res.error){alert(res.error.message);select.classList.remove('profileStageSaving');return}
      }
    }
    await loadData();
  }

  async function moveOpportunity(id,target,select){
    const o=opportunity(id);if(!o)return;
    const p=person(o.contactId);
    select.classList.add('profileStageSaving');
    const {error}=await sb.from('opportunities').update({pipeline_stage:target,stage:target,pipeline_active:true}).eq('id',id);
    if(error){alert(error.message);select.classList.remove('profileStageSaving');return}

    if(isDirect(p)){
      const res=await sb.from('people').update({pipeline_stage:target}).eq('id',p.id);
      if(res.error){alert(res.error.message);select.classList.remove('profileStageSaving');return}
    }
    await loadData();
  }

  function inject(){
    const overlay=document.getElementById('relationshipProfileOverlay');
    const body=document.getElementById('relationshipProfileBody');
    const ctx=window.__outerhavenProfileStageContext;
    if(!overlay||!body||overlay.classList.contains('hidden')||!ctx)return;

    const record=ctx.kind==='opportunity'?opportunity(ctx.id):person(ctx.id);
    const profileOwner=ctx.kind==='opportunity'?person(record?.contactId):record;
    const shownName=document.getElementById('relationshipProfileName')?.textContent?.trim();
    if(!record||!profileOwner)return;
    if(shownName&&shownName!==profileOwner.name){
      window.__outerhavenProfileStageContext=null;
      return;
    }

    const box=body.querySelector('.profileSummaryBox');
    if(!box)return;
    const key=`${ctx.kind}:${ctx.id}`;
    if(box.dataset.inlineStageKey===key&&box.querySelector('[data-inline-profile-stage]'))return;

    let current='',stages=[],side='Sell Side',label='Pipeline Stage';
    if(ctx.kind==='opportunity'){
      const o=record;
      side=o.side||'Sell Side';
      current=o.pipelineStage||o.stage||OPPORTUNITY_START;
      stages=opportunityStages(o);
      label='Opportunity Stage';
    }else{
      const p=record;
      side=p.side==='Buy Side'?'Buy Side':'Sell Side';
      current=side==='Sell Side'&&typeof personSellStage==='function'?personSellStage(p):normalizedStage(p,side);
      stages=personStages(p);
      label='Pipeline Stage';
    }

    box.dataset.inlineStageKey=key;
    box.classList.add('stageEditable');
    box.innerHTML=`<div class="k">${label}</div><div class="v"><select class="profileStageSelect" data-inline-profile-stage>${stages.map(stage=>`<option value="${esc(stage)}" ${stage===current?'selected':''}>${esc(stageLabel(stage,side))}</option>`).join('')}</select></div>`;
    const select=box.querySelector('[data-inline-profile-stage]');
    select.onchange=()=>ctx.kind==='opportunity'?moveOpportunity(ctx.id,select.value,select):movePerson(ctx.id,select.value,select);
  }

  window.__outerhavenRefreshProfileInlineStage=inject;

  const observer=new MutationObserver(()=>inject());
  function install(){
    const body=document.getElementById('relationshipProfileBody');
    if(body)observer.observe(body,{childList:true,subtree:true});
    const overlay=document.getElementById('relationshipProfileOverlay');
    if(overlay)observer.observe(overlay,{attributes:true,attributeFilter:['class']});
    inject();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
