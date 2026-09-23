# AyayaGitSum

AyayaGitSum 将 GitHub 公开资料整理成简洁的开发者概览。它是纯前端
Vite + React 应用，可直接部署到 GitHub Pages。

## 功能

- GitHub 公开资料与基础统计
- 主要语言分布
- 热门原创仓库
- 最近公开活动与每周分布
- 页面内可见的本地规则总结
- Hash URL 分享，无需服务器端路由

## 数据来源与统计口径

浏览器直接、匿名调用以下 GitHub public REST API：

- `GET /users/{username}`：公开用户资料
- `GET /users/{username}/repos?per_page=100&sort=updated&page={page}`：公开仓库
- `GET /users/{username}/events/public?per_page=100`：最近公开活动

项目没有 backend 或 proxy，不收集 GitHub token，也不包含 OAuth、GraphQL
secret、AI API 或 API key。页面中的总结是浏览器根据仓库数、主要语言和公开
活动等字段用固定规则生成的确定性文本，不会把数据发送给 LLM。

统计范围有以下边界：

- 仓库按最近更新时间分页，每页 100 个（GitHub endpoint 的单页上限），最多
  读取 3 页（300 个）。页面会显示
  已读取数量与 GitHub 报告的公开仓库总数；遇到 300 个上限、剩余额度不足或
  请求失败时会明确标记为 partial；Stars、Languages、Repositories 以及总结中
  的仓库详情均以已读取样本为准。
- Stars 只累加已读取的非 fork 仓库；Repositories 展示 Stars 最多的 6 个非
  fork、未归档仓库。
- Languages 按“有 primary language 的非 fork 仓库数量”计算，并非代码行数或
  GitHub language bytes。
- Activity 只读取 public events 的第一页，最多 100 条；Recent 展示其中最新的
  6 条。GitHub 当前的 PushEvent payload 已不含 commit 数，因此 Recent
  只显示推送的分支，不估算 commit 数。GitHub 不公开的活动不在统计范围内。
- 每个请求单独有 10 秒超时。用户资料请求失败或超时会显示错误；仓库或活动
  请求单独失败、超时时，用户资料仍可显示，并附带 warning 与已读取的部分数据。

匿名 REST 请求按来源 IP 共享[每小时 60 次的 primary rate limit][rate-limit]。
一次未缓存的查询通常使用 3 次请求，仓库分页时最多 5 次；页面会展示 GitHub
返回的剩余额度与 reset/retry 信息，额度耗尽导致查询失败时也会在错误提示里
给出预计重置时间。结果会在当前浏览器 session 中缓存 5 分钟，
相同查询也会去重，以减少重复请求。

[rate-limit]: https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api

## 本地开发

需要 Node.js `^20.19.0`、`^22.12.0` 或 `>=24.0.0`；`.nvmrc` 固定使用
Node 22.23.0。这个范围同时满足 Vite 8 与 Vitest 4 的要求。

```bash
nvm install
npm ci
npm run dev
```

提交前完整验证：

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm audit
```

## GitHub Pages

线上版本：<https://ayaya114514.github.io/AyayaGitSum/>

仓库自带 `.github/workflows/deploy-pages.yml`。Pull Request 会运行 lint、
typecheck、tests 和 production build，但不会部署。将代码推送到 `main` 后，
workflow 会在相同验证全部通过后部署 `dist`。首次使用时，请在 GitHub 仓库的
**Settings → Pages → Build and deployment** 中选择 **GitHub Actions**。

Vite 使用相对资源路径，页面状态使用 `#/user/<username>`，因此既支持
`<account>.github.io/AyayaGitSum/`，也支持自定义域名。
