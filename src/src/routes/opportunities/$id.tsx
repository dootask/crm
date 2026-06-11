import { useEffect, useMemo, useRef, useState } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { api, ApiError } from '#/lib/api'
import {
  OPPORTUNITY_STAGE,
  type Customer,
  type FollowUp,
  type Opportunity,
  type OpportunityStage,
  type TaskLink,
} from '#/lib/types'
import { formatMoney, isOverdue } from '#/lib/format'
import { useUserNames } from '#/lib/use-users'
import { Loading } from '#/components/ui/misc'
import { Button } from '#/components/ui/button.tsx'
import { Input } from '#/components/ui/input.tsx'
import { Textarea } from '#/components/ui/textarea.tsx'
import { Field } from '#/components/ui/form-field.tsx'
import { DatePicker } from '#/components/ui/date-picker.tsx'
import { OppStatusBadge } from '#/components/ui/badge.tsx'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '#/components/ui/card.tsx'
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
} from '#/components/ui/dialog.tsx'
import { BreadcrumbBar } from '#/components/detail/breadcrumb-bar.tsx'
import { OwnerInlineEdit } from '#/components/detail/owner-field.tsx'
import { InlineDateEdit } from '#/components/detail/inline-date-field.tsx'
import { messageError, messageSuccess, messageWarning } from '#/lib/message'
import {
  FollowUpsSection,
  type FollowUpsHandle,
} from '#/components/detail/follow-ups-section.tsx'
import { TaskLinksSection } from '#/components/detail/task-links-section.tsx'

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
  const followRef = useRef<FollowUpsHandle>(null)

  async function reload() {
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
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const ownerIds = useMemo(() => {
    if (!data) return []
    return [data.opportunity.owner_id, ...data.follow_ups.map((f) => f.follow_by)]
  }, [data])
  const nameOf = useUserNames(ownerIds)

  if (loadError) {
    return <p className="text-sm text-destructive">{loadError}</p>
  }
  if (!data) {
    return <Loading />
  }

  const { opportunity, customer } = data

  async function patch(json: Record<string, unknown>) {
    await api<Opportunity>(`/opportunities/${id}`, { method: 'PATCH', json })
    await reload()
  }

  // 快速修改：成功/失败都用统一消息提示，返回是否成功供调用方决定后续（如关闭弹窗）。
  async function quickPatch(
    json: Record<string, unknown>,
    okMsg: string,
  ): Promise<boolean> {
    try {
      await patch(json)
      messageSuccess(okMsg)
      return true
    } catch (e) {
      messageError(e instanceof ApiError ? e.message : '操作失败')
      return false
    }
  }

  async function remove() {
    if (!window.confirm(`确定删除商机「${opportunity.title}」？此操作不可撤销。`))
      return
    try {
      await api(`/opportunities/${id}`, { method: 'DELETE' })
      messageSuccess('商机已删除')
      navigate({ to: '/opportunities' })
    } catch (e) {
      messageError(e instanceof ApiError ? e.message : '删除失败')
    }
  }

  return (
    <div className="space-y-5">
      <BreadcrumbBar
        items={[
          { label: '商机', to: '/opportunities' },
          {
            label: customer.name,
            to: '/customers/$id',
            params: { id: String(customer.id) },
          },
          { label: opportunity.title },
        ]}
      />

      {/* 头部行 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold tracking-tight">
            {opportunity.title}
          </h1>
          <OppStatusBadge status={opportunity.status} />
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => followRef.current?.focusAdd()}
          >
            <Plus className="size-4" />
            添加跟进
          </Button>
          <EditOpportunityDialog
            opportunity={opportunity}
            onSaved={(json) => patch(json)}
          />
          <Button variant="destructive" onClick={remove}>
            <Trash2 className="size-4" />
            删除
          </Button>
        </div>
      </div>

      {/* 商机信息 */}
      <InfoCard
        opportunity={opportunity}
        customer={customer}
        nameOf={nameOf}
        onPatch={quickPatch}
      />

      {/* 赢单 / 输单 */}
      <StatusCard opportunity={opportunity} onPatch={quickPatch} />

      {/* 关联任务 */}
      <TaskLinksSection
        entityType="opportunity"
        entityId={Number(id)}
        taskLinks={data.task_links}
        onChanged={reload}
      />

      {/* 跟进记录（最底部） */}
      <FollowUpsSection
        ref={followRef}
        customerId={customer.id}
        opportunityId={Number(id)}
        followUps={data.follow_ups}
        nameOf={nameOf}
        onChanged={reload}
      />
    </div>
  )
}

/* ---------- 商机信息 ---------- */

function InfoRow({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="grid gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="text-sm">{children}</div>
    </div>
  )
}

