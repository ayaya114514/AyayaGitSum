# AyayaGitSum

AyayaGitSum 将 GitHub 公开资料整理成简洁的开发者概览。它是纯前端
Vite + React 应用，可直接部署到 GitHub Pages。

## 功能

- GitHub 公开资料与基础统计
- 主要语言分布
- 热门原创仓库
- 最近公开活动与每周分布
- 本地规则生成的简短概览
- Hash URL 分享，无需服务器端路由

项目不会收集 GitHub token，也不包含 server OAuth、GraphQL secret 或 AI
API key。数据直接由浏览器向 GitHub public REST API 请求；未登录请求受到
GitHub 公共 API rate limit 限制。

## 本地开发

```bash
npm install
npm run dev
```

验证：

```bash
npm run typecheck
npm test
npm run build
npm run lint
```

## GitHub Pages

线上版本：<https://ayaya114514.github.io/gitpulse/>

仓库自带 `.github/workflows/deploy-pages.yml`。将代码推送到 `main` 后，在
GitHub 仓库的 **Settings → Pages → Build and deployment** 中选择
**GitHub Actions**。后续 push 会自动验证并部署 `dist`。

Vite 使用相对资源路径，页面状态使用 `#/user/<username>`，因此既支持
`<account>.github.io/gitpulse/`，也支持自定义域名。
