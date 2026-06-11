import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react'
import { Send } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card.tsx'
import { RichTextEditor } from '#/components/ui/rich-text-editor.tsx'
import type { RichTextEditorHandle } from '#/components/ui/rich-text-editor.tsx'
import { RichTextContent } from '#/components/ui/rich-text-content.tsx'
import { Button } from '#/components/ui/button.tsx'
import { DatePicker } from '#/components/ui/date-picker.tsx'
import { ToneBadge } from '#/components/ui/badge.tsx'
import { Pager } from '#/components/ui/pager.tsx'
import { api, ApiError } from '#/lib/api'
import { formatDate, formatDateTime, isOverdue } from '#/lib/format'
import type { Attachment, FollowUp } from '#/lib/types'

/** 正文是否有可提交内容：有文字、含图片、或带附件。 */
function hasSubmittable(html: string, attachments: Array<Attachment>): boolean {
  if (attachments.length > 0) return true
  if (/<img\b/i.test(html)) return true
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim().length > 0
}

export interface FollowUpsHandle {
  focusAdd: () => void
}

// 详情页跟进记录每页最多显示的条数。
const PER_PAGE = 20

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
  const [attachments, setAttachments] = useState<Array<Attachment>>([])
  const [nextAt, setNextAt] = useState<string | undefined>(undefined)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const editorRef = useRef<RichTextEditorHandle>(null)

  // 切换到另一条客户/商机时回到第一页。
  useEffect(() => {
    setPage(1)
  }, [customerId, opportunityId])

  const pageCount = Math.max(1, Math.ceil(followUps.length / PER_PAGE))
  const current = Math.min(page, pageCount)
  const visible = followUps.slice((current - 1) * PER_PAGE, current * PER_PAGE)

  useImperativeHandle(ref, () => ({
    focusAdd() {
      editorRef.current?.focus()
    },
  }))

  const canSubmit = hasSubmittable(content, attachments) && !busy

  async function submit() {
    if (!canSubmit) return
    setBusy(true)
    setError(null)
    try {
      await api('/follow-ups', {
        method: 'POST',
        json: {
          customer_id: customerId,
          opportunity_id: opportunityId,
          content,
          attachments,
          next_follow_at: nextAt,
        },
      })
      setContent('')
      setAttachments([])
      editorRef.current?.clear()
      setNextAt(undefined)
      setPage(1)
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
        {/* 顶部内联添加表单（最新记录在上，表单也放最上） */}
        <div className="space-y-2 border-b pb-4">
          <RichTextEditor
            ref={editorRef}
            onContentChange={setContent}
            attachments={attachments}
            onAttachmentsChange={setAttachments}
            placeholder="记录本次沟通内容…"
            disabled={busy}
          />
          <div className="flex flex-wrap items-center gap-2">
            <div className="w-44">
              <DatePicker
                value={nextAt}
                onChange={setNextAt}
                placeholder="下次跟进时间"
              />
            </div>
            <Button onClick={submit} disabled={!canSubmit}>
              <Send className="size-4" />
              {busy ? '提交中…' : '添加跟进'}
            </Button>
            {error && <span className="text-sm text-destructive">{error}</span>}
          </div>
        </div>

        {followUps.length === 0 ? (
          <p className="text-sm text-muted-foreground">暂无跟进记录</p>
        ) : (
          <ol className="space-y-4">
            {visible.map((f) => (
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
                <RichTextContent
                  className="mt-1"
                  content={f.content}
                  attachments={f.attachments}
                />
              </li>
            ))}
          </ol>
        )}

        {followUps.length > PER_PAGE && (
          <Pager
            total={followUps.length}
            page={current}
            pageSize={PER_PAGE}
            onPageChange={setPage}
            hidePageSize
          />
        )}
      </CardContent>
    </Card>
  )
})
