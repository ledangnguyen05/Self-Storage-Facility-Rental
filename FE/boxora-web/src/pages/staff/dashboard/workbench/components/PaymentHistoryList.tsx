import React, { useState } from 'react'
import { BadgeCheck, ExternalLink } from 'lucide-react'
import { SignedFileLink } from '@/components/common/SignedFileLink'
import { Badge, Button, ConfirmDialog, useToast } from '@/components/ui'
import { getPaymentMethodMeta, getPaymentStatusMeta } from '@/constants/statusMeta'
import { getApiErrorMessage } from '@/lib/apiError'
import { formatCurrency, formatDateTime } from '@/lib/format'
import { handoverService, type PaymentRecordItem } from '@/services/handoverService'

/** Which condition the list belongs to: an online booking payment pays both, so each card shows its own share. */
export type PaymentScope = 'DEPOSIT' | 'RENTAL_FEE'

interface PaymentHistoryListProps {
  payments: PaymentRecordItem[]
  scope: PaymentScope
  /** Called after a bank transfer is confirmed, to reload the conditions. */
  onChanged: () => Promise<void> | void
}

/** A transfer can be confirmed only while it is waiting for the bank and has its reference and receipt. */
function canConfirmTransfer(payment: PaymentRecordItem): boolean {
  return (
    String(payment.paymentMethod).toUpperCase() === 'BANK_TRANSFER' &&
    String(payment.status).toUpperCase() === 'PENDING' &&
    Boolean(payment.referenceCode) &&
    Boolean(payment.proofDocumentUrl)
  )
}

const isOnlineBookingPayment = (payment: PaymentRecordItem) => String(payment.paymentType).toUpperCase() === 'BOOKING_PAYMENT'

/** The part of a payment that counts for this condition. */
function shareFor(payment: PaymentRecordItem, scope: PaymentScope): number {
  if (!isOnlineBookingPayment(payment)) return payment.amount
  const deposit = Math.min(payment.amount, Math.max(0, payment.depositPortion ?? 0))
  return scope === 'DEPOSIT' ? deposit : payment.amount - deposit
}

/**
 * Payments behind one condition (deposit or first month's rent): counter payments recorded here and the money the
 * customer paid online when booking (VNPay), which covers both conditions in one transaction.
 */
export function PaymentHistoryList({ payments, scope, onChanged }: PaymentHistoryListProps) {
  const toast = useToast()
  const [target, setTarget] = useState<PaymentRecordItem | null>(null)

  if (payments.length === 0) {
    return <p className="text-xs text-fg-subtle">Chưa có giao dịch nào được ghi nhận.</p>
  }

  const confirmTransfer = async () => {
    if (!target) return
    try {
      await handoverService.confirmBankTransferPayment(target.id, 'Nhân viên đã đối chiếu tiền về tài khoản ngân hàng.')
      toast.success('Đã xác nhận tiền chuyển khoản', `${formatCurrency(target.amount)} đã được tính vào số tiền đã thu.`)
      setTarget(null)
      await onChanged()
    } catch (err) {
      toast.error('Không xác nhận được giao dịch', getApiErrorMessage(err))
    }
  }

  return (
    <>
      <ul className="flex flex-col divide-y divide-line rounded-md border border-line">
        {payments.map((payment) => {
          const status = getPaymentStatusMeta(payment.status)
          const reference = payment.referenceCode || payment.receiptVoucherCode || payment.transactionId
          const online = isOnlineBookingPayment(payment)
          return (
            <li key={payment.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-2">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-sm font-medium tabular-nums text-fg">{formatCurrency(shareFor(payment, scope))}</span>
                  <span className="text-xs text-fg-muted">
                    {online ? 'Thanh toán đặt kho trực tuyến' : getPaymentMethodMeta(payment.paymentMethod).label}
                  </span>
                </div>
                {online ? (
                  <p className="text-xs text-fg-subtle">
                    {scope === 'DEPOSIT' ? 'Phần tiền cọc' : 'Phần tiền thuê tháng đầu'} trong khoản {formatCurrency(payment.amount)} khách đã trả qua{' '}
                    {getPaymentMethodMeta(payment.paymentMethod).label}
                  </p>
                ) : null}
                <div className="flex flex-wrap items-center gap-x-2 text-xs text-fg-subtle">
                  <span className="tabular-nums">{formatDateTime(payment.paymentTime)}</span>
                  {reference ? <span className="truncate font-mono">{reference}</span> : null}
                  {payment.proofDocumentUrl ? (
                    <SignedFileLink href={payment.proofDocumentUrl} className="inline-flex items-center gap-1 text-accent-text hover:underline">
                      Xem biên lai <ExternalLink size={12} strokeWidth={1.75} aria-hidden="true" />
                    </SignedFileLink>
                  ) : null}
                </div>
              </div>
              <Badge tone={status.tone} size="sm">
                {status.label}
              </Badge>
              {canConfirmTransfer(payment) ? (
                <Button size="sm" variant="secondary" leftIcon={BadgeCheck} onClick={() => setTarget(payment)}>
                  Xác nhận đã nhận tiền
                </Button>
              ) : null}
            </li>
          )
        })}
      </ul>
      <ConfirmDialog
        open={Boolean(target)}
        onClose={() => setTarget(null)}
        title="Xác nhận đã nhận tiền chuyển khoản?"
        description={
          target
            ? `Khoản ${formatCurrency(target.amount)}${target.referenceCode ? ` (mã tham chiếu ${target.referenceCode})` : ''} sẽ được tính vào số tiền đã thu. Chỉ xác nhận sau khi đã thấy tiền về tài khoản.`
            : undefined
        }
        confirmLabel="Xác nhận đã nhận tiền"
        onConfirm={confirmTransfer}
      />
    </>
  )
}
