import { createFileRoute } from '@tanstack/react-router'
import { badRequest, created, ok, readJson, resolveUser } from '#/lib/auth'
import { requireCustomer, requireOpportunity } from '#/lib/guards'
import { createTaskLink, listTaskLinks } from '#/lib/repo/tasklinks'
import type { EntityType } from '#/lib/types'

function checkAccess(
  user: ReturnType<typeof resolveUser>,
  entityType: EntityType,
  entityId: number,
) {
  return entityType === 'opportunity'
    ? requireOpportunity(user, entityId).deny
    : requireCustomer(user, entityId).deny
}

// GET  /apps/crm/api/task-links?entity_type=&entity_id=
// POST /apps/crm/api/task-links   关联 DooTask 任务 { entity_type, entity_id, task_id, title? }
export const Route = createFileRoute('/api/task-links/')({
  server: {
    handlers: {
      GET: ({ request }: { request: Request }) => {
        const user = resolveUser(request)
        const sp = new URL(request.url).searchParams
        const entityType = sp.get('entity_type') as EntityType | null
        const entityId = parseInt(sp.get('entity_id') || '', 10)
        if (
          (entityType !== 'customer' && entityType !== 'opportunity') ||
          !Number.isFinite(entityId)
        )
          return badRequest('参数无效')
        const deny = checkAccess(user, entityType, entityId)
        if (deny) return deny
        return ok(listTaskLinks(entityType, entityId))
      },

      POST: async ({ request }: { request: Request }) => {
        const user = resolveUser(request)
        const body = await readJson(request)
        if (!body) return badRequest('请求体无效')
        const b = body as Record<string, unknown>
        const entityType = b.entity_type as EntityType
        const entityId = Number(b.entity_id)
        const taskId = Number(b.task_id)
        if (
          (entityType !== 'customer' && entityType !== 'opportunity') ||
          !Number.isFinite(entityId) ||
          !Number.isFinite(taskId)
        )
          return badRequest('参数无效')
        const deny = checkAccess(user, entityType, entityId)
        if (deny) return deny
        const link = createTaskLink({
          entity_type: entityType,
          entity_id: entityId,
          task_id: taskId,
          title: (b.title as string) ?? null,
          created_by: user.userId,
        })
        return created(link)
      },
    },
  },
})
