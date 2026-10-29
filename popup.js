const $=id=>document.getElementById(id);
let records=[];let analysis=null;
const params=new URLSearchParams(location.search);
async function sourceTab(){if(params.has('tab'))return chrome.tabs.get(Number(params.get('tab')));return (await chrome.tabs.query({active:true,currentWindow:true}))[0];}
function searchUrl(query){return 'https://www.linkedin.com/jobs/search/?keywords='+encodeURIComponent(query)+'&location=United%20States&f_TPR=r172800&sortBy=DD';}
const ready=chrome.storage.local.get({records:[]}).then(data=>{records=data.records.map(r=>({...r,status:JobEngine.normalizeStatus(r.status)}));render();});
function el(tag,text,cls){const e=document.createElement(tag);if(text)e.textContent=text;if(cls)e.className=cls;return e;}
function notify(t){$('notice').textContent=t;}
function appendResume(target,text,title,complete){
  const rec=JobEngine.recommendResume(text,title);
  target.append(el('h3',(complete?'Example resume category: ':'Preliminary suggestion (JD completeness unconfirmed): ')+(rec.primary?.name||'Undetermined')));
  if(rec.primary){
    target.append(el('p',rec.primary.file));
    target.append(el('p','Job evidence: '+[...rec.primary.titleHits,...rec.primary.hits].join(', ')));
    target.append(el('p','Example notes: '+rec.primary.evidence));
    if(rec.alternatives.length)target.append(el('p','Also consider: '+rec.alternatives.map(p=>p.name).join(' / ')));
  }
  target.append(el('p',rec.reason,'muted'));
}

