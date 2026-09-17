(function(){
  if(window.__outerhavenRelatedMandates)return;window.__outerhavenRelatedMandates=true;
  const sb=window.__OUTERHAVEN_ORIGINATOR_SB,M=window.OuterHavenMatcher;
  if(!sb||!M)return;
  const $=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  function parseMoney(value){const raw=String(value||'').trim().toLowerCase().replace(/[$,\s]/g,'');const m=raw.match(/^(-?\d+(?:\.\d+)?)(k|m|b|thousand|million|billion)?$/i);if(!m)return Number(raw)||0;let n=Number(m[1]);const s=(m[2]||'').toLowerCase();if(s==='k'||s==='thousand')n*=1e3;if(s==='m'||s==='million')n*=1e6;if(s==='b'||s==='billion')n*=1e9;return Number.isFinite(n)?n:0}
  function formDeal(){return{deal_size:parseMoney($('dealAmount')?.value),ebitda:parseMoney($('dealEbitda')?.value),sector:$('dealSector')?.value||'',geography:$('dealGeography')?.value||'',transaction_type:$('dealType')?.value||''}}
  let boxes=[];
  async function load(){const {data,error}=await sb.from('buy_boxes').select('*').eq('published',true);if(!error)boxes=data||[];render()}
  function render(){
    const target=$('fitMatches'),score=$('estimateScore');if(!target||!score||score.textContent!=='0%'||!boxes.length)return;
    const d=formDeal();if(!d.deal_size||!d.sector||!d.geography||!d.transaction_type)return;
    const r=M.rank(d,boxes);if(r.eligible.length)return;
    const related=r.rejected.slice(0,3);
    if(!related.length)return;
    target.innerHTML=related.map(x=>{
      const fails=x.hardFail||[];
      const detail=(x.tests||[]).filter(t=>t[1]===false).map(t=>t[2]).join(' · ')||'Outside current mandate criteria';
      return `<div class="fitMatch"><strong>${esc(x.box.title)}</strong><span>Related only</span><small style="display:block;width:100%;margin-top:3px;color:#8a7f72;font-size:8px">Not eligible · ${esc(detail)}${fails.length?` · Fails: ${esc(fails.join(', '))}`:''}</small></div>`;
    }).join('');
  }
  ['dealAmount','dealEbitda','dealSector','dealGeography','dealType'].forEach(id=>{const el=$(id);if(el){el.addEventListener('input',()=>setTimeout(render,20));el.addEventListener('change',()=>setTimeout(render,20))}});
  const mo=new MutationObserver(()=>render());const panel=$('fitMatches')?.parentElement;if(panel)mo.observe(panel,{childList:true,subtree:true,characterData:true});
  load();setInterval(load,60000);
})();
