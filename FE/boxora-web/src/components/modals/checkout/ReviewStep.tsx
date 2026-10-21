import { Alert, Badge, Button, Checkbox, DescriptionList, Skeleton } from '../../ui'
import { formatCurrency, formatDateTime, formatPercent } from '../../../lib/format'
import { getApiErrorMessage } from '../../../lib/apiError'
import type { PricingQuoteResponse } from '../../../services/pricingService'
import type { SigningMethod } from './checkoutTypes'

interface ReviewStepProps {
  customerName: string
  email: string
  phone: string
  appointmentAt: string
  rentalMonths: number
  signingMethod: SigningMethod
  holdGraceHours: number
  profileChanges: string[]
  quote: PricingQuoteResponse | undefined
  isQuoteLoading: boolean
  quoteError: unknown
  onReloadQuote: () => void
  termsAccepted: boolean
  onTermsChange: (accepted: boolean) => void
}

export function ReviewStep({
  customerName,
  email,
  phone,
  appointmentAt,
  rentalMonths,
  signingMethod,
  holdGraceHours,
  profileChanges,
  quote,
  isQuoteLoading,
  quoteError,
  onReloadQuote,
  termsAccepted,
  onTermsChange,
}: ReviewStepProps) {
  const isOnline = signingMethod === 'ONLINE'

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-sm font-semibold text-fg">Xác nhận yêu cầu thuê</h3>

      {quoteError ? (
        <Alert
          tone="danger"
          title="Không lấy được báo giá"
          action={
            <Button size="sm" variant="secondary" onClick={onReloadQuote}>
              Thử lại
            </Button>
          }
        >
          {getApiErrorMessage(quoteError, 'Không thể lấy báo giá từ hệ thống.')} Bạn cần có báo giá để xác nhận đặt kho.
        </Alert>
      ) : null}

      <div className="rounded-lg border border-line p-4">
        <DescriptionList
          layout="inline"
          items={[
            { label: 'Người thuê', value: customerName },
            { label: 'Email', value: email },
            { label: 'Số điện thoại', value: phone, mono: true },
            { label: 'Lịch hẹn nhận kho', value: <span className="tabular-nums">{formatDateTime(appointmentAt)}</span> },
            { label: 'Hạn giữ chỗ dự kiến', value: `Đến giờ hẹn + ${holdGraceHours} giờ gia hạn` },
            { label: 'Kỳ hạn thuê', value: `${rentalMonths} tháng` },
            {
              label: 'Hình thức',
              value: (
                <Badge tone={isOnline ? 'accent' : 'warning'}>
                  {isOnline ? 'Ký và thanh toán trực tuyến' : 'Giữ chỗ, thanh toán tại quầy'}
                </Badge>
              ),
            },
          ]}
        />
      </div>

      {profileChanges.length > 0 ? (
        <Alert tone="info" title="Hồ sơ tài khoản sẽ được cập nhật">
          {profileChanges.map(change => change.charAt(0).toUpperCase() + change.slice(1)).join(' và ')} mới sẽ được lưu vào hồ sơ khi bạn
          xác nhận.
        </Alert>
      ) : null}

      {isQuoteLoading && !quote ? (
        <div className="flex flex-col gap-2" aria-busy="true">
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-6 w-full" />
        </div>
      ) : quote ? (
        <div className="rounded-lg border border-line p-4">
          <DescriptionList
            layout="inline"
            items={[
              { label: 'Tiền thuê trước ưu đãi', value: <span className="tabular-nums">{formatCurrency(quote.subtotalRentalFee)}</span> },
              ...(Number(quote.discountAmount) > 0
                ? [
                    {
                      label: 'Chiết khấu kỳ hạn',
                      value: (
                        <span className="tabular-nums text-success">
                          -{formatCurrency(quote.discountAmount)}
                          {quote.discountPercentage ? ` (${formatPercent(quote.discountPercentage)})` : ''}
                        </span>
                      ),
                    },
                  ]
                : []),
              { label: 'Tiền thuê sau ưu đãi', value: <span className="tabular-nums">{formatCurrency(quote.totalRentalFee)}</span> },
              { label: 'Tiền cọc an ninh', value: <span className="tabular-nums">{formatCurrency(quote.depositAmount)}</span> },
              {
                label: <span className="font-medium text-fg">Tổng chi phí dự kiến</span>,
                value: <span className="font-semibold tabular-nums text-fg">{formatCurrency(quote.totalContractValue)}</span>,
              },
              ...(isOnline
                ? [{ label: 'Thanh toán ngay', value: <span className="tabular-nums">{formatCurrency(quote.initialPaymentAmount)}</span> }]
                : []),
            ]}
          />
        </div>
      ) : null}

      {quote?.cancellationPolicy ? (
        <p className="text-dense text-fg-muted">
          <span className="font-medium text-fg">Chính sách hủy và hoàn cọc: </span>
          {quote.cancellationPolicy}
        </p>
      ) : null}

      <Alert tone="info" icon={null}>
        {isOnline
          ? 'Hệ thống tạo yêu cầu thuê kho và chuyển sang thanh toán trực tuyến. Thanh toán và chữ ký chỉ được ghi nhận sau khi nhận kết quả từ máy chủ.'
          : 'Yêu cầu giữ chỗ được tạo ngay. Kho được bảo lưu đến sau lịch hẹn kèm thời gian gia hạn theo chính sách; bạn thanh toán tại quầy khi đến nhận kho.'}
      </Alert>

      <Checkbox
        checked={termsAccepted}
        onCheckedChange={onTermsChange}
        label="Tôi đã đọc kỳ hạn thuê, lịch nhận kho, cách xác lập ngày bắt đầu thuê, chi phí dự kiến và chính sách hủy, hoàn tiền áp dụng."
      />
    </div>
  )
}
