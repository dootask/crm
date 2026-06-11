import { useEffect, useRef, useState } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { api, ApiError } from '#/lib/api'
import {
  CUSTOMER_STATUS,
  OPPORTUNITY_STAGE,
  type Contact,
  type Customer,
  type CustomerStatus,
  type FollowUp,
  type Opportunity,
  type OpportunityStage,
  type TaskLink,
} from '#/lib/types'
import { formatDateTime, formatMoney, isOverdue } from '#/lib/format'
import { useUserNames } from '#/lib/use-users'
import { pickUsers } from '#/lib/dootask'
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
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from '#/components/ui/card.tsx'
import { Label } from '#/components/ui/label.tsx'
import {
  CustomerStatusBadge,
  OppStatusBadge,
  StageBadge,
  ToneBadge,
} from '#/components/ui/badge.tsx'
import { Loading } from '#/components/ui/misc'
import { BreadcrumbBar } from '#/components/detail/breadcrumb-bar.tsx'
import { OwnerInlineEdit } from '#/components/detail/owner-field.tsx'
import { InlineDateEdit } from '#/components/detail/inline-date-field.tsx'
import { messageError, messageSuccess } from '#/lib/message'
import { TaskLinksSection } from '#/components/detail/task-links-section.tsx'
import {
  FollowUpsSection,
  type FollowUpsHandle,
} from '#/components/detail/follow-ups-section.tsx'

export const Route = createFileRoute('/customers/$id')({
  component: CustomerDetailPage,
})

interface Detail {
  customer: Customer
  contacts: Array<Contact>
  opportunities: Array<Opportunity>
  follow_ups: Array<FollowUp>
  task_links: Array<TaskLink>
}

const STATUS_KEYS = Object.keys(CUSTOMER_STATUS) as Array<CustomerStatus>
const STAGE_KEYS = Object.keys(OPPORTUNITY_STAGE) as Array<OpportunityStage>

function splitTags(tags: string | null): Array<string> {
  if (!tags) return []
  return tags
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
}

function CustomerDetailPage() {
  const { id } = Route.useParams()
  const navigate = useNavigate()
  const [data, setData] = useState<Detail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const followRef = useRef<FollowUpsHandle>(null)

  async function reload() {
    setError(null)
    try {
      const d = await api<Detail>(`/customers/${id}`)
      setData(d)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '加载失败')
    }
  }

  useEffect(() => {
    setData(null)
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  // 收集页面内所有 owner_id / follow_by 解析昵称。
  const ownerIds: Array<number> = []
  if (data) {
    ownerIds.push(data.customer.owner_id)
    for (const o of data.opportunities) ownerIds.push(o.owner_id)
    for (const f of data.follow_ups) ownerIds.push(f.follow_by)
  }
  const nameOf = useUserNames(ownerIds)

  if (error) {
    return (
      <div>
        <BreadcrumbBar items={[{ label: '客户', to: '/customers' }, { label: '详情' }]} />
        <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div>
        <BreadcrumbBar items={[{ label: '客户', to: '/customers' }, { label: '详情' }]} />
        <Loading />
      </div>
    )
  }

  const { customer } = data

  async function del() {
    if (!window.confirm('确定删除该客户？此操作不可撤销。')) return
    try {
      await api(`/customers/${id}`, { method: 'DELETE' })
      messageSuccess('客户已删除')
      navigate({ to: '/customers' })
    } catch (e) {
      messageError(e instanceof ApiError ? e.message : '删除失败')
    }
  }

  return (
    <div className="space-y-5">
      <BreadcrumbBar
        items={[{ label: '客户', to: '/customers' }, { label: customer.name }]}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold tracking-tight">{customer.name}</h1>
          <CustomerStatusBadge status={customer.status} />
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => followRef.current?.focusAdd()}
          >
            <Plus className="size-4" />
            添加跟进
          </Button>
          <EditCustomerDialog id={id} customer={customer} onSaved={reload} />
          <Button variant="destructive" onClick={del}>
            <Trash2 className="size-4" />
            删除
          </Button>
        </div>
      </div>

      <CustomerInfoCard id={id} customer={customer} nameOf={nameOf} onChanged={reload} />
      <ContactsCard id={id} contacts={data.contacts} onChanged={reload} />
      <OpportunitiesCard id={id} opportunities={data.opportunities} nameOf={nameOf} onChanged={reload} />
      <TaskLinksSection
        entityType="customer"
        entityId={Number(id)}
        taskLinks={data.task_links}
        onChanged={reload}
      />
      <FollowUpsSection
        ref={followRef}
        customerId={Number(id)}
        followUps={data.follow_ups}
        nameOf={nameOf}
        onChanged={reload}
      />
    </div>
  )
}

