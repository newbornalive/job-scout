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
  if(!token)throw Error('请填写 .env 中的 JOB_SCOUT_TOKEN（不是 OpenAI API key）。');
  const response=await fetch('http://127.0.0.1:43127'+path,{
    method:body?'POST':'GET',headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},
    ...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(100000)
  });
  const data=await response.json();if(!response.ok)throw Error(data.error||'本机接口请求失败。');return data;
}
function appendAI(target,record){
  const ai=record.aiAnalysis;if(!ai)return;
  const stale=ai.sourceJD!==record.jd||ai.sourceTitle!==record.title;
  const panel=el('details');panel.append(el('summary',`OpenAI 分析 · ${ai.result.recommendedResume}${stale?' · JD 已变化，请重新分析':''}`));
  panel.append(el('p',ai.result.summary),el('p',ai.result.recommendationReason));
  const labels={required:'必需',preferred:'加分',unclear:'不明确',supported:'有证据',partial:'部分支持',not_documented:'简历未记载'};
  for(const r of ai.result.requirements){
    const item=el('div',null,'card');item.append(el('strong',`${labels[r.kind]} · ${r.requirement} · ${labels[r.assessment]}`));
    item.append(el('p','JD 原文：'+r.jdEvidence));
    item.append(el('p',r.resume==='none'?'简历中未找到对应证据。':`${r.resume} 原文：${r.resumeEvidence}`));panel.append(item);
  }
  for(const [label,key] of [['优势','strengths'],['待核实','questions']]){
    panel.append(el('h3',label));const list=el('ul');for(const value of ai.result[key])list.append(el('li',value));panel.append(list);
  }
  panel.append(el('p','下一步：'+ai.result.nextStep));
  panel.append(el('p',`${ai.model} · ${ai.analyzedAt} · 输入 ${ai.usage?.input_tokens??'?'} / 输出 ${ai.usage?.output_tokens??'?'} tokens`,'muted'));
  panel.append(el('p','模型判断需人工复核。结果基于分析当时的简历；修改简历后请重新分析。','muted'));target.append(panel);
}
$('apiSettingsSave').onclick=async()=>{try{await apiReady;await saveApiSettings();apiNotice('资料已存本机；连接令牌仅保留到浏览器会话结束。');}catch{apiNotice('保存失败，请重试。');}};
$('apiHealth').onclick=async()=>{try{await apiReady;await saveApiSettings();const data=await localRequest('/health');apiNotice(data.ready?`本机后端已配置 · ${data.model}。此检查不调用 OpenAI，也不验证密钥。`:'本机后端已启动，但尚未配置 OpenAI key / 模型。');}catch(e){apiNotice(e.message==='Failed to fetch'?'无法连接本机后端，请先运行 npm start。':e.message);}};
$('apiAnalyze').onclick=async()=>{
  const button=$('apiAnalyze');button.disabled=true;
  try{
    await Promise.all([ready,apiReady]);
    if(!$('apiConsent').checked)throw Error('请先确认发送范围与 API 计费。');
    if(!$('jdComplete').checked)throw Error('请先确认当前 JD 完整。');
    const profile=profileInput();
    if(!Object.values(profile.resumes).some(Boolean))throw Error('请填写至少一份简历正文。');
    const title=$('title').value.trim(),jd=$('jd').value;
    if(!title||jd.trim().length<80)throw Error('请填写职位名称和完整 JD（至少 80 字符）。');
    await saveApiSettings();
    await $('save').onclick();
    const url=safeUrl($('url').value);
    const snapshot=records.find(r=>r.title===title&&r.jd===jd&&r.url===url);
    if(!snapshot)throw Error('未能保存当前职位，请重试。');
    const id=snapshot.id;
    apiNotice('正在分析这一条职位，请保持此页面打开。不会自动重试或分析其他职位。');
    const data=await localRequest('/analyze',{title,jd,jdComplete:true,...profile});
    // Never attach an old result to a newly edited job or resurrect a deleted record.
    const current=records.find(r=>r.id===id);
    if(!current||current.jd!==jd||current.title!==title)throw Error('分析期间该记录已更改或删除，结果未保存。');
    current.aiAnalysis={...data,sourceTitle:title,sourceJD:jd};
    await persist();apiNotice('OpenAI 分析已保存到该职位记录，可展开查看；JSON / CSV 导出包含结果。');
  }catch(e){apiNotice(e.name==='TimeoutError'?'请求超时；没有自动重试，可能已产生 API 费用。':e.message==='Failed to fetch'?'无法连接本机后端。请确认 npm start 已运行。':e.message);}
  finally{button.disabled=false;}
};
