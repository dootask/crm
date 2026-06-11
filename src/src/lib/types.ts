// CRM 共享类型与枚举（前后端共用）。

// 客户状态 / 商机阶段已改为「运行时可配置」（存于 option_items 表，管理页维护）。
// 下面的字面量联合放宽为 string 以接纳任意码值；常量映射保留作为：
//   1) 首次安装的种子默认项（见 lib/db.ts seedOptions）
//   2) 前端选项尚未加载时的兜底标签（见 lib/use-options.tsx）
export type CustomerStatus = string

export const CUSTOMER_STATUS: Record<string, string> = {
  lead: '潜在',
  following: '跟进中',
  signed: '已成交',
  lost: '已流失',
}

export type OpportunityStage = string

export const OPPORTUNITY_STAGE: Record<string, string> = {
  initial: '初步接触',
  qualified: '需求确认',
  proposal: '方案报价',
  negotiation: '商务谈判',
}

/** 可配置选项的分类。 */
export type OptionCategory = 'customer_status' | 'opportunity_stage'

/** 一条可配置选项（option_items 表行）。tone 对应 badge.tsx 的 Tone。 */
export interface OptionItem {
  id: number
  category: OptionCategory
  value: string
  label: string
  tone: string
  sort_order: number
  archived: number // 0 | 1
}

export type OpportunityStatus = 'open' | 'won' | 'lost'

export const OPPORTUNITY_STATUS: Record<OpportunityStatus, string> = {
  open: '进行中',
  won: '赢单',
  lost: '输单',
}

export type EntityType = 'customer' | 'opportunity'

export interface Customer {
  id: number
  name: string
  company: string | null
  status: CustomerStatus
  source: string | null
  tags: string | null
  note: string | null
  owner_id: number
  next_follow_at: string | null
  created_by: number
  created_at: string
  updated_at: string
  // 列表「详细」视图用：最近一条跟进（仅列表带 detail 时返回）
  last_follow_content?: string | null
  last_follow_at?: string | null
}

export interface Contact {
  id: number
  customer_id: number
  name: string
  title: string | null
  phone: string | null
  email: string | null
  is_primary: number // 0 | 1
  note: string | null
  created_at: string
  updated_at: string
}

export interface FollowUp {
  id: number
  customer_id: number
  opportunity_id: number | null
  content: string
  follow_by: number
  next_follow_at: string | null
  created_at: string
}

export interface Opportunity {
  id: number
  customer_id: number
  title: string
  stage: OpportunityStage
  status: OpportunityStatus
  owner_id: number
  amount: number | null
  expected_close_at: string | null
  lost_reason: string | null
  next_follow_at: string | null
  created_by: number
  created_at: string
  updated_at: string
  // 列表「详细」视图用：最近一条跟进（仅列表带 detail 时返回）
  last_follow_content?: string | null
  last_follow_at?: string | null
}

export interface TaskLink {
  id: number
  entity_type: EntityType
  entity_id: number
  task_id: number
  title: string | null
  created_by: number
  created_at: string
}

/** 当前请求用户（由 auth.resolveUser 解析）。 */
export interface AuthUser {
  userId: number
  isAdmin: boolean
}

/** 用户展示信息（昵称解析结果）。 */
export interface UserLite {
  userid: number
  nickname: string
  email?: string
}
