import {
  getPaymentMethodMeta,
  getPaymentStatusMeta,
  getPaymentTypeMeta,
  PAYMENT_METHOD_OPTIONS,
  PAYMENT_STATUS_OPTIONS,
  PAYMENT_TYPE_OPTIONS,
  type SelectOption,
} from '@/constants/statusMeta'
import { addDays, formatDate, formatDateTime, toLocalISODate, todayISO } from '@/lib/format'
import type { CsvColumn } from '@/lib/csv'
import type { PaymentItem } from '@/services/paymentService'

/** Most payments requested for one date range; a longer range is cut off and the page says so. */
export const LEDGER_FETCH_SIZE = 500

export const ALL = 'ALL'

export const METHOD_FILTER_OPTIONS: SelectOption[] = [{ value: ALL, label: 'Mọi phương thức' }, ...PAYMENT_METHOD_OPTIONS]
export const STATUS_FILTER_OPTIONS: SelectOption[] = [{ value: ALL, label: 'Mọi trạng thái' }, ...PAYMENT_STATUS_OPTIONS]
export const TYPE_FILTER_OPTIONS: SelectOption[] = [{ value: ALL, label: 'Mọi loại giao dịch' }, ...PAYMENT_TYPE_OPTIONS]

// ---------------------------------------------------------------- status helpers
export type PaymentGroup = 'success' | 'pending' | 'refund' | 'other'

/** One place that decides what counts as money collected (PAID and SUCCESS both map to the success tone). */
export function getPaymentGroup(status?: string | null): PaymentGroup {
  if (getPaymentStatusMeta(status).tone === 'success') return 'success'
  const key = (status ?? '').trim().toUpperCase()
  if (key === 'PENDING') return 'pending'
  if (key === 'REFUND_PENDING' || key === 'REFUNDED') return 'refund'
  return 'other'
}

export const isSuccessfulPayment = (payment: Pick<PaymentItem, 'status'>) => getPaymentGroup(payment.status) === 'success'

/**
 * A refund of a deposit is stored as a DEPOSIT payment with a refund status (REFUND-RET-… references). It is money
 * going out, so the ledger shows it as "Hoàn cọc" with a minus sign instead of a second "Tiền cọc" collection.
 */
export function isRefundPayment(payment: Pick<PaymentItem, 'status' | 'transactionId'>): boolean {
  return getPaymentGroup(payment.status) === 'refund' || (payment.transactionId ?? '').toUpperCase().startsWith('REFUND-')
}

export function getLedgerTypeLabel(payment: Pick<PaymentItem, 'status' | 'transactionId' | 'paymentType'>): string {
  return isRefundPayment(payment) ? 'Hoàn cọc' : getPaymentTypeMeta(payment.paymentType).label
}

/** Signed amount for display and export: refunds are negative. */
export function getLedgerAmount(payment: Pick<PaymentItem, 'status' | 'transactionId' | 'amount'>): number {
  const amount = payment.amount || 0
  return isRefundPayment(payment) ? -Math.abs(amount) : amount
}

/** Deposit share of a collected payment, never more than the payment itself. */
function depositShareOf(payment: PaymentItem): number {
  const amount = payment.amount || 0
  const type = (payment.paymentType ?? '').toUpperCase()
  const share = payment.depositPortion ?? (type === 'DEPOSIT' ? amount : 0)
  return Math.min(amount, Math.max(0, share))
}

/** The "Đã thanh toán" filter option also covers legacy SUCCESS rows. */
export function matchesStatusFilter(status: string | undefined, filter: string): boolean {
  if (filter === ALL) return true
  if (filter === 'PAID') return getPaymentGroup(status) === 'success'
  return (status ?? '').trim().toUpperCase() === filter
}

const sameKey = (value: string | undefined, filter: string) => filter === ALL || (value ?? '').trim().toUpperCase() === filter

export const matchesMethodFilter = sameKey
export const matchesTypeFilter = sameKey

export function matchesLedgerSearch(payment: PaymentItem, rawQuery: string): boolean {
  const query = rawQuery.trim().toLowerCase()
  if (!query) return true
  return [payment.id, payment.transactionId, payment.bookingCode, payment.unitCode, payment.customerName].some(field =>
    field?.toLowerCase().includes(query)
  )
}

export function getPaymentReference(payment: Pick<PaymentItem, 'id' | 'transactionId'>): string {
  return payment.transactionId || payment.id.slice(0, 8).toUpperCase()
}

