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

  async requestRenewal(contractId: string, cycleMonths: number) {
    const response = await api.post(`/api/v1/contracts/${contractId}/renew`, { cycleMonths })
    return response.data?.data
  },

  async getSigningUrl(contractId: string) {
    const response = await api.get(`/api/v1/contracts/${contractId}/signing-url`)
    return response.data?.data?.signingUrl as string
  },

  async sendForSignature(contractId: string) {
    const response = await api.post(`/api/v1/contracts/${contractId}/send-for-signature`)
    return response.data?.data?.signingUrl as string
  },
}
