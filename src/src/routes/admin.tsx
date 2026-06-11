import { useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import {
  Download,
  HardDriveDownload,
  RotateCcw,
  ShieldAlert,
  Trash2,
} from 'lucide-react'
import { api, ApiError, getAuthUserId } from '#/lib/api'
import { confirmDialog, downloadViaDooTask } from '#/lib/dootask'
import { messageError, messageSuccess } from '#/lib/message'
import { formatDateTime } from '#/lib/format'
import type { AuthUser } from '#/lib/types'
import { Button } from '#/components/ui/button.tsx'
import { Card, CardContent } from '#/components/ui/card.tsx'
import { EmptyState, Loading, PageHeader } from '#/components/ui/misc.tsx'

// 管理页：仅管理员可见，提供数据库备份与还原。
// 列表内容自渲染，不走 keep-alive（详情类普通路由）。
export const Route = createFileRoute('/admin')({ component: AdminPage })

interface BackupEntry {
  name: string
  size: number
  createdAt: string
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

function AdminPage() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)
  const [items, setItems] = useState<Array<BackupEntry>>([])
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState<string | null>(null) // 'backup' | 'restore:<name>' | 'delete:<name>'

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const me = await api<AuthUser>('/me')
        if (cancelled) return
        if (!me.isAdmin) {
          setIsAdmin(false)
          return
        }
        setIsAdmin(true)
        await reload()
      } catch {
        if (!cancelled) setIsAdmin(false)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function reload() {
    const res = await api<{ items: Array<BackupEntry> }>('/admin/backups')
    setItems(res.items)
  }

  async function handleBackup() {
    setWorking('backup')
    try {
      await api('/admin/backups', { method: 'POST' })
      await reload()
      messageSuccess('备份已生成')
    } catch (e) {
      messageError(e instanceof ApiError ? e.message : '备份失败')
    } finally {
      setWorking(null)
    }
  }

  async function handleDownload(name: string) {
    const uid = getAuthUserId()
    const base = `${window.location.origin}/apps/crm/api/admin/backups/${encodeURIComponent(name)}`
    const url = uid != null ? `${base}?uid=${uid}` : base
    await downloadViaDooTask(url)
  }

  async function handleRestore(name: string) {
    const okGo = await confirmDialog({
      title: '还原数据库',
      content: `将用「${name}」覆盖当前数据库，现有数据会被替换且不可恢复，确定继续？`,
      okText: '还原',
      cancelText: '取消',
    })
    if (!okGo) return
    setWorking(`restore:${name}`)
    try {
      await api(`/admin/backups/${encodeURIComponent(name)}`, { method: 'POST' })
      messageSuccess('已还原，列表数据将在切换页面后刷新')
    } catch (e) {
      messageError(e instanceof ApiError ? e.message : '还原失败')
    } finally {
      setWorking(null)
    }
  }

  async function handleDelete(name: string) {
    const okGo = await confirmDialog({
      title: '删除备份',
      content: `确定删除备份「${name}」？此操作不可恢复。`,
      okText: '删除',
      cancelText: '取消',
    })
    if (!okGo) return
    setWorking(`delete:${name}`)
    try {
      await api(`/admin/backups/${encodeURIComponent(name)}`, {
        method: 'DELETE',
      })
      await reload()
      messageSuccess('备份已删除')
    } catch (e) {
      messageError(e instanceof ApiError ? e.message : '删除失败')
    } finally {
      setWorking(null)
    }
  }

  if (isAdmin === false) {
    return (
      <div>
        <PageHeader title="管理" />
        <EmptyState
          title="无权限"
          hint="该功能仅管理员可用"
          action={<ShieldAlert className="mt-1 size-6 text-muted-foreground" />}
        />
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="数据库管理"
        description="备份与还原 CRM 数据库"
        action={
          <Button onClick={handleBackup} disabled={working === 'backup'}>
            <HardDriveDownload className="size-4" />
            {working === 'backup' ? '备份中…' : '立即备份'}
          </Button>
        }
      />

      {loading ? (
        <Card className="py-0">
          <CardContent className="p-0">
            <Loading center />
          </CardContent>
        </Card>
      ) : items.length === 0 ? (
        <EmptyState title="暂无备份" hint="点击右上角「立即备份」生成第一份备份" />
      ) : (
        <Card className="py-0">
          <CardContent className="p-0">
            <ul className="divide-y">
              {items.map((b) => {
                const busy = working === `restore:${b.name}` || working === `delete:${b.name}`
                return (
                  <li
                    key={b.name}
                    className="flex flex-wrap items-center gap-3 px-4 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-mono text-sm font-medium">
                        {b.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateTime(b.createdAt)} · {formatBytes(b.size)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDownload(b.name)}
                      >
                        <Download className="size-4" />
                        下载
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRestore(b.name)}
                        disabled={busy}
                      >
                        <RotateCcw className="size-4" />
                        还原
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleDelete(b.name)}
                        disabled={busy}
                      >
                        <Trash2 className="size-4" />
                        删除
                      </Button>
                    </div>
                  </li>
                )
              })}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
