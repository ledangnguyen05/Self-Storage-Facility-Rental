import { api } from '../lib/axios'
import { toPageResult } from '../lib/pageResult'
import type { PageResult, RequestOptions } from '../types'

export type RefundStatusType =
  | 'PENDING_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'PROCESSING_TRANSFER'
  | 'AWAITING_CUSTOMER_CONFIRMATION'
  | 'RECONCILED'
  | 'COMPLETED'
  | 'PROCESSED'

/** `RefundCreateRequest`: the amount is computed by the server from the collected deposit. */
export interface RefundCreatePayload {
  bookingId?: string
  contractId?: string
  reason: string
  bankName?: string
  bankAccountNumber?: string
  bankAccountName?: string
}

/** `RefundReviewRequest`. A rejection needs `rejectionReason` (shown to the customer). */
export interface RefundReviewPayload {
  action: 'APPROVE' | 'REJECT'
  reviewNote?: string
  rejectionReason?: string
}

/** `RefundTransferRequest`. `transferEvidenceUrl` comes from `uploadTransferEvidence`. */
export interface RefundTransferPayload {
  transferReference: string
  transferNotes?: string
  transferEvidenceUrl?: string
}

/** `RefundProcessRequest`: bank transaction reference of the completed transfer. */
export interface RefundProcessPayload {
  transactionReference: string
  processNotes?: string
}

export interface RefundBankAccountPayload {
  bankName: string
  bankAccountNumber: string
  bankAccountName: string
}

export interface RefundCustomerConfirmPayload {
  confirmationNotes?: string
}

export interface RefundReconcilePayload {
  reconciliationNotes?: string
}

/** `RefundRequestResponse`. Customers get the account number masked; staff get it in full. */
export interface RefundRequestItem {
  id: string
  requestCode: string
  customerId?: string
  customerName?: string
  customerEmail?: string
  customerPhone?: string
  facilityId?: string
  facilityName?: string
  bookingId?: string
  bookingCode?: string
  unitCode?: string
  contractId?: string
  contractCode?: string
  requestedAmount: number
  deductionAmount: number
  finalRefundAmount: number
  bankName?: string | null
  bankAccountNumber?: string | null
  bankAccountName?: string | null
  /** True until the customer provides a usable bank account; transfers are blocked meanwhile. */
  bankInfoMissing: boolean
  bankInfoUpdatedAt?: string | null
  reason: string
  status: RefundStatusType | string
  requestedById?: string
  requestedByName?: string
  createdAt: string
  updatedAt?: string
  reviewedById?: string
  reviewedByName?: string
  reviewedAt?: string
  reviewNote?: string
  rejectionReason?: string
  transferInitiatedById?: string
  transferInitiatedByName?: string
  transferInitiatedAt?: string
  transferReference?: string
  transferEvidenceUrl?: string | null
  processedById?: string
  processedByName?: string
  processedAt?: string
  transactionReference?: string
  processNotes?: string
  customerConfirmedAt?: string
  customerConfirmationNotes?: string
  reconciledById?: string
  reconciledByName?: string
  reconciledAt?: string
  reconciliationNotes?: string
  /** Facility refund SLA in working days. */
  refundSlaDays?: number | null
}

export interface RefundListParams {
  facilityId?: string
  customerId?: string
  /** One status or several (sent comma-separated). */
  status?: string | string[]
  q?: string
  /** 0-based page. */
  page?: number
  size?: number
}

export const refundService = {
  async createRefund(data: RefundCreatePayload): Promise<RefundRequestItem> {
    const response = await api.post('/api/v1/refunds', data)
    return response.data?.data as RefundRequestItem
  },

  async getById(id: string, opts?: RequestOptions): Promise<RefundRequestItem> {
    const response = await api.get(`/api/v1/refunds/${id}`, { signal: opts?.signal })
    return response.data?.data as RefundRequestItem
  },

  /** Role-scoped list: customers see their own refunds, staff and facility managers their facility. */
  async getAll(params?: RefundListParams, opts?: RequestOptions): Promise<PageResult<RefundRequestItem>> {
    const { status, q, ...rest } = params ?? {}
    const response = await api.get('/api/v1/refunds', {
      params: {
        ...rest,
        status: Array.isArray(status) ? status.filter(Boolean).join(',') || undefined : status || undefined,
        q: q?.trim() || undefined,
      },
      signal: opts?.signal,
    })
    return toPageResult<RefundRequestItem>(response.data?.data)
  },

  /** Count per status (staff / managers only). */
  async getStats(facilityId?: string, opts?: RequestOptions) {
    const response = await api.get('/api/v1/refunds/stats', { params: facilityId ? { facilityId } : undefined, signal: opts?.signal })
    return (response.data?.data || {}) as Record<string, number>
  },

  async reviewRefund(id: string, data: RefundReviewPayload): Promise<RefundRequestItem> {
    const response = await api.put(`/api/v1/refunds/${id}/review`, data)
    return response.data?.data as RefundRequestItem
  },

  async updateBankAccount(id: string, data: RefundBankAccountPayload): Promise<RefundRequestItem> {
    const response = await api.put(`/api/v1/refunds/${id}/bank-account`, {
      bankName: data.bankName.trim(),
      bankAccountNumber: data.bankAccountNumber.replace(/\s+/g, ''),
      bankAccountName: data.bankAccountName.trim(),
    })
    return response.data?.data as RefundRequestItem
  },

  async uploadTransferEvidence(id: string, file: File): Promise<RefundRequestItem> {
    const formData = new FormData()
    formData.append('file', file)
    const response = await api.post(`/api/v1/refunds/${id}/transfer-evidence`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
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

