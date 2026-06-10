import { Label } from '#/components/ui/label.tsx'
import { cn } from '#/lib/utils.ts'

/** 表单行：标签 + 控件竖向组合。控件请用 shadcn 的 Input/Textarea/Select/DatePicker 等。 */
export function Field({
  label,
  htmlFor,
  hint,
  className,
  children,
}: {
  label?: React.ReactNode
  htmlFor?: string
  hint?: React.ReactNode
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn('grid gap-1.5', className)}>
      {label && (
        <Label htmlFor={htmlFor} className="text-muted-foreground">
          {label}
        </Label>
      )}
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}
