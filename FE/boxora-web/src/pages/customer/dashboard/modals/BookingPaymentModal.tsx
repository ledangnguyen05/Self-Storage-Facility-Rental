import { useState } from 'react'
import { ExternalLink, Link2 } from 'lucide-react'
import { Alert, Button, DescriptionList, Modal, Skeleton } from '@/components/ui'
import { formatFacilityName } from '@/components/layout/useFacilityScope'
import { useAsyncData } from '@/hooks/useAsyncData'
import { getApiErrorMessage } from '@/lib/apiError'
import { formatCurrency, formatDateTime } from '@/lib/format'
import { isSafePaymentUrl, paymentService, type VNPayPayment } from '@/services/paymentService'
import { pricingService } from '@/services/pricingService'
import type { Booking } from '@/types'
import { PaymentLinkPanel } from '../components/PaymentLinkPanel'
import { useCountdown } from '../hooks/useCountdown'
import { formatMonths } from '../lib/portal'

interface BookingPaymentModalProps {
  booking: Booking
  /** Initial payment from the quote the booking was created with. */
  fallbackAmount?: number
  onClose: () => void
}

const positive = (value: number | null | undefined) => (typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined)

/**
 * Pays the initial payment (first month + deposit) of an EXISTING booking through VNPay: a
 * reservation waiting for online payment, or a free hold to be picked up at the counter that the
 * customer prefers to pay in advance. The server computes the amount (minus anything already paid);
 * the figure shown before the link is created is the quote estimate.
 */
