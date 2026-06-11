import { useEffect, useState } from 'react'
import { ShieldAlert } from 'lucide-react'
import { api } from '#/lib/api'
import type { AuthUser } from '#/lib/types'
import { EmptyState, Loading } from '#/components/ui/misc'

/**
 * 管理功能页统一鉴权壳：查 /me，仅管理员渲染 children，否则显示「无权限」。
 * 与 lib/auth 的轻量模型一致（CRM_ADMIN_USER_IDS 为空时所有人均为管理员）。
 */
export function AdminGate({ children }: { children: React.ReactNode }) {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)

  useEffect(() => {
    let cancelled = false
    api<AuthUser>('/me')
      .then((me) => {
        if (!cancelled) setIsAdmin(me.isAdmin)
      })
      .catch(() => {
        if (!cancelled) setIsAdmin(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (isAdmin === null) return <Loading />
  if (!isAdmin) {
    return (
      <EmptyState
        title="无权限"
        hint="该功能仅管理员可用"
        action={<ShieldAlert className="mt-1 size-6 text-muted-foreground" />}
      />
    )
  }
  return <>{children}</>
}
