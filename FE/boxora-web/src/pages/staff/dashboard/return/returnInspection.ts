import type { HandoverPayload, ReturnSettlementPreview } from '@/services/handoverService'
import { formatCurrency, toNumber } from '@/lib/format'

/** What GET return-preview sends (ReturnSettlementPreviewResponse). */
export type ReturnPreview = ReturnSettlementPreview

type ChecklistField = 'doorConditionPassed' | 'cleanlinessPassed' | 'smartLockPassed' | 'sensorPassed' | 'wallStructurePassed'

/** Five on-site checks at return. The first option of each item is the passing one. */
export const RETURN_ITEMS = [
  {
    key: 'door',
    field: 'doorConditionPassed',
    label: 'Cửa cuốn và ray trượt',
    options: [
      { value: 'GOOD', label: 'Tốt, hoạt động bình thường' },
      { value: 'MINOR_DAMAGE', label: 'Móp nhẹ, trầy xước' },
      { value: 'BLOCKED', label: 'Kẹt ray, hỏng nặng' },
    ],
  },
  {
    key: 'cleanliness',
    field: 'cleanlinessPassed',
    label: 'Vệ sinh kho và sàn',
    options: [
      { value: 'CLEAN', label: 'Sạch, đã dọn rác' },
      { value: 'NEEDS_CLEANING', label: 'Còn rác, cần vệ sinh' },
      { value: 'DIRTY', label: 'Bẩn nhiều, ẩm mốc' },
    ],
  },
  {
    key: 'lock',
    field: 'smartLockPassed',
    label: 'Khóa thông minh và phụ kiện',
    options: [
      { value: 'NORMAL', label: 'Bình thường, đủ phụ kiện' },
      { value: 'LATCH_DAMAGED', label: 'Hỏng chốt an toàn' },
      { value: 'FAULTY', label: 'Mất khóa hoặc lỗi điện tử' },
    ],
  },
  {
    key: 'environment',
    field: 'sensorPassed',
    label: 'Môi trường và cảm biến',
    options: [
      { value: 'GOOD', label: 'Khô ráo, thông thoáng' },
      { value: 'NEEDS_MAINTENANCE', label: 'Cần bảo dưỡng quạt, cảm biến' },
      { value: 'ALERT', label: 'Có dấu hiệu ẩm ướt' },
    ],
  },
  {
    key: 'wall',
    field: 'wallStructurePassed',
    label: 'Tường vách và kết cấu',
    options: [
      { value: 'INTACT', label: 'Nguyên vẹn' },
      { value: 'DAMAGED', label: 'Bong tróc, nứt vỡ' },
    ],
  },
] as const satisfies ReadonlyArray<{
  key: string
  field: ChecklistField
  label: string
  options: ReadonlyArray<{ value: string; label: string }>
}>

export type ReturnItemKey = (typeof RETURN_ITEMS)[number]['key']
/** Selected option value per item ('' = not assessed yet). */
export type ReturnInspectionState = Record<ReturnItemKey, string>

export const EMPTY_RETURN_INSPECTION: ReturnInspectionState = {
  door: '',
  cleanliness: '',
  lock: '',
  environment: '',
  wall: '',
}

export const RETURN_PHOTO_SLOTS = [
  { key: 'panoramic', label: 'Toàn cảnh kho', hint: 'Chụp toàn bộ sàn và vách sau khi khách dọn đồ.' },
  { key: 'lock', label: 'Khóa và cửa kho', hint: 'Chụp rõ khóa thông minh và cửa cuốn.' },
] as const

export type ReturnPhotoKey = (typeof RETURN_PHOTO_SLOTS)[number]['key']
export type ReturnPhotos = Partial<Record<ReturnPhotoKey, string>>

export const REFUND_METHOD_OPTIONS = [
  { value: 'BANK_TRANSFER', label: 'Chuyển khoản ngân hàng' },
  { value: 'CASH', label: 'Tiền mặt tại quầy' },
  { value: 'VNPAY_REFUND', label: 'Hoàn về VNPay (kế toán thực hiện thủ công)' },
]

/** Account the deposit is refunded to; required for BANK_TRANSFER when there is something to refund. */
export interface RefundBank {
  bankName: string
  accountNumber: string
  accountName: string
}

export const EMPTY_REFUND_BANK: RefundBank = { bankName: '', accountNumber: '', accountName: '' }

/** Field errors of the bank form (none = valid). Like the refund flow: spaces, dots and hyphens are ignored, 6-20 digits remain. */
export function validateRefundBank(bank: RefundBank): Partial<Record<keyof RefundBank, string>> {
  const errors: Partial<Record<keyof RefundBank, string>> = {}
  if (!bank.bankName.trim()) errors.bankName = 'Nhập tên ngân hàng của khách.'
  if (!/^\d{6,20}$/.test(bank.accountNumber.replace(/[\s.-]/g, ''))) errors.accountNumber = 'Số tài khoản chỉ gồm 6 đến 20 chữ số.'
  if (!bank.accountName.trim()) errors.accountName = 'Nhập tên chủ tài khoản đúng như trên thẻ.'
  return errors
}

export function isRefundBankValid(bank: RefundBank): boolean {
  return Object.keys(validateRefundBank(bank)).length === 0
}

export const FEE_FIELDS = [
  { key: 'damageFee', label: 'Phí hư hỏng' },
  { key: 'cleaningFee', label: 'Phí vệ sinh' },
  { key: 'lostCardFee', label: 'Phí mất thẻ, khóa' },
  { key: 'overdueDebt', label: 'Phí trễ hạn' },
] as const

