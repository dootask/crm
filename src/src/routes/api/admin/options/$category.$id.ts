import { createFileRoute } from '@tanstack/react-router'
import {
  badRequest,
  forbidden,
  notFound,
  ok,
  readJson,
  resolveUser,
} from '#/lib/auth'
import {
  deleteOption,
  getOption,
  isOptionCategory,
  isTone,
  moveOption,
  setArchived,
  updateOption,
} from '#/lib/repo/options'

// PATCH  /apps/crm/api/admin/options/$category/$id
//   { label?, tone? }            改名 / 改色
//   { archived: boolean }        停用 / 启用
//   { move: 'up' | 'down' }      排序
// DELETE /apps/crm/api/admin/options/$category/$id  删除（仅未被使用时）
export const Route = createFileRoute('/api/admin/options/$category/$id')({
  server: {
    handlers: {
      PATCH: async ({
        request,
        params,
      }: {
        request: Request
        params: { category: string; id: string }
      }) => {
        const user = resolveUser(request)
        if (!user.isAdmin) return forbidden()
        if (!isOptionCategory(params.category)) return notFound('分类不存在')
        const id = Number(params.id)
        const existing = getOption(id)
        if (!existing || existing.category !== params.category)
          return notFound('选项不存在')

        const body = await readJson(request)
        if (!body) return badRequest('请求体无效')
        const b = body

        // 排序
        if (b.move === 'up' || b.move === 'down') {
          const r = moveOption(id, b.move)
          return r.ok ? ok(r.option) : badRequest(r.error)
        }
        // 停用 / 启用
        if (typeof b.archived === 'boolean') {
          const r = setArchived(id, b.archived)
          return r.ok ? ok(r.option) : badRequest(r.error)
        }
        // 改名 / 改色
        const patch: { label?: string; tone?: string } = {}
        if (b.label !== undefined) {
          const label = String(b.label).trim()
          if (!label) return badRequest('名称必填')
          patch.label = label
        }
        if (b.tone !== undefined) {
          if (!isTone(b.tone)) return badRequest('颜色无效')
          patch.tone = b.tone as string
        }
        return ok(updateOption(id, patch))
      },

      DELETE: ({
        request,
        params,
      }: {
        request: Request
        params: { category: string; id: string }
      }) => {
        const user = resolveUser(request)
        if (!user.isAdmin) return forbidden()
        if (!isOptionCategory(params.category)) return notFound('分类不存在')
        const id = Number(params.id)
        const existing = getOption(id)
        if (!existing || existing.category !== params.category)
          return notFound('选项不存在')
        const r = deleteOption(id)
        return r.ok ? ok({ deleted: true }) : badRequest(r.error)
      },
    },
  },
})
