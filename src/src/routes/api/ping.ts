import { createFileRoute } from '@tanstack/react-router'

// 健康检查 / 握手验证接口：GET /apps/crm/api/ping
export const Route = createFileRoute('/api/ping')({
  server: {
    handlers: {
      GET: () =>
        Response.json({
          ok: true,
          app: 'crm',
          version: process.env.CRM_VERSION ?? 'dev',
        }),
    },
  },
})
