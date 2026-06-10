import { createFileRoute } from '@tanstack/react-router'
import { resolveUser } from '#/lib/auth'

// GET /apps/crm/api/me → 当前用户身份与是否管理员
export const Route = createFileRoute('/api/me')({
  server: {
    handlers: {
      GET: ({ request }: { request: Request }) => {
        const user = resolveUser(request)
        return Response.json({ data: user })
      },
    },
  },
})
