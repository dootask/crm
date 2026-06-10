import type { AuthUser } from '#/lib/types'

function adminIds(): Array<number> {
  return (process.env.CRM_ADMIN_USER_IDS || '')
    .split(',')
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n))
}

/**
 * 解析当前请求用户。
 * - 前端 apiFetch 会带上 `x-user-id`（来自 @dootask/tools 的 getUserInfo），服务端据此判定身份与归属。
 * - 缺失（本地/独立模式直接访问）时回退到种子用户，便于离线查看演示数据。
 * - 管理员 = 用户 ID 在 CRM_ADMIN_USER_IDS 中；未配置管理员时所有人按管理员处理（单人/演示场景）。
 *
 * 注：插件运行在 DooTask iframe 内、已由主程序鉴权，这里采用「信任前端传入的 user-id」
 * 的轻量模型（与官方 asset-hub 一致）。如需更强校验，可在此用 dootask-server 的
 * DooTaskClient 以 x-user-token 反查主程序确认身份。
 */
export function resolveUser(request: Request): AuthUser {
  const header = request.headers.get('x-user-id')
  const parsed = header ? parseInt(header, 10) : NaN
  const admins = adminIds()
  const fallback = admins[0] ?? 1
  const userId = Number.isFinite(parsed) ? parsed : fallback
  const isAdmin = admins.length === 0 || admins.includes(userId)
  return { userId, isAdmin }
}

/** 是否可访问/修改某条归属 ownerId 的数据。 */
export function canAccess(user: AuthUser, ownerId: number): boolean {
  return user.isAdmin || user.userId === ownerId
}

/**
 * 列表归属过滤：管理员看全部；普通用户只看自己负责的。
 * 返回可直接拼进 WHERE 的片段（不含 WHERE 关键字）与参数。
 */
export function ownerScope(
  user: AuthUser,
  column = 'owner_id',
): { clause: string; params: Array<number> } {
  if (user.isAdmin) return { clause: '1=1', params: [] }
  return { clause: `${column} = ?`, params: [user.userId] }
}

// ---- 响应助手 ----
export const ok = (data: unknown, init?: ResponseInit) =>
  Response.json({ data }, init)
export const created = (data: unknown) => Response.json({ data }, { status: 201 })
export const badRequest = (error: string) =>
  Response.json({ error }, { status: 400 })
export const forbidden = (error = 'forbidden') =>
  Response.json({ error }, { status: 403 })
export const notFound = (error = 'not found') =>
  Response.json({ error }, { status: 404 })

/** 安全解析 JSON body，失败返回 null。 */
export async function readJson<T = Record<string, unknown>>(
  request: Request,
): Promise<T | null> {
  try {
    return (await request.json()) as T
  } catch {
    return null
  }
}
