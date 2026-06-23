---
id: crm.concept
title: CRM 客户关系管理是什么
type: concept
feature: crm
scope: end-user
locale: zh
aliases:
  - CRM 是什么
  - 客户关系管理插件有什么用
  - crm 能管什么
  - 客户、商机、跟进怎么管
related_tools: []
related_pages: [application]
prerequisites: []
negative:
  - CRM 不是主程序内置功能，未安装插件时入口不会出现
  - 不提供独立账号体系，身份沿用 DooTask 登录用户
last_verified: v1.7.90
---

# CRM 客户关系管理是什么

## 定义
CRM（客户关系管理，菜单名「客户关系管理」）是 DooTask 的一个应用插件，application id 为 `crm`。它在 DooTask 主框架内以嵌入页面形式打开，用来在团队协作环境里集中记录客户、销售商机和跟进过程，并能把这些记录关联到 DooTask 任务。

## 核心实体
- **客户（customers）**：销售对象的主档案，含名称、公司、状态、来源、标签、备注、负责人等字段。
- **联系人（contacts）**：隶属于某个客户的对接人，记录姓名、职务、电话、邮箱，可标记主要联系人。
- **商机（opportunities）**：某个客户下的销售机会，含标题、阶段、状态（进行中/赢单/输单）、金额、预计成交时间等。
- **跟进记录（followups）**：围绕客户或商机的时间线，既可手动添加，也会在客户/商机被修改时自动生成一条变更记录。

## 与主程序的关系
- 身份直接沿用 DooTask 当前登录用户，不另建账号。
- 客户、商机可与 DooTask 任务建立关联，相关变更可推送到任务聊天。
- 数据存放在插件自带的独立数据库中，不写入 DooTask 主库。

## 不支持
- 不在主程序内置，未安装 `crm` 插件时看不到入口。
- 不提供独立登录，脱离 DooTask 环境单独打开时仅作降级查看。

## 相关
- 插件元信息：[[crm.plugin.concept]]
- 入口在哪：[[crm.entry.menu-map]]
- 怎么建客户：[[crm.customer.howto]]
- 跟进记录：[[crm.followup.concept]]
