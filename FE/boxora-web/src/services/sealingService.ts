import { api } from '../lib/axios'

export interface SealingCreatePayload {
  contractId?: string
  unitId?: string
  sealTagNumber?: string
  witnessId?: string
  reason?: string
  inventorySummary?: string
  notes?: string
  evidenceUrls?: string
}

export interface SealingRecordResponse {
  id: string
  protocolNumber: string
  contractId?: string
  contractCode?: string
  storageUnitId?: string
  unitId?: string
  unitCode?: string
  facilityId?: string
  facilityName?: string
  sealTagNumber: string
  reason: string
  sealedAt: string
  sealedById?: string
  sealedByName?: string
  witnessId?: string
  witnessName?: string
  status: string
  overdueDays?: number
  totalDebtAmount?: number
  inventorySummary?: string
  evidenceUrls?: string
  notes?: string
}

export const sealingService = {
  async createSealing(data: SealingCreatePayload) {
    const response = await api.post('/api/v1/sealing', data)
    return response.data?.data as SealingRecordResponse
  },

  async unseal(id: string, data: { unsealReason: string; witnessId?: string; notes?: string }) {
    const response = await api.post(`/api/v1/sealing/${id}/unseal`, data)
    return response.data?.data as SealingRecordResponse
  },

  async getById(id: string) {
    const response = await api.get(`/api/v1/sealing/${id}`)
    return response.data?.data as SealingRecordResponse
  },

  async getByContractId(contractId: string) {
    const response = await api.get(`/api/v1/sealing/contract/${contractId}`)
    return response.data?.data as SealingRecordResponse
  },

  async getAll(params?: { facilityId?: string; status?: string; page?: number; size?: number }) {
    const response = await api.get('/api/v1/sealing', { params })
    return response.data?.data
  }
}

