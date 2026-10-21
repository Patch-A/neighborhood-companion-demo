import {createRequire} from 'node:module';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const root=new URL('../',import.meta.url),require=createRequire(new URL('site/package.json',root));
const fromWrangler=createRequire(require.resolve('wrangler'));
const fromMiniflare=createRequire(fromWrangler.resolve('miniflare'));
const sharp=fromMiniflare('sharp');
let svg=await readFile(new URL('site/public/submission-cover.svg',root),'utf8');
svg=svg.replace('熟悉的照片 · 少量图卡 · 双向回应','熟悉的照片 · 少量图卡 · 示例双方回应')
  .replace('DeepSeek 辅助选卡，家人核对后发送','DeepSeek 辅助选卡，核对后确认表达')
  .replace('听见不方便，也能探索传递心意的方式','打开网页，体验示例图卡往返')
  .replace('家庭沟通候选版 · 图卡理解与使用效果待目标用户验证','在线 H5 演示 · 图卡理解与使用效果待目标用户验证')
  .replace('看看，再发送给家人','核对后，确认示例发送');
await mkdir(new URL('submission/',root),{recursive:true});
await writeFile(new URL('submission/cover.svg',root),svg);
const output=new URL('submission/cover-1600x900.png',root);
await sharp(Buffer.from(svg)).png().toFile(fileURLToPath(output));
const metadata=await sharp(await readFile(output)).metadata();
if(metadata.width!==1600||metadata.height!==900||metadata.format!=='png')throw Error('Cover metadata mismatch');
console.log(JSON.stringify({format:metadata.format,width:metadata.width,height:metadata.height}));
