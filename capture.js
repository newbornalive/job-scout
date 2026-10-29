// Runs inside the LinkedIn tab. Require both the selected job ID and changed
// detail content before accepting a new JD, to avoid pairing adjacent jobs.
async function captureJobDetail(jobId) {
  const pick=selectors=>{for(const s of selectors){const e=document.querySelector(s);if(e?.innerText.trim())return e.innerText.trim();}return '';};
  const read=()=>({title:pick(['.job-details-jobs-unified-top-card__job-title','.jobs-unified-top-card__job-title','h1']),company:pick(['.job-details-jobs-unified-top-card__company-name','.jobs-unified-top-card__company-name']),location:pick(['.job-details-jobs-unified-top-card__primary-description-container .tvm__text--low-emphasis','.job-details-jobs-unified-top-card__bullet','.jobs-unified-top-card__bullet']),jd:pick(['#job-details','.jobs-description__content','.jobs-description-content__text'])});
  const selectedId=()=>new URL(location.href).searchParams.get('currentJobId')||location.pathname.match(/\/jobs\/view\/(\d+)/)?.[1];
  const before=read();const alreadySelected=selectedId()===jobId;
  const link=[...document.querySelectorAll('a[href*="/jobs/view/"]')].find(a=>a.href.match(/\/jobs\/view\/(\d+)/)?.[1]===jobId);
  if(!alreadySelected){if(!link)return {error:'The job card is no longer on the page. Scan again.'};link.click();}
  let stable='';let stableSince=0;
  const deadline=Date.now()+12000;
  while(Date.now()<deadline){
    await new Promise(r=>setTimeout(r,300));
    const expand=document.querySelector('.jobs-description__footer-button');
    if(expand && /show more|see more|显示更多|展开/i.test(expand.innerText))expand.click();
    const data=read();
    if(selectedId()!==jobId || !data.title || data.jd.length<80 || (!alreadySelected && data.jd===before.jd)){stable='';continue;}
    const signature=data.title+'\n'+data.jd;
    if(signature!==stable){stable=signature;stableSince=Date.now();continue;}
    if(Date.now()-stableSince>=900){
      const pendingExpand=document.querySelector('.jobs-description__footer-button');
      const jdComplete=!(pendingExpand && /show more|see more|显示更多|展开/i.test(pendingExpand.innerText));
      const apply=document.querySelector('a.jobs-apply-button[href], .jobs-apply-button--top-card a[href], a[data-control-name="jobdetails_topcard_inapply"][href]');
      const applicationUrl=apply?.href||'';
      return {...data,jdComplete,applicationUrl,url:'https://www.linkedin.com/jobs/view/'+jobId+'/'};
    }
  }
  return {error:'The description did not load or could not be matched to this job. Analysis remains pending.'};
}

