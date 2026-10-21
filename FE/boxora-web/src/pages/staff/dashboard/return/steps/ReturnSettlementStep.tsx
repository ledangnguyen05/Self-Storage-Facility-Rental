import React from 'react'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { Alert, Button, Field, Input, Select, Textarea, cn } from '@/components/ui'
import { formatCurrency } from '@/lib/format'
import type { ReturnInspectionForm } from '../../hooks/useReturnInspection'
import {
  FEE_FIELDS,
  REFUND_METHOD_OPTIONS,
  computeSettlement,
  isRefundBankValid,
  needsDeductionReason,
  parseFee,
  validateRefundBank,
} from '../returnInspection'

interface ReturnSettlementStepProps {
  form: ReturnInspectionForm
  deposit: number
  /** Late fee set by the facility policy; staff may lower it but never charge more. */
  maxOverdueFee?: number
  onBack: () => void
  onNext: () => void
}

export function ReturnSettlementStep({ form, deposit, maxOverdueFee, onBack, onNext }: ReturnSettlementStepProps) {
  const settlement = computeSettlement(deposit, form.fees)
  const reasonRequired = needsDeductionReason(settlement.fees)
  const needsReason = reasonRequired && !form.reason.trim()
  const overdueTooHigh = maxOverdueFee !== undefined && settlement.fees.overdueDebt > maxOverdueFee
  const needsBank = form.refundMethod === 'BANK_TRANSFER' && settlement.refund > 0
  const bankErrors = needsBank ? validateRefundBank(form.refundBank) : {}
  const canContinue = settlement.valid && !needsReason && !overdueTooHigh && (!needsBank || isRefundBankValid(form.refundBank))

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-2">
        {FEE_FIELDS.map((field) => {
          const invalid = parseFee(form.fees[field.key]) === null
          const isOverdue = field.key === 'overdueDebt'
          const error = invalid
            ? 'Nhập số tiền hợp lệ, không âm.'
            : isOverdue && overdueTooHigh
              ? `Không vượt phí trễ hạn theo chính sách (${formatCurrency(maxOverdueFee)}).`
              : undefined
          return (
            <Field
              key={field.key}
              label={`${field.label} (₫)`}
              optional
              error={error}
              hint={isOverdue && !error && maxOverdueFee !== undefined ? `Theo chính sách cơ sở: ${formatCurrency(maxOverdueFee)}. Có thể giảm nếu quản lý đồng ý.` : undefined}
            >
              <Input
                type="number"
                inputMode="numeric"
                min={0}
                step={1000}
                value={form.fees[field.key]}
                onChange={(e) => form.setFee(field.key, e.target.value)}
                placeholder="0"
                className="tabular-nums"
              />
            </Field>
          )
        })}
      </div>

      <Field
        label="Lý do khấu trừ"
        required={reasonRequired}
        optional={!reasonRequired}
        error={needsReason ? 'Ghi rõ lý do khi có phí hư hỏng, vệ sinh hoặc mất thẻ, khóa.' : undefined}
        hint={!reasonRequired && settlement.total > 0 ? 'Chỉ có phí trễ hạn theo chính sách nên không cần ghi lý do.' : undefined}
      >
        <Textarea rows={2} value={form.reason} onChange={(e) => form.setReason(e.target.value)} placeholder="Ví dụ: thay chốt khóa, vệ sinh sàn kho…" />
      </Field>

      <Field label="Hình thức hoàn cọc">
        <Select value={form.refundMethod} onChange={(e) => form.setRefundMethod(e.target.value)} options={REFUND_METHOD_OPTIONS} className="sm:w-96" />
      </Field>

      {needsBank ? (
        <fieldset className="flex flex-col gap-3 rounded-lg border border-line p-4">
          <legend className="px-1 text-sm font-medium text-fg">Tài khoản nhận hoàn cọc của khách</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Ngân hàng" required error={bankErrors.bankName}>
              <Input
                value={form.refundBank.bankName}
                onChange={(e) => form.setRefundBank({ bankName: e.target.value })}
                placeholder="Ví dụ: Vietcombank"
                autoComplete="off"
              />
            </Field>
            <Field label="Số tài khoản" required error={bankErrors.accountNumber}>
              <Input
                value={form.refundBank.accountNumber}
                onChange={(e) => form.setRefundBank({ accountNumber: e.target.value })}
                inputMode="numeric"
                autoComplete="off"
                className="font-mono"
              />
            </Field>
            <Field label="Tên chủ tài khoản" required error={bankErrors.accountName} className="sm:col-span-2">
              <Input
                value={form.refundBank.accountName}
                onChange={(e) => form.setRefundBank({ accountName: e.target.value })}
                autoComplete="off"
                placeholder="Đúng như trên thẻ ngân hàng"
              />
            </Field>
          </div>
          <p className="text-xs text-fg-subtle">Kế toán dùng thông tin này để chuyển khoản. Hãy đọc lại số tài khoản với khách trước khi tiếp tục.</p>
        </fieldset>
      ) : null}

      <dl className="flex flex-col gap-2 rounded-lg border border-line bg-surface-2 p-4 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-fg-muted">Tiền cọc đã thu</dt>
          <dd className="tabular-nums text-fg">{formatCurrency(deposit)}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-fg-muted">Tổng khấu trừ</dt>
          <dd className={cn('tabular-nums', settlement.total > 0 ? 'text-danger' : 'text-fg')}>
            {settlement.total > 0 ? `−${formatCurrency(settlement.total)}` : formatCurrency(0)}
          </dd>
        </div>
        <div className="flex justify-between gap-3 border-t border-line pt-2">
          <dt className="font-medium text-fg">Dự kiến hoàn cọc</dt>
          <dd className="text-base font-semibold tabular-nums text-success">{formatCurrency(settlement.refund)}</dd>
        </div>
        {settlement.debt > 0 ? (
          <div className="flex justify-between gap-3">
            <dt className="font-medium text-danger">Khách còn nợ</dt>
            <dd className="font-semibold tabular-nums text-danger">{formatCurrency(settlement.debt)}</dd>
          </div>
        ) : null}
      </dl>

      {settlement.debt > 0 ? (
        <Alert tone="danger" title="Khấu trừ vượt tiền cọc">
          Khách không được hoàn cọc và còn nợ {formatCurrency(settlement.debt)}. Khoản này được ghi thành công nợ để kế toán thu hồi sau khi lập biên bản.
        </Alert>
      ) : (
        <Alert tone={settlement.total > 0 ? 'warning' : 'info'}>
          {settlement.total > 0
            ? 'Có khấu trừ: đề xuất hoàn cọc sẽ chuyển quản lý cơ sở và kế toán duyệt trước khi hoàn tiền.'
            : 'Không có khấu trừ: hệ thống có thể tự động duyệt hoàn toàn bộ tiền cọc.'}
        </Alert>
      )}

      <div className="flex flex-wrap items-center justify-end gap-3 border-t border-line pt-4">
        <Button variant="ghost" leftIcon={ArrowLeft} onClick={onBack} className="mr-auto">
          Quay lại
        </Button>
        <Button rightIcon={ArrowRight} disabled={!canContinue} onClick={onNext}>
          Xem lại và xác nhận
        </Button>
      </div>
    </div>
  )
}
