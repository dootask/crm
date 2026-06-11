import { getDb } from '#/lib/db'
import type { OptionCategory, OptionItem } from '#/lib/types'

export const OPTION_CATEGORIES: ReadonlyArray<OptionCategory> = [
  'customer_status',
  'opportunity_stage',
]

// badge.tsx 支持的 tone 取值，新增/编辑时据此校验。
export const OPTION_TONES: ReadonlyArray<string> = [
  'gray',
  'blue',
  'green',
  'amber',
  'red',
  'violet',
  'cyan',
]

export function isOptionCategory(v: unknown): v is OptionCategory {
  return typeof v === 'string' && OPTION_CATEGORIES.includes(v as OptionCategory)
}

export function isTone(v: unknown): boolean {
  return typeof v === 'string' && OPTION_TONES.includes(v)
}

/** 该分类绑定的业务表 / 列，用于统计选项用量。 */
function usageTarget(category: OptionCategory): { table: string; column: string } {
  return category === 'customer_status'
    ? { table: 'customers', column: 'status' }
    : { table: 'opportunities', column: 'stage' }
}

export function listOptions(
  category: OptionCategory,
  opts: { includeArchived?: boolean } = {},
): Array<OptionItem> {
  const where = opts.includeArchived
    ? 'category = ?'
    : 'category = ? AND archived = 0'
  return getDb()
    .prepare(
      `SELECT * FROM option_items WHERE ${where} ORDER BY sort_order, id`,
    )
    .all(category) as Array<OptionItem>
}

/** 供前端一次性加载：两类全量（含已停用，前端下拉自行只取 active）。 */
export function listAllForApp(): Record<OptionCategory, Array<OptionItem>> {
  return {
    customer_status: listOptions('customer_status', { includeArchived: true }),
    opportunity_stage: listOptions('opportunity_stage', {
      includeArchived: true,
    }),
  }
}

export function getOption(id: number): OptionItem | undefined {
  return getDb().prepare('SELECT * FROM option_items WHERE id = ?').get(id) as
    | OptionItem
    | undefined
}

/** 用量：被多少条业务记录引用（含已归档记录）。 */
export function optionUsageCount(
  category: OptionCategory,
  value: string,
): number {
  const { table, column } = usageTarget(category)
  return (
    getDb()
      .prepare(`SELECT COUNT(*) AS c FROM ${table} WHERE ${column} = ?`)
      .get(value) as { c: number }
  ).c
}

/** 该分类未停用的选项数量（守卫：不能停用/删除最后一个 active）。 */
function activeCount(category: OptionCategory): number {
  return (
    getDb()
      .prepare(
        'SELECT COUNT(*) AS c FROM option_items WHERE category = ? AND archived = 0',
      )
      .get(category) as { c: number }
  ).c
}

/** 某 value 是否为该分类下「存在且未停用」的选项（写入业务记录时校验用）。 */
export function isActiveValue(category: OptionCategory, value: string): boolean {
  const row = getDb()
    .prepare(
      'SELECT 1 FROM option_items WHERE category = ? AND value = ? AND archived = 0',
    )
    .get(category, value)
  return !!row
}

export function createOption(
  category: OptionCategory,
  label: string,
  tone: string,
): OptionItem {
  const db = getDb()
  const tx = db.transaction((): number => {
    const nextSort =
      ((
        db
          .prepare(
            'SELECT MAX(sort_order) AS m FROM option_items WHERE category = ?',
          )
          .get(category) as { m: number | null }
      ).m ?? -1) + 1
    // 先用占位 value 插入，再据自增 id 生成稳定且与码值解耦的 value。
    const placeholder = `__pending_${category}_${nextSort}`
    const info = db
      .prepare(
        `INSERT INTO option_items (category, value, label, tone, sort_order)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(category, placeholder, label, tone, nextSort)
    const id = info.lastInsertRowid as number
    const prefix = category === 'customer_status' ? 'cs' : 'os'
    db.prepare('UPDATE option_items SET value = ? WHERE id = ?').run(
      `${prefix}_${id}`,
      id,
    )
    return id
  })
  return getOption(tx())!
}

export function updateOption(
  id: number,
  patch: { label?: string; tone?: string },
): OptionItem | undefined {
  const sets: Array<string> = []
  const params: Array<unknown> = []
  if (patch.label !== undefined) {
    sets.push('label = ?')
    params.push(patch.label)
  }
  if (patch.tone !== undefined) {
    sets.push('tone = ?')
    params.push(patch.tone)
  }
  if (sets.length) {
    params.push(id)
    getDb()
      .prepare(`UPDATE option_items SET ${sets.join(', ')} WHERE id = ?`)
      .run(...params)
  }
  return getOption(id)
}

export type OptionMutationResult =
  | { ok: true; option: OptionItem }
  | { ok: false; error: string }

/** 停用/启用。守卫：不能停用某分类最后一个 active 项。 */
export function setArchived(
  id: number,
  archived: boolean,
): OptionMutationResult {
  const opt = getOption(id)
  if (!opt) return { ok: false, error: '选项不存在' }
  if (archived && opt.archived === 0 && activeCount(opt.category) <= 1) {
    return { ok: false, error: '至少保留一个启用选项' }
  }
  getDb()
    .prepare('UPDATE option_items SET archived = ? WHERE id = ?')
    .run(archived ? 1 : 0, id)
  return { ok: true, option: getOption(id)! }
}

/** 与相邻项交换 sort_order 实现上移/下移。 */
export function moveOption(
  id: number,
  dir: 'up' | 'down',
): OptionMutationResult {
  const db = getDb()
  const opt = getOption(id)
  if (!opt) return { ok: false, error: '选项不存在' }
  const neighbor = db
    .prepare(
      dir === 'up'
        ? `SELECT * FROM option_items WHERE category = ? AND sort_order < ?
             ORDER BY sort_order DESC, id DESC LIMIT 1`
        : `SELECT * FROM option_items WHERE category = ? AND sort_order > ?
             ORDER BY sort_order ASC, id ASC LIMIT 1`,
    )
    .get(opt.category, opt.sort_order) as OptionItem | undefined
  if (!neighbor) return { ok: true, option: opt } // 已在端点，无操作
  const swap = db.transaction(() => {
    db.prepare('UPDATE option_items SET sort_order = ? WHERE id = ?').run(
      neighbor.sort_order,
      opt.id,
    )
    db.prepare('UPDATE option_items SET sort_order = ? WHERE id = ?').run(
      opt.sort_order,
      neighbor.id,
    )
  })
  swap()
  return { ok: true, option: getOption(id)! }
}

/** 删除。仅当未被任何业务记录使用时允许；亦不可删最后一个 active。 */
export function deleteOption(id: number): OptionMutationResult {
  const opt = getOption(id)
  if (!opt) return { ok: false, error: '选项不存在' }
  if (optionUsageCount(opt.category, opt.value) > 0) {
    return { ok: false, error: '该选项正在使用，无法删除，请改为停用' }
  }
  if (opt.archived === 0 && activeCount(opt.category) <= 1) {
    return { ok: false, error: '至少保留一个启用选项' }
  }
  getDb().prepare('DELETE FROM option_items WHERE id = ?').run(id)
  return { ok: true, option: opt }
}

/** value → label 映射（changelog 服务端格式化用，含已停用）。 */
export function labelMap(category: OptionCategory): Record<string, string> {
  const rows = listOptions(category, { includeArchived: true })
  const map: Record<string, string> = {}
  for (const r of rows) map[r.value] = r.label
  return map
}
