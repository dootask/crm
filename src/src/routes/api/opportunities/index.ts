import { createFileRoute } from '@tanstack/react-router'
import { badRequest, created, ok, readJson, resolveUser } from '#/lib/auth'
import { requireCustomer } from '#/lib/guards'
import {
  createOpportunity,
  listOpportunities,
} from '#/lib/repo/opportunities'
import { isActiveValue } from '#/lib/repo/options'
import type { OpportunityStage, OpportunityStatus } from '#/lib/types'

// GET  /apps/crm/api/opportunities?customer_id=&stage=&status=&owner_id=&search=
// POST /apps/crm/api/opportunities
export const Route = createFileRoute('/api/opportunities/')({
  server: {
    handlers: {
      GET: ({ request }: { request: Request }) => {
        const user = resolveUser(request)
        const sp = new URL(request.url).searchParams
        const customerId = parseInt(sp.get('customer_id') || '', 10)
        const ownerId = parseInt(sp.get('owner_id') || '', 10)
        const page = parseInt(sp.get('page') || '', 10)
        const pageSize = parseInt(sp.get('pageSize') || '', 10)
        // 同时给出有效 page+pageSize 才分页；否则返回全部。
        const paged =
          Number.isFinite(page) && Number.isFinite(pageSize) && pageSize > 0
        return ok(
          listOpportunities(
            user,
            {
              customer_id: Number.isFinite(customerId) ? customerId : undefined,
              stage: sp.get('stage') || undefined,
              status: sp.get('status') || undefined,
              owner_id: Number.isFinite(ownerId) ? ownerId : undefined,
              search: sp.get('search') || undefined,
            },
            paged
              ? { limit: pageSize, offset: (Math.max(1, page) - 1) * pageSize }
              : {},
            { lastFollow: sp.get('detail') === '1' },
          ),
        )
      },

      POST: async ({ request }: { request: Request }) => {
        const user = resolveUser(request)
        const body = await readJson(request)
        if (!body) return badRequest('请求体无效')
        const b = body as Record<string, unknown>
        const customerId = Number(b.customer_id)
        const title = String(b.title ?? '').trim()
        if (!Number.isFinite(customerId)) return badRequest('缺少 customer_id')
        if (!title) return badRequest('商机标题必填')
        if (b.stage != null && !isActiveValue('opportunity_stage', String(b.stage)))
          return badRequest('商机阶段无效')
        // 商机归属其客户，需有客户访问权
        const g = requireCustomer(user, customerId)
        if (g.deny) return g.deny
        const opp = createOpportunity(
          {
            customer_id: customerId,
            title,
            stage: (b.stage as OpportunityStage) ?? 'initial',
            status: (b.status as OpportunityStatus) ?? 'open',
            owner_id: b.owner_id != null ? Number(b.owner_id) : user.userId,
            amount: b.amount != null ? Number(b.amount) : null,
            expected_close_at: (b.expected_close_at as string) ?? null,
            next_follow_at: (b.next_follow_at as string) ?? null,
          },
          user.userId,
        )
        return created(opp)
      },
    },
  },
})
