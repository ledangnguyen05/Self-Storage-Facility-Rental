import { api } from '../lib/axios'
import type { RequestOptions } from '../types'

export type PaymentType = 'BOOKING_PAYMENT' | 'DEPOSIT' | 'RENTAL_FEE' | 'RENEWAL_FEE' | 'EXTRA_CHARGE'

export interface VNPayPayment {
  paymentUrl: string
  transactionId: string
  paymentId: string
  bookingId?: string
  contractId?: string
  /** Amount computed by the server (VND). */
  amount: number
  orderInfo: string
}

export interface PaymentItem {
  id: string
  transactionId?: string
  bookingId?: string
  bookingCode?: string
  contractId?: string
  contractCode?: string
  unitCode?: string
  facilityName?: string
  customerName?: string
  amount: number
  /**
   * Part of `amount` that is security deposit: all of a DEPOSIT, the deposit share of an online BOOKING_PAYMENT
   * (which pays deposit and first month together), 0 for rent. Missing on older servers.
   */
  depositPortion?: number
  paymentType: PaymentType | string
  status: 'PENDING' | 'PAID' | 'FAILED' | 'EXPIRED' | 'REFUND_PENDING' | 'REFUNDED' | string
  paymentMethod?: 'VNPAY' | 'BANK_TRANSFER' | 'CASH' | 'MOMO' | string
  paymentTime?: string
  createdAt?: string
  /** Part of a RENTAL_FEE / RENEWAL_FEE that pays the late fee. */
  lateFeeAmount?: number
  /** Part of a RENTAL_FEE that pays the time kept after the term. */
  overdueRentAmount?: number
  /** Days the contract end date moved when this overdue settlement was paid. */
  extensionDays?: number
  renewalMonths?: number
  paymentNotes?: string
  /** VNPay `vnp_ResponseCode` of the gateway result (00 = success). */
  gatewayResponseCode?: string | null
  gatewayTransactionStatus?: string | null
  /** Vietnamese reason of a FAILED online payment, computed by the server. */
  failureReason?: string | null
  /** The bank may have debited the customer although the payment did not succeed. */
  mayHaveBeenCharged?: boolean | null
}

export interface ContractOutstandingItem {
  code: 'RENT_OUTSTANDING' | 'LATE_FEE' | 'OVERDUE_RENT' | string
  label: string
  amount: number
}

/** `GET /payments/contracts/{id}/outstanding`: what the contract owes today, computed by the server. */
export interface ContractOutstanding {
  contractId: string
  contractCode?: string
  contractStatus?: string
  bookingId?: string
  bookingCode?: string
  unitCode?: string
  facilityName?: string
  termStartDate?: string
  termEndDate?: string
  contractEndDate?: string
  termMonths?: number
  monthlyRent: number
  billedMonths: number
  rentDue: number
  rentPaid: number
  rentOutstanding: number
  remainingTermMonths: number
  remainingTermRent: number
  nextRentDueDate?: string | null
  overdue: boolean
  overdueDays: number
  lateFee: number
  overdueRent: number
  extensionDays: number
  paidThroughAfterSettlement?: string | null
  totalDueNow: number
  canPayOnline: boolean
  blockedReason?: string | null
  note?: string | null
  items: ContractOutstandingItem[]
}

export const paymentService = {
  /**
   * VNPay link for the initial payment of a booking (first month + deposit). The server computes the
   * amount; `amount` is only the value the customer saw and makes the call fail when the price changed.
   */
  async createVNPayPayment(data: { bookingId: string; amount?: number; paymentType?: 'BOOKING_PAYMENT' }) {
    const response = await api.post('/api/v1/payments/vnpay/create', {
      bookingId: data.bookingId,
      paymentType: data.paymentType ?? 'BOOKING_PAYMENT',
      amount: data.amount && data.amount > 0 ? Math.round(data.amount) : undefined,
    })
    return response.data?.data as VNPayPayment
  },

  async getContractOutstanding(contractId: string, opts?: RequestOptions) {
    const response = await api.get(`/api/v1/payments/contracts/${contractId}/outstanding`, { signal: opts?.signal })
    return response.data?.data as ContractOutstanding
  },

  /** VNPay link for what is due now plus `upcomingMonths` months of the term paid in advance. */
  async payContractOutstanding(contractId: string, upcomingMonths = 0) {
    const response = await api.post(`/api/v1/payments/contracts/${contractId}/outstanding/vnpay`, { upcomingMonths })
    return response.data?.data as VNPayPayment
  },

  /** Content of GET /payments (defaults: status PAID, size 100). */
  async getPayments(
    params?: { status?: string; size?: number; page?: number; facilityId?: string; customerId?: string },
    opts?: RequestOptions
  ) {
    const response = await api.get('/api/v1/payments', {
      params: { size: 100, status: 'PAID', ...params },
      signal: opts?.signal,
    })
    return (response.data?.data?.content || []) as PaymentItem[]
  },

  async getByTransactionId(transactionId: string, opts?: RequestOptions) {
    const response = await api.get(`/api/v1/payments/transaction/${encodeURIComponent(transactionId)}`, { signal: opts?.signal })
    return response.data?.data as PaymentItem
  },

  async getByBookingId(bookingId: string, opts?: RequestOptions) {
    const response = await api.get(`/api/v1/payments/booking/${bookingId}`, { signal: opts?.signal })
    return (response.data?.data || []) as PaymentItem[]
  },

  async getMyPayments(opts?: RequestOptions) {
    const response = await api.get('/api/v1/payments/my-payments', { signal: opts?.signal })
    return (response.data?.data || []) as PaymentItem[]
  },
}

/** Only https links from the gateway are opened. */
export function isSafePaymentUrl(url: string | null | undefined): url is string {
  if (!url) return false
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:'
  } catch {
    return false
  }
}
