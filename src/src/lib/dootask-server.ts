import type { UserLite } from '#/lib/types'
import {
  SETTING_KEYS,
  getBotConfig,
  getSetting,
  setSetting,
} from '#/lib/repo/settings'

// 服务端用 DooTask Node SDK 与主程序交互：解析用户昵称、把机器人加入任务、回流动态。
// 生产环境主程序地址为服务名 http://nginx；本地/独立模式无法连通时优雅降级。

const SERVER = process.env.DOOTASK_SERVER || 'http://nginx'
const cache = new Map<number, UserLite>()

// DooTaskClient 暴露通用 get/post（自动带 Token 头、解包 data）与部分类型化方法。
// 这里只声明用到的，避免与 SDK 类型耦合。
type DTClient = {
  get: <T = unknown>(api: string, params?: unknown) => Promise<T>
  post: <T = unknown>(api: string, body?: unknown) => Promise<T>
  getUserBasic: (userid: number) => Promise<{
    userid: number
    nickname?: string
    email?: string
  }>
  getUserInfo: (noCache?: boolean) => Promise<{
    userid: number
    nickname?: string
    email?: string
    [k: string]: unknown
  }>
  getTask: (params: { task_id: number; archived?: string }) => Promise<{
    dialog_id?: number
    task_user?: Array<{ userid: number; owner: number }>
    [k: string]: unknown
  }>
  createTaskDialog: (params: { task_id: number }) => Promise<{
    dialog_id?: number
    [k: string]: unknown
  }>
}

async function makeClient(token: string): Promise<DTClient | null> {
  try {
    const mod = await import('@dootask/tools')
    const Ctor = (mod as unknown as { DooTaskClient: new (o: unknown) => DTClient })
      .DooTaskClient
    return new Ctor({ token, server: SERVER, timeoutMs: 8000 })
  } catch {
    return null
  }
}

/** 用已配置的机器人 token 构造客户端；未配置返回 null。 */
async function botClient(): Promise<DTClient | null> {
  const { token } = getBotConfig()
  if (!token) return null
  return makeClient(token)
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

  // 优先用调用方 token；缺失时退回机器人 token（定时任务等无操作人场景）。
  let token2 = token
  if (missing.length && !token2) token2 = getBotConfig().token

  if (missing.length && token2) {
    const client = await makeClient(token2)
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
    if (!(id in result)) result[id] = { userid: id, nickname: `用户#${id}` }
  }
  return result
}

/**
 * 用机器人身份向某任务对话发送一条文本（markdown）。
 * 机器人必须已是该任务成员（见 addBotToTask）；任何失败只记日志，绝不抛错。
 */
export async function sendTaskMessage(
  dialogId: number | null | undefined,
  text: string,
): Promise<boolean> {
  if (!dialogId) return false
  try {
    const client = await botClient()
    if (!client) return false
    await client.post('/api/dialog/msg/sendtext', {
      dialog_id: dialogId,
      text,
      text_type: 'md',
      update_mark: 'no', // 机器人专用：不计未读/打扰
    })
    return true
  } catch (e) {
    console.error('[crm] sendTaskMessage failed:', (e as Error).message)
    return false
  }
}

const DEFAULT_BOT_NAME = 'CRM机器人'

/** 机器人名称：管理员可在设置页自定义；未设置时用默认名。 */
function botName(): string {
  return getSetting(SETTING_KEYS.botName) || DEFAULT_BOT_NAME
}

/**
 * 重命名已存在的 CRM 机器人（DooTask bot/edit 需调用者是机器人创建者/拥有者）。
 * 用操作人 token 尽力而为；失败只记日志返回 false（名称仍会存进设置，下次创建生效）。
 */
export async function renameBot(
  botUserId: number,
  name: string,
  operatorToken: string | null,
): Promise<boolean> {
  if (!operatorToken || !botUserId || !name) return false
  try {
    const client = await makeClient(operatorToken)
    if (!client) return false
    await client.post('/api/users/bot/edit', { id: botUserId, name })
    return true
  } catch (e) {
    console.error('[crm] renameBot failed:', (e as Error).message)
    return false
  }
}

