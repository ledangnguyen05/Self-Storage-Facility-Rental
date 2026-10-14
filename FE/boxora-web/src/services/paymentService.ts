import { api } from '../lib/axios'

export type PaymentType = 'BOOKING_PAYMENT' | 'DEPOSIT' | 'RENTAL_FEE' | 'RENEWAL_FEE' | 'EXTRA_CHARGE'

export interface VNPayPayment {
  paymentUrl: string
  transactionId: string
  paymentId: string
  bookingId: string
  amount: number
  orderInfo: string
}

export interface PaymentItem {
  id: string
  transactionId?: string
  bookingId?: string
  bookingCode?: string
  contractId?: string
  amount: number
  paymentType: PaymentType | string
  status: 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED' | string
  paymentMethod?: 'VNPAY' | 'BANK_TRANSFER' | 'MOMO' | string
  paymentTime?: string
  createdAt?: string
}

export const paymentService = {
  async createVNPayPayment(data: {
    bookingId: string
    paymentType: PaymentType
    amount: number
    orderInfo?: string
  }) {
    const response = await api.post('/api/v1/payments/vnpay/create', data)
    return response.data?.data as VNPayPayment
  },

  async getPayments(params?: { status?: string; size?: number; page?: number }) {
    const response = await api.get('/api/v1/payments', {
      params: { size: 100, status: 'PAID', ...params },
    })
    return (response.data?.data?.content || []) as PaymentItem[]
  },
}

