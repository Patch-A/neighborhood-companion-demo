import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {createHandler} from '../worker.mjs';

function database(){
  const sql=new DatabaseSync(':memory:');sql.exec(readFileSync(new URL('../migrations/0001_usage.sql',import.meta.url),'utf8'));
  return {sql,prepare(query){return {bind(...values){return {
    async first(){return sql.prepare(query).get(...values)||null;},async run(){return sql.prepare(query).run(...values);},
  };}};}};
}
const origin='https://demo.example';
function setup({suggest=async()=>['photo']}={}){
  let now=Date.UTC(2026,9,20,1);const DB=database();let calls=0;
  const env={DB,AI_ENABLED:'true',FAMILY_AI_API_KEY:'synthetic-key-not-a-real-secret',ASSETS:{fetch:async()=>new Response('synthetic page')}};
  const makeHandler=()=>createHandler({clock:()=>now,suggest:async(...args)=>{calls++;return suggest(...args);}});
  const handle=makeHandler();
  const get=()=>handle(new Request(origin+'/api/status'),env);
  const send=(token,ip='192.0.2.1',body={text:'想看家人照片',consent:true},extra={})=>handle(new Request(origin+'/api/suggest',{
    method:'POST',headers:{origin,'content-type':'application/json','x-local-token':token,'cf-connecting-ip':ip,...extra},body:typeof body==='string'?body:JSON.stringify(body),
  }),env);
  return {DB,env,handle,get,send,makeHandler,get calls(){return calls;},advance(ms){now+=ms;}};
}
test('AI is closed by default; secrets and quota metadata are not exposed',async()=>{
  const s=setup();delete s.env.AI_ENABLED;
  const status=await (await s.get()).json();assert.equal(status.aiAvailable,false);assert.equal(status.token,'');
  assert.equal((await s.send('anything')).status,503);assert.equal(s.calls,0);
  assert.equal(JSON.stringify(status).includes(s.env.FAMILY_AI_API_KEY),false);
});
test('same-origin valid token permits fixed-card suggestion; SQL stores no text or raw IP',async()=>{
  const s=setup(),status=await (await s.get()).json();
  const result=await s.send(status.token);assert.equal(result.status,200);assert.deepEqual((await result.json()).cards,['photo']);
  const row=s.DB.sql.prepare('SELECT * FROM ai_reservations').get();assert.equal(row.client.length,64);
  assert.equal(JSON.stringify(row).includes('192.0.2.1'),false);assert.equal(JSON.stringify(row).includes('照片'),false);
});
test('forged, expired, other-origin and cross-site requests never reach the model',async()=>{
  const s=setup(),{token}=await (await s.get()).json();
  assert.equal((await s.send(token,'192.0.2.1',undefined,{origin:'https://evil.example'})).status,403);
  assert.equal((await s.send(token+'0')).status,403);
  assert.equal((await s.send(token,'192.0.2.1',undefined,{'sec-fetch-site':'cross-site'})).status,403);
  const wrongHost=await s.handle(new Request('https://other.example/api/suggest',{method:'POST',headers:{origin:'https://other.example','x-local-token':token,'content-type':'application/json','cf-connecting-ip':'192.0.2.1'},body:JSON.stringify({text:'hi',consent:true})}),s.env);
  assert.equal(wrongHost.status,403);s.advance(31*60000);assert.equal((await s.send(token)).status,403);assert.equal(s.calls,0);
});
test('missing trusted client address, missing consent, wrong content type and oversized input fail closed',async()=>{
  const s=setup(),{token}=await (await s.get()).json();
  assert.equal((await s.send(token,'')).status,503);
  assert.equal((await s.send(token,'192.0.2.1',{text:'hi',consent:false})).status,400);
  assert.equal((await s.send(token,'192.0.2.1',undefined,{'content-type':'text/plain'})).status,415);
  assert.equal((await s.send(token,'192.0.2.1','x'.repeat(8001))).status,413);assert.equal(s.calls,0);
});
test('concurrent requests share atomic IP minute quota and persist across handler restart',async()=>{
  const s=setup(),{token}=await (await s.get()).json();
  const results=await Promise.all(Array.from({length:12},()=>s.send(token)));
  assert.equal(results.filter(r=>r.status===200).length,2);assert.equal(s.calls,2);
  const other=s.makeHandler();const result=await other(new Request(origin+'/api/suggest',{method:'POST',headers:{origin,'x-local-token':token,'content-type':'application/json','cf-connecting-ip':'192.0.2.1'},body:JSON.stringify({text:'hi',consent:true})}),s.env);
  assert.equal(result.status,429);assert.equal(s.calls,2);assert.equal(s.DB.sql.prepare('SELECT COUNT(*) AS n FROM ai_reservations').get().n,2);
});
test('failed model calls count; IP daily quota survives new tokens and minute rollover',async()=>{
  const s=setup({suggest:async()=>{throw Error('private upstream diagnostics');}});
  for(let i=0;i<5;i++){s.advance(60000);const {token}=await (await s.get()).json();const result=await s.send(token);assert.equal(result.status,503);assert.equal((await result.text()).includes('diagnostics'),false);}
  s.advance(60000);const {token}=await (await s.get()).json();assert.equal((await s.send(token)).status,429);assert.equal(s.calls,5);
});
test('global 10/minute and 50/day quotas hold across distinct clients',async()=>{
  const s=setup();let {token}=await (await s.get()).json();
  for(let i=0;i<10;i++)assert.equal((await s.send(token,`192.0.2.${i+1}`)).status,200);
  assert.equal((await s.send(token,'192.0.2.20')).status,429);
  for(let group=1;group<5;group++){s.advance(60000);token=(await (await s.get()).json()).token;
    for(let i=0;i<10;i++)assert.equal((await s.send(token,`192.0.2.${group*10+i+1}`)).status,200);}
  s.advance(60000);token=(await (await s.get()).json()).token;assert.equal((await s.send(token,'192.0.2.90')).status,429);assert.equal(s.calls,50);
  s.advance(86400000);token=(await (await s.get()).json()).token;assert.equal((await s.send(token)).status,200);
});
test('D1 errors stop paid calls, and private/unknown paths are not served as assets',async()=>{
  const s=setup(),{token}=await (await s.get()).json();s.env.DB.prepare=()=>{throw Error('private database diagnostics');};
  const result=await s.send(token);assert.equal(result.status,503);assert.equal(s.calls,0);assert.equal((await result.text()).includes('diagnostics'),false);
  for(const path of ['/.env.local','/worker.mjs','/api/unknown'])assert.equal((await s.handle(new Request(origin+path),s.env)).status,404);
  const asset=await s.handle(new Request(origin+'/'),s.env);assert.equal(asset.status,200);assert.match(asset.headers.get('Content-Security-Policy'),/frame-ancestors 'none'/);
});
test('navigation from a contest or shared link loads the page; cross-site API calls remain rejected',async()=>{
  const s=setup();
  const page=await s.handle(new Request(origin+'/',{headers:{'sec-fetch-site':'cross-site','sec-fetch-mode':'navigate'}}),s.env);
  assert.equal(page.status,200);assert.equal(await page.text(),'synthetic page');
  const status=await s.handle(new Request(origin+'/api/status',{headers:{'sec-fetch-site':'cross-site'}}),s.env);
  assert.equal(status.status,403);assert.equal(s.calls,0);
});
