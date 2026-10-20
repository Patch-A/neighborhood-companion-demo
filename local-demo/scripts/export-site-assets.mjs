// Development-only exporter. Runtime needs none of these compiler/UI dependencies.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {runInNewContext} from 'node:vm';
const localRoot=new URL('../',import.meta.url),siteRoot=new URL('../site/',localRoot);
// Resolve through the retained Site's locked dependencies, without changing its lockfile.
const require=createRequire(new URL('package.json',siteRoot));
const ts=require('typescript'),React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
async function source(path){return readFile(new URL(path,siteRoot),'utf8');}
function compile(text){return ts.transpileModule(text,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;}
const cardSource=await source('lib/picture-cards.ts');
const module={exports:{}};
runInNewContext(compile(cardSource),{module,exports:module.exports,TextDecoder,TextEncoder,URL},{filename:'picture-cards.ts'});
const {PICTURE_CARDS}=module.exports;
const drawing={exports:{}};
runInNewContext(compile(await source('components/picture-card.tsx')),{module:drawing,exports:drawing.exports,require:id=>id==='@/lib/picture-cards'?module.exports:require(id)},{filename:'picture-card.tsx'});
await mkdir(new URL('public/cards/',localRoot),{recursive:true});
for(const card of PICTURE_CARDS){
  const html=renderToStaticMarkup(React.createElement(drawing.exports.PictureCard,{id:card.id}));
  const svg=html.match(/<svg[\s\S]*?<\/svg>/)?.[0];
  if(!svg)throw Error('Missing drawing');
  await writeFile(new URL(`public/cards/${card.id}.svg`,localRoot),svg.replace('<svg ','<svg xmlns="http://www.w3.org/2000/svg" '));
}
const generated='// Generated from site/lib/picture-cards.ts; do not edit independently.\n';
await writeFile(new URL('public/cards.mjs',localRoot),generated+`export const CARDS=${JSON.stringify(PICTURE_CARDS,null,2)};\n`);
// Keep the exact verified model prompt/parser/request implementation, changing module paths only.
const plainCardCode=ts.transpileModule(cardSource,{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText;
await mkdir(new URL('lib/',localRoot),{recursive:true});
await writeFile(new URL('lib/picture-cards.mjs',localRoot),generated+plainCardCode);
const ai=ts.transpileModule(await source('lib/family-ai.ts'),{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText.replace("from './picture-cards'","from './picture-cards.mjs'");
await writeFile(new URL('lib/family-ai.mjs',localRoot),'// Generated from site/lib/family-ai.ts; do not edit independently.\n'+ai);
console.log(`Exported ${PICTURE_CARDS.length} fixed cards and the verified AI helper.`);
