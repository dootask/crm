import { createFileRoute } from '@tanstack/react-router'
import { badRequest, created, ok, readJson, resolveUser } from '#/lib/auth'
import { requireCustomer } from '#/lib/guards'
import { createContact, listContacts } from '#/lib/repo/contacts'

// GET  /apps/crm/api/contacts?customer_id=  列出某客户的联系人
// POST /apps/crm/api/contacts               新增联系人
export const Route = createFileRoute('/api/contacts/')({
  server: {
    handlers: {
      GET: ({ request }: { request: Request }) => {
        const user = resolveUser(request)
        const customerId = parseInt(
          new URL(request.url).searchParams.get('customer_id') || '',
          10,
        )
        if (!Number.isFinite(customerId)) return badRequest('缺少 customer_id')
        const g = requireCustomer(user, customerId)
        if (g.deny) return g.deny
        return ok(listContacts(customerId))
      },

      POST: async ({ request }: { request: Request }) => {
        const user = resolveUser(request)
        const body = await readJson(request)
        if (!body) return badRequest('请求体无效')
        const customerId = Number(
          (body as { customer_id?: unknown }).customer_id,
        )
        const name = String((body as { name?: unknown }).name ?? '').trim()
        if (!Number.isFinite(customerId)) return badRequest('缺少 customer_id')
        if (!name) return badRequest('联系人姓名必填')
        const g = requireCustomer(user, customerId)
        if (g.deny) return g.deny
        const b = body
        const contact = createContact({
          customer_id: customerId,
          name,
          title: (b.title as string | undefined) ?? null,
          phone: (b.phone as string | undefined) ?? null,
          email: (b.email as string | undefined) ?? null,
          is_primary: Boolean(b.is_primary),
          note: (b.note as string | undefined) ?? null,
        })
        return created(contact)
      },
    },
  },
})
