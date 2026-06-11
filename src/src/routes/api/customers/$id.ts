import { createFileRoute } from '@tanstack/react-router'
import { badRequest, ok, readJson, resolveUser } from '#/lib/auth'
import { requireCustomer } from '#/lib/guards'
import { deleteCustomer, updateCustomer } from '#/lib/repo/customers'
import { isActiveValue } from '#/lib/repo/options'
import { logEntityChanges, shouldNotify } from '#/lib/changelog'
import { notifyTaskLinks } from '#/lib/notify'
import { listContacts } from '#/lib/repo/contacts'
import { listFollowUps } from '#/lib/repo/followups'
import { listOpportunities } from '#/lib/repo/opportunities'
import { listTaskLinks } from '#/lib/repo/tasklinks'
import type { CustomerStatus } from '#/lib/types'

// GET    /apps/crm/api/customers/$id  详情（聚合联系人/跟进/商机/关联任务）
// PATCH  /apps/crm/api/customers/$id  更新
// DELETE /apps/crm/api/customers/$id  删除
export const Route = createFileRoute('/api/customers/$id')({
  server: {
    handlers: {
      GET: ({
        request,
        params,
      }: {
        request: Request
        params: { id: string }
      }) => {
        const user = resolveUser(request)
        const id = Number(params.id)
        const g = requireCustomer(user, id)
        if (g.deny) return g.deny
        return ok({
          customer: g.customer,
          contacts: listContacts(id),
          opportunities: listOpportunities(user, { customer_id: id }).items,
          follow_ups: listFollowUps({ customer_id: id }),
          task_links: listTaskLinks('customer', id),
        })
      },

      PATCH: async ({
        request,
        params,
      }: {
        request: Request
        params: { id: string }
      }) => {
        const user = resolveUser(request)
        const id = Number(params.id)
        const g = requireCustomer(user, id)
        if (g.deny) return g.deny
        const body = await readJson(request)
        if (!body) return badRequest('请求体无效')
        const b = body
        if (
          b.status != null &&
          !isActiveValue('customer_status', String(b.status))
        )
          return badRequest('客户状态无效')
        const before = g.customer
        const updated = updateCustomer(id, {
          name: b.name as string | undefined,
          company: b.company as string | undefined,
          status: b.status as CustomerStatus | undefined,
          source: b.source as string | undefined,
          tags: b.tags as string | undefined,
          note: b.note as string | undefined,
          owner_id: b.owner_id != null ? Number(b.owner_id) : undefined,
          next_follow_at: b.next_follow_at as string | undefined,
        })
        // 自动记录本次修改为一条跟进；命中白名单字段时推送到关联任务聊天。
        if (updated) {
          const change = await logEntityChanges({
            entity: 'customer',
            customerId: id,
            before: before as unknown as Record<string, unknown>,
            after: updated as unknown as Record<string, unknown>,
            userId: user.userId,
            token: request.headers.get('x-user-token'),
          })
          if (change && shouldNotify('customer', change.changed)) {
            void notifyTaskLinks('customer', id, `✏️ ${change.content}`)
          }
        }
        return ok(updated)
      },

      DELETE: ({
        request,
        params,
      }: {
        request: Request
        params: { id: string }
      }) => {
        const user = resolveUser(request)
        const id = Number(params.id)
        const g = requireCustomer(user, id)
        if (g.deny) return g.deny
        deleteCustomer(id)
        return ok({ deleted: true })
      },
    },
  },
})
