import { createFileRoute } from '@tanstack/react-router'
import { badRequest, created, ok, readJson, resolveUser } from '#/lib/auth'
import { requireCustomer } from '#/lib/guards'
import { createFollowUp, listFollowUps } from '#/lib/repo/followups'

// GET  /apps/crm/api/follow-ups?customer_id=&opportunity_id=  跟进时间线
// POST /apps/crm/api/follow-ups                                新增跟进记录
export const Route = createFileRoute('/api/follow-ups/')({
  server: {
    handlers: {
      GET: ({ request }: { request: Request }) => {
        const user = resolveUser(request)
        const sp = new URL(request.url).searchParams
        const customerId = parseInt(sp.get('customer_id') || '', 10)
        const opportunityId = parseInt(sp.get('opportunity_id') || '', 10)
        if (!Number.isFinite(customerId)) return badRequest('缺少 customer_id')
        const g = requireCustomer(user, customerId)
        if (g.deny) return g.deny
        return ok(
          listFollowUps({
            customer_id: customerId,
            opportunity_id: Number.isFinite(opportunityId)
              ? opportunityId
              : undefined,
          }),
        )
      },

      POST: async ({ request }: { request: Request }) => {
        const user = resolveUser(request)
        const body = await readJson(request)
        if (!body) return badRequest('请求体无效')
        const b = body as Record<string, unknown>
        const customerId = Number(b.customer_id)
        const content = String(b.content ?? '').trim()
        if (!Number.isFinite(customerId)) return badRequest('缺少 customer_id')
        if (!content) return badRequest('跟进内容必填')
        const g = requireCustomer(user, customerId)
        if (g.deny) return g.deny
        const follow = createFollowUp({
          customer_id: customerId,
          opportunity_id:
            b.opportunity_id != null ? Number(b.opportunity_id) : null,
          content,
          follow_by: user.userId,
          next_follow_at: (b.next_follow_at as string) ?? null,
        })
        return created(follow)
      },
    },
  },
})
