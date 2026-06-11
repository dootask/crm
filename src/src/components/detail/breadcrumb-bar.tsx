import { Fragment } from 'react'
import { Link } from '@tanstack/react-router'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '#/components/ui/breadcrumb.tsx'

export interface Crumb {
  label: string
  to?: string
  params?: Record<string, string>
}

/** 详情页内容区左上角的统一面包屑。最后一项作为当前页（不可点）。 */
export function BreadcrumbBar({ items }: { items: Array<Crumb> }) {
  return (
    <Breadcrumb className="mb-3">
      <BreadcrumbList>
        {items.map((c, i) => {
          const last = i === items.length - 1
          return (
            <Fragment key={i}>
              <BreadcrumbItem>
                {last || !c.to ? (
                  <BreadcrumbPage>{c.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link to={c.to} params={c.params}>
                      {c.label}
                    </Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
              {!last && <BreadcrumbSeparator />}
            </Fragment>
          )
        })}
      </BreadcrumbList>
    </Breadcrumb>
  )
}
