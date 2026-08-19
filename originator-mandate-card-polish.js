(function(){
  if(window.__outerhavenMandateCardPolish)return;
  window.__outerhavenMandateCardPolish=true;

  const style=document.createElement('style');
  style.textContent=`
    #networkMandateGrid .networkMandateCard{padding:13px 14px;background:#fbf8f3;border-color:#ddd0c0}
    #networkMandateGrid .networkMandateTop{align-items:flex-start;gap:14px}
    #networkMandateGrid .networkMandateTitle{font-size:12px;line-height:1.2;font-weight:900;color:#252019;letter-spacing:-.01em}
    #networkMandateGrid .mandateFocusTitle{margin-top:4px;font-size:8px;line-height:1.35;font-weight:760;color:#756657}
    #networkMandateGrid .networkMandateRange{display:flex;flex-direction:column;align-items:flex-end;gap:2px;text-align:right;min-width:82px}
    #networkMandateGrid .networkMandateRange span{font-size:6.5px;line-height:1;font-weight:900;letter-spacing:.08em;text-transform:uppercase;color:#9b8873}
    #networkMandateGrid .networkMandateRange strong{font-size:10px;line-height:1.15;font-weight:900;color:#4c4035}
    #networkMandateGrid .networkMandateRows{margin-top:11px;padding-top:9px;border-top:1px solid #e8ddd0;gap:6px}
    #networkMandateGrid .networkMandateRow{grid-template-columns:68px 1fr;gap:9px;align-items:start}
    #networkMandateGrid .networkMandateRow span{font-size:6.8px;letter-spacing:.075em;color:#978572}
    #networkMandateGrid .networkMandateRow b{font-size:8px;line-height:1.45;font-weight:750;color:#5d5146}
  `;
  document.head.appendChild(style);

  function polishCard(card){
    if(!card||card.dataset.mandatePolished==='1')return;
    const titleEl=card.querySelector('.networkMandateTitle');
    const rangeEl=card.querySelector('.networkMandateRange');
    const rows=[...card.querySelectorAll('.networkMandateRow')];
    if(!titleEl||!rangeEl||!rows.length)return;

    const raw=titleEl.textContent.trim();
    const parts=raw.split(/\s+—\s+/);
    const sector=(parts.shift()||raw).trim();
    const focus=parts.join(' — ').trim();
    const range=rangeEl.textContent.trim();

    titleEl.textContent=sector;
    if(focus&&!titleEl.parentElement.querySelector('.mandateFocusTitle')){
      titleEl.insertAdjacentHTML('afterend',`<div class="mandateFocusTitle"></div>`);
      titleEl.parentElement.querySelector('.mandateFocusTitle').textContent=focus;
    }
    rangeEl.innerHTML=`<span>Check Size</span><strong>${range}</strong>`;

    rows.forEach(row=>{
      const label=row.querySelector('span');
      if(!label)return;
      const key=label.textContent.trim().toLowerCase();
      if(key==='sector')label.textContent='Focus';
      if(key==='geography')label.textContent='Geography';
      if(key==='structure')label.textContent='Structure';
    });

    card.dataset.mandatePolished='1';
  }

  function polishAll(){document.querySelectorAll('#networkMandateGrid .networkMandateCard').forEach(polishCard)}

  const observer=new MutationObserver(()=>requestAnimationFrame(polishAll));
  function start(){
    const grid=document.getElementById('networkMandateGrid');
    if(grid){observer.observe(grid,{childList:true,subtree:true});polishAll();return}
    setTimeout(start,200);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
})();
