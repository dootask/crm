import { createFileRoute } from '@tanstack/react-router'

// 客户列表内容在常驻视图 components/views/customers-list.tsx（保活），此路由仅占位。
export const Route = createFileRoute('/customers/')({ component: () => null })
