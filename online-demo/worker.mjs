import {requestCardSuggestion} from '../local-demo/lib/family-ai.mjs';
import {reserve,usedToday,dayAt} from './quota.mjs';

const encoder=new TextEncoder();
const headers={
  'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer',
  'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
  'Cross-Origin-Resource-Policy':'same-origin','Permissions-Policy':'camera=(), microphone=(), geolocation=()',
};
const paths=new Set(['/','/index.html','/app.mjs','/state.mjs','/cards.mjs','/styles.css',
  ...['miss-you','photo','walk','hello','again','later'].map(x=>`/cards/${x}.svg`)]);
function fail(message,status=400){return Object.assign(new Error(message),{status});}
function json(status,value){return new Response(JSON.stringify(value),{status,headers:{...headers,'Content-Type':'application/json; charset=utf-8'}});}
function hex(buffer){return [...new Uint8Array(buffer)].map(x=>x.toString(16).padStart(2,'0')).join('');}
async function signingKey(secret){
  // Domain separation: no API secret or reversible derivative is sent to the browser.
  const digest=await crypto.subtle.digest('SHA-256',encoder.encode(`companion-demo-session-v1:${secret}`));
  return crypto.subtle.importKey('raw',digest,{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
}
async function sign(key,text){return hex(await crypto.subtle.sign('HMAC',key,encoder.encode(text)));}
async function issueToken(key,origin,now){
  const body=`${now}.${hex(crypto.getRandomValues(new Uint8Array(16)))}`;
  return `${body}.${await sign(key,`${origin}:${body}`)}`;
}
async function validToken(key,origin,token,now){
  if(typeof token!=='string'||!/^\d{13}\.[a-f\d]{32}\.[a-f\d]{64}$/.test(token))return false;
  const [issued,nonce,signature]=token.split('.');
  if(now-Number(issued)>30*60000||Number(issued)>now+30000)return false;
  const bytes=Uint8Array.from(signature.match(/../g),x=>parseInt(x,16));
  return crypto.subtle.verify('HMAC',key,bytes,encoder.encode(`${origin}:${issued}.${nonce}`));
}
async function readBody(request){
  if(Number(request.headers.get('content-length'))>8000)throw fail('输入过长，请缩短后重试。',413);
  const reader=request.body?.getReader();if(!reader)throw fail('请填写示例内容。');
  let size=0;const chunks=[];
  for(;;){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;
    if(size>8000){await reader.cancel();throw fail('输入过长，请缩短后重试。',413);}chunks.push(value);}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{throw fail('输入无法读取。');}
}
export function createHandler({suggest=requestCardSuggestion,clock=()=>Date.now()}={}){
  return async function handle(request,env){
    try{
      const url=new URL(request.url),now=clock();
      if(url.pathname.startsWith('/api/')){
        if(request.headers.get('sec-fetch-site')==='cross-site')throw fail('请直接打开作品页面。',403);
        const configured=env.AI_ENABLED==='true'&&!!env.FAMILY_AI_API_KEY&&!!env.DB;
        if(url.pathname==='/api/status'&&request.method==='GET'){
          if(!configured)return json(200,{aiAvailable:false,provider:'DeepSeek',token:'',dailyLimit:50,usedToday:0});
          const key=await signingKey(env.FAMILY_AI_API_KEY);
          return json(200,{aiAvailable:true,provider:'DeepSeek',dailyLimit:50,usedToday:await usedToday(env.DB,now),token:await issueToken(key,url.origin,now)});
        }
        if(url.pathname!=='/api/suggest')throw fail('没有这个接口。',404);
        if(request.method!=='POST')throw fail('请使用页面中的 AI 按钮。',405);
        if(request.headers.get('origin')!==url.origin)throw fail('页面来源不正确，请刷新作品页面。',403);
        if(!configured)throw fail('在线 AI 暂未开放，请先手动选图卡。',503);
        const key=await signingKey(env.FAMILY_AI_API_KEY);
        if(!await validToken(key,url.origin,request.headers.get('x-local-token'),now))throw fail('页面已过期，请刷新后重试。',403);
        if(!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type')||''))throw fail('提交格式不正确。',415);
        const body=await readBody(request);
        if(!body||typeof body!=='object'||body.consent!==true||typeof body.text!=='string'||!body.text.trim()||body.text.length>500)throw fail('请填写1–500字，并同意处理这句示例文字。');
        // Only Cloudflare's edge-set header is trusted. Missing IP fails closed for AI.
        const ip=request.headers.get('cf-connecting-ip');
        if(!ip||ip.length>64)throw fail('暂时不能核验请求来源，请手动选图卡。',503);
        const client=await sign(key,`quota:${dayAt(now)}:${ip}`);
        if(!await reserve(env.DB,client,now))throw fail('本次投稿演示的 AI 次数已达上限，请稍后或明天再试，也可以手动选图卡。',429);
        const cards=await suggest({baseUrl:'https://api.deepseek.com',apiKey:env.FAMILY_AI_API_KEY,model:env.FAMILY_AI_MODEL||'deepseek-flash'},body.text.trim());
        return json(200,{cards,usedToday:await usedToday(env.DB,now),dailyLimit:50});
      }
      if(!['GET','HEAD'].includes(request.method))throw fail('这个地址不支持该操作。',405);
      if(!paths.has(url.pathname))throw fail('没有这个页面或文件。',404);
      const asset=await env.ASSETS.fetch(request);
      const response=new Response(asset.body,asset);for(const [name,value] of Object.entries(headers))response.headers.set(name,value);
      return response;
    }catch(e){
      const status=Number.isInteger(e.status)?e.status:503;
      return json(status,{error:e.status?e.message:'服务暂时无法完成，请稍后重试或手动选图卡。'});
    }
  };
}
export default {fetch:createHandler()};
