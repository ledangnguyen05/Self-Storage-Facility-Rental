import React, { useEffect, useState } from 'react'
import { Avatar, Badge, Stepper, useToast } from '@/components/ui'
import { getHandoverStatusMeta } from '@/constants/statusMeta'
import { useAsyncData } from '@/hooks/useAsyncData'
import { getApiErrorMessage } from '@/lib/apiError'
import { formatCurrency, formatDate, toNumber, todayISO } from '@/lib/format'
import { handoverService } from '@/services/handoverService'
import { useReturnInspection } from '../hooks/useReturnInspection'
import type { ReturnQueueItem } from '../utils/frontDesk'
import { buildInspectionPayload, buildSettlementPayload, computeSettlement } from './returnInspection'
import { ReturnConfirmStep } from './steps/ReturnConfirmStep'
import { ReturnDamageStep } from './steps/ReturnDamageStep'
import { ReturnDateStep } from './steps/ReturnDateStep'
import { ReturnSettlementStep } from './steps/ReturnSettlementStep'

interface ReturnWizardBodyProps {
  item: ReturnQueueItem
  onCompleted: (item: ReturnQueueItem) => void
}

const STEPS = [
  { id: 'date', label: 'Ngày trả', description: 'Hạn hợp đồng, quá hạn' },
  { id: 'inspection', label: 'Nghiệm thu', description: '5 hạng mục, 2 ảnh' },
  { id: 'settlement', label: 'Khấu trừ', description: 'Các khoản phát sinh' },
  { id: 'confirm', label: 'Xác nhận', description: 'Lập biên bản' },
]

/** One contract's return wizard. Keyed by booking id by the parent, so all form state starts fresh. */
export function ReturnWizardBody({ item, onCompleted }: ReturnWizardBodyProps) {
  const toast = useToast()
  const form = useReturnInspection()
  const [submitError, setSubmitError] = useState<string | null>(null)
  const today = todayISO()

  const previewQuery = useAsyncData(
    (signal) => handoverService.getReturnSettlementPreview(item.bookingId, { signal }),
    [item.bookingId],
  )
  const preview = previewQuery.data

  const { prefillOverdue } = form
  useEffect(() => {
    if (preview) prefillOverdue(toNumber(preview.calculatedOverdueLateFee))
  }, [preview, prefillOverdue])

  const deposit = toNumber(preview?.depositPaid) ?? toNumber(item.booking?.depositPaid) ?? 0
  const policyLateFee = preview ? (toNumber(preview.calculatedOverdueLateFee) ?? 0) : undefined

  const submit = async () => {
    setSubmitError(null)
    const input = {
      bookingId: item.bookingId,
      deposit,
      inspection: form.inspection,
      photos: form.photos,
      notes: form.notes,
      fees: form.fees,
      reason: form.reason,
      refundMethod: form.refundMethod,
      refundBank: form.refundBank,
    }
    try {
      if (String(item.status).toUpperCase() === 'CHECKOUT_REQUESTED' && !form.inspectionRecorded) {
        await handoverService.performInspection(buildInspectionPayload(input))
        form.setInspectionRecorded(true)
      }
      const result = await handoverService.processReturnSettlement(buildSettlementPayload(input))
      // The server's figures win: it recomputes the late fee and the deposit actually collected.
      const refund = toNumber(result?.netRefundAmount) ?? computeSettlement(deposit, form.fees).refund
      const review = result?.reviewStatus ? getHandoverStatusMeta(result.reviewStatus).label : null
      const sla = toNumber(result?.depositRefundSlaDays)
      const debt = toNumber(result?.customerDebtAmount) ?? 0
      toast.success(
        `Đã lập biên bản trả kho ${preview?.unitCode || item.unitCode || ''}`.trim(),
        debt > 0
          ? 'Khấu trừ vượt tiền cọc nên khách không được hoàn cọc.'
          : `Đề xuất hoàn cọc ${formatCurrency(refund)}${review ? ` · ${review}` : ''}${sla ? ` · cam kết hoàn trong ${sla} ngày làm việc` : ''}.`,
      )
      if (debt > 0) {
        toast.warning(`Khách còn nợ ${formatCurrency(debt)}`, 'Công nợ đã được ghi nhận để kế toán thu hồi.')
      }
      onCompleted(item)
    } catch (err) {
      const message = getApiErrorMessage(err, 'Có lỗi khi lập biên bản trả kho.')
      setSubmitError(message)
      toast.error('Không lập được biên bản trả kho', message)
      throw err
    }
  }

  const customerName = preview?.customerName || item.customerName || ''

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start gap-3">
        <Avatar name={customerName || undefined} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-base font-semibold text-fg">{customerName || 'Khách thuê'}</span>
            {item.bookingCode || preview?.bookingCode ? (
              <span className="font-mono text-dense text-fg-muted">{item.bookingCode || preview?.bookingCode}</span>
            ) : null}
            <Badge tone={item.statusMeta.tone} dot>
              {item.statusMeta.label}
            </Badge>
          </div>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-dense text-fg-muted">
            <span className="tabular-nums">{preview?.customerPhone || item.customerPhone || '—'}</span>
            <span>
              Kho <span className="font-mono text-fg">{preview?.unitCode || item.unitCode || '—'}</span>
            </span>
            <span className="tabular-nums">Hạn trả {formatDate(preview?.rentalEndDate || item.endDate)}</span>
          </div>
        </div>
      </div>

      <Stepper steps={STEPS} current={form.step} aria-label="Các bước trả kho" />

      {form.step === 0 ? (
        <ReturnDateStep
          item={item}
          preview={preview}
          isLoading={previewQuery.isLoading}
          error={previewQuery.error}
          onRetry={() => void previewQuery.reload()}
          today={today}
          onNext={() => form.goTo(1)}
        />
      ) : null}
      {form.step === 1 ? (
        <ReturnDamageStep bookingId={item.bookingId} form={form} onBack={() => form.goTo(0)} onNext={() => form.goTo(2)} />
      ) : null}
      {form.step === 2 ? (
        <ReturnSettlementStep
          form={form}
          deposit={deposit}
          maxOverdueFee={policyLateFee}
          onBack={() => form.goTo(1)}
          onNext={() => form.goTo(3)}
        />
      ) : null}
      {form.step === 3 ? (
        <ReturnConfirmStep
          item={item}
          preview={preview}
          form={form}
          deposit={deposit}
          submitError={submitError}
          onBack={() => form.goTo(2)}
          onSubmit={submit}
        />
      ) : null}
    </div>
  )
}
