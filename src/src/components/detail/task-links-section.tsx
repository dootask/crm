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
import { api } from '#/lib/api'
import { confirmDialog, openDooTaskTask } from '#/lib/dootask'
import { messageWarning } from '#/lib/message'
import {
  TaskPickerDialog,
  linkTaskSelection,
} from '#/components/detail/task-picker-dialog.tsx'
import type { TaskSelection } from '#/components/detail/task-picker-dialog.tsx'
import type { EntityType, TaskLink } from '#/lib/types'

/** 关联 DooTask 任务区（列表 + 搜索/创建关联 + 打开/解除），客户与商机详情共用。 */
export function TaskLinksSection({
  entityType,
  entityId,
  entityName,
  taskLinks,
  onChanged,
}: {
  entityType: EntityType
  entityId: number
  entityName?: string
  taskLinks: Array<TaskLink>
  onChanged: () => void
}) {
  const [open, setOpen] = useState(false)

  async function handlePicked(sel: TaskSelection) {
    const { warning } = await linkTaskSelection(entityType, entityId, sel)
    onChanged()
    if (warning) messageWarning(warning)
  }

  async function unlink(t: TaskLink) {
    const ok = await confirmDialog({
      title: '解除关联',
      content: `确定解除与「${t.title || `任务 #${t.task_id}`}」的关联吗？`,
    })
    if (!ok) return
    await api(`/task-links/${t.id}`, { method: 'DELETE' })
    onChanged()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>关联任务</CardTitle>
        <CardAction>
          <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
            <Link2 className="size-4" />
            关联任务
          </Button>
          <TaskPickerDialog
            open={open}
            onOpenChange={setOpen}
            onPicked={handlePicked}
            defaultName={entityName}
          />
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
                    onClick={() => unlink(t)}
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
