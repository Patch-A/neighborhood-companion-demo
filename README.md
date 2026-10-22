# 邻里有伴

探索不识字、听不清的老人如何通过少量图卡和熟悉照片表达、接收熟悉家人的回应。当前是支付宝智能体涌现奖的H5候选作品，没有证明目标老人理解、孤独改善或家人负担减轻，未正式投稿或上架小程序。

## 当前交付（2026-10-22）

QMuse运行源码6ad1822，先核对GitHub补丁再更新平台版本90100084。本人报告预览连接提示已消失；真实独立访客API的表权限、DeepSeek照片候选/200、不能表达内容/422、同一分钟3并发2成功1限流及持久用量通过。现有密钥经本人授权安全配置为私密Secret，没有进入前端、源码或ZIP。

**公开作品URL、网页AI人工确认往返和投稿字段接受仍待完成。** [QMuse项目编辑入口](https://qmuse.cn/app/3379366579041450)供本人管理，不能当作最终作品链接。浏览器控制暂不可用，发布按钮由本人操作；取得实际URL后继续核验，不手工拼造示例域名。

- [当前投稿资料与15文件合集入口](submission/README.md)
- [运行源码与QMuse使用说明](qmuse-demo/README.md)
- [真实验收、源版本和待完成项](docs/reviews/2026-10-22-qmuse-import.md)
- [全部项目目录与历史版本](docs/PROJECT_GUIDE.md)
- [既有Cloudflare体验页](https://neighborhood-companion-demo.patch-neighborhood-demo.workers.dev/)可体验，但实际投稿表单拒绝该地址，原因未知；不能继续直接用它提交。

本轮10项适配检查、类型/lint、构建与产物检查通过，真实云API与合成身份验收单独记录，不冒充公开网页或真人验证。QMuse当前免费单环境，开发/正式可能共享用量；Cloudflare另计。全站50次/日、同访客5次/日及分钟上限，失败和部分预留计数；免费托管不等于DeepSeek免费，也不是账号金额预算。

以下是此前阶段的历史记录，当前状态以上述交付与最新验收为准。

## 本地备选资料记录（2026-10-20，历史）

先读[统一投稿资料入口](submission/README.md)，或下载[资料合集](dist/neighborhood-companion-submission-kit.zip)。目录包含可复制介绍、16:9封面、独立运行ZIP、评审说明、演示脚本、提交清单和哈希；[项目总览](docs/PROJECT_GUIDE.md)介绍全部现行与历史目录。本轮16项本地检查、27项回归和类型/语法检查通过，详情见[技术复核](submission/05-技术检查记录.md)。

公开细则允许URL或ZIP，关联投稿页当前需支付宝登录，登录后的上传入口与评审运行条件仍需本人确认。当前本地网址不能远程访问；运行包不含模型密钥，实际AI需运行者自行配置。材料整理完成不等于已提交。

## 本地部署（2026-10-20）

没有云账号时，从 [`local-demo/`](local-demo/) 开始：安装Node.js24 LTS，下载并解压[独立本地ZIP](dist/neighborhood-companion-local-demo.zip)，双击 `start.cmd` 后打开终端显示的本机网址。无需ChatGPT登录或安装前端依赖；DeepSeek密钥只在本机配置，未配置时仍能手动体验图卡。

这份独立H5使用虚构双方，含图卡往返、未理解回应、本机照片、真实AI候选与人工确认；不是跨设备真实家庭服务。原Sites第6版保留。详见[本地启动说明](local-demo/README.md)和[本轮验收](docs/releases/local-v0.1/实施与验收记录.md)。本地网址不能直接给评审远程打开，尚未实际投稿。

## Sites家庭候选版

开发入口为 [`site/`](site/)，已同步Sites第6版源提交 `13df922d9cfa23933a0be93ac439f1b66164ff56`。主要功能包括家庭图卡、服务端成员权限、私密照片/可选语音、双向收发、未理解回应和DeepSeek图卡建议。

- [应用配置与运行说明](site/README.md)
- [当前交接与验证范围](docs/CODEX_HANDOFF.md)
- [H5投稿步骤与部署选项](docs/SUBMISSION_AND_DEPLOYMENT.md)
- [第6版技术验收](docs/releases/v6/实施与验收记录.md)
- [作品简介候选稿](docs/releases/v6/投稿作品简介-候选稿.md)
- [已部署网站](https://neighborhood-companion-patch.docileape4.chatgpt.site)：保留所有者访问，需ChatGPT登录，评审访问尚待安排。

41项技术检查、类型检查与构建通过；DeepSeek两个合成输入实际调用通过。真实手机、目标用户理解与线上家庭完整模型/附件链路未验收。按用户决定，真人测试可暂缓，继续推进投稿demo。

## 开发与发布

Node.js >=22.13.0，pnpm11.25.0，从 `site/` 安装锁定依赖；完整迁移、预览与测试指引见应用README。每轮成功迭代先同步GitHub、核对提交，再部署运行版本。

GitHub保存源码；此全栈应用使用Workers、D1、R2及Sites可信身份，不能直接放到GitHub Pages就获得真实AI与家庭服务。独立托管需要配置后端及身份适配，运行密钥只保存在服务端。

## 历史材料

根目录 `prototype/`、`server.js`、研究报告和旧 `dist/neighborhood-companion-demo.zip` 保留历史；当前运行包/资料合集按上述明确文件名选择。旧ZIP不包含本轮 `site/`。此前介绍见 [历史README](docs/README-before-site-sync.md)。下载最新版源码可用GitHub的Code → Download ZIP；源码ZIP不等于开箱即用的投稿运行包。
