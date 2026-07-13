import { useEffect, useRef, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import { api, ApiError } from '#/lib/api'
import type { Customer, CustomerStatus } from '#/lib/types'
import { useCustomerStatusOptions } from '#/lib/use-options'
import { formatDate, isOverdue, plainExcerpt } from '#/lib/format'
import { useUserNames } from '#/lib/use-users'
import { pickUsers } from '#/lib/dootask'
import { messageError } from '#/lib/message'
import { linkPendingTasks } from '#/components/detail/task-picker-dialog.tsx'
import type { TaskSelection } from '#/components/detail/task-picker-dialog.tsx'
import { PendingTaskLinks } from '#/components/detail/pending-task-links.tsx'
import { useActivate } from '#/components/keep-alive'
import { Button } from '#/components/ui/button.tsx'
import { Input } from '#/components/ui/input.tsx'
import { Textarea } from '#/components/ui/textarea.tsx'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select.tsx'
import { DatePicker } from '#/components/ui/date-picker.tsx'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '#/components/ui/dialog.tsx'
import { Field } from '#/components/ui/form-field.tsx'
import { Card, CardContent } from '#/components/ui/card.tsx'
import {
  CustomerStatusBadge,
  ToneBadge,
  ToneDot,
} from '#/components/ui/badge.tsx'
import type { Tone } from '#/components/ui/badge.tsx'
import { PageHeader, Loading, EmptyState } from '#/components/ui/misc'
import { Pager, DEFAULT_PAGE_SIZE } from '#/components/ui/pager.tsx'
import { ViewToggle } from '#/components/ui/view-toggle.tsx'
import type { ListView } from '#/components/ui/view-toggle.tsx'
import { usePersistentState } from '#/lib/use-persistent'

function splitTags(tags: string | null): Array<string> {
  if (!tags) return []
  return tags
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
}

export function CustomersView({ active }: { active: boolean }) {
  const [list, setList] = useState<Array<Customer>>([])
  const [total, setTotal] = useState(0)
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [status, setStatus] = useState<string>('all')
  const [page, setPage] = usePersistentState('crm.customers.page', 1)
  const [pageSize, setPageSize] = usePersistentState(
    'crm.customers.pageSize',
    DEFAULT_PAGE_SIZE,
  )
  const [view, setView] = usePersistentState<ListView>(
    'crm.customers.view',
    'simple',
  )
  const [createOpen, setCreateOpen] = useState(false)
  const statusOptions = useCustomerStatusOptions()

  // 最新查询条件 ref，供 reloadList / 保活刷新读取，避免闭包过期。
  const debouncedRef = useRef(debounced)
  debouncedRef.current = debounced
  const statusRef = useRef(status)
  statusRef.current = status
  const pageRef = useRef(page)
  pageRef.current = page
  const pageSizeRef = useRef(pageSize)
  pageSizeRef.current = pageSize

  async function reloadList() {
    setError(null)
    try {
      const params = new URLSearchParams()
      if (debouncedRef.current) params.set('search', debouncedRef.current)
      if (statusRef.current !== 'all') params.set('status', statusRef.current)
      params.set('page', String(pageRef.current))
      params.set('pageSize', String(pageSizeRef.current))
      // 始终带回最近一条跟进，「详细」视图直接渲染，切换无需重新请求。
      params.set('detail', '1')
      // 带回按状态分组的数量，供筛选下拉显示。
      params.set('counts', '1')
      const res = await api<{
        items: Array<Customer>
        total: number
        statusCounts?: Record<string, number>
      }>(`/customers?${params.toString()}`)
      setList(res.items)
      setTotal(res.total)
      setStatusCounts(res.statusCounts ?? {})
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }

  // 搜索输入防抖 250ms。
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 250)
    return () => clearTimeout(t)
  }, [search])

  // 查询条件或页码变化时加载（含首次挂载）。
  useEffect(() => {
    reloadList()
  }, [debounced, status, page, pageSize])

  // 切回本视图时后台刷新当前页。
  useActivate(active, reloadList)

  // 筛选 / 每页条数变化回到第 1 页（在事件里重置，避免与查询 effect 级联）。
  function changeSearch(v: string) {
    setSearch(v)
    setPage(1)
  }
  function changeStatus(v: string) {
    setStatus(v)
    setPage(1)
  }
  function changePageSize(n: number) {
    setPageSize(n)
    setPage(1)
  }

  const nameOf = useUserNames(list.map((c) => c.owner_id))

  return (
    <div>
      <PageHeader
        title="客户"
        action={
          <CreateCustomerDialog
            open={createOpen}
            onOpenChange={setCreateOpen}
            onCreated={() => {
              setCreateOpen(false)
              reloadList()
            }}
          />
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Input
          value={search}
          onChange={(e) => changeSearch(e.target.value)}
          placeholder="搜索客户名称 / 公司…"
          className="w-full sm:max-w-xs"
        />
        <Select value={status} onValueChange={changeStatus}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="状态" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">
              全部状态 ({Object.values(statusCounts).reduce((a, b) => a + b, 0)}
              )
            </SelectItem>
            {statusOptions.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                <ToneDot tone={o.tone as Tone} />
                {o.label} ({statusCounts[o.value] ?? 0})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <ViewToggle value={view} onChange={setView} />
      </div>

      {error && (
        <div className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading ? (
        <Card className="py-0">
          <CardContent className="p-0">
            <Loading center />
          </CardContent>
        </Card>
      ) : list.length === 0 ? (
        <EmptyState title="暂无客户" hint="点击右上角「新建客户」开始录入" />
      ) : (
        <>
          <Card className="py-0">
            <CardContent className="p-0">
              <ul className="divide-y">
                {list.map((c) => {
                  const overdue = isOverdue(c.next_follow_at)
                  const tags = splitTags(c.tags)
                  return (
                    <li key={c.id}>
                      <Link
                        to="/customers/$id"
                        params={{ id: String(c.id) }}
                        className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 transition hover:bg-accent/50"
                      >
                        <span className="min-w-32 flex-1 text-[15px] font-medium">
                          {c.name}
                        </span>
                        {c.company && (
                          <span className="text-sm text-muted-foreground">
                            {c.company}
                          </span>
                        )}
                        <CustomerStatusBadge status={c.status} />
                        <span className="text-xs text-muted-foreground">
                          负责人：{nameOf(c.owner_id)}
                        </span>
                        <span
                          className={
                            overdue
                              ? 'text-xs font-medium text-red-600 dark:text-red-400'
                              : 'text-xs text-muted-foreground'
                          }
                        >
                          下次跟进：{formatDate(c.next_follow_at)}
                        </span>
                        {tags.length > 0 && (
                          <span className="flex flex-wrap gap-1">
                            {tags.map((t) => (
                              <ToneBadge key={t} tone="violet">
                                {t}
                              </ToneBadge>
                            ))}
                          </span>
                        )}
                        {view === 'detailed' && (
                          <span className="w-full truncate text-xs text-muted-foreground">
                            {c.last_follow_content
                              ? `最近跟进：${plainExcerpt(c.last_follow_content)}（${formatDate(c.last_follow_at ?? null)}）`
                              : '最近跟进：暂无'}
                          </span>
                        )}
                      </Link>
                    </li>
                  )
                })}
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

function CreateCustomerDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onCreated: () => void
}) {
  const statusOptions = useCustomerStatusOptions()
  const defaultStatus = statusOptions[0]?.value ?? 'lead'
  const [name, setName] = useState('')
  const [company, setCompany] = useState('')
  const [status, setStatus] = useState<CustomerStatus>(defaultStatus)
  const [source, setSource] = useState('')
  const [tags, setTags] = useState('')
  const [note, setNote] = useState('')
  const [ownerId, setOwnerId] = useState<number | null>(null)
  const [nextFollowAt, setNextFollowAt] = useState<string | undefined>(
    undefined,
  )
  const [pendingTasks, setPendingTasks] = useState<Array<TaskSelection>>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const nameOf = useUserNames(ownerId != null ? [ownerId] : [])

  useEffect(() => {
    if (!open) return
    setName('')
    setCompany('')
    setStatus(defaultStatus)
    setSource('')
    setTags('')
    setNote('')
    setOwnerId(null)
    setNextFollowAt(undefined)
    setPendingTasks([])
    setError(null)
    setSubmitting(false)
    // 仅在对话框开关时重置；defaultStatus 取打开当下的值，不随其变化重跑。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  async function pickOwner() {
    const res = await pickUsers({ multiple: false })
    if (res.status === 'picked') {
      setOwnerId(res.ids[0])
    } else if (res.status === 'standalone') {
      // 独立模式降级为内联数字输入：用 0 触发输入态。
      setOwnerId(0)
    }
    // cancelled：不处理
  }

  async function submit() {
    if (!name.trim()) {
      setError('请填写客户名')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const customer = await api<Customer>('/customers', {
        method: 'POST',
        json: {
          name: name.trim(),
          company: company.trim() || null,
          status,
          source: source.trim() || null,
          tags: tags.trim() || null,
          note: note.trim() || null,
          // 默认不选 = 不传 owner_id（后端回退当前用户）。
          owner_id: ownerId && ownerId > 0 ? ownerId : undefined,
          next_follow_at: nextFollowAt || undefined,
        },
      })
      // 客户已建好，逐条补关联任务；个别失败不回滚客户，仅提示。
      const failed = await linkPendingTasks(
        'customer',
        customer.id,
        pendingTasks,
      )
      if (failed.length)
        messageError(
          `客户已创建，但 ${failed.length} 个任务关联失败：${failed[0]}`,
        )
      onCreated()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '创建失败')
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" />
          新建客户
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>新建客户</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Field label="客户名 *">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </Field>
          <Field label="公司">
            <Input
              value={company}
              onChange={(e) => setCompany(e.target.value)}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="状态">
              <Select value={status} onValueChange={(v) => setStatus(v)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      <ToneDot tone={o.tone as Tone} />
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="来源">
              <Input
                value={source}
                onChange={(e) => setSource(e.target.value)}
              />
            </Field>
          </div>
          <Field label="标签（逗号分隔）">
            <Input value={tags} onChange={(e) => setTags(e.target.value)} />
          </Field>
          <Field label="负责人">
            {ownerId === 0 ? (
              <Input
                type="number"
                placeholder="负责人用户 ID（留空=当前用户）"
                onChange={(e) => {
                  const n = Number(e.target.value)
                  setOwnerId(Number.isFinite(n) && n > 0 ? n : 0)
                }}
              />
            ) : (
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
            )}
          </Field>
          <Field label="下次跟进时间">
            <DatePicker
              value={nextFollowAt}
              onChange={setNextFollowAt}
              placeholder="下次跟进时间"
            />
          </Field>
          <Field label="备注">
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
          <Field label="关联任务（可选）">
            <PendingTaskLinks
              value={pendingTasks}
              onChange={setPendingTasks}
              defaultName={name.trim() || undefined}
            />
          </Field>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={submitting}>
            {submitting ? '提交中…' : '创建'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
