# LOL_WebBPSimulator 重构计划

本文档描述将 LOL_WebBPSimulator 从 PHP + 原生 JavaScript + MySQL 分阶段重构为 Next.js + TypeScript + Prisma + MySQL 的计划。

## 当前基线

当前带 Git 仓库的源码目录是 `LOL_WebBPSimulator/`。根目录上层还存在一份部署或拷贝态文件，但迁移计划以 `LOL_WebBPSimulator/` 作为旧版功能基线。

旧版主要边界：

- 前端：`index.html`、`style.css`、`script.js`
- 后端：`api.php`
- 数据库：`bp_sessions`、`session_activity`，以及 `api.php` 运行时创建的 `global_games`
- 兼容 API 入口：`/api.php?action=...`
- 角色链接：`?session=...&role=blue|red|observer|referee`
- 全局 BP 链接：`?mode=distribute&game=N&global_session=...`
- 英雄数据：前端运行时请求 Riot Data Dragon

## 迁移原则

1. Next.js 先并行存在，旧 PHP 入口不动。
2. 数据库字段和 `/api.php` 响应结构先完全兼容。
3. 先迁 API，再迁 UI，最后切流。
4. 每个阶段都必须能单独验证。
5. 所有破坏性清理放到最后，并且需要已有回归测试覆盖。

## 本地 MySQL 测试环境调整

本地不要求安装 MySQL，统一使用 Docker Compose 启动一个轻量测试库。该库只服务迁移、Prisma、API 兼容和 e2e 测试，不连接线上库。

新增 `docker-compose.yml`：

- 使用 `mysql:8.4`
- 容器名：`lolbp-mysql`
- 宿主机端口：`3307`
- 测试库：`lolbp_test`
- 测试用户：`lolbp`
- 测试密码：`lolbp_dev_password`
- 首次启动时自动加载 `db_setup.sql`
- 关闭 performance schema，降低 buffer pool 和连接数，减少本地资源占用

本地数据库连接串：

```powershell
$env:DATABASE_URL="mysql://lolbp:lolbp_dev_password@127.0.0.1:3307/lolbp_test"
```

容器操作：

```powershell
docker compose up -d lolbp-mysql
docker compose ps
docker compose exec lolbp-mysql mysql -ulolbp -plolbp_dev_password lolbp_test -e "SHOW TABLES;"
```

如需重建干净测试库：

```powershell
docker compose down -v
docker compose up -d lolbp-mysql
```

## 阶段 0：建立旧版基线

目标：确认旧版行为，补齐迁移说明和契约，不改业务逻辑。

修改或新增文件：

- 新增 `docker-compose.yml`
- 新增 `docs/migration/baseline.md`
- 新增 `docs/migration/api-contract.md`
- 新增 `docs/migration/db-contract.md`
- 新增 `docs/migration/manual-regression.md`

不能做：

- 不能移动、删除或格式化 `index.html`、`script.js`、`style.css`、`api.php`
- 不能修改 `db_setup.sql`
- 不能修改线上数据库结构
- 不能把上层拷贝文件和 `LOL_WebBPSimulator/` 混为同一套源码

验收命令：

```powershell
cd C:\Users\Administrator\OneDrive\Desktop\web\lolBP\LOL_WebBPSimulator
git status --short
docker compose up -d lolbp-mysql
docker compose exec lolbp-mysql mysql -ulolbp -plolbp_dev_password lolbp_test -e "SHOW TABLES;"
php -l api.php
```

## 阶段 1：旁路创建 Next.js + TypeScript 项目

目标：Next.js 能独立启动，但不接管旧页面和旧 API。

修改或新增文件：

- 新增 `package.json`
- 新增 `package-lock.json`
- 新增 `next.config.ts`
- 新增 `tsconfig.json`
- 新增 `eslint.config.mjs`
- 新增 `app/layout.tsx`
- 新增 `app/page.tsx`
- 新增 `app/globals.css`
- 新增 `.env.example`

不能做：

- 不能删除 PHP 文件
- 不能让 `/api.php` 指向 Next.js
- 不能修改旧版 `script.js` 的 API 地址
- 不能引入 Prisma 数据读写

验收命令：