export type FeeKey = (typeof FEE_FIELDS)[number]['key']
/** Raw input strings so an empty field stays empty. */
export type ReturnFees = Record<FeeKey, string>

export const EMPTY_FEES: ReturnFees = { damageFee: '', cleaningFee: '', lostCardFee: '', overdueDebt: '' }

export function getOptionLabel(key: ReturnItemKey, value: string): string {
  const item = RETURN_ITEMS.find((entry) => entry.key === key)
  const options: ReadonlyArray<{ value: string; label: string }> = item?.options ?? []
  return options.find((option) => option.value === value)?.label ?? '—'
}

export function isItemPassed(key: ReturnItemKey, value: string): boolean {
  const item = RETURN_ITEMS.find((entry) => entry.key === key)
  return Boolean(item && value && item.options[0].value === value)
}

export function isInspectionComplete(state: ReturnInspectionState): boolean {
  return RETURN_ITEMS.every((item) => Boolean(state[item.key]))
}

export function collectReturnPhotos(photos: ReturnPhotos): string[] {
  return RETURN_PHOTO_SLOTS.map((slot) => photos[slot.key]).filter((photo): photo is string => Boolean(photo))
}

export function parseFee(value: string): number | null {
  if (!value.trim()) return 0
  const n = toNumber(value)
  return n === null || n < 0 ? null : Math.round(n)
}

export interface SettlementSummary {
  fees: Record<FeeKey, number>
  total: number
  refund: number
  /** Deductions above the deposit, owed by the customer. */
  debt: number
  valid: boolean
}

/**
 * A deduction needs a written reason unless it is only the late fee from the facility policy (the server applies the
 * same rule). Damage, cleaning and lost-card charges always need one.
 */
export function needsDeductionReason(fees: Record<FeeKey, number>): boolean {
  return fees.damageFee + fees.cleaningFee + fees.lostCardFee > 0
}

export function computeSettlement(deposit: number, fees: ReturnFees): SettlementSummary {
  const parsed = {} as Record<FeeKey, number>
  let valid = true
  for (const field of FEE_FIELDS) {
    const value = parseFee(fees[field.key])
    if (value === null) valid = false
    parsed[field.key] = value ?? 0
  }
  const total = FEE_FIELDS.reduce((sum, field) => sum + parsed[field.key], 0)
  return { fees: parsed, total, refund: Math.max(0, deposit - total), debt: Math.max(0, total - deposit), valid }
}

function inspectionFlags(state: ReturnInspectionState): Pick<HandoverPayload, ChecklistField> {
  const flags = {} as Pick<HandoverPayload, ChecklistField>
  for (const item of RETURN_ITEMS) flags[item.field] = isItemPassed(item.key, state[item.key])
  return flags
}

export function describeInspection(state: ReturnInspectionState): string {
  return RETURN_ITEMS.map((item) => `${item.label}: ${getOptionLabel(item.key, state[item.key])}`).join('; ')
}

interface BuildPayloadInput {
  bookingId: string
  deposit: number
  inspection: ReturnInspectionState
  photos: ReturnPhotos
  notes: string
  fees: ReturnFees
  reason: string
  refundMethod: string
  refundBank: RefundBank
}

export function buildInspectionPayload({ bookingId, inspection, photos, notes }: BuildPayloadInput): HandoverPayload {
  const passed = RETURN_ITEMS.filter((item) => isItemPassed(item.key, inspection[item.key])).length
  return {
    bookingId,
    ...inspectionFlags(inspection),
    evidencePhotos: collectReturnPhotos(photos),
    unitCondition: `${passed}/${RETURN_ITEMS.length} hạng mục đạt khi trả kho`,
    notes: notes.trim() ? `${describeInspection(inspection)}. Ghi chú: ${notes.trim()}` : describeInspection(inspection),
  }
}

export function buildSettlementPayload(input: BuildPayloadInput): HandoverPayload {
  const settlement = computeSettlement(input.deposit, input.fees)
  const inspection = buildInspectionPayload(input)
  const reason = input.reason.trim()
  // The account is only sent (and required) when money is actually transferred to the customer.
  const sendsBank = input.refundMethod === 'BANK_TRANSFER' && settlement.refund > 0
  return {
    ...inspection,
    recordType: 'RETURN',
    depositSettled: input.deposit,
    ...settlement.fees,
    deductionAmount: settlement.total,
    // The reason explains the money. It is not a damage report: only fees and failed checks send a unit to maintenance.
    deductionReason: reason || undefined,
    refundMethod: input.refundMethod,
    refundBankName: sendsBank ? input.refundBank.bankName.trim() : undefined,
    refundBankAccountNumber: sendsBank ? input.refundBank.accountNumber.trim() : undefined,
    refundBankAccountName: sendsBank ? input.refundBank.accountName.trim() : undefined,
    notes: [
      `Nghiệm thu trả kho. ${describeInspection(input.inspection)}.`,
      `Khấu trừ đề xuất: ${formatCurrency(settlement.total)}${reason ? ` (${reason})` : ''}.`,
      `Dự kiến hoàn cọc: ${formatCurrency(settlement.refund)}.`,
      input.notes.trim() ? `Ghi chú: ${input.notes.trim()}.` : '',
    ]
      .filter(Boolean)
      .join(' '),
  }
}
