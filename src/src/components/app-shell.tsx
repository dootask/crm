import { Link } from '@tanstack/react-router'
import { LayoutDashboard, Users, Target } from 'lucide-react'
import { cn } from '#/lib/utils'
import { useDooTask } from '#/lib/dootask'

const NAV = [
  { to: '/', label: '仪表盘', icon: LayoutDashboard, exact: true },
  { to: '/customers', label: '客户', icon: Users, exact: false },
  { to: '/opportunities', label: '商机', icon: Target, exact: false },
] as const

export function AppShell({ children }: { children: React.ReactNode }) {
  const dootask = useDooTask()
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white/80 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/80">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-1 px-4">
          <span className="mr-3 font-bold tracking-tight text-blue-600">
            CRM
          </span>
          <nav className="flex items-center gap-1">
            {NAV.map(({ to, label, icon: Icon, exact }) => (
              <Link
                key={to}
                to={to}
                activeOptions={{ exact }}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                activeProps={{
                  className: cn(
                    '!bg-blue-50 !text-blue-700 dark:!bg-blue-500/15 dark:!text-blue-300',
                  ),
                }}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto text-xs text-zinc-500 dark:text-zinc-400">
            <UserChip dootask={dootask} />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  )
}

function UserChip({ dootask }: { dootask: ReturnType<typeof useDooTask> }) {
  if (dootask.status === 'ready' && dootask.user) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
        {dootask.user.nickname || `用户#${dootask.user.userid}`}
      </span>
    )
  }
  if (dootask.status === 'standalone') {
    return <span className="text-amber-600">独立模式</span>
  }
  if (dootask.status === 'loading') {
    return <span>连接中…</span>
  }
  return <span className="text-red-600">未连接</span>
}
