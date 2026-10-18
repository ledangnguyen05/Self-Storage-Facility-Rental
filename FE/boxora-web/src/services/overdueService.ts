import { api } from '../lib/axios'

export interface LockoutResponse {
  contractId: string
  contractCode?: string
  bookingId?: string
  unitCode?: string
  status: 'SUCCESS' | 'PENDING' | 'FAILED'
  message: string
  reason?: string
  lockedAt?: string
  pinRevoked: boolean
  physicalLockState: 'UNVERIFIED' | string
}

export const overdueService = {
  lockoutContract: async (contractId: string, reason?: string): Promise<LockoutResponse> => {
    const res = await api.post(`/api/v1/overdue/contracts/${contractId}/lockout`, { reason })
    return res.data?.data || res.data
  }
}
