import { useEffect, useState } from 'react'
import {
  ArrowDown,
  ArrowUp,
  Eye,
  EyeOff,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react'
import { api, ApiError } from '#/lib/api'
import type { OptionCategory, OptionItem } from '#/lib/types'
import { useOptionsRefresh } from '#/lib/use-options'
import { confirmDialog } from '#/lib/dootask'
import { messageError, messageSuccess } from '#/lib/message'
import { Button } from '#/components/ui/button.tsx'
import { Input } from '#/components/ui/input.tsx'
import { Card, CardContent } from '#/components/ui/card.tsx'
import { TONES, ToneBadge, ToneDot } from '#/components/ui/badge.tsx'
import type { Tone } from '#/components/ui/badge.tsx'
import { ToggleGroup, ToggleGroupItem } from '#/components/ui/toggle-group.tsx'
import { EmptyState, Loading, PageHeader } from '#/components/ui/misc'
import { Field } from '#/components/ui/form-field.tsx'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog.tsx'

interface AdminOption extends OptionItem {
  usage: number
}

export function OptionManager({
  category,
  title,
  description,
}: {
  category: OptionCategory
  title: string
  description: string
}) {
  const [items, setItems] = useState<Array<AdminOption>>([])
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<AdminOption | null>(null)
  const refreshGlobal = useOptionsRefresh()

  async function reload() {
    const res = await api<{ items: Array<AdminOption> }>(
      `/admin/options/${category}`,
    )
    setItems(res.items)
  }

  useEffect(() => {
    let cancelled = false
    reload()
      .catch((e) => {
        if (!cancelled)
          messageError(e instanceof ApiError ? e.message : '加载失败')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
    // 仅在 category 变化时重新加载；reload 依赖 category，无需单列。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category])

  // 任一变更后：刷新本页列表 + 全局选项（让徽章/下拉同步）。
  async function afterMutate() {
    await reload()
    refreshGlobal()
  }

  async function move(item: AdminOption, dir: 'up' | 'down') {
    setWorking(`move:${item.id}`)
    try {
      await api(`/admin/options/${category}/${item.id}`, {
        method: 'PATCH',
        json: { move: dir },
      })
      await afterMutate()
    } catch (e) {
      messageError(e instanceof ApiError ? e.message : '操作失败')
    } finally {
      setWorking(null)
    }
  }

  async function toggleArchive(item: AdminOption) {
    setWorking(`archive:${item.id}`)
    try {
      await api(`/admin/options/${category}/${item.id}`, {
        method: 'PATCH',
        json: { archived: item.archived === 0 },
      })
      await afterMutate()
      messageSuccess(item.archived === 0 ? '已停用' : '已启用')
    } catch (e) {
      messageError(e instanceof ApiError ? e.message : '操作失败')
    } finally {
      setWorking(null)
    }
  }

  async function del(item: AdminOption) {
    const okGo = await confirmDialog({
      title: '删除选项',
      content: `确定删除「${item.label}」？此操作不可恢复。`,
      okText: '删除',
      cancelText: '取消',
    })
    if (!okGo) return
    setWorking(`delete:${item.id}`)
    try {
      await api(`/admin/options/${category}/${item.id}`, { method: 'DELETE' })
      await afterMutate()
      messageSuccess('已删除')
    } catch (e) {
      messageError(e instanceof ApiError ? e.message : '删除失败')
    } finally {
      setWorking(null)
    }
  }

  function openCreate() {
    setEditing(null)
    setDialogOpen(true)
  }
  function openEdit(item: AdminOption) {
    setEditing(item)
    setDialogOpen(true)
  }

  return (
    <div>
      <PageHeader
        title={title}
        description={description}
        action={
          <Button onClick={openCreate}>
            <Plus className="size-4" />
            新增选项
          </Button>
        }
      />

      {loading ? (
        <Card className="py-0">
          <CardContent className="p-0">
            <Loading center />
          </CardContent>
        </Card>
      ) : items.length === 0 ? (
        <EmptyState title="暂无选项" hint="点击右上角「新增选项」开始添加" />
      ) : (
        <Card className="py-0">
          <CardContent className="p-0">
            <ul className="divide-y">
              {items.map((item, i) => {
                const busy = working?.endsWith(`:${item.id}`) ?? false
                const inUse = item.usage > 0
                return (
                  <li
                    key={item.id}
                    className="flex flex-wrap items-center gap-3 px-4 py-3"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <ToneBadge tone={item.tone as Tone}>
                        {item.label}
                      </ToneBadge>
                      {item.archived === 1 && (
                        <span className="text-xs text-muted-foreground">
                          已停用
                        </span>
                      )}
                      {inUse && (
                        <span className="text-xs text-muted-foreground">
                          使用中 · {item.usage}
                        </span>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        disabled={busy || i === 0}
                        onClick={() => move(item, 'up')}
                        title="上移"
                      >
                        <ArrowUp className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        disabled={busy || i === items.length - 1}
                        onClick={() => move(item, 'down')}
                        title="下移"
                      >
                        <ArrowDown className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={busy}
                        onClick={() => openEdit(item)}
                      >
                        <Pencil className="size-4" />
                        编辑
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={busy}
                        onClick={() => toggleArchive(item)}
                      >
                        {item.archived === 0 ? (
                          <>
                            <EyeOff className="size-4" />
                            停用
                          </>
                        ) : (
                          <>
                            <Eye className="size-4" />
                            启用
                          </>
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        disabled={busy || inUse}
                        title={
                          inUse ? '使用中，无法删除（可改为停用）' : undefined
                        }
                        onClick={() => del(item)}
                      >
                        <Trash2 className="size-4" />
                        删除
                      </Button>
                    </div>
                  </li>
                )
              })}
            </ul>
          </CardContent>
        </Card>
      )}

      <OptionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        category={category}
        editing={editing}
        onSaved={async () => {
          setDialogOpen(false)
          await afterMutate()
        }}
      />
    </div>
  )
}

function OptionDialog({
  open,
  onOpenChange,
  category,
  editing,
  onSaved,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  category: OptionCategory
  editing: AdminOption | null
  onSaved: () => void
}) {
  const [label, setLabel] = useState('')
  const [tone, setTone] = useState<Tone>('gray')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setLabel(editing?.label ?? '')
    setTone((editing?.tone ?? 'gray') as Tone)
    setError(null)
    setSubmitting(false)
  }, [open, editing])

  async function submit() {
    if (!label.trim()) {
      setError('请填写名称')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      if (editing) {
        await api(`/admin/options/${category}/${editing.id}`, {
          method: 'PATCH',
          json: { label: label.trim(), tone },
        })
      } else {
        await api(`/admin/options/${category}`, {
          method: 'POST',
          json: { label: label.trim(), tone },
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
          <DialogTitle>{editing ? '编辑选项' : '新增选项'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Field label="名称 *">
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              autoFocus
              placeholder="如：跟进中"
            />
          </Field>
          <Field label="颜色">
            <div className="flex flex-wrap items-center gap-3">
              <ToggleGroup
                type="single"
                variant="outline"
                value={tone}
                onValueChange={(v) => v && setTone(v as Tone)}
              >
                {TONES.map((t) => (
                  <ToggleGroupItem key={t} value={t} aria-label={t}>
                    <ToneDot tone={t} className="size-4" />
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
              <span className="text-xs text-muted-foreground">预览</span>
              <ToneBadge tone={tone}>{label.trim() || '示例'}</ToneBadge>
            </div>
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
