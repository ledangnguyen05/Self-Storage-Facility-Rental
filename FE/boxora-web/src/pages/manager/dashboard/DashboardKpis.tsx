import { CalendarCheck, Gauge, LockKeyhole, TriangleAlert } from 'lucide-react'
import { StatCard } from '@/components/ui'
import { formatNumber, formatPercent, toLocalISODate, todayISO } from '@/lib/format'
import type { OverdueLedger } from '@/services/overdueService'
import type { Booking, StorageUnit } from '@/types'
import type { SupportTicketRecord } from '@/services/supportTicketService'
import { isOpenTicket } from './ticketModel'
import { countByStatus, getPhysicalOccupancy } from './unitModel'

interface DashboardKpisProps {
  units: StorageUnit[]
  unitsLoading: boolean
  overdue: OverdueLedger | undefined
  arrivals: Booking[]
  arrivalsLoading: boolean
  tickets: SupportTicketRecord[]
  ticketsLoading: boolean
  onShowLockedUnits: () => void
  onShowArrivals: () => void
  onShowTickets: () => void
}

/** The four numbers a facility manager checks first: occupancy, overdue units, today's arrivals, open incidents. */
export function DashboardKpis({
  units,
  unitsLoading,
  overdue,
  arrivals,
  arrivalsLoading,
  tickets,
  ticketsLoading,
  onShowLockedUnits,
  onShowArrivals,
  onShowTickets,
}: DashboardKpisProps) {
  const counts = countByStatus(units)
  const occupancy = getPhysicalOccupancy(units)
  const rented = counts.OCCUPIED + counts.OVERDUE_LOCKED
  const today = todayISO()
  const arrivalsToday = arrivals.filter((booking) => toLocalISODate(booking.expectedCheckInAt || booking.startDate) === today).length
  const openTickets = tickets.filter(isOpenTicket).length

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        label="Công suất vật lý"
        value={occupancy === null ? '—' : formatPercent(occupancy, { fractionDigits: 1 })}
        icon={Gauge}
        loading={unitsLoading}
        hint={units.length > 0 ? `${formatNumber(rented)} trên ${formatNumber(units.length)} kho đang có khách` : 'Chưa có kho'}
      />
      <StatCard
        label="Kho quá hạn, bị khóa"
        value={formatNumber(counts.OVERDUE_LOCKED)}
        icon={LockKeyhole}
        tone={counts.OVERDUE_LOCKED > 0 ? 'danger' : 'neutral'}
        loading={unitsLoading}
        hint={overdue ? `${formatNumber(overdue.totalOverdueCount)} hợp đồng quá hạn, ${formatNumber(overdue.sealedCount)} đang niêm phong` : undefined}
        onClick={onShowLockedUnits}
      />
      <StatCard
        label="Khách đến hôm nay"
        value={formatNumber(arrivalsToday)}
        icon={CalendarCheck}
        loading={arrivalsLoading}
        hint={`${formatNumber(arrivals.length)} lịch hẹn chờ bàn giao`}
        onClick={onShowArrivals}
      />
      <StatCard
        label="Sự cố đang mở"
        value={formatNumber(openTickets)}
        icon={TriangleAlert}
        tone={openTickets > 0 ? 'warning' : 'neutral'}
        loading={ticketsLoading}
        hint="Chưa xử lý hoặc đang xử lý"
        onClick={onShowTickets}
      />
    </div>
  )
}
