(function(){
if(window.__outerhavenNoProspFollowups)return;window.__outerhavenNoProspFollowups=true;
let timer=null;
const style=document.createElement('style');style.textContent='.ops4Metrics{grid-template-columns:repeat(4,minmax(0,1fr))!important}@media(max-width:1000px){.ops4Metrics{grid-template-columns:repeat(2,1fr)!important}}';document.head.appendChild(style);
function apply(){
  const root=document.getElementById('dailyOpsRoot');if(!root)return;
  root.querySelector('[data-tab="followups"]')?.remove();
  [...root.querySelectorAll('.ops4Metric')].forEach(card=>{if(card.querySelector('span')?.textContent?.trim()==='Follow Ups Due')card.remove()});
  [...root.querySelectorAll('.ops4Card')].forEach(card=>{const chip=card.querySelector('.ops4Chip')?.textContent?.trim().toLowerCase();if(chip==='follow up')card.remove()});
  [...root.querySelectorAll('.ops4Panel')].forEach(panel=>{
    if(panel.querySelector('h3')?.textContent?.trim()==='People to Follow Up')panel.remove();
  });
  const attention=[...root.querySelectorAll('.ops4Panel')].find(p=>p.querySelector('h3')?.textContent?.trim()==='Attention Queue');
  if(attention){const list=attention.querySelector('.ops4List');if(list&&!list.children.length)list.innerHTML='<div class="ops4Empty">Nothing urgent. Keep the schedule moving.</div>'}
}
function schedule(){clearTimeout(timer);timer=setTimeout(apply,35)}
function install(){const root=document.getElementById('dailyOpsRoot');if(root)new MutationObserver(schedule).observe(root,{childList:true,subtree:true});schedule()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
