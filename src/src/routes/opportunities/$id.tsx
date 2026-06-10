import { useEffect, useMemo, useState } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { ExternalLink, Pencil, Plus, Trash2, Unlink } from 'lucide-react'
import { api, ApiError } from '#/lib/api'
import type {
  Customer,
  FollowUp,
  Opportunity,
  OpportunityStage,
  TaskLink,
} from '#/lib/types'
import { OPPORTUNITY_STAGE } from '#/lib/types'
import { PageHeader, Loading } from '#/components/ui/misc'
import { Card, CardHeader, CardBody } from '#/components/ui/card'
import { Button } from '#/components/ui/button'
import { Input, Textarea, Select, FormRow } from '#/components/ui/field'
import { OppStatusBadge } from '#/components/ui/badge'
import { Modal } from '#/components/ui/modal'
import { formatDate, formatDateTime, formatMoney, isOverdue } from '#/lib/format'
import { useUserNames } from '#/lib/use-users'
import { pickUsers, openDooTaskTask } from '#/lib/dootask'

export const Route = createFileRoute('/opportunities/$id')({
  component: OpportunityDetailPage,
})

interface DetailData {
  opportunity: Opportunity
  customer: Customer
  follow_ups: Array<FollowUp>
  task_links: Array<TaskLink>
}

function OpportunityDetailPage() {
  const { id } = Route.useParams()
  const navigate = useNavigate()
  const [data, setData] = useState<DetailData | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  async function refresh() {
    setLoadError(null)
    try {
      const d = await api<DetailData>(`/opportunities/${id}`)
      setData(d)
    } catch (e) {
      setLoadError(e instanceof ApiError ? e.message : '加载失败')
    }
  }

  useEffect(() => {
    setData(null)
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  if (loadError) {
    return (
      <div className="p-6">
        <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">
          {loadError}
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="p-6">
        <Loading />
      </div>
    )
  }

  const { opportunity: opp } = data

  return (
    <div className="p-6">
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            {opp.title} <OppStatusBadge status={opp.status} />
          </span>
        }
        action={
          <Link
            to="/opportunities"
            className="text-sm text-zinc-500 hover:underline dark:text-zinc-400"
          >
            返回列表
          </Link>
        }
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <InfoCard
            id={id}
            data={data}
            refresh={refresh}
            onDeleted={() => navigate({ to: '/opportunities' })}
          />
          <FollowUpsCard id={id} data={data} refresh={refresh} />
        </div>
        <div className="space-y-5">
          <StatusCard id={id} data={data} refresh={refresh} />
          <TaskLinksCard id={id} data={data} refresh={refresh} />
        </div>
      </div>
    </div>
  )
}

/* ---------- 商机信息 ---------- */

function InfoCard({
  id,
  data,
  refresh,
  onDeleted,
}: {
  id: string
  data: DetailData
  refresh: () => void
  onDeleted: () => void
}) {
  const { opportunity: opp, customer } = data
  const nameOf = useUserNames([opp.owner_id])
  const [showEdit, setShowEdit] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function changeStage(stage: OpportunityStage) {
    setError(null)
    try {
      await api<Opportunity>(`/opportunities/${id}`, {
        method: 'PATCH',
        json: { stage },
      })
      refresh()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '更新失败')
    }
  }

  async function changeOwner() {
    const ids = await pickUsers({ value: [opp.owner_id], multiple: false })
    if (ids === null) {
      const input = window.prompt('输入负责人用户 ID', String(opp.owner_id))
      if (!input) return
      const n = Number(input)
      if (!Number.isFinite(n)) return
      await patchOwner(n)
      return
    }
    if (ids.length > 0) await patchOwner(ids[0])
  }

  async function patchOwner(ownerId: number) {
    setError(null)
    try {
      await api<Opportunity>(`/opportunities/${id}`, {
        method: 'PATCH',
        json: { owner_id: ownerId },
      })
      refresh()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '更新失败')
    }
  }

  async function doDelete() {
    setBusy(true)
    setError(null)
    try {
      await api(`/opportunities/${id}`, { method: 'DELETE' })
      onDeleted()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '删除失败')
      setBusy(false)
    }
  }

  return (
    <Card>
      <CardHeader
        title="商机信息"
        action={
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => setShowEdit(true)}>
              <Pencil className="h-3.5 w-3.5" /> 编辑
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 className="h-3.5 w-3.5" /> 删除商机
            </Button>
          </div>
        }
      />
      <CardBody className="space-y-3">
        {error && (
          <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">
            {error}
          </div>
        )}
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <Field label="标题">{opp.title}</Field>
          <Field label="所属客户">
            <Link
              to="/customers/$id"
              params={{ id: String(customer.id) }}
              className="text-blue-600 hover:underline dark:text-blue-400"
            >
              {customer.name}
            </Link>
          </Field>
          <Field label="阶段">
            <Select
              className="h-8 py-1"
              value={opp.stage}
              onChange={(e) => changeStage(e.target.value as OpportunityStage)}
            >
              {(Object.keys(OPPORTUNITY_STAGE) as Array<OpportunityStage>).map(
                (k) => (
                  <option key={k} value={k}>
                    {OPPORTUNITY_STAGE[k]}
                  </option>
                ),
              )}
            </Select>
          </Field>
          <Field label="负责人">
            <span className="flex items-center gap-2">
              {nameOf(opp.owner_id)}
              <Button variant="ghost" size="sm" onClick={changeOwner}>
                修改
              </Button>
            </span>
          </Field>
          <Field label="金额">{formatMoney(opp.amount)}</Field>
          <Field label="预计成交时间">{formatDate(opp.expected_close_at)}</Field>
          <Field label="下次跟进时间">
            <span
              className={
                isOverdue(opp.next_follow_at)
                  ? 'font-medium text-red-600 dark:text-red-400'
                  : ''
              }
            >
              {formatDate(opp.next_follow_at)}
            </span>
          </Field>
          <Field label="创建时间">{formatDateTime(opp.created_at)}</Field>
        </dl>
      </CardBody>

      <EditOpportunityModal
        open={showEdit}
        onClose={() => setShowEdit(false)}
        opp={opp}
        id={id}
        onSaved={() => {
          setShowEdit(false)
          refresh()
        }}
      />

      <Modal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="删除商机"
      >
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          确定删除商机「{opp.title}」吗？此操作不可撤销。
        </p>
        {error && (
          <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">
            {error}
          </div>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <Button
            variant="secondary"
            onClick={() => setConfirmDelete(false)}
            disabled={busy}
          >
            取消
          </Button>
          <Button variant="danger" onClick={doDelete} disabled={busy}>
            {busy ? '删除中…' : '确认删除'}
          </Button>
        </div>
      </Modal>
    </Card>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div>
      <dt className="mb-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
        {label}
      </dt>
      <dd className="text-zinc-800 dark:text-zinc-100">{children}</dd>
    </div>
  )
}

