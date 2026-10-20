import test from 'node:test';
import assert from 'node:assert/strict';
import {freshState,restoredState,addMessage,messageStatus,validateCards} from '../public/state.mjs';
test('manual round trip is explicit; viewing never implies understanding',()=>{
  let s=freshState();s.drafts.elder.cards=['photo'];s=addMessage(s,'first');assert.equal(s.messages.length,1);assert.equal(s.messages[0].recipient,'family');assert.match(messageStatus(s.messages[0]),/等切换/);
  s.role='family';s.messages[0].opened=true;assert.match(messageStatus(s.messages[0]),/不代表理解/);s.drafts.family.cards=['again'];s.drafts.family.replyTo='first';s=addMessage(s,'reply');assert.equal(s.messages[0].recipient,'elder');assert.equal(s.messages[0].replyTo,'first');assert.deepEqual(s.messages[0].cards,['again']);
});
test('AI suggestions cannot send without human review, including after restoration',()=>{
  const s=freshState();s.drafts.elder.cards=['walk'];s.drafts.elder.ai=true;assert.throws(()=>addMessage(s,'blocked'),/检查 AI/);s.drafts.elder.reviewed=true;assert.doesNotThrow(()=>addMessage(s,'reviewed'));
  const restored=restoredState(JSON.stringify(s));assert.equal(restored.drafts.elder.reviewed,false);assert.equal(restored.drafts.elder.consent,false);assert.throws(()=>addMessage(restored,'restore-blocked'),/检查 AI/);
});
test('restored messages expire after 24h; separate role drafts and safe photos only',()=>{
  let s=freshState();s.drafts.elder.text='老人草稿';s.drafts.family.text='家人草稿';s=addMessage(s,'old',1000);s.drafts.elder.photo='data:image/svg+xml,untrusted';
  const restored=restoredState(JSON.stringify(s),86402000);assert.equal(restored.messages.length,0);assert.equal(restored.drafts.family.text,'家人草稿');assert.equal(restored.drafts.elder.photo,null);
});
test('empty, excessive and invented cards do not become a message',()=>{
  assert.throws(()=>addMessage(freshState(),'empty'),/先选/);assert.throws(()=>validateCards(['not-a-card']));assert.throws(()=>validateCards(['hello','walk','photo','again']));assert.deepEqual(validateCards(['photo','photo']),['photo']);
  const s=freshState();s.messages=Array(60).fill({});s.drafts.elder.cards=['hello'];assert.throws(()=>addMessage(s,'full'),/60条/);
});
