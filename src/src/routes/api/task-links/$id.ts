import { createFileRoute } from '@tanstack/react-router'
import { getDb } from '#/lib/db'
import { ok, resolveUser } from '#/lib/auth'
import { requireCustomer, requireOpportunity } from '#/lib/guards'
import { deleteTaskLink } from '#/lib/repo/tasklinks'
import type { TaskLink } from '#/lib/types'

// DELETE /apps/crm/api/task-links/$id  解除任务关联
export const Route = createFileRoute('/api/task-links/$id')({
  server: {
    handlers: {
      DELETE: ({
        request,
        params,
      }: {
        request: Request
        params: { id: string }
      }) => {
        const user = resolveUser(request)
        const link = getDb()
          .prepare('SELECT * FROM task_links WHERE id = ?')
          .get(Number(params.id)) as TaskLink | undefined
        if (!link) return ok({ deleted: true })
        const deny =
          link.entity_type === 'opportunity'
            ? requireOpportunity(user, link.entity_id).deny
            : requireCustomer(user, link.entity_id).deny
        if (deny) return deny
        deleteTaskLink(link.id)
        return ok({ deleted: true })
      },
    },
  },
})
