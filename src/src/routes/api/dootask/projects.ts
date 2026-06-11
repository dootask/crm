import { createFileRoute } from '@tanstack/react-router'
import { ok, resolveUser } from '#/lib/auth'
import { listProjectsWithColumns } from '#/lib/dootask-server'

// GET /apps/crm/api/dootask/projects
// 列出操作人可见的项目及其列表/列，供「创建关联任务」选择。
export const Route = createFileRoute('/api/dootask/projects')({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        resolveUser(request)
        const token = request.headers.get('x-user-token')
        return ok({ items: await listProjectsWithColumns(token) })
      },
    },
  },
})
