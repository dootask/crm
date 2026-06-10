# CRM 插件 — 给 AI 的避坑说明

DooTask CRM 插件（appid `crm`）。TanStack Start（file-router）+ React 19 + Tailwind v4 + shadcn/ui + SQLite（better-sqlite3）。只记录从代码本身看不出、容易判断错的点。

## 目录有两层 src
项目根是 `crm/`，前端工程在 `crm/src/`，而 TanStack 的 `srcDirectory` 又是 `src/`，**应用代码实际在 `crm/src/src/`**（路由 `src/src/routes/`，组件 `src/src/components/`）。所有命令在 `crm/src/` 下跑。

## 三个列表页不在路由文件里
`/`、`/customers`、`/opportunities` 的路由文件是占位（`component: () => null`）。真正的页面内容在 `src/src/components/views/{dashboard,customers-list,opportunities-list}.tsx`，由 `components/keep-alive.tsx` 常驻挂载做「保活」。**改这三个页面要改 views/，改路由文件没用。** 详情页 `$id` 是正常路由。

## basePath 与静态资源
vite `base:'/apps/crm/'` + router `basepath:'/apps/crm'`。Nitro 把静态资源放在容器根 `/assets`（不带 base），所以 `0.1.0/nginx.conf` 里有一条**单独剥前缀**的 `location /apps/crm/assets/ → http://crm:3000/assets/`，其余不剥前缀。验证资源时**必须单独 curl 一个 `/apps/crm/assets/*.js`**，页面 200 不代表资源能加载。

## Docker
Dockerfile 用 `node:20`，`src/package.json` 里 `"packageManager": "pnpm@10.33.0"` 是必需的——否则 corepack 拉最新 pnpm 11（需 Node≥22）直接失败。运行镜像只需 `.output`（Nitro 已把 better-sqlite3 原生模块打进去）。构建/部署用 dootask-create-plugin 技能的 `scripts/build_image.sh . <版本>` 和 `deploy_to_test.sh . <版本>`。

## shadcn / Tailwind v4
- shadcn 组件从 `#/components/ui/*.tsx`（带 `.tsx`）导入，内部用 `cn from "#/lib/utils.ts"` 和统一的 `radix-ui` 包（不是 `@radix-ui/react-*`）。
- Radix **Select 的 value 不能是空字符串**：筛选「全部」用哨兵值（如 `"all"`），查询时再映射成不传该参数。
- react-day-picker v10 的 classNames 键是 `month_grid`，不是 `table`（calendar.tsx 已改）。

## 接口与数据层
- 列表接口返回 `{ data: { items, total } }`；`api()`（`#/lib/api`）已自动解包 `.data`，前端拿到的是 `{items,total}`。传 `page`+`pageSize` 才分页，否则返回全部。
- `updateCustomer/updateOpportunity` 只写 `!== undefined` 的字段：**传 `undefined` = 不改，传 `null` = 清空**。PATCH 接口把所有字段都列上、未填的传 undefined，靠这个跳过。
- 客户/商机的 PATCH 接口会自动调 `lib/changelog.ts` 写一条「前后变化」跟进记录，别再手动补一条。

## 鉴权
身份来自请求头 `x-user-id`（信任前端传入，前端从 `getUserInfo` 取）；管理员 = id 在 `CRM_ADMIN_USER_IDS` 内；**该环境变量为空时所有人按管理员处理**。无头（本地直跑）回退到种子用户。

## 验证
`cd src`：`pnpm build` 走 esbuild **不做类型检查**，类型要单独 `npx tsc --noEmit`。本地跑：`CRM_DATA_DIR=/tmp/x CRM_ADMIN_USER_IDS=1 PORT=3000 node .output/server/index.mjs`。`@dootask/tools` 的 `pickUsers/openTask/getUserInfo` 只在 DooTask iframe 内有效，独立浏览器里会走降级分支。
