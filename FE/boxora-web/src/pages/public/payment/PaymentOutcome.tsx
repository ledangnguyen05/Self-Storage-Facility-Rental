import React from 'react'
import { CircleAlert, CircleCheck, Clock, FileQuestion, LockKeyhole, RotateCcw, ShieldQuestion, type LucideIcon } from 'lucide-react'
import { Alert, Badge, Card, CardContent, DescriptionList, Skeleton, Spinner, cn, type Tone } from '../../../components/ui'
import { toneSubtleBg, toneText } from '../../../components/ui/tones'
import { getBookingStatusMeta, getContractStatusMeta, getPaymentStatusMeta, getPaymentTypeMeta } from '../../../constants/statusMeta'
import { formatCurrency, formatDate, formatDateTime } from '../../../lib/format'
import { RECONCILE_MAX_ATTEMPTS, type PaymentOutcomeKind, type PaymentPurpose } from './paymentResultModel'
import type { PaymentResultState } from './usePaymentResult'

interface OutcomeCopy {
  icon: LucideIcon
  tone: Tone
  title: string
  description: string
}

const PAID_COPY: Record<PaymentPurpose, OutcomeCopy> = {
  booking: {
    icon: CircleCheck,
    tone: 'success',
    title: 'Thanh toán thành công',
    description: 'Boxora đã nhận được khoản thanh toán cho đơn đặt kho của bạn.',
  },
  rent: {
    icon: CircleCheck,
    tone: 'success',
    title: 'Đã thanh toán tiền thuê',
    description: 'Boxora đã ghi nhận khoản tiền thuê của hợp đồng. Công nợ trong cổng khách hàng được cập nhật ngay.',
  },
  renewal: {
    icon: CircleCheck,
    tone: 'success',
    title: 'Đã thanh toán phí gia hạn',
    description: 'Boxora đã nhận phí gia hạn. Hợp đồng được gia hạn khi phụ lục gia hạn đã được ký.',
  },
}

const OUTCOME_COPY: Record<Exclude<PaymentOutcomeKind, 'loading' | 'paid'>, OutcomeCopy> = {
  refund: {
    icon: RotateCcw,
    tone: 'warning',
    title: 'Đã nhận tiền, đơn sẽ được hoàn tiền',
    description:
      'Khoản thanh toán đến sau khi đơn đặt kho đã hết hạn giữ chỗ hoặc bị hủy, nên kho không được giữ cho bạn. Boxora đã tạo yêu cầu hoàn tiền; hãy cung cấp tài khoản nhận tiền để được chuyển khoản.',
  },
  pending: {
    icon: Clock,
    tone: 'warning',
    title: 'Chưa xác nhận được thanh toán',
    description: 'Máy chủ chưa ghi nhận khoản thanh toán này. Nếu tài khoản của bạn đã bị trừ tiền, hệ thống thường cập nhật trong vài phút.',
  },
  failed: {
    icon: CircleAlert,
    tone: 'danger',
    title: 'Thanh toán chưa thành công',
    description: 'Giao dịch không hoàn tất. Bạn có thể thử thanh toán lại.',
  },
  error: {
    icon: CircleAlert,
    tone: 'danger',
    title: 'Không tải được thông tin thanh toán',
    description: 'Có lỗi khi lấy thông tin thanh toán từ máy chủ.',
  },
  unverified: {
    icon: LockKeyhole,
    tone: 'info',
    title: 'Đăng nhập để xem kết quả',
    description: 'Boxora đã nhận kết quả giao dịch. Hãy đăng nhập để xem xác nhận và các bước tiếp theo.',
  },
  unknown: {
    icon: FileQuestion,
    tone: 'neutral',
    title: 'Không có thông tin giao dịch',
    description: 'Đường dẫn này không kèm mã giao dịch nên không thể hiển thị kết quả thanh toán.',
  },
}

export function PaymentOutcomeSkeleton() {
  return (
    <Card aria-busy="true" aria-label="Đang đối soát thanh toán">
      <CardContent className="space-y-4 p-6">
        <Skeleton className="mx-auto size-12 rounded-full" />
        <Skeleton className="mx-auto h-6 w-56" />
        <Skeleton className="mx-auto h-4 w-72 max-w-full" />
        <Skeleton className="h-40 w-full" />
      </CardContent>
    </Card>
  )
}

interface PaymentOutcomeProps {
  state: PaymentResultState
  /** Buttons and links for the current outcome. */
  actions: React.ReactNode
}

