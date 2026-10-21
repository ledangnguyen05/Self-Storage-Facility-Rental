import { Alert, Badge, DescriptionList } from '../../ui'
import { formatCurrency, formatDateTime } from '../../../lib/format'
import { getBookingPaymentStatusMeta } from '../../../constants/statusMeta'
import type { Booking } from '../../../types'
import { ModalSuccess } from '../shared/ModalSuccess'

interface ConfirmedStepProps {
  booking: Booking | null
  unitCode: string
  facilityName?: string
  /** Fallback appointment (`yyyy-MM-ddTHH:mm`) when the booking has none. */
  appointmentAt: string
  depositAmount: number | null
}

/** Success screen for a booking that is held for an in-person visit (or already confirmed). */
export function ConfirmedStep({ booking, unitCode, facilityName, appointmentAt, depositAmount }: ConfirmedStepProps) {
  const paymentMeta = getBookingPaymentStatusMeta(booking?.paymentStatus ?? 'UNPAID')
  const isPaid = booking?.paymentStatus === 'PAID'
  const bookingCode = booking?.bookingCode

  return (
    <ModalSuccess
      title={isPaid ? 'Đặt kho thành công' : 'Đã xác nhận giữ chỗ theo lịch hẹn'}
      description={
        bookingCode
          ? `Mã đơn ${bookingCode}. Hồ sơ giữ chỗ đã được chuyển đến quầy tiếp đón của ${facilityName || 'cơ sở'}.`
          : 'Hồ sơ giữ chỗ đã được chuyển đến quầy tiếp đón của cơ sở.'
      }
    >
      <div className="rounded-lg border border-line p-4">
        <DescriptionList
          layout="inline"
          items={[
            { label: 'Mã đơn', value: bookingCode, mono: true },
            { label: 'Kho thuê', value: unitCode, mono: true },
            {
              label: 'Lịch hẹn nhận kho',
              value: <span className="tabular-nums">{formatDateTime(booking?.expectedCheckInAt || appointmentAt)}</span>,
            },
            {
              label: 'Hạn giữ chỗ',
              value: booking?.holdExpiresAt ? <span className="tabular-nums">{formatDateTime(booking.holdExpiresAt)}</span> : 'Theo chính sách của cơ sở',
            },
            { label: 'Thanh toán', value: <Badge tone={paymentMeta.tone}>{paymentMeta.label}</Badge> },
            { label: 'Cọc dự kiến', value: depositAmount === null ? null : <span className="tabular-nums">{formatCurrency(depositAmount)}</span> },
          ]}
        />
      </div>
      <Alert tone="info" title="Hướng dẫn nhận kho">
        Mang theo bản gốc CCCD hoặc hộ chiếu đến quầy tiếp đón trước hạn giữ chỗ. Nhân viên sẽ tra cứu mã đơn
        {bookingCode ? ` ${bookingCode}` : ''} để hướng dẫn xem kho, thanh toán (tiền mặt hoặc chuyển khoản) và bàn giao kho.
      </Alert>
    </ModalSuccess>
  )
}