function EditOpportunityModal({
  open,
  onClose,
  opp,
  id,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  opp: Opportunity
  id: string
  onSaved: () => void
}) {
  const [title, setTitle] = useState(opp.title)
  const [amount, setAmount] = useState(opp.amount != null ? String(opp.amount) : '')
  const [expectedCloseAt, setExpectedCloseAt] = useState(
    opp.expected_close_at ? opp.expected_close_at.slice(0, 10) : '',
  )
  const [nextFollowAt, setNextFollowAt] = useState(
    opp.next_follow_at ? opp.next_follow_at.slice(0, 10) : '',
  )
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setTitle(opp.title)
      setAmount(opp.amount != null ? String(opp.amount) : '')
      setExpectedCloseAt(
        opp.expected_close_at ? opp.expected_close_at.slice(0, 10) : '',
      )
      setNextFollowAt(opp.next_follow_at ? opp.next_follow_at.slice(0, 10) : '')
      setError(null)
    }
  }, [open, opp])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) {
      setError('请填写标题')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await api<Opportunity>(`/opportunities/${id}`, {
        method: 'PATCH',
        json: {
          title: title.trim(),
          amount: amount.trim() ? Number(amount) : null,
          expected_close_at: expectedCloseAt || null,
          next_follow_at: nextFollowAt || null,
        },
      })
      onSaved()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '保存失败')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="编辑商机">
      <form onSubmit={submit} className="space-y-3">
        <FormRow label="标题 *">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </FormRow>
        <FormRow label="金额">
          <Input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
          />
        </FormRow>
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
            {submitting ? '保存中…' : '保存'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

/* ---------- 赢单/输单 ---------- */

function StatusCard({
  id,
  data,
  refresh,
}: {
  id: string
  data: DetailData
  refresh: () => void
}) {
  const { opportunity: opp } = data
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showLost, setShowLost] = useState(false)
  const [lostReason, setLostReason] = useState('')

  async function patch(json: Record<string, unknown>) {
    setBusy(true)
    setError(null)
    try {
      await api<Opportunity>(`/opportunities/${id}`, { method: 'PATCH', json })
      refresh()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '操作失败')
    } finally {
      setBusy(false)
    }
  }

  async function submitLost(e: React.FormEvent) {
    e.preventDefault()
    if (!lostReason.trim()) {
      setError('请填写输单原因')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await api<Opportunity>(`/opportunities/${id}`, {
        method: 'PATCH',
        json: { status: 'lost', lost_reason: lostReason.trim() },
      })
      setShowLost(false)
      setLostReason('')
      refresh()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '操作失败')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <CardHeader title="赢单 / 输单" action={<OppStatusBadge status={opp.status} />} />
      <CardBody className="space-y-3">
        {error && (
          <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">
            {error}
          </div>
        )}
        {opp.status === 'open' ? (
          <div className="flex gap-2">
            <Button
              onClick={() => patch({ status: 'won' })}
              disabled={busy}
              className="bg-green-600 hover:bg-green-700"
            >
              标记赢单
            </Button>
            <Button
              variant="danger"
              onClick={() => setShowLost(true)}
              disabled={busy}
            >
              标记输单
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-zinc-600 dark:text-zinc-300">
              {opp.status === 'won'
                ? '该商机已赢单。'
                : '该商机已输单。'}
            </p>
            {opp.status === 'lost' && (
              <div className="rounded-lg bg-zinc-50 px-3 py-2 text-sm dark:bg-zinc-800/60">
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  输单原因：
                </span>
                <span className="text-zinc-700 dark:text-zinc-200">
                  {opp.lost_reason || '—'}
                </span>
              </div>
            )}
            <Button
              variant="secondary"
              onClick={() => patch({ status: 'open', lost_reason: null })}
              disabled={busy}
            >
              重新打开
            </Button>
          </div>
        )}
      </CardBody>

      <Modal open={showLost} onClose={() => setShowLost(false)} title="标记输单">
        <form onSubmit={submitLost} className="space-y-3">
          <FormRow label="输单原因 *">
            <Textarea
              value={lostReason}
              onChange={(e) => setLostReason(e.target.value)}
              placeholder="请填写输单原因"
            />
          </FormRow>
          {error && (
            <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">
              {error}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowLost(false)}
            >
              取消
            </Button>
            <Button type="submit" variant="danger" disabled={busy}>
              {busy ? '提交中…' : '确认输单'}
            </Button>
          </div>
        </form>
      </Modal>
    </Card>
  )
}

