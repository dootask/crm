import { getDb } from '#/lib/db'
import type {
  AuthUser,
  Opportunity,
  OpportunityStage,
  OpportunityStatus,
} from '#/lib/types'
import { ownerScope } from '#/lib/auth'

export interface OpportunityInput {
  customer_id: number
  title: string
  stage?: OpportunityStage
  status?: OpportunityStatus
  owner_id?: number
  amount?: number | null
  expected_close_at?: string | null
  lost_reason?: string | null
  next_follow_at?: string | null
}

export function listOpportunities(
  user: AuthUser,
  filter: {
    customer_id?: number
    stage?: string
    status?: string
    owner_id?: number
    search?: string
  } = {},
): Array<Opportunity> {
  const scope = ownerScope(user)
  const where: Array<string> = [scope.clause]
  const params: Array<unknown> = [...scope.params]
  if (filter.customer_id) {
    where.push('customer_id = ?')
    params.push(filter.customer_id)
  }
  if (filter.stage) {
    where.push('stage = ?')
    params.push(filter.stage)
  }
  if (filter.status) {
    where.push('status = ?')
    params.push(filter.status)
  }
  if (filter.owner_id) {
    where.push('owner_id = ?')
    params.push(filter.owner_id)
  }
  if (filter.search) {
    where.push('title LIKE ?')
    params.push(`%${filter.search}%`)
  }
  return getDb()
    .prepare(
      `SELECT * FROM opportunities WHERE ${where.join(' AND ')} ORDER BY updated_at DESC, id DESC`,
    )
    .all(...params) as Array<Opportunity>
}

export function getOpportunity(id: number): Opportunity | undefined {
  return getDb().prepare('SELECT * FROM opportunities WHERE id = ?').get(id) as
    | Opportunity
    | undefined
}

export function createOpportunity(
  input: OpportunityInput,
  createdBy: number,
): Opportunity {
  const info = getDb()
    .prepare(
      `INSERT INTO opportunities (customer_id, title, stage, status, owner_id, amount, expected_close_at, lost_reason, next_follow_at, created_by)
       VALUES (@customer_id, @title, @stage, @status, @owner_id, @amount, @expected_close_at, @lost_reason, @next_follow_at, @created_by)`,
    )
    .run({
      customer_id: input.customer_id,
      title: input.title,
      stage: input.stage ?? 'initial',
      status: input.status ?? 'open',
      owner_id: input.owner_id ?? createdBy,
      amount: input.amount ?? null,
      expected_close_at: input.expected_close_at ?? null,
      lost_reason: input.lost_reason ?? null,
      next_follow_at: input.next_follow_at ?? null,
      created_by: createdBy,
    })
  return getOpportunity(info.lastInsertRowid as number)!
}

const PATCHABLE = [
  'title',
  'stage',
  'status',
  'owner_id',
  'amount',
  'expected_close_at',
  'lost_reason',
  'next_follow_at',
] as const

export function updateOpportunity(
  id: number,
  patch: Partial<OpportunityInput>,
): Opportunity | undefined {
  const sets: Array<string> = []
  const params: Array<unknown> = []
  for (const key of PATCHABLE) {
    const v = (patch as Record<string, unknown>)[key]
    // 仅更新「显式提供」的字段（undefined 跳过；null 表示清空）
    if (v !== undefined) {
      sets.push(`${key} = ?`)
      params.push(v)
    }
  }
  if (sets.length) {
    sets.push(`updated_at = datetime('now')`)
    params.push(id)
    getDb()
      .prepare(`UPDATE opportunities SET ${sets.join(', ')} WHERE id = ?`)
      .run(...params)
  }
  return getOpportunity(id)
}

export function deleteOpportunity(id: number): boolean {
  return (
    getDb().prepare('DELETE FROM opportunities WHERE id = ?').run(id).changes > 0
  )
}
