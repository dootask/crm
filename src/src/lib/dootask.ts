import { useEffect, useState } from 'react'
import { setAuth } from '#/lib/api'

export interface DooTaskUser {
  userid: number
  nickname?: string
  email?: string
  [key: string]: unknown
}

export type DooTaskStatus = 'loading' | 'ready' | 'standalone' | 'error'

export interface DooTaskState {
  status: DooTaskStatus
  user: DooTaskUser | null
  token: string | null
}

/**
 * 与主程序握手：appReady() 后取当前用户信息。
 * - 在 DooTask 微前端里：status=ready，user 为当前登录用户。
 * - 直接浏览器打开（脱离宿主）：捕获 UnsupportedError，status=standalone。
 * @dootask/tools 是浏览器侧库，动态 import 以避免 SSR 阶段触碰 window。
 */
export function useDooTask(): DooTaskState {
  const [state, setState] = useState<DooTaskState>({
    status: 'loading',
    user: null,
    token: null,
  })

  useEffect(() => {
    let cancelled = false

    async function boot() {
      try {
        const tools = await import('@dootask/tools')
        const micro = await tools.isMicroApp()
        if (!micro) {
          // 独立模式：不带身份头，服务端回退到种子用户便于离线查看。
          setAuth({ userId: null, token: null })
          if (!cancelled) setState((s) => ({ ...s, status: 'standalone' }))
          return
        }
        await tools.appReady()
        const [user, token] = await Promise.all([
          tools.getUserInfo(),
          tools.getUserToken().catch(() => null),
        ])
        // 同步主程序主题到 <html>
        try {
          const theme = await tools.getThemeName()
          const dark = String(theme).includes('dark')
          document.documentElement.classList.toggle('dark', dark)
          document.documentElement.classList.toggle('light', !dark)
        } catch {
          /* 主题获取失败不影响主流程 */
        }
        const typedUser = user as unknown as DooTaskUser
        // 写入全局鉴权状态，供 lib/api 的 api() 自动带上身份头。
        setAuth({
          userId: typedUser.userid,
          token: (token as string | null) ?? null,
        })
        if (!cancelled) {
          setState({
            status: 'ready',
            user: typedUser,
            token: (token as string | null) ?? null,
          })
        }
      } catch (e) {
        const tools = await import('@dootask/tools').catch(() => null)
        if (tools && e instanceof tools.UnsupportedError) {
          if (!cancelled) setState((s) => ({ ...s, status: 'standalone' }))
        } else if (!cancelled) {
          setState((s) => ({ ...s, status: 'error' }))
        }
      }
    }

    boot()
    return () => {
      cancelled = true
    }
  }, [])

  return state
}

/**
 * 打开 DooTask 用户选择器，返回选中的用户 ID 列表。
 * 独立模式（非微前端）下返回 null，调用方应降级为手动输入。
 */
export async function pickUsers(params?: {
  value?: Array<number>
  multiple?: boolean
}): Promise<Array<number> | null> {
  try {
    const tools = await import('@dootask/tools')
    if (!(await tools.isMicroApp())) return null
    return await tools.selectUsers({
      value: params?.value ?? [],
      max: params?.multiple === false ? 1 : undefined,
    } as Parameters<typeof tools.selectUsers>[0])
  } catch {
    return null
  }
}

/** 在 DooTask 中打开指定任务。独立模式下静默失败。 */
export async function openDooTaskTask(taskId: number): Promise<void> {
  try {
    const tools = await import('@dootask/tools')
    if (!(await tools.isMicroApp())) return
    await tools.openTask(taskId)
  } catch {
    /* 独立模式忽略 */
  }
}
