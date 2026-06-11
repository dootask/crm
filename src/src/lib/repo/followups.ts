import { getDb } from '#/lib/db'
import type { Attachment, FollowUp } from '#/lib/types'
import { touchCustomerFollow } from '#/lib/repo/customers'

export interface FollowUpInput {
  customer_id: number
  opportunity_id?: number | null
  content: string
  attachments?: Array<Attachment> | null
  follow_by: number
  next_follow_at?: string | null
}

// DB 行：attachments 是 JSON 字符串或 NULL，对外统一解析为数组。
type FollowUpRow = Omit<FollowUp, 'attachments'> & { attachments: string | null }

/** 把数据库行解析成对外的 FollowUp（attachments JSON → 数组，损坏时退回 []）。 */
function mapRow(row: FollowUpRow): FollowUp {
  let attachments: Array<Attachment> = []
  if (row.attachments) {
    try {
      const parsed = JSON.parse(row.attachments)
      if (Array.isArray(parsed)) attachments = parsed
    } catch {
      /* 损坏的 JSON 忽略，按无附件处理 */
    }
  }
  return { ...row, attachments }
}

export function listFollowUps(filter: {
  customer_id?: number
  opportunity_id?: number
}): Array<FollowUp> {
  const where: Array<string> = []
  const params: Array<unknown> = []
  if (filter.customer_id) {
    where.push('customer_id = ?')
    params.push(filter.customer_id)
  }
  if (filter.opportunity_id) {
    where.push('opportunity_id = ?')
    params.push(filter.opportunity_id)
  }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : ''
  const rows = getDb()
    .prepare(`SELECT * FROM follow_ups ${clause} ORDER BY created_at DESC, id DESC`)
    .all(...params) as Array<FollowUpRow>
  return rows.map(mapRow)
}

/**
 * 新建跟进记录；若带 next_follow_at，则同步更新所属客户（及商机）的下次跟进时间，
 * 让「待跟进」仪表盘能据此排序与过期提示。
 */
export function createFollowUp(input: FollowUpInput): FollowUp {
  const db = getDb()
  const tx = db.transaction(() => {
    const attachments =
      input.attachments && input.attachments.length
        ? JSON.stringify(input.attachments)
        : null
    const info = db
      .prepare(
        `INSERT INTO follow_ups (customer_id, opportunity_id, content, attachments, follow_by, next_follow_at)
         VALUES (@customer_id, @opportunity_id, @content, @attachments, @follow_by, @next_follow_at)`,
      )
      .run({
        customer_id: input.customer_id,
        opportunity_id: input.opportunity_id ?? null,
        content: input.content,
        attachments,
        follow_by: input.follow_by,
        next_follow_at: input.next_follow_at ?? null,
      })
    if (input.next_follow_at !== undefined) {
      touchCustomerFollow(input.customer_id, input.next_follow_at ?? null)
      if (input.opportunity_id) {
        db.prepare(
          `UPDATE opportunities SET next_follow_at = ?, updated_at = datetime('now') WHERE id = ?`,
        ).run(input.next_follow_at ?? null, input.opportunity_id)
      }
    }
    return info.lastInsertRowid as number
  })
  const id = tx()
  return mapRow(
    getDb().prepare('SELECT * FROM follow_ups WHERE id = ?').get(id) as FollowUpRow,
  )
}

export function deleteFollowUp(id: number): boolean {
  return getDb().prepare('DELETE FROM follow_ups WHERE id = ?').run(id).changes > 0
}

export function getFollowUp(id: number): FollowUp | undefined {
  const row = getDb().prepare('SELECT * FROM follow_ups WHERE id = ?').get(id) as
    | FollowUpRow
    | undefined
  return row ? mapRow(row) : undefined
}
