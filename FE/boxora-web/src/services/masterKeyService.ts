import { api } from '../lib/axios'

export interface MasterKeyOverridePayload {
  facilityId: string
  category: 'MAINTENANCE_EMERGENCY' | 'FIRE_HAZARD' | 'POLICE_WARRANT' | 'ABANDONED_AUCTION' | 'INTERNAL_AUDIT'
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  witnessUserId: string
  witnessPassword: string
  reason: string
  documentReference?: string
  resourceType?: string
  resourceId?: string
}

export interface MasterKeyOverrideRecord {
  id: string
  facilityId: string
  category: string
  severity: string
  performerUserId: string
  witnessUserId: string
  reason: string
  documentReference?: string
  resourceType?: string
  resourceId?: string
  createdAt: string
}

export const masterKeyService = {
  async executeOverride(data: MasterKeyOverridePayload) {
    const response = await api.post('/api/v1/master-key/override', data)
    return response.data?.data as MasterKeyOverrideRecord
  },

  async getById(id: string) {
    const response = await api.get(`/api/v1/master-key/${id}`)
    return response.data?.data as MasterKeyOverrideRecord
  },

  async getAll(params?: { facilityId?: string; page?: number; size?: number }) {
    const response = await api.get('/api/v1/master-key', { params })
    return response.data?.data
  }
}