export function BookingPaymentModal({ booking, fallbackAmount, onClose }: BookingPaymentModalProps) {
  // What is still owed (a deposit paid at the counter is already subtracted), as the payment link will charge.
  const knownAmount = positive(booking.initialPaymentDue) ?? positive(booking.initialPaymentAmount) ?? positive(fallbackAmount)
  const partlyPaid = positive(booking.initialPaymentDue) !== undefined
    && positive(booking.initialPaymentAmount) !== undefined
    && (booking.initialPaymentDue ?? 0) < (booking.initialPaymentAmount ?? 0)
  const needsQuote = !knownAmount && Boolean(booking.storageUnitId) && booking.rentalMonths > 0
  const quote = useAsyncData(
    signal =>
      pricingService.getQuote(
        { storageUnitId: booking.storageUnitId, rentalMonths: booking.rentalMonths, startDate: booking.startDate || undefined },
        { signal },
      ),
    [booking.storageUnitId, booking.rentalMonths, booking.startDate],
    { enabled: needsQuote },
  )
  const estimate = knownAmount ?? positive(quote.data?.initialPaymentAmount)

  const isHold = (booking.status ?? '').toUpperCase() === 'CONFIRMED'
  const deadline = isHold ? booking.holdExpiresAt : booking.paymentExpiresAt || booking.holdExpiresAt
  const countdown = useCountdown(deadline)
  const [payment, setPayment] = useState<VNPayPayment | null>(null)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const createLink = async () => {
    if (countdown.isExpired) return
    setCreating(true)
    setError(null)
    try {
      const created = await paymentService.createVNPayPayment({ bookingId: booking.id })
      if (!isSafePaymentUrl(created?.paymentUrl)) throw new Error('Cổng thanh toán trả về liên kết không hợp lệ.')
      setPayment(created)
    } catch (err) {
      setError(getApiErrorMessage(err, 'Không thể tạo liên kết thanh toán. Vui lòng thử lại.'))
    } finally {
      setCreating(false)
    }
  }

  const openPayment = () => {
    if (payment && isSafePaymentUrl(payment.paymentUrl) && !countdown.isExpired) window.open(payment.paymentUrl, '_blank', 'noopener,noreferrer')
  }

  const amount = payment?.amount ?? estimate
  const footer = payment ? (
    <>
      <Button variant="secondary" leftIcon={Link2} onClick={() => void createLink()} loading={creating} disabled={countdown.isExpired}>
        Tạo liên kết mới
      </Button>
      <Button rightIcon={ExternalLink} onClick={openPayment} disabled={countdown.isExpired}>
        Mở trang thanh toán
      </Button>
    </>
  ) : (
    <>
      <Button variant="secondary" onClick={onClose}>
        Để sau
      </Button>
      <Button onClick={() => void createLink()} loading={creating} disabled={countdown.isExpired}>
        Tạo liên kết thanh toán
      </Button>
    </>
  )

  return (
    <Modal
      open
      onClose={onClose}
      dismissible={!creating}
      title="Thanh toán đơn đặt chỗ"
      description={`Mã đặt chỗ ${booking.bookingCode || '—'}`}
      size="md"
      footer={footer}
    >
      <div className="flex flex-col gap-4">
        <DescriptionList
          layout="inline"
          items={[
            { label: 'Kho', value: booking.unitCode || '—', mono: true },
            { label: 'Cơ sở', value: booking.facilityName ? formatFacilityName(booking.facilityName) : '—' },
            { label: 'Thời hạn thuê', value: formatMonths(booking.rentalMonths) },
            {
              label: isHold ? 'Giữ chỗ đến' : 'Hạn thanh toán',
              value: deadline ? (
                <span className={countdown.isExpired ? 'text-danger' : undefined}>
                  {formatDateTime(deadline)}
                  {countdown.isExpired ? ' · đã hết hạn' : ` · còn ${countdown.label}`}
                </span>
              ) : (
                '—'
              ),
            },
          ]}
        />

        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-surface-2 px-4 py-3">
          <div>
            <p className="text-sm font-medium text-fg">
              {payment ? 'Số tiền thanh toán' : partlyPaid ? 'Còn phải thanh toán (dự kiến)' : 'Thanh toán ban đầu (dự kiến)'}
            </p>
            <p className="text-dense text-fg-muted">
              {payment
                ? 'Do hệ thống tính: tiền cọc và tiền thuê tháng đầu, trừ khoản đã thanh toán.'
                : partlyPaid
                  ? `Tiền cọc và tiền thuê tháng đầu (${formatCurrency(booking.initialPaymentAmount)}), trừ ${formatCurrency((booking.initialPaymentAmount ?? 0) - (booking.initialPaymentDue ?? 0))} bạn đã thanh toán.`
                  : 'Tiền cọc và tiền thuê tháng đầu theo báo giá. Số tiền chính thức hiển thị khi tạo liên kết.'}
              {booking.rentalMonths > 1 ? ` Tiền thuê các tháng tiếp theo thanh toán theo từng kỳ sau khi nhận kho.` : ''}
            </p>
          </div>
          {quote.isLoading && !amount ? (
            <Skeleton className="h-7 w-32" />
          ) : (
            <span className="text-xl font-semibold tabular-nums text-fg">{amount ? formatCurrency(amount) : '—'}</span>
          )}
        </div>

        {isHold && !payment ? (
          <Alert tone="info" icon={null}>
            Bạn có thể thanh toán trước để giữ kho chắc chắn, hoặc thanh toán tại quầy khi đến nhận kho. Lịch hẹn và hạn giữ chỗ không thay đổi.
          </Alert>
        ) : null}
        {countdown.isExpired ? (
          <Alert tone="danger" title={isHold ? 'Đã hết thời gian giữ chỗ' : 'Đã hết hạn thanh toán'}>
            Đơn có thể đã được giải phóng. Hãy đặt lại kho hoặc liên hệ cơ sở để được hỗ trợ.
          </Alert>
        ) : null}
        {error ? (
          <Alert tone="danger" title="Không tạo được liên kết" onDismiss={() => setError(null)}>
            {error}
          </Alert>
        ) : null}

        {payment ? <PaymentLinkPanel paymentUrl={payment.paymentUrl} /> : null}
      </div>
    </Modal>
  )
}
