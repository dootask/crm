// 数据库备份/还原：备份文件落在 CRM_DATA_DIR/backups 下，文件名 crm-YYYYMMDD-HHmmss.db。
// 仅管理员可用（鉴权在 API 层做）。

import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  statSync,
} from 'node:fs'
import { resolve } from 'node:path'
import { closeDb, dataDir, dbFilePath, getDb } from '#/lib/db'

export interface BackupEntry {
  name: string
  size: number
  createdAt: string // ISO，取文件修改时间
}

/** 仅允许我们自己生成的备份文件名，杜绝路径穿越。 */
const NAME_RE = /^crm-\d{8}-\d{6}\.db$/

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

function timestampName(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return (
    `crm-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-` +
    `${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}.db`
  )
}

/**
 * 生成一份新备份并返回其元信息。
 * 用 better-sqlite3 的在线 backup API，能在 WAL 模式下产出一致快照。
 * 同一秒重复点击会撞名，循环补后缀避免覆盖。
 */
export async function createBackup(): Promise<BackupEntry> {
  const dir = backupDir()
  mkdirSync(dir, { recursive: true })
  let name = timestampName()
  if (existsSync(resolve(dir, name))) {
    let i = 1
    const base = name.replace(/\.db$/, '')
    while (existsSync(resolve(dir, `${base}-${i}.db`))) i++
    name = `${base}-${i}.db`
  }
  await getDb().backup(resolve(dir, name))
  const st = statSync(resolve(dir, name))
  return { name, size: st.size, createdAt: st.mtime.toISOString() }
}

/** 用指定备份覆盖当前数据库；先关闭连接再换文件，清掉 WAL/SHM 副本。 */
export function restoreBackup(name: string): boolean {
  const src = resolveBackupPath(name)
  if (!src) return false
  closeDb()
  const target = dbFilePath()
  copyFileSync(src, target)
  for (const ext of ['-wal', '-shm']) {
    const f = `${target}${ext}`
    if (existsSync(f)) rmSync(f)
  }
  // 立即重开，确保还原后的库可用（并触发缺失迁移）。
  getDb()
  return true
}

/** 删除指定备份文件。 */
export function deleteBackup(name: string): boolean {
  const full = resolveBackupPath(name)
  if (!full) return false
  rmSync(full)
  return true
}
