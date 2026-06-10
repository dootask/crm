import { createFileRoute } from '@tanstack/react-router'

// 商机列表内容在常驻视图 components/views/opportunities-list.tsx（保活），此路由仅占位。
export const Route = createFileRoute('/opportunities/')({
  component: () => null,
})
