import { Link } from '@tanstack/react-router'
import { LayoutDashboard, Users, Target } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '#/components/ui/avatar.tsx'
import { cn } from '#/lib/utils.ts'
import { useDooTask } from '#/lib/dootask'

const NAV = [
  { to: '/', label: '仪表盘', icon: LayoutDashboard, exact: true },
  { to: '/customers', label: '客户', icon: Users, exact: false },
  { to: '/opportunities', label: '商机', icon: Target, exact: false },
] as const

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-2 px-4">
          <UserAvatar />
          <nav className="ml-1 flex items-center gap-1">
            {NAV.map(({ to, label, icon: Icon, exact }) => (
              <Link
                key={to}
                to={to}
                activeOptions={{ exact }}
                className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition hover:bg-accent hover:text-foreground"
                activeProps={{
                  className: cn('!bg-accent !text-foreground'),
                }}
              >
                <Icon className="size-4" />
                {label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  )
}

function UserAvatar() {
  const { user } = useDooTask()
  const img =
    typeof (user as { userimg?: unknown })?.userimg === 'string'
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