```powershell
cd C:\Users\Administrator\OneDrive\Desktop\web\lolBP\LOL_WebBPSimulator
npm install
npm run lint
npm run typecheck
npm run dev
php -l api.php
```

## 阶段 2：抽取 BP 领域模型与流程测试

目标：把 BP 顺序、角色权限、Ban/Pick 状态这些核心逻辑变成可测试 TypeScript 纯函数，不接 UI。

修改或新增文件：

- 新增 `src/domain/types.ts`
- 新增 `src/domain/bp-flow.ts`
- 新增 `src/domain/permissions.ts`
- 新增 `src/domain/session-state.ts`
- 新增 `src/domain/__tests__/bp-flow.test.ts`
- 新增 `src/domain/__tests__/permissions.test.ts`
- 新增 `vitest.config.ts`

不能做：

- 不能重写旧 `script.js`
- 不能改变竞技征召、全局 BP 的实际步骤顺序
- 不能引入 WebSocket 或新同步机制
- 不能修改数据库

验收命令：

```powershell
npm run test
npm run typecheck
```

重点测试内容：

- 竞技征召流程：`B-R-B-R-B-R`、`B-RR-BB-R`、`R-B-R-B`、`R-BB-R`
- 空 Ban
- 英雄不可重复选择
- `host`、`blue`、`red`、`observer`、`referee` 权限
- 全局 BP 前面对局英雄自动系统禁用

## 阶段 3：加入 Prisma，保持旧表结构兼容

目标：Prisma 能访问现有 MySQL 表，但不迁移数据、不改列名。

修改或新增文件：

- 新增 `prisma/schema.prisma`
- 新增 `src/server/db.ts`
- 新增 `src/server/repositories/bp-session-repository.ts`
- 新增 `src/server/repositories/global-game-repository.ts`
- 新增 `src/server/repositories/session-activity-repository.ts`
- 更新 `.env.example`

Prisma 模型必须兼容：

- `bp_sessions.session_id`
- `blue_bans`、`red_bans`、`blue_picks`、`red_picks` 继续按旧版 JSON 字符串处理
- `system_banned_champions` 继续按旧版 JSON 字符串处理
- `global_games.session_id1` 到 `session_id5` 暂时保留
- `session_activity` 保留

不能做：

- 不能把 TEXT 字段直接改成 JSON 字段
- 不能把 `global_games` 规范化成子表
- 不能执行会丢数据的 `prisma db push`
- 不能删除 PHP 运行时创建 `global_games` 的兼容逻辑

验收命令：

```powershell
$env:DATABASE_URL="mysql://lolbp:lolbp_dev_password@127.0.0.1:3307/lolbp_test"
npx prisma validate
npx prisma generate
npm run typecheck
npm run test
```

## 阶段 4：实现 Next.js 兼容版 `/api.php`

目标：Next.js 提供与 PHP `api.php` 等价的 API，旧前端理论上只切服务器即可继续工作。

修改或新增文件：

- 新增 `app/api/legacy/route.ts`
- 更新 `next.config.ts`，把 `/api.php` rewrite 到 `/api/legacy`
- 新增 `src/server/api/legacy-actions.ts`
- 新增 `src/server/api/legacy-response.ts`
- 新增 `src/server/api/validators.ts`
- 新增 `src/server/api/__tests__/legacy-actions.test.ts`
- 新增 `scripts/compare-legacy-api.mjs`

必须兼容的 action：

- `GET getSession`
- `GET getGlobalSession`
- `POST createSession`
- `POST updateSession`
- `POST createGlobalSession`
- `POST updateGlobalSessionWithGameId`

不能做：

- 不能改变响应格式：仍然是 `{ status: "success", data }` 或 `{ status: "error", message }`
- 不能改变 session id 校验规则
- 不能改变字段名 snake_case
- 不能让旧 PHP API 下线
- 不能新增必须登录才能使用的限制

验收命令：

```powershell
$env:DATABASE_URL="mysql://lolbp:lolbp_dev_password@127.0.0.1:3307/lolbp_test"
npm run test
npm run typecheck
npm run dev
```

API 验收示例：

```powershell
curl "http://127.0.0.1:3000/api.php?action=getSession&session_id=test"
```

## 阶段 5：迁移 React UI，先保持视觉和交互等价

目标：Next.js 页面复刻旧版 UI 和流程，继续调用兼容 `/api.php`。