function safeUrl(value){try{const u=new URL(value);return ['https:','http:'].includes(u.protocol)?u.href:'';}catch{return '';}}
function run(){const text=$('jd').value.trim();if(!text){notify('Read or paste a job description first.');return null;}analysis=JobEngine.analyze(text,$('title').value);const target=$('result');target.replaceChildren();const card=el('div',null,'card');card.append(el('h3',`Keyword coverage: ${$('jdComplete').checked?analysis.score+'%':'Pending (JD completeness unconfirmed)'} · ${analysis.tracks[0]?.name||'Review role fit manually'}`));card.append(el('p','Title screening: '+analysis.titleMatch.priority+' · '+(analysis.titleMatch.roles.join(' / ')||'No role match; review manually')));for(const e of analysis.evidence)card.append(el('p',e.role+' JD evidence: '+(e.hits.join(', ')||'No keyword evidence')));for(const c of analysis.titleMatch.cautions)card.append(el('p',c));card.append(el('p','Example vocabulary matches: '+(analysis.matched.join(', ')||'None identified')));card.append(el('p','Requirements to verify: '+(analysis.verify.join(', ')||'None identified; review the original description')));if(analysis.senior)card.append(el('p','Seniority terms found: keep the opportunity and review experience and responsibilities.'));card.append(el('h3','Explore related searches'));for(const q of analysis.queries){const a=el('a',q.query);a.href='https://www.linkedin.com/jobs/search/?keywords='+encodeURIComponent(q.query)+'&location=United%20States&f_TPR=r172800&sortBy=DD';a.target='_blank';a.rel='noopener';card.append(a,el('br'));}card.append(el('h3','Salary reference'));if(!analysis.salaries.length)card.append(el('p','No explicit salary range found; no value generated.'));for(const s of analysis.salaries)card.append(el('p',`${s.source} → midpoint USD ${s.midpoint.toLocaleString('en-US')} / ${s.unit==='year'?'year':s.unit==='hour'?'hour':'unit unconfirmed'}; ${s.type}. ${analysis.salaries.length>1?'Multiple ranges found; verify which applies.':''}`));card.append(el('p','Rule matching does not fully distinguish required, preferred, or negated qualifications.','muted'));appendResume(card,text,$('title').value,$('jdComplete').checked);target.append(card);return analysis;}
async function persist(){await chrome.storage.local.set({records});render();}
function render(){ $('count').textContent=records.length; $('records').replaceChildren();for(const r of JobEngine.sortRecords(records)){const c=el('div',null,'card');c.append(el('h3',`${r.title} · ${r.company||'Company not provided'}`));const tm=JobEngine.classifyTitle(r.title);c.append(el('p',tm.priority+' · '+(tm.roles.join(' / ')||'No role-family title match'),'muted'));if(r.captureError)c.append(el('p',r.captureError,'muted'));c.append(el('p','Location: '+(r.location||'Not provided')));const applicationUrl=safeUrl(r.applicationUrl);const url=applicationUrl||safeUrl(r.url);if(url){const a=el('a',applicationUrl?'Application URL ↗':'Apply via LinkedIn job page↗');a.href=url;a.target='_blank';a.rel='noopener';c.append(a);}const select=el('select');for(const value of ['To apply','Applied','Interviewing','Closed']){const o=el('option',value);o.value=value;select.append(o);}select.value=r.status;select.onchange=async()=>{r.status=select.value;await persist();};const del=el('button','Delete','delete');del.onclick=async()=>{records=records.filter(x=>x.id!==r.id);await persist();};const load=el('button','Load / API analysis');load.onclick=()=>{for(const field of ['title','company','url','location','applicationUrl','jd'])$(field).value=r[field]||'';$('jdComplete').checked=JobEngine.completeJD(r);run();$('apiSettings').open=true;$('apiSettings').scrollIntoView({behavior:'smooth'});};c.append(load,select,del,el('p',`Saved ${new Date(r.created).toLocaleDateString()} · ${JobEngine.completeJD(r)?'Keyword coverage '+JobEngine.matchPercent(r)+'%':'Incomplete or unconfirmed JD; coverage pending'}`,'muted'));appendResume(c,r.jd||'',r.title,JobEngine.completeJD(r));if(typeof appendAI==='function')appendAI(c,r);$('records').append(c);}}
$('analyze').onclick=run;
$('open').onclick=()=>chrome.tabs.create({url:'https://www.linkedin.com/jobs/search/?keywords=Data%20Scientist&location=United%20States&f_TPR=r172800&sortBy=DD'});
$('scan').onclick=async()=>{try{
  const tab=await sourceTab();const u=new URL(tab.url);
  if(u.hostname!=='www.linkedin.com'||!u.pathname.startsWith('/jobs'))throw Error('Open a LinkedIn Jobs detail page.');
  const jobId=u.searchParams.get('currentJobId')||u.pathname.match(/\/jobs\/view\/(\d+)/)?.[1];
  if(!jobId)throw Error('Select a job in the list first.');
  const [result]=await chrome.scripting.executeScript({target:{tabId:tab.id},func:captureJobDetail,args:[jobId]});
  const data=result.result;if(!data?.jd)throw Error(data?.error||'Job description not found');
  for(const key of ['title','company','jd','url','location','applicationUrl'])$(key).value=data[key]||'';
  $('jdComplete').checked=data.jdComplete===true;
  await ready;await $('save').onclick();
}catch(e){notify(e.message);}};
$('save').onclick=async()=>{await ready;const a=run();if(!a)return;if(!$('title').value.trim()){notify('Enter a job title.');return;}const url=safeUrl($('url').value);const match=url.match(/\/jobs\/view\/(\d+)/)||url.match(/[?&]currentJobId=(\d+)/);const key=match?'linkedin:'+match[1]:url?url.split('?')[0]:$('title').value.trim().toLowerCase()+'|'+$('company').value.trim().toLowerCase();const existing=records.find(r=>r.key===key);if(existing){Object.assign(existing,{title:$('title').value.trim(),company:$('company').value.trim()||existing.company,url,location:$('location').value.trim(),applicationUrl:safeUrl($('applicationUrl').value),jdComplete:$('jdComplete').checked,jd:$('jd').value,analysis:a,captureError:''});await persist();notify('Updated the saved description and analysis.');return;}records.unshift({id:crypto.randomUUID(),key,title:$('title').value.trim(),company:$('company').value.trim(),url,location:$('location').value.trim(),applicationUrl:safeUrl($('applicationUrl').value),jdComplete:$('jdComplete').checked,jd:$('jd').value,analysis:a,captureError:'',status:'To apply',created:new Date().toISOString()});await persist();notify('Saved in this browser.');};
function download(name,type,content){const url=URL.createObjectURL(new Blob([content],{type}));const a=el('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('export').onclick=()=>download('job-scout-jobs.json','application/json',JSON.stringify(JobEngine.sortRecords(records).map(r=>({...r,resumeRecommendation:JobEngine.recommendResume(r.jd||'',r.title),location:r.location||'',applicationUrl:safeUrl(r.applicationUrl)||safeUrl(r.url),applicationLinkSource:safeUrl(r.applicationUrl)?'apply-button':'linkedin-job-page',matchPercent:JobEngine.matchPercent(r),jdComplete:JobEngine.completeJD(r)})),null,2));
$('csv').onclick=()=>{const rows=[['Job title','Company','AI recommended resume','AI analysis','AI result freshness','Suggested resume','Alternative resumes','Resume routing evidence','Location / Address','Application URL','Link source','Job URL','Keyword coverage','Complete JD','Status','Saved date','Matched keywords','Skills to verify','Salary ranges and midpoints'],...JobEngine.sortRecords(records).map(r=>[r.title,r.company,r.aiAnalysis?.result.recommendedResume||'',r.aiAnalysis?JSON.stringify(r.aiAnalysis.result):'',r.aiAnalysis?(r.aiAnalysis.sourceJD!==r.jd||r.aiAnalysis.sourceTitle!==r.title?'JD changed':'Verify resume matches the analyzed version'):'',JobEngine.recommendResume(r.jd||'',r.title).primary?.name||'Undetermined',JobEngine.recommendResume(r.jd||'',r.title).alternatives.map(p=>p.name).join('; '),JobEngine.recommendResume(r.jd||'',r.title).primary?.hits.join('; ')||'',r.location||'Not provided',safeUrl(r.applicationUrl)||safeUrl(r.url),safeUrl(r.applicationUrl)?'Apply button':'LinkedIn job page',r.url,JobEngine.matchPercent(r)===null?'Pending':JobEngine.matchPercent(r)+'%',JobEngine.completeJD(r)?'Yes':'Unconfirmed',r.status,r.created,r.analysis.matched.join('; '),r.analysis.verify.join('; '),r.analysis.salaries.map(s=>`${s.source}: ${s.midpoint} USD/${s.unit}`).join('; ')])];const escape=v=>'"'+String(v).replace(/^[=+@-]/,"'$&").replaceAll('"','""')+'"';download('job-scout-jobs.csv','text/csv;charset=utf-8','\uFEFF'+rows.map(row=>row.map(escape).join(',')).join('\r\n'));};

$('batch').onclick=async()=>{try{
  const source=await sourceTab();
  if(!params.has('tab')){
    const u=new URL(source.url);
    if(u.hostname!=='www.linkedin.com'||!u.pathname.startsWith('/jobs'))throw Error('Open a LinkedIn Jobs search results page first.');
    await chrome.tabs.create({url:chrome.runtime.getURL('popup.html')+'?tab='+source.id+'&scan=1'});return;
  }
  $('batch').disabled=true;$('scan').disabled=true;
  await ready;
  const tab=await sourceTab();
  const u=new URL(tab.url);
  if(u.hostname!=='www.linkedin.com'||!u.pathname.startsWith('/jobs'))throw Error('Open a LinkedIn Jobs search results page first.');
  const [result]=await chrome.scripting.executeScript({target:{tabId:tab.id},func:()=>{
    const found=new Map();
    for(const link of document.querySelectorAll('a[href*="/jobs/view/"]')){
      const id=link.href.match(/\/jobs\/view\/(\d+)/)?.[1];
      if(!id)continue;
      const card=link.closest('li, .job-card-container, .base-card');
      const title=(link.querySelector('strong')?.innerText||link.innerText||link.getAttribute('aria-label')||'').trim().split('\n')[0];
      if(!title)continue;
      const company=(card?.querySelector('.artdeco-entity-lockup__subtitle, .job-card-container__primary-description, .base-search-card__subtitle')?.innerText||'').trim();
      const location=(card?.querySelector('.job-card-container__metadata-item, .artdeco-entity-lockup__caption, .job-search-card__location')?.innerText||'').trim();
      if(!found.has(id))found.set(id,{id,title,company,location,url:'https://www.linkedin.com/jobs/view/'+id+'/'});
    }
    return [...found.values()];
  }});
  const jobs=result.result||[];
  if(!jobs.length)throw Error('No job cards found. Wait for loading, scroll and retry, or open a job to read its details.');
  const candidates=jobs.filter(j=>JobEngine.classifyTitle(j.title).eligible);
  let completed=0,failed=0;
  for(let i=0;i<candidates.length;i++){
    const job=candidates[i],key='linkedin:'+job.id;
    let record=records.find(r=>r.key===key);
    if(record && !record.location)record.location=job.location||'';
    if(!record){record={id:crypto.randomUUID(),key,title:job.title,company:job.company,location:job.location||'',applicationUrl:'',jdComplete:false,url:job.url,jd:'',analysis:JobEngine.analyze('',job.title),status:'To apply',created:new Date().toISOString()};records.unshift(record);await persist();}
    notify(`Title screening ${candidates.length}/${jobs.length}; reading JD ${i+1}/${candidates.length}: ${job.title}`);
    try{
      const [detail]=await chrome.scripting.executeScript({target:{tabId:tab.id},func:captureJobDetail,args:[job.id]});
      const data=detail.result;
      if(!data?.jd)throw Error(data?.error||'Could not read the job description');
      // Card title is tied to the job ID; use it for title classification.
      Object.assign(record,{jd:data.jd,jdComplete:data.jdComplete===true,location:data.location||job.location||record.location||'',applicationUrl:safeUrl(data.applicationUrl)||record.applicationUrl||'',company:data.company||job.company,analysis:JobEngine.analyze(data.jd,job.title),captureError:data.jdComplete?'':'The description may be collapsed; verify completeness'});completed++;
    }catch(e){record.captureError=e.message;failed++;}
    await persist();
  }
  notify(`Done: scanned ${jobs.length} titles; relevant: ${candidates.length}; descriptions matched: ${completed}; capture failures: ${failed}. Unrelated: ${jobs.length-candidates.length} not saved. Only loaded cards were processed; scroll and scan again.`);
}catch(e){notify(e.message);}finally{$('batch').disabled=false;$('scan').disabled=false;}};

const table=el('table');
const head=el('tr');for(const label of ['Priority','Role family / Search','Examples and notes'])head.append(el('th',label));table.append(head);
for(const role of JobEngine.roles){const row=el('tr');row.append(el('td',role.priority));const name=el('td');const a=el('a',role.name);a.href=searchUrl(role.titles.map(t=>'"'+t+'"').join(' OR '));a.target='_blank';a.rel='noopener';name.append(a);row.append(name,el('td',role.reason+(role.caution?'; '+role.caution:'')));table.append(row);}$('role-table').append(table);
if(params.get('scan')==='1'){document.body.classList.add('workspace');ready.then(()=>$('batch').onclick());}

$('jd').addEventListener('input',()=>{$('jdComplete').checked=false;});

