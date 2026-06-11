import { createFileRoute } from '@tanstack/react-router'
import { AdminGate } from '#/components/admin/admin-gate.tsx'
import { OptionManager } from '#/components/admin/option-manager.tsx'
import { BreadcrumbBar } from '#/components/detail/breadcrumb-bar.tsx'

export const Route = createFileRoute('/admin/opportunity-stage')({
  component: OpportunityStagePage,
})

function OpportunityStagePage() {
  return (
    <div>
      <BreadcrumbBar
        items={[{ label: '管理', to: '/admin' }, { label: '商机阶段' }]}
      />
      <AdminGate>
        <OptionManager
          category="opportunity_stage"
          title="商机阶段"
          description="商机列表筛选与详情里可选的阶段选项"
        />
      </AdminGate>
    </div>
  )
}
