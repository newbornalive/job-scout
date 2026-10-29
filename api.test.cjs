const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createServer}=require('./server.cjs');
const {validate}=require('./api-contract.cjs');
const token='local-test-token-'.repeat(3);
const jd='We require Python and SQL for predictive modeling. Experience with Bayesian inference is preferred.';
const input={title:'Senior Data Scientist',jd,jdComplete:true,preferences:'Remote',resumes:{DS:'Built predictive models with Python and SQL.',DA:'',Research:''}};
const result={summary:'分析',recommendedResume:'DS',recommendationReason:'Python 证据',requirements:[{requirement:'Python',kind:'required',jdEvidence:'require Python and SQL',resume:'DS',resumeEvidence:'Python and SQL',assessment:'supported'}],strengths:['模型'],questions:[],nextStep:'复核'};
const response=value=>new Response(JSON.stringify(value),{status:200});
const completed=r=>({status:'completed',model:'test-model',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(r)}]}],usage:{input_tokens:100,output_tokens:50}});
async function withServer(options,fn){
 const server=createServer({apiKey:'fake-key',model:'test-model',token,...options});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+server.address().port;
 const call=(body=input,headers={},path='/analyze')=>fetch(base+path,{method:path==='/health'?'GET':'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',...headers},...(path==='/health'?{}:{body:JSON.stringify(body)})});
 try{await fn(call);}finally{await new Promise(resolve=>server.close(resolve));}
}
test('Responses contract, evidence, usage and privacy settings',async()=>{
 let count=0;
 await withServer({fetchImpl:async(url,options)=>{
  count++;assert.equal(url,'https://api.openai.com/v1/responses');
  const body=JSON.parse(options.body);assert.equal(body.store,false);assert.equal(body.text.format.strict,true);
  assert.equal(body.text.format.type,'json_schema');assert.equal(body.model,'test-model');
  assert.deepEqual(JSON.parse(body.input).resumes,input.resumes);
  return response(completed(result));
 }},async call=>{
  const health=await call(undefined,{},'/health');assert.equal(health.status,200);assert.equal(count,0);
  const res=await call();assert.equal(res.status,200);const data=await res.json();assert.deepEqual(data.result,result);assert.equal(data.usage.input_tokens,100);
 });assert.equal(count,1);
});
test('reject unauthorized origin, missing token, bad input before any paid request',async()=>{
 await withServer({fetchImpl:()=>{throw Error('must not call upstream');}},async call=>{
  assert.equal((await call(input,{Origin:'https://example.com'})).status,403);
  assert.equal((await call(input,{Authorization:''})).status,401);
  assert.equal((await call({...input,jdComplete:false})).status,400);
  assert.equal((await call({...input,resumes:{DS:'',DA:'',Research:''}})).status,400);
  assert.equal((await call({...input,jd:'x'.repeat(40001)})).status,400);
  assert.equal((await call(input,{'Content-Type':'text/plain'})).status,415);
 });
});
test('missing API configuration is explicit',async()=>{
 await withServer({apiKey:''},async call=>assert.equal((await call()).status,503));
});
test('reject fabricated citations and absent resume recommendation',async()=>{
 for(const value of [
  {...result,recommendedResume:'Research'},
  {...result,requirements:[{...result.requirements[0],resumeEvidence:'I know Kubernetes'}]},
  {...result,requirements:[{...result.requirements[0],jdEvidence:'Unstated requirement'}]},
  {...result,requirements:[{...result.requirements[0],resume:'none',resumeEvidence:'',assessment:'supported'}]}
 ])await withServer({fetchImpl:async()=>response(completed(value))},async call=>assert.equal((await call()).status,502));
});
test('handle refusal, truncation, invalid schema, malformed output',async()=>{
 for(const [payload,status] of [
  [{status:'completed',output:[{type:'message',content:[{type:'refusal',refusal:'No'}]}]},422],
  [{status:'incomplete',output:[]},502],
  [completed({...result,recommendedResume:'MadeUp'}),502],
  [{status:'completed',output:[{type:'message',content:[{type:'output_text',text:'oops'}]}]},502]
 ])await withServer({fetchImpl:async()=>response(payload)},async call=>assert.equal((await call()).status,status));
 assert.equal(validate({...result,extra:true}),false);
});
test('upstream billing errors are redacted and never automatically retried',async()=>{
 let calls=0;
 await withServer({fetchImpl:async()=>{calls++;return new Response('sensitive details',{status:429});}},async call=>{
  const r=await call();assert.equal(r.status,502);assert.match((await r.json()).error,/额度/);
 });assert.equal(calls,1);
});
test('timeout and concurrent paid calls',async()=>{
 await withServer({fetchImpl:async()=>{throw new DOMException('secret','TimeoutError');}},async call=>{
  assert.match((await (await call()).json()).error,/超时/);
 });
 let release,started;const pending=new Promise(r=>started=r);
 await withServer({fetchImpl:async()=>{started();await new Promise(r=>release=r);return response(completed(result));}},async call=>{
  const first=call();await pending;
  try{assert.equal((await call()).status,429);}finally{release();}
  assert.equal((await first).status,200);
 });
});
