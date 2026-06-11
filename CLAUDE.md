# CRM 插件 — 给 AI 的项目说明

DooTask 微前端 CRM 插件（appid `crm`），跑在主程序 iframe 里。技术栈：TanStack Start（全栈，file-router + Nitro SSR）+ React 19 + Tailwind v4 + shadcn/ui（`radix-ui`）+ SQLite（better-sqlite3）。下面只记从代码看不出、容易判断错的点。

## 跟主程序 / DooTask 打交道：先读本地，别联网
主程序、工具库、文档都在本机，查 DooTask API / 约定 / 主程序行为时**读本地源码，不要上网搜 DooTask**（线上会过时/不准）：
- 主程序源码：`/home/coder/workspaces/dootask`
- `@dootask/tools` 源码（前端库 + Go/Node/Python SDK）：`/home/coder/workspaces/dootask-tools`
- 插件开发文档：`/home/coder/workspaces/dootask-appstore/appstore/apps/_/README_CN.md`

## 命令（都在 `crm/src/` 下跑）
- 开发：`pnpm dev`（端口 3000）
- 构建：`pnpm build`（Vite+Nitro，走 esbuild **不做类型检查**）
- 类型检查：`npx tsc --noEmit`（构建和 CI 都不跑，改完自己跑）
- Lint / 格式化：`pnpm lint` / `pnpm format`
- 本地起生产包：`CRM_DATA_DIR=/tmp/x CRM_ADMIN_USER_IDS=1 PORT=3000 node .output/server/index.mjs`
- 构建镜像 / 部署测试：用 `release-plugin` 技能（底层 `scripts/build_image.sh . <版本>`、`deploy_to_test.sh . <版本>`）

## 目录：有两层 src
工程根是 `crm/src/`，但 TanStack 的 srcDirectory 也叫 `src/`，**应用代码在 `crm/src/src/`**：
- `routes/` 页面路由 + `routes/api/` 后端接口（每个 handler 返回 `Response.json`）
- `components/views/` 三个列表页 · `components/detail/` 详情页区块 · `components/ui/` shadcn 组件
- `lib/repo/` 数据访问层 · `lib/{db,auth,api,changelog,dootask,dootask-server}.ts`
- 导入别名 `#/` = `src/`（如 `#/components/ui/button.tsx`、`#/lib/api`）
- 版本目录 `crm/0.1.0/`：`nginx.conf`、`config.yml`、`docker-compose.yml`、CHANGELOG

## 列表页不在路由文件里
`/`、`/customers`、`/opportunities` 的路由文件是占位（`component: () => null`）。真正内容在 `components/views/{dashboard,customers-list,opportunities-list}.tsx`，由 `keep-alive.tsx` 常驻挂载做保活（隐藏而非卸载，缓存滚动位置；`useActivate(active, fn)` 在视图重新激活时刷新数据）。**改这三个页面要改 views/，改路由文件无效。** 详情页 `$id` 是正常路由，走 `__root` 的 Outlet。

## 数据层与接口约定
- 列表接口返回 `{ data: { items, total } }`；前端 `api()`（`#/lib/api`）已自动解包 `.data`，拿到的是 `{ items, total }`。带 `page`+`pageSize` 才分页，否则返回全部（用于下拉/映射）。
- `updateCustomer/updateOpportunity` 只写 `!== undefined` 的字段：**传 `undefined`=不改，传 `null`=清空**。PATCH 接口把所有字段都列上、未填的传 undefined 靠这个跳过。
- 客户/商机的 PATCH 会自动调 `lib/changelog.ts` 写一条「前后变化」跟进记录，**别再手动补**。
- `lib/db.ts`：首次连接建表，customers 为空时塞演示数据；数据目录由 `CRM_DATA_DIR` 决定（容器挂 `crm-data:/app/data`）。

## 鉴权（`lib/auth.ts`，轻量信任模型）
身份取请求头 `x-user-id`（前端从 `@dootask/tools.getUserInfo` 拿，主程序 iframe 已鉴权）；管理员 = id 在 `CRM_ADMIN_USER_IDS` 内，**该变量为空时所有人按管理员处理**。无头本地直跑回退到种子用户。普通用户的数据查询用 `ownerScope()` 拼 WHERE 过滤。

## shadcn / Tailwind v4 约定
- Radix 用统一的 `radix-ui` 包，**不是** `@radix-ui/react-*`。
- Radix **Select 的 value 不能是空字符串**：筛选「全部」用哨兵值（如 `"all"`），查询时再映射成不传该参数。
- react-day-picker v10 的 classNames 键是 `month_grid`，不是 `table`（重新生成 calendar.tsx 时注意）。

## 部署相关坑
- Dockerfile 用 `node:20`，`src/package.json` 的 `"packageManager": "pnpm@10.33.0"` **必须保留**——否则 corepack 拉最新 pnpm 11（需 Node≥22）构建直接失败。运行镜像只需 `.output`（Nitro 已把 better-sqlite3 原生模块打进去）。
- basePath：vite `base:'/apps/crm/'` + router `basepath:'/apps/crm'`。Nitro 把静态资源放在容器根 `/assets`（不带 base），所以 `nginx.conf` 单独把 `/apps/crm/assets/` 剥前缀转发到 `/assets/`，页面和 `/api/*` 不剥。**验证资源必须单独 curl 一个 `/apps/crm/assets/*.js`**，页面 200 不代表资源能加载。
- `@dootask/tools` 同一个包分两侧，别混用：**前端侧**（`lib/dootask.ts`，`appReady/getUserInfo/pickUsers/openTask`）依赖 `window`、**动态 import 避免 SSR 崩**，仅 DooTask iframe 内有效、独立浏览器走降级；**服务端侧**（`lib/dootask-server.ts` 的 `DooTaskClient`）以 token 调主程序 `http://nginx`。别在组件里引服务端、也别在服务端调浏览器 API。
