# 邻里有伴

面向怕复杂操作、能接电话但不便打字的老人，探索语音、图片求助和家人协助。当前为演示项目，尚未接入支付宝小程序、真实家庭账号或平台义工服务。

## 最新版本在哪里

**后续开发请从 [`site/`](site/) 开始。** 这是 2026-10-11 同步的适老演示源码，对应 Sites 源码提交 `ae1c8515f8754334f40751e708028082184bf6f9`。

- [最新版功能与限制](site/README.md)
- [Codex 接手、启动和下一阶段说明](docs/CODEX_HANDOFF.md)
- [当前网站演示](https://neighborhood-companion-patch.docileape4.chatgpt.site)：仍为私密站点，需要访问权限；公开 GitHub 源码不等于公开网站。

最新版本包括：首页家人电话、语音与照片求助、家人语音/文字回应演示、草稿保存、大字入口、处理完成后由老人确认，以及付费和远途事项的转派限制。角色在同一浏览器切换，不能当作真实双端服务。

## 开发入口

`site/` 使用 React、Vinext/Vite、Cloudflare Workers 与 D1。Node.js 要求不低于 22.13.0，包管理器固定为 pnpm 11.25.0。请先进入 `site/` 安装依赖；根目录的 `package.json` 与 `server.js` 属于旧版原型。

```sh
cd site
pnpm install --frozen-lockfile
node --test scripts/care-app-loading.test.mjs scripts/help-workflow.test.mjs
pnpm exec tsc --noEmit --incremental false
pnpm build
```

本地预览和数据库初始化步骤见交接说明。10 月 10 日源工作区的自动检查 23 项通过，类型检查和构建通过；本次同步核对了文件清单与远端文件哈希。真实手机录音、相机、拨号、手写/五笔与布局仍需实测。

## 早期材料

保留原来的 `prototype/`、`server.js`、调研报告、项目规划和投稿材料，用于查阅历史。根目录 `dist/neighborhood-companion-demo.zip` 是旧版交付包，**不包含本次新增的 `site/` 最新源码**。下载当前完整项目请使用 GitHub 的 Code → Download ZIP，或克隆仓库。

同步前的仓库说明完整保存在 [历史 README](docs/README-before-site-sync.md)。其中旧版验收、投稿日期和状态不代表最新版本或最新官方要求。

## 数据与部署

此次同步仅包含代码、静态素材、锁文件、迁移文件和开发文档。线上 D1 数据、浏览器中的录音/照片/联系人、运行缓存和凭据不在仓库中。GitHub Pages 未启用，网站访问和部署方式没有改变。
