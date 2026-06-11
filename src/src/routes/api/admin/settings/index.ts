import { createFileRoute } from '@tanstack/react-router'
import { badRequest, forbidden, ok, readJson, resolveUser } from '#/lib/auth'
import {
  SETTING_KEYS,
  getBotConfig,
  isNotifyEnabled,
  setSetting,
} from '#/lib/repo/settings'
import { renameBot, verifyBotToken } from '#/lib/dootask-server'

/** 设置对外视图：绝不回传 token 明文，只回「是否已配置」与机器人身份。 */
function publicView() {
  const bot = getBotConfig()
  return {
    bot_configured: !!bot.token && !!bot.userid,
    bot_userid: bot.userid,
    bot_name: bot.name,
    notify_enabled: isNotifyEnabled(),
  }
}

// GET /apps/crm/api/admin/settings   读取动态推送配置（仅管理员，token 脱敏）
// PUT /apps/crm/api/admin/settings   更新 { bot_token?, notify_enabled? }（仅管理员）
export const Route = createFileRoute('/api/admin/settings/')({
  server: {
    handlers: {
      GET: ({ request }: { request: Request }) => {
        const user = resolveUser(request)
        if (!user.isAdmin) return forbidden()
        return ok(publicView())
      },

      PUT: async ({ request }: { request: Request }) => {
        const user = resolveUser(request)
        if (!user.isAdmin) return forbidden()
        const body = await readJson(request)
        if (!body) return badRequest('请求体无效')
        const b = body

        // 机器人 token：传空串=重置（清 token/userid，保留自定义名称，下次关联重建）；
        // 传非空=校验后保存并回填 userid/name；不传=不动。
        if (b.bot_token !== undefined) {
          const token = String(b.bot_token ?? '').trim()
          if (!token) {
            setSetting(SETTING_KEYS.botToken, null)
            setSetting(SETTING_KEYS.botUserId, null)
          } else {
            const info = await verifyBotToken(token)
            if (!info)
              return badRequest('机器人 Token 无效或无法连接主程序，请检查后重试')
            setSetting(SETTING_KEYS.botToken, token)
            setSetting(SETTING_KEYS.botUserId, String(info.userid))
            setSetting(SETTING_KEYS.botName, info.nickname)
          }
        }

        // 机器人名称：存为创建时用名；若机器人已存在则用管理员 token 实际改名（尽力而为）。
        if (b.bot_name !== undefined) {
          const name = String(b.bot_name ?? '').trim()
          if (name.length < 2 || name.length > 20)
            return badRequest('机器人名称需 2-20 个字符')
          setSetting(SETTING_KEYS.botName, name)
          const cfg = getBotConfig()
          if (cfg.userid)
            await renameBot(cfg.userid, name, request.headers.get('x-user-token'))
        }

        if (b.notify_enabled !== undefined) {
          setSetting(SETTING_KEYS.notifyEnabled, b.notify_enabled ? '1' : '0')
        }

        return ok(publicView())
      },
    },
  },
})
