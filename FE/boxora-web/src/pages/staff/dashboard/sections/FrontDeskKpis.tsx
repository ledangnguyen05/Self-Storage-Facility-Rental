import React from 'react'
import { LogIn, LogOut, Siren, Warehouse } from 'lucide-react'
import { StatCard } from '@/components/ui'
import { formatNumber } from '@/lib/format'
import type { FrontDeskData } from '../hooks/useFrontDeskData'
import { isArrivalDue, isReturnDue, isTicketHighPriority, isTicketOpen } from '../utils/frontDesk'

interface FrontDeskKpisProps {
  data: FrontDeskData
  facilityId?: string
  today: string
  onShowArrivals: () => void
  onShowReturns: () => void
  onShowTickets: () => void
}

const count = (value: number) => formatNumber(value)

/** Today's arrivals, returns due, free units and open incidents for the facility in scope. */
export function FrontDeskKpis({ data, facilityId, today, onShowArrivals, onShowReturns, onShowTickets }: FrontDeskKpisProps) {
  const dueArrivals = data.arrivals.filter((booking) => isArrivalDue(booking, today))
  const awaitingPayment = dueArrivals.filter((booking) => String(booking.status).toUpperCase() === 'PENDING_PAYMENT').length
  const dueReturns = data.returns.filter((item) => isReturnDue(item, today))
  const requested = dueReturns.filter((item) => item.status === 'CHECKOUT_REQUESTED').length
  const available = data.units.filter((unit) => String(unit.status).toUpperCase() === 'AVAILABLE').length
  const openTickets = data.tickets.filter(isTicketOpen)
  const highPriority = openTickets.filter(isTicketHighPriority).length

  return (
    <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Chỉ số quầy hôm nay">
      <StatCard
        label="Nhận kho hôm nay"
        icon={LogIn}
        tone="info"
        loading={data.arrivalsState.isLoading}
        value={data.arrivalsState.error ? '—' : count(dueArrivals.length)}
        hint={
          data.arrivalsState.error
            ? 'Không tải được lịch hẹn'
            : awaitingPayment > 0
              ? `${count(awaitingPayment)} lượt chờ thanh toán`
              : `${count(data.arrivals.length)} lịch hẹn đang chờ`
        }
        onClick={onShowArrivals}
      />
      <StatCard
        label="Chờ trả kho"
        icon={LogOut}
        tone="warning"
        loading={data.returnsState.isLoading}
        value={data.returnsState.error ? '—' : count(dueReturns.length)}
        hint={
          data.returnsState.error
            ? 'Không tải được hợp đồng'
            : requested > 0
              ? `${count(requested)} khách đã yêu cầu trả`
              : 'Đến hạn hoặc quá hạn'
        }
        onClick={onShowReturns}
      />
      <StatCard
        label="Kho trống"
        icon={Warehouse}
        tone="success"
        loading={data.unitsState.isLoading}
        value={!facilityId || data.unitsState.error ? '—' : count(available)}
        hint={
          !facilityId
            ? 'Chọn một cơ sở để xem'
            : data.unitsState.error
              ? 'Không tải được sơ đồ kho'
              : `trên ${count(data.units.length)} kho`
        }
      />
      <StatCard
        label="Sự cố đang mở"
        icon={Siren}
        tone="danger"
        loading={data.ticketsState.isLoading}
        value={data.ticketsState.error ? '—' : count(openTickets.length)}
        hint={
          data.ticketsState.error
            ? 'Không tải được sự cố'
            : highPriority > 0
              ? `${count(highPriority)} ưu tiên cao`
              : 'Không có sự cố ưu tiên cao'
        }
        onClick={onShowTickets}
      />
    </section>
  )
}
