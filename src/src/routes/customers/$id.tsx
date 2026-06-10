import { useEffect, useState } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import {
  ArrowLeft,
  ExternalLink,
  Pencil,
  Plus,
  Star,
  Trash2,
  Unlink,
} from 'lucide-react'
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
import { formatDate, formatDateTime, formatMoney, isOverdue } from '#/lib/format'
import { useUserNames } from '#/lib/use-users'
import { openDooTaskTask, pickUsers } from '#/lib/dootask'
import { Button } from '#/components/ui/button'
import { Input, Textarea, Select, FormRow, Label } from '#/components/ui/field'
import { Card, CardHeader, CardBody } from '#/components/ui/card'
import {
  Badge,
  CustomerStatusBadge,
  OppStatusBadge,
  StageBadge,
} from '#/components/ui/badge'
import { Modal } from '#/components/ui/modal'
import { PageHeader, Loading } from '#/components/ui/misc'

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

  async function load() {
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
    load()
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
        <BackLink />
        <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">
          {error}
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div>
        <BackLink />
        <Loading />
      </div>
    )
  }

  const { customer } = data

  return (
    <div className="space-y-5">
      <BackLink />
      <PageHeader
        title={customer.name}
        description={customer.company || undefined}
        action={
          <DeleteCustomerButton
            id={id}
            onDeleted={() => navigate({ to: '/customers' })}
          />
        }
      />

      <CustomerInfoCard id={id} data={data} nameOf={nameOf} onChanged={load} />
      <ContactsCard id={id} contacts={data.contacts} onChanged={load} />
      <FollowUpsCard
        id={id}
        followUps={data.follow_ups}
        opportunities={data.opportunities}
        nameOf={nameOf}
        onChanged={load}
      />
      <OpportunitiesCard
        id={id}
        opportunities={data.opportunities}
        nameOf={nameOf}
        onChanged={load}
      />
      <TaskLinksCard id={id} taskLinks={data.task_links} onChanged={load} />
    </div>
  )
}

function BackLink() {
  return (
    <Link
      to="/customers"
      className="mb-1 inline-flex items-center gap-1 text-sm text-zinc-500 transition hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
    >
      <ArrowLeft className="h-4 w-4" />
      返回客户列表
    </Link>
  )
}

function DeleteCustomerButton({
  id,
  onDeleted,
}: {
  id: string
  onDeleted: () => void
}) {
  const [busy, setBusy] = useState(false)

  async function del() {
    if (!window.confirm('确定删除该客户？此操作不可撤销。')) return
    setBusy(true)
    try {
      await api(`/customers/${id}`, { method: 'DELETE' })
      onDeleted()
    } catch (e) {
      window.alert(e instanceof ApiError ? e.message : '删除失败')
      setBusy(false)
    }
  }

  return (
    <Button variant="danger" onClick={del} disabled={busy}>
      <Trash2 className="h-4 w-4" />
      删除客户
    </Button>
  )
}

/* ---------------- 1. 客户信息 ---------------- */

function InfoItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="text-sm">{children}</div>
    </div>
  )
}