/* ---------- 跟进记录 ---------- */

function FollowUpsCard({
  id,
  data,
  refresh,
}: {
  id: string
  data: DetailData
  refresh: () => void
}) {
  const { follow_ups, customer } = data
  const followerIds = useMemo(
    () => follow_ups.map((f) => f.follow_by),
    [follow_ups],
  )
  const nameOf = useUserNames(followerIds)
  const [showAdd, setShowAdd] = useState(false)
  const [content, setContent] = useState('')
  const [nextFollowAt, setNextFollowAt] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (showAdd) {
      setContent('')
      setNextFollowAt('')
      setError(null)
    }
  }, [showAdd])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!content.trim()) {
      setError('请填写跟进内容')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await api<FollowUp>('/follow-ups', {
        method: 'POST',
        json: {
          customer_id: customer.id,
          opportunity_id: Number(id),
          content: content.trim(),
          ...(nextFollowAt ? { next_follow_at: nextFollowAt } : {}),
        },
      })
      setShowAdd(false)
      refresh()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '提交失败')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card>
      <CardHeader
        title="跟进记录"
        action={
          <Button variant="secondary" size="sm" onClick={() => setShowAdd(true)}>
            <Plus className="h-3.5 w-3.5" /> 添加跟进
          </Button>
        }
      />
      <CardBody>
        {follow_ups.length === 0 ? (
          <p className="py-4 text-center text-sm text-zinc-400">暂无跟进记录</p>
        ) : (
          <ol className="space-y-4">
            {follow_ups.map((f) => (
              <li key={f.id} className="relative pl-5">
                <span className="absolute left-0 top-1.5 h-2 w-2 rounded-full bg-blue-500" />
                <div className="flex flex-wrap items-center gap-x-2 text-xs text-zinc-500 dark:text-zinc-400">
                  <span className="font-medium text-zinc-700 dark:text-zinc-200">
                    {nameOf(f.follow_by)}
                  </span>
                  <span>{formatDateTime(f.created_at)}</span>
                  {f.next_follow_at && (
                    <span
                      className={
                        isOverdue(f.next_follow_at)
                          ? 'text-red-600 dark:text-red-400'
                          : ''
                      }
                    >
                      下次跟进：{formatDate(f.next_follow_at)}
                    </span>
                  )}
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-200">
                  {f.content}
                </p>
              </li>
            ))}
          </ol>
        )}
      </CardBody>

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="添加跟进">
        <form onSubmit={submit} className="space-y-3">
          <FormRow label="跟进内容 *">
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="本次跟进内容"
            />
          </FormRow>
          <FormRow label="下次跟进时间">
            <Input
              type="date"
              value={nextFollowAt}
              onChange={(e) => setNextFollowAt(e.target.value)}
            />
          </FormRow>
          {error && (
            <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">
              {error}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowAdd(false)}
            >
              取消
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? '提交中…' : '提交'}
            </Button>
          </div>
        </form>
      </Modal>
    </Card>
  )
}

