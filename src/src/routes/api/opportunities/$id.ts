import { createFileRoute } from '@tanstack/react-router'
import { badRequest, ok, readJson, resolveUser } from '#/lib/auth'
import { requireOpportunity } from '#/lib/guards'
import {
  deleteOpportunity,
  updateOpportunity,
} from '#/lib/repo/opportunities'
import { logEntityChanges } from '#/lib/changelog'
import { getCustomer } from '#/lib/repo/customers'
import { listFollowUps } from '#/lib/repo/followups'
import { listTaskLinks } from '#/lib/repo/tasklinks'
import type { OpportunityStage, OpportunityStatus } from '#/lib/types'

// GET/PATCH/DELETE /apps/crm/api/opportunities/$id
export const Route = createFileRoute('/api/opportunities/$id')({
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
        const g = requireOpportunity(user, Number(params.id))
        if (g.deny) return g.deny
        return ok({
          opportunity: g.opportunity,
          customer: getCustomer(g.opportunity.customer_id),
          follow_ups: listFollowUps({ opportunity_id: g.opportunity.id }),
          task_links: listTaskLinks('opportunity', g.opportunity.id),
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
        const g = requireOpportunity(user, Number(params.id))
        if (g.deny) return g.deny
        const body = await readJson(request)
        if (!body) return badRequest('请求体无效')
        const b = body as Record<string, unknown>
        const before = g.opportunity
        const updated = updateOpportunity(g.opportunity.id, {
          title: b.title as string | undefined,
          stage: b.stage as OpportunityStage | undefined,
          status: b.status as OpportunityStatus | undefined,
          owner_id: b.owner_id != null ? Number(b.owner_id) : undefined,
          amount:
            b.amount === undefined
              ? undefined
              : b.amount === null
                ? null
                : Number(b.amount),
          expected_close_at: b.expected_close_at as string | undefined,
          lost_reason: b.lost_reason as string | undefined,
          next_follow_at: b.next_follow_at as string | undefined,
        })
        if (updated) {
          await logEntityChanges({
            entity: 'opportunity',
            customerId: before.customer_id,
            opportunityId: before.id,
            before: before as unknown as Record<string, unknown>,
            after: updated as unknown as Record<string, unknown>,
            userId: user.userId,
            token: request.headers.get('x-user-token'),
          })
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
        const g = requireOpportunity(user, Number(params.id))
        if (g.deny) return g.deny
        deleteOpportunity(g.opportunity.id)
        return ok({ deleted: true })
      },
    },
  },
})
