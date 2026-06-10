import { createFileRoute } from '@tanstack/react-router'
import { ok } from '#/lib/auth'
import { resolveUsers } from '#/lib/dootask-server'

// GET /apps/crm/api/users?ids=1,2,3 → 批量解析用户昵称（负责人展示用）
export const Route = createFileRoute('/api/users')({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const url = new URL(request.url)
        const ids = (url.searchParams.get('ids') || '')
          .split(',')
          .map((s) => parseInt(s.trim(), 10))
          .filter((n) => Number.isFinite(n))
        if (ids.length === 0) return ok([])
        const token = request.headers.get('x-user-token')
        const map = await resolveUsers(ids, token)
        return ok(Object.values(map))
      },
    },
  },
})
