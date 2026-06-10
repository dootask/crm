import { useEffect, useMemo, useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import { api, ApiError } from '#/lib/api'
import type { Customer, Opportunity, OpportunityStage } from '#/lib/types'
import { OPPORTUNITY_STAGE, OPPORTUNITY_STATUS } from '#/lib/types'
import { PageHeader, Loading, EmptyState } from '#/components/ui/misc'
import { Card } from '#/components/ui/card'
import { Button } from '#/components/ui/button'
import { Input, Select, FormRow } from '#/components/ui/field'
import { StageBadge, OppStatusBadge } from '#/components/ui/badge'
import { Modal } from '#/components/ui/modal'
import { formatDate, formatMoney, isOverdue } from '#/lib/format'
import { useUserNames } from '#/lib/use-users'
import { pickUsers } from '#/lib/dootask'

export const Route = createFileRoute('/opportunities/')({
  component: OpportunitiesPage,
})

function OpportunitiesPage() {
  const [stage, setStage] = useState('')
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')
  const [list, setList] = useState<Array<Opportunity> | null>(null)
  const [customers, setCustomers] = useState<Array<Customer>>([])
  const [error, setError] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)

  // 客户名映射（商机仅含 customer_id）。
  const customerMap = useMemo(() => {
    const m = new Map<number, string>()
    for (const c of customers) m.set(c.id, c.name)
    return m
  }, [customers])

  async function load() {
    setError(null)
    try {
      const params = new URLSearchParams()
      if (stage) params.set('stage', stage)
      if (status) params.set('status', status)
      if (search.trim()) params.set('search', search.trim())
      const qs = params.toString()
      const data = await api<Array<Opportunity>>(
        `/opportunities${qs ? `?${qs}` : ''}`,
      )
      setList(data)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '加载失败')
      setList([])
    }
  }

  // 客户列表只在首次加载（用于名称映射与新建选择）。
  useEffect(() => {
    api<Array<Customer>>('/customers')
      .then(setCustomers)
      .catch(() => setCustomers([]))
  }, [])

  useEffect(() => {
    setList(null)
    const t = setTimeout(load, 250)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, status, search])

  const ownerIds = useMemo(() => (list ?? []).map((o) => o.owner_id), [list])
  const nameOf = useUserNames(ownerIds)

  return (
    <div className="p-6">
      <PageHeader
        title="商机"
        action={
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4" /> 新建商机
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <FormRow label="阶段" className="w-40">
          <Select value={stage} onChange={(e) => setStage(e.target.value)}>
            <option value="">全部阶段</option>
            {(Object.keys(OPPORTUNITY_STAGE) as Array<OpportunityStage>).map(
              (k) => (
                <option key={k} value={k}>
                  {OPPORTUNITY_STAGE[k]}
                </option>
              ),
            )}
          </Select>
        </FormRow>
        <FormRow label="状态" className="w-40">
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">全部状态</option>
            {Object.entries(OPPORTUNITY_STATUS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </FormRow>
        <FormRow label="搜索" className="min-w-48 flex-1">
          <Input
            placeholder="按标题搜索"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </FormRow>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">
          {error}
        </div>
      )}

      {list === null ? (
        <Loading />
      ) : list.length === 0 ? (
        <EmptyState
          title="暂无商机"
          hint="点击右上角「新建商机」创建第一条商机。"
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 text-left text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                  <th className="px-4 py-2.5 font-medium">标题</th>
                  <th className="px-4 py-2.5 font-medium">客户</th>
                  <th className="px-4 py-2.5 font-medium">阶段</th>
                  <th className="px-4 py-2.5 font-medium">状态</th>
                  <th className="px-4 py-2.5 font-medium">金额</th>
                  <th className="px-4 py-2.5 font-medium">负责人</th>
                  <th className="px-4 py-2.5 font-medium">下次跟进</th>
                </tr>
              </thead>
              <tbody>
                {list.map((o) => (
                  <tr
                    key={o.id}
                    className="border-b border-zinc-50 last:border-0 hover:bg-zinc-50 dark:border-zinc-800/60 dark:hover:bg-zinc-800/40"
                  >
                    <td className="px-4 py-2.5">
                      <Link
                        to="/opportunities/$id"
                        params={{ id: String(o.id) }}
                        className="font-medium text-blue-600 hover:underline dark:text-blue-400"
                      >
                        {o.title}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-zinc-600 dark:text-zinc-300">
                      {customerMap.get(o.customer_id) ??
                        `客户#${o.customer_id}`}
                    </td>
                    <td className="px-4 py-2.5">
                      <StageBadge stage={o.stage} />
                    </td>
                    <td className="px-4 py-2.5">
                      <OppStatusBadge status={o.status} />
                    </td>
                    <td className="px-4 py-2.5 text-zinc-600 dark:text-zinc-300">
                      {formatMoney(o.amount)}
                    </td>
                    <td className="px-4 py-2.5 text-zinc-600 dark:text-zinc-300">
                      {nameOf(o.owner_id)}
                    </td>
                    <td
                      className={
                        'px-4 py-2.5 ' +
                        (isOverdue(o.next_follow_at)
                          ? 'font-medium text-red-600 dark:text-red-400'
                          : 'text-zinc-600 dark:text-zinc-300')
                      }
                    >
                      {formatDate(o.next_follow_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <CreateOpportunityModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        customers={customers}
        onCreated={() => {
          setShowCreate(false)
          load()
        }}
      />
    </div>
  )
}

function CreateOpportunityModal({
  open,
  onClose,
  customers,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  customers: Array<Customer>
  onCreated: () => void
}) {
  const [customerId, setCustomerId] = useState('')
  const [title, setTitle] = useState('')
  const [stage, setStage] = useState<OpportunityStage>('initial')
  const [amount, setAmount] = useState('')
  const [expectedCloseAt, setExpectedCloseAt] = useState('')
  const [nextFollowAt, setNextFollowAt] = useState('')
  const [ownerId, setOwnerId] = useState<number | null>(null)
  const [ownerManual, setOwnerManual] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const nameOf = useUserNames(ownerId != null ? [ownerId] : [])

  // 每次打开重置表单。
  useEffect(() => {
    if (open) {
      setCustomerId('')
      setTitle('')
      setStage('initial')
      setAmount('')
      setExpectedCloseAt('')
      setNextFollowAt('')
      setOwnerId(null)
      setOwnerManual('')
      setError(null)
    }
  }, [open])

  async function handlePickOwner() {
    const ids = await pickUsers({ multiple: false })
    if (ids === null) {
      // 独立模式降级为手动输入。
      setOwnerId(-1)
      return
    }
    if (ids.length > 0) setOwnerId(ids[0])
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!customerId) {
      setError('请选择所属客户')
      return
    }
    if (!title.trim()) {
      setError('请填写标题')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      // owner_id：-1 表示手动输入模式，取 ownerManual；正数表示选择器结果；null 不传（默认当前用户）。
      let resolvedOwner: number | undefined
      if (ownerId != null && ownerId > 0) resolvedOwner = ownerId
      else if (ownerId === -1 && ownerManual.trim())
        resolvedOwner = Number(ownerManual.trim())

      await api<Opportunity>('/opportunities', {
        method: 'POST',
        json: {
          customer_id: Number(customerId),
          title: title.trim(),
          stage,
          ...(amount.trim() ? { amount: Number(amount) } : {}),
          ...(expectedCloseAt ? { expected_close_at: expectedCloseAt } : {}),
          ...(resolvedOwner != null ? { owner_id: resolvedOwner } : {}),
          ...(nextFollowAt ? { next_follow_at: nextFollowAt } : {}),
        },
      })
      onCreated()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '创建失败')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="新建商机">
      <form onSubmit={submit} className="space-y-3">
        <FormRow label="所属客户 *">
          <Select
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
          >
            <option value="">请选择客户</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </FormRow>
        <FormRow label="标题 *">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="商机标题"
          />
        </FormRow>
        <div className="grid grid-cols-2 gap-3">
          <FormRow label="阶段">
            <Select
              value={stage}
              onChange={(e) => setStage(e.target.value as OpportunityStage)}
            >
              {(Object.keys(OPPORTUNITY_STAGE) as Array<OpportunityStage>).map(
                (k) => (
                  <option key={k} value={k}>
                    {OPPORTUNITY_STAGE[k]}
                  </option>
                ),
              )}
            </Select>
          </FormRow>
          <FormRow label="金额">
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
            />
          </FormRow>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <FormRow label="预计成交时间">
            <Input
              type="date"
              value={expectedCloseAt}
              onChange={(e) => setExpectedCloseAt(e.target.value)}
            />
          </FormRow>
          <FormRow label="下次跟进时间">
            <Input
              type="date"
              value={nextFollowAt}
              onChange={(e) => setNextFollowAt(e.target.value)}
            />
          </FormRow>
        </div>
        <FormRow label="负责人">
          {ownerId === -1 ? (
            <Input
              type="number"
              value={ownerManual}
              onChange={(e) => setOwnerManual(e.target.value)}
              placeholder="手动输入用户 ID"
            />
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-sm text-zinc-600 dark:text-zinc-300">
                {ownerId != null ? nameOf(ownerId) : '默认当前用户'}
              </span>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handlePickOwner}
              >
                选择负责人
              </Button>
              {ownerId != null && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setOwnerId(null)}
                >
                  重置
                </Button>
              )}
            </div>
          )}
        </FormRow>

        {error && (
          <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={onClose}>
            取消
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? '创建中…' : '创建'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
