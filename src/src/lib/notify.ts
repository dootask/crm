import { listTaskLinks } from '#/lib/repo/tasklinks'
import { sendTaskMessage } from '#/lib/dootask-server'
import { isNotifyEnabled } from '#/lib/repo/settings'
import type { EntityType } from '#/lib/types'

/**
 * 把一条 CRM 动态推送到某客户/商机关联的所有任务聊天。
 * - 受总开关与机器人配置控制；任一不满足则静默跳过。
 * - 用关联时缓存的 dialog_id 直接发，缺失（旧数据）的关联跳过。
 * - 整段 fire-and-forget：失败只记日志，绝不影响 CRM 主流程。
 */
export async function notifyTaskLinks(
  entityType: EntityType,
  entityId: number,
  text: string,
): Promise<void> {
  try {
    if (!isNotifyEnabled()) return
    const links = listTaskLinks(entityType, entityId)
    const targets = links.filter((l) => l.dialog_id)
    if (targets.length === 0) return
    await Promise.all(
      targets.map((l) => sendTaskMessage(l.dialog_id, text)),
    )
  } catch (e) {
    console.error('[crm] notifyTaskLinks failed:', (e as Error).message)
  }
}
