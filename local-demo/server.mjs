import {createServer} from 'node:http';
import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {randomBytes,timingSafeEqual} from 'node:crypto';
import {join} from 'node:path';
import {parseEnv} from 'node:util';
import {requestCardSuggestion} from './lib/family-ai.mjs';

const ROOT=fileURLToPath(new URL('.',import.meta.url));
const securityHeaders={
  'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer',
  'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
  'Cross-Origin-Resource-Policy':'same-origin','Permissions-Policy':'camera=(), microphone=(), geolocation=()',
};
const assets=new Map([
  ['/','index.html'],['/index.html','index.html'],['/app.mjs','app.mjs'],['/state.mjs','state.mjs'],
  ['/cards.mjs','cards.mjs'],['/styles.css','styles.css'],
  ...['miss-you','photo','walk','hello','again','later'].map(id=>[`/cards/${id}.svg`,`cards/${id}.svg`]),
]);
const mime={html:'text/html; charset=utf-8',mjs:'text/javascript; charset=utf-8',css:'text/css; charset=utf-8',svg:'image/svg+xml; charset=utf-8'};
function fail(message,status=400){return Object.assign(new Error(message),{status});}
function json(res,status,value){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8',...securityHeaders});res.end(JSON.stringify(value));}
export async function configuration(){
  let file={};try{file=parseEnv(await readFile(join(ROOT,'.env.local'),'utf8'));}catch(e){if(e.code!=='ENOENT')throw Error('Cannot read local configuration.');}
  return {apiKey:process.env.FAMILY_AI_API_KEY||file.FAMILY_AI_API_KEY||process.env.DEEPSEEK_API_KEY||'',model:process.env.FAMILY_AI_MODEL||file.FAMILY_AI_MODEL||'deepseek-flash',port:Number(process.env.PORT||file.PORT||3133)};
}
export async function createLocalServer({apiKey='',model='deepseek-flash',dataDir=join(ROOT,'data'),suggest=requestCardSuggestion,dailyLimit=200,clock=()=>Date.now()}={}){
  const token=randomBytes(32).toString('hex');
  let inFlight=0,recent=[],serial=Promise.resolve();
  const today=()=>new Date(clock()+8*3600000).toISOString().slice(0,10);
  await mkdir(dataDir,{recursive:true});
  let quota={day:today(),count:0};
  try{const saved=JSON.parse(await readFile(join(dataDir,'usage.json'),'utf8'));
    if(typeof saved.day!=='string'||!Number.isSafeInteger(saved.count)||saved.count<0)throw Error('invalid');
    quota=saved;
  }catch(e){if(e.code!=='ENOENT')throw Error('Local AI usage file is unreadable. Preserve it and check data/usage.json before starting.');}
  async function reserve(){
    const work=serial.then(async()=>{
      const now=clock();recent=recent.filter(t=>now-t<60000);
      if(recent.length>=10)throw fail('请求有点频繁，请一分钟后再试。',429);
      const next={day:today(),count:(quota.day===today()?quota.count:0)+1};
      if(next.count>dailyLimit)throw fail('今天的 AI 次数已用完，请手动选图卡；明天再试。',429);
      // Persist the reservation before issuing a paid request; failures count, too.
      await writeFile(join(dataDir,'usage.next'),JSON.stringify(next),{mode:0o600});
      await rename(join(dataDir,'usage.next'),join(dataDir,'usage.json'));
      quota=next;recent.push(now);
    });serial=work.catch(()=>{});return work;
  }
  const server=createServer({maxHeaderSize:8192,requestTimeout:25000,headersTimeout:10000},async(req,res)=>{
    try{
      const address=server.address();const port=address&&typeof address==='object'?address.port:0;
      const validHosts=[`127.0.0.1:${port}`,`localhost:${port}`];
      if(!validHosts.includes(req.headers.host)||req.headers['sec-fetch-site']==='cross-site')throw fail('请从本机演示网址打开页面。',403);
      const url=new URL(req.url,`http://${req.headers.host}`);
      if(req.method==='GET'&&url.pathname==='/api/status')return json(res,200,{aiAvailable:!!apiKey,provider:'DeepSeek',token,dailyLimit,usedToday:quota.day===today()?quota.count:0});
      if(url.pathname==='/api/suggest'){
        if(req.method!=='POST')throw fail('请使用页面中的 AI 按钮。',405);
        const origin=`http://${req.headers.host}`;
        const supplied=req.headers['x-local-token'];
        if(req.headers.origin!==origin||typeof supplied!=='string'||!/^[a-f\d]{64}$/.test(supplied)||!timingSafeEqual(Buffer.from(supplied),Buffer.from(token)))throw fail('页面已失效或来源不正确，请刷新本机页面。',403);
        if(!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type']||''))throw fail('提交格式不正确。',415);
        if(Number(req.headers['content-length'])>8000)throw fail('输入过长，请缩短后重试。',413);
        const chunks=[];let length=0;
        for await(const chunk of req){length+=chunk.length;if(length>8000)throw fail('输入过长，请缩短后重试。',413);chunks.push(chunk);}
        let body;try{body=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw fail('输入无法读取。');}
        if(!body||typeof body!=='object'||body.consent!==true||typeof body.text!=='string'||!body.text.trim()||body.text.length>500)throw fail('请填写1–500字，并确认将这句示例文字交给 DeepSeek。');
        if(!apiKey)throw fail('本地 AI 尚未配置。请在 .env.local 配置密钥后重启，或直接手动选图卡。',503);
        if(inFlight>=2)throw fail('AI 正在处理其他请求，请稍后再试。',429);
        inFlight++;
        try{await reserve();const cards=await suggest({baseUrl:'https://api.deepseek.com',apiKey,model},body.text.trim());
          return json(res,200,{cards,usedToday:quota.count,dailyLimit});
        }finally{inFlight--;}
      }
      if(!['GET','HEAD'].includes(req.method))throw fail('这个地址不支持该操作。',405);
      const asset=assets.get(url.pathname);if(!asset)throw fail('没有这个页面或文件。',404);
      const bytes=await readFile(join(ROOT,'public',asset));
      res.writeHead(200,{'Content-Type':mime[asset.split('.').pop()],...securityHeaders,'Content-Length':bytes.length});res.end(req.method==='HEAD'?undefined:bytes);
    }catch(e){
      // Keep upstream and filesystem diagnostics private; never echo keys or model bodies.
      const status=Number.isInteger(e.status)?e.status:503;
      if(!res.headersSent)json(res,status,e.status?{error:e.message}:{error:'本地服务暂时没有完成，请稍后重试或手动选择图卡。'});
      else res.end();
      req.resume();
    }
  });
  return server;
}
export async function start(){
  const config=await configuration();
  if(!Number.isInteger(config.port)||config.port<1024||config.port>65535)throw Error('PORT must be an integer between 1024 and 65535.');
  const server=await createLocalServer(config);
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(config.port,'127.0.0.1',resolve);});
  console.log(`Local demo ready: http://127.0.0.1:${config.port}`);
  console.log(config.apiKey?'DeepSeek configured. Only explicitly submitted text is sent.':'DeepSeek is not configured. Manual picture cards work without a key.');
  console.log('Virtual family demo; loopback only. Press Ctrl+C to stop.');
  return server;
}
if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url){start().catch(e=>{
  console.error(e.code==='EADDRINUSE'?'Port already in use. Close the previous demo, or set PORT in .env.local.':e.message);process.exitCode=1;
});}
