const http=require('node:http');
const {timingSafeEqual}=require('node:crypto');
const {schema,validate,validateInput,instructions}=require('./api-contract.cjs');
const fail=(status,message)=>Object.assign(new Error(message),{status});
function createServer({apiKey,model,token,fetchImpl=fetch,timeoutMs=90000}={}){
  if(!token || token.length<32)throw Error('JOB_SCOUT_TOKEN must contain at least 32 characters.');
  let busy=false;
  return http.createServer(async(req,res)=>{
    const send=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
    const origin=req.headers.origin;
    if(!/^127\.0\.0\.1:\d+$/.test(req.headers.host||''))return send(403,{error:'仅允许本机访问。'});
    if(origin && !/^chrome-extension:\/\/[a-p]{32}$/.test(origin))return send(403,{error:'不允许的来源。'});
    if(origin){res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');}
    if(req.method==='OPTIONS'){
      res.setHeader('Access-Control-Allow-Methods','POST, GET, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers','Content-Type, Authorization');
      res.writeHead(204);return res.end();
    }
    const supplied=Buffer.from(req.headers.authorization||'');const expected=Buffer.from('Bearer '+token);
    if(supplied.length!==expected.length || !timingSafeEqual(supplied,expected))return send(401,{error:'本机连接令牌不正确。'});
    if(req.url==='/health'&&req.method==='GET')return send(200,{ready:!!apiKey&&!!model,model:model||null});
    if(req.url!=='/analyze'||req.method!=='POST')return send(404,{error:'接口不存在。'});
    if(!/^application\/json(?:;|$)/i.test(req.headers['content-type']||''))return send(415,{error:'需要 JSON 请求。'});
    if(!apiKey||!model)return send(503,{error:'请在后端配置 OPENAI_API_KEY 和 OPENAI_MODEL。'});
    if(busy)return send(429,{error:'已有分析正在进行，请稍后再试。'});
    busy=true;
    try{
      let size=0;const chunks=[];
      for await(const chunk of req){size+=chunk.length;if(size>500000)throw fail(413,'请求过大。');chunks.push(chunk);}
      let input;
      try{input=validateInput(JSON.parse(Buffer.concat(chunks).toString('utf8')));}catch(e){throw fail(400,e instanceof SyntaxError?'JSON 格式无效。':e.message);}
      const upstream=await fetchImpl('https://api.openai.com/v1/responses',{
        method:'POST',headers:{Authorization:'Bearer '+apiKey,'Content-Type':'application/json'},
        signal:AbortSignal.timeout(timeoutMs),
        body:JSON.stringify({model,store:false,instructions,input:JSON.stringify(input),max_output_tokens:6000,
          text:{format:{type:'json_schema',name:'job_analysis',strict:true,schema}}})
      });
      if(!upstream.ok){
        const messages={401:'OpenAI API key 无效。',403:'OpenAI 项目或模型无访问权限。',429:'OpenAI 额度不足或请求受限，请检查 API 账单与限制。',400:'OpenAI 请求被拒绝，请确认模型支持 Responses 和 Structured Outputs。',404:'OpenAI 模型不可用，请检查 OPENAI_MODEL。'};
        throw fail(502,messages[upstream.status]||'OpenAI 服务暂时不可用，请稍后手动重试。');
      }
      const response=await upstream.json();
      if(response.status!=='completed')throw fail(502,'模型输出未完成；未保存结果。可调整模型后重试。');
      const content=(response.output||[]).filter(x=>x.type==='message').flatMap(x=>x.content||[]);
      if(content.some(x=>x.type==='refusal'))throw fail(422,'模型未提供此请求的分析。');
      let result;
      try{result=JSON.parse(content.filter(x=>x.type==='output_text').map(x=>x.text).join(''));}catch{throw fail(502,'模型返回了无效 JSON。');}
      if(!validate(result))throw fail(502,'模型输出未通过结构校验。');
      if(result.recommendedResume!=='undetermined'&&!input.resumes[result.recommendedResume].trim())throw fail(502,'模型推荐了未提供的简历。');
      // Reject invented evidence instead of displaying it as a verified citation.
      for(const item of result.requirements){
        if(!item.jdEvidence.trim()||!input.jd.includes(item.jdEvidence))throw fail(502,'模型的 JD 引用未通过原文核对。');
        if(item.resume==='none'?(item.resumeEvidence!==''||item.assessment==='supported'||item.assessment==='partial'):
          (!item.resumeEvidence.trim()||!input.resumes[item.resume].includes(item.resumeEvidence)))throw fail(502,'模型的简历引用未通过原文核对。');
      }
      send(200,{result,model:response.model||model,usage:response.usage||null,analyzedAt:new Date().toISOString()});
    }catch(e){send(e.status||502,{error:e.status?e.message:e.name==='TimeoutError'?'OpenAI 请求超时；未自动重试。':'无法完成模型请求，请检查网络或后端配置。'});}
    finally{busy=false;}
  });
}
if(require.main===module){
  try{createServer({apiKey:process.env.OPENAI_API_KEY,model:process.env.OPENAI_MODEL,token:process.env.JOB_SCOUT_TOKEN})
    .listen(43127,'127.0.0.1',()=>console.log('Job Scout API listening on http://127.0.0.1:43127 (local only)'))
    .on('error',()=>{console.error('Cannot start server. Check whether port 43127 is already in use.');process.exitCode=1;});
  }catch(e){console.error(e.message);process.exitCode=1;}
}
module.exports={createServer};
