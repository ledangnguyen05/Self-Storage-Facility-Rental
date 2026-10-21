import { toNumber } from '../../../lib/format'
import type { PaymentItem } from '../../../services/paymentService'
import type { Booking, RentalContract } from '../../../types'

export type PaymentOutcomeKind =
  /** Fetching the payment from the server. */
  | 'loading'
  /** The server confirmed the payment. */
  | 'paid'
  /** Money was received after the booking was cancelled / expired: it will be refunded. */
  | 'refund'
  /** The server has not confirmed it (yet). */
  | 'pending'
  | 'failed'
  /** The payment could not be loaded (network, permission, unknown transaction). */
  | 'error'
  /** The visitor is signed out, so the result cannot be verified. */
  | 'unverified'
  /** The URL carries no transaction and no booking. */
  | 'unknown'

/** What the payment was for. */
export type PaymentPurpose = 'booking' | 'rent' | 'renewal'

/** How often and how many times the page re-checks a payment the server has not confirmed yet. */
export const RECONCILE_INTERVAL_MS = 3000
export const RECONCILE_MAX_ATTEMPTS = 5

/** Query parameters of `/payment-result`, set by the backend after the VNPay return. */
export interface PaymentResultParams {
  /** Result computed by the backend (`PAID`, `FAILED`, `REFUND_PENDING` ...). Untrusted: anyone can edit a URL. */
  status: string
  bookingId: string
  contractId: string
  /** PaymentType sent by the backend redirect. */
  type: string
  txnRef: string
  /** VND, as sent by the backend redirect (`amount`). */
  amountVnd: number | null
  /** Raw `vnp_Amount` from VNPay: always VND x 100. */
  vnpAmountRaw: number | null
  error: string
  /** VNPay `vnp_ResponseCode` forwarded by the backend redirect for a failed payment (display only). */
  code: string
}

const cleanId = (value: string | null) => {
  const trimmed = (value ?? '').trim()
  return trimmed === 'null' || trimmed === 'undefined' ? '' : trimmed
}

export function readPaymentParams(params: URLSearchParams): PaymentResultParams {
  return {
    status: (params.get('status') ?? '').trim().toUpperCase(),
    bookingId: cleanId(params.get('bookingId')),
    contractId: cleanId(params.get('contractId')),
    type: (params.get('type') ?? '').trim().toUpperCase(),
    txnRef: (params.get('txnRef') ?? params.get('vnp_TxnRef') ?? '').trim(),
    amountVnd: toNumber(params.get('amount')),
    vnpAmountRaw: toNumber(params.get('vnp_Amount')),
    error: (params.get('error') ?? '').trim(),
    code: (params.get('code') ?? params.get('vnp_ResponseCode') ?? '').trim().slice(0, 10),
  }
}

/** Meaning of the VNPay response codes, used when the server record cannot be read (signed out). */
const VNPAY_REASONS: Record<string, string> = {
  '07': 'Ngân hàng đã trừ tiền nhưng giao dịch bị nghi ngờ gian lận hoặc bất thường',
  '09': 'Thẻ hoặc tài khoản chưa đăng ký dịch vụ Internet Banking tại ngân hàng',
  '10': 'Xác thực thông tin thẻ hoặc tài khoản không đúng quá 3 lần',
  '11': 'Đã hết thời gian chờ thanh toán',
  '12': 'Thẻ hoặc tài khoản đang bị khóa',
  '13': 'Mật khẩu xác thực giao dịch (OTP) không đúng',
  '24': 'Bạn đã hủy giao dịch',
  '51': 'Tài khoản không đủ số dư để thanh toán',
  '65': 'Tài khoản đã vượt quá hạn mức giao dịch trong ngày',
  '75': 'Ngân hàng thanh toán đang bảo trì',
  '79': 'Nhập sai mật khẩu thanh toán quá số lần quy định',
  '99': 'Cổng thanh toán báo lỗi không xác định',
}

/** Codes for which the bank may already have taken the money. */
const CHARGED_CODES = new Set(['07'])

/** Why a payment failed: the server's reason first, then the VNPay code of the redirect, then the backend error text. */
export function failureReasonOf(payment: PaymentItem | undefined, params: PaymentResultParams): string {
  if (payment?.failureReason) return payment.failureReason
  const code = payment?.gatewayResponseCode || params.code
  if (code && code !== '00') return `${VNPAY_REASONS[code] ?? 'Cổng thanh toán từ chối giao dịch'} (mã ${code}).`
  return params.error
}

