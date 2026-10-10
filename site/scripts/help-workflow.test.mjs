import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {runInNewContext} from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

const cache=new Map();
function load(filename){
  if(cache.has(filename))return cache.get(filename);
  const compiled={exports:{}};
  const {outputText}=ts.transpileModule(readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}});
  runInNewContext(outputText,{module:compiled,exports:compiled.exports,crypto:globalThis.crypto,require:id=>load(resolve(dirname(filename),id+'.ts'))},{filename});
  cache.set(filename,compiled.exports);return compiled.exports;
}
const {applyHelpAction,mediaRefs}=load(fileURLToPath(new URL('../lib/help-workflow.ts',import.meta.url)));
const {initialState}=load(fileURLToPath(new URL('../lib/care-data.ts',import.meta.url)));
const now='2026-10-08T13:00:00.000Z';
function action(state,name,actor='family',data={}){applyHelpAction(state,{action:name,actor,requestId:state.requests[0].id,...data},now);}
test('family completion still waits for elder; only elder closes it',()=>{
  const s=initialState();action(s,'family-view');assert.equal(s.requests[0].status,'pending_family');assert.ok(s.requests[0].familyViewedAt);
  action(s,'family-accept');action(s,'complete-help');assert.equal(s.requests[0].status,'awaiting_confirmation');
  assert.throws(()=>action(s,'confirm-help','family'));action(s,'confirm-help','elder');assert.equal(s.requests[0].status,'completed');assert.ok(s.requests[0].resolvedAt);
});
test('declined and unresolved tasks can be picked up again',()=>{
  const s=initialState();action(s,'family-decline');action(s,'family-accept');action(s,'complete-help');action(s,'not-resolved','elder');assert.equal(s.requests[0].status,'not_resolved');action(s,'family-accept');assert.equal(s.requests[0].status,'family_accepted');
});
test('volunteer needs family forwarding; risk check and high-risk block enforced',()=>{
  const s=initialState();assert.throws(()=>action(s,'volunteer-accept','volunteer'));action(s,'family-decline');assert.throws(()=>action(s,'family-forward'));action(s,'family-forward','family',{riskChecked:true});action(s,'volunteer-accept','volunteer');action(s,'arrange-help','volunteer',{schedule:'明天下午，社区活动室'});action(s,'complete-help','volunteer');assert.equal(s.requests[0].status,'awaiting_confirmation');
  const h=initialState();h.requests[0].risk='high';action(h,'family-accept');assert.throws(()=>action(h,'family-forward','family',{riskChecked:true}));
});
test('voice/photo alone is accepted, unknown risk stays under family review, retry deduplicates',()=>{
  const s=initialState();const clientId=crypto.randomUUID();const media=[{id:'local-'+crypto.randomUUID(),kind:'audio',mime:'audio/webm;codecs=opus',size:1234,name:'录音'}];
  const data={type:'想找人聊聊',clientId,media,payment:'unknown',distant:'unknown'};
  action(s,'create-help','elder',data);assert.equal(s.requests[0].risk,'medium');assert.equal(s.requests[0].media[0].kind,'audio');const count=s.requests.length;action(s,'create-help','elder',data);assert.equal(s.requests.length,count);
  action(s,'create-help','elder',{...data,clientId:crypto.randomUUID(),payment:'yes'});assert.equal(s.requests[0].risk,'high');
});
test('voice reply persists as a local-only reference and deduplicates',()=>{
  const s=initialState();const clientId=crypto.randomUUID();const data={clientId,text:'我看到了',media:[{id:'local-'+crypto.randomUUID(),kind:'audio',mime:'audio/mp4',size:100,name:'语音回应'}]};
  action(s,'reply-help','family',data);action(s,'reply-help','family',data);assert.equal(s.requests[0].replies.length,1);assert.equal(s.requests[0].status,'pending_family');
});
test('invalid media, empty help, and invalid transitions are rejected',()=>{
  assert.throws(()=>mediaRefs([{id:'https://evil.invalid',kind:'image',mime:'image/svg+xml',size:100}]));
  const s=initialState();assert.throws(()=>action(s,'create-help','elder',{type:'帮我看看',clientId:crypto.randomUUID(),description:''}));assert.throws(()=>action(s,'complete-help','family'));assert.throws(()=>action(s,'family-accept','elder'));
});
