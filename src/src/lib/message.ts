// 统一的消息提示，封装 @dootask/tools 的 message* 方法。
// 浏览器侧动态 import 避免 SSR 触碰 window；非 DooTask 宿主（独立模式）降级到控制台。

type MessageKind = 'success' | 'error' | 'warning' | 'info'

async function show(kind: MessageKind, text: string): Promise<void> {
  try {
    const tools = await import('@dootask/tools')
    if (!(await tools.isMicroApp())) {
      console.log(`[${kind}] ${text}`)
      return
    }
    if (kind === 'success') await tools.messageSuccess(text)
    else if (kind === 'error') await tools.messageError(text)
    else if (kind === 'warning') await tools.messageWarning(text)
    else await tools.messageInfo(text)
  } catch {
    console.log(`[${kind}] ${text}`)
  }
}

export const messageSuccess = (text: string) => show('success', text)
export const messageError = (text: string) => show('error', text)
export const messageWarning = (text: string) => show('warning', text)
export const messageInfo = (text: string) => show('info', text)
