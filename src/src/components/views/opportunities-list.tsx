import { useEffect, useMemo, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import { api, ApiError } from '#/lib/api'
import { OPPORTUNITY_STATUS } from '#/lib/types'
import type {
  Customer,
  Opportunity,
  OpportunityStage,
  OpportunityStatus,
} from '#/lib/types'
import { useOpportunityStageOptions } from '#/lib/use-options'
import { formatDate, formatMoney, isOverdue, plainExcerpt } from '#/lib/format'
import { useUserNames } from '#/lib/use-users'
import { pickUsers, useAuthReady } from '#/lib/dootask'
import { messageError } from '#/lib/message'
import { linkPendingTasks } from '#/components/detail/task-picker-dialog.tsx'
import type { TaskSelection } from '#/components/detail/task-picker-dialog.tsx'
import { PendingTaskLinks } from '#/components/detail/pending-task-links.tsx'
import { useActivate } from '#/components/keep-alive'
import { PageHeader, Loading, EmptyState } from '#/components/ui/misc'
import { Pager, DEFAULT_PAGE_SIZE } from '#/components/ui/pager.tsx'
import { ViewToggle } from '#/components/ui/view-toggle.tsx'
import type { ListView } from '#/components/ui/view-toggle.tsx'
import { usePersistentState } from '#/lib/use-persistent'
import { Card, CardContent } from '#/components/ui/card.tsx'
import { Button } from '#/components/ui/button.tsx'
import { Input } from '#/components/ui/input.tsx'
import { Field } from '#/components/ui/form-field.tsx'
import { DatePicker } from '#/components/ui/date-picker.tsx'
import { OppStatusBadge, StageBadge, ToneDot } from '#/components/ui/badge.tsx'
import type { Tone } from '#/components/ui/badge.tsx'
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

  const [total, setTotal] = useState(0)
  const [stage, setStage] = useState<'all' | OpportunityStage>('all')
  const [status, setStatus] = useState<'all' | OpportunityStatus>('all')
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [page, setPage] = usePersistentState('crm.opportunities.page', 1)
  const [pageSize, setPageSize] = usePersistentState(
    'crm.opportunities.pageSize',
    DEFAULT_PAGE_SIZE,
  )
  const [view, setView] = usePersistentState<ListView>(
    'crm.opportunities.view',
    'simple',
  )
  const stageOptions = useOpportunityStageOptions()
  const authReady = useAuthReady()

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
      params.set('page', String(page))
      params.set('pageSize', String(pageSize))
      // 始终带回最近一条跟进，「详细」视图直接渲染，切换无需重新请求。
      params.set('detail', '1')
      const res = await api<{ items: Array<Opportunity>; total: number }>(
        `/opportunities?${params.toString()}`,
      )
      setList(res.items)
      setTotal(res.total)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '加载失败')
      setList([])
      setTotal(0)
    }
  }

  async function loadCustomers() {
    try {
      const cs = await api<{ items: Array<Customer>; total: number }>(
        '/customers',
      )
      setCustomerMap(new Map(cs.items.map((c) => [c.id, c.name])))
    } catch {
      /* 客户名解析失败时回退占位 */
    }
  }

  // 初次挂载 + 筛选 / 页码变化时加载。等握手完成再首拉，避免匿名请求。
  useEffect(() => {
    if (!authReady) return
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, status, debounced, page, pageSize, authReady])

  // 客户列表只需拉一次（同样等握手完成）
  useEffect(() => {
    if (!authReady) return
    loadCustomers()
  }, [authReady])

  // 切回本视图时后台刷新
  useActivate(active, () => {
    reload()
    loadCustomers()
  })

  // 筛选 / 每页条数变化回到第 1 页（在事件里重置，避免与查询 effect 级联）。
  function changeStage(v: 'all' | OpportunityStage) {
    setStage(v)
    setPage(1)
  }
  function changeStatus(v: 'all' | OpportunityStatus) {
    setStatus(v)
    setPage(1)
  }
  function changeSearch(v: string) {
    setSearch(v)
    setPage(1)
  }
  function changePageSize(n: number) {
    setPageSize(n)
    setPage(1)
  }

  const ownerIds = useMemo(
    () => (list ? list.map((o) => o.owner_id) : []),
    [list],
  )
  const nameOf = useUserNames(ownerIds)

  function customerName(id: number): string {
    return customerMap.get(id) ?? `客户#${id}`
  }

  return (
    <div>
      <PageHeader
        title="商机"
        action={<NewOpportunityDialog onCreated={reload} />}
      />

      {/* 筛选 */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Input
          value={search}
          onChange={(e) => changeSearch(e.target.value)}
          placeholder="搜索商机标题…"
          className="w-full sm:max-w-xs"
        />

        <Select value={stage} onValueChange={(v) => changeStage(v)}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="阶段" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部阶段</SelectItem>
            {stageOptions.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                <ToneDot tone={o.tone as Tone} />
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={status}
          onValueChange={(v) => changeStatus(v as typeof status)}
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
        <ViewToggle value={view} onChange={setView} />
      </div>

      {error && (
        <div className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {list === null ? (
        <Card className="py-0">
          <CardContent className="p-0">
            <Loading center />
          </CardContent>
        </Card>
      ) : list.length === 0 ? (
        <EmptyState
          title="暂无商机"
          hint="调整筛选条件，或点击右上角新建商机。"
        />
      ) : (
        <>
          <Card className="py-0">
            <CardContent className="p-0">
              <ul className="divide-y">
                {list.map((o) => (
                  <li key={o.id}>
                    <Link
                      to="/opportunities/$id"
                      params={{ id: String(o.id) }}
                      className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 transition hover:bg-accent/50"
                    >
                      <span className="min-w-40 flex-1 text-[15px] font-medium">
                        {o.title}
                      </span>
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
                            ? 'text-xs font-medium text-red-600 dark:text-red-400'
                            : 'text-xs text-muted-foreground'
                        }
                      >
                        下次跟进：{formatDate(o.next_follow_at)}
                      </span>
                      {view === 'detailed' && (
                        <span className="w-full truncate text-xs text-muted-foreground">
                          {o.last_follow_content
                            ? `最近跟进：${plainExcerpt(o.last_follow_content)}（${formatDate(o.last_follow_at ?? null)}）`
                            : '最近跟进：暂无'}
                        </span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
          <Pager
            total={total}
            page={page}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={changePageSize}
          />
        </>
      )}
    </div>
  )
}

/* ---------- 新建商机 ---------- */

function NewOpportunityDialog({ onCreated }: { onCreated: () => void }) {
  const stageOptions = useOpportunityStageOptions()
  const defaultStage = stageOptions[0]?.value ?? 'initial'
  const [open, setOpen] = useState(false)
  const [customers, setCustomers] = useState<Array<Customer>>([])
  const [customerId, setCustomerId] = useState('')
  const [title, setTitle] = useState('')
  const [stage, setStage] = useState<OpportunityStage>(defaultStage)
  const [amount, setAmount] = useState('')
  const [expectedCloseAt, setExpectedCloseAt] = useState<string | undefined>(
    undefined,
  )
  const [nextFollowAt, setNextFollowAt] = useState<string | undefined>(
    undefined,
  )
  const [ownerId, setOwnerId] = useState<number | null>(null)
  const [pendingTasks, setPendingTasks] = useState<Array<TaskSelection>>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const nameOf = useUserNames(ownerId != null ? [ownerId] : [])

  useEffect(() => {
    if (!open) return
    setCustomerId('')
    setTitle('')
    setStage(defaultStage)
    setAmount('')
    setExpectedCloseAt(undefined)
    setNextFollowAt(undefined)
    setOwnerId(null)
    setPendingTasks([])
    setError(null)
    setBusy(false)
    api<{ items: Array<Customer>; total: number }>('/customers')
      .then((res) => setCustomers(res.items))
      .catch(() => setCustomers([]))
    // 仅在对话框开关时重置；defaultStage 取打开当下的值，不随其变化重跑。
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      const opp = await api<Opportunity>('/opportunities', {
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
      const failed = await linkPendingTasks('opportunity', opp.id, pendingTasks)
      if (failed.length)
        messageError(
          `商机已创建，但 ${failed.length} 个任务关联失败：${failed[0]}`,
        )
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
              <Select value={stage} onValueChange={(v) => setStage(v)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {stageOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      <ToneDot tone={o.tone as Tone} />
                      {o.label}
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

          <Field label="关联任务（可选）">
            <PendingTaskLinks
              value={pendingTasks}
              onChange={setPendingTasks}
              defaultName={title.trim() || undefined}
            />
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
