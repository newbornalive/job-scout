// Generic role vocabulary and illustrative resume categories; no personal resume is embedded.
(function(root) {
  const roles = [
    {name:'Data Scientist',priority:'Primary',titles:['data scientist','data science'],reason:'Example role category; verify against your own resume',signals:['python','sql','model validation','machine learning']},
    {name:'Marketing / Customer Analytics',priority:'Primary',titles:['marketing scientist','marketing data scientist','customer analytics','marketing analyst','marketing analytics','customer insights'],reason:'Example role category; verify against your own resume',signals:['campaign','response','customer','marketing','targeting']},
    {name:'Model Validation / Model Risk',priority:'Primary',titles:['model validation','model risk','model monitoring','model validator'],reason:'Example role category; verify against your own resume',signals:['validation','stability','monitoring','reliability','model risk'],caution:'Verify credit-risk regulation and regulatory experience requirements'},
    {name:'Statistician / Statistical Scientist',priority:'Primary',titles:['statistician','statistical scientist','research statistician'],reason:'Example role category; verify against your own resume',signals:['bayesian','hierarchical','simulation','missing data','statistical']},
    {name:'Decision Science',priority:'Primary',titles:['decision scientist','decision science','decision analyst'],reason:'Example role category; verify against your own resume',signals:['decision','predictive','statistical','business']},
    {name:'Data / Product / Marketing Analyst',priority:'Broader search',titles:['data analyst','product analyst','product analytics','marketing analyst','marketing analytics','analytics analyst'],reason:'Example role category; verify against your own resume',signals:['sql','python','tableau','metrics','conversion']},
    {name:'Healthcare / Research Data Analyst',priority:'Broader search',titles:['healthcare data analyst','health data analyst','clinical data analyst','research data analyst','research analyst'],reason:'Example role category; verify against your own resume',signals:['healthcare','patient','epic','sas','utilization','research']},
    {name:'Experimentation',priority:'Selective',titles:['experimentation','experiment analyst','causal inference'],reason:'Example role category; verify against your own resume',signals:['a/b test','a/b testing','experimentation','causal','experiment'],caution:'Verify product metrics and experimentation-platform requirements'},
    {name:'Applied / Research Scientist',priority:'Selective',titles:['applied scientist','research scientist','machine learning scientist'],reason:'Example role category; verify against your own resume',signals:['statistics','bayesian','machine learning','simulation'],caution:'Verify research focus, engineering depth, and optimization requirements'},
    {name:'Biostatistics / Statistical Programming',priority:'Selective',titles:['biostatistician','biostatistics','statistical programmer','sas programmer'],reason:'Example role category; verify against your own resume',signals:['sas','r','statistical','clinical','bayesian'],caution:'Verify clinical-trial, CDISC / SDTM / ADaM, and pharmaceutical experience requirements'}
  ];
  function classifyTitle(title) {
    const hits=roles.filter(role=>role.titles.some(term=>has(title,term)));
    return {eligible:hits.length>0,roles:hits.map(r=>r.name),priority:hits.some(r=>r.priority==='Primary')?'Primary':hits.some(r=>r.priority==='Broader search')?'Broader search':hits.length?'Selective':'Manual review',
      reasons:hits.map(r=>r.reason),cautions:hits.map(r=>r.caution).filter(Boolean)};
  }
  const groups = {
    'Marketing Measurement': ['marketing', 'measurement', 'campaign', 'customer response', 'targeting', 'attribution'],
    'Experimentation': ['experimentation', 'a/b test', 'experiment design', 'causal inference', 'causal analysis'],
    'Statistical Science': ['bayesian', 'hierarchical', 'statistician', 'statistical scientist', 'latent', 'simulation'],
    'Applied Data Science': ['data scientist', 'machine learning', 'xgboost', 'model validation', 'predictive modeling'],
    'Product Analytics': ['product analytics', 'decision scientist', 'data analyst', 'conversion', 'tableau']
  };
  const skills = ['python','sql','r','pandas','numpy','scipy','scikit-learn','xgboost','tableau','git','bayesian'];
  const resume = new Set(skills);
  const other = ['spark','databricks','snowflake','dbt','airflow','kubernetes','llm','deep learning','scala','java','power bi'];
  function has(text, term) { return new RegExp('(^|[^a-z0-9])'+term.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(?=$|[^a-z0-9])','i').test(text); }
  function salary(text) {
    // Require two explicit currency amounts and a connector; never invent a range.
    const re = /(?:USD\s*|\$)\s*([\d,]+(?:\.\d+)?)\s*([kK])?\s*(?:-|–|—|to)\s*(?:USD\s*|\$)?\s*([\d,]+(?:\.\d+)?)\s*([kK])?/g;
    return [...text.matchAll(re)].map(m => {
      const low = Number(m[1].replaceAll(',',''))*(m[2]?1000:1);
      const high = Number(m[3].replaceAll(',',''))*(m[4]?1000:1);
      const context = text.slice(Math.max(0,m.index-80),m.index+m[0].length+100);
      const unit = /hour|hourly|\/hr|per hr/i.test(context)?'hour':/annual|year|annum/i.test(context)?'year':'unknown';
      const type = /total compensation|total pay|ote/i.test(context)?'total compensation':'unspecified';
      return {low,high,midpoint:(low+high)/2,unit,type,source:m[0],context};
    }).filter(x=>x.high>=x.low && x.low>0);
  }
  const resumeProfiles = [
    {id:'DS',name:'DS resume',file:'DS resume slot',titles:['data scientist','data science','marketing scientist','decision scientist','model validation','model risk'],signals:['xgboost','predictive modeling','model validation','ranking stability','feature engineering','machine learning'],evidence:'Example category, not personal experience; API mode uses your supplied resume'},
    {id:'DA',name:'DA resume',file:'DA resume slot',titles:['data analyst','marketing analyst','growth analyst','customer insights','customer analytics','product analyst','business intelligence'],signals:['dashboard','tableau','cohort','retention','conversion','customer insights','marketing analytics','campaign'],evidence:'Example category, not personal experience; API mode uses your supplied resume'},
    {id:'Research',name:'Research resume',file:'Research resume slot',titles:['statistician','statistical scientist','biostatistician','research scientist','research data scientist','applied scientist'],signals:['bayesian','mcmc','gibbs','latent class','latent-class','missing data','diagnostic accuracy','publication','publications','statistical inference'],evidence:'Example category, not personal experience; API mode uses your supplied resume'}
  ];
  function recommendResume(text='',title='') {
    if(!text.trim())return {primary:null,alternatives:[],reason:'Example role category; verify against your own resume'};
    const ranked=resumeProfiles.map(profile=>{
      const titleHits=profile.titles.filter(term=>has(title,term));
      const hits=profile.signals.filter(term=>has(text,term));
      return {...profile,titleHits,hits,weight:(titleHits.length?4:0)+hits.length};
    }).sort((a,b)=>b.weight-a.weight);
    if(!ranked[0].weight)return {primary:null,alternatives:[],reason:'Example role category; verify against your own resume'};
    const best=ranked[0];
    return {primary:best,alternatives:ranked.slice(1).filter(p=>p.weight>0&&best.weight-p.weight<=2),reason:'Example role category; verify against your own resume'};
  }
  function analyze(text, title='') {
    const titleMatch=classifyTitle(title);
    const evidence=roles.filter(r=>titleMatch.roles.includes(r.name)).map(r=>({role:r.name,hits:r.signals.filter(t=>has(text,t))}));
    const tracks = Object.entries(groups).map(([name, terms])=>({name,hits:terms.filter(t=>has(text,t))})).sort((a,b)=>b.hits.length-a.hits.length);
    const matched = skills.filter(t=>has(text,t));
    const verify = other.filter(t=>has(text,t) && !resume.has(t));
    const keywords = [...new Set([...tracks.flatMap(t=>t.hits),...matched,...verify])];
    const senior = /\b(staff|principal|director|senior|lead)\b/i.test(text);
    return {resumeRecommendation:recommendResume(text,title),titleMatch,evidence,stage:text.trim()?'matched':'awaiting-jd',tracks:tracks.filter(t=>t.hits.length),matched,verify,keywords,salaries:salary(text),senior,
      score: Math.min(100, matched.length*5 + tracks.reduce((s,t)=>s+t.hits.length,0)*6),
      queries:tracks.filter(t=>t.hits.length).slice(0,3).map(t=>({track:t.name,query: '"'+({ 'Marketing Measurement':'Data Scientist', 'Experimentation':'Data Scientist', 'Statistical Science':'Statistical Scientist','Applied Data Science':'Data Scientist','Product Analytics':'Decision Scientist'}[t.name])+'" '+t.hits.slice(0,2).map(x=>'"'+x+'"').join(' ')}))};
  }

  function normalizeStatus(status){
    const legacy={'\u5f85\u7533\u8bf7':'To apply','\u5df2\u7533\u8bf7':'Applied','\u9762\u8bd5\u4e2d':'Interviewing','\u5df2\u7ed3\u675f':'Closed'};
    return legacy[status] || status || 'To apply';
  }
  function completeJD(record){return record.jdComplete===true && !!record.jd?.trim();}
  function matchPercent(record){return completeJD(record)?Math.round(Math.max(0,Math.min(100,record.analysis?.score||0))):null;}
  function sortRecords(records){return [...records].sort((a,b)=>Number(completeJD(b))-Number(completeJD(a)) || (matchPercent(b)??-1)-(matchPercent(a)??-1) || String(b.created||'').localeCompare(String(a.created||'')));}
  root.JobEngine={analyze,salary,has,roles,classifyTitle,completeJD,matchPercent,sortRecords,recommendResume,resumeProfiles,normalizeStatus};
  if(typeof module!=='undefined') module.exports=root.JobEngine;
})(globalThis);

