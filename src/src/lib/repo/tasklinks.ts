import { getDb } from '#/lib/db'
import type { EntityType, TaskLink } from '#/lib/types'

export function listTaskLinks(
  entityType: EntityType,
  entityId: number,
): Array<TaskLink> {
  return getDb()
    .prepare(
      'SELECT * FROM task_links WHERE entity_type = ? AND entity_id = ? ORDER BY id DESC',
    )
    .all(entityType, entityId) as Array<TaskLink>
}

export function createTaskLink(input: {
  entity_type: EntityType
  entity_id: number
  task_id: number
  dialog_id?: number | null
  title?: string | null
  created_by: number
}): TaskLink | undefined {
  try {
    const info = getDb()
      .prepare(
        `INSERT INTO task_links (entity_type, entity_id, task_id, dialog_id, title, created_by)
         VALUES (@entity_type, @entity_id, @task_id, @dialog_id, @title, @created_by)`,
      )
      .run({
        entity_type: input.entity_type,
        entity_id: input.entity_id,
        task_id: input.task_id,
        dialog_id: input.dialog_id ?? null,
        title: input.title ?? null,
        created_by: input.created_by,
      })
    return getDb()
      .prepare('SELECT * FROM task_links WHERE id = ?')
      .get(info.lastInsertRowid) as TaskLink
  } catch {
    // UNIQUE 冲突：已关联，返回已有记录
    return getDb()
      .prepare(
        'SELECT * FROM task_links WHERE entity_type = ? AND entity_id = ? AND task_id = ?',
      )
      .get(input.entity_type, input.entity_id, input.task_id) as
      | TaskLink
      | undefined
  }
}

export function deleteTaskLink(id: number): boolean {
  return (
    getDb().prepare('DELETE FROM task_links WHERE id = ?').run(id).changes > 0
  )
}
