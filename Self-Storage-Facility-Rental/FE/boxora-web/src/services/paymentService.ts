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
}
