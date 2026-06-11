import { readFileSync } from 'node:fs'
import { createFileRoute } from '@tanstack/react-router'
import { forbidden, notFound, ok, resolveUser } from '#/lib/auth'
import { deleteBackup, resolveBackupPath, restoreBackup } from '#/lib/backup'

// GET    /apps/crm/api/admin/backups/$name  下载备份文件（浏览器直下，身份走 ?uid=）
// POST   /apps/crm/api/admin/backups/$name  用该备份还原数据库
// DELETE /apps/crm/api/admin/backups/$name  删除该备份
export const Route = createFileRoute('/api/admin/backups/$name')({
  server: {
    handlers: {
      GET: ({
        request,
        params,
      }: {
        request: Request
        params: { name: string }
      }) => {
        const user = resolveUser(request)
        if (!user.isAdmin) return forbidden()
        const full = resolveBackupPath(params.name)
        if (!full) return notFound('备份不存在')
        const buf = readFileSync(full)
        return new Response(new Uint8Array(buf), {
          headers: {
            'content-type': 'application/octet-stream',
            'content-disposition': `attachment; filename="${params.name}"`,
            'content-length': String(buf.length),
          },
        })
      },

      POST: ({
        request,
        params,
      }: {
        request: Request
        params: { name: string }
      }) => {
        const user = resolveUser(request)
        if (!user.isAdmin) return forbidden()
        if (!restoreBackup(params.name)) return notFound('备份不存在')
        return ok({ restored: true })
      },

      DELETE: ({
        request,
        params,
      }: {
        request: Request
        params: { name: string }
      }) => {
        const user = resolveUser(request)
        if (!user.isAdmin) return forbidden()
        if (!deleteBackup(params.name)) return notFound('备份不存在')
        return ok({ deleted: true })
      },
    },
  },
})
