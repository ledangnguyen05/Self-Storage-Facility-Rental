import type { ReactNode } from 'react'
import { ArrowRight, CalendarClock, CreditCard, Ellipsis, PenLine, ShieldCheck, XCircle } from 'lucide-react'
import {
  Alert,
  Badge,
  Button,
  Card,
  CardFooter,
  DescriptionList,
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuSeparator,
  IconButton,
} from '@/components/ui'
import { getBookingStatusMeta } from '@/constants/statusMeta'
import { formatCurrency, formatDateTime } from '@/lib/format'
import type { Booking, RentalContract } from '@/types'
import { getBookingNotice, getBookingPaymentBadge, type BookingNoticeInfo } from '../lib/bookingScenario'
import { formatCheckIn, formatMonths } from '../lib/portal'

export interface BookingCardActions {
  onViewDetails: (booking: Booking) => void
  onPay: (booking: Booking) => void
  onSign: (contract: RentalContract) => void
  onReschedule: (booking: Booking) => void
  onCancel: (booking: Booking) => void
  onGoToUnit: (unitCode: string) => void
  onViewPolicy: (booking: Booking) => void
}

interface BookingCardProps extends BookingCardActions {
  booking: Booking
  info: BookingNoticeInfo
}

/** One reservation: status, schedule, money, what it means (scenario notice) and the next action. */
export function BookingCard({ booking, info, ...actions }: BookingCardProps) {
  const status = getBookingStatusMeta(booking.status)
  const payment = getBookingPaymentBadge(booking)
  const notice = getBookingNotice(booking, info)
  const deposit = booking.depositPaid || booking.depositAmount

  let primaryAction: ReactNode = null
  if (info.canPay) {
    primaryAction = (
      <Button size="sm" leftIcon={CreditCard} onClick={() => actions.onPay(booking)}>
        Thanh toán
      </Button>
    )
  } else if (info.canSignOnline && info.matchingContract) {
    const contract = info.matchingContract
    primaryAction = (
      <Button size="sm" leftIcon={PenLine} onClick={() => actions.onSign(contract)}>
        Ký hợp đồng
      </Button>
    )
  } else if (info.scenario === 'ACTIVE' && booking.unitCode) {
    primaryAction = (
      <Button size="sm" rightIcon={ArrowRight} onClick={() => actions.onGoToUnit(booking.unitCode)}>
        Xem kho
      </Button>
    )
  }

  return (
    <Card className="flex flex-col">
      <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-4">
        <div className="min-w-0">
          <h3 className="font-mono text-base font-semibold text-fg">Kho {booking.unitCode || '—'}</h3>
          <p className="truncate text-dense text-fg-muted">{booking.facilityName || '—'}</p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone={status.tone} dot>
            {status.label}
          </Badge>
          {payment ? <Badge tone={payment.tone} variant="outline">{payment.label}</Badge> : null}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-4 p-5">
        <DescriptionList
          columns={2}
          items={[
            { label: 'Mã đặt chỗ', value: booking.bookingCode, mono: true },
            { label: 'Lịch hẹn nhận kho', value: formatCheckIn(booking) },
            { label: 'Thời hạn thuê', value: formatMonths(booking.rentalMonths) },
            { label: 'Hạn giữ chỗ', value: info.isPendingCheckIn ? formatDateTime(booking.holdExpiresAt) : '—' },
            {
              label: Number(booking.depositPaid) > 0 ? 'Tiền cọc đã nộp' : 'Tiền cọc cần nộp',
              value: <span className="tabular-nums">{formatCurrency(deposit ?? 0)}</span>,
            },
            { label: 'Tổng tiền thuê', value: <span className="tabular-nums">{formatCurrency(booking.totalRentalFee)}</span> },
          ]}
        />
        {notice ? (
          <Alert tone={notice.tone} title={notice.title} role="note">
            {notice.description}
          </Alert>
        ) : null}
      </div>

      <CardFooter>
        {info.isPendingCheckIn ? (
          <DropdownMenu
            aria-label={`Thao tác đơn ${booking.bookingCode}`}
            trigger={<IconButton icon={Ellipsis} variant="secondary" size="sm" aria-label="Thao tác khác" />}
          >
            <DropdownMenuItem icon={CalendarClock} onSelect={() => actions.onReschedule(booking)}>
              Dời lịch nhận kho
            </DropdownMenuItem>
            <DropdownMenuItem icon={ShieldCheck} onSelect={() => actions.onViewPolicy(booking)}>
              Chính sách cọc và hủy
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem icon={XCircle} tone="danger" onSelect={() => actions.onCancel(booking)}>
              Hủy đặt kho
            </DropdownMenuItem>
          </DropdownMenu>
        ) : null}
        <Button variant="secondary" size="sm" onClick={() => actions.onViewDetails(booking)}>
          Chi tiết
        </Button>
        {primaryAction}
      </CardFooter>
    </Card>
  )
}
