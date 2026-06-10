import type { AuthUser, Customer, Opportunity } from '#/lib/types'
import { canAccess, forbidden, notFound } from '#/lib/auth'
import { getCustomer } from '#/lib/repo/customers'
import { getOpportunity } from '#/lib/repo/opportunities'

/**
 * 校验当前用户能否访问某客户（管理员或负责人）。
 * 返回 { customer } 或 { deny: Response }，供路由处理函数直接返回 deny。
 */
export function requireCustomer(
  user: AuthUser,
  id: number,
): { customer: Customer; deny?: undefined } | { customer?: undefined; deny: Response } {
  const customer = getCustomer(id)
  if (!customer) return { deny: notFound('客户不存在') }
  if (!canAccess(user, customer.owner_id)) return { deny: forbidden('无权访问该客户') }
  return { customer }
}

export function requireOpportunity(
  user: AuthUser,
  id: number,
):
  | { opportunity: Opportunity; deny?: undefined }
  | { opportunity?: undefined; deny: Response } {
  const opportunity = getOpportunity(id)
  if (!opportunity) return { deny: notFound('商机不存在') }
  if (!canAccess(user, opportunity.owner_id))
    return { deny: forbidden('无权访问该商机') }
  return { opportunity }
}
