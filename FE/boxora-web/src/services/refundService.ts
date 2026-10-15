import { api } from '../lib/axios'

export interface RefundCreatePayload {
  bookingId?: string
  contractId?: string
  requestedAmount: number
  deductionAmount?: number
  bankName: string
  bankAccountNumber: string
  bankAccountName: string
  reason: string
}

export interface RefundReviewPayload {
  approved: boolean
  reviewNotes?: string
}

export interface RefundProcessPayload {
  transactionReference: string
  paymentMethod: string
  processNotes?: string
}

export interface RefundRequestItem {
  id: string
  requestCode: string
  bookingId?: string
  contractId?: string
  customerId: string
  customerName?: string
  requestedAmount: number
  deductionAmount: number
  finalRefundAmount: number
  bankName: string
  bankAccountNumber: string
  bankAccountName: string
  reason: string
  status: 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'PROCESSED'
  reviewNotes?: string
  reviewedByName?: string
  reviewedAt?: string
  transactionReference?: string
  processedByName?: string
  processedAt?: string
  createdAt: string
  updatedAt: string
}

export const refundService = {
  async createRefund(data: RefundCreatePayload): Promise<RefundRequestItem> {
    const response = await api.post('/api/v1/refunds', data)
    return response.data?.data as RefundRequestItem
  },

  async getById(id: string): Promise<RefundRequestItem> {
    const response = await api.get(`/api/v1/refunds/${id}`)
    return response.data?.data as RefundRequestItem
  },

  async getAll(params?: {
    facilityId?: string
    customerId?: string
    status?: string
    page?: number
    size?: number
  }) {
    const response = await api.get('/api/v1/refunds', { params })
    return response.data?.data
  },

  async reviewRefund(id: string, data: RefundReviewPayload): Promise<RefundRequestItem> {
    const response = await api.put(`/api/v1/refunds/${id}/review`, data)
    return response.data?.data as RefundRequestItem
  },

  async processRefund(id: string, data: RefundProcessPayload): Promise<RefundRequestItem> {
    const response = await api.put(`/api/v1/refunds/${id}/process`, data)
    return response.data?.data as RefundRequestItem
  },
}

