import { getDb } from '#/lib/db'
import type { AuthUser, Customer, CustomerStatus } from '#/lib/types'
import { ownerScope } from '#/lib/auth'

export interface CustomerInput {
  name: string
  company?: string | null
  status?: CustomerStatus
  source?: string | null
  tags?: string | null
  note?: string | null
  owner_id?: number
  next_follow_at?: string | null
}

export function listCustomers(
  user: AuthUser,
  filter: { search?: string; status?: string; owner_id?: number } = {},
  // 不传 limit 时返回全部（供下拉/映射等场景）；传 limit 则分页。
  page: { limit?: number; offset?: number } = {},
  // lastFollow=true 时附带每个客户最近一条跟进（列表「详细」视图用）。
  // statusCounts=true 时附带「按状态分组的数量」（忽略 status 筛选自身，供筛选下拉显示）。
  opts: { lastFollow?: boolean; statusCounts?: boolean } = {},
): {
  items: Array<Customer>
  total: number
  statusCounts?: Record<string, number>
} {
  const scope = ownerScope(user)
  const db = getDb()

  // 基础条件（scope + owner_id + search）：用于按状态计数（不含 status 筛选）。
  const baseWhere: Array<string> = [scope.clause]
  const baseParams: Array<unknown> = [...scope.params]
  if (filter.owner_id) {
    baseWhere.push('owner_id = ?')
    baseParams.push(filter.owner_id)
  }
  if (filter.search) {
    baseWhere.push('(name LIKE ? OR company LIKE ? OR tags LIKE ?)')
    const like = `%${filter.search}%`
    baseParams.push(like, like, like)
  }

  // 列表/总数条件：在基础条件上再叠加 status 筛选。
  const where = [...baseWhere]
  const params = [...baseParams]
  if (filter.status) {
    where.push('status = ?')
    params.push(filter.status)
  }
  const whereSql = where.join(' AND ')
  const total = (
    db
      .prepare(`SELECT COUNT(*) AS n FROM customers WHERE ${whereSql}`)
      .get(...params) as { n: number }
  ).n
  const lastFollowCols = opts.lastFollow
    ? `,
       (SELECT content FROM follow_ups f WHERE f.customer_id = customers.id
          ORDER BY f.created_at DESC, f.id DESC LIMIT 1) AS last_follow_content,
       (SELECT created_at FROM follow_ups f WHERE f.customer_id = customers.id
          ORDER BY f.created_at DESC, f.id DESC LIMIT 1) AS last_follow_at`
    : ''
  let sql = `SELECT customers.*${lastFollowCols} FROM customers WHERE ${whereSql} ORDER BY updated_at DESC, id DESC`
  const qparams = [...params]
  if (page.limit != null) {
    sql += ' LIMIT ? OFFSET ?'
    qparams.push(page.limit, page.offset ?? 0)
  }
  const items = db.prepare(sql).all(...qparams) as Array<Customer>

  if (!opts.statusCounts) return { items, total }

  const baseWhereSql = baseWhere.join(' AND ')
  const rows = db
    .prepare(
      `SELECT status, COUNT(*) AS n FROM customers WHERE ${baseWhereSql} GROUP BY status`,
    )
    .all(...baseParams) as Array<{ status: string; n: number }>
  const statusCounts: Record<string, number> = {}
  for (const r of rows) statusCounts[r.status] = r.n
  return { items, total, statusCounts }
}

export function getCustomer(id: number): Customer | undefined {
  return getDb().prepare('SELECT * FROM customers WHERE id = ?').get(id) as
    | Customer
    | undefined
}

export function createCustomer(
  input: CustomerInput,
  createdBy: number,
): Customer {
  const info = getDb()
    .prepare(
      `INSERT INTO customers (name, company, status, source, tags, note, owner_id, next_follow_at, created_by)
       VALUES (@name, @company, @status, @source, @tags, @note, @owner_id, @next_follow_at, @created_by)`,
    )
    .run({
      name: input.name,
      company: input.company ?? null,
      status: input.status ?? 'lead',
      source: input.source ?? null,
      tags: input.tags ?? null,
      note: input.note ?? null,
      owner_id: input.owner_id ?? createdBy,
      next_follow_at: input.next_follow_at ?? null,
      created_by: createdBy,
    })
  return getCustomer(info.lastInsertRowid as number)!
}

const PATCHABLE = [
  'name',
  'company',
  'status',
  'source',
  'tags',
  'note',
  'owner_id',
  'next_follow_at',
] as const

export function updateCustomer(
  id: number,
  patch: Partial<CustomerInput>,
): Customer | undefined {
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
      .prepare(`UPDATE customers SET ${sets.join(', ')} WHERE id = ?`)
      .run(...params)
  }
  return getCustomer(id)
}

export function touchCustomerFollow(id: number, nextFollowAt: string | null) {
  getDb()
    .prepare(
      `UPDATE customers SET next_follow_at = ?, updated_at = datetime('now') WHERE id = ?`,
    )
    .run(nextFollowAt, id)
}

export function deleteCustomer(id: number): boolean {
  return (
    getDb().prepare('DELETE FROM customers WHERE id = ?').run(id).changes > 0
  )
}
