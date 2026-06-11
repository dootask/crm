import { useState } from 'react'
import { Link2, X } from 'lucide-react'
import { Button } from '#/components/ui/button.tsx'
import { TaskPickerDialog } from '#/components/detail/task-picker-dialog.tsx'
import type { TaskSelection } from '#/components/detail/task-picker-dialog.tsx'

/**
 * 新增客户/商机对话框里的「关联任务（可选）」收集器：
 * 选中的任务先暂存为待关联列表，待实体创建后由调用方逐条落库。
 */
export function PendingTaskLinks({
  value,
  onChange,
  defaultName,
}: {
  value: Array<TaskSelection>
  onChange: (next: Array<TaskSelection>) => void
  defaultName?: string
}) {
  const [open, setOpen] = useState(false)

  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <ul className="space-y-1.5">
          {value.map((sel, i) => (
            <li
              key={i}
              className="flex items-center justify-between gap-2 rounded-md border px-3 py-1.5 text-sm"
            >
              <span className="truncate">
                {sel.kind === 'existing'
                  ? sel.title || `任务 #${sel.task_id}`
                  : `新建任务：${sel.name}`}
              </span>
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                className="text-muted-foreground"
                aria-label="移除"
                onClick={() => onChange(value.filter((_, j) => j !== i))}
              >
                <X className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
      >
        <Link2 className="size-4" />
        添加任务
      </Button>
      <TaskPickerDialog
        open={open}
        onOpenChange={setOpen}
        defaultName={defaultName}
        onPicked={async (sel) => {
          onChange([...value, sel])
        }}
      />
    </div>
  )
}
