/* Only the local connection token reaches the extension. OpenAI keys stay in .env. */
const apiReady=Promise.all([
  chrome.storage.local.get({apiProfile:{resumes:{},preferences:''}}),
  chrome.storage.session.get({apiToken:''})
]).then(([local,session])=>{
  for(const name of ['DS','DA','Research'])$('resume'+name).value=local.apiProfile.resumes[name]||'';
  $('candidatePreferences').value=local.apiProfile.preferences||'';
  $('apiToken').value=session.apiToken;
});
function profileInput(){return {resumes:Object.fromEntries(['DS','DA','Research'].map(k=>[k,$('resume'+k).value.trim()])),preferences:$('candidatePreferences').value.trim()};}
async function saveApiSettings(){
  await chrome.storage.local.set({apiProfile:profileInput()});
  await chrome.storage.session.set({apiToken:$('apiToken').value.trim()});
}
function apiNotice(text){$('apiNotice').textContent=text;}
async function localRequest(path,body){
  const token=$('apiToken').value.trim();
  if(!token)throw Error('Enter JOB_SCOUT_TOKEN from your .env file, not the OpenAI API key.');
  const response=await fetch('http://127.0.0.1:43127'+path,{
    method:body?'POST':'GET',headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},
    ...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(100000)
  });
  const data=await response.json();if(!response.ok)throw Error(data.error||'The local API request failed.');return data;
}
function appendAI(target,record){
  const ai=record.aiAnalysis;if(!ai)return;
  const stale=ai.sourceJD!==record.jd||ai.sourceTitle!==record.title;
  const panel=el('details');panel.append(el('summary',`OpenAI analysis · ${ai.result.recommendedResume}${stale?' · JD changed; analyze again':''}`));
  panel.append(el('p',ai.result.summary),el('p',ai.result.recommendationReason));
  const labels={required:'required',preferred:'preferred',unclear:'unclear',supported:'supported',partial:'partially supported',not_documented:'not documented'};
  for(const r of ai.result.requirements){
    const item=el('div',null,'card');item.append(el('strong',`${labels[r.kind]} · ${r.requirement} · ${labels[r.assessment]}`));
    item.append(el('p','JD excerpt: '+r.jdEvidence));
    item.append(el('p',r.resume==='none'?'No supporting evidence was found in the supplied resumes.':`${r.resume} excerpt: ${r.resumeEvidence}`));panel.append(item);
  }
  for(const [label,key] of [['Strengths','strengths'],['Questions to verify','questions']]){
    panel.append(el('h3',label));const list=el('ul');for(const value of ai.result[key])list.append(el('li',value));panel.append(list);
  }
  panel.append(el('p','Next step: '+ai.result.nextStep));
  panel.append(el('p',`${ai.model} · ${ai.analyzedAt} · Input ${ai.usage?.input_tokens??'?'} / Output ${ai.usage?.output_tokens??'?'} tokens`,'muted'));
  panel.append(el('p','Review model conclusions. Results reflect the resume supplied at analysis time; rerun after editing it.','muted'));target.append(panel);
}
$('apiSettingsSave').onclick=async()=>{try{await apiReady;await saveApiSettings();apiNotice('Settings saved locally. The connection token lasts only for this browser session.');}catch{apiNotice('Could not save settings. Please retry.');}};
$('apiHealth').onclick=async()=>{try{await apiReady;await saveApiSettings();const data=await localRequest('/health');apiNotice(data.ready?`Local backend configured · ${data.model}. This check does not call OpenAI or validate the key.`:'The local backend is running, but the OpenAI key or model is not configured.');}catch(e){apiNotice(e.message==='Failed to fetch'?'Cannot connect to the local backend. Run npm start first.':e.message);}};
$('apiAnalyze').onclick=async()=>{
  const button=$('apiAnalyze');button.disabled=true;
  try{
    await Promise.all([ready,apiReady]);
    if(!$('apiConsent').checked)throw Error('Confirm data sharing and API billing before continuing.');
    if(!$('jdComplete').checked)throw Error('Confirm that the current job description is complete.');
    const profile=profileInput();
    if(!Object.values(profile.resumes).some(Boolean))throw Error('Supply the text of at least one resume.');
    const title=$('title').value.trim(),jd=$('jd').value;
    if(!title||jd.trim().length<80)throw Error('Enter a job title and complete description (at least 80 characters).');
    await saveApiSettings();
    await $('save').onclick();
    const url=safeUrl($('url').value);
    const snapshot=records.find(r=>r.title===title&&r.jd===jd&&r.url===url);
    if(!snapshot)throw Error('Could not save the current job. Please retry.');
    const id=snapshot.id;
    apiNotice('Analyzing this job. Keep this page open. No automatic retries or other jobs will be processed.');
    const data=await localRequest('/analyze',{title,jd,jdComplete:true,...profile});
    // Never attach an old result to a newly edited job or resurrect a deleted record.
    const current=records.find(r=>r.id===id);
    if(!current||current.jd!==jd||current.title!==title)throw Error('This record changed or was deleted during analysis. The result was not saved.');
    current.aiAnalysis={...data,sourceTitle:title,sourceJD:jd};
    await persist();apiNotice('OpenAI analysis saved to the job record. Expand it to view; JSON and CSV exports include the result.');
  }catch(e){apiNotice(e.name==='TimeoutError'?'Request timed out. No automatic retry was made; API charges may still apply.':e.message==='Failed to fetch'?'Cannot connect to the local backend. Make sure npm start is running.':e.message);}
  finally{button.disabled=false;}
};

