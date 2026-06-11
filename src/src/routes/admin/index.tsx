import { createFileRoute, Link } from '@tanstack/react-router'
import { Bell, ChevronRight, Database, Target, Users } from 'lucide-react'
import { AdminGate } from '#/components/admin/admin-gate.tsx'
import { Card } from '#/components/ui/card.tsx'
import { PageHeader } from '#/components/ui/misc'

// /admin 入口页：仅提供三个功能入口，不在本页直接管理。
export const Route = createFileRoute('/admin/')({ component: AdminIndexPage })

const ENTRIES = [
  {
    to: '/admin/backup',
    icon: Database,
    title: '数据库备份',
    desc: '备份、还原与下载 CRM 数据库',
  },
  {
    to: '/admin/customer-status',
    icon: Users,
    title: '客户状态',
    desc: '维护客户状态选项（名称 / 颜色 / 排序 / 停用）',
  },
  {
    to: '/admin/opportunity-stage',
    icon: Target,
    title: '商机阶段',
    desc: '维护商机阶段选项（名称 / 颜色 / 排序 / 停用）',
  },
  {
    to: '/admin/settings',
    icon: Bell,
    title: '动态推送',
    desc: '配置 CRM 机器人，把变更与到期提醒推送到关联任务',
  },
] as const

function AdminIndexPage() {
  return (
    <div>
      <PageHeader title="管理" description="CRM 数据与配置管理" />
      <AdminGate>
        <div className="grid gap-3">
          {ENTRIES.map(({ to, icon: Icon, title, desc }) => (
            <Link key={to} to={to}>
              <Card className="flex flex-row items-center gap-4 px-4 py-4 transition hover:bg-accent/50">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{title}</p>
                  <p className="text-sm text-muted-foreground">{desc}</p>
                </div>
                <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
              </Card>
            </Link>
          ))}
        </div>
      </AdminGate>
    </div>
  )
}
