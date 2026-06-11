import { createFileRoute } from '@tanstack/react-router'
import { AdminGate } from '#/components/admin/admin-gate.tsx'
import { OptionManager } from '#/components/admin/option-manager.tsx'
import { BreadcrumbBar } from '#/components/detail/breadcrumb-bar.tsx'

export const Route = createFileRoute('/admin/customer-status')({
  component: CustomerStatusPage,
})

function CustomerStatusPage() {
  return (
    <div>
      <BreadcrumbBar
        items={[{ label: '管理', to: '/admin' }, { label: '客户状态' }]}
      />
      <AdminGate>
        <OptionManager
          category="customer_status"
          title="客户状态"
          description="客户列表筛选与详情里可选的状态选项"
        />
      </AdminGate>
    </div>
  )
}
