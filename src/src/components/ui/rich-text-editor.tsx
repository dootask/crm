import {
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
} from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import type { Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import {
  Bold,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  Loader2,
  Paperclip,
} from 'lucide-react'
import { cn } from '#/lib/utils.ts'
import { api, ApiError } from '#/lib/api'
import { AttachmentList } from '#/components/ui/attachment-list.tsx'
import type { Attachment, UploadResult } from '#/lib/types'

// 给内置 Image 扩展加一个 transparent 属性，序列化为 data-transparent，
// 让透明背景图在渲染端能套棋盘格（标记由后端上传时按 stats.isOpaque 判定）。
const ImageNode = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      transparent: {
        default: false,
        parseHTML: (el: HTMLElement) =>
          el.getAttribute('data-transparent') === 'true',
        renderHTML: (attrs: { transparent?: boolean }) =>
          attrs.transparent ? { 'data-transparent': 'true' } : {},
      },
    }
  },
})

export interface RichTextEditorHandle {
  /** 滚动到编辑器并聚焦。 */
  focus: () => void
  /** 清空正文（提交成功后调用）。 */
  clear: () => void
}

/** 上传单个文件，返回附件元信息（含图片是否透明）。 */
async function uploadFile(file: File): Promise<UploadResult> {
  const fd = new FormData()
  fd.append('file', file)
  // api() 不会给 FormData 设 content-type，浏览器自带 multipart 边界。
  return api<UploadResult>('/uploads', { method: 'POST', body: fd })
}

/** 在编辑器当前位置插入一张内联图片（带透明标记）。 */
function insertImage(ed: Editor, a: UploadResult) {
  ed.chain()
    .focus()
    .insertContent({
      type: 'image',
      attrs: { src: a.url, alt: a.name, transparent: a.transparent },
    })
    .run()
}

/** 从剪贴板/拖拽数据里取出文件（优先 files，回退 items）。 */
function extractFiles(dt: DataTransfer | null): Array<File> {
  if (!dt) return []
  if (dt.files.length) return Array.from(dt.files)
  const out: Array<File> = []
  for (const it of Array.from(dt.items)) {
    if (it.kind === 'file') {
      const f = it.getAsFile()
      if (f) out.push(f)
    }
  }
  return out
}

function ToolbarButton({
  active,
  onClick,
  title,
  disabled,
  children,
}: {
  active?: boolean
  onClick: () => void
  title: string
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4',
        active && 'bg-accent text-accent-foreground',
      )}
    >
      {children}
    </button>
  )
}

/**
 * 基于 Tiptap 的 headless 富文本编辑器。支持：段落/换行、加粗、斜体、
 * 有序/无序列表、链接、内联图片、以及独立的附件列表。
 * 非受控：正文初始为空，变更通过 onContentChange 上报；清空走 ref.clear()。
 */
export const RichTextEditor = forwardRef<
  RichTextEditorHandle,
  {
    onContentChange: (html: string) => void
    attachments: Array<Attachment>
    onAttachmentsChange: (next: Array<Attachment>) => void
    placeholder?: string
    disabled?: boolean
  }
