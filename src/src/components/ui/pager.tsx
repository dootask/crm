import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '#/components/ui/button.tsx'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select.tsx'

export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100]
export const DEFAULT_PAGE_SIZE = 50

// 生成页码序列，页数过多时用省略号折叠首尾之间的部分。
function pageItems(current: number, count: number): Array<number | 'gap'> {
  if (count <= 7) return Array.from({ length: count }, (_, i) => i + 1)
  const items: Array<number | 'gap'> = [1]
  const start = Math.max(2, current - 1)
  const end = Math.min(count - 1, current + 1)
  if (start > 2) items.push('gap')
  for (let p = start; p <= end; p++) items.push(p)
  if (end < count - 1) items.push('gap')
  items.push(count)
  return items
}

/** 列表分页器：每页条数下拉 + 上/下页 + 页码。total 为 0 时不渲染。 */
export function Pager({
  total,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: {
  total: number
  page: number
  pageSize: number
  onPageChange: (p: number) => void
  onPageSizeChange: (n: number) => void
}) {
  if (total === 0) return null
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const current = Math.min(page, pageCount)
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
      <span className="text-sm text-muted-foreground">共 {total} 条</span>
      <div className="flex flex-wrap items-center gap-1">
        <Select
          value={String(pageSize)}
          onValueChange={(v) => onPageSizeChange(Number(v))}
        >
          <SelectTrigger size="sm" className="mr-2 w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAGE_SIZE_OPTIONS.map((n) => (
              <SelectItem key={n} value={String(n)}>
                {n} 条/页
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          variant="outline"
          size="icon-sm"
          disabled={current <= 1}
          onClick={() => onPageChange(current - 1)}
          aria-label="上一页"
        >
          <ChevronLeft className="size-4" />
        </Button>

        {pageItems(current, pageCount).map((it, i) =>
          it === 'gap' ? (
            <span
              key={`gap-${i}`}
              className="px-1 text-sm text-muted-foreground"
            >
              …
            </span>
          ) : (
            <Button
              key={it}
              variant={it === current ? 'default' : 'outline'}
              size="icon-sm"
              onClick={() => onPageChange(it)}
            >
              {it}
            </Button>
          ),
        )}

        <Button
          variant="outline"
          size="icon-sm"
          disabled={current >= pageCount}
          onClick={() => onPageChange(current + 1)}
          aria-label="下一页"
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  )
}
