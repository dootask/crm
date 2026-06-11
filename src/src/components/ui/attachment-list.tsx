import { Paperclip, X } from 'lucide-react'
import { cn } from '#/lib/utils.ts'
import type { Attachment } from '#/lib/types'

/** 人类可读的文件体积。 */
function humanSize(n: number): string {
  if (!n) return ''
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

/**
 * 附件列表（chips）。
 * - 传 onRemove → 可编辑态（编辑器里），显示删除按钮、文件名不可点。
 * - 不传 onRemove → 只读态（时间线里），文件名为下载链接。
 */
export function AttachmentList({
  items,
  onRemove,
  className,
}: {
  items: Array<Attachment>
  onRemove?: (index: number) => void
  className?: string
}) {
  if (!items.length) return null
  return (
    <ul className={cn('flex flex-wrap gap-2', className)}>
      {items.map((a, i) => (
        <li
          key={`${a.url}-${i}`}
          className="inline-flex items-center gap-1.5 rounded-md border bg-muted/40 px-2 py-1 text-xs"
        >
          <Paperclip className="size-3 shrink-0 text-muted-foreground" />
          {onRemove ? (
            <span className="max-w-48 truncate">{a.name}</span>
          ) : (
            <a
              href={`${a.url}?download&name=${encodeURIComponent(a.name)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="max-w-48 truncate text-foreground hover:underline"
            >
              {a.name}
            </a>
          )}
          {a.size > 0 && (
            <span className="shrink-0 text-muted-foreground">
              {humanSize(a.size)}
            </span>
          )}
          {onRemove && (
            <button
              type="button"
              onClick={() => onRemove(i)}
              className="shrink-0 text-muted-foreground hover:text-destructive"
              aria-label="移除附件"
            >
              <X className="size-3" />
            </button>
          )}
        </li>
      ))}
    </ul>
  )
}
