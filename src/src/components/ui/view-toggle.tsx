import { AlignJustify, Rows3 } from 'lucide-react'
import { cn } from '#/lib/utils'

export type ListView = 'simple' | 'detailed'

/** 列表「简洁 / 详细」视图切换段控件。详细模式额外展示最近一条跟进。 */
export function ViewToggle({
  value,
  onChange,
}: {
  value: ListView
  onChange: (v: ListView) => void
}) {
  return (
    <div className="ml-auto inline-flex items-center rounded-md border p-0.5">
      <button
        type="button"
        onClick={() => onChange('simple')}
        title="简洁列表"
        className={cn(
          'inline-flex items-center gap-1 rounded px-2.5 py-1 text-xs transition-colors',
          value === 'simple'
            ? 'bg-accent text-accent-foreground'
            : 'text-muted-foreground hover:text-foreground',
        )}
      >
        <AlignJustify className="size-3.5" />
        简洁
      </button>
      <button
        type="button"
        onClick={() => onChange('detailed')}
        title="详细列表"
        className={cn(
          'inline-flex items-center gap-1 rounded px-2.5 py-1 text-xs transition-colors',
          value === 'detailed'
            ? 'bg-accent text-accent-foreground'
            : 'text-muted-foreground hover:text-foreground',
        )}
      >
        <Rows3 className="size-3.5" />
        详细
      </button>
    </div>
  )
}
