(function(){
  if(window.OuterHavenMatcher?.version>=3)return;
  const norm=v=>String(v||'').trim().toLowerCase().replace(/&/g,' and ').replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();
  const has=(set,v)=>set.has(v);
  function sectorFamilies(v){
    const x=norm(v),s=new Set();
    if(/real estate|hospitality|hotel|resort|lodging|multifamily|self storage|net lease|mixed use|office|industrial real estate/.test(x))s.add('real_estate');
    if(/healthcare|medical|hospital|clinic|physician|biotech|life science|behavioral health/.test(x))s.add('healthcare');
    if(/software|technology|saas|cyber|artificial intelligence|\bai\b|semiconductor|electronics/.test(x))s.add('technology');
    if(/energy|power|utility|renewable|battery|midstream|water infrastructure/.test(x))s.add('energy_infrastructure');
    if(/data center|digital infrastructure|fiber|telecom/.test(x))s.add('digital_infrastructure');
    if(/industrial|manufactur|automation|packaging|building product|specialty chemical|distribution/.test(x))s.add('industrials');
    if(/financial service|fintech|insurance|specialty finance|asset management|wealth management|payments/.test(x))s.add('financial_services');
    if(/logistics|transportation|warehouse|freight|shipping/.test(x))s.add('logistics');
    if(/aerospace|defense|defence|aviation/.test(x))s.add('aerospace_defense');
    if(/mining|metal|critical mineral|natural resource|lithium|copper/.test(x))s.add('natural_resources');
    if(/consumer|restaurant|retail|franchise|food and beverage/.test(x))s.add('consumer');
    return s;
  }
  function subtypes(v){
    const x=norm(v),s=new Set();
    const map=[
      ['hospitality',/hospitality|hotel|resort|lodging/],['self_storage',/self storage/],['multifamily',/multifamily/],['net_lease',/net lease/],['industrial_re',/industrial real estate/],['office',/\boffice\b/],['mixed_use',/mixed use/],
      ['medical_devices',/medical device/],['healthcare_services',/healthcare services/],['behavioral_health',/behavioral health/],['physician_services',/physician services/],['biotech',/biotech|life science/],
      ['data_centers',/data center/],['cybersecurity',/cybersecurity|cyber security/],['vertical_software',/vertical software/],['semiconductors',/semiconductor/]
    ];
    for(const [k,re] of map)if(re.test(x))s.add(k);
    return s;
  }
  function sectorGate(deal,buyer){
    const b=norm(buyer),d=norm(deal);
    if(!b||/sector agnostic|all sectors|agnostic/.test(b))return{ok:true,score:30,label:'Sector agnostic'};
    const df=sectorFamilies(d),bf=sectorFamilies(b),family=[...df].some(x=>bf.has(x));
    if(!family)return{ok:false,score:0,label:'Sector mismatch'};
    const ds=subtypes(d),bs=subtypes(b);
    if(ds.size&&bs.size&&![...ds].some(x=>bs.has(x)))return{ok:false,score:0,label:'Subsector mismatch'};
    if(ds.size&&bs.size&&[...ds].some(x=>bs.has(x)))return{ok:true,score:40,label:'Subsector fit'};
    if(d&&b&&(d.includes(b)||b.includes(d)))return{ok:true,score:40,label:'Direct sector fit'};
    return{ok:true,score:34,label:'Sector family fit'};
  }
  function geo(v){
    const x=norm(v),countries=new Set(),regions=new Set();
    const c=[['indonesia',/\bindonesia\b|\bbali\b|\bjakarta\b/],['singapore',/\bsingapore\b/],['malaysia',/\bmalaysia\b|\bkuala lumpur\b/],['philippines',/\bphilippines\b|\bmanila\b/],['vietnam',/\bvietnam\b/],['thailand',/\bthailand\b/],['united_states',/united states|\busa\b|\bu s\b/],['canada',/\bcanada\b/],['united_kingdom',/united kingdom|\buk\b/],['germany',/\bgermany\b/],['switzerland',/\bswitzerland\b/],['austria',/\baustria\b/],['france',/\bfrance\b/],['spain',/\bspain\b/],['italy',/\bitaly\b/],['netherlands',/\bnetherlands\b/],['uae',/united arab emirates|\buae\b/],['saudi_arabia',/saudi arabia/],['india',/\bindia\b/],['japan',/\bjapan\b/],['south_korea',/south korea/],['australia',/\baustralia\b/],['mexico',/\bmexico\b/],['brazil',/\bbrazil\b/]];
    for(const [k,re] of c)if(re.test(x))countries.add(k);
    if(/southeast asia|south east asia|\basean\b/.test(x)||[...countries].some(k=>['indonesia','singapore','malaysia','philippines','vietnam','thailand'].includes(k)))regions.add('southeast_asia');
    if(/north america/.test(x)||[...countries].some(k=>['united_states','canada'].includes(k)))regions.add('north_america');
    if(/western europe|\beurope\b|european union/.test(x)||[...countries].some(k=>['united_kingdom','germany','switzerland','austria','france','spain','italy','netherlands'].includes(k)))regions.add('europe');
    if(/middle east|\bgcc\b|gulf cooperation/.test(x)||[...countries].some(k=>['uae','saudi_arabia'].includes(k)))regions.add('middle_east');
    if(/latin america|\blatam\b/.test(x)||[...countries].some(k=>['mexico','brazil'].includes(k)))regions.add('latin_america');
    return{countries,regions,global:/global|worldwide|all geographies/.test(x)};
  }
  function geoGate(deal,buyer){
    const d=geo(deal),b=geo(buyer);
    if(b.global||(!b.countries.size&&!b.regions.size))return{ok:true,score:10,label:'Global geography'};
    const country=[...d.countries].some(x=>b.countries.has(x));
    if(country)return{ok:true,score:15,label:'Country fit'};
    const region=[...d.regions].some(x=>b.regions.has(x));
    if(region)return{ok:true,score:13,label:'Regional fit'};
    return{ok:false,score:0,label:'Geography mismatch'};
  }
  function structures(v){
    const x=norm(v),s=new Set();
    if(/full or partial acquisition|acquisition|buyout|\bm a\b|merger|\bsale\b|divest/.test(x))s.add('m_and_a');
    if(/\bequity\b/.test(x))s.add('equity');
    if(/\bdebt\b|credit|loan/.test(x))s.add('debt');
    if(/structured|mezzanine|preferred/.test(x))s.add('structured');
    if(/joint venture|\bjv\b/.test(x))s.add('joint_venture');
    if(/strategic investment/.test(x))s.add('strategic');
    return{set:s,flex:/flexible|all structures|multiple structures/.test(x)};
  }
  function structureGate(deal,buyer){
    const d=structures(deal),b=structures(buyer);
    if(b.flex||!b.set.size)return{ok:true,score:12,label:'Flexible structure'};
    const overlap=[...d.set].some(x=>b.set.has(x));
    if(overlap)return{ok:true,score:20,label:'Structure fit'};
    return{ok:false,score:0,label:'Structure mismatch'};
  }
  function sizeGate(amount,min,max){
    amount=Number(amount||0);min=Number(min||0);max=Number(max||0);
    if(!min&&!max)return{ok:true,score:18,label:'Flexible size'};
    if(!amount)return{ok:false,score:0,label:'Size unknown'};
    if((!min||amount>=min)&&(!max||amount<=max))return{ok:true,score:25,label:'Inside target size'};
    if(min&&amount<min){const r=amount/min;if(r>=.75)return{ok:true,score:15,label:'Below target, near range'};if(r>=.5)return{ok:true,score:8,label:'Below target, stretch'};return{ok:false,score:0,label:'Too small'};}
    if(max&&amount>max){const r=amount/max;if(r<=1.25)return{ok:true,score:15,label:'Above target, near range'};if(r<=1.5)return{ok:true,score:8,label:'Above target, stretch'};return{ok:false,score:0,label:'Too large'};}
    return{ok:false,score:0,label:'Size mismatch'};
  }
  function score(deal,box){
    const size=sizeGate(deal.deal_size,box.min_size,box.max_size),sector=sectorGate(deal.sector,box.sector),geography=geoGate(deal.geography,box.geography),structure=structureGate(deal.transaction_type,box.transaction_type);
    const hard=[];if(!sector.ok)hard.push('Sector');if(!geography.ok)hard.push('Geography');if(!structure.ok)hard.push('Structure');if(!size.ok)hard.push('Size');
    let ebitda={ok:true,score:0,label:'No EBITDA minimum'};
    if(Number(box.min_ebitda||0)>0){const value=Number(deal.ebitda||0);if(!value)ebitda={ok:null,score:0,label:'EBITDA unknown'};else if(value>=Number(box.min_ebitda))ebitda={ok:true,score:0,label:'EBITDA clears minimum'};else{ebitda={ok:false,score:0,label:'EBITDA below minimum'};hard.push('EBITDA')}}
    const eligible=hard.length===0;
    let total=eligible?size.score+sector.score+geography.score+structure.score:0;
    if(eligible&&ebitda.ok===null)total=Math.min(total,64);
    total=Math.max(0,Math.min(100,Math.round(total)));
    return{score:total,eligible,hardFail:hard,components:{size,sector,geography,structure,ebitda},tests:[['Size',size.ok,size.label],['Sector',sector.ok,sector.label],['Geography',geography.ok,geography.label],['Structure',structure.ok,structure.label],...(Number(box.min_ebitda||0)>0?[['EBITDA',ebitda.ok,ebitda.label]]:[])]};
  }
  function rank(deal,boxes){
    const all=(boxes||[]).map(box=>({box,...score(deal,box)}));
    const eligible=all.filter(x=>x.eligible).sort((a,b)=>b.score-a.score||String(a.box.title).localeCompare(String(b.box.title)));
    const rejected=all.filter(x=>!x.eligible).sort((a,b)=>a.hardFail.length-b.hardFail.length||String(a.box.title).localeCompare(String(b.box.title)));
    return{eligible,rejected,all};
  }
  window.OuterHavenMatcher={version:3,norm,sectorFamilies,subtypes,geo,structures,score,rank};
})();