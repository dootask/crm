// 前端 API 封装：统一前缀 /apps/crm/api，自动带上 DooTask 用户身份头。
// auth 由 DooTaskBridge / useDooTask 在握手成功后通过 setAuth 写入。

const API_BASE = '/apps/crm/api'

let _auth: { userId: number | null; token: string | null } = {
  userId: null,
  token: null,
}

export function setAuth(auth: { userId: number | null; token: string | null }) {
  _auth = auth
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
