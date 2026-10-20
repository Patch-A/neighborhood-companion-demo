// Reuse the checked local UI, replacing only deployment-specific explanatory text.
import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
const root=fileURLToPath(new URL('.',import.meta.url));
await mkdir(join(root,'public/cards'),{recursive:true});
for(const name of ['state.mjs','cards.mjs','styles.css',...['miss-you','photo','walk','hello','again','later'].map(x=>`cards/${x}.svg`)]){
  await copyFile(join(root,'../local-demo/public',name),join(root,'public',name));
}
let html=await readFile(join(root,'../local-demo/public/index.html'),'utf8');
html=html.replace('邻里有伴本地图卡沟通演示','邻里有伴在线图卡沟通演示').replace('邻里有伴 · 本地体验','邻里有伴 · 投稿体验')
  .replace('本地演示 · 使用虚构家庭','投稿演示 · 使用虚构家庭').replace('正在检查本地 AI 配置…','正在检查 AI 服务…')
  .replace('本机运行无需云服务。AI 配置与启动说明见交付目录 README。','本作品为投稿演示。AI 每日全站最多50次，同一网络来源每日最多5次、每分钟2次；失败也计入。服务器仅保存用量及按日变化的来源摘要，不保存文字或照片。访问 AI 状态时清理超过前两天的用量摘要，没有无人访问时的定时清理；平台仍可能处理必要网络元数据。');
await writeFile(join(root,'public/index.html'),html);
let app=await readFile(join(root,'../local-demo/public/app.mjs'),'utf8');
app=app.replace('本服务每日最多200次','本服务每日最多50次，同一网络来源每日最多5次、每分钟2次')
  .replace('需要 AI 时，在交付目录 .env.local 填入密钥并重启本地服务。未配置时不会用规则冒充 AI。','作者尚未开放在线 AI；图卡、照片和示例回应仍可体验。未配置时不会用规则冒充 AI。')
  .replace('本地后端尚未连接，请用启动脚本提供的网址打开，不要直接双击 HTML。','AI 服务暂时未连接，请刷新或先手动选择图卡。')
  .replace('本地服务未连接','AI 服务未连接');
await writeFile(join(root,'public/app.mjs'),app);
console.log('Online demo assets prepared; no keys or local configuration copied.');
