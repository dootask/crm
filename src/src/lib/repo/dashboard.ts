import { getDb } from '#/lib/db'
import type { AuthUser } from '#/lib/types'
import { ownerScope } from '#/lib/auth'

export interface FollowItem {
  kind: 'customer' | 'opportunity'
  id: number
  title: string // 客户名 或 商机标题
  subtitle: string | null // 公司 或 所属客户
  owner_id: number
  status: string
  next_follow_at: string
  overdue: number // 1 = 已过期
  customer_id: number
}

/** 我（或全部，管理员）需要跟进的客户与商机，按下次跟进时间升序，过期在前。 */
export function myFollowUps(user: AuthUser): {
  items: Array<FollowItem>
  overdue: number
} {
  const scope = ownerScope(user)
  const cust = getDb()
    .prepare(
      `SELECT 'customer' AS kind, id, name AS title, company AS subtitle,
              owner_id, status, next_follow_at, id AS customer_id,
              CASE WHEN date(next_follow_at) < date('now') THEN 1 ELSE 0 END AS overdue
       FROM customers
       WHERE next_follow_at IS NOT NULL AND status NOT IN ('signed','lost') AND ${scope.clause}`,
    )
    .all(...scope.params) as Array<FollowItem>

  const opps = getDb()
    .prepare(
      `SELECT 'opportunity' AS kind, o.id, o.title AS title, c.name AS subtitle,
              o.owner_id, o.status, o.next_follow_at, o.customer_id AS customer_id,
              CASE WHEN date(o.next_follow_at) < date('now') THEN 1 ELSE 0 END AS overdue
       FROM opportunities o JOIN customers c ON c.id = o.customer_id
       WHERE o.next_follow_at IS NOT NULL AND o.status = 'open' AND ${scope.clause.replace(/owner_id/g, 'o.owner_id')}`,
    )
    .all(...scope.params) as Array<FollowItem>

  const items = [...cust, ...opps].sort((a, b) =>
    a.next_follow_at < b.next_follow_at ? -1 : a.next_follow_at > b.next_follow_at ? 1 : 0,
  )
  const overdue = items.filter((i) => i.overdue === 1).length
  return { items, overdue }
}

export interface Stats {
  customers: number
  open_opportunities: number
  won: number
  open_amount: number
  overdue_follow: number
}

export function stats(user: AuthUser): Stats {
  const db = getDb()
  const cs = ownerScope(user)
  const os = ownerScope(user)
  const customers = (
    db
      .prepare(`SELECT COUNT(*) c FROM customers WHERE ${cs.clause}`)
      .get(...cs.params) as { c: number }
  ).c
  const openOpps = (
    db
      .prepare(
        `SELECT COUNT(*) c FROM opportunities WHERE status='open' AND ${os.clause}`,
      )
      .get(...os.params) as { c: number }
  ).c
  const won = (
    db
      .prepare(
        `SELECT COUNT(*) c FROM opportunities WHERE status='won' AND ${os.clause}`,
      )
      .get(...os.params) as { c: number }
  ).c
  const openAmount = (
    db
      .prepare(
        `SELECT COALESCE(SUM(amount),0) s FROM opportunities WHERE status='open' AND ${os.clause}`,
      )
      .get(...os.params) as { s: number }
  ).s
  const overdue = (
    db
      .prepare(
        `SELECT COUNT(*) c FROM customers WHERE next_follow_at IS NOT NULL AND status NOT IN ('signed','lost') AND date(next_follow_at) < date('now') AND ${cs.clause}`,
      )
      .get(...cs.params) as { c: number }
  ).c
  return {
    customers,
    open_opportunities: openOpps,
    won,
    open_amount: openAmount,
    overdue_follow: overdue,
  }
}
