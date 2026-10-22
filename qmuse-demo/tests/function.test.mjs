import test from 'node:test';
import assert from 'node:assert/strict';
import {createHandler} from '../functions/card-suggestion/src/handler.mjs';
import {dayAt} from '../functions/card-suggestion/src/quota.mjs';

function setup({suggest=async()=>['photo']}={}){
  const rows=new Map();let now=Date.UTC(2026,9,21,1),calls=0;
  const store={async count(scope){return [...rows.values()].filter(r=>r.scope===scope).length;},async create(id,data){if(rows.has(id))throw Object.assign(Error('Conflict'),{code:409});rows.set(id,data);},async purge(time){for(const [id,row] of rows)if(row.expiresAt<time)rows.delete(id);}};
  const options={clock:()=>now,suggest:async(...args)=>{calls++;return suggest(...args);}};
  const invoke=(handler,user='synthetic-visitor',body={action:'suggest',text:'想看家人的照片',consent:true},apiKey='synthetic-not-a-real-key')=>handler({req:{headers:user?{'x-appwrite-user-id':user}:{},bodyJson:body,bodyText:JSON.stringify(body)},res:{json:(body,status)=>({body,status})}},{apiKey,store});
  const handler=createHandler(options);
  return {rows,store,invoke:(...args)=>invoke(handler,...args),restart:()=>createHandler(options),invokeOther:invoke,advance:ms=>now+=ms,get now(){return now;},get calls(){return calls;}};
}
test('model missing remains explicitly disabled; status never exposes key',async()=>{const s=setup();const r=await s.invoke('u',{action:'status'},'');assert.equal(r.body.aiAvailable,false);assert.equal((await s.invoke('u',undefined,'')).status,503);assert.equal(s.calls,0);});
test('identity must be trusted platform header; consent and input validated before reservation',async()=>{const s=setup();assert.equal((await s.invoke('',{action:'suggest',userId:'fake',text:'hi',consent:true})).status,403);assert.equal((await s.invoke('u',{action:'suggest',text:'hi',consent:false})).status,400);assert.equal((await s.invoke('u',{action:'suggest',text:'x'.repeat(501),consent:true})).status,400);assert.equal(s.rows.size,0);});
test('concurrent same-visitor requests cannot exceed two per minute across new handlers',async()=>{const s=setup();const results=await Promise.all(Array.from({length:12},()=>s.invoke()));assert.equal(results.filter(r=>r.status===200).length,2);assert.equal(s.calls,2);assert.equal((await s.invokeOther(s.restart())).status,429);});
test('failed suggestions retain durable daily slots; errors do not leak provider diagnostics',async()=>{const s=setup({suggest:async()=>{throw Error('private diagnostic');}});for(let i=0;i<5;i++){s.advance(60000);const r=await s.invoke();assert.equal(r.status,503);assert.equal(JSON.stringify(r).includes('diagnostic'),false);}s.advance(60000);assert.equal((await s.invoke()).status,429);assert.equal(s.calls,5);});
test('global daily 50 limit and global minute 10 persist across visitors and handlers',async()=>{const s=setup();for(let g=0;g<5;g++){if(g)s.advance(60000);const results=await Promise.all(Array.from({length:10},(_,i)=>s.invoke(`visitor-${g}-${i}`)));assert.equal(results.filter(r=>r.status===200).length,10);}s.advance(60000);assert.equal((await s.invokeOther(s.restart(),'new-user')).status,429);assert.equal(s.calls,50);assert.equal(await s.store.count(`g:${dayAt(s.now)}`),50);});
test('day boundaries use Beijing time; cleanup only removes expired old slots',async()=>{assert.equal(dayAt(Date.UTC(2026,9,21,16)),'2026-10-22');const s=setup();await s.invoke();assert.equal(s.rows.size,4);await s.store.purge(s.now);assert.equal(s.rows.size,4);s.advance(4*86400000);await s.invoke('u',{action:'status'});assert.equal(s.rows.size,0);});
test('stored quota contains no input, photo, raw visitor identity or key',async()=>{const s=setup();assert.equal((await s.invoke('synthetic-private-visitor')).status,200);const value=JSON.stringify([...s.rows]);for(const forbidden of ['照片','synthetic-private-visitor','synthetic-not-a-real-key','text','photo'])assert.equal(value.includes(forbidden),false);});
