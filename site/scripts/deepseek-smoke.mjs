// Explicit live check: only synthetic statements go to the user-selected service.
// Run manually, not part of unit tests or publication's automatic checks.
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import assert from 'node:assert/strict';
import ts from 'typescript';
const require=createRequire(import.meta.url);
function load(name){const filename=fileURLToPath(new URL(`../lib/${name}.ts`,import.meta.url));const source=ts.transpileModule(readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const module={exports:{}};runInNewContext(source,{module,exports:module.exports,require:id=>id==='./picture-cards'?load('picture-cards'):require(id),fetch,Response,URL,AbortSignal,TextEncoder,TextDecoder,crypto},{filename});return module.exports;}
if(!process.env.DEEPSEEK_API_KEY)throw new Error('DeepSeek credential is not configured in this process.');
const {requestCardSuggestion}=load('family-ai');
const config={baseUrl:'https://api.deepseek.com',apiKey:process.env.DEEPSEEK_API_KEY,model:'deepseek-flash'};
const result=await requestCardSuggestion(config,'���뿴�����˵���Ƭ');
assert.ok(result.includes('photo'));console.log(JSON.stringify({case:'synthetic-photo-request',model:config.model,cards:Array.from(result),passed:true}));
await assert.rejects(()=>requestCardSuggestion(config,'�����֧��ҽҩ����'),/����������ͼ������/);
console.log(JSON.stringify({case:'unsupported-sensitive-intent',passed:true,behavior:'manual-fallback'}));
