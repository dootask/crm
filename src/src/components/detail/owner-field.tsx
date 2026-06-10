import { useState } from 'react'
import { Check, Pencil, X } from 'lucide-react'
import { Button } from '#/components/ui/button.tsx'
import { Input } from '#/components/ui/input.tsx'
import { pickUsers } from '#/lib/dootask'

/**
 * 内联负责人展示 + 修改。点「修改」图标弹出 DooTask 会员选择器：
 * - 选好确定 → onChange(新负责人)
 * - 关闭/取消 → 不做任何修改
 * - 独立模式（非 DooTask 内）→ 就地切换为数字输入框手动填写
 */
export function OwnerInlineEdit({
  ownerId,
  nameOf,
  onChange,
  disabled,
}: {
  ownerId: number
  nameOf: (id: number) => string
  onChange: (ownerId: number) => void | Promise<void>
  disabled?: boolean
}) {
  const [manual, setManual] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function pick() {
    const res = await pickUsers({ value: [ownerId], multiple: false })
    if (res.status === 'picked') {
      setBusy(true)
      try {
        await onChange(res.ids[0])
      } finally {
        setBusy(false)
      }
    } else if (res.status === 'standalone') {
      setManual(String(ownerId))
    }
    // cancelled：什么都不做
  }

  async function confirmManual() {
    const n = Number((manual ?? '').trim())
    if (Number.isFinite(n) && n > 0) {
      setBusy(true)
      try {
        await onChange(n)
      } finally {
        setBusy(false)
      }
    }
    setManual(null)
  }

  if (manual !== null) {
    return (
      <span className="inline-flex items-center gap-1">
        <Input
          type="number"
          value={manual}
          autoFocus
          onChange={(e) => setManual(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && confirmManual()}
          className="h-7 w-24"
        />
        <Button size="icon-sm" variant="ghost" onClick={confirmManual} aria-label="确定">
          <Check className="size-4" />
        </Button>
        <Button size="icon-sm" variant="ghost" onClick={() => setManual(null)} aria-label="取消">
          <X className="size-4" />
        </Button>
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-1">
      <span>{nameOf(ownerId)}</span>
      <Button
        size="icon-sm"
        variant="ghost"
        className="text-muted-foreground"
        disabled={disabled || busy}
        onClick={pick}
        aria-label="修改负责人"
      >
        <Pencil className="size-3.5" />
      </Button>
    </span>
  )
}
