const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
async function scenario(stale){
  let now=0,clicked=false;
  const old='Old description '.repeat(12),fresh='Python SQL model validation new description '.repeat(8);
  const context={URL,Date:{now:()=>now},setTimeout:cb=>{now+=300;cb();},location:{href:'https://www.linkedin.com/jobs/search/?currentJobId=1'},document:{
    querySelector(selector){
      if(selector.includes('job-title'))return {innerText:clicked&&!stale?'New title':'Old title'};
      if(selector==='#job-details')return {innerText:clicked&&!stale?fresh:old};
      return null;
    },
    querySelectorAll(){return [{href:'https://www.linkedin.com/jobs/view/2/',click(){clicked=true;context.location.href='https://www.linkedin.com/jobs/search/?currentJobId=2';}}];}
  }};
  vm.createContext(context);vm.runInContext(fs.readFileSync('capture.js','utf8'),context);
  return context.captureJobDetail('2');
}
(async()=>{
  const good=await scenario(false);assert.equal(good.title,'New title');assert.ok(good.jd.includes('Python SQL'));
  const stale=await scenario(true);assert.ok(stale.error);assert.equal(stale.jd,undefined);
  console.log('JD capture checks passed: fresh detail accepted; stale detail rejected');
})().catch(e=>{console.error(e);process.exitCode=1;});