function CustomerInfoCard({
  id,
  data,
  nameOf,
  onChanged,
}: {
  id: string
  data: Detail
  nameOf: (id: number) => string
  onChanged: () => void
}) {
  const { customer } = data
  const [editOpen, setEditOpen] = useState(false)
  const [statusBusy, setStatusBusy] = useState(false)
  const overdue = isOverdue(customer.next_follow_at)

  async function changeStatus(status: CustomerStatus) {
    setStatusBusy(true)
    try {
      await api<Customer>(`/customers/${id}`, { method: 'PATCH', json: { status } })
      onChanged()
    } catch (e) {
      window.alert(e instanceof ApiError ? e.message : '更新失败')
    } finally {
      setStatusBusy(false)
    }
  }

  return (
    <Card>
      <CardHeader
        title="客户信息"
        action={
          <Button variant="secondary" size="sm" onClick={() => setEditOpen(true)}>
            <Pencil className="h-3.5 w-3.5" />
            编辑
          </Button>
        }
      />
      <CardBody className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <InfoItem label="客户名">{customer.name}</InfoItem>
        <InfoItem label="公司">{customer.company || '—'}</InfoItem>
        <InfoItem label="状态">
          <div className="flex items-center gap-2">
            <CustomerStatusBadge status={customer.status} />
            <Select
              className="h-7 w-24 py-0 text-xs"
              value={customer.status}
              disabled={statusBusy}
              onChange={(e) => changeStatus(e.target.value as CustomerStatus)}
            >
              {(Object.keys(CUSTOMER_STATUS) as Array<CustomerStatus>).map((k) => (
                <option key={k} value={k}>
                  {CUSTOMER_STATUS[k]}
                </option>
              ))}
            </Select>
          </div>
        </InfoItem>
        <InfoItem label="来源">{customer.source || '—'}</InfoItem>
        <InfoItem label="负责人">{nameOf(customer.owner_id)}</InfoItem>
        <InfoItem label="下次跟进时间">
          <span className={overdue ? 'font-medium text-red-600 dark:text-red-400' : ''}>
            {formatDate(customer.next_follow_at)}
          </span>
        </InfoItem>
        <InfoItem label="标签">
          {splitTags(customer.tags).length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {splitTags(customer.tags).map((t) => (
                <Badge key={t} tone="violet">
                  {t}
                </Badge>
              ))}
            </div>
          ) : (
            '—'
          )}
        </InfoItem>
        <InfoItem label="创建时间">{formatDateTime(customer.created_at)}</InfoItem>
        <InfoItem label="备注">
          <span className="whitespace-pre-wrap">{customer.note || '—'}</span>
        </InfoItem>
      </CardBody>

      <EditCustomerModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        id={id}
        customer={customer}
        nameOf={nameOf}
        onSaved={() => {
          setEditOpen(false)
          onChanged()
        }}
      />
    </Card>
  )
}