修改或新增文件：

- 新增或更新 `app/page.tsx`
- 新增 `app/session/page.tsx`
- 新增 `app/distribute/page.tsx`
- 新增 `src/components/ModeSelection.tsx`
- 新增 `src/components/BpBoard.tsx`
- 新增 `src/components/ChampionPool.tsx`
- 新增 `src/components/TeamPanel.tsx`
- 新增 `src/components/ShareLinks.tsx`
- 新增 `src/components/RefereePanel.tsx`
- 新增 `src/hooks/useBpSession.ts`
- 新增 `src/hooks/useChampionData.ts`
- 新增 `src/styles/legacy.css`，先从旧 `style.css` 迁入
- 复制 `icon.png` 到 `public/icon.png`

不能做：

- 不能重新设计 UI
- 不能改变 URL 参数语义
- 不能改变轮询行为的业务结果
- 不能移除空 Ban、裁判系统禁用、观战加入、全局 BP 分发页
- 不能删除旧 `index.html` 或 `script.js`

验收命令：

```powershell
npm run lint
npm run typecheck
npm run test
npm run dev
```

手工验收：

- 创建竞技征召 BP
- 生成蓝方、红方、裁判、观战链接
- 蓝红分别操作 Ban/Pick
- 裁判系统禁用和解禁
- 观战者只读
- 全局 BP Game 1 到 Game 5 分发
- 后续 Game 自动禁用前面对局已选英雄

## 阶段 6：端到端回归测试

目标：用自动化覆盖旧版核心流程，保证切流前能重复验证。

修改或新增文件：

- 新增 `playwright.config.ts`
- 新增 `e2e/competitive.spec.ts`
- 新增 `e2e/global-bp.spec.ts`
- 新增 `e2e/roles.spec.ts`
- 新增 `e2e/api-compat.spec.ts`
- 更新 `package.json` scripts

不能做：

- 不能只测 React 组件，不测真实浏览器流程
- 不能依赖生产数据库
- 不能跳过多角色同步测试
- 不能把测试数据写入线上库

验收命令：

```powershell
$env:DATABASE_URL="mysql://lolbp:lolbp_dev_password@127.0.0.1:3307/lolbp_test"
npm run build
npm run test
npm run e2e
```

使用本地 Docker 测试库：

```powershell
$env:DATABASE_URL="mysql://lolbp:lolbp_dev_password@127.0.0.1:3307/lolbp_test"
npm run e2e
```

## 阶段 7：灰度切流

目标：Next.js 接管正式入口，但旧版仍可回退。

修改或新增文件：

- 更新 `next.config.ts`
- 新增 `app/legacy/page.tsx` 或保留旧静态入口说明
- 新增 `docs/migration/cutover.md`
- 新增 `docs/migration/rollback.md`
- 可新增 `public/legacy/` 保存旧静态资源副本

不能做：

- 不能删除 PHP API
- 不能删除旧 DB 表
- 不能改变已有分享链接失效
- 不能在没有备份和回滚说明时切默认入口

验收命令：

```powershell
npm run build
npm run start
npm run e2e
php -l api.php
```

切流验收：

```powershell
curl "http://127.0.0.1:3000/api.php?action=getGlobalSession&global_session_id=test"
```

## 阶段 8：清理旧实现

目标：确认 Next.js 稳定后，再逐步移除 PHP 和原生 JS。

修改或新增文件：

- 删除或归档 `index.html`
- 删除或归档 `script.js`
- 删除或归档 `style.css`
- 删除或归档 `api.php`
- 删除或归档 `db_config.php`
- 更新 `README.md`
- 更新 `docs/migration/final-state.md`

不能做：

- 不能在灰度期内执行
- 不能删除数据库历史数据
- 不能无迁移脚本地重构 `global_games`
- 不能让旧分享链接直接 404，应提供跳转或兼容解析

验收命令：

```powershell
npm run lint
npm run typecheck
npm run test
npm run e2e
npm run build
```

## 推荐执行顺序

建议先完成阶段 0 到阶段 4。这样可以在不碰旧 UI 的情况下，把 Next.js、TypeScript、Prisma、MySQL API 兼容层跑通。等 `/api.php` 兼容层稳定后，再迁 React UI，风险更小。
