const $=id=>document.getElementById(id);
let records=[];let analysis=null;
const params=new URLSearchParams(location.search);
async function sourceTab(){if(params.has('tab'))return chrome.tabs.get(Number(params.get('tab')));return (await chrome.tabs.query({active:true,currentWindow:true}))[0];}
function searchUrl(query){return 'https://www.linkedin.com/jobs/search/?keywords='+encodeURIComponent(query)+'&location=United%20States&f_TPR=r172800&sortBy=DD';}
const ready=chrome.storage.local.get({records:[]}).then(data=>{records=data.records;render();});
function el(tag,text,cls){const e=document.createElement(tag);if(text)e.textContent=text;if(cls)e.className=cls;return e;}
function notify(t){$('notice').textContent=t;}
function appendResume(target,text,title,complete){
  const rec=JobEngine.recommendResume(text,title);
  target.append(el('h3',(complete?'示例简历类别：':'初步建议（JD 未确认完整）：')+(rec.primary?.name||'待判断')));
  if(rec.primary){
    target.append(el('p',rec.primary.file));
    target.append(el('p','岗位依据：'+[...rec.primary.titleHits,...rec.primary.hits].join(', ')));
    target.append(el('p','示例说明：'+rec.primary.evidence));
    if(rec.alternatives.length)target.append(el('p','也可考虑：'+rec.alternatives.map(p=>p.name).join(' / ')));
  }
  target.append(el('p',rec.reason,'muted'));
}

