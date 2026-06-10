// CRM 共享类型与枚举（前后端共用）。

export type CustomerStatus = 'lead' | 'following' | 'signed' | 'lost'

export const CUSTOMER_STATUS: Record<CustomerStatus, string> = {
  lead: '潜在',
  following: '跟进中',
  signed: '已成交',
  lost: '已流失',
}

export type OpportunityStage =
  | 'initial'
  | 'qualified'
  | 'proposal'
  | 'negotiation'

export const OPPORTUNITY_STAGE: Record<OpportunityStage, string> = {
  initial: '初步接触',
  qualified: '需求确认',
  proposal: '方案报价',
  negotiation: '商务谈判',
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