>(function RichTextEditor(
  { onContentChange, attachments, onAttachmentsChange, placeholder, disabled },
  ref,
) {
  const [empty, setEmpty] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const imgInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // handlePaste 在 useEditor 配置里一次性创建、闭包会过期，故通过 liveRef 读取最新值。
  const liveRef = useRef<{
    editor: Editor | null
    attachments: Array<Attachment>
    onAttachmentsChange: (next: Array<Attachment>) => void
  }>({ editor: null, attachments, onAttachmentsChange })
  liveRef.current.attachments = attachments
  liveRef.current.onAttachmentsChange = onAttachmentsChange

  // 粘贴进来的文件：图片内联插入，其余进附件列表。
  async function processPastedFiles(files: Array<File>) {
    const ed = liveRef.current.editor
    if (!ed || files.length === 0) return
    setUploading(true)
    setUploadError(null)
    try {
      const added: Array<Attachment> = []
      for (const f of files) {
        const a = await uploadFile(f)
        if (f.type.startsWith('image/')) {
          insertImage(ed, a)
        } else {
          added.push(a)
        }
      }
      if (added.length) {
        liveRef.current.onAttachmentsChange([
          ...liveRef.current.attachments,
          ...added,
        ])
      }
    } catch (e) {
      setUploadError(e instanceof ApiError ? e.message : '上传失败')
    } finally {
      setUploading(false)
    }
  }

  const editor = useEditor({
    immediatelyRender: false, // SSR 安全：挂载后再渲染，避免 hydration 不一致
    editable: !disabled,
    extensions: [
      StarterKit.configure({
        link: {
          openOnClick: false,
          HTMLAttributes: {
            rel: 'noopener noreferrer nofollow',
            target: '_blank',
          },
        },
      }),
      ImageNode.configure({ inline: false }),
    ],
    editorProps: {
      attributes: { class: 'crm-rich focus:outline-none' },
      // 粘贴含文件时拦截并上传；纯文本/HTML 交给 Tiptap 默认处理。
      handlePaste: (_view, event) => {
        const files = extractFiles(event.clipboardData)
        if (files.length === 0) return false
        event.preventDefault()
        void processPastedFiles(files)
        return true
      },
    },
    onCreate: ({ editor: ed }) => {
      liveRef.current.editor = ed
    },
    onUpdate: ({ editor: ed }) => {
      setEmpty(ed.isEmpty)
      onContentChange(ed.getHTML())
    },
  })

  useImperativeHandle(ref, () => ({
    focus() {
      const el = wrapperRef.current
      if (el) {
        // 只滚插件自身内层窗口，避免连带父框架位移（与原 focusAdd 行为一致）。
        // 顶部多留些边距，别顶到最上沿（避免滚过头）。
        const top = el.getBoundingClientRect().top + window.scrollY - 96
        window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' })
      }
      editor?.chain().focus().run()
    },
    clear() {
      editor?.commands.clearContent(true)
      setEmpty(true)
    },
  }))

  function toggleLink() {
    if (!editor) return
    if (editor.isActive('link')) {
      editor.chain().focus().unsetLink().run()
      return
    }
    const prev = editor.getAttributes('link').href as string | undefined
    const url = window.prompt('链接地址', prev || 'https://')
    if (url === null) return
    if (url.trim() === '') {
      editor.chain().focus().unsetLink().run()
      return
    }
    editor
      .chain()
      .focus()
      .extendMarkRange('link')
      .setLink({ href: url.trim() })
      .run()
  }

  async function withUpload<T>(fn: () => Promise<T>): Promise<T | undefined> {
    setUploading(true)
    setUploadError(null)
    try {
      return await fn()
    } catch (e) {
      setUploadError(e instanceof ApiError ? e.message : '上传失败')
      return undefined
    } finally {
      setUploading(false)
    }
  }

  async function onPickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !editor) return
    await withUpload(async () => {
      const a = await uploadFile(file)
      insertImage(editor, a)
    })
  }

  async function onPickFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (!files.length) return
    await withUpload(async () => {
      const added: Array<Attachment> = []
      for (const f of files) added.push(await uploadFile(f))
      onAttachmentsChange([...attachments, ...added])
    })
  }

  const busy = disabled || uploading

  return (
    <div ref={wrapperRef} className="rounded-md border bg-transparent shadow-xs">
      {/* 工具栏 */}
      <div className="flex flex-wrap items-center gap-0.5 border-b px-1.5 py-1">
        <ToolbarButton
          title="加粗"
          active={editor?.isActive('bold')}
          disabled={busy}
          onClick={() => editor?.chain().focus().toggleBold().run()}
        >
          <Bold />
        </ToolbarButton>
        <ToolbarButton
          title="斜体"
          active={editor?.isActive('italic')}
          disabled={busy}
          onClick={() => editor?.chain().focus().toggleItalic().run()}
        >
          <Italic />
        </ToolbarButton>
        <span className="mx-0.5 h-4 w-px bg-border" />
        <ToolbarButton
          title="无序列表"
          active={editor?.isActive('bulletList')}
          disabled={busy}
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
        >
          <List />
        </ToolbarButton>
        <ToolbarButton
          title="有序列表"
          active={editor?.isActive('orderedList')}
          disabled={busy}
          onClick={() => editor?.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered />
        </ToolbarButton>
        <span className="mx-0.5 h-4 w-px bg-border" />
        <ToolbarButton
          title="链接"
          active={editor?.isActive('link')}
          disabled={busy}
          onClick={toggleLink}
        >
          <Link2 />
        </ToolbarButton>
        <ToolbarButton
          title="插入图片"
          disabled={busy}
          onClick={() => imgInputRef.current?.click()}
        >
          <ImagePlus />
        </ToolbarButton>
        <ToolbarButton
          title="添加附件"
          disabled={busy}
          onClick={() => fileInputRef.current?.click()}
        >
          <Paperclip />
        </ToolbarButton>
        {uploading && (
          <span className="ml-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Loader2 className="size-3 animate-spin" />
            上传中…
          </span>
        )}
      </div>

      {/* 编辑区（含空状态占位） */}
      <div className="relative px-3 py-2">
        {empty && placeholder && (
          <span className="pointer-events-none absolute left-3 top-2 text-sm text-muted-foreground">
            {placeholder}
          </span>
        )}
        <EditorContent editor={editor} />
      </div>

      {/* 附件 chips */}
      {attachments.length > 0 && (
        <div className="border-t px-3 py-2">
          <AttachmentList items={attachments} onRemove={(i) =>
            onAttachmentsChange(attachments.filter((_, idx) => idx !== i))
          } />
        </div>
      )}

      {uploadError && (
        <p className="px-3 pb-2 text-xs text-destructive">{uploadError}</p>
      )}

      <input
        ref={imgInputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={onPickImage}
      />
      <input
        ref={fileInputRef}
        type="file"
        multiple
        hidden
        onChange={onPickFiles}
      />
    </div>
  )
})