function safeUrl(value){try{const u=new URL(value);return ['https:','http:'].includes(u.protocol)?u.href:'';}catch{return '';}}
function run(){const text=$('jd').value.trim();if(!text){notify('请先读取或粘贴 JD。');return null;}analysis=JobEngine.analyze(text,$('title').value);const target=$('result');target.replaceChildren();const card=el('div',null,'card');card.append(el('h3',`匹配度（关键词覆盖）${$('jdComplete').checked?analysis.score+'%':'待评估（JD 完整性未确认）'} · ${analysis.tracks[0]?.name||'需要人工判断方向'}`));card.append(el('p','Title 初筛：'+analysis.titleMatch.priority+' · '+(analysis.titleMatch.roles.join(' / ')||'未命中方向，保留人工判断')));for(const e of analysis.evidence)card.append(el('p',e.role+' 的 JD 依据：'+(e.hits.join(', ')||'暂无关键词证据')));for(const c of analysis.titleMatch.cautions)card.append(el('p',c));card.append(el('p','通用示例词表命中：'+(analysis.matched.join(', ')||'未识别')));card.append(el('p','需要核实的要求：'+(analysis.verify.join(', ')||'未识别；请继续阅读原始 JD')));if(analysis.senior)card.append(el('p','包含高级职级词：保留机会，人工核实年限和职责。'));card.append(el('h3','从这条 JD 延伸搜索'));for(const q of analysis.queries){const a=el('a',q.query);a.href='https://www.linkedin.com/jobs/search/?keywords='+encodeURIComponent(q.query)+'&location=United%20States&f_TPR=r172800&sortBy=DD';a.target='_blank';a.rel='noopener';card.append(a,el('br'));}card.append(el('h3','期望薪资参考'));if(!analysis.salaries.length)card.append(el('p','未识别明确薪资区间；不生成数值。'));for(const s of analysis.salaries)card.append(el('p',`${s.source} → 中点 USD ${s.midpoint.toLocaleString('en-US')} / ${s.unit==='year'?'年':s.unit==='hour'?'小时':'单位待确认'}；${s.type}。${analysis.salaries.length>1?'有多个区间，请确认适用范围。':''}`));card.append(el('p','这是规则匹配，尚未判断每项要求是必需、加分还是否定条件。','muted'));appendResume(card,text,$('title').value,$('jdComplete').checked);target.append(card);return analysis;}
async function persist(){await chrome.storage.local.set({records});render();}
function render(){ $('count').textContent=records.length; $('records').replaceChildren();for(const r of JobEngine.sortRecords(records)){const c=el('div',null,'card');c.append(el('h3',`${r.title} · ${r.company||'公司待补充'}`));const tm=JobEngine.classifyTitle(r.title);c.append(el('p',tm.priority+' · '+(tm.roles.join(' / ')||'Title 未命中方向'),'muted'));if(r.captureError)c.append(el('p',r.captureError,'muted'));c.append(el('p','工作地点：'+(r.location||'未提供')));const applicationUrl=safeUrl(r.applicationUrl);const url=applicationUrl||safeUrl(r.url);if(url){const a=el('a',applicationUrl?'申请链接 ↗':'申请入口（LinkedIn 职位页）↗');a.href=url;a.target='_blank';a.rel='noopener';c.append(a);}const select=el('select');for(const value of ['待申请','已申请','面试中','已结束']){const o=el('option',value);o.value=value;select.append(o);}select.value=r.status;select.onchange=async()=>{r.status=select.value;await persist();};const del=el('button','删除','delete');del.onclick=async()=>{records=records.filter(x=>x.id!==r.id);await persist();};const load=el('button','载入 / API 分析');load.onclick=()=>{for(const field of ['title','company','url','location','applicationUrl','jd'])$(field).value=r[field]||'';$('jdComplete').checked=JobEngine.completeJD(r);run();$('apiSettings').open=true;$('apiSettings').scrollIntoView({behavior:'smooth'});};c.append(load,select,del,el('p',`保存于 ${new Date(r.created).toLocaleDateString()} · ${JobEngine.completeJD(r)?'匹配度 '+JobEngine.matchPercent(r)+'%':'JD 不完整 / 未确认 · 匹配度待评估'}`,'muted'));appendResume(c,r.jd||'',r.title,JobEngine.completeJD(r));if(typeof appendAI==='function')appendAI(c,r);$('records').append(c);}}
$('analyze').onclick=run;
$('open').onclick=()=>chrome.tabs.create({url:'https://www.linkedin.com/jobs/search/?keywords=Data%20Scientist&location=United%20States&f_TPR=r172800&sortBy=DD'});
$('scan').onclick=async()=>{try{
  const tab=await sourceTab();const u=new URL(tab.url);
  if(u.hostname!=='www.linkedin.com'||!u.pathname.startsWith('/jobs'))throw Error('请打开 LinkedIn Jobs 职位。');
  const jobId=u.searchParams.get('currentJobId')||u.pathname.match(/\/jobs\/view\/(\d+)/)?.[1];
  if(!jobId)throw Error('请先在列表中点击一个职位。');
  const [result]=await chrome.scripting.executeScript({target:{tabId:tab.id},func:captureJobDetail,args:[jobId]});
  const data=result.result;if(!data?.jd)throw Error(data?.error||'未找到 JD');
  for(const key of ['title','company','jd','url','location','applicationUrl'])$(key).value=data[key]||'';
  $('jdComplete').checked=data.jdComplete===true;
  await ready;await $('save').onclick();
}catch(e){notify(e.message);}};
$('save').onclick=async()=>{await ready;const a=run();if(!a)return;if(!$('title').value.trim()){notify('请填写职位名称。');return;}const url=safeUrl($('url').value);const match=url.match(/\/jobs\/view\/(\d+)/)||url.match(/[?&]currentJobId=(\d+)/);const key=match?'linkedin:'+match[1]:url?url.split('?')[0]:$('title').value.trim().toLowerCase()+'|'+$('company').value.trim().toLowerCase();const existing=records.find(r=>r.key===key);if(existing){Object.assign(existing,{title:$('title').value.trim(),company:$('company').value.trim()||existing.company,url,location:$('location').value.trim(),applicationUrl:safeUrl($('applicationUrl').value),jdComplete:$('jdComplete').checked,jd:$('jd').value,analysis:a,captureError:''});await persist();notify('已更新已保存职位的 JD 和匹配分析。');return;}records.unshift({id:crypto.randomUUID(),key,title:$('title').value.trim(),company:$('company').value.trim(),url,location:$('location').value.trim(),applicationUrl:safeUrl($('applicationUrl').value),jdComplete:$('jdComplete').checked,jd:$('jd').value,analysis:a,captureError:'',status:'待申请',created:new Date().toISOString()});await persist();notify('已保存到当前浏览器。');};
function download(name,type,content){const url=URL.createObjectURL(new Blob([content],{type}));const a=el('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('export').onclick=()=>download('job-scout-jobs.json','application/json',JSON.stringify(JobEngine.sortRecords(records).map(r=>({...r,resumeRecommendation:JobEngine.recommendResume(r.jd||'',r.title),location:r.location||'',applicationUrl:safeUrl(r.applicationUrl)||safeUrl(r.url),applicationLinkSource:safeUrl(r.applicationUrl)?'apply-button':'linkedin-job-page',matchPercent:JobEngine.matchPercent(r),jdComplete:JobEngine.completeJD(r)})),null,2));
$('csv').onclick=()=>{const rows=[['职位','公司','AI推荐简历','AI分析','AI结果是否过期','建议简历','备选简历','简历匹配依据','工作地点 / 地址','申请链接','链接来源','职位链接','匹配度','完整JD','状态','保存日期','匹配关键词','需核实技能','薪资区间及中点'],...JobEngine.sortRecords(records).map(r=>[r.title,r.company,r.aiAnalysis?.result.recommendedResume||'',r.aiAnalysis?JSON.stringify(r.aiAnalysis.result):'',r.aiAnalysis?(r.aiAnalysis.sourceJD!==r.jd||r.aiAnalysis.sourceTitle!==r.title?'JD已变化':'请确认简历仍为分析时版本'):'',JobEngine.recommendResume(r.jd||'',r.title).primary?.name||'待判断',JobEngine.recommendResume(r.jd||'',r.title).alternatives.map(p=>p.name).join('; '),JobEngine.recommendResume(r.jd||'',r.title).primary?.hits.join('; ')||'',r.location||'未提供',safeUrl(r.applicationUrl)||safeUrl(r.url),safeUrl(r.applicationUrl)?'申请按钮':'LinkedIn 职位页',r.url,JobEngine.matchPercent(r)===null?'待评估':JobEngine.matchPercent(r)+'%',JobEngine.completeJD(r)?'是':'未确认',r.status,r.created,r.analysis.matched.join('; '),r.analysis.verify.join('; '),r.analysis.salaries.map(s=>`${s.source}: ${s.midpoint} USD/${s.unit}`).join('; ')])];const escape=v=>'"'+String(v).replace(/^[=+@-]/,"'$&").replaceAll('"','""')+'"';download('job-scout-jobs.csv','text/csv;charset=utf-8','\uFEFF'+rows.map(row=>row.map(escape).join(',')).join('\r\n'));};

$('batch').onclick=async()=>{try{
  const source=await sourceTab();
  if(!params.has('tab')){
    const u=new URL(source.url);
    if(u.hostname!=='www.linkedin.com'||!u.pathname.startsWith('/jobs'))throw Error('请先打开 LinkedIn Jobs 搜索结果页。');
    await chrome.tabs.create({url:chrome.runtime.getURL('popup.html')+'?tab='+source.id+'&scan=1'});return;
  }
  $('batch').disabled=true;$('scan').disabled=true;
  await ready;
  const tab=await sourceTab();
  const u=new URL(tab.url);
  if(u.hostname!=='www.linkedin.com'||!u.pathname.startsWith('/jobs'))throw Error('请先打开 LinkedIn Jobs 搜索结果页。');
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
  if(!jobs.length)throw Error('未找到职位卡片。请等待列表加载，滚动列表后重试；也可以打开职位后读取详情。');
  const candidates=jobs.filter(j=>JobEngine.classifyTitle(j.title).eligible);
  let completed=0,failed=0;
  for(let i=0;i<candidates.length;i++){
    const job=candidates[i],key='linkedin:'+job.id;
    let record=records.find(r=>r.key===key);
    if(record && !record.location)record.location=job.location||'';
    if(!record){record={id:crypto.randomUUID(),key,title:job.title,company:job.company,location:job.location||'',applicationUrl:'',jdComplete:false,url:job.url,jd:'',analysis:JobEngine.analyze('',job.title),status:'待申请',created:new Date().toISOString()};records.unshift(record);await persist();}
    notify(`Title 初筛 ${candidates.length}/${jobs.length} 条；正在读取 JD ${i+1}/${candidates.length}：${job.title}`);
    try{
      const [detail]=await chrome.scripting.executeScript({target:{tabId:tab.id},func:captureJobDetail,args:[job.id]});
      const data=detail.result;
      if(!data?.jd)throw Error(data?.error||'无法读取 JD');
      // Card title is tied to the job ID; use it for title classification.
      Object.assign(record,{jd:data.jd,jdComplete:data.jdComplete===true,location:data.location||job.location||record.location||'',applicationUrl:safeUrl(data.applicationUrl)||record.applicationUrl||'',company:data.company||job.company,analysis:JobEngine.analyze(data.jd,job.title),captureError:data.jdComplete?'':'JD 可能未展开，需确认完整性'});completed++;
    }catch(e){record.captureError=e.message;failed++;}
    await persist();
  }
  notify(`完成：扫描 ${jobs.length} 个 Title，相关 ${candidates.length} 个；JD 匹配 ${completed} 个，读取失败 ${failed} 个。不相关 ${jobs.length-candidates.length} 个未保存。仅处理已加载卡片；滚动列表后可再次扫描。`);
}catch(e){notify(e.message);}finally{$('batch').disabled=false;$('scan').disabled=false;}};

const table=el('table');
const head=el('tr');for(const label of ['优先级','岗位方向 / 搜索','示例与注意事项'])head.append(el('th',label));table.append(head);
for(const role of JobEngine.roles){const row=el('tr');row.append(el('td',role.priority));const name=el('td');const a=el('a',role.name);a.href=searchUrl(role.titles.map(t=>'"'+t+'"').join(' OR '));a.target='_blank';a.rel='noopener';name.append(a);row.append(name,el('td',role.reason+(role.caution?'；'+role.caution:'')));table.append(row);}$('role-table').append(table);
if(params.get('scan')==='1'){document.body.classList.add('workspace');ready.then(()=>$('batch').onclick());}

$('jd').addEventListener('input',()=>{$('jdComplete').checked=false;});
