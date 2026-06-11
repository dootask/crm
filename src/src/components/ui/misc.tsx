import { Loader2 } from 'lucide-react'
import { cn } from '#/lib/utils'

export function PageHeader({
  title,
  description,
  action,
}: {
  title: React.ReactNode
  description?: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-xl font-bold tracking-tight">{title}</h1>
        {description && (
          <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
            {description}
          </p>
        )}
      </div>
      {action}
    </div>
  )
}

export function Spinner({ className }: { className?: string }) {
  return (
    <Loader2 className={cn('h-4 w-4 animate-spin text-zinc-400', className)} />
  )
}

export function Loading({
  label = '加载中…',
  center = false,
}: {
  label?: string
  center?: boolean
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 py-10 text-sm text-zinc-500',
        center && 'justify-center',
      )}
    >
      <Spinner /> {label}
    </div>
  )
}

export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string
  hint?: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-300 py-12 text-center dark:border-zinc-700">
      <p className="text-sm font-medium text-zinc-600 dark:text-zinc-300">
        {title}
      </p>
      {hint && <p className="text-xs text-zinc-400">{hint}</p>}
      {action}
    </div>
  )
}
