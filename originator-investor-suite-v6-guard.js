(function(){
  if(window.__outerhavenInvestorSuiteV6Guard)return;window.__outerhavenInvestorSuiteV6Guard=true;
  const sb=window.__OUTERHAVEN_ORIGINATOR_SB;if(!sb)return;
  const s=document.createElement('style');s.textContent='#dfyValuePanel{display:none!important}';document.head.appendChild(s);
  const filled=v=>String(v||'').trim().length>=8;
  document.addEventListener('click',async e=>{
    const btn=e.target.closest('[data-is6-build]');if(!btn)return;
    e.preventDefault();e.stopImmediatePropagation();
    if(btn.disabled)return;btn.disabled=true;
    try{
      const dealId=document.getElementById('capitalDealSelect')?.value;if(!dealId)throw new Error('Select an opportunity first.');
      const {data:{session}}=await sb.auth.getSession();if(!session)throw new Error('Session expired.');
      const {data:d,error:de}=await sb.from('deals').select('*').eq('id',dealId).maybeSingle();if(de)throw de;
      const intake={};document.querySelectorAll('[data-is6-field]').forEach(el=>intake[el.dataset.is6Field]=el.value.trim());
      const status={
        teaser:!!(d.deal_size&&d.sector&&d.geography&&(filled(intake.investment_thesis)||String(d.summary||'').length>120)),
        memo:!!(filled(intake.investment_thesis)&&filled(intake.transaction_rationale)&&filled(intake.use_of_proceeds)&&filled(intake.risks)),
        faq:!!(filled(intake.investment_thesis)&&filled(intake.use_of_proceeds)&&filled(intake.timeline)),
        transaction:!!(d.deal_size&&d.transaction_type&&filled(intake.transaction_rationale)),
        sources:!!(d.deal_size&&filled(intake.use_of_proceeds)),
        ownership:!!filled(intake.ownership),
        financial:!!(Number(d.revenue)>0||Number(d.ebitda)>0||filled(intake.historical_performance)||filled(intake.forecast)||filled(intake.noi)),
        risks:!!(filled(intake.risks)&&filled(intake.mitigants)),
        diligence_index:true,checklist:true
      };
      const now=new Date().toISOString(),assets={};Object.keys(status).forEach(k=>assets[k]={ready:!!status[k],updated_at:now});
      const {error}=await sb.from('deal_workspaces').upsert({deal_id:dealId,owner_id:session.user.id,intake,generated_assets:assets,updated_at:now},{onConflict:'deal_id'});if(error)throw error;
      await window.OuterHavenInvestorSuiteV6?.refresh();window.OuterHavenInvestorSuiteV6?.openBuilder();
    }catch(err){alert(err?.message||'Could not build the data room.')}finally{btn.disabled=false}
  },true);
})();