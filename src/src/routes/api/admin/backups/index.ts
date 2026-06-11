import { createFileRoute } from '@tanstack/react-router'
import { forbidden, ok, resolveUser } from '#/lib/auth'
import { createBackup, listBackups } from '#/lib/backup'

// GET  /apps/crm/api/admin/backups  备份列表（仅管理员）
// POST /apps/crm/api/admin/backups  立即生成一份备份（仅管理员）
export const Route = createFileRoute('/api/admin/backups/')({
  server: {
    handlers: {
      GET: ({ request }: { request: Request }) => {
        const user = resolveUser(request)
        if (!user.isAdmin) return forbidden()
        return ok({ items: listBackups() })
      },

      POST: async ({ request }: { request: Request }) => {
        const user = resolveUser(request)
        if (!user.isAdmin) return forbidden()
        const entry = await createBackup()
        return ok(entry)
      },
    },
  },
})
