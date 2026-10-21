import { api } from '../lib/axios'
import type { PageResult, RequestOptions } from '../types'

/** `MasterKeyOverrideCategory` (backend enum). */
export type MasterKeyOverrideCategory =
  | 'LIFE_AND_SAFETY'
  | 'LAW_ENFORCEMENT'
  | 'POLICY_ENFORCEMENT'
  | 'TECHNICAL_INCIDENT'
  | 'SPECIAL_CIRCUMSTANCE'

/** `OverrideSeverity` (backend enum). */
export type MasterKeyOverrideSeverity = 'CRITICAL' | 'HIGH' | 'STANDARD'

/** `MasterKeyOverrideRequest`. */
export interface MasterKeyOverridePayload {
  facilityId: string
  category: MasterKeyOverrideCategory
  severity: MasterKeyOverrideSeverity
  witnessUserId: string
  witnessPassword: string
  reason: string
  documentReference?: string
  resourceType?: string
  resourceId?: string
}

/** `MasterKeyOverrideResponse`. */
export interface MasterKeyOverrideRecord {
  id: string
  facilityId: string
  facilityName?: string
  performedById?: string
  performedByName?: string
  witnessId?: string
  witnessName?: string
  category: MasterKeyOverrideCategory | string
  severity: MasterKeyOverrideSeverity | string
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

  async getById(id: string, opts?: RequestOptions) {
    const response = await api.get(`/api/v1/master-key/${id}`, { signal: opts?.signal })
    return response.data?.data as MasterKeyOverrideRecord
  },

  async getAll(params?: { facilityId?: string; page?: number; size?: number }, opts?: RequestOptions) {
    const response = await api.get('/api/v1/master-key', { params, signal: opts?.signal })
    return response.data?.data as PageResult<MasterKeyOverrideRecord>
  },
}
