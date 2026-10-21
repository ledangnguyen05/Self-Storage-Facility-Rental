import React, { useState } from 'react'
import { Clock } from 'lucide-react'
import type { Booking, BookingCancelResponse, BookingCancellationPreview } from '../../types'
import { bookingService } from '../../services/bookingService'
import { useAsyncData } from '../../hooks/useAsyncData'
import { getApiErrorMessage } from '../../lib/apiError'
import { formatCurrency, formatPercent } from '../../lib/format'
import { getBookingStatusMeta } from '../../constants/statusMeta'
import { Alert, Badge, Button, DescriptionList, Modal, Skeleton } from '../ui'
import { RefundMilestones } from './cancel/RefundMilestones'
import { useCancelPolicy } from './cancel/useCancelPolicy'
import { ModalSuccess } from './shared/ModalSuccess'
import { ReasonPicker } from './shared/ReasonPicker'
import { CANCEL_REASON_PRESETS, EMPTY_REASON, resolveReason, type ReasonValue } from './shared/reason'
import { RefundBankFields } from '../booking/RefundBankFields'
import {
  EMPTY_REFUND_BANK,
  isRefundBankEmpty,
  validateRefundBank,
  type RefundBankErrors,
  type RefundBankValue,
} from '../booking/refundBank'

interface BookingCancelModalProps {
  isOpen: boolean
  booking: Booking | null
  onClose: () => void
  onSuccess: (result: BookingCancelResponse) => void | Promise<void>
}

type CancelResult = BookingCancelResponse

const NO_PAYMENT_STAGE = 'STAGE_PENDING_NO_PAYMENT'

function describeTimeRemaining(preview: BookingCancellationPreview): string {
  if (preview.timeRemainingLabel) return preview.timeRemainingLabel
  const hours = Number(preview.hoursUntilCheckin)
  if (!Number.isFinite(hours)) return ''
  if (hours < 0) return 'Đã quá giờ hẹn nhận kho'
  if (hours < 24) return 'Còn dưới 24 giờ đến lịch hẹn nhận kho'
  return `Còn khoảng ${Math.floor(hours / 24)} ngày ${hours % 24} giờ đến lịch hẹn nhận kho`
}

export const BookingCancelModal: React.FC<BookingCancelModalProps> = ({ isOpen, booking, onClose, onSuccess }) => {
  if (!isOpen || !booking) return null
  return <CancelDialog booking={booking} onClose={onClose} onSuccess={onSuccess} />
}

interface CancelDialogProps {
  booking: Booking
  onClose: () => void
  onSuccess: BookingCancelModalProps['onSuccess']
}

