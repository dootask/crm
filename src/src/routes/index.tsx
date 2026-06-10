import { useEffect, useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import {
  Users,
  Target,
  Briefcase,
  Trophy,
  Wallet,
  AlarmClock,
  AlertTriangle,
  ChevronRight,
} from 'lucide-react'
import { api, ApiError } from '#/lib/api'
import { useDooTask } from '#/lib/dootask'
import { formatDate, formatMoney } from '#/lib/format'
import { Card, CardHeader, CardBody } from '#/components/ui/card'
import { Badge } from '#/components/ui/badge'
import { PageHeader, Loading, EmptyState } from '#/components/ui/misc'
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

interface FollowUpStats {
  customers: number
  open_opportunities: number
  won: number
  open_amount: number
  overdue_follow: number
}

interface FollowUpResponse {
  items: FollowUpItem[]
  overdue: number
  stats: FollowUpStats
}

export const Route = createFileRoute('/')({
  component: DashboardPage,
})

function DashboardPage() {
  const dt = useDooTask()
  const [data, setData] = useState<FollowUpResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    api<FollowUpResponse>('/my/follow-ups')
      .then((res) => {
        if (!cancelled) setData(res)
      })
      .catch((e) => {
        if (cancelled) return
        setError(e instanceof ApiError ? e.message : '加载失败，请稍后重试')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const greeting =
    dt.status === 'ready' && dt.user?.nickname
      ? `你好，${dt.user.nickname}`
      : '客户跟进概览'

  return (
    <div>
      <PageHeader title="仪表盘" description={greeting} />

      {loading ? (
        <Loading />
      ) : error ? (
        <Card>
          <CardBody>
            <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
              <AlertTriangle className="h-4 w-4" />
              {error}
            </div>
          </CardBody>
        </Card>
      ) : data ? (
        <div className="space-y-6">
          <StatsGrid stats={data.stats} />
          <FollowUpList items={data.items} overdue={data.overdue} />
        </div>
      ) : null}
    </div>
  )
}

function StatsGrid({ stats }: { stats: FollowUpStats }) {
  const cards: {
    label: string
    value: React.ReactNode
    icon: React.ReactNode
    danger?: boolean
  }[] = [
    {
      label: '客户数',
      value: stats.customers,
      icon: <Users className="h-5 w-5" />,
    },
    {
      label: '进行中商机',
      value: stats.open_opportunities,
      icon: <Briefcase className="h-5 w-5" />,
    },
    {
      label: '进行中金额',
      value: formatMoney(stats.open_amount),
      icon: <Wallet className="h-5 w-5" />,
    },
    {
      label: '赢单数',
      value: stats.won,
      icon: <Trophy className="h-5 w-5" />,
    },
    {
      label: '过期待跟进',
      value: stats.overdue_follow,
      icon: <AlarmClock className="h-5 w-5" />,
      danger: stats.overdue_follow > 0,
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {cards.map((c) => (
        <Card key={c.label}>
          <CardBody className="p-4">
            <div className="flex items-start justify-between">
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                {c.label}
              </p>
              <span
                className={cn(
                  'text-zinc-300 dark:text-zinc-600',
                  c.danger && 'text-red-400 dark:text-red-400',
                )}
              >
                {c.icon}
              </span>
            </div>
            <p
              className={cn(
                'mt-2 text-2xl font-bold tracking-tight',
                c.danger
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-zinc-900 dark:text-zinc-100',
              )}
            >
              {c.value}
            </p>
          </CardBody>
        </Card>
      ))}
    </div>
  )
}

function FollowUpList({
  items,
  overdue,
}: {
  items: FollowUpItem[]
  overdue: number
}) {
  return (
    <Card>
      <CardHeader title="待跟进" />
      {overdue > 0 && (
        <div className="flex items-center gap-2 border-b border-red-100 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-600 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-400">
          <AlertTriangle className="h-4 w-4 shrink-0" />有 {overdue} 项已过期未跟进
        </div>
      )}
      {items.length === 0 ? (
        <CardBody>
          <EmptyState
            title="暂无待跟进"
            hint="去客户或商机里记录下次跟进时间"
          />
        </CardBody>
      ) : (
        <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {items.map((item) => (
            <FollowUpRow key={`${item.kind}-${item.id}`} item={item} />
          ))}
        </ul>
      )}
    </Card>
  )
}

function FollowUpRow({ item }: { item: FollowUpItem }) {
  const isOverdue = item.overdue === 1
  const Icon = item.kind === 'customer' ? Users : Target
  const to = item.kind === 'customer' ? '/customers/$id' : '/opportunities/$id'

  return (
    <li className="relative">
      {isOverdue && (
        <span className="absolute inset-y-0 left-0 w-1 bg-red-500" aria-hidden />
      )}
      <Link
        to={to}
        params={{ id: String(item.id) }}
        className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
      >
        <span
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
            item.kind === 'customer'
              ? 'bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300'
              : 'bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300',
          )}
        >
          <Icon className="h-4 w-4" />
        </span>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
            {item.title}
          </p>
          {item.subtitle && (
            <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
              {item.subtitle}
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <span
            className={cn(
              'text-xs',
              isOverdue
                ? 'font-medium text-red-600 dark:text-red-400'
                : 'text-zinc-500 dark:text-zinc-400',
            )}
          >
            {formatDate(item.next_follow_at)}
          </span>
          {isOverdue && <Badge tone="red">已过期</Badge>}
          <ChevronRight className="h-4 w-4 text-zinc-300 dark:text-zinc-600" />
        </div>
      </Link>
    </li>
  )
}
