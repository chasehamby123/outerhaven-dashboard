(function(){
  if(window.__outerhavenOpportunityDocumentDetail)return;
  window.__outerhavenOpportunityDocumentDetail=true;

  const DOCUMENT_BUCKET='outerhaven-documents';
  const ORIGINATOR_BUCKET='originator-documents';

  function ensureStyles(){
    if(document.getElementById('opportunityDocumentDetailStyles'))return;
    const style=document.createElement('style');
    style.id='opportunityDocumentDetailStyles';
    style.textContent=`
      .oppDocStatus{font-size:13px;color:#6b7280;margin-top:7px}
      .oppDocFrameWrap{margin-top:12px;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;background:#f8fafc}
      .oppDocFrame{display:block;width:100%;height:520px;border:0;background:#fff}
      .oppDocFileRow{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 0;border-top:1px solid #edf0f3}
      .oppDocFileRow:first-child{border-top:0}
      .oppDocFileName{font-weight:700;word-break:break-word}
      .oppDocFileMeta{font-size:12px;color:#6b7280;margin-top:3px}
      .oppDocOpen{display:inline-flex;align-items:center;justify-content:center;text-decoration:none;white-space:nowrap}
      .originatorMatch{margin-top:12px;border:1px solid #e5e7eb;border-radius:10px;padding:10px 12px;background:#f8fafc}
      .originatorMatch strong{font-size:18px}.originatorMatch span{font-size:11px;color:#6b7280;margin-left:6px}.originatorMatch p{font-size:12px;color:#6b7280;margin:5px 0 0;line-height:1.45}
      @media(max-width:760px){.oppDocFrame{height:420px}.oppDocFileRow{align-items:flex-start;flex-direction:column}}
    `;
    document.head.appendChild(style);
  }

  function humanFileSize(n){
    if(!n)return'';
    if(n<1024)return`${n} B`;
    if(n<1048576)return`${(n/1024).toFixed(1)} KB`;
    return`${(n/1048576).toFixed(1)} MB`;
  }

  function docTypeLabel(type){
    if(type==='one_pager')return'One-Pager';
    if(type==='full_opportunity')return'Full Opportunity';
    if(type==='thesis')return'Thesis Document';
    if(type==='supporting_material')return'Supporting Material';
    return'Document';
  }

  async function signedDocument(doc){
    const bucket=doc.__bucket||DOCUMENT_BUCKET;
    const {data,error}=await sb.storage.from(bucket).createSignedUrl(doc.storage_path,3600);
    return {...doc,signedUrl:error?null:data?.signedUrl||null,signedError:error?.message||''};
  }

  function documentRows(docs){
    if(!docs.length)return'<div class="oppDocStatus">No additional documents attached.</div>';
    return docs.map(d=>`<div class="oppDocFileRow"><div><div class="oppDocFileName">${esc(d.file_name||'Document')}</div><div class="oppDocFileMeta">${esc(docTypeLabel(d.document_type))}${d.__originator?` · Originator Portal`:''}${d.file_size?` · ${esc(humanFileSize(d.file_size))}`:''}</div></div>${d.signedUrl?`<a class="ghost oppDocOpen" href="${esc(d.signedUrl)}" target="_blank" rel="noopener noreferrer">Open file</a>`:`<span class="oppDocStatus">${esc(d.signedError||'Unable to open')}</span>`}</div>`).join('');
  }

  function onePagerSection(onePager){
    if(!onePager){
      return `<section class="detailSec"><div class="detailTitle">ONE-PAGER</div><div class="oppDocStatus">No one-pager attached to this opportunity.</div></section>`;
    }
    const mime=String(onePager.mime_type||'').toLowerCase();
    const name=String(onePager.file_name||'').toLowerCase();
    const isPdf=mime.includes('pdf')||name.endsWith('.pdf');
    const source=onePager.__originator?' · Submitted through Originator Portal':'';
    if(!onePager.signedUrl){
      return `<section class="detailSec"><div class="detailTitle">ONE-PAGER</div><div class="oppDocFileName">${esc(onePager.file_name||'One-Pager')}</div><div class="oppDocStatus">${esc(onePager.signedError||'Unable to load this document.')}${esc(source)}</div></section>`;
    }
    if(isPdf){
      return `<section class="detailSec"><div class="detailTitle">ONE-PAGER</div><div class="oppDocFileName">${esc(onePager.file_name||'One-Pager')}</div><div class="oppDocStatus">Attached to this opportunity${esc(source)}</div><div class="oppDocFrameWrap"><iframe class="oppDocFrame" src="${esc(onePager.signedUrl)}#view=FitH" title="${esc(onePager.file_name||'One-Pager PDF')}"></iframe></div><div style="margin-top:10px"><a class="ghost oppDocOpen" href="${esc(onePager.signedUrl)}" target="_blank" rel="noopener noreferrer">Open PDF in new tab</a></div></section>`;
    }
    return `<section class="detailSec"><div class="detailTitle">ONE-PAGER</div><div class="oppDocFileName">${esc(onePager.file_name||'One-Pager')}</div><div class="oppDocStatus">Attached to this opportunity${esc(source)}</div><div style="margin-top:10px"><a class="ghost oppDocOpen" href="${esc(onePager.signedUrl)}" target="_blank" rel="noopener noreferrer">Open document</a></div></section>`;
  }

  async function documentsForOpportunity(opportunityId){
    const [profileRes,submissionRes]=await Promise.all([
      sb.from('profile_documents').select('id,opportunity_id,document_type,file_name,storage_path,mime_type,file_size,created_at').eq('opportunity_id',opportunityId).order('created_at',{ascending:false}),
      sb.from('originator_submissions').select('id,match_score,match_explanation,status').eq('internal_opportunity_id',opportunityId).maybeSingle()
    ]);
    if(profileRes.error)throw profileRes.error;
    if(submissionRes.error)throw submissionRes.error;
    const profileDocs=(profileRes.data||[]).map(d=>({...d,__bucket:DOCUMENT_BUCKET,__originator:false}));
    let originatorDocs=[];
    if(submissionRes.data?.id){
      const r=await sb.from('originator_documents').select('id,submission_id,document_type,file_name,storage_path,mime_type,file_size,created_at').eq('submission_id',submissionRes.data.id).order('created_at',{ascending:false});
      if(r.error)throw r.error;
      originatorDocs=(r.data||[]).map(d=>({...d,__bucket:ORIGINATOR_BUCKET,__originator:true}));
    }
    const docs=await Promise.all([...profileDocs,...originatorDocs].map(signedDocument));
    docs.sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||'')));
    return {docs,submission:submissionRes.data||null};
  }

  openDetail=async function(id){
    const o=state.opportunities.find(x=>x.id===id);if(!o)return;
    selectedId=id;
    const p=person(o.contactId);
    ensureStyles();
    $('detailEyebrow').textContent=`${o.side} · ${o.stage}`;
    $('detailTitle').textContent=o.company;
    $('drawerBody').innerHTML=`<section class="detailSec"><div class="detailTitle">CONTACT</div><div class="detailGrid"><div class="detailItem"><div class="l">Person</div><div class="v">${esc(p?.name||'Unassigned')}</div></div><div class="detailItem"><div class="l">Relationship</div><div class="v">${esc(p?.type||'Not specified')}</div></div><div class="detailItem"><div class="l">LinkedIn Access</div><div class="v">${p?.hasLinkedIn?'Yes':'No'}</div></div><div class="detailItem"><div class="l">Thesis</div><div class="v">${esc(p?.thesis||'Not collected yet')}</div></div></div></section><section class="detailSec"><div class="detailTitle">OPPORTUNITY</div><div class="detailGrid"><div class="detailItem"><div class="l">Owner</div><div class="v">${esc(o.owner||'Unassigned')}</div></div><div class="detailItem"><div class="l">Priority</div><div class="v">${esc(o.priority)}</div></div><div class="detailItem"><div class="l">Size</div><div class="v">${esc(o.size||'Not specified')}</div></div><div class="detailItem"><div class="l">Sector / Type</div><div class="v">${esc(o.sector||'Not specified')}</div></div></div><div id="originatorMatchMount"></div></section><section class="detailSec"><div class="detailTitle">ONE-PAGER</div><div class="oppDocStatus">Loading attached document...</div></section><section class="detailSec"><div class="detailTitle">NEXT STEP</div><div class="nextBox"><div class="nextCopy">${esc(o.next||'No next step assigned')}</div></div></section><section class="detailSec"><div class="detailTitle">NOTES</div><div>${esc(o.notes||'No notes.')}</div></section>`;
    $('overlay').classList.remove('hidden');
    $('drawer').classList.remove('hidden');

    try{
      const result=await documentsForOpportunity(id);
      if(selectedId!==id)return;
      const docs=result.docs;
      const onePager=docs.find(d=>d.document_type==='one_pager')||null;
      const others=docs.filter(d=>d.id!==onePager?.id);
      const body=$('drawerBody');
      if(!body)return;
      const matchMount=document.getElementById('originatorMatchMount');
      if(matchMount&&result.submission){
        matchMount.innerHTML=`<div class="originatorMatch"><strong>${Number(result.submission.match_score||0)}%</strong><span>Originator thesis match · ${esc(result.submission.status||'Received')}</span><p>${esc(result.submission.match_explanation||'Match explanation pending.')}</p></div>`;
      }
      const loadingSection=[...body.querySelectorAll('.detailSec')].find(s=>s.querySelector('.detailTitle')?.textContent==='ONE-PAGER');
      if(loadingSection)loadingSection.outerHTML=onePagerSection(onePager)+(others.length?`<section class="detailSec"><div class="detailTitle">OTHER DOCUMENTS</div>${documentRows(others)}</section>`:'');
    }catch(err){
      if(selectedId!==id)return;
      const body=$('drawerBody');if(!body)return;
      const loadingSection=[...body.querySelectorAll('.detailSec')].find(s=>s.querySelector('.detailTitle')?.textContent==='ONE-PAGER');
      if(loadingSection)loadingSection.innerHTML=`<div class="detailTitle">ONE-PAGER</div><div class="oppDocStatus">Could not load attached documents: ${esc(err?.message||String(err))}</div>`;
    }
  };
})();
