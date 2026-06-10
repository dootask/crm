import { useEffect, useLayoutEffect, useRef } from 'react'
import { useRouterState } from '@tanstack/react-router'
import { DashboardView } from '#/components/views/dashboard'
import { CustomersView } from '#/components/views/customers-list'
import { OpportunitiesView } from '#/components/views/opportunities-list'

// 三个列表视图常驻挂载，按当前路径显隐切换（类似 Vue keep-alive）。
// 详情页（/customers/$id 等）走 __root 的 Outlet，单独渲染，不在这里。
const VIEWS = [
  { path: '/', Comp: DashboardView },
  { path: '/customers', Comp: CustomersView },
  { path: '/opportunities', Comp: OpportunitiesView },
] as const

// basepath 可能为 /apps/crm，统一归一化成应用内相对路径。
function normalize(pathname: string): string {
  const p = pathname.replace(/^\/apps\/crm/, '')
  return p === '' ? '/' : p
}

export function KeepAliveViews() {
  const raw = useRouterState({ select: (s) => s.location.pathname })
  const pathname = normalize(raw)
  const scrollMap = useRef<Record<string, number>>({})
  const prev = useRef<string | null>(null)

  useLayoutEffect(() => {
    if (prev.current && prev.current !== pathname) {
      scrollMap.current[prev.current] = window.scrollY
    }
    if (VIEWS.some((v) => v.path === pathname)) {
      const y = scrollMap.current[pathname] ?? 0
      requestAnimationFrame(() => window.scrollTo(0, y))
    }
    prev.current = pathname
  }, [pathname])

  return (
    <>
      {VIEWS.map(({ path, Comp }) => {
        const active = pathname === path
        return (
          <div key={path} hidden={!active}>
            <Comp active={active} />
          </div>
        )
      })}
    </>
  )
}

/**
 * 当视图从「非激活」变为「激活」时执行 fn（用于切回页面时后台刷新）。
 * 首次挂载不触发（交给组件自身的初始加载）。
 */
export function useActivate(active: boolean, fn: () => void) {
  const wasActive = useRef(active)
  const fnRef = useRef(fn)
  fnRef.current = fn
  useEffect(() => {
    if (active && !wasActive.current) fnRef.current()
    wasActive.current = active
  }, [active])
}
