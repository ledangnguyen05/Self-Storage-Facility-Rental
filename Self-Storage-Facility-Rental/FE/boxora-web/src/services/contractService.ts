import { api } from '../lib/axios'
import { RentalContract } from '../types'

export interface ContractOtpResponse {
  expiresInSeconds: number
  resendInSeconds: number
  signingUrl?: string
}

export const contractService = {
  async getMyContracts(customerId: string) {
    const response = await api.get('/api/v1/contracts', {
      params: { customerId, page: 0, size: 100, sortBy: 'createdAt', sortDir: 'desc' },
    })
    return response.data?.data?.content as RentalContract[]
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
}
