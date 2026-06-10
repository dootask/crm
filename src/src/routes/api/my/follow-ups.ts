import { createFileRoute } from '@tanstack/react-router'
import { ok, resolveUser } from '#/lib/auth'
import { myFollowUps, stats } from '#/lib/repo/dashboard'

// GET /apps/crm/api/my/follow-ups → 我的待跟进列表 + 概览统计
export const Route = createFileRoute('/api/my/follow-ups')({
  server: {
    handlers: {
      GET: ({ request }: { request: Request }) => {
        const user = resolveUser(request)
        const follow = myFollowUps(user)
        return ok({ ...follow, stats: stats(user) })
      },
    },
  },
})
