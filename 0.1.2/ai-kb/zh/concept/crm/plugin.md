---
id: crm.plugin.concept
title: CRM 插件元信息与管理员判定
type: concept
feature: crm
scope: admin
locale: zh
aliases:
  - CRM 插件怎么装
  - crm 应用 id 是什么
  - CRM 管理员怎么设置
  - crm 数据存在哪
  - 谁是 CRM 管理员
related_tools: []
related_pages: [application]
prerequisites: []
negative:
  - 不使用 DooTask 主库，CRM 数据单独存放
  - 升级不通过 git pull，需在应用市场更新
last_verified: v1.7.90
---

# CRM 插件元信息与管理员判定

## 定义
CRM 是 DooTask 的应用插件，application id 为 `crm`，作者 DooTask。它作为独立 Docker 容器运行（镜像 `dootask/crm:<version>`），通过应用市场安装，版本随发布走，不固定。

## 关键属性
- **运行形态**：单个 Docker 容器，重启策略 `unless-stopped`。
- **数据存储**：使用 SQLite，挂载本地卷 `crm-data` 到容器 `/app/data`，数据目录由环境变量 `CRM_DATA_DIR` 指定（容器内为 `/app/data`），不写入 DooTask 主库。
- **菜单注入**：安装后在「应用」中心注册「客户关系管理」入口（URL `apps/crm/`）。
- **路由前缀**：页面与接口统一挂在 `/apps/crm` 前缀下。

## 鉴权与管理员判定
- 身份来源：请求头 `x-user-id`，前端从 `@dootask/tools` 的 `getUserInfo` 取得当前 DooTask 用户。
- 管理员名单：配置项「管理员」对应环境变量 `CRM_ADMIN_USER_IDS`（逗号分隔的用户 ID）。
- **判定规则**：用户 ID 在 `CRM_ADMIN_USER_IDS` 中即为管理员；当该变量为空时，所有人都按管理员处理（适合单人或演示场景）。
- 普通用户：数据查询会按归属过滤，只能看到自己负责（owner）的客户与商机。

## 不支持
- 不离线安装到无法访问镜像源的环境。
- 不通过手动改文件升级，需在应用市场更新版本。

## 相关
- CRM 是什么：[[crm.concept]]
- 入口在哪：[[crm.entry.menu-map]]
- 跟进记录：[[crm.followup.concept]]
