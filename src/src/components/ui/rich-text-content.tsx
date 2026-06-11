import { AttachmentList } from '#/components/ui/attachment-list.tsx'
import { cn } from '#/lib/utils.ts'
import { previewImage } from '#/lib/dootask'
import type { Attachment } from '#/lib/types'

/**
 * 跟进正文 + 附件的只读渲染。
 * 正文以 `<` 开头视为富文本 HTML（保存时已服务端消毒，可直接渲染）；
 * 否则按旧纯文本走 whitespace-pre-wrap（兼容历史记录与自动变更记录）。
 * 点击正文里的图片调用主程序 previewImage 大图预览（同一条记录的图片成组）。
 */
export function RichTextContent({
  content,
  attachments,
  className,
}: {
  content: string
  attachments?: Array<Attachment>
  className?: string
}) {
  const isHtml = content.trimStart().startsWith('<')

  function onClick(e: React.MouseEvent<HTMLDivElement>) {
    const target = e.target as HTMLElement
    if (target.tagName !== 'IMG') return
    const imgs = Array.from(e.currentTarget.querySelectorAll('img'))
    const list = imgs.map((im) => ({
      src: im.currentSrc || im.src, // 解析为绝对 URL，供主程序预览
      width: im.naturalWidth || undefined,
      height: im.naturalHeight || undefined,
    }))
    const index = Math.max(0, imgs.indexOf(target as HTMLImageElement))
    void previewImage(list, index)
  }

  return (
    <div className={className}>
      {isHtml ? (
        <div
          className="crm-rich crm-rich-view text-sm"
          onClick={onClick}
          // 内容已在服务端按白名单消毒（见 lib/sanitize.ts）
          dangerouslySetInnerHTML={{ __html: content }}
        />
      ) : (
        <p className="text-sm whitespace-pre-wrap">{content}</p>
      )}
      {attachments && attachments.length > 0 && (
        <AttachmentList items={attachments} className={cn('mt-2')} />
      )}
    </div>
  )
}
