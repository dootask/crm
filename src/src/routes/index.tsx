import { createFileRoute } from '@tanstack/react-router'

// 仪表盘内容在常驻视图 components/views/dashboard.tsx（保活），此路由仅占位。
export const Route = createFileRoute('/')({ component: () => null })
