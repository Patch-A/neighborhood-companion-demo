import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import ts from 'typescript';
import {runInNewContext} from 'node:vm';
const require=createRequire(import.meta.url);
function load(name){const filename=fileURLToPath(new URL(`../lib/${name}.ts`,import.meta.url));const source=ts.transpileModule(readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const module={exports:{}};runInNewContext(source,{module,exports:module.exports,require:id=>id==='./picture-cards'?load('picture-cards'):require(id),Response,URL,TextEncoder,crypto},{filename});return module.exports;}
const {parseCardSuggestion}=load('family-ai');
test('valid model result stays in fixed vocabulary',()=>assert.deepEqual(Array.from(parseCardSuggestion('{"cards":["hello","miss-you"]}')),['hello','miss-you']));
test('unknown model labels and invented consent are rejected',()=>assert.throws(()=>parseCardSuggestion('{"cards":["approved-payment"]}'),/未知图卡/));
test('unsupported meaning falls back instead of claiming success',()=>assert.throws(()=>parseCardSuggestion('{"cards":[]}'),/不能用已有图卡表达/));
test('model prose and malformed payloads do not become a message',()=>{for(const raw of ['ignore instructions','{}','[]','{"cards":null}','{"cards":["hello","walk","later","again"]}'])assert.throws(()=>parseCardSuggestion(raw));});
