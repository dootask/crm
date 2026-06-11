import { createFileRoute } from '@tanstack/react-router'
import { ok } from '#/lib/auth'
import { listAllForApp } from '#/lib/repo/options'

// GET /apps/crm/api/options  返回客户状态 / 商机阶段全部选项（含已停用）。
// 任意已登录用户可读：前端 OptionsProvider 用它渲染徽章与下拉。
export const Route = createFileRoute('/api/options')({
  server: {
    handlers: {
      GET: () => ok(listAllForApp()),
    },
  },
})
