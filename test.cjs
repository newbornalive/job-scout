const assert=require('node:assert/strict');
const e=require('./engine.js');
assert.equal(e.has('career requirements','r'),false);
assert.equal(e.has('Python, SQL and R.','r'),true);
assert.equal(e.salary('Annual base salary: $120,000–$160,000 per year')[0].midpoint,140000);
assert.equal(e.salary('$50 - $70 per hour')[0].unit,'hour');
assert.equal(e.salary('$120k to $160k annually')[0].midpoint,140000);
assert.equal(e.salary('Salary competitive').length,0);
assert.equal(e.salary('$160,000 - $120,000').length,0);
assert.equal(e.salary('$100k-$120k per year. In NY: $130k-$150k per year.').length,2);
assert.ok(e.analyze('Data Scientist Python SQL Bayesian hierarchical models').matched.includes('bayesian'));
assert.ok(e.analyze('Spark and Python').verify.includes('spark'));
for(const title of ['Senior Data Scientist','Marketing Scientist','Model Validation Analyst','Model Risk Analyst','Research Statistician','Decision Science Analyst','Senior Data Analyst','Product Analyst','Healthcare Data Analyst','Research Data Analyst','Experimentation Analyst','Applied Scientist','Research Scientist - Statistics','Biostatistician','Statistical Programmer']){
  assert.equal(e.classifyTitle(title).eligible,true,title);
}
for(const title of ['Sales Representative','Software Engineer','Data Entry Clerk','Research Coordinator']){
  assert.equal(e.classifyTitle(title).eligible,false,title);
}
assert.equal(e.classifyTitle('Senior Data Analyst').priority,'扩量');
assert.ok(e.classifyTitle('Model Risk Analyst').cautions.length);
assert.equal(e.analyze('','Data Scientist').stage,'awaiting-jd');
const result=e.analyze('Python SQL model validation stability monitoring','Model Validation Analyst');
assert.equal(result.stage,'matched');
assert.ok(result.evidence.some(x=>x.hits.includes('stability')));
assert.equal(result.titleMatch.priority,'主投');
console.log('35 salary, title filtering, and JD matching checks passed');
const completeLow={id:'low',jd:'Full JD',jdComplete:true,analysis:{score:0}};
const completeHigh={id:'high',jd:'Full JD',jdComplete:true,analysis:{score:82}};
const partial={id:'partial',jd:'Excerpt',jdComplete:false,analysis:{score:100}};
const legacy={id:'legacy',jd:'Old JD',analysis:{score:99}};
assert.deepEqual(e.sortRecords([partial,completeLow,legacy,completeHigh]).slice(0,2).map(r=>r.id),['high','low']);
assert.equal(e.matchPercent(partial),null);
assert.equal(e.matchPercent(legacy),null);
assert.equal(e.matchPercent(completeLow),0);
assert.equal(e.matchPercent(completeHigh),82);
assert.equal(e.completeJD({jd:'',jdComplete:true}),false);
console.log('6 JD completeness, percentage, and ordering checks passed');
const route=(jd,title)=>e.recommendResume(jd,title);
assert.equal(route('', 'Data Scientist').primary,null);
assert.equal(route('Manage store inventory','Store Manager').primary,null);
assert.equal(route('Python XGBoost predictive modeling feature engineering','Senior Data Scientist').primary.id,'DS');
assert.equal(route('SQL Tableau dashboard cohort retention conversion','Marketing Analyst').primary.id,'DA');
assert.equal(route('Bayesian MCMC Gibbs missing data diagnostic accuracy publications','Research Scientist').primary.id,'Research');
assert.equal(route('Bayesian MCMC Gibbs missing data diagnostic accuracy publications statistical inference','Data Scientist').primary.id,'Research');
assert.equal(route('XGBoost model validation','Principal Data Scientist').primary.id,'DS');
assert.ok(route('XGBoost dashboard tableau','Data Scientist Customer Analytics').alternatives.some(p=>p.id==='DS'));
console.log('8 resume routing checks passed');
