import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { LayoutDashboard, Users, Target, ShieldCheck } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '#/components/ui/avatar.tsx'
import { cn } from '#/lib/utils.ts'
import { useDooTask } from '#/lib/dootask'
import type { DooTaskUser } from '#/lib/dootask'
import { api } from '#/lib/api'
import type { AuthUser } from '#/lib/types'
import { OptionsProvider } from '#/lib/use-options'

const NAV = [
  { to: '/', label: '仪表盘', icon: LayoutDashboard, exact: true, admin: false },
  { to: '/customers', label: '客户', icon: Users, exact: false, admin: false },
  { to: '/opportunities', label: '商机', icon: Target, exact: false, admin: false },
  { to: '/admin', label: '管理', icon: ShieldCheck, exact: false, admin: true },
] as const

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, status } = useDooTask()
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    // 握手完成（微前端 ready 或独立模式）后才带得上身份头，再查是否管理员。
    if (status !== 'ready' && status !== 'standalone') return
    let cancelled = false
    api<AuthUser>('/me')
      .then((me) => {
        if (!cancelled) setIsAdmin(me.isAdmin)
      })
      .catch(() => {
        /* 查询失败按非管理员处理 */
      })
    return () => {
      cancelled = true
    }
  }, [status])

  return (
    <OptionsProvider>
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-2 px-4 max-sm:gap-1.5 max-sm:px-3">
          <UserAvatar user={user} />
          <nav className="ml-1 flex items-center gap-1 max-sm:ml-0.5">
            {NAV.filter((n) => !n.admin || isAdmin).map(
              ({ to, label, icon: Icon, exact }) => (
                <Link
                  key={to}
                  to={to}
                  activeOptions={{ exact }}
                  className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition hover:bg-accent hover:text-foreground max-sm:px-2"
                  activeProps={{
                    className: cn('!bg-accent !text-foreground'),
                  }}
                >
                  {/* 手机端只显示文字，隐藏图标 */}
                  <Icon className="size-4 max-sm:hidden" />
                  {label}
                </Link>
              ),
            )}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
    </OptionsProvider>
  )
}

function UserAvatar({ user }: { user: DooTaskUser | null }) {
  const img =
    typeof (user as { userimg?: unknown } | null)?.userimg === 'string'
      ? ((user as { userimg?: string }).userimg as string)
      : undefined
  const nickname = user?.nickname || (user ? `用户#${user.userid}` : '')
  const initial = nickname ? nickname.slice(0, 1).toUpperCase() : 'U'
  return (
    <Avatar className="size-8">
      {img && <AvatarImage src={img} alt={nickname} />}
      <AvatarFallback className="bg-primary/10 text-xs text-primary">
        {initial}
      </AvatarFallback>
    </Avatar>
  )
}
