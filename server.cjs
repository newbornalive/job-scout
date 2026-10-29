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
    if(!/^127\.0\.0\.1:\d+$/.test(req.headers.host||''))return send(403,{error:'Local access only.'});
    if(origin && !/^chrome-extension:\/\/[a-p]{32}$/.test(origin))return send(403,{error:'Origin not allowed.'});
    if(origin){res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');}
    if(req.method==='OPTIONS'){
      res.setHeader('Access-Control-Allow-Methods','POST, GET, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers','Content-Type, Authorization');
      res.writeHead(204);return res.end();
    }
    const supplied=Buffer.from(req.headers.authorization||'');const expected=Buffer.from('Bearer '+token);
    if(supplied.length!==expected.length || !timingSafeEqual(supplied,expected))return send(401,{error:'Invalid local connection token.'});
    if(req.url==='/health'&&req.method==='GET')return send(200,{ready:!!apiKey&&!!model,model:model||null});
    if(req.url!=='/analyze'||req.method!=='POST')return send(404,{error:'Endpoint not found.'});
    if(!/^application\/json(?:;|$)/i.test(req.headers['content-type']||''))return send(415,{error:'A JSON request is required.'});
    if(!apiKey||!model)return send(503,{error:'Configure OPENAI_API_KEY and OPENAI_MODEL on the backend.'});
    if(busy)return send(429,{error:'An analysis is already running. Try again later.'});
    busy=true;
    try{
      let size=0;const chunks=[];
      for await(const chunk of req){size+=chunk.length;if(size>500000)throw fail(413,'Request is too large.');chunks.push(chunk);}
      let input;
      try{input=validateInput(JSON.parse(Buffer.concat(chunks).toString('utf8')));}catch(e){throw fail(400,e instanceof SyntaxError?'Invalid JSON format.':e.message);}
      const upstream=await fetchImpl('https://api.openai.com/v1/responses',{
        method:'POST',headers:{Authorization:'Bearer '+apiKey,'Content-Type':'application/json'},
        signal:AbortSignal.timeout(timeoutMs),
        body:JSON.stringify({model,store:false,instructions,input:JSON.stringify(input),max_output_tokens:6000,
          text:{format:{type:'json_schema',name:'job_analysis',strict:true,schema}}})
      });
      if(!upstream.ok){
        const messages={401:'Invalid OpenAI API key.',403:'No access to the OpenAI project or model.',429:'OpenAI quota exhausted or rate limited. Check API billing and limits.',400:'OpenAI rejected the request. Verify that the model supports Responses and Structured Outputs.',404:'OpenAI model unavailable. Check OPENAI_MODEL.'};
        throw fail(502,messages[upstream.status]||'OpenAI is temporarily unavailable. Retry manually later.');
      }
      const response=await upstream.json();
      if(response.status!=='completed')throw fail(502,'Model output was incomplete; no result saved. Review the model configuration before retrying.');
      const content=(response.output||[]).filter(x=>x.type==='message').flatMap(x=>x.content||[]);
      if(content.some(x=>x.type==='refusal'))throw fail(422,'The model declined to analyze this request.');
      let result;
      try{result=JSON.parse(content.filter(x=>x.type==='output_text').map(x=>x.text).join(''));}catch{throw fail(502,'The model returned invalid JSON.');}
      if(!validate(result))throw fail(502,'Model output failed schema validation.');
      if(result.recommendedResume!=='undetermined'&&!input.resumes[result.recommendedResume].trim())throw fail(502,'The model recommended a resume that was not supplied.');
      // Reject invented evidence instead of displaying it as a verified citation.
      for(const item of result.requirements){
        if(!item.jdEvidence.trim()||!input.jd.includes(item.jdEvidence))throw fail(502,'A model JD excerpt did not match the source text.');
        if(item.resume==='none'?(item.resumeEvidence!==''||item.assessment==='supported'||item.assessment==='partial'):
          (!item.resumeEvidence.trim()||!input.resumes[item.resume].includes(item.resumeEvidence)))throw fail(502,'A model resume excerpt did not match the source text.');
      }
      send(200,{result,model:response.model||model,usage:response.usage||null,analyzedAt:new Date().toISOString()});
    }catch(e){send(e.status||502,{error:e.status?e.message:e.name==='TimeoutError'?'OpenAI request timed out; no automatic retry was made.':'Could not complete the model request. Check your network and backend configuration.'});}
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

