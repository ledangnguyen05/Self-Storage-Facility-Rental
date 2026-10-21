import { CalendarClock, CreditCard, PenLine, ShieldCheck } from 'lucide-react'
import { Alert, Badge, Button, DescriptionList, Modal } from '@/components/ui'
import { BookingRescheduleHistorySection } from '@/components/booking/BookingRescheduleHistorySection'
import { formatFacilityName } from '@/components/layout/useFacilityScope'
import { getBookingStatusMeta } from '@/constants/statusMeta'
import { formatCurrency, formatDate, formatDateTime } from '@/lib/format'
import type { Booking, RentalContract } from '@/types'
import { CheckInQr } from '../components/CheckInQr'
import { getBookingNotice, getBookingPaymentBadge, type BookingNoticeInfo } from '../lib/bookingScenario'
import { formatCheckIn, formatMonths } from '../lib/portal'

interface BookingDetailsModalProps {
  booking: Booking
  info: BookingNoticeInfo
  /** Bumped after a reschedule so the history reloads. */
  historyKey: number
  onClose: () => void
  onReschedule: (booking: Booking) => void
  onPay: (booking: Booking) => void
  onSign: (contract: RentalContract) => void
  onViewPolicy: (booking: Booking) => void
}

const SIGNING_METHOD_LABELS: Record<string, string> = { ONLINE: 'Ký điện tử', IN_PERSON: 'Ký tại cơ sở' }

function handoverStep(info: BookingNoticeInfo): string {
  if (info.scenario === 'PAID_SIGNED') return 'Hợp đồng và thanh toán đã hoàn tất: nghiệm thu kho và nhận bàn giao.'
  if (info.scenario === 'PAID_UNSIGNED') return 'Ký hợp đồng (trực tuyến hoặc tại quầy), sau đó nghiệm thu kho.'
  return 'Nghiệm thu kho, ký hợp đồng và thanh toán bằng tiền mặt hoặc chuyển khoản tại quầy.'
}

/** Reservation details, the handover guide and the reschedule history. */
export function BookingDetailsModal({ booking, info, historyKey, onClose, onReschedule, onPay, onSign, onViewPolicy }: BookingDetailsModalProps) {
  const status = getBookingStatusMeta(booking.status)
  const payment = getBookingPaymentBadge(booking)
  const notice = getBookingNotice(booking, info)
  const handedOver = Boolean(booking.handoverTime)
  const showGuide = info.isPendingCheckIn || info.scenario === 'PENDING_APPROVAL'
  const facilityName = booking.facilityName ? formatFacilityName(booking.facilityName) : '—'

  let primary = <Button onClick={onClose}>Đóng</Button>
  if (info.canPay) {
    primary = (
      <Button leftIcon={CreditCard} onClick={() => onPay(booking)}>
        Thanh toán
      </Button>
    )
  } else if (info.canSignOnline && info.matchingContract) {
    const contract = info.matchingContract
    primary = (
      <Button leftIcon={PenLine} onClick={() => onSign(contract)}>
        Ký hợp đồng
      </Button>
    )
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Đơn đặt chỗ ${booking.bookingCode || ''}`.trim()}
      description={`Kho ${booking.unitCode || '—'} · ${facilityName}`}
      size="lg"
      footer={
        <>
          <Button variant="ghost" leftIcon={ShieldCheck} onClick={() => onViewPolicy(booking)} className="sm:mr-auto">
            Chính sách cơ sở
          </Button>
          {info.isPendingCheckIn ? (
            <Button variant="secondary" leftIcon={CalendarClock} onClick={() => onReschedule(booking)}>
              Dời lịch
            </Button>
          ) : null}
          {primary}
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={status.tone} dot>
            {status.label}
          </Badge>
          {payment ? <Badge tone={payment.tone} variant="outline">{payment.label}</Badge> : null}
        </div>

        {notice ? (
          <Alert tone={notice.tone} title={notice.title} role="note">
            {notice.description}
          </Alert>
        ) : null}

        <DescriptionList
          columns={2}
          items={[
            handedOver
              ? { label: 'Bàn giao thực tế', value: formatDateTime(booking.handoverTime) }
              : { label: 'Lịch hẹn nhận kho', value: formatCheckIn(booking) },
            handedOver
              ? { label: 'Trạng thái bàn giao', value: 'Đã bàn giao và kích hoạt' }
              : { label: 'Hạn giữ chỗ', value: formatDateTime(booking.holdExpiresAt) },
            {
              label: handedOver ? 'Kỳ hạn thuê' : 'Kỳ hạn thuê dự kiến',
              value: `${formatDate(booking.startDate)} – ${formatDate(booking.endDate)} (${formatMonths(booking.rentalMonths)})`,
            },
            { label: 'Hình thức ký', value: booking.signingMethod ? SIGNING_METHOD_LABELS[booking.signingMethod] ?? '—' : '—' },
            {
              label: Number(booking.depositPaid) > 0 ? 'Tiền cọc đã nộp' : 'Tiền cọc cần nộp',
              value: <span className="tabular-nums">{formatCurrency(Number(booking.depositPaid) > 0 ? booking.depositPaid : booking.depositAmount || 0)}</span>,
            },
            { label: 'Tổng tiền thuê', value: <span className="tabular-nums">{formatCurrency(booking.totalRentalFee)}</span> },
            { label: 'Nhân viên phụ trách', value: booking.assignedStaffName || '—' },
            { label: 'Hợp đồng', value: info.matchingContract?.contractCode || '—', mono: Boolean(info.matchingContract?.contractCode) },
          ]}
        />

        {info.isPendingCheckIn && booking.bookingCode ? <CheckInQr bookingCode={booking.bookingCode} /> : null}

        {showGuide ? (
          <section className="flex flex-col gap-2">
            <h3 className="text-sm font-medium text-fg">Quy trình nhận kho</h3>
            <ol className="flex flex-col gap-2 rounded-lg border border-line p-4">
              {[
                `Mang CCCD hoặc hộ chiếu gốc đến quầy của ${facilityName} đúng lịch hẹn.`,
                `Đưa mã QR nhận kho (hoặc đọc mã đặt chỗ${booking.bookingCode ? ` ${booking.bookingCode}` : ''}) để nhân viên đối soát và dẫn bạn xem kho.`,
                handoverStep(info),
                'Sau khi bàn giao, mã PIN mở khóa được kích hoạt và hiển thị trong mục Kho của tôi.',
              ].map((text, index) => (
                <li key={index} className="flex items-start gap-3 text-sm text-fg">
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-surface-3 text-xs font-medium tabular-nums text-fg-muted">
                    {index + 1}
                  </span>
                  <span>{text}</span>
                </li>
              ))}
            </ol>
          </section>
        ) : null}

        <section className="border-t border-line pt-4">
          <BookingRescheduleHistorySection bookingId={booking.id} refreshKey={historyKey} />
        </section>
      </div>
    </Modal>
  )
}
