import { createFileRoute } from '@tanstack/react-router'
import {
  badRequest,
  ok,
  readJson,
  resolveUser,
} from '#/lib/auth'
import { requireCustomer } from '#/lib/guards'
import {
  deleteContact,
  getContact,
  updateContact,
} from '#/lib/repo/contacts'

// PATCH/DELETE /apps/crm/api/contacts/$id
export const Route = createFileRoute('/api/contacts/$id')({
  server: {
    handlers: {
      PATCH: async ({
        request,
        params,
      }: {
        request: Request
        params: { id: string }
      }) => {
        const user = resolveUser(request)
        const contact = getContact(Number(params.id))
        if (!contact) return badRequest('联系人不存在')
        const g = requireCustomer(user, contact.customer_id)
        if (g.deny) return g.deny
        const body = await readJson(request)
        if (!body) return badRequest('请求体无效')
        const b = body as Record<string, unknown>
        const updated = updateContact(contact.id, {
          name: b.name as string | undefined,
          title: b.title as string | undefined,
          phone: b.phone as string | undefined,
          email: b.email as string | undefined,
          note: b.note as string | undefined,
          is_primary:
            b.is_primary === undefined ? undefined : Boolean(b.is_primary),
        })
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
        const contact = getContact(Number(params.id))
        if (!contact) return ok({ deleted: true })
        const g = requireCustomer(user, contact.customer_id)
        if (g.deny) return g.deny
        deleteContact(contact.id)
        return ok({ deleted: true })
      },
    },
  },
})
