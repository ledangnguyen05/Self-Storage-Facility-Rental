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
  unitCode?: string
  facilityName?: string
  customerName?: string
  amount: number
  paymentType: PaymentType | string
  status: 'PENDING' | 'PAID' | 'FAILED' | 'EXPIRED' | 'REFUND_PENDING' | 'REFUNDED' | string
  paymentMethod?: 'VNPAY' | 'BANK_TRANSFER' | string
  paymentTime?: string
  createdAt?: string
  proofDocumentUrl?: string
  receiptVoucherCode?: string
  collectedById?: string
  collectedByName?: string
  referenceCode?: string
  paymentNotes?: string
}

export interface PaymentPage {
  content: PaymentItem[]
  page: number
  totalPages: number
  totalElements: number
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

  async getPayments(params?: { status?: string; size?: number; page?: number; facilityId?: string; customerId?: string }) {
    const response = await api.get('/api/v1/payments', {
      params: { size: 100, status: 'PAID', ...params },
    })
    return (response.data?.data?.content || []) as PaymentItem[]
  },

  async getPaymentsPage(params?: {
    status?: string
    paymentType?: PaymentType
    fromDate?: string
    toDate?: string
    size?: number
    page?: number
    facilityId?: string
    customerId?: string
  }) {
    const response = await api.get('/api/v1/payments', { params })
    return response.data?.data as PaymentPage
  },

  async getByBookingId(bookingId: string) {
    const response = await api.get(`/api/v1/payments/booking/${bookingId}`)
    return (response.data?.data || []) as PaymentItem[]
  },

  async getByTransactionId(transactionId: string) {
    const response = await api.get(`/api/v1/payments/transaction/${transactionId}`)
    return response.data?.data as PaymentItem
  },

  async getPaymentById(paymentId: string) {
    const response = await api.get(`/api/v1/payments/${paymentId}`)
    return response.data?.data as PaymentItem
  },

  async getMyPayments() {
    const response = await api.get('/api/v1/payments/my-payments')
    return (response.data?.data || []) as PaymentItem[]
  },
}

