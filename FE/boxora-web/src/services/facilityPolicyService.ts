import { api } from '../lib/axios'
import type {
  FacilityPolicy,
  FacilityPolicyCreateRequest,
  FacilityPolicyUpdateRequest,
  PageResult,
  RequestOptions,
} from '../types'

/**
 * `/api/v1/facility-policies`: the only service that talks to facility policy
 * endpoints. Merge missing numbers with `resolvePolicy()` from
 * `utils/facilityPolicyDefaults` before display.
 */
export const facilityPolicyService = {
  async getAll(
    params?: {
      search?: string
      page?: number
      size?: number
      sortBy?: string
      sortDir?: 'asc' | 'desc'
    },
    opts?: RequestOptions
  ) {
    const response = await api.get('/api/v1/facility-policies', {
      params: {
        page: params?.page ?? 0,
        size: params?.size ?? 50,
        search: params?.search,
        sortBy: params?.sortBy ?? 'id',
        sortDir: params?.sortDir ?? 'desc',
      },
      signal: opts?.signal,
    })
    return response.data?.data as PageResult<FacilityPolicy>
  },

  async getById(id: string, opts?: RequestOptions) {
    const response = await api.get(`/api/v1/facility-policies/${id}`, { signal: opts?.signal })
    return response.data?.data as FacilityPolicy
  },

  /** Rejects (404) when the facility has no policy yet. */
  async getByFacilityId(facilityId: string, opts?: RequestOptions) {
    const response = await api.get(`/api/v1/facility-policies/by-facility/${facilityId}`, { signal: opts?.signal })
    return response.data?.data as FacilityPolicy
  },

  /** Business manager, admin. */
  async create(data: FacilityPolicyCreateRequest) {
    const response = await api.post('/api/v1/facility-policies', data)
    return response.data?.data as FacilityPolicy
  },

  /** Business manager, admin (or a facility manager holding an exception grant). */
  async update(id: string, data: FacilityPolicyUpdateRequest) {
    const response = await api.put(`/api/v1/facility-policies/${id}`, data)
    return response.data?.data as FacilityPolicy
  },

  async delete(id: string) {
    const response = await api.delete(`/api/v1/facility-policies/${id}`)
    return response.data
  },

  /** Facility manager ids allowed to edit this policy. */
  async getExceptionGrants(policyId: string, opts?: RequestOptions) {
    const response = await api.get(`/api/v1/facility-policies/${policyId}/exceptions`, { signal: opts?.signal })
    return (response.data?.data || []) as string[]
  },

  async setExceptionGrant(policyId: string, facilityManagerId: string, granted: boolean) {
    const response = await api.put(`/api/v1/facility-policies/${policyId}/exceptions`, {
      facilityManagerId,
      granted,
    })
    return response.data
  },
}
