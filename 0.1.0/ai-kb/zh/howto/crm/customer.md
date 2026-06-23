---
id: crm.customer.howto
title: 如何新建和管理客户
type: howto
feature: crm
scope: end-user
locale: zh
aliases:
  - 怎么新建客户
  - 添加客户
  - 客户负责人怎么改
  - 客户都有哪些字段
  - 为什么看不到别人的客户
related_tools: []
related_pages: [application]
prerequisites:
  - 已能打开 CRM 客户关系管理
negative:
  - 普通用户看不到、也改不了别人负责的客户
  - 删除客户后无法在界面撤销
last_verified: v1.7.90
---

# 如何新建和管理客户

## 入口
在 DooTask「应用」中打开「客户关系管理」，进入「客户」列表页。客户（customers）是销售对象的主档案，下面可挂联系人、商机和跟进记录。

## 新建客户的步骤
1. 在客户列表页点击右上角「新建客户」。
2. 在弹出表单中填写字段（仅名称必填）。
3. 提交后即出现在列表中。

## 关键字段
- **name 名称**：必填，客户名称。
- **company 公司**：所属公司，可空。
- **status 状态**：客户状态，取自可配置选项（默认种子项含潜在 `lead`、跟进中 `following`、已成交 `signed`、已流失 `lost`）；不填时默认为 `lead`。
- **source 来源**：客户来源，可空。
- **tags 标签**：标签文本，可空。
- **note 备注**：备注，可空。
- **owner_id 负责人**：默认是当前用户，可指定其他 DooTask 用户。
- **next_follow_at 下次跟进时间**：可空。

## 负责人与可见范围
- 负责人（owner）决定数据归属。管理员可看到并修改全部客户；普通用户只能看到、修改自己负责的客户。
- 修改客户信息后，系统会自动记录一条变更跟进，无需手动补录。

## 不支持
- 普通用户不能查看或编辑他人负责的客户。
- 客户删除后界面无撤销入口。

## 相关
- CRM 是什么：[[crm.concept]]
- 入口在哪：[[crm.entry.menu-map]]
- 跟进记录：[[crm.followup.concept]]
