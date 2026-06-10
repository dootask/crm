import { useEffect, useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { Plus, Search, UserCircle2 } from 'lucide-react'
import { api, ApiError } from '#/lib/api'
import {
  CUSTOMER_STATUS,
  type Customer,
  type CustomerStatus,
} from '#/lib/types'
import { formatDate, isOverdue } from '#/lib/format'
import { useUserNames } from '#/lib/use-users'
import { pickUsers } from '#/lib/dootask'
import { Button } from '#/components/ui/button'
import { Input, Textarea, Select, FormRow } from '#/components/ui/field'
import { Card } from '#/components/ui/card'
import { Badge, CustomerStatusBadge } from '#/components/ui/badge'
import { Modal } from '#/components/ui/modal'
import { PageHeader, Loading, EmptyState } from '#/components/ui/misc'

export const Route = createFileRoute('/customers/')({
  component: CustomersPage,
})

function splitTags(tags: string | null): Array<string> {
  if (!tags) return []
  return tags
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
}

function CustomersPage() {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<'' | CustomerStatus>('')
  const [list, setList] = useState<Array<Customer> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)

  const nameOf = useUserNames((list ?? []).map((c) => c.owner_id))

  async function load() {
    setError(null)
    try {
      const params = new URLSearchParams()
      if (search.trim()) params.set('search', search.trim())
      if (status) params.set('status', status)
      const qs = params.toString()
      const data = await api<Array<Customer>>(
        `/customers${qs ? `?${qs}` : ''}`,
      )
      setList(data)
    } catch (e) {
      setList([])
      setError(e instanceof ApiError ? e.message : '加载失败')
    }
  }

  // 搜索词输入（防抖）与状态筛选变化时重新加载。
  useEffect(() => {
    const t = setTimeout(load, 250)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, status])

  return (
    <div>
      <PageHeader
        title="客户"
        action={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            新建客户
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <Input
            className="pl-8"
            placeholder="搜索客户名 / 公司"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && load()}
          />
        </div>
        <Select
          className="w-36"
          value={status}
          onChange={(e) => setStatus(e.target.value as '' | CustomerStatus)}
        >
          <option value="">全部状态</option>
          {(Object.keys(CUSTOMER_STATUS) as Array<CustomerStatus>).map((k) => (
            <option key={k} value={k}>
              {CUSTOMER_STATUS[k]}
            </option>
          ))}
        </Select>
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
          title="暂无客户"
          hint="点击右上角「新建客户」创建第一个客户"
          action={
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" />
              新建客户
            </Button>
          }
        />
      ) : (
        <Card className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {list.map((c) => {
            const overdue = isOverdue(c.next_follow_at)
            return (
              <Link
                key={c.id}
                to="/customers/$id"
                params={{ id: String(c.id) }}
                className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-3 transition hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
              >
                <div className="min-w-40 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{c.name}</span>
                    <CustomerStatusBadge status={c.status} />
                  </div>
                  {c.company && (
                    <div className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                      {c.company}
                    </div>
                  )}
                  {splitTags(c.tags).length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {splitTags(c.tags).map((t) => (
                        <Badge key={t} tone="violet">
                          {t}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400">
                  <UserCircle2 className="h-3.5 w-3.5" />
                  {nameOf(c.owner_id)}
                </div>
                <div
                  className={
                    'w-28 text-right text-xs ' +
                    (overdue
                      ? 'font-medium text-red-600 dark:text-red-400'
                      : 'text-zinc-500 dark:text-zinc-400')
                  }
                  title="下次跟进时间"
                >
                  {formatDate(c.next_follow_at)}
                </div>
              </Link>
            )
          })}
        </Card>
      )}

      <CreateCustomerModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => {
          setCreateOpen(false)
          load()
        }}
      />
    </div>
  )
}

function CreateCustomerModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  onCreated: () => void
}) {
  const [name, setName] = useState('')
  const [company, setCompany] = useState('')
  const [status, setStatus] = useState<CustomerStatus>('lead')
  const [source, setSource] = useState('')
  const [tags, setTags] = useState('')
  const [note, setNote] = useState('')
  const [ownerId, setOwnerId] = useState<number | null>(null)
  const [nextFollowAt, setNextFollowAt] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const nameOf = useUserNames(ownerId != null ? [ownerId] : [])

  useEffect(() => {
    if (!open) return
    // 打开时重置表单。
    setName('')
    setCompany('')
    setStatus('lead')
    setSource('')
    setTags('')
    setNote('')
    setOwnerId(null)
    setNextFollowAt('')
    setError(null)
    setSubmitting(false)
  }, [open])

  async function pickOwner() {
    const res = await pickUsers({ multiple: false })
    if (res === null) {
      // 独立模式：降级为手动输入用户 ID。
      const input = window.prompt('独立模式：请输入负责人用户 ID（留空取消）')
      if (input == null || input.trim() === '') return
      const n = Number(input.trim())
      if (Number.isFinite(n) && n > 0) setOwnerId(n)
      return
    }
    if (res.length > 0) setOwnerId(res[0])
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
          company: company.trim() || undefined,
          status,
          source: source.trim() || undefined,
          tags: tags.trim() || undefined,
          note: note.trim() || undefined,
          owner_id: ownerId ?? undefined,
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
    <Modal open={open} onClose={onClose} title="新建客户">
      <div className="space-y-3">
        <FormRow label="客户名 *">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="必填"
            autoFocus
          />
        </FormRow>
        <FormRow label="公司">
          <Input value={company} onChange={(e) => setCompany(e.target.value)} />
        </FormRow>
        <div className="grid grid-cols-2 gap-3">
          <FormRow label="状态">
            <Select
              value={status}
              onChange={(e) => setStatus(e.target.value as CustomerStatus)}
            >
              {(Object.keys(CUSTOMER_STATUS) as Array<CustomerStatus>).map(
                (k) => (
                  <option key={k} value={k}>
                    {CUSTOMER_STATUS[k]}
                  </option>
                ),
              )}
            </Select>
          </FormRow>
          <FormRow label="来源">
            <Input value={source} onChange={(e) => setSource(e.target.value)} />
          </FormRow>
        </div>
        <FormRow label="标签（逗号分隔）">
          <Input
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="如：重点,华东"
          />
        </FormRow>
        <FormRow label="下次跟进时间">
          <Input
            type="date"
            value={nextFollowAt}
            onChange={(e) => setNextFollowAt(e.target.value)}
          />
        </FormRow>
        <FormRow label="负责人">
          <div className="flex items-center gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={pickOwner}>
              选择负责人
            </Button>
            <span className="text-sm text-zinc-500 dark:text-zinc-400">
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
        </FormRow>
        <FormRow label="备注">
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} />
        </FormRow>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            取消
          </Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting ? '提交中…' : '创建'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