/* ---------------- 客户信息 ---------------- */

function InfoItem({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="grid gap-1">
      <Label className="text-muted-foreground">{label}</Label>
      <div className="text-sm">{children}</div>
    </div>
  )
}

function CustomerInfoCard({
  id,
  customer,
  nameOf,
  onChanged,
}: {
  id: string
  customer: Customer
  nameOf: (id: number) => string
  onChanged: () => void
}) {
  const [statusBusy, setStatusBusy] = useState(false)
  const overdue = isOverdue(customer.next_follow_at)
  const tags = splitTags(customer.tags)

  async function changeStatus(status: CustomerStatus) {
    if (status === customer.status) return
    setStatusBusy(true)
    try {
      await api<Customer>(`/customers/${id}`, {
        method: 'PATCH',
        json: { status },
      })
      onChanged()
      messageSuccess('状态已更新')
    } catch (e) {
      messageError(e instanceof ApiError ? e.message : '更新失败')
    } finally {
      setStatusBusy(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>客户信息</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <InfoItem label="公司">{customer.company || '—'}</InfoItem>
        <InfoItem label="状态">
          <Select
            value={customer.status}
            disabled={statusBusy}
            onValueChange={(v) => changeStatus(v as CustomerStatus)}
          >
            <SelectTrigger size="sm" className="w-28">
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
        </InfoItem>
        <InfoItem label="来源">{customer.source || '—'}</InfoItem>
        <InfoItem label="负责人">
          <OwnerInlineEdit
            ownerId={customer.owner_id}
            nameOf={nameOf}
            onChange={async (oid) => {
              try {
                await api<Customer>(`/customers/${id}`, {
                  method: 'PATCH',
                  json: { owner_id: oid },
                })
                onChanged()
                messageSuccess('负责人已更新')
              } catch (e) {
                messageError(e instanceof ApiError ? e.message : '更新失败')
              }
            }}
          />
        </InfoItem>
        <InfoItem label="下次跟进时间">
          <InlineDateEdit
            label="下次跟进时间"
            value={customer.next_follow_at}
            overdue={overdue}
            onChange={async (next) => {
              try {
                await api<Customer>(`/customers/${id}`, {
                  method: 'PATCH',
                  json: { next_follow_at: next },
                })
                onChanged()
                messageSuccess('下次跟进时间已更新')
              } catch (e) {
                messageError(e instanceof ApiError ? e.message : '更新失败')
              }
            }}
          />
        </InfoItem>
        <InfoItem label="标签">
          {tags.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {tags.map((t) => (
                <ToneBadge key={t} tone="violet">
                  {t}
                </ToneBadge>
              ))}
            </div>
          ) : (
            '—'
          )}
        </InfoItem>
        <InfoItem label="创建时间">
          {formatDateTime(customer.created_at)}
        </InfoItem>
        <InfoItem label="备注">
          <span className="whitespace-pre-wrap">{customer.note || '—'}</span>
        </InfoItem>
      </CardContent>
    </Card>
  )
}

function EditCustomerDialog({
  id,
  customer,
  onSaved,
}: {
  id: string
  customer: Customer
  onSaved: () => void
}) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(customer.name)
  const [company, setCompany] = useState(customer.company ?? '')
  const [source, setSource] = useState(customer.source ?? '')
  const [tags, setTags] = useState(customer.tags ?? '')
  const [note, setNote] = useState(customer.note ?? '')
  const [nextFollowAt, setNextFollowAt] = useState<string | undefined>(
    customer.next_follow_at ? customer.next_follow_at.slice(0, 10) : undefined,
  )
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setName(customer.name)
    setCompany(customer.company ?? '')
    setSource(customer.source ?? '')
    setTags(customer.tags ?? '')
    setNote(customer.note ?? '')
    setNextFollowAt(
      customer.next_follow_at ? customer.next_follow_at.slice(0, 10) : undefined,
    )
    setError(null)
    setSubmitting(false)
  }, [open, customer])

  async function submit() {
    if (!name.trim()) {
      setError('请填写客户名')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await api<Customer>(`/customers/${id}`, {
        method: 'PATCH',
        json: {
          name: name.trim(),
          company: company.trim() || null,
          source: source.trim() || null,
          tags: tags.trim() || null,
          note: note.trim() || null,
          next_follow_at: nextFollowAt || null,
        },
      })
      setOpen(false)
      onSaved()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '保存失败')
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Pencil className="size-4" />
          编辑
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>编辑客户</DialogTitle>
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
          <Field label="来源">
            <Input value={source} onChange={(e) => setSource(e.target.value)} />
          </Field>
          <Field label="标签（逗号分隔）">
            <Input value={tags} onChange={(e) => setTags(e.target.value)} />
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
            {submitting ? '保存中…' : '保存'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ---------------- 联系人 ---------------- */

function ContactsCard({
  id,
  contacts,
  onChanged,
}: {
  id: string
  contacts: Array<Contact>
  onChanged: () => void
}) {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Contact | null>(null)

  function openCreate() {
    setEditing(null)
    setOpen(true)
  }
  function openEdit(c: Contact) {
    setEditing(c)
    setOpen(true)
  }

  async function del(c: Contact) {
    if (!window.confirm(`删除联系人「${c.name}」？`)) return
    try {
      await api(`/contacts/${c.id}`, { method: 'DELETE' })
      onChanged()
      messageSuccess('联系人已删除')
    } catch (e) {
      messageError(e instanceof ApiError ? e.message : '删除失败')
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>联系人</CardTitle>
        <CardAction>
          <Button variant="outline" size="sm" onClick={openCreate}>
            <Plus className="size-4" />
            新增联系人
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {contacts.length === 0 ? (
          <p className="text-sm text-muted-foreground">暂无联系人</p>
        ) : (
          <ul className="divide-y">
            {contacts.map((c) => (
              <li key={c.id} className="flex items-start gap-3 py-3 first:pt-0">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{c.name}</span>
                    {c.title && (
                      <span className="text-xs text-muted-foreground">
                        {c.title}
                      </span>
                    )}
                    {c.is_primary === 1 && (
                      <ToneBadge tone="blue">主要联系人</ToneBadge>
                    )}
                  </div>
                  <div className="mt-0.5 flex flex-wrap gap-x-4 text-xs text-muted-foreground">
                    {c.phone && <span>电话：{c.phone}</span>}
                    {c.email && <span>邮箱：{c.email}</span>}
                  </div>
                  {c.note && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {c.note}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button variant="ghost" size="sm" onClick={() => openEdit(c)}>
                    编辑
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => del(c)}>
                    删除
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <ContactDialog
        open={open}
        onOpenChange={setOpen}
        customerId={id}
        contact={editing}
        onSaved={() => {
          setOpen(false)
          onChanged()
        }}
      />
    </Card>
  )
}

function ContactDialog({
  open,
  onOpenChange,
  customerId,
  contact,
  onSaved,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  customerId: string
  contact: Contact | null
  onSaved: () => void
}) {
  const [name, setName] = useState('')
  const [title, setTitle] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [note, setNote] = useState('')
  const [isPrimary, setIsPrimary] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setName(contact?.name ?? '')
    setTitle(contact?.title ?? '')
    setPhone(contact?.phone ?? '')
    setEmail(contact?.email ?? '')
    setNote(contact?.note ?? '')
    setIsPrimary(contact?.is_primary === 1)
    setError(null)
    setSubmitting(false)
  }, [open, contact])

  async function submit() {
    if (!name.trim()) {
      setError('请填写姓名')
      return
    }
    setSubmitting(true)
    setError(null)
    const payload = {
      name: name.trim(),
      title: title.trim() || null,
      phone: phone.trim() || null,
      email: email.trim() || null,
      note: note.trim() || null,
      is_primary: isPrimary ? 1 : 0,
    }
    try {
      if (contact) {
        await api(`/contacts/${contact.id}`, { method: 'PATCH', json: payload })
      } else {
        await api('/contacts', {
          method: 'POST',
          json: { customer_id: Number(customerId), ...payload },
        })
      }
      onSaved()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '保存失败')
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{contact ? '编辑联系人' : '新增联系人'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Field label="姓名 *">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="职位">
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </Field>
            <Field label="电话">
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </Field>
          </div>
          <Field label="邮箱">
            <Input value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label="备注">
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isPrimary}
              onChange={(e) => setIsPrimary(e.target.checked)}
              className="size-4 rounded border-input"
            />
            设为主要联系人
          </label>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={submitting}>
            {submitting ? '保存中…' : '保存'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ---------------- 商机 ---------------- */

function OpportunitiesCard({
  id,
  opportunities,
  nameOf,
  onChanged,
}: {
  id: string
  opportunities: Array<Opportunity>
  nameOf: (id: number) => string
  onChanged: () => void
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>商机</CardTitle>
        <CardAction>
          <NewOpportunityDialog customerId={id} onCreated={onChanged} />
        </CardAction>
      </CardHeader>
      <CardContent>
        {opportunities.length === 0 ? (
          <p className="text-sm text-muted-foreground">暂无商机</p>
        ) : (
          <ul className="divide-y">
            {opportunities.map((o) => (
              <li key={o.id}>
                <Link
                  to="/opportunities/$id"
                  params={{ id: String(o.id) }}
                  className="-mx-2 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md px-2 py-3 transition hover:bg-accent/50"
                >
                  <span className="min-w-32 flex-1 font-medium">{o.title}</span>
                  <StageBadge stage={o.stage} />
                  <OppStatusBadge status={o.status} />
                  <span className="text-sm text-muted-foreground">
                    {formatMoney(o.amount)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {nameOf(o.owner_id)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

function NewOpportunityDialog({
  customerId,
  onCreated,
}: {
  customerId: string
  onCreated: () => void
}) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [stage, setStage] = useState<OpportunityStage>('initial')
  const [amount, setAmount] = useState('')
  const [expectedCloseAt, setExpectedCloseAt] = useState<string | undefined>(
    undefined,
  )
  const [ownerId, setOwnerId] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const nameOf = useUserNames(ownerId != null && ownerId > 0 ? [ownerId] : [])

  useEffect(() => {
    if (!open) return
    setTitle('')
    setStage('initial')
    setAmount('')
    setExpectedCloseAt(undefined)
    setOwnerId(null)
    setError(null)
    setSubmitting(false)
  }, [open])

  async function pickOwner() {
    const res = await pickUsers({ multiple: false })
    if (res.status === 'picked') {
      setOwnerId(res.ids[0])
    } else if (res.status === 'standalone') {
      setOwnerId(0)
    }
    // cancelled：不处理
  }

  async function submit() {
    if (!title.trim()) {
      setError('请填写商机标题')
      return
    }
    const amountNum = amount.trim() === '' ? undefined : Number(amount)
    if (amountNum !== undefined && !Number.isFinite(amountNum)) {
      setError('金额必须是数字')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await api<Opportunity>('/opportunities', {
        method: 'POST',
        json: {
          customer_id: Number(customerId),
          title: title.trim(),
          stage,
          amount: amountNum,
          expected_close_at: expectedCloseAt || undefined,
          owner_id: ownerId && ownerId > 0 ? ownerId : undefined,
        },
      })
      setOpen(false)
      onCreated()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '创建失败')
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="size-4" />
          新建商机
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>新建商机</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Field label="标题 *">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
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
                  {STAGE_KEYS.map((k) => (
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
              />
            </Field>
          </div>
          <Field label="预计成交时间">
            <DatePicker
              value={expectedCloseAt}
              onChange={setExpectedCloseAt}
              placeholder="预计成交时间"
            />
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
