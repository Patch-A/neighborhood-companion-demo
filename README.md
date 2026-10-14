# 邻里有伴

探索不识字、听不清的老人如何通过图卡和熟悉照片表达、接收家人回应。当前是支付宝智能体涌现奖的H5候选作品，尚未证明目标用户理解或孤独改善，也未提交赛事或接入支付宝小程序。

## 最新版本

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

根目录 `prototype/`、`server.js`、研究报告和 `dist/` 保留作历史材料；旧ZIP不包含本轮 `site/`。此前介绍见 [历史README](docs/README-before-site-sync.md)。下载最新版源码可用GitHub的Code → Download ZIP；源码ZIP不等于开箱即用的投稿运行包。
