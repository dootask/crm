import { getDb } from '#/lib/db'
import { resolveUsers } from '#/lib/dootask-server'
import { labelMap } from '#/lib/repo/options'
import { OPPORTUNITY_STATUS } from '#/lib/types'

type FieldDef = {
  key: string
  label: string
  // 把字段值格式化成可读文本（异步以便解析负责人昵称）
  format?: (v: unknown, token: string | null) => Promise<string> | string
}

const empty = (v: unknown) => v === null || v === undefined || v === ''
const show = (v: unknown) => (empty(v) ? '空' : String(v))

async function ownerName(v: unknown, token: string | null): Promise<string> {
  const id = Number(v)
  if (!Number.isFinite(id)) return show(v)
  const map = await resolveUsers([id], token)
  return map[id]?.nickname ?? `用户#${id}`
}

// status（客户）/ stage（商机）的中文名取自可配置选项，运行时按 value 解析，
// 因此这两个字段不在此写死 format，统一在 logEntityChanges 里用 labelMap 处理。
const CUSTOMER_FIELDS: Array<FieldDef> = [
  { key: 'name', label: '名称' },
  { key: 'company', label: '公司' },
  { key: 'status', label: '状态' },
  { key: 'source', label: '来源' },
  { key: 'tags', label: '标签' },
  { key: 'note', label: '备注' },
  { key: 'owner_id', label: '负责人', format: ownerName },
  { key: 'next_follow_at', label: '下次跟进时间', format: (v) => show(v) },
]

const OPPORTUNITY_FIELDS: Array<FieldDef> = [
  { key: 'title', label: '标题' },
  { key: 'stage', label: '阶段' },
  {
    key: 'status',
    label: '状态',
    format: (v) =>
      OPPORTUNITY_STATUS[v as keyof typeof OPPORTUNITY_STATUS] ?? show(v),
  },
  { key: 'owner_id', label: '负责人', format: ownerName },
  { key: 'amount', label: '金额' },
  { key: 'expected_close_at', label: '预计成交时间', format: (v) => show(v) },
  { key: 'lost_reason', label: '输单原因' },
  { key: 'next_follow_at', label: '下次跟进时间', format: (v) => show(v) },
]

/** 修改记录写入结果：含本次变更的字段 key 与生成的记录正文。无变化则为 null。 */
export interface ChangeLogResult {
  changed: Array<string>
  content: string
}

/**
 * 对比 before/after，把发生变化的字段拼成一条「修改」跟进记录写入。
 * 无实际变化则不写。返回变更字段与正文（供动态推送按白名单决策），无变化返回 null。
 */
export async function logEntityChanges(opts: {
  entity: 'customer' | 'opportunity'
  customerId: number
  opportunityId?: number | null
  before: Record<string, unknown>
  after: Record<string, unknown>
  userId: number
  token: string | null
}): Promise<ChangeLogResult | null> {
  const fields =
    opts.entity === 'customer' ? CUSTOMER_FIELDS : OPPORTUNITY_FIELDS
  // 该实体里「可配置选项」字段的 key 及其 value→label 映射。
  const optionKey = opts.entity === 'customer' ? 'status' : 'stage'
  const optionLabels = labelMap(
    opts.entity === 'customer' ? 'customer_status' : 'opportunity_stage',
  )
  const parts: Array<string> = []
  const changed: Array<string> = []
  // 若本次改了下次跟进时间，这条变更记录自身也带上新值，
  // 让时间线里显示 `下次:` 徽章（与表单添加的记录一致）；清空则为 NULL。
  let nextFollowAt: string | null = null
  for (const f of fields) {
    if (!(f.key in opts.after)) continue
    const b = opts.before[f.key]
    const a = opts.after[f.key]
    // 归一化空值后比较
    if (show(b) === show(a)) continue
    let bs: string
    let as: string
    if (f.key === optionKey) {
      bs = empty(b) ? '空' : (optionLabels[String(b)] ?? show(b))
      as = empty(a) ? '空' : (optionLabels[String(a)] ?? show(a))
    } else {
      const fmt = f.format ?? ((v: unknown) => show(v))
      bs = await fmt(b, opts.token)
      as = await fmt(a, opts.token)
    }
    parts.push(`${f.label}：${bs} → ${as}`)
    changed.push(f.key)
    if (f.key === 'next_follow_at') {
      nextFollowAt = empty(a) ? null : String(a).slice(0, 10)
    }
  }
  if (parts.length === 0) return null

  const label = opts.entity === 'customer' ? '修改客户信息' : '修改商机信息'
  const content = `【${label}】${parts.join('；')}`
  getDb()
    .prepare(
      `INSERT INTO follow_ups (customer_id, opportunity_id, content, follow_by, next_follow_at)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(
      opts.customerId,
      opts.opportunityId ?? null,
      content,
      opts.userId,
      nextFollowAt,
    )
  return { changed, content }
}

/** 触发任务聊天动态推送的字段白名单（噪音字段如名称/标签/备注不推）。 */
export const NOTIFY_FIELDS: Record<'customer' | 'opportunity', ReadonlyArray<string>> = {
  customer: ['status', 'owner_id', 'next_follow_at'],
  opportunity: [
    'stage',
    'status',
    'owner_id',
    'amount',
    'expected_close_at',
    'next_follow_at',
  ],
}

/** 本次变更是否命中白名单（决定要不要推送到任务聊天）。 */
export function shouldNotify(
  entity: 'customer' | 'opportunity',
  changed: Array<string>,
): boolean {
  const allow = NOTIFY_FIELDS[entity]
  return changed.some((k) => allow.includes(k))
}
