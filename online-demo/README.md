# 免费托管投稿H5

2026-10-22最新状态：现有 Cloudflare H5 可体验，但已被实际投稿表单拒绝。独立 QMuse 适配已先同步 GitHub `c705fbe`，43文件远端核对一致，官方CLI导入 **READY**，平台工程/内容审核/预览及发布产物检查通过。应用编辑入口 https://qmuse.cn/app/3379366579041450 ，尚未公开发布。本人报告四项表权限已设并已授权密钥；访客权限、实际模型和公开投稿链接仍待核验。 详见[本轮记录](../docs/reviews/2026-10-22-qmuse-import.md)。下文旧计划保留为历史。

2026-10-21已发布：[打开邻里有伴](https://neighborhood-companion-demo.patch-neighborhood-demo.workers.dev/)。无需Cloudflare/ChatGPT账号或体验者自备密钥，DeepSeek在服务端配置；当前电脑Chrome、API、实际模型及示例往返已验收。手机流量/支付宝内置浏览器仍待本人检查。详见[线上投稿说明](../submission/06-在线体验与投稿链接.md)。

本目录把已有本地虚构家庭演示适配为Cloudflare Workers静态资源 + Worker接口 + D1用量库。原`local-demo/`仍可独立运行，原Sites访问不变。没有真实家庭跨设备服务，不能据此声称目标老人看懂或孤独改善。

## 费用和访问边界

- 只使用Workers Free和D1 Free，不开通Workers Paid、R2、付费域名或其他付费资源。平台套餐由本人在控制台核对；免费额度/政策会变化。
- Workers Free每日10万动态请求；D1 Free每日500万行读取、10万行写入、总5GB。免费额度用尽会失败，不在代码中自动升级套餐。
- **DeepSeek不因此免费**。继续按已有模型账户计费；也可保持`AI_ENABLED=false`只体验手选。次数限制不是人民币预算或账户级硬上限。
- 使用平台`workers.dev`网址和HTTPS，无需购买域名。国内网络可达性和DeepSeek地域可用性尚未实测；部署成功不代表评审网络一定能访问。先测手机流量/不同网络，失败就不能把此链接填为已验收入口。
- 当前真实体验入口为上文HTTPS。新网址刚启用曾握手失败，后正常200；不绕过证书验证。当前电脑有代理式DNS，不据此声称大陆不同网络均已验收。

官方核对于2026-10-20：[Workers价格](https://developers.cloudflare.com/workers/platform/pricing/)、[D1价格](https://developers.cloudflare.com/d1/platform/pricing/)、[免费用尽行为](https://developers.cloudflare.com/d1/reference/faq/)、[静态资源绑定](https://developers.cloudflare.com/workers/static-assets/binding/)。

## 本机检查与预览

Node24。使用本项目`site/`现有Wrangler4.92.0，不更新pnpm11.25.0及锁文件。以下命令在仓库根目录执行：

```powershell
node online-demo/build.mjs
node --test --test-isolation=none online-demo/tests/*.test.mjs
node site/node_modules/wrangler/bin/wrangler.js dev --config online-demo/wrangler.jsonc --local --ip 127.0.0.1 --port 3137 --inspector-port 0
```

占位数据库ID只用于本机模拟，默认AI关闭，无需密钥。首次线上部署前必须创建本人D1数据库并保存真实ID到被忽略的`online-demo/wrangler.local.json`；不得编辑Site配置或读取其数据库。线上默认AI关闭，有密钥也不会自动付费调用。

## 本人注册后部署步骤

1. 在 https://dash.cloudflare.com/sign-up 自行注册和验证邮箱，保留免费套餐。账号/条款和验证码由本人完成。
2. 在仓库根目录执行登录命令，按浏览器授权本人账号。不要发送Token或密钥到聊天。

```powershell
node site/node_modules/wrangler/bin/wrangler.js login
node site/node_modules/wrangler/bin/wrangler.js d1 create neighborhood-companion-demo-usage
```

3. 复制`wrangler.jsonc`为`wrangler.local.json`（内容是合法JSON），仅将`database_id`的全零占位值换成创建结果；保留`AI_ENABLED=false`。本机配置被Git忽略，不随GitHub或ZIP公开。
4. 初始化用量库，打包检查，然后发布。**发布前本轮代码必须先同步GitHub并核对**。

```powershell
node site/node_modules/wrangler/bin/wrangler.js d1 migrations apply neighborhood-companion-demo-usage --remote --config online-demo/wrangler.local.json
node online-demo/build.mjs
node site/node_modules/wrangler/bin/wrangler.js deploy --dry-run --config online-demo/wrangler.local.json
node site/node_modules/wrangler/bin/wrangler.js deploy --config online-demo/wrangler.local.json
```

5. 保存实际发布URL与版本；先验无密钥的图卡往返。需要实际AI时由本人在控制台为**新Worker**添加Secret `FAMILY_AI_API_KEY`，不要填普通公开变量；将`AI_ENABLED`设为`true`并发布。保持本机配置同值，避免下次覆盖。也可交互执行`wrangler secret put FAMILY_AI_API_KEY --config online-demo/wrangler.local.json`，密钥由本人输入。
6. 用合成文字验一次真实AI与人工确认、一次不支持含义回退，记录这两次调用；用手机流量打开网址。确认成功后才将实际HTTPS链接填入投稿表单。实际投稿由本人完成。

## 用量与隐私

全站50次/北京时间日、10次/分钟；同一网络来源5次/日、2次/分钟。共享出口会共享个人限制；不是家庭身份认证。D1单条条件INSERT同时核对四个限额，预留后才调用模型，失败也计入；跨实例/重启不重置。数据库缺失/异常即停止AI。复制数据库、换模型密钥或另建副本不共享上限，仍需模型账户预算管理。

30分钟签名页面令牌、同源校验、防跨站请求和静态文件白名单；令牌不是账号认证，脚本仍可访问公开接口，主要通过上述持久限额控制模型消耗。模型地址固定DeepSeek HTTPS、输入最多500字/8000字节、输出固定图卡白名单，保留发送前人工核对。

D1仅保存次数事件、日期、分钟和由服务端密钥签名后按日变化的IP摘要，不保存原始IP、文字、照片或消息。摘要不是不可逆匿名保证。访问AI状态时清理早于前两天的记录；无人访问时不自动清理。Cloudflare/DeepSeek各自仍可能按平台政策处理网络元数据/主动提交的文字。默认关闭Worker应用日志采集；代码不输出请求正文/密钥。

照片和模拟消息仍只存当前浏览器标签页，不能跨设备收发。页面会明确虚构双方、AI状态和回退。免费服务不提供稳定性承诺，投稿期间需要持续核验可访问和额度。

## 运行时兼容

线上单独使用model.mjs的manual重定向请求适配，不跟随跳转、不把密钥转发到其他地址；提示与固定图卡解析仍复用本地模块。真实workerd不支持Node可用的redirect:error，本轮由真实运行时及禁用外网的模型替身证实并修复。原Sites传输源码保持原样，该同类兼容风险留待单独修正/验收，不能用独立H5结果替代其家庭AI验证。
