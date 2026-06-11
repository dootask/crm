import { existsSync, readFileSync } from 'node:fs'
import { createFileRoute } from '@tanstack/react-router'
import { notFound } from '#/lib/auth'
import { resolveUploadPath, sniffImageType } from '#/lib/uploads'

// GET /apps/crm/api/uploads/$name        内联查看（位图 <img src> 直接命中）
// GET /apps/crm/api/uploads/$name?download&name=原名  触发浏览器下载并用原文件名
// 不强制鉴权：文件名随机不可枚举，且 <img> 无法携带身份头，与轻量信任模型一致。
export const Route = createFileRoute('/api/uploads/$name')({
  server: {
    handlers: {
      GET: ({
        request,
        params,
      }: {
        request: Request
        params: { name: string }
      }) => {
        const full = resolveUploadPath(params.name)
        if (!full || !existsSync(full)) return notFound('文件不存在')
        const buf = readFileSync(full)
        // 只有识别出的安全位图才内联展示，其余按二进制流（配合 nosniff 防 MIME 嗅探）。
        const imageType = sniffImageType(buf)
        const headers: Record<string, string> = {
          'content-type': imageType || 'application/octet-stream',
          'content-length': String(buf.length),
          'cache-control': 'public, max-age=31536000, immutable',
          'x-content-type-options': 'nosniff',
        }
        const sp = new URL(request.url).searchParams
        // 非图片（或显式 ?download）一律作为附件下载，用回传的原文件名。
        if (sp.has('download') || !imageType) {
          const fname = sp.get('name') || params.name
          headers['content-disposition'] =
            `attachment; filename*=UTF-8''${encodeURIComponent(fname)}`
        }
        return new Response(new Uint8Array(buf), { headers })
      },
    },
  },
})
