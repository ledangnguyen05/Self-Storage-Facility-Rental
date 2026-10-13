import { api } from '../lib/axios'

export interface RentalContract {
  id: string
  contractCode: string
  customerId: string
  customerName?: string
  customerEmail?: string
  customerPhone?: string
  unitId: string
  unitCode: string
  facilityId: string
  facilityName: string
  bookingId?: string
  startDate: string
  endDate: string
  monthlyFee: number
  depositHeld: number
  status: 'DRAFT' | 'PENDING_SIGNATURE' | 'ACTIVE' | 'EXPIRED' | 'TERMINATED'
  docusealSubmissionId?: number
  docusealSubmitterSlug?: string
  signingUrl?: string
  signedDocumentUrl?: string
  signedAt?: string
  createdAt?: string
  updatedAt?: string
}

export interface PageResponse<T> {
  content: T[]
  page: number
  size: number
  totalElements: number
  totalPages: number
  first: boolean
  last: boolean
}

export const contractService = {
  async getMyContracts(params?: { customerId?: string; facilityId?: string; status?: string; page?: number; size?: number }) {
    const response = await api.get('/api/v1/contracts', { params })
    return response.data?.data as PageResponse<RentalContract>
  },

  async getContractById(id: string) {
    const response = await api.get(`/api/v1/contracts/${id}`)
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
  }
}
