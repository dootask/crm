---
id: crm.entry.menu-map
title: CRM 客户关系管理入口
type: menu-map
feature: crm
scope: end-user
locale: zh
aliases:
  - CRM 在哪打开
  - 怎么进客户关系管理
  - 找不到 CRM 入口
  - 客户管理菜单在哪
  - crm 怎么进去
related_tools: []
related_pages: [application]
prerequisites:
  - 应用市场已安装 crm 插件
negative:
  - 主程序不内置 CRM，未装插件时入口不会出现
  - 入口对所有人可见，但普通用户进入后只看到自己负责的数据
last_verified: v1.7.90
---

# CRM 客户关系管理入口

## 路径
CRM 由独立插件（application id `crm`）提供，安装后在应用中心注册一个菜单项「客户关系管理」（URL `apps/crm/`）：

- 桌面端：左侧栏「应用」→「客户关系管理」
- 移动端：底部「应用」→「客户关系管理」
- 打开时 URL 会自动带上主题、语言和当前用户身份参数

## 加载方式
- 在 DooTask 主框架内以内嵌页面方式打开。
- 沉浸式展示：进入后全屏显示，主程序左侧主导航会被收起。
- 进入后看到仪表盘、客户、商机等页面，由插件自身渲染。

## 权限可见性
- 入口本身：所有已登录用户都能看到同一个菜单项。
- 进入后的数据范围：管理员（ID 在 `CRM_ADMIN_USER_IDS` 中，或该变量为空时的所有人）可见全部客户与商机；普通用户只能看到自己负责的记录。

## 看不到入口怎么办
1. 确认应用市场已安装 `crm` 插件。
2. 容器首次启动需拉取镜像，可能需要等待几分钟。
3. 安装完成后刷新页面或重新登录，让菜单生效。

## 不支持
- 主程序不内置 CRM，未安装 `crm` 插件时入口不会出现。
- 入口对所有人可见，但普通用户进入后只能看到自己负责的数据，看不到他人的客户与商机。

## 相关
- CRM 是什么：[[crm.concept]]
- 插件元信息：[[crm.plugin.concept]]
- 怎么建客户：[[crm.customer.howto]]
