import { useEffect, useRef, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import { api, ApiError } from '#/lib/api'
import {
  CUSTOMER_STATUS,
  type Customer,
  type CustomerStatus,
} from '#/lib/types'
import { formatDate, isOverdue } from '#/lib/format'
import { useUserNames } from '#/lib/use-users'
import { pickUsers } from '#/lib/dootask'
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
import { CustomerStatusBadge, ToneBadge } from '#/components/ui/badge.tsx'
import { PageHeader, Loading, EmptyState } from '#/components/ui/misc'

const STATUS_KEYS = Object.keys(CUSTOMER_STATUS) as Array<CustomerStatus>

function splitTags(tags: string | null): Array<string> {
  if (!tags) return []
  return tags
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
}

export function CustomersView({ active }: { active: boolean }) {
  const [list, setList] = useState<Array<Customer>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<string>('all')
  const [createOpen, setCreateOpen] = useState(false)

  // 最新筛选条件 ref，供 reloadList / 防抖使用，避免闭包过期。
  const searchRef = useRef(search)
  searchRef.current = search
  const statusRef = useRef(status)
  statusRef.current = status

  async function reloadList() {
    setError(null)
    try {
      const params = new URLSearchParams()
      if (searchRef.current.trim()) params.set('search', searchRef.current.trim())
      if (statusRef.current !== 'all') params.set('status', statusRef.current)
      const qs = params.toString()
      const data = await api<Array<Customer>>(
        `/customers${qs ? `?${qs}` : ''}`,
      )
      setList(data)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }

  // 首次挂载加载一次。
  useEffect(() => {
    reloadList()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 搜索 / 状态变化：防抖 250ms 触发查询。
  useEffect(() => {
    const t = setTimeout(() => {
      reloadList()
    }, 250)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, status])

  // 切回本视图时后台刷新。
  useActivate(active, reloadList)

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
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索客户名称 / 公司…"
          className="w-full sm:max-w-xs"
        />
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="状态" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部状态</SelectItem>
            {STATUS_KEYS.map((k) => (
              <SelectItem key={k} value={k}>
                {CUSTOMER_STATUS[k]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {error && (
        <div className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading ? (
        <Loading />
      ) : list.length === 0 ? (
        <EmptyState
          title="暂无客户"
          hint="点击右上角「新建客户」开始录入"
        />
      ) : (
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
                      <span className="min-w-32 flex-1 font-medium">
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
                    </Link>
                  </li>
                )
              })}
            </ul>
          </CardContent>
        </Card>
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
  const [name, setName] = useState('')
  const [company, setCompany] = useState('')
  const [status, setStatus] = useState<CustomerStatus>('lead')
  const [source, setSource] = useState('')
  const [tags, setTags] = useState('')
  const [note, setNote] = useState('')
  const [ownerId, setOwnerId] = useState<number | null>(null)
  const [nextFollowAt, setNextFollowAt] = useState<string | undefined>(undefined)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const nameOf = useUserNames(ownerId != null ? [ownerId] : [])

  useEffect(() => {
    if (!open) return
    setName('')
    setCompany('')
    setStatus('lead')
    setSource('')
    setTags('')
    setNote('')
    setOwnerId(null)
    setNextFollowAt(undefined)
    setError(null)
    setSubmitting(false)
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
      await api<Customer>('/customers', {
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
              <Select
                value={status}
                onValueChange={(v) => setStatus(v as CustomerStatus)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_KEYS.map((k) => (
                    <SelectItem key={k} value={k}>
                      {CUSTOMER_STATUS[k]}
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
