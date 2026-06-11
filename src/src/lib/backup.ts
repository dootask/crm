// 数据备份/还原：备份产物是 zip 归档，含数据库一致快照 + 整个 uploads 目录。
//   归档内部布局：crm.db（数据库快照）、uploads/<UUID...>（上传文件）、manifest.json（元信息）。
// 兼容旧版「单个 .db」备份：.db 仅含数据库，仍可下载/还原/删除（还原时只覆盖数据库）。
// 仅管理员可用（鉴权在 API 层做）。

import {
  copyFileSync,
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { once } from 'node:events'
import { resolve } from 'node:path'
import { Zip, ZipDeflate, ZipPassThrough, unzipSync } from 'fflate'
import { closeDb, dataDir, dbFilePath, getDb } from '#/lib/db'
import { uploadDir } from '#/lib/uploads'

export interface BackupEntry {
  name: string
  size: number
  createdAt: string // ISO，取文件修改时间
}

// 归档内的数据库文件名。
const DB_ENTRY = 'crm.db'
// 归档内上传文件的前缀。
const UPLOADS_PREFIX = 'uploads/'

/**
 * 仅允许我们自己生成的备份文件名，杜绝路径穿越。
 * 新版 .zip（数据库 + 上传文件），旧版 .db（仅数据库，向后兼容）。
 * 末尾可选 -N 是同一秒撞名时补的后缀。
 */
const NAME_RE = /^crm-\d{8}-\d{6}(-\d+)?\.(zip|db)$/

function backupDir(): string {
  return resolve(dataDir(), 'backups')
}

/** 校验并解析备份文件绝对路径；非法文件名或不存在返回 null。 */
export function resolveBackupPath(name: string): string | null {
  // NAME_RE 已限定为无斜杠、无 .. 的固定格式，不存在路径穿越风险。
  if (!NAME_RE.test(name)) return null
  const full = resolve(backupDir(), name)
  if (!existsSync(full)) return null
  return full
}

/** 列出备份，按时间倒序。 */
export function listBackups(): Array<BackupEntry> {
  const dir = backupDir()
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((f) => NAME_RE.test(f))
    .map((name) => {
      const st = statSync(resolve(dir, name))
      return { name, size: st.size, createdAt: st.mtime.toISOString() }
    })
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
}

/** 形如 20260611-143022 的时间戳，用于文件名与暂存目录命名。 */
function tsSuffix(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return (
    `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-` +
    `${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
  )
}

interface ZipEntry {
  name: string
  data?: Uint8Array
  path?: string
  compress: boolean
}

/**
 * 流式把若干文件打成 zip 落盘：每写完一个文件就让出事件循环等缓冲落盘，
 * 把峰值内存控制在「单个文件 + 其压缩输出」量级，避免大量大图一次性进内存。
 * compress=true 走 deflate（数据库），附件已是压缩格式用 store（passthrough）。
 */
async function writeZip(target: string, entries: Array<ZipEntry>): Promise<void> {
  const out = createWriteStream(target)
  let rejectErr: ((e: Error) => void) | null = null
  const onError = new Promise<never>((_, rej) => {
    rejectErr = rej
  })
  // 单独挂个 catch 吞掉「无人 await 时」的拒绝，避免 unhandledRejection；race 仍能观察到。
  onError.catch(() => {})
  out.on('error', (e) => rejectErr?.(e))

  const zip = new Zip((err, chunk, final) => {
    if (err) {
      out.destroy(err)
      return
    }
    out.write(chunk)
    if (final) out.end()
  })
  const finished = new Promise<void>((res) => out.on('finish', () => res()))

  try {
    for (const e of entries) {
      const data = e.data ?? readFileSync(e.path as string)
      const file = e.compress
        ? new ZipDeflate(e.name, { level: 6 })
        : new ZipPassThrough(e.name)
      zip.add(file)
      file.push(data, true)
      // 缓冲超过高水位才等 drain，把峰值内存压到单文件量级。
      if (out.writableNeedDrain) {
        await Promise.race([once(out, 'drain'), onError])
      }
    }
    zip.end()
    await Promise.race([finished, onError])
  } catch (e) {
    out.destroy()
    if (existsSync(target)) rmSync(target, { force: true })
    throw e
  }
}

/**
 * 生成一份新备份并返回其元信息。
 * 先用 better-sqlite3 在线 backup API 出一份一致的数据库快照（WAL 模式下安全），
 * 再连同 uploads 目录里的全部文件流式打进 zip。
 * 同一秒重复点击会撞名，循环补后缀避免覆盖。
 */
export async function createBackup(): Promise<BackupEntry> {
  const dir = backupDir()
  mkdirSync(dir, { recursive: true })
  let name = `crm-${tsSuffix()}.zip`
  if (existsSync(resolve(dir, name))) {
    let i = 1
    const base = name.replace(/\.zip$/, '')
    while (existsSync(resolve(dir, `${base}-${i}.zip`))) i++
    name = `${base}-${i}.zip`
  }
  const target = resolve(dir, name)

  // 数据库快照先落到临时文件，打包完再删。
  const tmpDb = resolve(dir, `.tmp-${name}.db`)
  await getDb().backup(tmpDb)

  try {
    const uDir = uploadDir()
    const uploadFiles = existsSync(uDir)
      ? readdirSync(uDir, { withFileTypes: true })
          .filter((d) => d.isFile())
          .map((d) => d.name)
      : []

    const manifest = JSON.stringify({
      version: 1,
      createdAt: new Date().toISOString(),
      uploads: uploadFiles.length,
    })

    await writeZip(target, [
      { name: 'manifest.json', data: Buffer.from(manifest, 'utf8'), compress: true },
      { name: DB_ENTRY, path: tmpDb, compress: true },
      ...uploadFiles.map((f) => ({
        name: `${UPLOADS_PREFIX}${f}`,
        path: resolve(uDir, f),
        compress: false,
      })),
    ])
  } finally {
    if (existsSync(tmpDb)) rmSync(tmpDb, { force: true })
  }

  const st = statSync(target)
  return { name, size: st.size, createdAt: st.mtime.toISOString() }
}

/** 用指定备份还原；按扩展名分流：.zip 还原数据库+上传文件，.db 仅还原数据库。 */
export function restoreBackup(name: string): boolean {
  const src = resolveBackupPath(name)
  if (!src) return false
  return name.endsWith('.db') ? restoreLegacyDb(src) : restoreArchive(src)
}

/** 旧版：直接用 .db 覆盖当前数据库。 */
function restoreLegacyDb(src: string): boolean {
  closeDb()
  const target = dbFilePath()
  copyFileSync(src, target)
  clearWalShm(target)
  getDb() // 立即重开，确保还原后的库可用（并触发缺失迁移）。
  return true
}

/**
 * 新版：解归档，整体替换数据库与 uploads 目录。
 * uploads 采用「整体替换 + 保留旧目录」：当前目录挪到 uploads.bak-<时间戳>，
 * 暂存目录顶上，与数据库快照语义一致（回到备份时间点），误操作可手动找回。
 */
function restoreArchive(src: string): boolean {
  const files = unzipSync(readFileSync(src))
  if (!(DB_ENTRY in files)) return false // 缺数据库，不是有效的 CRM 备份
  const dbBuf = files[DB_ENTRY]

  const uDir = uploadDir()
  const parent = resolve(uDir, '..')

  // 先把上传文件全部解到暂存目录，成功后再切换，避免半途失败破坏现有数据。
  const staging = resolve(parent, `.uploads-restore-${tsSuffix()}`)
  if (existsSync(staging)) rmSync(staging, { recursive: true, force: true })
  mkdirSync(staging, { recursive: true })
  try {
    for (const [path, buf] of Object.entries(files)) {
      if (!path.startsWith(UPLOADS_PREFIX)) continue
      const fname = path.slice(UPLOADS_PREFIX.length)
      if (!fname || fname.includes('/')) continue // 只收一层，防穿越
      writeFileSync(resolve(staging, fname), buf)
    }
  } catch (e) {
    rmSync(staging, { recursive: true, force: true })
    throw e
  }

  // 1) 还原数据库（writeFileSync 落到 data 目录，最稳，放前面）。
  closeDb()
  const target = dbFilePath()
  writeFileSync(target, dbBuf)
  clearWalShm(target)

  // 2) 整体替换 uploads：旧目录挪到 .bak，暂存目录顶上（同一父目录，rename 原子）。
  if (existsSync(uDir)) {
    renameSync(uDir, resolve(parent, `uploads.bak-${tsSuffix()}`))
  }
  renameSync(staging, uDir)

  getDb()
  return true
}

/** 清掉数据库的 WAL/SHM 副本，避免还原后旧日志污染。 */
function clearWalShm(dbPath: string): void {
  for (const ext of ['-wal', '-shm']) {
    const f = `${dbPath}${ext}`
    if (existsSync(f)) rmSync(f)
  }
}

/** 删除指定备份文件。 */
export function deleteBackup(name: string): boolean {
  const full = resolveBackupPath(name)
  if (!full) return false
  rmSync(full)
  return true
}
