import { createFileRoute } from '@tanstack/react-router'
import { forbidden, ok, resolveUser } from '#/lib/auth'
import { runFollowReminder } from '#/lib/reminder-job'

// POST /apps/crm/api/admin/run-reminder
// 手动触发跟进到期提醒（仅管理员）。用于验证，也可供外部 cron 调用兜底。
export const Route = createFileRoute('/api/admin/run-reminder')({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const user = resolveUser(request)
        if (!user.isAdmin) return forbidden()
        return ok(await runFollowReminder())
      },
    },
  },
})
