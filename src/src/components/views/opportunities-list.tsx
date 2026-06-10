import { useEffect, useMemo, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import { api, ApiError } from '#/lib/api'
import {
  OPPORTUNITY_STAGE,
  OPPORTUNITY_STATUS,
  type Customer,
  type Opportunity,
  type OpportunityStage,
  type OpportunityStatus,
} from '#/lib/types'
import { formatDate, formatMoney, isOverdue } from '#/lib/format'
import { useUserNames } from '#/lib/use-users'
import { pickUsers } from '#/lib/dootask'
import { useActivate } from '#/components/keep-alive'
import { PageHeader, Loading, EmptyState } from '#/components/ui/misc'
import { Card, CardContent } from '#/components/ui/card.tsx'
import { Button } from '#/components/ui/button.tsx'
import { Input } from '#/components/ui/input.tsx'
import { Field } from '#/components/ui/form-field.tsx'
import { DatePicker } from '#/components/ui/date-picker.tsx'
import { OppStatusBadge, StageBadge } from '#/components/ui/badge.tsx'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select.tsx'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '#/components/ui/dialog.tsx'

export function OpportunitiesView({ active }: { active: boolean }) {
  const [list, setList] = useState<Array<Opportunity> | null>(null)
  const [customerMap, setCustomerMap] = useState<Map<number, string>>(new Map())
  const [error, setError] = useState<string | null>(null)

  const [stage, setStage] = useState<'all' | OpportunityStage>('all')
  const [status, setStatus] = useState<'all' | OpportunityStatus>('all')
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')

  // 搜索防抖
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300)
    return () => clearTimeout(t)
  }, [search])

  async function reload() {
    setError(null)
    try {
      const params = new URLSearchParams()
      if (stage !== 'all') params.set('stage', stage)
      if (status !== 'all') params.set('status', status)
      if (debounced) params.set('search', debounced)
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

  async function loadCustomers() {
    try {
      const cs = await api<Array<Customer>>('/customers')
      setCustomerMap(new Map(cs.map((c) => [c.id, c.name])))
    } catch {
      /* 客户名解析失败时回退占位 */
    }
  }

  // 初次挂载 + 筛选变化时加载
  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, status, debounced])

  // 客户列表只需拉一次
  useEffect(() => {
    loadCustomers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 切回本视图时后台刷新
  useActivate(active, () => {
    reload()
    loadCustomers()
  })

  const ownerIds = useMemo(
    () => (list ? list.map((o) => o.owner_id) : []),
    [list],
  )
  const nameOf = useUserNames(ownerIds)

  function customerName(id: number): string {
    return customerMap.get(id) ?? `客户#${id}`
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="商机"
        action={<NewOpportunityDialog onCreated={reload} />}
      />

      {/* 筛选 */}
      <div className="flex flex-wrap items-center gap-2">
        <Select value={stage} onValueChange={(v) => setStage(v as typeof stage)}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="阶段" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部阶段</SelectItem>
            {(Object.keys(OPPORTUNITY_STAGE) as Array<OpportunityStage>).map(
              (k) => (
                <SelectItem key={k} value={k}>
                  {OPPORTUNITY_STAGE[k]}
                </SelectItem>
              ),
            )}
          </SelectContent>
        </Select>

        <Select
          value={status}
          onValueChange={(v) => setStatus(v as typeof status)}
        >
          <SelectTrigger className="w-36">
            <SelectValue placeholder="状态" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部状态</SelectItem>
            {(Object.keys(OPPORTUNITY_STATUS) as Array<OpportunityStatus>).map(
              (k) => (
                <SelectItem key={k} value={k}>
                  {OPPORTUNITY_STATUS[k]}
                </SelectItem>
              ),
            )}
          </SelectContent>
        </Select>

        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索商机标题…"
          className="w-56"
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {list === null ? (
        <Loading />
      ) : list.length === 0 ? (
        <EmptyState
          title="暂无商机"
          hint="调整筛选条件，或点击右上角新建商机。"
        />
      ) : (
        <Card>
          <CardContent className="divide-y p-0">
            {list.map((o) => (
              <div
                key={o.id}
                className="flex flex-wrap items-center gap-x-4 gap-y-1 px-6 py-3"
              >
                <Link
                  to="/opportunities/$id"
                  params={{ id: String(o.id) }}
                  className="min-w-40 flex-1 font-medium hover:underline"
                >
                  {o.title}
                </Link>
                <span className="text-sm text-muted-foreground">
                  {customerName(o.customer_id)}
                </span>
                <StageBadge stage={o.stage} />
                <OppStatusBadge status={o.status} />
                <span className="text-sm">{formatMoney(o.amount)}</span>
                <span className="text-xs text-muted-foreground">
                  {nameOf(o.owner_id)}
                </span>
                <span
                  className={
                    isOverdue(o.next_follow_at)
                      ? 'text-xs font-medium text-destructive'
                      : 'text-xs text-muted-foreground'
                  }
                >
                  下次跟进：{formatDate(o.next_follow_at)}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

/* ---------- 新建商机 ---------- */

function NewOpportunityDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false)
  const [customers, setCustomers] = useState<Array<Customer>>([])
  const [customerId, setCustomerId] = useState('')
  const [title, setTitle] = useState('')
  const [stage, setStage] = useState<OpportunityStage>('initial')
  const [amount, setAmount] = useState('')
  const [expectedCloseAt, setExpectedCloseAt] = useState<string | undefined>(
    undefined,
  )
  const [nextFollowAt, setNextFollowAt] = useState<string | undefined>(undefined)
  const [ownerId, setOwnerId] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const nameOf = useUserNames(ownerId != null ? [ownerId] : [])

  useEffect(() => {
    if (!open) return
    setCustomerId('')
    setTitle('')
    setStage('initial')
    setAmount('')
    setExpectedCloseAt(undefined)
    setNextFollowAt(undefined)
    setOwnerId(null)
    setError(null)
    setBusy(false)
    api<Array<Customer>>('/customers')
      .then(setCustomers)
      .catch(() => setCustomers([]))
  }, [open])

  async function pickOwner() {
    const res = await pickUsers({ multiple: false })
    if (res.status === 'picked') {
      setOwnerId(res.ids[0])
    } else if (res.status === 'standalone') {
      const input = window.prompt('请输入负责人用户 ID（留空取消）')
      if (input == null || input.trim() === '') return
      const n = Number(input.trim())
      if (Number.isFinite(n) && n > 0) setOwnerId(n)
    }
    // cancelled：不处理
  }

  async function submit() {
    if (!customerId) {
      setError('请选择所属客户')
      return
    }
    if (!title.trim()) {
      setError('请填写商机标题')
      return
    }
    const amountNum = amount.trim() === '' ? undefined : Number(amount)
    if (amountNum !== undefined && !Number.isFinite(amountNum)) {
      setError('金额必须是数字')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await api<Opportunity>('/opportunities', {
        method: 'POST',
        json: {
          customer_id: Number(customerId),
          title: title.trim(),
          stage,
          amount: amountNum,
          expected_close_at: expectedCloseAt,
          next_follow_at: nextFollowAt,
          owner_id: ownerId ?? undefined,
        },
      })
      setOpen(false)
      onCreated()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '创建失败')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" />
          新建商机
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>新建商机</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Field label="所属客户">
            <Select value={customerId} onValueChange={setCustomerId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="请选择客户" />
              </SelectTrigger>
              <SelectContent>
                {customers.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="标题">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="商机标题"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="阶段">
              <Select
                value={stage}
                onValueChange={(v) => setStage(v as OpportunityStage)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(
                    Object.keys(OPPORTUNITY_STAGE) as Array<OpportunityStage>
                  ).map((k) => (
                    <SelectItem key={k} value={k}>
                      {OPPORTUNITY_STAGE[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="金额">
              <Input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="预计成交时间">
              <DatePicker
                value={expectedCloseAt}
                onChange={setExpectedCloseAt}
                placeholder="预计成交时间"
              />
            </Field>
            <Field label="下次跟进时间">
              <DatePicker
                value={nextFollowAt}
                onChange={setNextFollowAt}
                placeholder="下次跟进时间"
              />
            </Field>
          </div>

          <Field label="负责人">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={pickOwner}
              >
                选择负责人
              </Button>
              <span className="text-sm text-muted-foreground">
                {ownerId == null ? '默认当前用户' : nameOf(ownerId)}
              </span>
              {ownerId != null && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setOwnerId(null)}
                >
                  清除
                </Button>
              )}
            </div>
          </Field>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={busy}>
            {busy ? '创建中…' : '创建'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
