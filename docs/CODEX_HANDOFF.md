# 邻里有伴当前交接

更新日期：2026-10-14，北京时间。最新应用在 `site/`，对应已发布Sites第6版源提交 `13df922d9cfa23933a0be93ac439f1b66164ff56`。GitHub内的 `site/` 与该提交逐文件同步，运行数据及secret不随源码同步。

## 当前结果

家庭图卡、熟悉照片、可信身份家庭绑定、私密附件、独立成员双向消息、查看与未理解回应、撤回/退出/删除、DeepSeek图卡建议已实现。41项自动检查、类型检查和构建通过；DeepSeek同一应用调用函数的两个合成输入实际请求通过。线上第6版及数据库/API配置已核对。

仍未完成真实双手机与目标用户测试、评审访问安排、实际投稿、支付宝小程序创建/接入；不宣称已解决原愿望或验证孤独改善。部署后的真实家庭完整模型/附件链路尚未验收。本次只同步已验收源版本和文档，不重复花费模型调用费用。

## 用户决定与下一轮顺序

1. 成功迭代先同步GitHub并核对远端，再发布运行版本。保留每轮来源提交、测试范围和部署结果。
2. 真人测试暂缓，不阻塞H5投稿demo准备；真机兼容性、访问权限和AI实际可交互仍要检查。
3. 首先形成可供智能体涌现奖评审体验的H5；正式个人小程序后续推进。不能把H5提交写成支付宝上架。

## 当前访问与demo

- 运行地址：<https://neighborhood-companion-patch.docileape4.chatgpt.site>；custom，仅所有者，需ChatGPT登录。
- `/?demo=1` 是同浏览器内的虚构家庭图卡演示，不上传真实附件、不调用模型。
- 已获准访问且登录的用户，可以在设置家庭前通过“设置前，先试一试AI图卡建议”调用DeepSeek；这仍受站点权限及登录限制。
- 家庭邀请只绑定业务家庭，不授予站点权限。不能把目前网址直接称为任何评委都能访问的投稿链接。
- `docs/SUBMISSION_AND_DEPLOYMENT.md` 提供投稿入口与部署选项。根目录旧 `dist/neighborhood-companion-demo.zip` 不包含本轮最新版；Sites tar.gz也不是可直接离线体验的通用ZIP。

## 启动与检查

Node.js >=22.13.0，pnpm11.25.0。完整配置与本地迁移见 `site/README.md`；家庭表需要全部三次迁移，不能只导入0000。

```sh
cd site
pnpm install --frozen-lockfile
node --test scripts/care-app-loading.test.mjs scripts/help-workflow.test.mjs scripts/family-ai.test.mjs
pnpm exec tsc --noEmit --incremental false
pnpm build
```

构建后的本地Worker与D1/R2初始化按README执行，再运行 `scripts/family-integration.test.mjs`。该测试仅允许127.0.0.1合成家庭，不使用生产数据。所有secret在运行环境配置，GitHub上不提供实际值。

## 下一轮的具体范围

准备一个评审能打开、以虚构资料演示完整图卡往返、并能实际试用AI建议的H5入口。入口必须标注模拟角色/消息；模型端设置限额、超时和人工选择回退。保留正式家庭权限，避免为demo公开真实家庭数据。录制“输入文字—AI建议—人工确认—图卡表达—未理解—重新表达”，然后整理16:9封面、简介、访问说明。真人效果验证留在投稿后的迭代，不制造用户案例。

独立Cloudflare或国内托管需要替换当前Sites专有身份接入并适配部署资源，不能只复制前端。个人小程序需要原生AXML/ACSS/JS页面及支付宝服务端身份校验，不能用web-view套壳。