function CancelDialog({ booking, onClose, onSuccess }: CancelDialogProps) {
  const [reason, setReason] = useState<ReasonValue>(EMPTY_REASON)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [result, setResult] = useState<CancelResult | null>(null)
  const [bank, setBank] = useState<RefundBankValue>(EMPTY_REFUND_BANK)
  const [bankErrors, setBankErrors] = useState<RefundBankErrors>({})

  const previewQuery = useAsyncData((signal) => bookingService.getCancellationPreview(booking.id, { signal }), [booking.id])

  // The facility policy supplies the milestone hours (backend defaults when the facility has none).
  const policyQuery = useCancelPolicy(booking)

  const preview = previewQuery.data
  const previewFailed = Boolean(previewQuery.error) || (!previewQuery.isLoading && !preview)
  const canCancel = Boolean(preview) && !previewQuery.error && !previewQuery.isLoading
  const policy = policyQuery.error ? null : (policyQuery.data?.policy ?? null)
  const hasNoPayment = preview?.milestoneStage === NO_PAYMENT_STAGE

  const refundable = Number(preview?.refundAmount) > 0

  const handleConfirm = async () => {
    if (!canCancel || isSubmitting) return
    const errors = refundable ? validateRefundBank(bank, { required: false }) : {}
    setBankErrors(errors)
    if (Object.keys(errors).length > 0) return
    setIsSubmitting(true)
    setSubmitError(null)
    try {
      const response = await bookingService.cancelBooking(booking.id, {
        cancellationReason: resolveReason(reason, 'Khách hàng yêu cầu hủy đơn'),
        ...(refundable && !isRefundBankEmpty(bank) ? bank : {}),
      })
      setResult(response)
      // The booking is already cancelled: a failed refresh in the parent must not look like a failed cancellation.
      void Promise.resolve(onSuccess(response)).catch(() => undefined)
    } catch (err) {
      setSubmitError(getApiErrorMessage(err, 'Hủy đơn đặt kho thất bại. Vui lòng thử lại sau.'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const footer = result ? (
    <Button onClick={onClose}>Đóng</Button>
  ) : (
    <>
      <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
        Giữ lại đơn
      </Button>
      <Button variant="danger" onClick={() => void handleConfirm()} loading={isSubmitting} disabled={!canCancel}>
        Xác nhận hủy đơn
      </Button>
    </>
  )

  return (
    <Modal
      open
      onClose={onClose}
      size="md"
      title="Hủy đơn đặt kho"
      description={`Đơn ${booking.bookingCode} · Kho ${booking.unitCode}${booking.facilityName ? ` · ${booking.facilityName}` : ''}`}
      dismissible={!isSubmitting}
      footer={footer}
    >
      {result ? (
        <CancelSuccess
          result={result}
          booking={booking}
          refundSlaDays={policy ? policy.depositRefundSlaDays : null}
        />
      ) : previewQuery.isLoading ? (
        <div className="flex flex-col gap-4" aria-busy="true">
          <Skeleton className="h-5 w-48" />
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </div>
          <Skeleton className="h-28" />
        </div>
      ) : previewFailed || !preview ? (
        <Alert
          tone="danger"
          title="Không tính được khoản hoàn cọc"
          action={
            <Button size="sm" variant="secondary" onClick={() => void previewQuery.reload()}>
              Thử lại
            </Button>
          }
        >
          {previewQuery.error
            ? getApiErrorMessage(previewQuery.error, 'Không thể tính toán thông tin hoàn tiền khi hủy đơn.')
            : 'Chưa có dữ liệu hoàn tiền. Bạn chỉ có thể hủy đơn sau khi hệ thống tính xong khoản hoàn cọc.'}
        </Alert>
      ) : (
        <div className="flex flex-col gap-5">
          <section aria-label="Chính sách hoàn cọc" className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-fg">Chính sách hoàn tiền cọc</h3>
              {describeTimeRemaining(preview) ? (
                <Badge tone="neutral" icon={Clock}>
                  {describeTimeRemaining(preview)}
                </Badge>
              ) : null}
            </div>

            {hasNoPayment ? null : policyQuery.isLoading ? (
              <Skeleton className="h-24" />
            ) : policy ? (
              <RefundMilestones
                stage={preview.milestoneStage}
                fullRefundHours={policy.cancellationFullRefundHours}
                partialRefundHours={policy.cancellationPartialRefundHours}
                partialRefundPercent={policy.cancellationPartialRefundPercent}
              />
            ) : null}

            <Alert tone="info" title="Mức áp dụng cho đơn này" icon={null}>
              {preview.policyDescription}
            </Alert>
          </section>

          <section aria-label="Khoản hoàn lại" className="rounded-lg border border-line p-4">
            <DescriptionList
              layout="inline"
              items={[
                { label: 'Tiền cọc đã thanh toán', value: <span className="tabular-nums">{formatCurrency(preview.depositPaid)}</span> },
                { label: 'Tỷ lệ hoàn cọc', value: <span className="tabular-nums">{formatPercent(preview.refundPercentage)}</span> },
                ...(Number(preview.prepaidRentAmount) > 0
                  ? [{ label: 'Tiền thuê đã trả trước (hoàn 100%)', value: <span className="tabular-nums">{formatCurrency(preview.prepaidRentAmount)}</span> }]
                  : []),
                ...(Number(preview.penaltyAmount) > 0
                  ? [{ label: 'Khấu trừ', value: <span className="tabular-nums text-danger">{formatCurrency(preview.penaltyAmount)}</span> }]
                  : []),
                {
                  label: <span className="font-medium text-fg">Số tiền hoàn lại</span>,
                  value: <span className="font-semibold tabular-nums">{formatCurrency(preview.refundAmount)}</span>,
                },
              ]}
            />
          </section>

          {refundable ? (
            <section aria-label="Tài khoản nhận hoàn tiền" className="flex flex-col gap-3">
              <div>
                <h3 className="text-sm font-semibold text-fg">Tài khoản nhận hoàn tiền</h3>
                <p className="text-dense text-fg-muted">
                  Nhập tài khoản đứng tên bạn để cơ sở chuyển khoản. Bạn cũng có thể bổ sung sau trong mục Hợp đồng và thanh toán.
                </p>
              </div>
              <RefundBankFields value={bank} onChange={setBank} errors={bankErrors} disabled={isSubmitting} />
            </section>
          ) : null}

          <Alert tone="warning" title="Thao tác không thể hoàn tác">
            Sau khi xác nhận, đơn bị hủy và kho {booking.unitCode} được giải phóng cho khách khác.
          </Alert>

          <ReasonPicker
            label="Lý do hủy đơn"
            presets={CANCEL_REASON_PRESETS}
            value={reason}
            onChange={setReason}
            notePlaceholder="Nhập thêm chi tiết lý do hủy nếu cần"
            disabled={isSubmitting}
          />

          {submitError ? (
            <Alert tone="danger" title="Chưa hủy được đơn">
              {submitError}
            </Alert>
          ) : null}
        </div>
      )}
    </Modal>
  )
}

interface CancelSuccessProps {
  result: CancelResult
  booking: Booking
  /** Refund SLA from the facility policy, or null when the policy could not be read. */
  refundSlaDays: number | null
}

function CancelSuccess({ result, booking, refundSlaDays }: CancelSuccessProps) {
  const statusMeta = getBookingStatusMeta(result.status ?? 'CANCELLED')
  const refundAmount = Number(result.refundAmount) || 0
  const penaltyAmount = Number(result.penaltyAmount) || 0

  return (
    <ModalSuccess title="Đã hủy đơn đặt kho" description={result.message}>
      <div className="rounded-lg border border-line p-4">
        <DescriptionList
          layout="inline"
          items={[
            { label: 'Mã đơn', value: result.bookingCode || booking.bookingCode, mono: true },
            { label: 'Trạng thái', value: <Badge tone={statusMeta.tone}>{statusMeta.label}</Badge> },
            { label: `Kho ${booking.unitCode}`, value: result.unitReleased ? 'Đã giải phóng' : null },
            {
              label: 'Khoản hoàn cọc',
              value:
                refundAmount > 0 ? (
                  <span className="font-semibold tabular-nums">
                    {formatCurrency(refundAmount)} ({formatPercent(result.refundPercentage)})
                  </span>
                ) : (
                  'Không có khoản hoàn'
                ),
            },
            ...(penaltyAmount > 0 ? [{ label: 'Khấu trừ', value: <span className="tabular-nums">{formatCurrency(penaltyAmount)}</span> }] : []),
            ...(result.refundRequestCode ? [{ label: 'Mã yêu cầu hoàn cọc', value: result.refundRequestCode, mono: true }] : []),
            ...(result.refundTransactionId ? [{ label: 'Mã giao dịch hoàn tiền', value: result.refundTransactionId, mono: true }] : []),
          ]}
        />
      </div>
      {refundAmount > 0 ? (
        <Alert tone={result.bankInfoMissing ? 'warning' : 'info'} title={result.bankInfoMissing ? 'Cần tài khoản nhận hoàn tiền' : undefined}>
          Yêu cầu hoàn tiền đã được ghi nhận và đang chờ cơ sở xét duyệt.
          {(result.refundSlaDays ?? refundSlaDays) != null ? ` Thời hạn hoàn tiền theo chính sách: ${result.refundSlaDays ?? refundSlaDays} ngày làm việc.` : ''}
          {result.bankInfoMissing ? ' Vui lòng cung cấp tài khoản nhận tiền trong mục Hợp đồng và thanh toán để được chuyển khoản.' : ''}
        </Alert>
      ) : null}
    </ModalSuccess>
  )
}

export default BookingCancelModal
