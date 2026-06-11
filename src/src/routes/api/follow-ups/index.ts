import { createFileRoute } from '@tanstack/react-router'
import { badRequest, created, ok, readJson, resolveUser } from '#/lib/auth'
import { requireCustomer } from '#/lib/guards'
import { createFollowUp, listFollowUps } from '#/lib/repo/followups'
import { sanitizeFollowUpHtml, stripTags } from '#/lib/sanitize'
import { sanitizeAttachments } from '#/lib/uploads'
import { notifyTaskLinks } from '#/lib/notify'

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
        const b = body
        const customerId = Number(b.customer_id)
        if (!Number.isFinite(customerId)) return badRequest('缺少 customer_id')

        const raw = String(b.content ?? '')
        // 富文本编辑器提交 HTML（以 < 开头），消毒后存；其余按纯文本处理。
        const content = raw.trim().startsWith('<')
          ? sanitizeFollowUpHtml(raw)
          : raw.trim()
        const attachments = sanitizeAttachments(b.attachments)
        // 正文有文字、含图片、或带附件，三者居一即可；纯空编辑器（如 <p></p>）拒绝。
        const hasText = stripTags(content).trim().length > 0
        const hasImage = /<img\b/i.test(content)
        if (!hasText && !hasImage && attachments.length === 0) {
          return badRequest('跟进内容必填')
        }

        const g = requireCustomer(user, customerId)
        if (g.deny) return g.deny
        const opportunityId =
          b.opportunity_id != null ? Number(b.opportunity_id) : null
        const follow = createFollowUp({
          customer_id: customerId,
          opportunity_id: opportunityId,
          content,
          attachments,
          follow_by: user.userId,
          next_follow_at: (b.next_follow_at as string | undefined) ?? null,
        })

        // 推送「新增跟进」到关联任务聊天（客户必推；归属商机时也推到商机的关联任务）。
        const plain = stripTags(content).trim()
        const summary = plain
          ? plain.length > 200
            ? `${plain.slice(0, 200)}…`
            : plain
          : '（含图片/附件）'
        const nextLine = follow.next_follow_at
          ? `\n下次跟进：${follow.next_follow_at}`
          : ''
        const text = `📝 新增跟进：${summary}${nextLine}`
        void notifyTaskLinks('customer', customerId, text)
        if (opportunityId)
          void notifyTaskLinks('opportunity', opportunityId, text)

        return created(follow)
      },
    },
  },
})
