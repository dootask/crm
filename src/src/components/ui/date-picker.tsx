import * as React from 'react'
import { CalendarIcon, X } from 'lucide-react'
import { Button } from '#/components/ui/button.tsx'
import { Calendar } from '#/components/ui/calendar.tsx'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '#/components/ui/popover.tsx'
import { cn } from '#/lib/utils.ts'

// 字符串 'YYYY-MM-DD' <-> Date（按本地日期，避免时区偏移）
function toDate(value?: string | null): Date | undefined {
  if (!value) return undefined
  const [y, m, d] = value.slice(0, 10).split('-').map(Number)
  if (!y || !m || !d) return undefined
  return new Date(y, m - 1, d)
}
function toStr(date?: Date): string | undefined {
  if (!date) return undefined
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * 统一的日期选择器（shadcn Popover + Calendar）。插件内所有日期选择都用它。
 * value/onChange 走 'YYYY-MM-DD' 字符串，便于直接存库与传接口。
 */
export function DatePicker({
  value,
  onChange,
  placeholder = '选择日期',
  clearable = true,
  className,
  id,
}: {
  value?: string | null
  onChange: (value: string | undefined) => void
  placeholder?: string
  clearable?: boolean
  className?: string
  id?: string
}) {
  const [open, setOpen] = React.useState(false)
  const selected = toDate(value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          className={cn(
            'w-full justify-start font-normal',
            !selected && 'text-muted-foreground',
            className,
          )}
        >
          <CalendarIcon className="size-4 opacity-70" />
          {selected ? value?.slice(0, 10) : placeholder}
          {clearable && selected && (
            <span
              role="button"
              tabIndex={-1}
              aria-label="清除"
              className="ml-auto inline-flex rounded p-0.5 hover:bg-accent"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                onChange(undefined)
              }}
            >
              <X className="size-3.5" />
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={(d) => {
            onChange(toStr(d))
            setOpen(false)
          }}
          autoFocus
        />
      </PopoverContent>
    </Popover>
  )
}
