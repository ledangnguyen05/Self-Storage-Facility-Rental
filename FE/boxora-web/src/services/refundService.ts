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
  action?: 'APPROVE' | 'REJECT'
  approved?: boolean
  reviewNote?: string
  reviewNotes?: string
  rejectionReason?: string
}

export interface RefundProcessPayload {
  transactionReference: string
  paymentMethod?: string
  processNotes?: string
  transferProofUrl?: string
  recipientEmail?: string
}

export type RefundStatusType =
  | 'PENDING_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'PROCESSING_TRANSFER'
  | 'AWAITING_CUSTOMER_CONFIRMATION'
  | 'RECONCILED'
  | 'COMPLETED'
  | 'PROCESSED'

export interface RefundTransferPayload {
  transferTxRef?: string
  transferEvidenceUrl?: string
}

export interface RefundCustomerConfirmPayload {
  confirmationNotes?: string
}

export interface RefundReconcilePayload {
  reconciliationNotes?: string
}

export interface RefundRequestItem {
  id: string
  requestCode: string
  bookingId?: string
  bookingCode?: string
  contractId?: string
  contractCode?: string
  customerId: string
  customerName?: string
  customerPhone?: string
  customerEmail?: string
  facilityId?: string
  facilityName?: string
  requestedAmount: number
  deductionAmount: number
  finalRefundAmount: number
  bankName: string
  bankAccountNumber: string
  bankAccountName: string
  reason: string
  status: RefundStatusType
  reviewNotes?: string
  reviewedByName?: string
  reviewedAt?: string
  rejectionReason?: string
  transactionReference?: string
  transferTxRef?: string
  transferEvidenceUrl?: string
  transferProofUrl?: string
  customerConfirmedAt?: string
  customerConfirmationNotes?: string
  reconciledById?: string
  reconciledByName?: string
  reconciledAt?: string
  reconciliationNotes?: string
  processedByName?: string
  processedAt?: string
  createdAt: string
  updatedAt?: string
}

export const refundService = {
  async uploadProof(file: File): Promise<string> {
    const formData = new FormData()
    formData.append('file', file)
    const response = await api.post('/api/v1/refunds/upload-proof', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
    return response.data?.data?.fileUrl || ''
  },

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
    const payload = {
      action: data.action || (data.approved ? 'APPROVE' : 'REJECT'),
      reviewNote: data.reviewNote || data.reviewNotes || '',
      rejectionReason: data.rejectionReason || data.reviewNotes || ''
    }
    const response = await api.put(`/api/v1/refunds/${id}/review`, payload)
    return response.data?.data as RefundRequestItem
  },

  async startTransfer(id: string, data: RefundTransferPayload): Promise<RefundRequestItem> {
    const response = await api.put(`/api/v1/refunds/${id}/start-transfer`, data)
    return response.data?.data as RefundRequestItem
  },

  async processRefund(id: string, data: RefundProcessPayload): Promise<RefundRequestItem> {
    const response = await api.put(`/api/v1/refunds/${id}/process`, data)
    return response.data?.data as RefundRequestItem
  },

  async confirmCustomerReceived(id: string, data?: RefundCustomerConfirmPayload): Promise<RefundRequestItem> {
    const response = await api.put(`/api/v1/refunds/${id}/confirm-received`, data || {})
    return response.data?.data as RefundRequestItem
  },

  async reconcileRefund(id: string, data?: RefundReconcilePayload): Promise<RefundRequestItem> {
    const response = await api.put(`/api/v1/refunds/${id}/reconcile`, data || {})
    return response.data?.data as RefundRequestItem
  },
}