function EditCustomerModal({
  open,
  onClose,
  id,
  customer,
  nameOf,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  id: string
  customer: Customer
  nameOf: (id: number) => string
  onSaved: () => void
}) {
  const [name, setName] = useState(customer.name)
  const [company, setCompany] = useState(customer.company ?? '')
  const [status, setStatus] = useState<CustomerStatus>(customer.status)
  const [source, setSource] = useState(customer.source ?? '')
  const [tags, setTags] = useState(customer.tags ?? '')
  const [note, setNote] = useState(customer.note ?? '')
  const [ownerId, setOwnerId] = useState<number>(customer.owner_id)
  const [nextFollowAt, setNextFollowAt] = useState(
    customer.next_follow_at ? customer.next_follow_at.slice(0, 10) : '',
  )
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const localNameOf = useUserNames([ownerId])

  useEffect(() => {
    if (!open) return
    setName(customer.name)
    setCompany(customer.company ?? '')
    setStatus(customer.status)
    setSource(customer.source ?? '')
    setTags(customer.tags ?? '')
    setNote(customer.note ?? '')
    setOwnerId(customer.owner_id)
    setNextFollowAt(customer.next_follow_at ? customer.next_follow_at.slice(0, 10) : '')
    setError(null)
    setSubmitting(false)
  }, [open, customer])

  async function pickOwner() {
    const res = await pickUsers({ value: [ownerId], multiple: false })
    if (res === null) {
      const input = window.prompt('独立模式：请输入负责人用户 ID', String(ownerId))
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
      await api<Customer>(`/customers/${id}`, {
        method: 'PATCH',
        json: {
          name: name.trim(),
          company: company.trim() || null,
          status,
          source: source.trim() || null,
          tags: tags.trim() || null,
          note: note.trim() || null,
          owner_id: ownerId,
          next_follow_at: nextFollowAt || null,
        },
      })
      onSaved()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '保存失败')
      setSubmitting(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="编辑客户">
      <div className="space-y-3">
        <FormRow label="客户名 *">
          <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
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
              {(Object.keys(CUSTOMER_STATUS) as Array<CustomerStatus>).map((k) => (
                <option key={k} value={k}>
                  {CUSTOMER_STATUS[k]}
                </option>
              ))}
            </Select>
          </FormRow>
          <FormRow label="来源">
            <Input value={source} onChange={(e) => setSource(e.target.value)} />
          </FormRow>
        </div>
        <FormRow label="标签（逗号分隔）">
          <Input value={tags} onChange={(e) => setTags(e.target.value)} />
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
              {localNameOf(ownerId) || nameOf(ownerId)}
            </span>
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
            {submitting ? '保存中…' : '保存'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

/* ---------------- 2. 联系人 ---------------- */

function ContactsCard({
  id,
  contacts,
  onChanged,
}: {
  id: string
  contacts: Array<Contact>
  onChanged: () => void
}) {
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Contact | null>(null)

  function openCreate() {
    setEditing(null)
    setModalOpen(true)
  }
  function openEdit(c: Contact) {
    setEditing(c)
    setModalOpen(true)
  }

  async function del(c: Contact) {
    if (!window.confirm(`删除联系人「${c.name}」？`)) return
    try {
      await api(`/contacts/${c.id}`, { method: 'DELETE' })
      onChanged()
    } catch (e) {
      window.alert(e instanceof ApiError ? e.message : '删除失败')
    }
  }

  return (
    <Card>
      <CardHeader
        title="联系人"
        action={
          <Button variant="secondary" size="sm" onClick={openCreate}>
            <Plus className="h-3.5 w-3.5" />
            新增联系人
          </Button>
        }
      />
      <CardBody className="p-0">
        {contacts.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-zinc-400">暂无联系人</p>
        ) : (
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {contacts.map((c) => (
              <li key={c.id} className="flex items-start gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{c.name}</span>
                    {c.title && (
                      <span className="text-xs text-zinc-500 dark:text-zinc-400">
                        {c.title}
                      </span>
                    )}
                    {c.is_primary === 1 && <Badge tone="blue">主要联系人</Badge>}
                  </div>
                  <div className="mt-0.5 flex flex-wrap gap-x-4 text-xs text-zinc-500 dark:text-zinc-400">
                    {c.phone && <span>电话：{c.phone}</span>}
                    {c.email && <span>邮箱：{c.email}</span>}
                  </div>
                  {c.note && (
                    <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
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
      </CardBody>

      <ContactModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        customerId={id}
        contact={editing}
        onSaved={() => {
          setModalOpen(false)
          onChanged()
        }}
      />
    </Card>
  )
}

function ContactModal({
  open,
  onClose,
  customerId,
  contact,
  onSaved,
}: {
  open: boolean
  onClose: () => void
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
    <Modal open={open} onClose={onClose} title={contact ? '编辑联系人' : '新增联系人'}>
      <div className="space-y-3">
        <FormRow label="姓名 *">
          <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </FormRow>
        <div className="grid grid-cols-2 gap-3">
          <FormRow label="职位">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </FormRow>
          <FormRow label="电话">
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </FormRow>
        </div>
        <FormRow label="邮箱">
          <Input value={email} onChange={(e) => setEmail(e.target.value)} />
        </FormRow>
        <FormRow label="备注">
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} />
        </FormRow>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={isPrimary}
            onChange={(e) => setIsPrimary(e.target.checked)}
            className="h-4 w-4 rounded border-zinc-300 text-blue-600"
          />
          <Star className="h-3.5 w-3.5 text-amber-500" />
          设为主要联系人
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            取消
          </Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting ? '保存中…' : '保存'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

/* ---------------- 3. 跟进记录 ---------------- */

function FollowUpsCard({
  id,
  followUps,
  opportunities,
  nameOf,
  onChanged,
}: {
  id: string
  followUps: Array<FollowUp>
  opportunities: Array<Opportunity>
  nameOf: (id: number) => string
  onChanged: () => void
}) {
  const [open, setOpen] = useState(false)

  return (
    <Card>
      <CardHeader
        title="跟进记录"
        action={
          <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
            <Plus className="h-3.5 w-3.5" />
            添加跟进
          </Button>
        }
      />
      <CardBody>
        {followUps.length === 0 ? (
          <p className="py-4 text-center text-sm text-zinc-400">暂无跟进记录</p>
        ) : (
          <ol className="space-y-4">
            {followUps.map((f) => (
              <li key={f.id} className="relative pl-5">
                <span className="absolute left-0 top-1.5 h-2 w-2 rounded-full bg-blue-500" />
                <div className="flex flex-wrap items-center gap-x-2 text-xs text-zinc-500 dark:text-zinc-400">
                  <span className="font-medium text-zinc-700 dark:text-zinc-200">
                    {nameOf(f.follow_by)}
                  </span>
                  <span>{formatDateTime(f.created_at)}</span>
                  {f.next_follow_at && (
                    <Badge tone="amber">下次：{formatDate(f.next_follow_at)}</Badge>
                  )}
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm">{f.content}</p>
              </li>
            ))}
          </ol>
        )}
      </CardBody>

      <AddFollowUpModal
        open={open}
        onClose={() => setOpen(false)}
        customerId={id}
        opportunities={opportunities}
        onSaved={() => {
          setOpen(false)
          onChanged()
        }}
      />
    </Card>
  )
}

function AddFollowUpModal({
  open,
  onClose,
  customerId,
  opportunities,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  customerId: string
  opportunities: Array<Opportunity>
  onSaved: () => void
}) {
  const [content, setContent] = useState('')
  const [opportunityId, setOpportunityId] = useState('')
  const [nextFollowAt, setNextFollowAt] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setContent('')
    setOpportunityId('')
    setNextFollowAt('')
    setError(null)
    setSubmitting(false)
  }, [open])

  async function submit() {
    if (!content.trim()) {
      setError('请填写跟进内容')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await api('/follow-ups', {
        method: 'POST',
        json: {
          customer_id: Number(customerId),
          opportunity_id: opportunityId ? Number(opportunityId) : undefined,
          content: content.trim(),
          next_follow_at: nextFollowAt || undefined,
        },
      })
      onSaved()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '提交失败')
      setSubmitting(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="添加跟进">
      <div className="space-y-3">
        <FormRow label="跟进内容 *">
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            autoFocus
          />
        </FormRow>
        <FormRow label="关联商机">
          <Select
            value={opportunityId}
            onChange={(e) => setOpportunityId(e.target.value)}
          >
            <option value="">不关联</option>
            {opportunities.map((o) => (
              <option key={o.id} value={o.id}>
                {o.title}
              </option>
            ))}
          </Select>
        </FormRow>
        <FormRow label="下次跟进时间">
          <Input
            type="date"
            value={nextFollowAt}
            onChange={(e) => setNextFollowAt(e.target.value)}
          />
        </FormRow>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            取消
          </Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting ? '提交中…' : '提交'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

/* ---------------- 4. 商机 ---------------- */

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
  const [open, setOpen] = useState(false)

  return (
    <Card>
      <CardHeader
        title="商机"
        action={
          <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
            <Plus className="h-3.5 w-3.5" />
            新建商机
          </Button>
        }
      />
      <CardBody className="p-0">
        {opportunities.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-zinc-400">暂无商机</p>
        ) : (
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {opportunities.map((o) => (
              <li key={o.id}>
                <Link
                  to="/opportunities/$id"
                  params={{ id: String(o.id) }}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 transition hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                >
                  <span className="min-w-32 flex-1 font-medium">{o.title}</span>
                  <StageBadge stage={o.stage} />
                  <OppStatusBadge status={o.status} />
                  <span className="text-sm text-zinc-500 dark:text-zinc-400">
                    {formatMoney(o.amount)}
                  </span>
                  <span className="text-xs text-zinc-400">{nameOf(o.owner_id)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardBody>

      <NewOpportunityModal
        open={open}
        onClose={() => setOpen(false)}
        customerId={id}
        onSaved={() => {
          setOpen(false)
          onChanged()
        }}
      />
    </Card>
  )
}

function NewOpportunityModal({
  open,
  onClose,
  customerId,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  customerId: string
  onSaved: () => void
}) {
  const [title, setTitle] = useState('')
  const [stage, setStage] = useState<OpportunityStage>('initial')
  const [amount, setAmount] = useState('')
  const [expectedCloseAt, setExpectedCloseAt] = useState('')
  const [ownerId, setOwnerId] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const nameOf = useUserNames(ownerId != null ? [ownerId] : [])

  useEffect(() => {
    if (!open) return
    setTitle('')
    setStage('initial')
    setAmount('')
    setExpectedCloseAt('')
    setOwnerId(null)
    setError(null)
    setSubmitting(false)
  }, [open])

  async function pickOwner() {
    const res = await pickUsers({ multiple: false })
    if (res === null) {
      const input = window.prompt('独立模式：请输入负责人用户 ID（留空取消）')
      if (input == null || input.trim() === '') return
      const n = Number(input.trim())
      if (Number.isFinite(n) && n > 0) setOwnerId(n)
      return
    }
    if (res.length > 0) setOwnerId(res[0])
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
          owner_id: ownerId ?? undefined,
        },
      })
      onSaved()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '创建失败')
      setSubmitting(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="新建商机">
      <div className="space-y-3">
        <FormRow label="标题 *">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
        </FormRow>
        <div className="grid grid-cols-2 gap-3">
          <FormRow label="阶段">
            <Select
              value={stage}
              onChange={(e) => setStage(e.target.value as OpportunityStage)}
            >
              {(Object.keys(OPPORTUNITY_STAGE) as Array<OpportunityStage>).map((k) => (
                <option key={k} value={k}>
                  {OPPORTUNITY_STAGE[k]}
                </option>
              ))}
            </Select>
          </FormRow>
          <FormRow label="金额">
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </FormRow>
        </div>
        <FormRow label="预计成交时间">
          <Input
            type="date"
            value={expectedCloseAt}
            onChange={(e) => setExpectedCloseAt(e.target.value)}
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

/* ---------------- 5. 关联任务 ---------------- */

function TaskLinksCard({
  id,
  taskLinks,
  onChanged,
}: {
  id: string
  taskLinks: Array<TaskLink>
  onChanged: () => void
}) {
  const [open, setOpen] = useState(false)

  async function unlink(t: TaskLink) {
    if (!window.confirm('解除该任务关联？')) return
    try {
      await api(`/task-links/${t.id}`, { method: 'DELETE' })
      onChanged()
    } catch (e) {
      window.alert(e instanceof ApiError ? e.message : '解除失败')
    }
  }

  return (
    <Card>
      <CardHeader
        title="关联任务"
        action={
          <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
            <Plus className="h-3.5 w-3.5" />
            关联任务
          </Button>
        }
      />
      <CardBody className="p-0">
        {taskLinks.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-zinc-400">暂无关联任务</p>
        ) : (
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {taskLinks.map((t) => (
              <li key={t.id} className="flex items-center gap-3 px-4 py-3">
                <span className="min-w-0 flex-1 truncate text-sm">
                  {t.title || `任务 #${t.task_id}`}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => openDooTaskTask(t.task_id)}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  打开任务
                </Button>
                <Button variant="ghost" size="sm" onClick={() => unlink(t)}>
                  <Unlink className="h-3.5 w-3.5" />
                  解除
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardBody>

      <LinkTaskModal
        open={open}
        onClose={() => setOpen(false)}
        customerId={id}
        onSaved={() => {
          setOpen(false)
          onChanged()
        }}
      />
    </Card>
  )
}

function LinkTaskModal({
  open,
  onClose,
  customerId,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  customerId: string
  onSaved: () => void
}) {
  const [taskId, setTaskId] = useState('')
  const [title, setTitle] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setTaskId('')
    setTitle('')
    setError(null)
    setSubmitting(false)
  }, [open])

  async function submit() {
    const n = Number(taskId)
    if (!taskId.trim() || !Number.isFinite(n) || n <= 0) {
      setError('请填写有效的任务 ID')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await api('/task-links', {
        method: 'POST',
        json: {
          entity_type: 'customer',
          entity_id: Number(customerId),
          task_id: n,
          title: title.trim() || undefined,
        },
      })
      onSaved()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '关联失败')
      setSubmitting(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="关联 DooTask 任务">
      <div className="space-y-3">
        <FormRow label="任务 ID *">
          <Input
            type="number"
            value={taskId}
            onChange={(e) => setTaskId(e.target.value)}
            placeholder="DooTask 任务编号"
            autoFocus
          />
        </FormRow>
        <FormRow label="标题（可选）">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </FormRow>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            取消
          </Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting ? '提交中…' : '关联'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
