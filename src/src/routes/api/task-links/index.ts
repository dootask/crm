import { createFileRoute } from '@tanstack/react-router'
import { badRequest, created, ok, readJson, resolveUser } from '#/lib/auth'
import { requireCustomer, requireOpportunity } from '#/lib/guards'
import { createTaskLink, listTaskLinks } from '#/lib/repo/tasklinks'
import {
  addBotToTask,
  createTask,
  resolveUsers,
  sendTaskMessage,
} from '#/lib/dootask-server'
import type { Customer, EntityType, Opportunity } from '#/lib/types'

/** 取实体（带访问校验）；返回 deny 或实体本身。 */
function loadEntity(
  user: ReturnType<typeof resolveUser>,
  entityType: EntityType,
  entityId: number,
):
  | { deny: Response; entity?: undefined; name?: undefined; ownerId?: undefined }
  | { deny?: undefined; entity: Customer | Opportunity; name: string; ownerId: number } {
  if (entityType === 'opportunity') {
    const g = requireOpportunity(user, entityId)
    if (g.deny) return { deny: g.deny }
    return { entity: g.opportunity, name: g.opportunity.title, ownerId: g.opportunity.owner_id }
  }
  const g = requireCustomer(user, entityId)
  if (g.deny) return { deny: g.deny }
  return { entity: g.customer, name: g.customer.name, ownerId: g.customer.owner_id }
}

// GET  /apps/crm/api/task-links?entity_type=&entity_id=
// POST /apps/crm/api/task-links
//   关联现有任务：{ entity_type, entity_id, task_id, title? }
//   创建并关联：  { entity_type, entity_id, create: { project_id, column_id?, name } }
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
        const e = loadEntity(user, entityType, entityId)
        if (e.deny) return e.deny
        return ok(listTaskLinks(entityType, entityId))
      },

      POST: async ({ request }: { request: Request }) => {
        const user = resolveUser(request)
        const token = request.headers.get('x-user-token')
        const body = await readJson(request)
        if (!body) return badRequest('请求体无效')
        const b = body
        const entityType = b.entity_type
        const entityId = Number(b.entity_id)
        if (
          (entityType !== 'customer' && entityType !== 'opportunity') ||
          !Number.isFinite(entityId)
        )
          return badRequest('参数无效')
        const e = loadEntity(user, entityType, entityId)
        if (e.deny) return e.deny

        // 解析目标任务：创建并关联 or 关联现有
        let taskId: number
        let title: string | null =
          typeof b.title === 'string' ? b.title.trim() || null : null
        let presetDialog: number | null = null
        const create = b.create as
          | { project_id?: unknown; column_id?: unknown; name?: unknown }
          | undefined
        if (create) {
          const projectId = Number(create.project_id)
          const name = String(create.name ?? '').trim()
          if (!Number.isFinite(projectId) || projectId <= 0)
            return badRequest('请选择项目')
          if (!name) return badRequest('请输入任务标题')
          const res = await createTask(
            {
              project_id: projectId,
              column_id:
                create.column_id != null ? Number(create.column_id) : null,
              name,
            },
            token,
          )
          if (!res) return badRequest('创建任务失败，请稍后重试')
          taskId = res.task_id
          title = title ?? res.name
          presetDialog = res.dialog_id
        } else {
          taskId = Number(b.task_id)
          if (!Number.isFinite(taskId) || taskId <= 0)
            return badRequest('请选择要关联的任务')
        }

        // 把机器人加入任务群（首次会自动创建机器人并取 token）。no_permission 直接拦截；
        // 其它失败（无法创建机器人/网络异常）不阻断关联，但回传 warning 提示原因，不再静默。
        let dialogId = presetDialog
        let warning: string | undefined
        const add = await addBotToTask(taskId, token)
        if (add.ok) {
          dialogId = add.dialogId ?? presetDialog
        } else if (add.reason === 'no_permission') {
          return badRequest(add.message)
        } else {
          warning = `已关联，但未能接入任务聊天：${add.message}`
        }

        const link = createTaskLink({
          entity_type: entityType,
          entity_id: entityId,
          task_id: taskId,
          dialog_id: dialogId,
          title,
          created_by: user.userId,
        })

        // 关联建立动态：仅发往本次关联的任务（机器人已入群时）。
        if (add.ok && dialogId) {
          const owner = (await resolveUsers([e.ownerId], token))[e.ownerId]
          const label = entityType === 'customer' ? '客户' : '商机'
          void sendTaskMessage(
            dialogId,
            `🔗 已关联 CRM${label}：**${e.name}**（负责人：${owner.nickname}）`,
          )
        }

        return created({ ...link, warning })
      },
    },
  },
})
