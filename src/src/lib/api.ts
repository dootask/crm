// 前端 API 封装：统一前缀 /apps/crm/api，自动带上 DooTask 用户身份头。
// auth 由 DooTaskBridge / useDooTask 在握手成功后通过 setAuth 写入。

const API_BASE = '/apps/crm/api'

let _auth: { userId: number | null; token: string | null } = {
  userId: null,
  token: null,
}

// 握手闸门：任何请求发出前都要等 setAuth/releaseAuthGate 至少被调用一次，
// 否则会抢在 @dootask/tools 握手（异步写入身份头）之前以匿名身份发出，
// 被服务端按匿名处理（详情页/管理页直接打开或刷新时尤为明显）。
let _authReady = false
let _resolveReady: () => void = () => {}
const _readyPromise = new Promise<void>((resolve) => {
  _resolveReady = resolve
})

function markReady() {
  if (_authReady) return
  _authReady = true
  _resolveReady()
}

export function setAuth(auth: { userId: number | null; token: string | null }) {
  // 不允许用空身份覆盖已确立的有效身份：并发/重复握手其一失败或降级时，
  // 不应把另一次成功写入的真实用户清空。
  if (auth.userId == null && _auth.userId != null) {
    markReady()
    return
  }
  _auth = auth
  markReady()
}

/** 握手彻底失败时释放闸门（保留现有身份不动），避免请求永久挂起。 */
export function releaseAuthGate() {
  markReady()
}

/** 等握手完成再放行请求；SSR（无 window）下不等待，避免服务端渲染挂起。 */
async function whenAuthReady(): Promise<void> {
  if (_authReady) return
  if (typeof window === 'undefined') return
  await _readyPromise
}

export function getAuthUserId(): number | null {
  return _auth.userId
}

function authHeaders(): Record<string, string> {
  const h: Record<string, string> = {}
  if (_auth.userId != null) h['x-user-id'] = String(_auth.userId)
  if (_auth.token) h['x-user-token'] = _auth.token
  return h
}

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

/** 发起请求，自动解析 { data } / { error }。GET 用 api(path)；写操作传 method+body。 */
export async function api<T = unknown>(
  path: string,
  init?: RequestInit & { json?: unknown },
): Promise<T> {
  // 统一在此等握手完成，覆盖所有页面（含详情/管理页），不必逐个组件加守卫。
  await whenAuthReady()
  const headers: Record<string, string> = {
    ...authHeaders(),
    ...(init?.headers as Record<string, string> | undefined),
  }
  let body = init?.body
  if (init?.json !== undefined) {
    headers['content-type'] = 'application/json'
    body = JSON.stringify(init.json)
  }
  const res = await fetch(`${API_BASE}${path}`, { ...init, headers, body })
  let payload: unknown = null
  try {
    payload = await res.json()
  } catch {
    /* 无 body */
  }
  if (!res.ok) {
    const msg =
      (payload as { error?: string } | null)?.error || `请求失败 (${res.status})`
    throw new ApiError(msg, res.status)
  }
  return (payload as { data?: T } | null)?.data as T
}
