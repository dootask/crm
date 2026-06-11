import { getDb } from '#/lib/db'
import type { EntityType } from '#/lib/types'

export interface DueFollowTarget {
  entity_type: EntityType
  entity_id: number
  name: string
  dialog_id: number
  next_follow_at: string
}

/**
 * 取「下次跟进时间 == 指定日期」且有关联任务对话(dialog_id)的客户/商机，
 * 供每日定时任务把到期提醒推到任务聊天。商机仅统计进行中(open)。
 * 一个实体关联多个任务则出多行（逐个对话推送）。
 */
export function listDueFollowTargets(date: string): Array<DueFollowTarget> {
  return getDb()
    .prepare(
      `SELECT tl.entity_type AS entity_type, tl.entity_id AS entity_id,
              c.name AS name, tl.dialog_id AS dialog_id, c.next_follow_at AS next_follow_at
         FROM task_links tl
         JOIN customers c ON tl.entity_id = c.id
        WHERE tl.entity_type = 'customer'
          AND tl.dialog_id IS NOT NULL
          AND c.next_follow_at = ?
       UNION ALL
       SELECT tl.entity_type AS entity_type, tl.entity_id AS entity_id,
              o.title AS name, tl.dialog_id AS dialog_id, o.next_follow_at AS next_follow_at
         FROM task_links tl
         JOIN opportunities o ON tl.entity_id = o.id
        WHERE tl.entity_type = 'opportunity'
          AND tl.dialog_id IS NOT NULL
          AND o.status = 'open'
          AND o.next_follow_at = ?`,
    )
    .all(date, date) as Array<DueFollowTarget>
}

/** 服务端当天日期 YYYY-MM-DD（借数据库，避免 Date API / 时区分歧）。 */
export function dbDate(offsetDays = 0): string {
  return (
    getDb()
      .prepare(`SELECT date('now', 'localtime', ? || ' days') AS d`)
      .get(String(offsetDays)) as { d: string }
  ).d
}
