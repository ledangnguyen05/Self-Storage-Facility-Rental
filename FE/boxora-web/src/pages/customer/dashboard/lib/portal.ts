import type { Booking, RentalContract } from '@/types'
import type { PaymentItem } from '@/services/paymentService'
import { formatFloorLabel } from '@/data/floorLabels'
import { formatDate, formatDateTime, formatNumber } from '@/lib/format'

/** Contract states in which the customer holds the unit (shown under "Kho của tôi"). */
const HELD_CONTRACT_STATUSES = new Set(['ACTIVE', 'OVERDUE', 'OVERDUE_LOCKED'])
const OVERDUE_CONTRACT_STATUSES = new Set(['OVERDUE', 'OVERDUE_LOCKED'])
/** Contracts whose deposit is still held by the facility. */
const DEPOSIT_HOLDING_STATUSES = new Set(['PENDING_SIGNATURE', 'PENDING_VERIFICATION', 'PENDING_ACTIVATION', 'ACTIVE', 'OVERDUE', 'OVERDUE_LOCKED'])
const PAID_PAYMENT_STATUSES = new Set(['PAID', 'SUCCESS'])

const upper = (value: string | null | undefined) => (value ?? '').trim().toUpperCase()

export const isHeldContract = (contract: RentalContract) => HELD_CONTRACT_STATUSES.has(upper(contract.status))
export const isOverdueContract = (contract: RentalContract) => OVERDUE_CONTRACT_STATUSES.has(upper(contract.status))
export const holdsDeposit = (contract: RentalContract) => DEPOSIT_HOLDING_STATUSES.has(upper(contract.status))
export const isPaidPayment = (payment: PaymentItem) => PAID_PAYMENT_STATUSES.has(upper(payment.status))

/**
 * Money going back to the customer. The backend stores a refund as its own payment row (type DEPOSIT, status REFUNDED once
 * the transfer is done, REFUND_PENDING with a `REFUND-…` reference while it is being prepared). A REFUND_PENDING row with
 * any other reference is an original payment that is waiting to be returned, so it stays a normal inflow row.
 */
export const isRefundPayment = (payment: PaymentItem) => {
  const status = upper(payment.status)
  return status === 'REFUNDED' || (status === 'REFUND_PENDING' && upper(payment.transactionId).startsWith('REFUND-'))
}

/** A refund that has actually been transferred (the only kind that lowers what the customer has paid). */
const isCompletedRefund = (payment: PaymentItem) => upper(payment.status) === 'REFUNDED'

/** Booking a payment belongs to, used to match refunds with the payments they return. */
const paymentBookingKey = (payment: PaymentItem) => payment.bookingId || payment.bookingCode || ''

/** Booking states that still wait for check-in (reschedule and cancel are allowed). */
export const isPendingCheckIn = (booking: Booking) => {
  const status = upper(booking.status)
  return status === 'CONFIRMED' || status === 'PENDING_PAYMENT'
}

/** `A-102` / `a102` → `a102`, used to match the `?unit=` deep link and DOM ids. */
export const unitKey = (code: string | null | undefined) => (code ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')

/** Floor label customers read (`Tầng 1`), whatever spelling the stored value uses. */
export function formatFloor(floor: string | null | undefined): string {
  return formatFloorLabel(floor)
}

/** Expected check-in (date and time) or the start date. */
export function formatCheckIn(booking: Pick<Booking, 'expectedCheckInAt' | 'startDate'>): string {
  return booking.expectedCheckInAt ? formatDateTime(booking.expectedCheckInAt) : formatDate(booking.startDate)
}

export const formatMonths = (months: number | null | undefined) =>
  typeof months === 'number' && Number.isFinite(months) && months > 0 ? `${months} tháng` : '—'

export const formatArea = (area: number | null | undefined) =>
  typeof area === 'number' && Number.isFinite(area) && area > 0 ? `${formatNumber(area, { maximumFractionDigits: 1 })} m²` : '—'

const sum = (values: (number | null | undefined)[]) =>
  values.reduce<number>((total, value) => total + (typeof value === 'number' && Number.isFinite(value) ? value : Number(value) || 0), 0)

export const sumMonthlyFees = (contracts: RentalContract[]) => sum(contracts.map(contract => contract.monthlyFee))
export const sumDepositsHeld = (contracts: RentalContract[]) => sum(contracts.filter(holdsDeposit).map(contract => contract.depositHeld))
export const sumPaid = (payments: PaymentItem[]) => sum(payments.filter(isPaidPayment).map(payment => payment.amount))
export const sumRefunded = (payments: PaymentItem[]) => sum(payments.filter(isCompletedRefund).map(payment => payment.amount))
/** What the customer has paid after the refunds that were already transferred back. */
export const sumNetPaid = (payments: PaymentItem[]) => sumPaid(payments) - sumRefunded(payments)

/** Part of an original payment that was already returned to the customer. */
export interface RefundMark {
  amount: number
  /** The whole payment was returned. */
  full: boolean
}

/**
 * Matches the completed refunds of each booking with the payments they return (oldest payment first), so a refunded
 * original payment can be marked in the history. Keyed by payment id.
 */
export function buildRefundMarks(payments: PaymentItem[]): Map<string, RefundMark> {
  const remaining = new Map<string, number>()
  for (const payment of payments) {
    const key = paymentBookingKey(payment)
    if (key && isCompletedRefund(payment)) remaining.set(key, (remaining.get(key) ?? 0) + (Number(payment.amount) || 0))
  }
  const marks = new Map<string, RefundMark>()
  if (remaining.size === 0) return marks
  const paid = payments
    .filter(isPaidPayment)
    .sort((a, b) => (a.paymentTime || a.createdAt || '').localeCompare(b.paymentTime || b.createdAt || ''))
  for (const payment of paid) {
    const key = paymentBookingKey(payment)
    const left = remaining.get(key) ?? 0
    const amount = Number(payment.amount) || 0
    if (left <= 0 || amount <= 0) continue
    const returned = Math.min(left, amount)
    remaining.set(key, left - returned)
    marks.set(payment.id, { amount: returned, full: returned >= amount })
  }
  return marks
}

/** Held contract with the earliest end date. */
export function findNearestEnding(contracts: RentalContract[]): RentalContract | undefined {
  return contracts
    .filter(contract => Boolean(contract.endDate))
    .sort((a, b) => a.endDate.localeCompare(b.endDate))[0]
}

/** Case-insensitive "contains" over several optional fields. */
export function matchesSearch(term: string, values: (string | null | undefined)[]): boolean {
  const needle = term.trim().toLowerCase()
  if (!needle) return true
  return values.some(value => value?.toLowerCase().includes(needle))
}
