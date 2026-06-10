import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import {
  AlarmClock,
  Briefcase,
  Target,
  Trophy,
  Users,
  Wallet,
} from 'lucide-react'
import { useActivate } from '#/components/keep-alive'
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card.tsx'
import { ToneBadge } from '#/components/ui/badge.tsx'
import { EmptyState, Loading, PageHeader } from '#/components/ui/misc.tsx'
import { ApiError, api } from '#/lib/api'
import { useDooTask } from '#/lib/dootask'
import { formatDate, formatMoney } from '#/lib/format'
import { cn } from '#/lib/utils'

interface FollowUpItem {
  kind: 'customer' | 'opportunity'
  id: number
  title: string
  subtitle: string | null
  owner_id: number
  status: string
  next_follow_at: string
  overdue: number
  customer_id: number
}

interface DashboardStats {
  customers: number
  open_opportunities: number
  won: number
  open_amount: number
  overdue_follow: number
}

interface FollowUpsResponse {
  items: Array<FollowUpItem>
  overdue: number
  stats: DashboardStats
}

function StatCard({
  label,
  value,
  icon: Icon,
  emphasize = false,
}: {
  label: string
  value: React.ReactNode
  icon: React.ComponentType<{ className?: string }>
  emphasize?: boolean
}) {
  return (
    <Card className="py-0">
      <CardContent className="flex items-start justify-between gap-2 py-4">
        <div className="min-w-0">
          <p className="truncate text-xs text-muted-foreground">{label}</p>
          <p
            className={cn(
              'mt-1 text-2xl font-bold tracking-tight',
              emphasize && 'text-destructive',
            )}
          >
            {value}
          </p>
        </div>
        <Icon
          className={cn(
            'size-5 shrink-0 text-muted-foreground',
            emphasize && 'text-destructive',
          )}
        />
      </CardContent>
    </Card>
  )
}

export function DashboardView({ active }: { active: boolean }) {
  const dootask = useDooTask()
  const [data, setData] = useState<FollowUpsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function reload() {
    setLoading(true)
    setError(null)
    try {
      const res = await api<FollowUpsResponse>('/my/follow-ups')
      setData(res)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useActivate(active, reload)

  const nickname =
    dootask.status === 'ready' ? dootask.user?.nickname : undefined
  const greeting = nickname ? `你好，${nickname}` : '客户跟进概览'

  const stats = data?.stats
  const items = data?.items ?? []

  return (
    <div>
      <PageHeader title="仪表盘" description={greeting} />

      {error ? (
        <Card>
          <CardContent className="py-6 text-sm text-destructive">
            {error}
          </CardContent>
        </Card>
      ) : loading && !data ? (
        <Loading />
      ) : (
        <div className="space-y-5">
          {stats && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              <StatCard label="客户数" value={stats.customers} icon={Users} />
              <StatCard
                label="进行中商机"
                value={stats.open_opportunities}
                icon={Briefcase}
              />
              <StatCard
                label="进行中金额"
                value={formatMoney(stats.open_amount)}
                icon={Wallet}
              />
              <StatCard label="赢单数" value={stats.won} icon={Trophy} />
              <StatCard
                label="过期待跟进"
                value={stats.overdue_follow}
                icon={AlarmClock}
                emphasize={stats.overdue_follow > 0}
              />
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle>待跟进</CardTitle>
            </CardHeader>
            <CardContent>
              {data && data.overdue > 0 && (
                <p className="mb-3 text-sm font-medium text-destructive">
                  有 {data.overdue} 项已过期未跟进
                </p>
              )}
              {items.length === 0 ? (
                <EmptyState
                  title="暂无待跟进"
                  hint="去客户或商机里记录下次跟进时间"
                />
              ) : (
                <ul className="divide-y">
                  {items.map((item) => {
                    const Icon =
                      item.kind === 'customer' ? Users : Target
                    const overdue = item.overdue === 1
                    return (
                      <li key={`${item.kind}-${item.id}`}>
                        <Link
                          to={
                            item.kind === 'customer'
                              ? '/customers/$id'
                              : '/opportunities/$id'
                          }
                          params={{ id: String(item.id) }}
                          className={cn(
                            'flex items-center gap-3 py-3 pl-3 transition-colors hover:bg-accent/50',
                            overdue && 'border-l-2 border-destructive',
                          )}
                        >
                          <Icon className="size-4 shrink-0 text-muted-foreground" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">
                              {item.title}
                            </p>
                            {item.subtitle && (
                              <p className="truncate text-xs text-muted-foreground">
                                {item.subtitle}
                              </p>
                            )}
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <span
                              className={cn(
                                'text-xs',
                                overdue
                                  ? 'text-destructive'
                                  : 'text-muted-foreground',
                              )}
                            >
                              {formatDate(item.next_follow_at)}
                            </span>
                            {overdue && (
                              <ToneBadge tone="red">已过期</ToneBadge>
                            )}
                          </div>
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
