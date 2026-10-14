import assert from 'node:assert/strict';
import {after,before,test} from 'node:test';
import {randomUUID} from 'node:crypto';

// Trusted identity headers simulate Sites dispatch ONLY on loopback test Workers.
// Never run these fixtures against a hosted Site or real household.
const base=new URL(process.env.FAMILY_TEST_URL||'http://127.0.0.1:8787');
assert.ok(['127.0.0.1','localhost','[::1]'].includes(base.hostname),'Family integration tests must run on loopback');
const prefix=`fixture-${randomUUID()}`;
const owner=`${prefix}-owner`,elder=`${prefix}-elder`,other=`${prefix}-other`,outsider=`${prefix}-outsider`;
const image=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j6WQAAAAASUVORK5CYII=','base64');
let invite='',attachment='',messageId='',clientId=randomUUID();
const created=[];
async function call(user,path,body,extra={}){
  const headers=user?{'oai-authenticated-user-id':user,'oai-authenticated-user-email':`${user}@sites.test`}:{};
  const res=await fetch(new URL(path,base),{headers:{...headers,...(body?{'Content-Type':'application/json'}:{}),...extra},...(body?{method:'POST',body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(15000)});
  const raw=await res.text();let result;try{result=JSON.parse(raw);}catch{throw new Error(`Non-JSON ${res.status}: ${raw.slice(0,300)}`);}return {status:res.status,result};
}
const action=(user,body,extra)=>call(user,'/api/family/action',body,extra);
async function media(user,id,headers={}){return fetch(new URL(`/api/family/media/${id}`,base),{headers:{'oai-authenticated-user-id':user,'oai-authenticated-user-email':`${user}@sites.test`,...headers},signal:AbortSignal.timeout(10000)});}
before(async()=>{
  for(const user of [owner,other]){const result=await action(user,{action:'create',name:'自动验收家庭',memberName:'测试家人'});assert.equal(result.status,200);created.push(user);}
  const result=await action(owner,{action:'invite',role:'elder'});assert.equal(result.status,200);invite=result.result.token;
});
after(async()=>{
  for(const user of created){const result=await action(user,{action:'delete-household'});assert.equal(result.status,200,'Synthetic test household cleanup');}
});
test('anonymous mutation rejected; cross-origin mutation rejected',async()=>{
  assert.equal((await action(null,{action:'create',name:'无身份',memberName:'未知'})).status,401);
  assert.equal((await action(owner,{action:'review-cards',reviewed:true},{Origin:'https://untrusted.example'})).status,403);
});
test('invite binds stored elder role; client actor cannot elevate it',async()=>{
  const joined=await action(elder,{action:'join',token:invite,name:'测试老人',role:'family',actor:'family'});assert.equal(joined.status,200);
  const snapshot=await call(elder,'/api/family');assert.equal(snapshot.result.members.find(m=>m.userId===elder).role,'elder');
  assert.equal((await action(elder,{action:'invite',role:'family',actor:'family'})).status,403);
  assert.equal((await action(elder,{action:'review-cards',reviewed:true,actor:'family'})).status,403);
  assert.equal((await action(elder,{action:'delete-household',actor:'family'})).status,403);
});
test('invitation cannot be reused or invented',async()=>{
  assert.equal((await action(outsider,{action:'join',token:invite,name:'另一测试者'})).status,410);
  assert.equal((await action(outsider,{action:'join',token:'not-a-real-token',name:'另一测试者'})).status,410);
});
test('elder sends only after familiarizing cards; foreign recipient rejected',async()=>{
  assert.equal((await action(elder,{action:'send',cards:['hello'],text:'',mediaIds:[],clientId:randomUUID(),recipientId:owner})).status,409);
  assert.equal((await action(owner,{action:'review-cards',reviewed:true})).status,200);
  assert.equal((await action(owner,{action:'send',cards:['hello'],text:'',mediaIds:[],clientId:randomUUID(),recipientId:other})).status,403);
  assert.equal((await action(owner,{action:'send',cards:['not-a-card'],text:'',mediaIds:[],clientId:randomUUID(),recipientId:elder})).status,400);
});
test('real R2 attachment staged private; forged image signature rejected',async()=>{
  const uploaded=await fetch(new URL('/api/family/media',base),{method:'POST',headers:{'oai-authenticated-user-id':owner,'oai-authenticated-user-email':`${owner}@sites.test`,'Content-Type':'image/png'},body:image});
  assert.equal(uploaded.status,201);attachment=(await uploaded.json()).id;
  assert.equal((await media(elder,attachment)).status,404,'Unsent draft is private to uploader');
  assert.equal((await media(other,attachment)).status,404,'Other household denied');
  const forged=await fetch(new URL('/api/family/media',base),{method:'POST',headers:{'oai-authenticated-user-id':owner,'oai-authenticated-user-email':`${owner}@sites.test`,'Content-Type':'image/png'},body:'<script>bad file</script>'});assert.equal(forged.status,415);
});
test('send and concurrent retries produce one message; snapshot does not invent receipt',async()=>{
  const payload={action:'send',cards:['hello'],text:'测试往返',mediaIds:[attachment],clientId,recipientId:elder};
  const responses=await Promise.all([action(owner,payload),action(owner,payload),action(owner,payload)]);
  assert.ok(responses.every(r=>r.status===200));assert.equal(new Set(responses.map(r=>r.result.id)).size,1);messageId=responses[0].result.id;
  const sender=await call(owner,'/api/family');const found=sender.result.messages.filter(m=>m.id===messageId);assert.equal(found.length,1);assert.equal(found[0].receivedAt,null);assert.equal(found[0].openedAt,null);
  const recipient=await call(elder,'/api/family');assert.equal(recipient.result.messages[0].id,messageId);assert.equal(recipient.result.messages[0].receivedAt,null);
});
test('cross-device bytes readable by recipient; Range works; outsider has no records',async()=>{
  const response=await media(elder,attachment);assert.equal(response.status,200);assert.deepEqual(Buffer.from(await response.arrayBuffer()),image);
  const range=await media(elder,attachment,{Range:'bytes=0-7'});assert.equal(range.status,206);assert.equal((await range.arrayBuffer()).byteLength,8);
  assert.equal((await media(other,attachment)).status,404);
  const snapshot=await call(other,'/api/family');assert.equal(snapshot.result.messages.length,0);
});
test('receipts belong to recipient; open does not create reply or resolve meaning',async()=>{
  await action(other,{action:'receipt',ids:[messageId],kind:'opened'});
  await action(owner,{action:'receipt',ids:[messageId],kind:'opened'});
  assert.equal((await call(owner,'/api/family')).result.messages[0].openedAt,null);
  await action(elder,{action:'receipt',ids:[messageId],kind:'received'});
  let row=(await call(owner,'/api/family')).result.messages[0];assert.ok(row.receivedAt);assert.equal(row.openedAt,null);
  await action(elder,{action:'receipt',ids:[messageId],kind:'opened'});
  row=(await call(owner,'/api/family')).result.messages[0];assert.ok(row.openedAt);assert.equal((await call(owner,'/api/family')).result.messages.length,1);
});
test('elder can send not-understood response; cannot reply to foreign conversation',async()=>{
  const reply=await action(elder,{action:'send',cards:['again'],text:'',mediaIds:[],clientId:randomUUID(),recipientId:owner,replyTo:messageId});assert.equal(reply.status,200);
  const senderSnapshot=await call(owner,'/api/family');assert.ok(senderSnapshot.result.messages.some(m=>m.replyTo===messageId&&m.cards[0]==='again'));
  assert.equal((await action(other,{action:'send',cards:['again'],text:'',mediaIds:[],clientId:randomUUID(),recipientId:owner,replyTo:messageId})).status,403);
});
test('model absent returns honest fallback, role forged cannot call model',async()=>{
  const state=await call(owner,'/api/family');assert.equal(state.result.aiAvailable,false,'No credential in test environment');
  const absent=await call(owner,'/api/family/suggest',{text:'想见你'});assert.equal(absent.status,503);assert.ok(absent.result.error.includes('尚未接入'));
  assert.equal((await call(elder,'/api/family/suggest',{text:'想见你',actor:'family'})).status,403);
  assert.equal((await call(elder,'/api/family/try-ai',{text:'想见你',actor:'family'})).status,403);
  assert.equal((await call(null,'/api/family/try-ai',{text:'想见你'})).status,401);
});
test('feedback isolated to household family role',async()=>{
  assert.equal((await action(elder,{action:'feedback',category:'没看懂',detail:''})).status,200);
  assert.equal((await call(elder,'/api/family/feedback')).status,403);
  assert.equal((await call(owner,'/api/family/feedback')).result.items.length,1);
  assert.equal((await call(other,'/api/family/feedback')).result.items.length,0);
});
test('only sender can withdraw; revoked attachment inaccessible even to sender',async()=>{
  assert.equal((await action(elder,{action:'withdraw',id:messageId})).status,403);
  assert.equal((await action(owner,{action:'withdraw',id:messageId})).status,200);
  const row=(await call(elder,'/api/family')).result.messages.find(m=>m.id===messageId);assert.ok(row.withdrawnAt);assert.equal(row.text,'');assert.deepEqual(row.media,[]);
  assert.equal((await media(elder,attachment)).status,404);assert.equal((await media(owner,attachment)).status,404);
});
test('invitation revocation prevents joining',async()=>{
  const token=(await action(owner,{action:'invite',role:'family'})).result.token;
  assert.equal((await action(owner,{action:'revoke-invites'})).status,200);
  assert.equal((await action(outsider,{action:'join',token,name:'另一测试者'})).status,410);
});
test('early rejections do not break the following request',async()=>{
  assert.equal((await action(owner,{action:'review-cards',reviewed:true},{'Content-Type':'text/plain'})).status,415);
  assert.equal((await call(owner,'/api/family')).status,200);
  const denied=await fetch(new URL('/api/family/media',base),{method:'POST',headers:{'Content-Type':'image/png'},body:image});assert.equal(denied.status,401);await denied.text();
  assert.equal((await action(owner,{action:'review-cards',reviewed:true})).status,200);
});
