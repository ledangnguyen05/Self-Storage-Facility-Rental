import { CalendarClock, CalendarDays, Package, Wallet } from 'lucide-react'
import { StatCard } from '@/components/ui'
import { formatCurrency, formatDate, formatNumber, formatRelativeTime } from '@/lib/format'
import type { RentalContract } from '@/types'

interface DashboardKpisProps {
  heldCount: number
  overdueCount: number
  pendingCheckInCount: number
  bookingCount: number
  monthlyTotal: number
  nearestEnding?: RentalContract
  contractsLoading: boolean
  bookingsLoading: boolean
  onOpenBookings: () => void
}

/** Four KPIs derived from the customer's own contracts and bookings. */
export function DashboardKpis({
  heldCount,
  overdueCount,
  pendingCheckInCount,
  bookingCount,
  monthlyTotal,
  nearestEnding,
  contractsLoading,
  bookingsLoading,
  onOpenBookings,
}: DashboardKpisProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        label="Kho đang thuê"
        value={formatNumber(heldCount)}
        icon={Package}
        tone={overdueCount > 0 ? 'danger' : 'info'}
        hint={overdueCount > 0 ? `${formatNumber(overdueCount)} kho quá hạn thanh toán` : 'Không có kho quá hạn'}
        loading={contractsLoading}
      />
      <StatCard
        label="Chờ nhận kho"
        value={formatNumber(pendingCheckInCount)}
        icon={CalendarClock}
        tone={pendingCheckInCount > 0 ? 'warning' : 'neutral'}
        hint={bookingCount > 0 ? `${formatNumber(bookingCount)} đơn đặt chỗ` : 'Chưa có đơn đặt chỗ'}
        loading={bookingsLoading}
        onClick={onOpenBookings}
      />
      <StatCard
        label="Phí thuê hàng tháng"
        value={formatCurrency(monthlyTotal)}
        icon={Wallet}
        hint={heldCount > 0 ? `Tổng của ${formatNumber(heldCount)} kho đang thuê` : 'Chưa có kho đang thuê'}
        loading={contractsLoading}
      />
      <StatCard
        label="Hạn hợp đồng gần nhất"
        value={nearestEnding ? formatDate(nearestEnding.endDate) : '—'}
        icon={CalendarDays}
        hint={
          nearestEnding
            ? `Kho ${nearestEnding.unitCode} · ${formatRelativeTime(nearestEnding.endDate)}`
            : 'Không có hợp đồng đang hiệu lực'
        }
        loading={contractsLoading}
      />
    </div>
  )
}
