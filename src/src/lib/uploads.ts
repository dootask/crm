// 跟进记录的图片/附件上传存储（仅服务端）。
// 文件落在 CRM_UPLOAD_DIR（默认 CRM_DATA_DIR/uploads）下，存储名是无扩展名的 UUID；
// 数据库只存其访问 URL。存储名不带扩展名有两个好处：
//   1) vite dev 不会把 .png 之类请求当静态资源拦截（生产 Nitro 无此问题）；
//   2) content-type 改由读取文件头嗅探，避免伪造扩展名 + 杜绝 SVG 内联脚本。
// 轻量信任模型：下载不强制鉴权（文件名随机不可枚举，且插件运行在已鉴权的 iframe 内）。

import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import sharp from 'sharp'
import type { Metadata } from 'sharp'
import { dataDir } from '#/lib/db'
import type { Attachment, UploadResult } from '#/lib/types'

/** 单文件大小上限：20MB。 */
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024

/** 前端访问上传文件的 URL 前缀（与 lib/api.ts 的 /apps/crm/api 对齐）。 */
const URL_PREFIX = '/apps/crm/api/uploads/'

// 存储名：仅 UUID（十六进制 + 连字符），杜绝路径穿越，也不含扩展名。
const STORED_NAME_RE = /^[a-f0-9-]{32,36}$/i

/** 上传根目录：优先 CRM_UPLOAD_DIR（可单独挂载），否则数据目录下的 uploads/。 */
export function uploadDir(): string {
  return process.env.CRM_UPLOAD_DIR || resolve(dataDir(), 'uploads')
}

/**
 * 对图片做无损优化并检测是否含透明像素。
 * - PNG / 无损 WebP 重压缩（不改像素，仅更优编码），结果更大则保留原图。
 * - JPEG / GIF 等保持原样，确保「无损」。
 * - transparent 用 stats.isOpaque 判定：有 alpha 通道但全不透明的图不算透明。
 * 解析失败（非真正的图片）则原样返回。
 */
async function optimizeImage(
  buf: Buffer,
): Promise<{ data: Buffer; transparent: boolean }> {
  let meta: Metadata
  try {
    meta = await sharp(buf, { failOn: 'none' }).metadata()
  } catch {
    return { data: buf, transparent: false }
  }

  let transparent = false
  if (meta.hasAlpha) {
    try {
      const st = await sharp(buf, { failOn: 'none' }).stats()
      transparent = !st.isOpaque
    } catch {
      /* 统计失败按不透明处理 */
    }
  }

  let optimized: Buffer | null = null
  try {
    if (meta.format === 'png') {
      optimized = await sharp(buf, { failOn: 'none' })
        .png({ compressionLevel: 9, effort: 10, palette: false })
        .toBuffer()
    } else if (meta.format === 'webp') {
      optimized = await sharp(buf, { failOn: 'none' })
        .webp({ lossless: true, effort: 6 })
        .toBuffer()
    }
  } catch {
    /* 压缩失败用原图 */
  }
  const data =
    optimized && optimized.length < buf.length ? optimized : buf
  return { data, transparent }
}

/** 保存一个上传文件，返回其元信息（含可直接用于 <img>/下载的 URL）。 */
export async function saveUpload(file: File): Promise<UploadResult> {
  const dir = uploadDir()
  mkdirSync(dir, { recursive: true })
  const stored = randomUUID()
  const original = Buffer.from(await file.arrayBuffer())
  // 仅对识别为位图的文件走优化/透明检测，其余原样保存。
  const { data, transparent } =
    sniffImageType(original) !== null
      ? await optimizeImage(original)
      : { data: original, transparent: false }
  writeFileSync(resolve(dir, stored), data)
  return {
    name: file.name || '未命名文件',
    url: `${URL_PREFIX}${stored}`,
    size: data.length,
    mime: file.type || 'application/octet-stream',
    transparent,
  }
}

/** 校验并解析存储文件的绝对路径；非法名返回 null（不检查是否存在，交给读取处）。 */
export function resolveUploadPath(name: string): string | null {
  if (!STORED_NAME_RE.test(name)) return null
  return resolve(uploadDir(), name)
}

/**
 * 嗅探文件头，仅识别可安全内联展示的位图类型；其余一律按二进制流。
 * 不识别 SVG（同源直链打开会执行其中脚本，故不内联），交给前端走下载。
 */
export function sniffImageType(buf: Buffer): string | null {
  if (buf.length >= 4 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47)
    return 'image/png'
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff)
    return 'image/jpeg'
  if (buf.length >= 4 && buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38)
    return 'image/gif'
  if (
    buf.length >= 12 &&
    buf.toString('ascii', 0, 4) === 'RIFF' &&
    buf.toString('ascii', 8, 12) === 'WEBP'
  )
    return 'image/webp'
  return null
}

/**
 * 校验并规整前端回传的附件列表：只保留指向本插件 uploads 的合法项，
 * 防止把任意外部 URL 当成附件存进库。
 */
export function sanitizeAttachments(input: unknown): Array<Attachment> {
  if (!Array.isArray(input)) return []
  const out: Array<Attachment> = []
  for (const it of input) {
    if (!it || typeof it !== 'object') continue
    const a = it as Record<string, unknown>
    const url = String(a.url ?? '')
    if (!url.startsWith(URL_PREFIX)) continue
    const stored = url.slice(URL_PREFIX.length)
    if (!STORED_NAME_RE.test(stored)) continue
    out.push({
      name: String(a.name ?? '附件').slice(0, 255),
      url,
      size: Number.isFinite(Number(a.size)) ? Number(a.size) : 0,
      mime: String(a.mime ?? 'application/octet-stream').slice(0, 128),
    })
  }
  return out
}
