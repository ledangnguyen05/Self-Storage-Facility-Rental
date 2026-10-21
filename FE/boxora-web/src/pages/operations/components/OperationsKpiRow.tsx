import { AlarmClock, Banknote, Gauge, Siren } from 'lucide-react'
import { StatCard } from '@/components/ui'
import { formatCurrency, formatNumber, formatPercent } from '@/lib/format'
import type { useIncidentData } from '../hooks/useIncidentData'
import type { useOperationsReports } from '../hooks/useOperationsReports'

export interface OperationsKpiRowProps {
  reports: ReturnType<typeof useOperationsReports>
  incidents: ReturnType<typeof useIncidentData>
}

const UNAVAILABLE = 'Chưa có dữ liệu'

/** Four portfolio KPIs: net revenue, physical occupancy, overdue debt and open incidents. */
export function OperationsKpiRow({ reports, incidents }: OperationsKpiRowProps) {
  const { revenue, occupancy, debt, scopeRevenue, scopeOccupancy } = reports
  const ticketStats = incidents.stats.data
  const debtReport = debt.data

  const openIncidents = ticketStats ? ticketStats.openTickets + ticketStats.inProgressTickets + ticketStats.reopenedTickets : null

  // Debt that is really overdue: items still inside the grace window are not counted until it ends.
  const overdueDebt = debtReport ? (debtReport.delinquentDebtAmount ?? debtReport.totalDebtAmount) : null
  const overdueCount = debtReport ? (debtReport.delinquentCount ?? debtReport.totalOverdueCount) : 0
  const lockedUnits = debtReport ? (debtReport.lockedUnitCount ?? debtReport.accessBlockedCount) : 0

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        label="Doanh thu thực thu"
        icon={Banknote}
        tone="info"
        loading={revenue.isLoading}
        value={scopeRevenue ? formatCurrency(scopeRevenue.totalRevenue) : '—'}
        hint={
          scopeRevenue
            ? `Đã thu ${formatCurrency(scopeRevenue.collectedAmount)} · đã hoàn ${formatCurrency(scopeRevenue.refundedAmount)} · ${formatNumber(scopeRevenue.paymentCount)} giao dịch`
            : revenue.error
              ? 'Không tải được báo cáo'
              : UNAVAILABLE
        }
      />
      <StatCard
        label="Công suất vật lý"
        icon={Gauge}
        tone="success"
        loading={occupancy.isLoading}
        value={scopeOccupancy ? formatPercent(scopeOccupancy.occupancyRate, { fractionDigits: 1 }) : '—'}
        hint={
          scopeOccupancy
            ? `${formatNumber(scopeOccupancy.occupiedUnits)}/${formatNumber(scopeOccupancy.totalUnits)} kho đang thuê · còn trống ${formatNumber(scopeOccupancy.availableUnits)}${
                scopeOccupancy.lockedUnits > 0 ? ` · ${formatNumber(scopeOccupancy.lockedUnits)} kho bị khóa do nợ` : ''
              }`
            : occupancy.error
              ? 'Không tải được báo cáo'
              : UNAVAILABLE
        }
      />
      <StatCard
        label="Nợ quá hạn"
        icon={AlarmClock}
        tone="danger"
        loading={debt.isLoading}
        value={overdueDebt !== null ? formatCurrency(overdueDebt) : '—'}
        hint={
          debtReport
            ? `${formatNumber(overdueCount)} khoản quá hạn · ${formatNumber(lockedUnits)} kho đã khóa${
                debtReport.gracePeriodCount > 0 ? ` · ${formatNumber(debtReport.gracePeriodCount)} đang trong ân hạn` : ''
              }`
            : debt.error
              ? 'Không tải được báo cáo'
              : UNAVAILABLE
        }
      />
      <StatCard
        label="Sự cố đang mở"
        icon={Siren}
        tone="warning"
        loading={incidents.stats.isLoading}
        value={openIncidents === null ? '—' : formatNumber(openIncidents)}
        hint={
          ticketStats
            ? `${formatNumber(ticketStats.overdueTickets)} quá hạn SLA`
            : incidents.stats.error
              ? 'Không tải được thống kê'
              : UNAVAILABLE
        }
      />
    </div>
  )
}
