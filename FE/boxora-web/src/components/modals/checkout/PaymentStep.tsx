import { RefreshCw } from 'lucide-react'
import { Alert, Button, DescriptionList, Skeleton, Tabs, type TabItem } from '../../ui'
import { formatCurrency } from '../../../lib/format'
import type { Booking } from '../../../types'
import { formatCountdown } from './useCountdown'
import type { PaymentView } from './checkoutTypes'

interface PaymentStepProps {
  booking: Booking | null
  amountDue: number | null
  secondsRemaining: number | null
  isExpired: boolean
  paymentUrl: string
  qrCode: string
  qrError: string
  view: PaymentView
  onViewChange: (view: PaymentView) => void
  isSubmitting: boolean
  onCreatePayment: () => void
}

const VIEW_ITEMS: TabItem<PaymentView>[] = [
  { value: 'qr', label: 'Quét mã QR' },
  { value: 'link', label: 'Mở trang thanh toán' },
]

/** Online payment: shows the hold countdown, then the VNPay QR / link once it was created. */
export function PaymentStep({
  booking,
  amountDue,
  secondsRemaining,
  isExpired,
  paymentUrl,
  qrCode,
  qrError,
  view,
  onViewChange,
  isSubmitting,
  onCreatePayment,
}: PaymentStepProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border border-line p-4">
        <DescriptionList
          layout="inline"
          items={[
            { label: 'Mã đơn', value: booking?.bookingCode, mono: true },
            {
              label: <span className="font-medium text-fg">Thanh toán lần đầu</span>,
              value: <span className="font-semibold tabular-nums">{formatCurrency(amountDue)}</span>,
            },
          ]}
        />
        <p className="mt-3 text-dense text-fg-muted">
          Gồm tiền cọc và tiền thuê đợt đầu. Thanh toán và chữ ký chỉ được ghi nhận sau khi nhận kết quả từ máy chủ.
        </p>
      </div>

      {secondsRemaining !== null ? (
        <Alert tone={isExpired ? 'danger' : 'warning'} title={isExpired ? 'Đã hết thời hạn giữ kho' : 'Thời hạn giữ kho'}>
          {isExpired ? (
            'Thời hạn thanh toán đã hết. Vui lòng đặt lại kho.'
          ) : (
            <>
              Còn <span className="font-semibold tabular-nums">{formatCountdown(secondsRemaining)}</span> để hoàn tất thanh toán.
            </>
          )}
        </Alert>
      ) : null}

      {paymentUrl ? (
        <div className="flex flex-col gap-4">
          <Tabs variant="segmented" aria-label="Cách thanh toán" items={VIEW_ITEMS} value={view} onValueChange={onViewChange} fullWidth />
          {view === 'qr' ? (
            <div className="flex flex-col items-center gap-3 rounded-lg border border-line p-5 text-center">
              {qrCode ? (
                <img src={qrCode} alt="Mã QR mở trang thanh toán" className="size-56 rounded-md" />
              ) : qrError ? (
                <Alert tone="danger" title="Không tạo được mã QR">
                  {qrError} Bạn vẫn có thể mở trang thanh toán trực tiếp.
                </Alert>
              ) : (
                <Skeleton className="size-56" />
              )}
              <p className="max-w-sm text-dense text-fg-muted">Quét mã bằng ứng dụng ngân hàng, hoặc mở trang thanh toán trên thiết bị này.</p>
            </div>
          ) : (
            <div className="rounded-lg border border-line p-5 text-center">
              <p className="text-sm font-medium text-fg">Thanh toán qua cổng VNPay</p>
              <p className="mt-1 text-dense text-fg-muted">Trang thanh toán chỉ mở khi bạn nhấn nút "Mở trang thanh toán" bên dưới.</p>
            </div>
          )}
          <div className="flex justify-center">
            <Button variant="link" size="sm" leftIcon={RefreshCw} disabled={isSubmitting || isExpired} onClick={onCreatePayment}>
              Tạo liên kết thanh toán mới
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-fg-muted">
          Đơn thuê đã được khởi tạo. Nhấn "Tạo liên kết thanh toán" để thanh toán tiền cọc và tiền thuê đợt đầu.
        </p>
      )}
    </div>
  )
}
