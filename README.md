# YiKk_LOLBP - 英雄联盟 BP 模拟器

YiKk_LOLBP 是一个基于 Next.js 的英雄联盟 BP（禁用/选择）模拟器，支持竞技征召、全局 BP、多角色协作和会话持久化。

## 功能

- 竞技征召 BP：按标准 Ban/Pick 顺序推进，支持空 Ban。
- 全局 BP：最多 5 场对局，后续对局会自动系统禁用前面对局已选英雄。
- 多角色链接：主机、蓝方、红方、裁判、观战者使用同一会话的不同权限入口。
- 裁判控制：裁判可系统禁用或解禁英雄，并同步给所有参与者。
- 兼容入口：旧分享链接 `/?session=...&role=...`、全局 BP 链接 `/?mode=distribute&game=...&global_session=...` 继续可用。
- 兼容 API：对外仍保留 `/api.php?action=...` 路径，由 Next.js API route 处理。

## 技术栈

- Next.js App Router
- React
- TypeScript
- Prisma
- MySQL
- Vitest
- Playwright

根目录旧版 `index.html`、`script.js`、`style.css`、`api.php`、`db_config.php` 已在最终清理阶段移除。旧静态前端副本保留在 `public/legacy/`，用于必要时的静态页面参考；数据读写仍通过兼容的 `/api.php` 路径进入 Next.js API。

## 本地开发

启动本地测试数据库：

```powershell
docker compose up -d lolbp-mysql
```

设置数据库连接：

```powershell
$env:DATABASE_URL="mysql://lolbp:lolbp_dev_password@127.0.0.1:3307/lolbp_test"
```

安装依赖并启动开发服务：

```powershell
npm install
npm run dev
```

常用验证命令：

```powershell
npm run lint
npm run typecheck
npm run test
npm run e2e
npm run build
```

## 路由

- `/`：Next.js 主入口。
- `/?session={session_id}&role={role}`：会话角色入口。
- `/?mode=distribute&game={1..5}&global_session={global_session_id}`：全局 BP 对局链接分发入口。
- `/legacy`：旧静态前端说明页。
- `/legacy/index.html`：归档的旧静态前端副本。
- `/api.php?action=...`：兼容旧 API 路径。
