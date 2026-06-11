import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { nitro } from 'nitro/vite'

// 插件挂载在主程序的 /apps/crm 前缀下，资源 URL 与路由都要带这个 base。
// 与 nginx.conf 的 location /apps/crm/、menu_items.url 的 apps/crm/ 必须完全一致。
const config = defineConfig({
  base: '/apps/crm/',
  resolve: { tsconfigPaths: true },
  plugins: [
    devtools(),
    nitro({
      rollupConfig: { external: [/^@sentry\//] },
      // 跟进到期提醒：每日 09:00（容器本地时区）跑一次。
      // node-server 预设启动时会拉起 croner 调度器执行 scheduledTasks。
      experimental: { tasks: true },
      tasks: {
        'crm:follow-reminder': {
          handler: fileURLToPath(
            new URL('./src/tasks/follow-reminder.ts', import.meta.url),
          ),
          description: '跟进到期提醒推送',
        },
      },
      scheduledTasks: { '0 9 * * *': ['crm:follow-reminder'] },
    }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
})

export default config
