renderSourceContactCard=function(p){
  const current=personSellStage(p),idx=SELL_PIPELINE.indexOf(current),task=latestPersonTask(p.id),deals=sourceDeals(p.id),atReceived=current==='Opportunity Received';
  return `<article class="pipelinePerson sourceCard" data-pipeline-person="${p.id}"><div class="pipelinePersonName">${esc(p.name)}</div><div class="pipelinePersonMeta">${esc(p.type||'Sell-Side Partner')}</div><span class="modelBadge">Multi-Deal Source</span>${taskSnippet(task)}${atReceived?`<div class="sourceDealCount">${deals.length} tracked opportunit${deals.length===1?'y':'ies'} from this source</div>`:''}<div class="pipelinePersonActions pipelineDirectActions"><button type="button" class="miniAction" data-add-task="${p.id}">+ Next Step</button>${atReceived?`<button type="button" class="pipelineAdvance" data-add-source-deal="${p.id}">Advance →</button>`:idx>=0&&idx<sellOpportunityReceivedIndex()?`<button type="button" class="pipelineAdvance" data-advance-person="${p.id}">Advance →</button>`:''}</div></article>`;
};
openSourceDealModal=function(personId){const p=person(personId);if(!p)return;$('sourceDealForm').reset();$('sourceDealPersonId').value=p.id;$('sourceDealPersonName').value=p.name;$('sourceDealModalTitle').textContent=`Add Opportunity · ${p.name}`;const note=$('sourceDealForm').querySelector('.typeExplain');if(note)note.textContent=`${p.name} will stay in Opportunity Received. This opportunity will begin in Opportunity Received and move independently from there.`;$('sourceDealModal').classList.remove('hidden')};
saveSourceDeal=async function(e){e.preventDefault();const personId=$('sourceDealPersonId').value,p=person(personId),name=$('sourceDealName').value.trim(),size=$('sourceDealSize').value.trim();if(!p||!name||!size)return;const payload={person_id:personId,title:name,side:'Sell Side',owner_name:userOwnerName(),stage:'Opportunity Received',priority:'Medium',opportunity_size:size,sector:'',next_step:'',next_step_owner:userOwnerName(),notes:`Sourced by ${p.name}`,pipeline_stage:'Opportunity Received',pipeline_active:true,created_by:currentUser?.id||null};const {error}=await sb.from('opportunities').insert(payload);if(error){alert(error.message);return}$('sourceDealModal').classList.add('hidden');await loadData()};
if(document.readyState!=='loading'){$('sourceDealForm').onsubmit=saveSourceDeal;if(typeof currentUser!=='undefined'&&currentUser)renderAll();}
(function(){
  const loadProfileModalFix=()=>{
    if(document.querySelector('script[src="/profile-modal-flow-fix.js"]'))return;
    const m=document.createElement('script');m.src='/profile-modal-flow-fix.js';m.async=false;document.body.appendChild(m);
  };
  const loadRefinements=()=>{
    if(document.querySelector('script[src="/pipeline-refinements.js"]')){loadProfileModalFix();return;}
    const x=document.createElement('script');x.src='/pipeline-refinements.js';x.async=false;x.onload=()=>{if(typeof currentUser!=='undefined'&&currentUser)renderAll();loadProfileModalFix();};document.body.appendChild(x);
  };
  const loadDocumentProfiles=()=>{
    if(!document.querySelector('link[href="/document-profiles.css"]')){const l=document.createElement('link');l.rel='stylesheet';l.href='/document-profiles.css';document.head.appendChild(l)}
    if(document.querySelector('script[src="/document-profiles.js"]')){loadRefinements();return;}
    const d=document.createElement('script');d.src='/document-profiles.js';d.async=false;d.onload=()=>{if(typeof currentUser!=='undefined'&&currentUser)loadData();loadRefinements();};document.body.appendChild(d);
  };
  const loadPipelineFix=()=>{
    if(document.querySelector('script[src="/pipeline-display-fix.js"]')){loadDocumentProfiles();return;}
    const f=document.createElement('script');f.src='/pipeline-display-fix.js';f.async=false;f.onload=loadDocumentProfiles;document.body.appendChild(f);
  };
  const loadSwitches=()=>{
    if(document.querySelector('script[src="/section-side-switches.js"]')){loadPipelineFix();return;}
    const v=document.createElement('script');v.src='/section-side-switches.js';v.async=false;v.onload=()=>{if(typeof currentUser!=='undefined'&&currentUser)renderAll();loadPipelineFix();};document.body.appendChild(v);
  };
  if(document.querySelector('script[src="/next-step-sync.js"]')){loadSwitches();return;}
  const s=document.createElement('script');s.src='/next-step-sync.js';s.async=false;s.onload=()=>{if(typeof currentUser!=='undefined'&&currentUser)renderAll();loadSwitches();};document.body.appendChild(s);
})();