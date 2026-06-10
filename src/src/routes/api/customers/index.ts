import { createFileRoute } from '@tanstack/react-router'
import { badRequest, created, ok, readJson, resolveUser } from '#/lib/auth'
import { createCustomer, listCustomers } from '#/lib/repo/customers'
import type { CustomerStatus } from '#/lib/types'

// GET  /apps/crm/api/customers?search=&status=&owner_id=  列表（按权限过滤）
// POST /apps/crm/api/customers                            新增客户
export const Route = createFileRoute('/api/customers/')({
  server: {
    handlers: {
      GET: ({ request }: { request: Request }) => {
        const user = resolveUser(request)
        const sp = new URL(request.url).searchParams
        const ownerId = parseInt(sp.get('owner_id') || '', 10)
        return ok(
          listCustomers(user, {
            search: sp.get('search') || undefined,
            status: sp.get('status') || undefined,
            owner_id: Number.isFinite(ownerId) ? ownerId : undefined,
          }),
        )
      },

      POST: async ({ request }: { request: Request }) => {
        const user = resolveUser(request)
        const body = await readJson(request)
        if (!body) return badRequest('请求体无效')
        const b = body as Record<string, unknown>
        const name = String(b.name ?? '').trim()
        if (!name) return badRequest('客户名称必填')
        const customer = createCustomer(
          {
            name,
            company: (b.company as string) ?? null,
            status: (b.status as CustomerStatus) ?? 'lead',
            source: (b.source as string) ?? null,
            tags: (b.tags as string) ?? null,
            note: (b.note as string) ?? null,
            // 负责人默认当前用户，可由前端指定其他 DooTask 用户
            owner_id:
              b.owner_id != null ? Number(b.owner_id) : user.userId,
            next_follow_at: (b.next_follow_at as string) ?? null,
          },
          user.userId,
        )
        return created(customer)
      },
    },
  },
})
