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

/** 下次跟进是否已过期（与今天比较，按本地日期）。 */
export function isOverdue(date: string | null | undefined): boolean {
  if (!date) return false
  const today = new Date()
  const t = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  return date.slice(0, 10) < t
}
