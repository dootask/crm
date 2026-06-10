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
): Array<Customer> {
  const scope = ownerScope(user)
  const where: Array<string> = [scope.clause]
  const params: Array<unknown> = [...scope.params]

  if (filter.status) {
    where.push('status = ?')
    params.push(filter.status)
  }
  if (filter.owner_id) {
    where.push('owner_id = ?')
    params.push(filter.owner_id)
  }
  if (filter.search) {
    where.push('(name LIKE ? OR company LIKE ? OR tags LIKE ?)')
    const like = `%${filter.search}%`
    params.push(like, like, like)
  }
  return getDb()
    .prepare(
      `SELECT * FROM customers WHERE ${where.join(' AND ')} ORDER BY updated_at DESC, id DESC`,
    )
    .all(...params) as Array<Customer>
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