/** 异步等待（机器人回复 /token 是异步的，需轮询）。 */
function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

/**
 * 用操作人 token 向机器人私聊发 `/token` 指令并轮询取回机器人 token。
 * 机器人回复的是模板消息：{ type:'template', msg:{ type:'/token', data:{ token } } }。
 * 机器人 token 永久有效，取到后由调用方持久化，之后复用。
 */
async function fetchBotToken(
  client: DTClient,
  botUserId: number,
): Promise<string | null> {
  try {
    const dlg = await client.post<{ id?: number }>('/api/dialog/open/user', {
      userid: botUserId,
    })
    const dialogId = Number(dlg.id) || null
    if (!dialogId) return null
    await client.post('/api/dialog/msg/sendtext', {
      dialog_id: dialogId,
      text: '/token',
    })
    for (let i = 0; i < 6; i++) {
      await delay(1500)
      const res = await client.get<{
        list?: Array<{
          type?: string
          msg?: { type?: string; data?: { token?: string } }
        }>
      }>('/api/dialog/msg/list', { dialog_id: dialogId, take: 10 })
      const list = Array.isArray(res.list) ? res.list : []
      for (const m of list) {
        if (
          m.type === 'template' &&
          m.msg?.type === '/token' &&
          m.msg.data?.token
        ) {
          return String(m.msg.data.token)
        }
      }
    }
    return null
  } catch (e) {
    console.error('[crm] fetchBotToken failed:', (e as Error).message)
    return null
  }
}

/**
 * 确保存在一个可用的「CRM 机器人」并返回其 userid + token。
 * 首次调用（用操作人 token）：复用同名机器人或新建 → 取 token → 持久化到 sys_settings；
 * 之后命中缓存直接返回。失败返回 null（调用方据此降级，不阻断关联）。
 */
export async function ensureCrmBot(
  operatorToken: string | null,
): Promise<{ userid: number; token: string } | null> {
  const cfg = getBotConfig()
  if (cfg.token && cfg.userid) return { userid: cfg.userid, token: cfg.token }
  if (!operatorToken) return null
  try {
    const client = await makeClient(operatorToken)
    if (!client) return null
    const name = botName()
    // 复用优先：同名机器人已存在则取其 id（DooTask 不按 name 去重，避免重复创建）。
    let botId: number | null = null
    try {
      const list = await client.get<{
        list?: Array<{ id?: number; name?: string }>
      }>('/api/users/bot/list')
      const found = (list.list ?? []).find((b) => b.name === name)
      if (found) botId = Number(found.id) || null
    } catch {
      /* 列表取不到则走新建 */
    }
    if (!botId) {
      const bot = await client.post<{ id?: number }>('/api/users/bot/edit', {
        name,
      })
      botId = Number(bot.id) || null
    }
    if (!botId) return null
    const token = await fetchBotToken(client, botId)
    if (!token) return null
    setSetting(SETTING_KEYS.botUserId, String(botId))
    setSetting(SETTING_KEYS.botToken, token)
    setSetting(SETTING_KEYS.botName, name)
    return { userid: botId, token }
  } catch (e) {
    console.error('[crm] ensureCrmBot failed:', (e as Error).message)
    return null
  }
}

export type AddBotResult =
  | { ok: true; dialogId: number | null }
  | {
      ok: false
      reason: 'bot_unconfigured' | 'no_permission' | 'error'
      message: string
    }

/**
 * 把 CRM 机器人加入任务，使其能在任务群发言。
 * 用操作人 token：先取/建任务对话(project/task/dialog 懒创建)，再用 dialog/group/adduser
 * 增量把机器人加进任务群（任务群 owner_id=0，任意成员可加，且幂等）。
 * 注意不用 task/update 的 assist —— 那会校验「机器人是否在项目内」，不在则静默跳过。
 */
