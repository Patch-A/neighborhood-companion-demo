import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {realpathSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const require=createRequire(realpathSync(fileURLToPath(new URL('../../site/node_modules/wrangler/package.json',import.meta.url))));
const {Miniflare,createFetchMock,Log,LogLevel}=require('miniflare');
function runtime(fetchMock){return new Miniflare({
  modules:true,modulesRoot:fileURLToPath(new URL('../../',import.meta.url)),
  scriptPath:fileURLToPath(new URL('./runtime-fixture.mjs',import.meta.url)),
  compatibilityDate:'2026-05-22',cf:false,fetchMock,log:new Log(LogLevel.ERROR),
});}
test('actual workerd runtime reaches the provider and validates a synthetic model response',async()=>{
  const mock=createFetchMock();mock.disableNetConnect();
  mock.get('https://api.deepseek.com').intercept({path:'/chat/completions',method:'POST',headers:{authorization:'Bearer synthetic-runtime-fixture'}})
    .reply(200,JSON.stringify({choices:[{message:{content:'{"cards":["photo"]}'}}]}));
  const mf=runtime(mock);
  try{const r=await mf.dispatchFetch('http://localhost/');assert.equal(r.status,200);assert.deepEqual(await r.json(),{cards:['photo']});}
  finally{await mf.dispose();}
});
test('actual workerd runtime refuses redirects instead of forwarding provider credentials',async()=>{
  const mock=createFetchMock();mock.disableNetConnect();
  mock.get('https://api.deepseek.com').intercept({path:'/chat/completions',method:'POST'})
    .reply(307,'',{headers:{location:'https://untrusted.example/collect'}});
  mock.get('https://untrusted.example').intercept({path:'/collect',method:'POST'})
    .reply(200,JSON.stringify({choices:[{message:{content:'{"cards":["photo"]}'}}]}));
  const mf=runtime(mock);
  try{const r=await mf.dispatchFetch('http://localhost/');assert.equal(r.status,503);assert.match((await r.json()).error,/手动选择/);}
  finally{await mf.dispose();}
});