export function mayHaveBeenCharged(payment: PaymentItem | undefined, params: PaymentResultParams): boolean {
  if (payment && typeof payment.mayHaveBeenCharged === 'boolean') return payment.mayHaveBeenCharged
  return CHARGED_CODES.has(payment?.gatewayResponseCode || params.code)
}

/** The gateway refused the payment with a code meaning no money was taken (cancelled, insufficient funds...). */
export function isKnownNotCharged(payment: PaymentItem | undefined, params: PaymentResultParams): boolean {
  const code = payment?.gatewayResponseCode || params.code
  return Boolean(code) && code !== '00' && !mayHaveBeenCharged(payment, params)
}

const PAID_PAYMENT = new Set(['PAID', 'SUCCESS'])
const FAILED_PAYMENT = new Set(['FAILED', 'EXPIRED'])
/** Booking statuses that can only be reached after the first payment of an online booking. */
const PAID_BOOKING = new Set(['ACTIVE', 'CHECKOUT_REQUESTED', 'INSPECTED', 'COMPLETED', 'OVERDUE'])

export function purposeOf(payment: PaymentItem | undefined, params: PaymentResultParams): PaymentPurpose {
  const type = String(payment?.paymentType ?? params.type ?? '').toUpperCase()
  if (type === 'RENEWAL_FEE') return 'renewal'
  if (type === 'RENTAL_FEE') return 'rent'
  return 'booking'
}

export const isRefundPending = (payment: PaymentItem | undefined, params: PaymentResultParams) =>
  String(payment?.status ?? '').toUpperCase() === 'REFUND_PENDING' || (!payment && params.status === 'REFUND_PENDING')

/**
 * The server is the only source of truth for "paid". When the payment record is known, its own status decides:
 * a failed transaction stays failed even if the booking was paid later by another transaction.
 */
export function isServerConfirmedPaid(booking: Booking | undefined, payment: PaymentItem | undefined, purpose: PaymentPurpose): boolean {
  if (payment) return PAID_PAYMENT.has(String(payment.status).toUpperCase())
  if (purpose !== 'booking' || !booking) return false
  if (PAID_BOOKING.has(booking.status)) return true
  return booking.paymentStatus === 'PAID'
}

export const isServerFailed = (payment: PaymentItem | undefined) => Boolean(payment && FAILED_PAYMENT.has(String(payment.status).toUpperCase()))

/** The payment to show: the one of the URL, else the paid one, else the most recent. */
export function pickPayment(payments: PaymentItem[], txnRef?: string): PaymentItem | undefined {
  if (txnRef) {
    const match = payments.find(payment => payment.transactionId === txnRef)
    if (match) return match
  }
  return payments.find(payment => PAID_PAYMENT.has(String(payment.status).toUpperCase())) ?? payments[0]
}

export function isContractSigned(contract: RentalContract | null | undefined): boolean {
  if (!contract) return false
  return Boolean(contract.signedAt) || contract.status === 'ACTIVE' || contract.status === 'PENDING_ACTIVATION'
}

/**
 * Amount to display, in VND. Server records win over the URL. `vnp_Amount` from VNPay is always
 * multiplied by 100; the backend's own `amount` redirect parameter is already in VND.
 */
export function resolveAmountVnd(args: { payment?: PaymentItem; booking?: Booking; params: PaymentResultParams }): number | null {
  const { payment, booking, params } = args
  const fromPayment = toNumber(payment?.amount)
  if (fromPayment && fromPayment > 0) return fromPayment
  if (params.amountVnd && params.amountVnd > 0) return params.amountVnd
  if (params.vnpAmountRaw && params.vnpAmountRaw > 0) return Math.round(params.vnpAmountRaw / 100)
  return toNumber(booking?.initialPaymentAmount)
}

/**
 * The booking can still be paid online: a reservation inside its payment window, or a free hold
 * (CONFIRMED, not paid, not handed over) whose hold has not ended.
 */
export function isPaymentWindowOpen(booking: Booking | undefined, now = Date.now()): boolean {
  if (!booking) return false
  const open = (deadline: string | null | undefined) => {
    if (!deadline) return true
    const time = new Date(deadline).getTime()
    return Number.isFinite(time) && time > now
  }
  if (booking.status === 'PENDING_PAYMENT') return open(booking.paymentExpiresAt)
  if (booking.status === 'CONFIRMED' && booking.paymentStatus !== 'PAID' && !booking.handoverTime) return open(booking.holdExpiresAt)
  return false
}
