import { useMemo, useState } from 'react'
import { Building2, CircleCheck, MapPinned, Plus, RefreshCw, Wrench } from 'lucide-react'
import { PageHeader, StatCard, Button } from '@/components/ui'
import { usePageTitle } from '@/pages/public/components/usePageTitle'
import { useAuth } from '@/context/AuthContext'
import { useAsyncData } from '@/hooks/useAsyncData'
import { formatNumber } from '@/lib/format'
import { facilityService } from '@/services/facilityService'
import type { Facility } from '@/types'
import { FacilityConfigurationPanel } from '../FacilityConfigurationPanel'
import { FacilityForm } from '../facility/FacilityForm'

/** Editor target: `null` = closed, `{ facility: null }` = create, `{ facility }` = edit. */
type EditorTarget = { facility: Facility | null } | null

const FACILITY_PAGE_SIZE = 100

/** Branch configuration. The business manager and the system administrator create and edit branches (SRS 3.3.2). */
export function FacilitiesSection() {
  usePageTitle('Cấu hình chi nhánh')
  const { role } = useAuth()
  const canManage = role === 'BUSINESS_MANAGER' || role === 'ADMIN'
  const canEditPolicy = role === 'BUSINESS_MANAGER'
  const { data, error, isLoading, isRefreshing, reload } = useAsyncData(signal => facilityService.getFacilities({ size: FACILITY_PAGE_SIZE }, { signal }), [])
  const facilities = useMemo<Facility[]>(() => data?.content ?? [], [data])
  const [editor, setEditor] = useState<EditorTarget>(null)

  const counts = useMemo(
    () => ({
      total: facilities.length,
      active: facilities.filter(facility => !facility.status || facility.status === 'ACTIVE').length,
      paused: facilities.filter(facility => facility.status === 'INACTIVE' || facility.status === 'MAINTENANCE').length,
      located: facilities.filter(facility => facility.latitude != null && facility.longitude != null).length,
    }),
    [facilities],
  )
  const showCounts = !isLoading && !error

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Cấu hình chi nhánh"
        description={
          canManage
            ? 'Thêm mới và quản lý thông tin chi nhánh, vị trí GPS và sơ đồ mặt bằng các tầng kho.'
            : 'Tra cứu thông tin chi nhánh, vị trí GPS và sơ đồ mặt bằng.'
        }
        actions={
          <>
            <Button variant="secondary" leftIcon={RefreshCw} loading={isRefreshing} onClick={() => void reload()}>
              Làm mới
            </Button>
            {canManage ? (
              <Button leftIcon={Plus} onClick={() => setEditor({ facility: null })}>
                Thêm chi nhánh
              </Button>
            ) : null}
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Tổng số chi nhánh" icon={Building2} loading={isLoading} value={showCounts ? formatNumber(counts.total) : '—'} />
        <StatCard label="Đang hoạt động" icon={CircleCheck} tone="success" loading={isLoading} value={showCounts ? formatNumber(counts.active) : '—'} />
        <StatCard label="Tạm ngưng hoặc bảo trì" icon={Wrench} tone="warning" loading={isLoading} value={showCounts ? formatNumber(counts.paused) : '—'} />
        <StatCard
          label="Đã định vị GPS"
          icon={MapPinned}
          tone="info"
          loading={isLoading}
          value={showCounts ? formatNumber(counts.located) : '—'}
          hint={showCounts && counts.total > counts.located ? `${formatNumber(counts.total - counts.located)} chi nhánh chưa có tọa độ` : undefined}
        />
      </div>

      <FacilityConfigurationPanel
        facilities={facilities}
        isLoading={isLoading}
        error={error}
        onRetry={() => void reload()}
        canManage={canManage}
        canEditPolicy={canEditPolicy}
        onEdit={facility => setEditor({ facility })}
        onCreate={() => setEditor({ facility: null })}
      />

      {editor ? <FacilityForm facility={editor.facility} onClose={() => setEditor(null)} onSaved={() => void reload()} /> : null}
    </div>
  )
}