export async function addBotToTask(
  taskId: number,
  operatorToken: string | null,
): Promise<AddBotResult> {
  if (!operatorToken)
    return { ok: false, reason: 'no_permission', message: '缺少用户凭据，无法将机器人加入任务' }
  const bot = await ensureCrmBot(operatorToken)
  if (!bot)
    return { ok: false, reason: 'bot_unconfigured', message: '无法创建或获取 CRM 机器人（请确认插件能访问主程序）' }
  try {
    const client = await makeClient(operatorToken)
    if (!client) return { ok: false, reason: 'error', message: '无法连接主程序' }
    // 取/建任务对话（新任务 dialog 懒创建，此调用会创建并返回 dialog_id）。
    const td = await client.get<{ dialog_id?: number }>(
      '/api/project/task/dialog',
      { task_id: taskId },
    )
    const dialogId = Number(td.dialog_id) || null
    if (!dialogId)
      return { ok: false, reason: 'error', message: '无法获取任务对话' }
    await client.post('/api/dialog/group/adduser', {
      dialog_id: dialogId,
      userids: [bot.userid],
    })
    return { ok: true, dialogId }
  } catch (e) {
    const msg = String((e as Error).message || '')
    const noPerm = /权限|permission|管理员|群主|不在/i.test(msg)
    return {
      ok: false,
      reason: noPerm ? 'no_permission' : 'error',
      message: noPerm
        ? '无权把机器人加入该任务（需要是任务成员）'
        : `关联失败：${msg || '未知错误'}`,
    }
  }
}

/** 校验机器人 token，返回机器人用户信息；无效返回 null。 */
export async function verifyBotToken(
  token: string,
): Promise<{ userid: number; nickname: string } | null> {
  try {
    const client = await makeClient(token)
    if (!client) return null
    const u = await client.getUserInfo(true)
    if (!u.userid) return null
    return { userid: Number(u.userid), nickname: u.nickname || `用户#${u.userid}` }
  } catch {
    return null
  }
}

export interface ProjectLite {
  id: number
  name: string
  columns: Array<{ id: number; name: string }>
}

/**
 * 列出操作人可见的项目及其列表（用于「创建关联任务」时选择项目/列）。
 * 用操作人 token；失败/独立模式返回空数组。
 */
export async function listProjectsWithColumns(
  token: string | null,
): Promise<Array<ProjectLite>> {
  if (!token) return []
  try {
    const client = await makeClient(token)
    if (!client) return []
    // getcolumn=yes 让返回里带上 project_column；pagesize 取大些覆盖常见数量。
    const res = await client.get<{
      data?: Array<Record<string, unknown>>
    }>('/api/project/lists', { getcolumn: 'yes', pagesize: 100 })
    const rows = Array.isArray(res.data) ? res.data : []
    return rows.map((p) => {
      const cols = Array.isArray(p.project_column)
        ? (p.project_column as Array<Record<string, unknown>>)
        : []
      return {
        id: Number(p.id),
        name: String(p.name ?? `项目 #${p.id}`),
        columns: cols.map((c) => ({
          id: Number(c.id),
          name: String(c.name ?? ''),
        })),
      }
    })
  } catch (e) {
    console.error('[crm] listProjectsWithColumns failed:', (e as Error).message)
    return []
  }
}

/**
 * 创建任务（操作人 token，操作人即负责人）。返回新任务 id / 名称 / 对话 id。
 * 失败返回 null。
 */
export async function createTask(
  input: { project_id: number; column_id?: number | null; name: string },
  token: string | null,
): Promise<{ task_id: number; name: string; dialog_id: number | null } | null> {
  if (!token) return null
  try {
    const client = await makeClient(token)
    if (!client) return null
    const t = await client.post<{
      id?: number
      name?: string
      dialog_id?: number
    }>('/api/project/task/add', {
      project_id: input.project_id,
      column_id: input.column_id ?? undefined,
      name: input.name,
    })
    const taskId = Number(t.id)
    if (!Number.isFinite(taskId) || taskId <= 0) return null
    return {
      task_id: taskId,
      name: String(t.name ?? input.name),
      dialog_id: Number(t.dialog_id) || null,
    }
  } catch (e) {
    console.error('[crm] createTask failed:', (e as Error).message)
    return null
  }
}
