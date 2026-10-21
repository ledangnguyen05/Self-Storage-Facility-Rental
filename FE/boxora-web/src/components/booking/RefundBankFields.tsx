import { useId } from 'react'
import { Field, Input } from '../ui'
import type { RefundBankErrors, RefundBankValue } from './refundBank'

/** Common Vietnamese banks offered as suggestions (any name is accepted). */
const BANK_SUGGESTIONS = [
  'Vietcombank',
  'VietinBank',
  'BIDV',
  'Agribank',
  'Techcombank',
  'MB Bank',
  'ACB',
  'VPBank',
  'Sacombank',
  'TPBank',
  'VIB',
  'SHB',
  'HDBank',
  'OCB',
  'MSB',
  'SeABank',
]

interface RefundBankFieldsProps {
  value: RefundBankValue
  onChange: (value: RefundBankValue) => void
  errors?: RefundBankErrors
  disabled?: boolean
  /** Marks the fields required in the labels. */
  required?: boolean
}

/** Bank name, account number and holder, used by the cancel dialog, the customer refunds card and the finance queue. */
export function RefundBankFields({ value, onChange, errors = {}, disabled, required = false }: RefundBankFieldsProps) {
  const listId = useId()
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <Field label="Ngân hàng" required={required} error={errors.bankName} disabled={disabled}>
        <Input
          list={listId}
          value={value.bankName}
          maxLength={100}
          autoComplete="off"
          placeholder="Ví dụ: Vietcombank"
          onChange={event => onChange({ ...value, bankName: event.target.value })}
        />
      </Field>
      <datalist id={listId}>
        {BANK_SUGGESTIONS.map(bank => (
          <option key={bank} value={bank} />
        ))}
      </datalist>
      <Field label="Số tài khoản" required={required} error={errors.bankAccountNumber} disabled={disabled}>
        <Input
          inputMode="numeric"
          value={value.bankAccountNumber}
          maxLength={24}
          autoComplete="off"
          className="font-mono tabular-nums"
          onChange={event => onChange({ ...value, bankAccountNumber: event.target.value.replace(/[^\d ]/g, '') })}
        />
      </Field>
      <Field label="Chủ tài khoản" required={required} error={errors.bankAccountName} disabled={disabled} className="sm:col-span-2">
        <Input
          value={value.bankAccountName}
          maxLength={100}
          autoComplete="name"
          placeholder="Họ tên in trên thẻ ngân hàng"
          onChange={event => onChange({ ...value, bankAccountName: event.target.value.toUpperCase() })}
        />
      </Field>
    </div>
  )
}
