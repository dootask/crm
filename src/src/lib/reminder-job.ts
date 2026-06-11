import { dbDate, listDueFollowTargets } from '#/lib/repo/reminders'
import { sendTaskMessage } from '#/lib/dootask-server'
import { isNotifyEnabled, getBotConfig } from '#/lib/repo/settings'

/**
 * 跟进到期提醒：把「明天到期」「今天到期」的客户/商机各推一次到其关联任务聊天。
 * 只取这两个临界日，天然实现每个阈值各提醒一次、不天天刷屏（无需额外状态列）。
 * 由每日定时任务调用；也可由管理员手动触发用于验证。返回各阶段发送条数。
 */
export async function runFollowReminder(): Promise<{
  upcoming: number
  due: number
  skipped: boolean
}> {
  // 未开启推送或未配置机器人时直接跳过（机器人 token 用于发送）。
  if (!isNotifyEnabled() || !getBotConfig().token) {
    return { upcoming: 0, due: 0, skipped: true }
  }

  const stages: Array<{ offset: number; build: (label: string, name: string, date: string) => string }> = [
    {
      offset: 1, // 明天到期：即将到期提醒
      build: (label, name, date) => `⏰ 提醒：${label}「${name}」明天（${date}）需要跟进`,
    },
    {
      offset: 0, // 今天到期：到期提醒
      build: (label, name, date) => `⚠️ 提醒：${label}「${name}」今天（${date}）需要跟进`,
    },
  ]

  const counts = { upcoming: 0, due: 0, skipped: false }
  for (const stage of stages) {
    const date = dbDate(stage.offset)
    const targets = listDueFollowTargets(date)
    for (const t of targets) {
      const label = t.entity_type === 'customer' ? '客户' : '商机'
      const okSent = await sendTaskMessage(t.dialog_id, stage.build(label, t.name, date))
      if (okSent) {
        if (stage.offset === 1) counts.upcoming++
        else counts.due++
      }
    }
  }
  return counts
}
