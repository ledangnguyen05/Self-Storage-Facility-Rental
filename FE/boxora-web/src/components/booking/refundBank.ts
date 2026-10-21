/** Bank account that receives a refund. */
export interface RefundBankValue {
  bankName: string
  bankAccountNumber: string
  bankAccountName: string
}

export type RefundBankErrors = Partial<Record<keyof RefundBankValue, string>>

export const EMPTY_REFUND_BANK: RefundBankValue = { bankName: '', bankAccountNumber: '', bankAccountName: '' }

export const isRefundBankEmpty = (value: RefundBankValue) =>
  !value.bankName.trim() && !value.bankAccountNumber.trim() && !value.bankAccountName.trim()

/**
 * Same rules as the backend: all three fields together, account number of 6 to 20 digits.
 * With `required: false` an all-empty value is valid (the customer adds it later).
 */
export function validateRefundBank(value: RefundBankValue, { required }: { required: boolean }): RefundBankErrors {
  if (!required && isRefundBankEmpty(value)) return {}
  const errors: RefundBankErrors = {}
  if (value.bankName.trim().length < 2) errors.bankName = 'Nhập tên ngân hàng.'
  const digits = value.bankAccountNumber.replace(/\s+/g, '')
  if (!/^\d{6,20}$/.test(digits)) errors.bankAccountNumber = 'Số tài khoản gồm 6 đến 20 chữ số.'
  if (value.bankAccountName.trim().length < 2) errors.bankAccountName = 'Nhập tên chủ tài khoản như trên thẻ ngân hàng.'
  return errors
}
