import { useEffect, useState } from 'react'
import type * as DooTaskTools from '@dootask/tools'
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
          const root = document.documentElement
          root.classList.toggle('dark', dark)
          root.classList.toggle('light', !dark)
          // 同步 color-scheme，否则首屏内联脚本写的旧值会残留（如 light 主题下仍 color-scheme: dark）。
          root.style.colorScheme = dark ? 'dark' : 'light'
        } catch {
          /* 主题获取失败不影响主流程 */
        }
        const typedUser = user as unknown as DooTaskUser
        // 写入全局鉴权状态，供 lib/api 的 api() 自动带上身份头。
        setAuth({
          userId: typedUser.userid,
          token: token ?? null,
        })
        if (!cancelled) {
          setState({
            status: 'ready',
            user: typedUser,
            token: token ?? null,
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

export type PickUsersResult =
  | { status: 'picked'; ids: Array<number> }
  | { status: 'cancelled' }
  | { status: 'standalone' }

/**
 * 打开 DooTask 用户选择器，返回判别式结果：
 * - picked：用户点了「确定」，ids 为所选用户。
 * - cancelled：用户关闭/取消选择器（点右上角关闭或未选），调用方应「不做任何修改」。
 * - standalone：当前不在 DooTask 微前端环境，调用方应降级为手动输入。
 *
 * 注意 selectUsers 的参数是 `multipleMax`（之前误写成 max）；取消时它会 reject，
 * 这里捕获并归为 cancelled，避免把「取消」当成「独立模式」而误弹手动输入。
 */
export async function pickUsers(params?: {
  value?: Array<number>
  multiple?: boolean
}): Promise<PickUsersResult> {
  let tools: typeof DooTaskTools
  try {
    tools = await import('@dootask/tools')
  } catch {
    return { status: 'standalone' }
  }
  let micro = false
  try {
    micro = await tools.isMicroApp()
  } catch {
    micro = false
  }
  if (!micro) return { status: 'standalone' }
  try {
    const ids = await tools.selectUsers({
      value: params?.value ?? [],
      multipleMax: params?.multiple === false ? 1 : undefined,
    })
    if (!Array.isArray(ids) || ids.length === 0) return { status: 'cancelled' }
    return { status: 'picked', ids }
  } catch {
    // 用户关闭/取消选择器
    return { status: 'cancelled' }
  }
}

/**
 * 通过主程序下载文件（@dootask/tools 的 downloadUrl）。
 * 我们的备份下载接口不校验 DooTask token，故传 token:false 避免附加 token。
 * 独立模式回退到浏览器直接打开。
 */
export async function downloadViaDooTask(url: string): Promise<void> {
  try {
    const tools = await import('@dootask/tools')
    if (!(await tools.isMicroApp())) {
      window.open(url, '_blank')
      return
    }
    await tools.downloadUrl({ url, token: false })
  } catch {
    try {
      window.open(url, '_blank')
    } catch {
      /* 忽略 */
    }
  }
}

/** 二次确认对话框，返回是否确认。独立模式回退到 window.confirm。 */
export async function confirmDialog(opts: {
  title: string
  content?: string
  okText?: string
  cancelText?: string
}): Promise<boolean> {
  try {
    const tools = await import('@dootask/tools')
    if (!(await tools.isMicroApp())) {
      return window.confirm(
        opts.content ? `${opts.title}\n${opts.content}` : opts.title,
      )
    }
    return await tools.modalConfirm(opts)
  } catch {
    return false
  }
}

export interface PreviewImageItem {
  src: string
  width?: number
  height?: number
}

/**
 * 调用主程序的图片预览（@dootask/tools.callExtraStore('previewImage')）。
 * list 为同一组图片，index 为点击项下标。独立模式回退到新窗口打开当前图。
 */
export async function previewImage(
  list: Array<PreviewImageItem>,
  index = 0,
): Promise<void> {
  if (list.length === 0) return
  const openFallback = () => {
    try {
      window.open(list[index]?.src ?? list[0].src, '_blank')
    } catch {
      /* 忽略 */
    }
  }
  try {
    const tools = await import('@dootask/tools')
    if (!(await tools.isMicroApp())) {
      openFallback()
      return
    }
    await tools.callExtraStore('previewImage', { index, list })
  } catch {
    openFallback()
  }
}

export interface DooTaskTaskHit {
  task_id: number
  name: string
  project_name?: string
}

/**
 * 搜索当前用户可见/参与的任务（主程序 api/search/task，已按权限过滤）。
 * - 返回命中列表（最多 ~20 条）。
 * - 独立模式（非微前端）返回 null，调用方据此降级为手动输入任务 ID。
 */
export async function searchDooTaskTasks(
  key: string,
): Promise<Array<DooTaskTaskHit> | null> {
  try {
    const tools = await import('@dootask/tools')
    if (!(await tools.isMicroApp())) return null
    const res = await tools.requestAPI({
      url: 'search/task',
      method: 'get',
      data: { key, take: 20 },
    })
    const data: unknown = res.data
    const rows: Array<Record<string, unknown>> = Array.isArray(data) ? data : []
    return rows
      .map((r) => ({
        task_id: Number(r.task_id ?? r.id),
        name: String(r.name ?? ''),
        project_name:
          typeof r.project_name === 'string' ? r.project_name : undefined,
      }))
      .filter((t) => Number.isFinite(t.task_id) && t.task_id > 0)
  } catch {
    return []
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
