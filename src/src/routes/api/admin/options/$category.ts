import { createFileRoute } from '@tanstack/react-router'
import {
  badRequest,
  created,
  forbidden,
  notFound,
  ok,
  readJson,
  resolveUser,
} from '#/lib/auth'
import {
  createOption,
  isOptionCategory,
  isTone,
  listOptions,
  optionUsageCount,
} from '#/lib/repo/options'

// GET  /apps/crm/api/admin/options/$category  列表（含已停用，仅管理员）
// POST /apps/crm/api/admin/options/$category  新建 { label, tone }（仅管理员）
export const Route = createFileRoute('/api/admin/options/$category')({
  server: {
    handlers: {
      GET: ({
        request,
        params,
      }: {
        request: Request
        params: { category: string }
      }) => {
        const user = resolveUser(request)
        if (!user.isAdmin) return forbidden()
        if (!isOptionCategory(params.category)) return notFound('分类不存在')
        // 提取为 const，使类型收窄在 .map 闭包内仍然有效。
        const category = params.category
        const items = listOptions(category, {
          includeArchived: true,
        }).map((o) => ({
          ...o,
          usage: optionUsageCount(category, o.value),
        }))
        return ok({ items })
      },

      POST: async ({
        request,
        params,
      }: {
        request: Request
        params: { category: string }
      }) => {
        const user = resolveUser(request)
        if (!user.isAdmin) return forbidden()
        if (!isOptionCategory(params.category)) return notFound('分类不存在')
        const body = await readJson(request)
        if (!body) return badRequest('请求体无效')
        const b = body
        const label = String(b.label ?? '').trim()
        if (!label) return badRequest('名称必填')
        const tone = typeof b.tone === 'string' ? b.tone : 'gray'
        if (!isTone(tone)) return badRequest('颜色无效')
        return created(createOption(params.category, label, tone))
      },
    },
  },
})
