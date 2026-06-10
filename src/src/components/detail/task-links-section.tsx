import { useState } from 'react'
import { ExternalLink, Link2, Unlink } from 'lucide-react'
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from '#/components/ui/card.tsx'
import { Button } from '#/components/ui/button.tsx'
import { Input } from '#/components/ui/input.tsx'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '#/components/ui/dialog.tsx'
import { Field } from '#/components/ui/form-field.tsx'
import { api, ApiError } from '#/lib/api'
import { openDooTaskTask } from '#/lib/dootask'
import type { EntityType, TaskLink } from '#/lib/types'

/** 关联 DooTask 任务区（列表 + 关联弹窗 + 打开/解除），客户与商机详情共用。 */
export function TaskLinksSection({
  entityType,
  entityId,
  taskLinks,
  onChanged,
}: {
  entityType: EntityType
  entityId: number
  taskLinks: Array<TaskLink>
  onChanged: () => void
}) {
  const [open, setOpen] = useState(false)
  const [taskId, setTaskId] = useState('')
  const [title, setTitle] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function link() {
    const id = Number(taskId.trim())
    if (!Number.isFinite(id) || id <= 0) {
      setError('请输入有效的任务 ID')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await api('/task-links', {
        method: 'POST',
        json: {
          entity_type: entityType,
          entity_id: entityId,
          task_id: id,
          title: title.trim() || undefined,
        },
      })
      setTaskId('')
      setTitle('')
      setOpen(false)
      onChanged()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '关联失败')
    } finally {
      setBusy(false)
    }
  }

  async function unlink(id: number) {
    await api(`/task-links/${id}`, { method: 'DELETE' })
    onChanged()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>关联任务</CardTitle>
        <CardAction>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Link2 className="size-4" />
                关联任务
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>关联 DooTask 任务</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <Field label="任务 ID">
                  <Input
                    type="number"
                    value={taskId}
                    onChange={(e) => setTaskId(e.target.value)}
                    placeholder="DooTask 任务 ID"
                  />
                </Field>
                <Field label="备注（可选）">
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="便于识别的名称"
                  />
                </Field>
                {error && <p className="text-sm text-destructive">{error}</p>}
              </div>
              <DialogFooter>
                <Button onClick={link} disabled={busy}>
                  {busy ? '关联中…' : '关联'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardAction>
      </CardHeader>
      <CardContent>
        {taskLinks.length === 0 ? (
          <p className="text-sm text-muted-foreground">暂无关联任务</p>
        ) : (
          <ul className="space-y-2">
            {taskLinks.map((t) => (
              <li
                key={t.id}
                className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"
              >
                <span className="truncate">{t.title || `任务 #${t.task_id}`}</span>
                <span className="flex shrink-0 items-center gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => openDooTaskTask(t.task_id)}
                  >
                    <ExternalLink className="size-4" />
                    打开
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    className="text-muted-foreground"
                    onClick={() => unlink(t.id)}
                    aria-label="解除关联"
                  >
                    <Unlink className="size-4" />
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
