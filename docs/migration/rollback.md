# Phase 7 回滚说明

## 回滚触发条件

- Next.js 根入口无法创建或加入 BP 会话。
- `/api.php?action=...` 兼容接口出现响应格式或写库异常。
- 已有分享链接无法进入对应角色或全局 BP 对局。
- e2e 回归在目标环境复现失败，且无法快速修复。

## 快速回退路径

1. 将站点根路径 `/` 从 Next.js 服务切回旧版静态入口。
2. 使用仓库根目录旧版文件作为回退源：
   - `index.html`
   - `style.css`
   - `script.js`
   - `api.php`
   - `db_config.php`
3. 保持现有 MySQL 表不变，不执行结构清理。
4. 确认 `/api.php` 由 PHP 运行时处理，或继续使用已验证可用的兼容 API。
5. 对旧版入口执行手工回归：创建竞技征召、角色链接、观战、裁判系统禁用和全局 BP Game 1 到 Game 5。

## 灰度期保底入口

当前构建同时提供 `/legacy` 和 `/legacy/index.html`。如果只是 Next.js UI 出现问题但兼容 API 正常，可以临时通知用户访问 `/legacy` 进入旧版静态页面。

## 回滚后确认

```powershell
php -l api.php
curl "http://127.0.0.1:3000/api.php?action=getGlobalSession&global_session_id=test"
```

回滚完成后，先冻结 Phase 8 清理，不删除旧文件和旧表，直到新一轮灰度验收通过。
