import test from 'node:test';
import assert from 'node:assert/strict';
import {cloudFailure} from '../src/services/cloudDiagnostics.ts';

test('cloud diagnostics distinguish session, function and response failures',()=>{
  for(const phase of ['SESSION','FUNCTION','RESPONSE']){
    const cause={code:403,type:'denied',message:'Internal provider detail'};
    const result=cloudFailure(phase,cause);
    assert.equal(result.diagnosticCode,`QM-${phase}-403`);
    assert.equal(result.cause,cause);
    assert.equal(result.code,403);
    assert.equal(result.name,'CompanionCloudError');
    assert.ok(!result.message.includes(cause.message));
  }
});

test('diagnostics expose only bounded numeric HTTP codes, never arbitrary provider data',()=>{
  for(const code of [null,undefined,0,999,NaN,'credential-in-error','403\nprivate']){
    const result=cloudFailure('SESSION',{code,message:'private value'});
    assert.equal(result.diagnosticCode,'QM-SESSION-UNKNOWN');
    assert.ok(!result.message.includes('private'));
    assert.equal(result.code,null);
  }
  assert.equal(cloudFailure('FUNCTION',{code:'404'}).diagnosticCode,'QM-FUNCTION-404');
});
