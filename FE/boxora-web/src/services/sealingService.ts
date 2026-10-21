import { api } from '../lib/axios'
import type { PageResult, RequestOptions } from '../types'
import type { AccessRestorationResult } from './overdueService'

export interface SealingCreatePayload {
  contractId?: string
  unitId?: string
  /** Number printed on the physical seal tag (max 50). Empty: the system issues one. */
  sealTagNumber?: string
  /** Required: active staff or manager of the same facility, other than the signed-in user. */
  witnessId: string
  reason?: string
  inventorySummary?: string
  notes?: string
  evidenceUrls?: string
}

/** POST /sealing/{id}/unseal (`SealingUnsealRequest`). */
export interface SealingUnsealPayload {
  reason: string
  notes?: string
  /** yyyy-MM-dd; only used when the contract is still overdue after unsealing. */
  holdUntil?: string
}

export type SealingStatus = 'SEALED' | 'UNSEALED' | 'DISPOSED'

/** `SealingRecordResponse`. */
export interface SealingRecordResponse {
  id: string
  protocolNumber?: string
  contractId?: string
  contractCode?: string
  contractStartDate?: string
  contractEndDate?: string
  storageUnitId?: string
  unitId?: string
  unitCode?: string
  facilityId?: string
  facilityName?: string
  facilityAddress?: string
  facilityPhone?: string
  customerId?: string
  customerName?: string
  customerEmail?: string
  customerPhone?: string
  sealTagNumber: string
  reason: string
  sealedAt: string
  sealedById?: string
  sealedByName?: string
  sealedByRole?: string
  witnessId?: string
  witnessName?: string
  witnessRole?: string
  status: SealingStatus | string
  overdueDays?: number
  totalDebtAmount?: number
  inventorySummary?: string
  evidenceUrls?: string
  notes?: string
  unsealedAt?: string
  unsealedById?: string
  unsealedByName?: string
  unsealReason?: string
  createdAt?: string
  /** Only on create / unseal: true when the mail server accepted the notice email. */
  customerNotified?: boolean
  notificationMessage?: string
  /** Only on unseal: what happened to the tenant access. */
  accessRestoration?: AccessRestorationResult | null
}

export const sealingService = {
  async createSealing(data: SealingCreatePayload) {
    const response = await api.post('/api/v1/sealing', data)
    return response.data?.data as SealingRecordResponse
  },

  async unseal(id: string, data: SealingUnsealPayload) {
    const response = await api.post(`/api/v1/sealing/${id}/unseal`, data)
    return response.data?.data as SealingRecordResponse
  },

  async getById(id: string, opts?: RequestOptions) {
    const response = await api.get(`/api/v1/sealing/${id}`, { signal: opts?.signal })
    return response.data?.data as SealingRecordResponse
  },

  /** Active (SEALED) record of a contract, or null when there is none. */
  async getByContractId(contractId: string, opts?: RequestOptions): Promise<SealingRecordResponse | null> {
    const response = await api.get(`/api/v1/sealing/contract/${contractId}`, { signal: opts?.signal })
    return (response.data?.data as SealingRecordResponse | undefined) ?? null
  },

  /** Active (SEALED) record of a storage unit, or null when there is none. */
  async getActiveByUnitId(unitId: string, opts?: RequestOptions): Promise<SealingRecordResponse | null> {
    const response = await api.get(`/api/v1/sealing/unit/${unitId}/active`, { signal: opts?.signal })
    return (response.data?.data as SealingRecordResponse | undefined) ?? null
  },

  async getAll(params?: { facilityId?: string; status?: string; page?: number; size?: number }, opts?: RequestOptions) {
    const response = await api.get('/api/v1/sealing', { params, signal: opts?.signal })
    return response.data?.data as PageResult<SealingRecordResponse>
  },
}