/* ---------- 关联任务 ---------- */

function TaskLinksCard({
  id,
  data,
  refresh,
}: {
  id: string
  data: DetailData
  refresh: () => void
}) {
  const { task_links } = data
  const [showAdd, setShowAdd] = useState(false)
  const [taskId, setTaskId] = useState('')
  const [title, setTitle] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rowError, setRowError] = useState<string | null>(null)

  useEffect(() => {
    if (showAdd) {
      setTaskId('')
      setTitle('')
      setError(null)
    }
  }, [showAdd])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!taskId.trim() || !Number.isFinite(Number(taskId))) {
      setError('请填写有效的任务 ID')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await api<TaskLink>('/task-links', {
        method: 'POST',
        json: {
          entity_type: 'opportunity',
          entity_id: Number(id),
          task_id: Number(taskId),
          ...(title.trim() ? { title: title.trim() } : {}),
        },
      })
      setShowAdd(false)
      refresh()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '关联失败')
    } finally {
      setSubmitting(false)
    }
  }

  async function unlink(linkId: number) {
    setRowError(null)
    try {
      await api(`/task-links/${linkId}`, { method: 'DELETE' })
      refresh()
    } catch (err) {
      setRowError(err instanceof ApiError ? err.message : '解除失败')
    }
  }

  return (
    <Card>
      <CardHeader
        title="关联任务"
        action={
          <Button variant="secondary" size="sm" onClick={() => setShowAdd(true)}>
            <Plus className="h-3.5 w-3.5" /> 关联任务
          </Button>
        }
      />
      <CardBody>
        {rowError && (
          <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">
            {rowError}
          </div>
        )}
        {task_links.length === 0 ? (
          <p className="py-4 text-center text-sm text-zinc-400">暂无关联任务</p>
        ) : (
          <ul className="space-y-2">
            {task_links.map((t) => (
              <li
                key={t.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-zinc-100 px-3 py-2 dark:border-zinc-800"
              >
                <span className="truncate text-sm text-zinc-700 dark:text-zinc-200">
                  {t.title || `任务 #${t.task_id}`}
                </span>
                <span className="flex shrink-0 items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openDooTaskTask(t.task_id)}
                  >
                    <ExternalLink className="h-3.5 w-3.5" /> 打开任务
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => unlink(t.id)}
                  >
                    <Unlink className="h-3.5 w-3.5" /> 解除
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardBody>

      <Modal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        title="关联 DooTask 任务"
      >
        <form onSubmit={submit} className="space-y-3">
          <FormRow label="任务 ID *">
            <Input
              type="number"
              value={taskId}
              onChange={(e) => setTaskId(e.target.value)}
              placeholder="DooTask 任务 ID"
            />
          </FormRow>
          <FormRow label="标题（可选）">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="备注标题"
            />
          </FormRow>
          {error && (
            <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">
              {error}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowAdd(false)}
            >
              取消
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? '关联中…' : '关联'}
            </Button>
          </div>
        </form>
      </Modal>
    </Card>
  )
}
