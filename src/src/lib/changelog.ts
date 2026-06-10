import { getDb } from '#/lib/db'
import { resolveUsers } from '#/lib/dootask-server'
import {
  CUSTOMER_STATUS,
  OPPORTUNITY_STAGE,
  OPPORTUNITY_STATUS,
} from '#/lib/types'

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

const CUSTOMER_FIELDS: Array<FieldDef> = [
  { key: 'name', label: '名称' },
  { key: 'company', label: '公司' },
  {
    key: 'status',
    label: '状态',
    format: (v) => CUSTOMER_STATUS[v as keyof typeof CUSTOMER_STATUS] ?? show(v),
  },
  { key: 'source', label: '来源' },
  { key: 'tags', label: '标签' },
  { key: 'note', label: '备注' },
  { key: 'owner_id', label: '负责人', format: ownerName },
  { key: 'next_follow_at', label: '下次跟进时间', format: (v) => show(v) },
]

const OPPORTUNITY_FIELDS: Array<FieldDef> = [
  { key: 'title', label: '标题' },
  {
    key: 'stage',
    label: '阶段',
    format: (v) =>
      OPPORTUNITY_STAGE[v as keyof typeof OPPORTUNITY_STAGE] ?? show(v),
  },
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

/**
 * 对比 before/after，把发生变化的字段拼成一条「修改」跟进记录写入。
 * 无实际变化则不写。返回是否写入。
 */
export async function logEntityChanges(opts: {
  entity: 'customer' | 'opportunity'
  customerId: number
  opportunityId?: number | null
  before: Record<string, unknown>
  after: Record<string, unknown>
  userId: number
  token: string | null
}): Promise<boolean> {
  const fields =
    opts.entity === 'customer' ? CUSTOMER_FIELDS : OPPORTUNITY_FIELDS
  const parts: Array<string> = []
  for (const f of fields) {
    if (!(f.key in opts.after)) continue
    const b = opts.before[f.key]
    const a = opts.after[f.key]
    // 归一化空值后比较
    if (show(b) === show(a)) continue
    const fmt = f.format ?? ((v: unknown) => show(v))
    const bs = await fmt(b, opts.token)
    const as = await fmt(a, opts.token)
    parts.push(`${f.label}：${bs} → ${as}`)
  }
  if (parts.length === 0) return false

  const label = opts.entity === 'customer' ? '修改客户信息' : '修改商机信息'
  const content = `【${label}】${parts.join('；')}`
  getDb()
    .prepare(
      `INSERT INTO follow_ups (customer_id, opportunity_id, content, follow_by, next_follow_at)
       VALUES (?, ?, ?, ?, NULL)`,
    )
    .run(
      opts.customerId,
      opts.opportunityId ?? null,
      content,
      opts.userId,
    )
  return true
}
