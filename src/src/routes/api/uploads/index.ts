import { createFileRoute } from '@tanstack/react-router'
import { badRequest, created, resolveUser } from '#/lib/auth'
import { MAX_UPLOAD_BYTES, saveUpload } from '#/lib/uploads'

// POST /apps/crm/api/uploads  上传图片/附件（multipart/form-data，字段名 file）
//      → 201 { name, url, size, mime }
export const Route = createFileRoute('/api/uploads/')({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        // 仅取身份（iframe 内已鉴权的任意用户均可上传）。
        resolveUser(request)
        let form: FormData
        try {
          form = await request.formData()
        } catch {
          return badRequest('请求体不是 multipart/form-data')
        }
        const file = form.get('file')
        if (!(file instanceof File) || file.size === 0) {
          return badRequest('缺少文件')
        }
        if (file.size > MAX_UPLOAD_BYTES) {
          return badRequest('文件超过 20MB 上限')
        }
        const saved = await saveUpload(file)
        return created(saved)
      },
    },
  },
})