/** Status header, reconcile hint and booking / contract / transaction summary. */
export function PaymentOutcome({ state, actions }: PaymentOutcomeProps) {
  if (state.kind === 'loading') return <PaymentOutcomeSkeleton />

  const copy = state.kind === 'paid' ? PAID_COPY[state.purpose] : OUTCOME_COPY[state.kind]
  const Icon = copy.icon
  const { booking, payment, contract, purpose } = state
  const showSummary = state.kind === 'paid' || state.kind === 'pending' || state.kind === 'failed' || state.kind === 'refund'
  const forContract = purpose !== 'booking'

  const description = state.kind === 'error' && state.loadErrorMessage ? state.loadErrorMessage : copy.description

  return (
    <Card>
      <CardContent className="space-y-6 p-6 sm:p-8">
        <div className="text-center">
          <span className={cn('mx-auto flex size-12 items-center justify-center rounded-full', toneSubtleBg[copy.tone], toneText[copy.tone])}>
            <Icon size={24} strokeWidth={1.75} aria-hidden="true" />
          </span>
          <h1 className="mt-4 text-xl font-semibold tracking-tight text-fg">{copy.title}</h1>
          <p className="mx-auto mt-2 max-w-md text-sm text-fg-muted">{description}</p>
        </div>

        {state.kind === 'failed' ? (
          state.mayHaveBeenCharged ? (
            <Alert tone="warning" title="Tài khoản của bạn có thể đã bị trừ tiền">
              {state.failureReason ? `${state.failureReason} ` : ''}
              Hãy giữ lại thông báo của ngân hàng và liên hệ Boxora kèm mã giao dịch để được đối soát hoặc hoàn tiền.
            </Alert>
          ) : (
            <Alert tone="danger" title="Lý do">
              {state.failureReason || 'Cổng thanh toán không trả về lý do cụ thể.'}
              {state.knownNotCharged
                ? ' Bạn chưa bị trừ tiền cho giao dịch này.'
                : ' Nếu tài khoản đã bị trừ tiền, hãy liên hệ Boxora kèm mã giao dịch để được đối soát.'}
            </Alert>
          )
        ) : null}

        {state.isReconciling ? (
          <Alert tone="info" icon={ShieldQuestion} title="Đang đối soát với máy chủ">
            <span className="inline-flex items-center gap-2">
              <Spinner size="xs" label="" />
              Lần kiểm tra {Math.min(state.attempts + 1, RECONCILE_MAX_ATTEMPTS)}/{RECONCILE_MAX_ATTEMPTS}. Trang sẽ tự cập nhật khi có kết quả.
            </span>
          </Alert>
        ) : null}

        {showSummary ? (
          <DescriptionList
            layout="inline"
            items={[
              { label: 'Nội dung', value: payment ? getPaymentTypeMeta(payment.paymentType).label : null },
              forContract
                ? { label: 'Hợp đồng', value: contract?.contractCode || payment?.contractCode || null, mono: true }
                : { label: 'Mã đặt kho', value: booking?.bookingCode || payment?.bookingCode || null, mono: true },
              {
                label: 'Kho',
                value: booking
                  ? [booking.unitCode, booking.facilityName].filter(Boolean).join(' · ')
                  : [contract?.unitCode || payment?.unitCode, contract?.facilityName || payment?.facilityName].filter(Boolean).join(' · ') || null,
              },
              !forContract
                ? {
                    label: 'Tình trạng đơn',
                    value: booking ? (
                      <Badge tone={getBookingStatusMeta(booking.status).tone} dot>
                        {getBookingStatusMeta(booking.status).label}
                      </Badge>
                    ) : null,
                  }
                : { label: 'Thời hạn hợp đồng', value: contract ? `${formatDate(contract.startDate)} – ${formatDate(contract.endDate)}` : null },
              {
                label: 'Thanh toán',
                value: payment ? (
                  <Badge tone={getPaymentStatusMeta(payment.status).tone} dot>
                    {getPaymentStatusMeta(payment.status).label}
                  </Badge>
                ) : null,
              },
              { label: 'Số tiền', value: <span className="tabular-nums">{formatCurrency(state.amountVnd)}</span> },
              { label: 'Mã giao dịch', value: state.transactionRef || null, mono: true },
              !forContract
                ? {
                    label: 'Hợp đồng',
                    value: contract ? (
                      <Badge tone={getContractStatusMeta(contract.status).tone} dot>
                        {getContractStatusMeta(contract.status).label}
                      </Badge>
                    ) : null,
                  }
                : { label: 'Trạng thái hợp đồng', value: contract ? getContractStatusMeta(contract.status).label : null },
              !forContract
                ? {
                    label: 'Hẹn nhận kho',
                    value: booking?.expectedCheckInAt ? formatDateTime(booking.expectedCheckInAt) : booking?.startDate ? formatDate(booking.startDate) : null,
                  }
                : { label: 'Thời gian thanh toán', value: payment?.paymentTime ? formatDateTime(payment.paymentTime) : null },
            ]}
          />
        ) : null}

        {state.kind === 'paid' && purpose === 'booking' ? (
          <Alert tone="info" title="Bước tiếp theo">
            {state.contractSigned
              ? 'Hãy mang căn cước công dân bản gốc tới cơ sở theo lịch hẹn để nhân viên nghiệm thu và bàn giao kho. Mã PIN riêng được kích hoạt sau khi bàn giao.'
              : 'Ký hợp đồng điện tử (xác thực OTP qua email) hoặc ký tại quầy, sau đó mang căn cước công dân bản gốc tới cơ sở để nhận bàn giao.'}
          </Alert>
        ) : null}
        {state.kind === 'paid' && purpose === 'renewal' ? (
          <Alert tone="info" title="Bước tiếp theo">
            Nếu chưa ký phụ lục gia hạn, hãy mở Kho của tôi và chọn Ký phụ lục để hoàn tất gia hạn.
          </Alert>
        ) : null}

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-center">{actions}</div>
      </CardContent>
    </Card>
  )
}
