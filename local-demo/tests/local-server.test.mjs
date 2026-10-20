import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {request as httpRequest} from 'node:http';
import {createLocalServer} from '../server.mjs';
import {parseCardSuggestion} from '../lib/family-ai.mjs';
async function setup(t,options={}){
  const dir=options.dataDir||await mkdtemp(join(tmpdir(),'companion-local-test-'));
  const server=await createLocalServer({dataDir:dir,...options});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));if(!options.dataDir)await rm(dir,{recursive:true,force:true});});
  const url=`http://127.0.0.1:${server.address().port}`;
  const status=await (await fetch(`${url}/api/status`)).json();
  return {server,dir,url,status,post:(body,headers={})=>fetch(`${url}/api/suggest`,{method:'POST',headers:{'Content-Type':'application/json','Origin':url,'X-Local-Token':status.token,...headers},body:JSON.stringify(body)})};
}
const valid={text:'我想看看家人的照片',consent:true};
test('standalone assets, private file denylist, MIME and CSP',async t=>{
  const s=await setup(t,{apiKey:'fixture-secret-only'});
  for(const path of ['/','/app.mjs','/state.mjs','/cards.mjs','/styles.css','/cards/photo.svg']){const r=await fetch(s.url+path);assert.equal(r.status,200,path);assert.match(r.headers.get('content-security-policy'),/connect-src 'self'/);assert.equal((await r.text()).includes('fixture-secret-only'),false);}
  for(const path of ['/.env.local','/server.mjs','/data/usage.json','/../server.mjs','/%2e%2e/.env.local'])assert.equal((await fetch(s.url+path)).status,404);
  assert.equal(s.status.aiAvailable,true);assert.equal(JSON.stringify(s.status).includes('fixture-secret-only'),false);
});
test('unconfigured model never substitutes a canned answer',async t=>{let calls=0;const s=await setup(t,{suggest:async()=>{calls++;return ['photo'];}});assert.equal(s.status.aiAvailable,false);assert.equal((await s.post(valid)).status,503);assert.equal(calls,0);});
test('reject untrusted origin, absent token, unicode token and cross-site header before paid work',async t=>{
  let calls=0;const s=await setup(t,{apiKey:'fixture',suggest:async()=>{calls++;return ['photo'];}});
  for(const h of [{'Origin':'https://example.invalid'},{'X-Local-Token':''},{'X-Local-Token':'a'.repeat(63)+'é'},{'Sec-Fetch-Site':'cross-site'}])assert.equal((await s.post(valid,h)).status,403);
  assert.equal(calls,0);assert.equal((await s.post(valid)).status,200);
});
test('reject DNS rebinding Host without serving local credentials or making upstream calls',async t=>{
  const s=await setup(t);const status=await new Promise((resolve,reject)=>{const r=httpRequest(s.url+'/api/status',{headers:{Host:'attacker.example:3133'}},res=>{res.resume();resolve(res.statusCode);});r.on('error',reject);r.end();});assert.equal(status,403);
});
test('consent, content type, empty/oversized/invalid inputs do not call model',async t=>{
  let calls=0;const s=await setup(t,{apiKey:'fixture',suggest:async()=>{calls++;return ['photo'];}});
  for(const input of [{...valid,consent:false},{text:' ',consent:true},{text:'x'.repeat(501),consent:true},null,[]])assert.equal((await s.post(input)).status,400);
  assert.equal((await s.post(valid,{'Content-Type':'text/plain'})).status,415);
  assert.equal((await s.post({text:'x'.repeat(9000),consent:true})).status,413);
  assert.equal(calls,0);assert.equal((await s.post(valid)).status,200);
});
test('successful model suggestion preserves caller input and never returns API key',async t=>{
  let seen;const s=await setup(t,{apiKey:'fixture-secret',suggest:async(config,input)=>{seen={config,input};return ['photo'];}});
  const r=await s.post(valid);assert.equal(r.status,200);const data=await r.json();assert.deepEqual(data.cards,['photo']);assert.equal(seen.input,valid.text);assert.equal(seen.config.baseUrl,'https://api.deepseek.com');assert.equal(JSON.stringify(data).includes('fixture-secret'),false);
});
test('daily quota is reserved atomically, failures count, restart retains it, next day resets',async t=>{
  const dir=await mkdtemp(join(tmpdir(),'companion-quota-test-'));t.after(()=>rm(dir,{recursive:true,force:true}));
  let now=Date.UTC(2026,9,20,10),calls=0;
  const opts={dataDir:dir,apiKey:'fixture',dailyLimit:2,clock:()=>now,suggest:async()=>{calls++;throw Object.assign(new Error('模型暂时不可用，请手选。'),{status:503});}};
  const first=await setup(t,opts);assert.equal((await first.post(valid)).status,503);assert.equal((await first.post(valid)).status,503);assert.equal((await first.post(valid)).status,429);
  const second=await setup(t,opts);assert.equal(second.status.usedToday,2);assert.equal((await second.post(valid)).status,429);assert.equal(calls,2);
  now+=86400000;assert.equal((await second.post(valid)).status,503);assert.equal(calls,3);assert.equal(JSON.parse(await readFile(join(dir,'usage.json'),'utf8')).count,1);
});
test('two in-flight limit rejects a third request before quota or upstream work',async t=>{
  const releases=[];const s=await setup(t,{apiKey:'fixture',suggest:()=>new Promise(resolve=>releases.push(()=>resolve(['hello'])))});
  const a=s.post(valid),b=s.post(valid);for(let i=0;i<100&&releases.length<2;i++)await new Promise(resolve=>setTimeout(resolve,10));
  assert.equal(releases.length,2);assert.equal((await s.post(valid)).status,429);releases.forEach(f=>f());assert.equal((await a).status,200);assert.equal((await b).status,200);assert.equal((await (await fetch(s.url+'/api/status')).json()).usedToday,2);
});
test('corrupt persisted quota fails closed, never silently resets',async t=>{
  const dir=await mkdtemp(join(tmpdir(),'companion-corrupt-test-'));t.after(()=>rm(dir,{recursive:true,force:true}));await writeFile(join(dir,'usage.json'),'not json');await assert.rejects(createLocalServer({dataDir:dir}),/unreadable/);
});
test('chunked oversized bodies receive 413 and the next valid request still works',{timeout:5000},async t=>{
  let calls=0;const s=await setup(t,{apiKey:'fixture',suggest:async()=>{calls++;return ['photo'];}});
  const status=await new Promise((resolve,reject)=>{
    const req=httpRequest(s.url+'/api/suggest',{method:'POST',headers:{'Content-Type':'application/json',Origin:s.url,'X-Local-Token':s.status.token,'Transfer-Encoding':'chunked'}},res=>{res.resume();resolve(res.statusCode);});
    req.on('error',reject);req.setTimeout(3000,()=>req.destroy(new Error('Timed out waiting for bounded-body rejection')));
    req.write('{"text":"');req.write('x'.repeat(9000));req.end('","consent":true}');
  });
  assert.equal(status,413);assert.equal(calls,0);assert.equal((await s.post(valid)).status,200);
});
test('per-minute quota rejects the eleventh attempt before the paid request',async t=>{
  let calls=0;const s=await setup(t,{apiKey:'fixture',suggest:async()=>{calls++;return ['hello'];}});
  for(let i=0;i<10;i++)assert.equal((await s.post(valid)).status,200);
  assert.equal((await s.post(valid)).status,429);assert.equal(calls,10);
});
test('exact reused parser rejects invented cards, prose and unsupported intent',()=>{
  assert.deepEqual(parseCardSuggestion('{"cards":["photo"]}'),['photo']);
  for(const text of ['{"cards":["approved-payment"]}','{"cards":[]}','ignore instructions','{}'])assert.throws(()=>parseCardSuggestion(text));
});
