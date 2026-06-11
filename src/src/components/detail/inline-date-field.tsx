import { useState } from 'react'
import { Pencil, X } from 'lucide-react'
import { Button } from '#/components/ui/button.tsx'
import { Calendar } from '#/components/ui/calendar.tsx'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '#/components/ui/popover.tsx'
import { formatDate } from '#/lib/format'

// 'YYYY-MM-DD' <-> Date（本地日期，避免时区偏移）
function toDate(value?: string | null): Date | undefined {
  if (!value) return undefined
  const [y, m, d] = value.slice(0, 10).split('-').map(Number)
  if (!y || !m || !d) return undefined
  return new Date(y, m - 1, d)
}
function toStr(date?: Date): string | null {
  if (!date) return null
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * 信息卡内联日期展示 + 修改。点「修改」图标弹出日历直接改；可清除。
 * onChange 传 string 设置、传 null 清空；调用方负责 PATCH
 * （客户/商机 PATCH 会自动写一条修改跟进记录）。
 * label 用于无障碍标签，overdue 为 true 时日期标红。
 */
export function InlineDateEdit({
  value,
  label,
  overdue,
  onChange,
  disabled,
}: {
  value: string | null
  label: string
  overdue?: boolean
  onChange: (next: string | null) => void | Promise<void>
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const selected = toDate(value)

  async function commit(next: string | null) {
    setOpen(false)
    setBusy(true)
    try {
      await onChange(next)
    } finally {
      setBusy(false)
    }
  }

  return (
    <span className="inline-flex items-center gap-1">
      <span className={overdue ? 'font-medium text-destructive' : ''}>
        {formatDate(value)}
      </span>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            size="icon-sm"
            variant="ghost"
            className="text-muted-foreground"
            disabled={disabled || busy}
            aria-label={`修改${label}`}
          >
            <Pencil className="size-3.5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={selected}
            onSelect={(d) => commit(toStr(d))}
            autoFocus
          />
          {value && (
            <div className="border-t p-2">
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start text-muted-foreground"
                onClick={() => commit(null)}
              >
                <X className="size-3.5" />
                清除
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </span>
  )
}
