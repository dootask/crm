import {
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
} from 'react'
import { Send } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card.tsx'
import { Textarea } from '#/components/ui/textarea.tsx'
import { Button } from '#/components/ui/button.tsx'
import { DatePicker } from '#/components/ui/date-picker.tsx'
import { ToneBadge } from '#/components/ui/badge.tsx'
import { api, ApiError } from '#/lib/api'
import { formatDate, formatDateTime, isOverdue } from '#/lib/format'
import type { FollowUp } from '#/lib/types'

export interface FollowUpsHandle {
  focusAdd: () => void
}

/**
 * 跟进记录区（时间线 + 底部内联添加表单）。放在详情页最底部。
 * 详情页右上角「添加跟进」按钮可通过 ref.focusAdd() 滚动并聚焦到底部输入框。
 */
export const FollowUpsSection = forwardRef<
  FollowUpsHandle,
  {
    customerId: number
    opportunityId?: number
    followUps: Array<FollowUp>
    nameOf: (id: number) => string
    onChanged: () => void
  }
>(function FollowUpsSection(
  { customerId, opportunityId, followUps, nameOf, onChanged },
  ref,
) {
  const [content, setContent] = useState('')
  const [nextAt, setNextAt] = useState<string | undefined>(undefined)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const taRef = useRef<HTMLTextAreaElement>(null)

  useImperativeHandle(ref, () => ({
    focusAdd() {
      taRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      taRef.current?.focus()
    },
  }))

  async function submit() {
    if (!content.trim() || busy) return
    setBusy(true)
    setError(null)
    try {
      await api('/follow-ups', {
        method: 'POST',
        json: {
          customer_id: customerId,
          opportunity_id: opportunityId,
          content: content.trim(),
          next_follow_at: nextAt,
        },
      })
      setContent('')
      setNextAt(undefined)
      onChanged()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '添加失败')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card id="follow-ups">
      <CardHeader>
        <CardTitle>跟进记录</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {followUps.length === 0 ? (
          <p className="text-sm text-muted-foreground">暂无跟进记录</p>
        ) : (
          <ol className="space-y-4">
            {followUps.map((f) => (
              <li key={f.id} className="relative pl-5">
                <span className="absolute top-1.5 left-0 size-2 rounded-full bg-primary/60" />
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {nameOf(f.follow_by)}
                  </span>
                  <span>{formatDateTime(f.created_at)}</span>
                  {f.next_follow_at && (
                    <ToneBadge tone={isOverdue(f.next_follow_at) ? 'red' : 'amber'}>
                      下次：{formatDate(f.next_follow_at)}
                    </ToneBadge>
                  )}
                </div>
                <p className="mt-1 text-sm whitespace-pre-wrap">{f.content}</p>
              </li>
            ))}
          </ol>
        )}

        {/* 底部内联添加表单 */}
        <div className="space-y-2 border-t pt-4">
          <Textarea
            ref={taRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="记录本次沟通内容…"
            className="min-h-20"
          />
          <div className="flex flex-wrap items-center gap-2">
            <div className="w-44">
              <DatePicker
                value={nextAt}
                onChange={setNextAt}
                placeholder="下次跟进时间"
              />
            </div>
            <Button onClick={submit} disabled={busy || !content.trim()}>
              <Send className="size-4" />
              {busy ? '提交中…' : '添加跟进'}
            </Button>
            {error && <span className="text-sm text-destructive">{error}</span>}
          </div>
        </div>
      </CardContent>
    </Card>
  )
})
