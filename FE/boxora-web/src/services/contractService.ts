import { api } from '../lib/axios'
import { RentalContract } from '../types'
export type { RentalContract }

export interface PageResponse<T> {
  content: T[]
  totalElements?: number
  totalPages?: number
  number?: number
  size?: number
}

export interface ContractOtpResponse {
  expiresInSeconds: number
  resendInSeconds: number
  signingUrl?: string
}

export const contractService = {
  async getMyContracts(
    paramsOrCustomerId?: string | { customerId?: string; facilityId?: string; status?: string; page?: number; size?: number }
  ): Promise<PageResponse<RentalContract>> {
    const params = typeof paramsOrCustomerId === 'string'
      ? { customerId: paramsOrCustomerId, size: 100 }
      : { size: 50, ...paramsOrCustomerId }
    const response = await api.get('/api/v1/contracts', { params })
    const data = response.data?.data
    if (Array.isArray(data)) {
      return { content: data, totalElements: data.length, totalPages: 1, number: 0, size: data.length }
    }
    return (data || { content: [] }) as PageResponse<RentalContract>
  },

  async sendSigningOtp(contractId: string) {
    const response = await api.post(`/api/v1/contracts/${contractId}/otp/send`)
    return response.data?.data as ContractOtpResponse
  },

  async resendSigningOtp(contractId: string) {
    const response = await api.post(`/api/v1/contracts/${contractId}/otp/resend`)
    return response.data?.data as ContractOtpResponse
  },

  async verifySigningOtp(contractId: string, otp: string) {
    const response = await api.post(`/api/v1/contracts/${contractId}/otp/verify`, { otp })
    return response.data?.data as ContractOtpResponse
  },

  async mockSignContract(contractId: string, signatureData?: string) {
    const response = await api.post(`/api/v1/contracts/${contractId}/mock-sign`, { signatureData })
    return response.data?.data as RentalContract
  },

  async requestRenewal(contractId: string, cycleMonths: number, notes?: string) {
    const response = await api.post(`/api/v1/contracts/${contractId}/renew`, { cycleMonths, notes })
    return response.data?.data as import('../types').ContractRenewal
  },

  async switchRenewalMethod(
    renewalId: string,
    data: { method: 'ONLINE' | 'COUNTER'; appointmentDate?: string; appointmentTime?: string; notes?: string }
  ) {
    const response = await api.put(`/api/v1/contracts/renewals/${renewalId}/method`, data)
    return response.data?.data as import('../types').ContractRenewal
  },

  async getRenewalsByContract(contractId: string) {
    const response = await api.get(`/api/v1/contracts/${contractId}/renewals`)
    return (response.data?.data || []) as import('../types').ContractRenewal[]
  },

  async getRenewalById(renewalId: string) {
    const response = await api.get(`/api/v1/contracts/renewals/${renewalId}`)
    return response.data?.data as import('../types').ContractRenewal
  },

  async getRenewalSigningUrl(renewalId: string) {
    const response = await api.get(`/api/v1/contracts/renewals/${renewalId}/signing-url`)
    return response.data?.data?.signingUrl as string
  },

  async mockSignRenewal(renewalId: string, signatureData?: string) {
    const response = await api.post(`/api/v1/contracts/renewals/${renewalId}/mock-sign`, { signatureData })
    return response.data?.data as import('../types').ContractRenewal
  },

  async createRenewalPayment(renewalId: string) {
    const response = await api.post(`/api/v1/contracts/renewals/${renewalId}/payment`)
    return response.data?.data as { paymentUrl: string; transactionId?: string; vnpTxnRef?: string }
  },

  async recordCounterPayment(renewalId: string, data: { paymentMethod: string; receiptVoucherCode?: string; notes?: string }) {
    const response = await api.post(`/api/v1/contracts/renewals/${renewalId}/counter-payment`, data)
    return response.data?.data as import('../types').ContractRenewal
  },

  async approveRenewal(renewalId: string, notes?: string) {
    const response = await api.post(`/api/v1/contracts/renewals/${renewalId}/approve`, { notes })
    return response.data?.data as import('../types').ContractRenewal
  },

  async rejectRenewal(renewalId: string, reason: string) {
    const response = await api.post(`/api/v1/contracts/renewals/${renewalId}/reject`, { reason })
    return response.data?.data as import('../types').ContractRenewal
  },

  async cancelRenewal(renewalId: string) {
    const response = await api.post(`/api/v1/contracts/renewals/${renewalId}/cancel`)
    return response.data?.data as import('../types').ContractRenewal
  },

  async reactivateRenewal(renewalId: string) {
    const response = await api.post(`/api/v1/contracts/renewals/${renewalId}/reactivate`)
    return response.data?.data as import('../types').ContractRenewal
  },

  async undoApproval(renewalId: string, reason?: string) {
    const response = await api.post(`/api/v1/contracts/renewals/${renewalId}/undo-approval`, { reason })
    return response.data?.data as import('../types').ContractRenewal
  },

  async assignStaff(renewalId: string, data: { staffId: string; notes?: string; autoCreateShift?: boolean }) {
    const response = await api.put(`/api/v1/contracts/renewals/${renewalId}/assign-staff`, data)
    return response.data?.data as import('../types').ContractRenewal
  },

  async completeReception(
    renewalId: string,
    data: {
      identityVerified: boolean
      identityDocType?: string
      identityNumber?: string
      identityNotes?: string
      unitAudited: boolean
      unitAuditNotes?: string
      noBlockingIssues: boolean
      blockingNotes?: string
      termsConfirmed: boolean
      termsNotes?: string
      paymentConfirmed: boolean
      paymentMethod?: string
      receiptVoucherCode?: string
      signatureData?: string
      receptionNotes?: string
    }
  ) {
    const response = await api.post(`/api/v1/contracts/renewals/${renewalId}/reception-complete`, data)
    return response.data?.data as import('../types').ContractRenewal
  },

  async getRenewals(params?: {
    contractId?: string
    facilityId?: string
    status?: string
    search?: string
    fromDate?: string
    toDate?: string
    page?: number
    size?: number
    sortBy?: string
    sortDir?: string
  }): Promise<PageResponse<import('../types').ContractRenewal>> {
    const response = await api.get('/api/v1/contracts/renewals', { params })
    const data = response.data?.data
    if (Array.isArray(data)) {
      return { content: data, totalElements: data.length, totalPages: 1, number: 0, size: data.length }
    }
    return (data || { content: [] }) as PageResponse<import('../types').ContractRenewal>
  },

  async getSigningUrl(contractId: string) {
    const response = await api.get(`/api/v1/contracts/${contractId}/signing-url`)
    return response.data?.data?.signingUrl as string
  },

  async getContractById(contractId: string): Promise<RentalContract | null> {
    try {
      const response = await api.get(`/api/v1/contracts/${contractId}`)
      return response.data?.data as RentalContract
    } catch {
      return null
    }
  },

  async getContractByBookingId(bookingId: string): Promise<RentalContract | null> {
    try {
      const response = await api.get(`/api/v1/contracts/booking/${bookingId}`)
      return response.data?.data as RentalContract
    } catch {
      return null
    }
  },

  async sendForSignature(contractId: string) {
    const response = await api.post(`/api/v1/contracts/${contractId}/send-for-signature`)
    return response.data?.data?.signingUrl as string
  },
}
