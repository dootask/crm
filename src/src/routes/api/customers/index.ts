import { createFileRoute } from '@tanstack/react-router'
import { badRequest, created, ok, readJson, resolveUser } from '#/lib/auth'
import { createCustomer, listCustomers } from '#/lib/repo/customers'
import { isActiveValue } from '#/lib/repo/options'
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
        const page = parseInt(sp.get('page') || '', 10)
        const pageSize = parseInt(sp.get('pageSize') || '', 10)
        // 同时给出有效 page+pageSize 才分页；否则返回全部（下拉/映射用）。
        const paged =
          Number.isFinite(page) && Number.isFinite(pageSize) && pageSize > 0
        return ok(
          listCustomers(
            user,
            {
              search: sp.get('search') || undefined,
              status: sp.get('status') || undefined,
              owner_id: Number.isFinite(ownerId) ? ownerId : undefined,
            },
            paged
              ? { limit: pageSize, offset: (Math.max(1, page) - 1) * pageSize }
              : {},
            {
              lastFollow: sp.get('detail') === '1',
              statusCounts: sp.get('counts') === '1',
            },
          ),
        )
      },

      POST: async ({ request }: { request: Request }) => {
        const user = resolveUser(request)
        const body = await readJson(request)
        if (!body) return badRequest('请求体无效')
        const b = body
        const name = String(b.name ?? '').trim()
        if (!name) return badRequest('客户名称必填')
        if (
          b.status != null &&
          !isActiveValue('customer_status', String(b.status))
        )
          return badRequest('客户状态无效')
        const customer = createCustomer(
          {
            name,
            company: (b.company as string | undefined) ?? null,
            status: (b.status as CustomerStatus | undefined) ?? 'lead',
            source: (b.source as string | undefined) ?? null,
            tags: (b.tags as string | undefined) ?? null,
            note: (b.note as string | undefined) ?? null,
            // 负责人默认当前用户，可由前端指定其他 DooTask 用户
            owner_id: b.owner_id != null ? Number(b.owner_id) : user.userId,
            next_follow_at: (b.next_follow_at as string | undefined) ?? null,
          },
          user.userId,
        )
        return created(customer)
      },
    },
  },
})