function InfoCard({
  opportunity,
  customer,
  nameOf,
  onPatch,
}: {
  opportunity: Opportunity
  customer: Customer
  nameOf: (id: number) => string
  onPatch: (json: Record<string, unknown>, okMsg: string) => Promise<boolean>
}) {
  const [stageBusy, setStageBusy] = useState(false)

  async function changeStage(stage: OpportunityStage) {
    setStageBusy(true)
    try {
      await onPatch({ stage }, '阶段已更新')
    } finally {
      setStageBusy(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>商机信息</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
          <InfoRow label="所属客户">
            <Link
              to="/customers/$id"
              params={{ id: String(customer.id) }}
              className="text-primary hover:underline"
            >
              {customer.name}
            </Link>
          </InfoRow>
          <InfoRow label="阶段">
            <Select
              value={opportunity.stage}
              disabled={stageBusy}
              onValueChange={(v) => changeStage(v as OpportunityStage)}
            >
              <SelectTrigger size="sm" className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(OPPORTUNITY_STAGE) as Array<OpportunityStage>).map(
                  (k) => (
                    <SelectItem key={k} value={k}>
                      {OPPORTUNITY_STAGE[k]}
                    </SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>
          </InfoRow>
          <InfoRow label="负责人">
            <OwnerInlineEdit
              ownerId={opportunity.owner_id}
              nameOf={nameOf}
              onChange={async (oid) => {
                await onPatch({ owner_id: oid }, '负责人已更新')
              }}
            />
          </InfoRow>
          <InfoRow label="金额">{formatMoney(opportunity.amount)}</InfoRow>
          <InfoRow label="预计成交时间">
            <InlineDateEdit
              label="预计成交时间"
              value={opportunity.expected_close_at}
              onChange={async (next) => {
                await onPatch({ expected_close_at: next }, '预计成交时间已更新')
              }}
            />
          </InfoRow>
          <InfoRow label="下次跟进时间">
            <InlineDateEdit
              label="下次跟进时间"
              value={opportunity.next_follow_at}
              overdue={isOverdue(opportunity.next_follow_at)}
              onChange={async (next) => {
                await onPatch({ next_follow_at: next }, '下次跟进时间已更新')
              }}
            />
          </InfoRow>
        </div>
      </CardContent>
    </Card>
  )
}

function EditOpportunityDialog({
  opportunity,
  onSaved,
}: {
  opportunity: Opportunity
  onSaved: (json: Record<string, unknown>) => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState(opportunity.title)
  const [amount, setAmount] = useState(
    opportunity.amount != null ? String(opportunity.amount) : '',
  )
  const [expectedCloseAt, setExpectedCloseAt] = useState<string | undefined>(
    opportunity.expected_close_at ?? undefined,
  )
  const [nextFollowAt, setNextFollowAt] = useState<string | undefined>(
    opportunity.next_follow_at ?? undefined,
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setTitle(opportunity.title)
    setAmount(opportunity.amount != null ? String(opportunity.amount) : '')
    setExpectedCloseAt(opportunity.expected_close_at ?? undefined)
    setNextFollowAt(opportunity.next_follow_at ?? undefined)
    setError(null)
    setBusy(false)
  }, [open, opportunity])

  async function submit() {
    if (!title.trim()) {
      setError('请填写标题')
      return
    }
    const amountNum = amount.trim() === '' ? null : Number(amount)
    if (amountNum !== null && !Number.isFinite(amountNum)) {
      setError('金额必须是数字')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await onSaved({
        title: title.trim(),
        amount: amountNum,
        expected_close_at: expectedCloseAt ?? null,
        next_follow_at: nextFollowAt ?? null,
      })
      setOpen(false)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '保存失败')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Pencil className="size-4" />
        编辑
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>编辑商机</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Field label="标题">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <Field label="金额">
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
            />
          </Field>
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
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={busy}>
            {busy ? '保存中…' : '保存'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ---------- 赢单 / 输单 ---------- */

function StatusCard({
  opportunity,
  onPatch,
}: {
  opportunity: Opportunity
  onPatch: (json: Record<string, unknown>, okMsg: string) => Promise<boolean>
}) {
  const [busy, setBusy] = useState(false)
  const [lostOpen, setLostOpen] = useState(false)
  const [lostReason, setLostReason] = useState('')

  async function run(json: Record<string, unknown>, okMsg: string) {
    setBusy(true)
    try {
      await onPatch(json, okMsg)
    } finally {
      setBusy(false)
    }
  }

  async function submitLost() {
    if (!lostReason.trim()) {
      messageWarning('请填写输单原因')
      return
    }
    setBusy(true)
    try {
      const ok = await onPatch(
        { status: 'lost', lost_reason: lostReason.trim() },
        '已标记输单',
      )
      if (ok) {
        setLostOpen(false)
        setLostReason('')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>赢单 / 输单</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <OppStatusBadge status={opportunity.status} />

        {opportunity.status === 'open' ? (
          <div className="flex gap-2">
            <Button
              disabled={busy}
              onClick={() => run({ status: 'won' }, '已标记赢单')}
              className="bg-green-600 text-white hover:bg-green-700"
            >
              标记赢单
            </Button>
            <Button
              variant="destructive"
              disabled={busy}
              onClick={() => {
                setLostReason('')
                setLostOpen(true)
              }}
            >
              标记输单
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {opportunity.status === 'won'
                ? '该商机已赢单。'
                : '该商机已输单。'}
            </p>
            {opportunity.status === 'lost' && (
              <div className="rounded-md border px-3 py-2 text-sm">
                <span className="text-muted-foreground">输单原因：</span>
                {opportunity.lost_reason || '—'}
              </div>
            )}
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => run({ status: 'open', lost_reason: null }, '已重新打开')}
            >
              重新打开
            </Button>
          </div>
        )}
      </CardContent>

      <Dialog open={lostOpen} onOpenChange={setLostOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>标记输单</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Field label="输单原因">
              <Textarea
                value={lostReason}
                onChange={(e) => setLostReason(e.target.value)}
                placeholder="请填写输单原因"
              />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="destructive" onClick={submitLost} disabled={busy}>
              {busy ? '提交中…' : '确认输单'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