// ---------------------------------------------------------------- KPIs
export interface LedgerSummary {
  collected: number
  collectedCount: number
  totalCount: number
  pendingCount: number
  otherCount: number
  cash: number
  cashCount: number
  nonCash: number
  nonCashCount: number
  /**
   * Collected deposits: DEPOSIT payments plus the deposit share of online booking payments (which pay the deposit and
   * the first month together). depositCount counts the payments that contain a deposit share.
   */
  deposit: number
  depositCount: number
  /** Collected money that is not a deposit: rent, renewals, extra charges and the rent share of booking payments. */
  rental: number
  rentalCount: number
  /** Collection attempts: every payment that is not a refund row. This is the denominator of successRate. */
  attemptCount: number
  /** Refund rows in the range. They are money going out, so they are in totalCount but never in attemptCount. */
  refundCount: number
  /**
   * Share (0-100) of the collection attempts that settled: collectedCount / attemptCount, so the figure always agrees
   * with the "a/b" shown next to it. Null when the range has no collection attempt to measure.
   */
  successRate: number | null
}

export function summarizeLedger(payments: readonly PaymentItem[]): LedgerSummary {
  const summary: LedgerSummary = {
    collected: 0,
    collectedCount: 0,
    totalCount: payments.length,
    pendingCount: 0,
    otherCount: 0,
    cash: 0,
    cashCount: 0,
    nonCash: 0,
    nonCashCount: 0,
    deposit: 0,
    depositCount: 0,
    rental: 0,
    rentalCount: 0,
    attemptCount: 0,
    refundCount: 0,
    successRate: null,
  }
  let attempts = 0
  for (const payment of payments) {
    const group = getPaymentGroup(payment.status)
    if (group === 'pending') summary.pendingCount += 1
    else if (group === 'other') summary.otherCount += 1
    if (group === 'refund') summary.refundCount += 1
    else attempts += 1
    if (group !== 'success') continue

    const amount = payment.amount || 0
    summary.collected += amount
    summary.collectedCount += 1
    const depositShare = depositShareOf(payment)
    const rentShare = amount - depositShare
    if (depositShare > 0) {
      summary.deposit += depositShare
      summary.depositCount += 1
    }
    if (rentShare > 0 || depositShare === 0) {
      summary.rental += rentShare
      summary.rentalCount += 1
    }
    if ((payment.paymentMethod ?? '').toUpperCase() === 'CASH') {
      summary.cash += amount
      summary.cashCount += 1
    } else {
      summary.nonCash += amount
      summary.nonCashCount += 1
    }
  }
  summary.attemptCount = attempts
  summary.successRate = attempts > 0 ? (summary.collectedCount / attempts) * 100 : null
  return summary
}

// ---------------------------------------------------------------- date range
export interface DateRange {
  from: string
  to: string
}

export type RangePreset = 'today' | 'last7' | 'last30' | 'month' | 'custom'

export const RANGE_PRESET_OPTIONS: SelectOption<RangePreset>[] = [
  { value: 'today', label: 'Hôm nay' },
  { value: 'last7', label: '7 ngày qua' },
  { value: 'last30', label: '30 ngày qua' },
  { value: 'month', label: 'Tháng này' },
  { value: 'custom', label: 'Tùy chọn' },
]

export function getPresetRange(preset: Exclude<RangePreset, 'custom'>): DateRange {
  const today = todayISO()
  switch (preset) {
    case 'today':
      return { from: today, to: today }
    case 'last7':
      return { from: toLocalISODate(addDays(today, -6)), to: today }
    case 'last30':
      return { from: toLocalISODate(addDays(today, -29)), to: today }
    case 'month':
      return { from: `${today.slice(0, 8)}01`, to: today }
  }
}

export function detectPreset(range: DateRange): RangePreset {
  const presets: Exclude<RangePreset, 'custom'>[] = ['today', 'last7', 'last30', 'month']
  return presets.find(preset => {
    const candidate = getPresetRange(preset)
    return candidate.from === range.from && candidate.to === range.to
  }) ?? 'custom'
}

/** `from`/`to` are local dates; the API takes local date-times covering whole days. */
export function toApiRange(range: DateRange) {
  return { fromDate: `${range.from}T00:00:00`, toDate: `${range.to}T23:59:59` }
}

export function describeRange(range: DateRange): string {
  return range.from === range.to ? formatDate(range.from) : `${formatDate(range.from)} – ${formatDate(range.to)}`
}

// ---------------------------------------------------------------- CSV
export const LEDGER_CSV_COLUMNS: CsvColumn<PaymentItem>[] = [
  { header: 'Mã giao dịch', accessor: payment => getPaymentReference(payment) },
  { header: 'Thời gian', accessor: payment => formatDateTime(payment.paymentTime ?? payment.createdAt) },
  { header: 'Khách hàng', accessor: 'customerName' },
  { header: 'Cơ sở', accessor: 'facilityName' },
  { header: 'Mã kho', accessor: 'unitCode' },
  { header: 'Loại giao dịch', accessor: payment => getLedgerTypeLabel(payment) },
  { header: 'Phương thức', accessor: payment => getPaymentMethodMeta(payment.paymentMethod).label },
  { header: 'Số tiền (VND)', accessor: payment => getLedgerAmount(payment) },
  { header: 'Trạng thái', accessor: payment => getPaymentStatusMeta(payment.status).label },
]
