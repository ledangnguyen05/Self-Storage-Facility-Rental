import React, { useMemo, useState } from 'react'
import { ChevronDown, Download, FileSpreadsheet, Printer } from 'lucide-react'
import { Alert, Button, DropdownMenu, DropdownMenuItem, PageHeader, Select, useToast } from '@/components/ui'
import { ALL_FACILITIES, useDashboardContext } from '@/components/layout/dashboardContext'
import { useAuth } from '@/context/AuthContext'
import { getApiErrorMessage } from '@/lib/apiError'
import { getFacilityStatusMeta } from '@/constants/statusMeta'
import { DateRangePopover } from './components/DateRangePopover'
import { FacilityComparisonTable } from './components/FacilityComparisonTable'
import { OperationsKpiRow } from './components/OperationsKpiRow'
import { PricingPolicySection } from './components/PricingPolicySection'
import { PaymentChannelDonut } from './components/charts/PaymentChannelDonut'
import { RevenueTrendChart } from './components/charts/RevenueTrendChart'
import { IncidentMonitor } from './components/incidents/IncidentMonitor'
import { useIncidentData } from './hooks/useIncidentData'
import { useOperationsReports } from './hooks/useOperationsReports'
import { ALL_TIME, describeRange, type DateRange } from './lib/dateRange'
import { exportRevenueCsv } from './lib/revenueCsv'
import type { Facility } from '@/types'

const facilityOptionLabel = (facility: Facility): string => {
  const base = facility.code ? `${facility.name} (${facility.code})` : facility.name
  const status = (facility.status ?? '').toUpperCase()
  return status && status !== 'ACTIVE' ? `${base} · ${getFacilityStatusMeta(status).label.toLowerCase()}` : base
}

/** Opens the print dialog once the export menu has closed, so the menu is not part of the page. */
const printReport = () => {
  window.requestAnimationFrame(() => window.requestAnimationFrame(() => window.print()))
}

/** /portal/business-manager: portfolio dashboard (revenue, occupancy, debt, incidents) plus pricing and policy management. */
export const OperationsDashboard: React.FC = () => {
  const { role } = useAuth()
  const toast = useToast()
  const { selectedFacility, setSelectedFacility, facilities } = useDashboardContext()

  const facilityId = selectedFacility === ALL_FACILITIES ? undefined : selectedFacility
  const [range, setRange] = useState<DateRange>(ALL_TIME)

  const reports = useOperationsReports(facilityId, range)
  const incidents = useIncidentData(facilityId)
  const { revenue, occupancy, debt, trend, channels } = reports

  const occupancyRows = useMemo(
    () => (occupancy.data?.byFacility ?? []).filter(row => !facilityId || row.facilityId === facilityId),
    [occupancy.data, facilityId],
  )
  const revenueRows = useMemo(
    () => (revenue.data?.byFacility ?? []).filter(row => !facilityId || row.facilityId === facilityId),
    [revenue.data, facilityId],
  )

  const reportError = revenue.error ?? occupancy.error ?? debt.error
  const facilityOptions = [
    { value: ALL_FACILITIES, label: 'Toàn hệ thống' },
    ...facilities.map(facility => ({ value: facility.id, label: facilityOptionLabel(facility) })),
  ]
  const scopeLabel = facilityOptions.find(option => option.value === selectedFacility)?.label ?? 'Toàn hệ thống'
  const periodLabel = describeRange(range, { from: revenue.data?.fromDate, to: revenue.data?.toDate })

  const handleExportCsv = () => {
    if (revenueRows.length === 0) {
      toast.warning('Chưa có dữ liệu doanh thu để xuất')
      return
    }
    exportRevenueCsv(revenueRows, {
      facilityName: facilityId ? facilities.find(facility => facility.id === facilityId)?.name : undefined,
      range,
      reported: { from: revenue.data?.fromDate, to: revenue.data?.toDate },
    })
    toast.success('Đã tải báo cáo doanh thu')
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Tổng quan kinh doanh"
        description="Doanh thu, công suất kho, công nợ và sự cố của các cơ sở."
        actions={
          <div className="contents print:hidden">
            <Select aria-label="Cơ sở báo cáo" className="w-56" value={selectedFacility} onChange={event => setSelectedFacility(event.target.value)} options={facilityOptions} />
            <DateRangePopover value={range} onApply={setRange} reported={{ from: revenue.data?.fromDate, to: revenue.data?.toDate }} />
            <DropdownMenu aria-label="Xuất báo cáo" trigger={<Button variant="secondary" leftIcon={Download} rightIcon={ChevronDown}>Xuất báo cáo</Button>}>
              <DropdownMenuItem icon={FileSpreadsheet} onSelect={handleExportCsv}>
                Tải CSV doanh thu
              </DropdownMenuItem>
              <DropdownMenuItem icon={Printer} onSelect={printReport}>
                In hoặc lưu PDF
              </DropdownMenuItem>
            </DropdownMenu>
          </div>
        }
      >
        {/* Filters are not printed, so the printed report states its own scope. */}
        <p className="hidden text-sm text-fg-muted print:block">
          Phạm vi: <span className="font-medium text-fg">{scopeLabel}</span> · Kỳ báo cáo: <span className="font-medium text-fg">{periodLabel}</span>
        </p>
      </PageHeader>

      {reportError ? (
        <Alert
          tone="danger"
          title="Một số báo cáo chưa tải được"
          action={
            <Button size="sm" variant="secondary" onClick={() => void reports.reloadAll()}>
              Thử lại
            </Button>
          }
        >
          {getApiErrorMessage(reportError)}
        </Alert>
      ) : null}

      <OperationsKpiRow reports={reports} incidents={incidents} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RevenueTrendChart trend={trend.data} isLoading={trend.isLoading} error={trend.error} onRetry={() => void trend.reload()} />
        </div>
        <PaymentChannelDonut report={channels.data} isLoading={channels.isLoading} error={channels.error} onRetry={() => void channels.reload()} />
      </div>

      <FacilityComparisonTable
        occupancyRows={occupancyRows}
        revenueRows={revenueRows}
        facilities={facilities}
        isLoading={occupancy.isLoading || revenue.isLoading}
        error={occupancy.error}
        onRetry={() => void occupancy.reload()}
        scopedFacilityId={facilityId}
        onSelectFacility={setSelectedFacility}
        onShowAll={() => setSelectedFacility(ALL_FACILITIES)}
      />

      <IncidentMonitor incidents={incidents} />

      {/* Editable prices and policies are not part of the printed report. */}
      <div className="print:hidden">
        <PricingPolicySection facilities={facilities} canManage={role === 'BUSINESS_MANAGER'} />
      </div>
    </div>
  )
}
