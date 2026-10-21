import React, { useState } from 'react'
import { ArrowLeft, ClipboardCheck } from 'lucide-react'
import { Alert, Badge, Button, ConfirmDialog, DescriptionList } from '@/components/ui'
import { formatCurrency } from '@/lib/format'
import { EvidenceViewer } from '../../../components/EvidenceViewer'
import type { ReturnInspectionForm } from '../../hooks/useReturnInspection'
import type { ReturnQueueItem } from '../../utils/frontDesk'
import {
  REFUND_METHOD_OPTIONS,
  RETURN_ITEMS,
  collectReturnPhotos,
  computeSettlement,
  getOptionLabel,
  isItemPassed,
  type ReturnPreview,
} from '../returnInspection'

interface ReturnConfirmStepProps {
  item: ReturnQueueItem
  preview: ReturnPreview | undefined
  form: ReturnInspectionForm
  deposit: number
  submitError: string | null
  onBack: () => void
  /** Saves the inspection and settlement. Rejects on failure (the dialog stays open). */
  onSubmit: () => Promise<void>
}

export function ReturnConfirmStep({ item, preview, form, deposit, submitError, onBack, onSubmit }: ReturnConfirmStepProps) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const settlement = computeSettlement(deposit, form.fees)
  const unitCode = preview?.unitCode || item.unitCode || '—'
  const refundLabel = REFUND_METHOD_OPTIONS.find((option) => option.value === form.refundMethod)?.label ?? '—'
  const showsBank = form.refundMethod === 'BANK_TRANSFER' && settlement.refund > 0
  // With nothing to refund there is no refund method to talk about (and no bank account was collected).
  const refundSummary = settlement.refund > 0 ? refundLabel : settlement.debt > 0 ? 'Không hoàn cọc, khách còn nợ' : 'Không có khoản hoàn'

  const photos = collectReturnPhotos(form.photos)

  const confirm = async () => {
    try {
      await onSubmit()
      setConfirmOpen(false)
    } catch {
      // The error is shown inline and as a toast; keep the dialog closable.
      setConfirmOpen(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {submitError ? (
        <Alert tone="danger" title="Chưa lập được biên bản trả kho">
          {submitError}
        </Alert>
      ) : null}

      <DescriptionList
        columns={2}
        items={[
          { label: 'Khách thuê', value: preview?.customerName || item.customerName || '—' },
          { label: 'Kho', value: unitCode, mono: true },
          { label: 'Tiền cọc', value: formatCurrency(deposit) },
          { label: 'Tổng khấu trừ', value: formatCurrency(settlement.total) },
          { label: 'Dự kiến hoàn cọc', value: <span className="font-semibold text-success">{formatCurrency(settlement.refund)}</span> },
          ...(settlement.debt > 0
            ? [{ label: 'Khách còn nợ', value: <span className="font-semibold text-danger">{formatCurrency(settlement.debt)}</span> }]
            : []),
          { label: 'Hình thức hoàn', value: refundSummary },
          ...(showsBank
            ? [
                { label: 'Ngân hàng', value: form.refundBank.bankName.trim() || '—' },
                { label: 'Số tài khoản', value: form.refundBank.accountNumber.trim() || '—', mono: true },
                { label: 'Chủ tài khoản', value: form.refundBank.accountName.trim() || '—' },
              ]
            : []),
          ...(form.reason.trim() ? [{ label: 'Lý do khấu trừ', value: form.reason.trim(), full: true }] : []),
        ]}
      />

      <section className="flex flex-col gap-2" aria-label="Kết quả nghiệm thu">
        <h4 className="text-sm font-semibold text-fg">Kết quả nghiệm thu</h4>
        <ul className="divide-y divide-line rounded-lg border border-line">
          {RETURN_ITEMS.map((entry) => {
            const value = form.inspection[entry.key]
            const passed = isItemPassed(entry.key, value)
            return (
              <li key={entry.key} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm">
                <span className="text-fg">{entry.label}</span>
                <span className="flex items-center gap-2">
                  <span className="text-fg-muted">{getOptionLabel(entry.key, value)}</span>
                  <Badge tone={passed ? 'success' : 'warning'} size="sm">
                    {passed ? 'Đạt' : 'Chưa đạt'}
                  </Badge>
                </span>
              </li>
            )
          })}
        </ul>
      </section>

      <section className="flex flex-col gap-2" aria-label="Ảnh hiện trạng">
        <h4 className="text-sm font-semibold text-fg">Ảnh hiện trạng ({photos.length})</h4>
        <EvidenceViewer urls={photos} label="Ảnh hiện trạng" emptyText="Chưa có ảnh hiện trạng." />
      </section>

      <div className="flex flex-wrap items-center justify-end gap-3 border-t border-line pt-4">
        <Button variant="ghost" leftIcon={ArrowLeft} onClick={onBack} className="mr-auto">
          Quay lại
        </Button>
        <Button leftIcon={ClipboardCheck} onClick={() => setConfirmOpen(true)}>
          Lập biên bản trả kho
        </Button>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title={`Lập biên bản trả kho ${unitCode}?`}
        description={
          settlement.debt > 0
            ? `Hợp đồng chuyển sang hoàn tất, mã PIN của khách bị thu hồi và khoản khách còn nợ ${formatCurrency(settlement.debt)} được ghi nhận để kế toán thu hồi. Không thể hoàn tác tại quầy.`
            : `Hợp đồng chuyển sang hoàn tất, mã PIN của khách bị thu hồi và đề xuất hoàn cọc ${formatCurrency(settlement.refund)} được gửi đi duyệt. Không thể hoàn tác tại quầy.`
        }
        confirmLabel="Lập biên bản"
        onConfirm={confirm}
      />
    </div>
  )
}
