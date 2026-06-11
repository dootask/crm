export function formatDate(s: string | null | undefined): string {
  if (!s) return '—'
  // 统一只取日期部分 YYYY-MM-DD
  return s.slice(0, 10)
}

export function formatDateTime(s: string | null | undefined): string {
  if (!s) return '—'
  return s.replace('T', ' ').slice(0, 16)
}

export function formatMoney(n: number | null | undefined): string {
  if (n == null) return '—'
  return '¥' + n.toLocaleString('zh-CN')
}

/**
 * 跟进正文的纯文本摘要：跟进内容现在可能是 HTML（富文本）。
 * 列表/卡片里的「最近跟进」一行需要纯文本，这里去标签、压空白。
 * 仅做展示用途，不作安全边界（真正的消毒在服务端保存时完成）。
 */
export function plainExcerpt(
  content: string | null | undefined,
  max = 60,
): string {
  if (!content) return ''
  const text = content
    .replace(/<[^>]*>/g, ' ') // 去标签
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()
  return text.length > max ? text.slice(0, max) + '…' : text
}

/** 下次跟进是否已过期（与今天比较，按本地日期）。 */
export function isOverdue(date: string | null | undefined): boolean {
  if (!date) return false
  const today = new Date()
  const t = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  return date.slice(0, 10) < t
}
