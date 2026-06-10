import type { UserLite } from '#/lib/types'

// 服务端用 DooTask Node SDK 解析用户昵称（负责人展示用）。
// 生产环境主程序地址为服务名 http://nginx；本地/独立模式无法连通时优雅降级为「用户#<id>」。

const SERVER = process.env.DOOTASK_SERVER || 'http://nginx'
const cache = new Map<number, UserLite>()

type Client = {
  getUserBasic: (userid: number) => Promise<{
    userid: number
    nickname?: string
    email?: string
  }>
}

async function makeClient(token: string): Promise<Client | null> {
  try {
    const mod = await import('@dootask/tools')
    const Ctor = (mod as unknown as { DooTaskClient: new (o: unknown) => Client })
      .DooTaskClient
    return new Ctor({ token, server: SERVER, timeoutMs: 8000 })
  } catch {
    return null
  }
}

/**
 * 批量解析用户昵称。token 来自前端透传的 x-user-token。
 * 任意失败项回退为占位昵称，绝不抛错阻塞主流程。
 */
export async function resolveUsers(
  ids: Array<number>,
  token: string | null,
): Promise<Record<number, UserLite>> {
  const result: Record<number, UserLite> = {}
  const missing: Array<number> = []
  for (const id of ids) {
    if (cache.has(id)) result[id] = cache.get(id)!
    else missing.push(id)
  }

  if (missing.length && token) {
    const client = await makeClient(token)
    if (client) {
      await Promise.all(
        missing.map(async (id) => {
          try {
            const u = await client.getUserBasic(id)
            const lite: UserLite = {
              userid: id,
              nickname: u.nickname || `用户#${id}`,
              email: u.email,
            }
            cache.set(id, lite)
            result[id] = lite
          } catch {
            result[id] = { userid: id, nickname: `用户#${id}` }
          }
        }),
      )
    }
  }

  for (const id of missing) {
    if (!result[id]) result[id] = { userid: id, nickname: `用户#${id}` }
  }
  return result
}
