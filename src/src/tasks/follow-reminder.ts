import { defineTask } from 'nitro/task'
import { runFollowReminder } from '#/lib/reminder-job'

// 每日跟进到期提醒。由 vite.config 的 scheduledTasks 在每天 09:00 触发；
// 也可在开发期通过 Nitro dev tasks 面板手动运行。生产为 node-server 长驻进程，
// Nitro 的 croner 调度器会在启动时拉起（见 startScheduleRunner）。
export default defineTask({
  meta: {
    name: 'crm:follow-reminder',
    description: '把明天/今天到期的客户·商机跟进提醒推送到关联任务聊天',
  },
  async run() {
    const result = await runFollowReminder()
    console.log('[crm] follow-reminder:', JSON.stringify(result))
    return { result }
  },
})
