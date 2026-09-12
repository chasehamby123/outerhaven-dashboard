(function(){
  if(window.__outerhavenOutputRoleCopyV1)return;
  window.__outerhavenOutputRoleCopyV1=true;
  function apply(){
    document.querySelectorAll('.v17Panel').forEach(panel=>{
      const eye=panel.querySelector('.eyebrow');
      if(eye?.textContent?.trim()==='INVESTOR MATERIALS'){
        const h=panel.querySelector('.v17Head h3'),p=panel.querySelector('.v17Head p');
        if(h)h.textContent='Four materials, four different jobs';
        if(p)p.textContent='Each output is designed for a different stage of the investor process, not a reshuffle of the same deal summary.';
        panel.querySelectorAll('.v17Output').forEach(card=>{
          const title=card.querySelector('h4'),copy=card.querySelector('p');if(!title||!copy)return;
          const t=title.textContent.trim();
          if(t==='Investor Teaser')copy.textContent='Why the opportunity deserves a second look: key economics, validation and de-risking.';
          else if(t==='Investment Memorandum')copy.textContent='How the investment works: business or asset, market, underwriting, capital plan, execution and risk.';
          else if(t==='Capital Summary'||t==='Capital & Transaction Summary'){title.textContent='Capital & Transaction Summary';copy.textContent='Where the money sits: sources, uses, ownership, debt, sponsor alignment and transaction economics.';}
          else if(t==='Diligence Package')copy.textContent='What investors need to verify: transaction-specific evidence and priority underwriting workstreams.';
        });
      }
    });
  }
  [0,250,700,1400,2400].forEach(ms=>setTimeout(apply,ms));
  document.addEventListener('click',()=>setTimeout(apply,120),true);
  document.addEventListener('change',e=>{if(e.target?.id==='capitalDealSelect')setTimeout(apply,250)},true);
})();