# Phase 7 灰度切流说明

## 当前切流状态

- 正式入口 `/` 由 Next.js App Router 接管。
- 兼容 API `/api.php?action=...` 继续由 Next.js rewrite 到 `/api/legacy`。
- 旧版 PHP 文件、旧版静态文件和旧数据库表不删除。
- 旧版静态回退入口保留在 `/legacy`，实际静态副本位于 `public/legacy/`。
- 旧分享链接继续使用 `/?session=...&role=...` 和 `/?mode=distribute&game=...&global_session=...`。
- `/index.html` 临时跳转到 `/`，用于兼容可能直接访问旧静态入口文件名的用户。

## 切流前检查

1. 确认已备份生产数据库。
2. 确认旧版部署包或当前仓库中的 `index.html`、`script.js`、`style.css`、`api.php` 可用于回退。
3. 确认 `DATABASE_URL` 指向目标环境数据库。
4. 确认本地或预发环境通过 Phase 7 验收命令。

## 切流步骤

1. 部署当前 Next.js 构建产物。
2. 将站点根路径 `/` 指向 Next.js 服务。
3. 保持 `/api.php` 对外路径不变。
4. 验证根路径、角色分享链接、全局 BP 分发链接和 `/legacy` 回退入口。
5. 观察新建会话、更新会话和全局会话更新是否正常写入现有表。

## 切流验收

```powershell
npm run build
npm run start
npm run e2e
php -l api.php
curl "http://127.0.0.1:3000/api.php?action=getGlobalSession&global_session_id=test"
```

`getGlobalSession` 对不存在的测试 ID 返回兼容错误响应即可，关键是 `/api.php` 路径仍可达且响应 JSON。
