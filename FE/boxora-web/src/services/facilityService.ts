import { api } from '../lib/axios'
import { Facility, FacilityPolicy } from '../types'
import { PageResult } from './userService'

export const facilityService = {
  async getFacilities(params?: { search?: string; status?: string; page?: number; size?: number }) {
    const response = await api.get('/api/v1/facilities', { params: { size: 50, ...params } })
    return response.data?.data as PageResult<Facility>
  },

  async getFacilityById(id: string) {
    const response = await api.get(`/api/v1/facilities/${id}`)
    return response.data?.data as Facility
  },

  async createFacility(data: Partial<Facility>) {
    const response = await api.post('/api/v1/facilities', data)
    return response.data?.data as Facility
  },

  async updateFacility(id: string, data: Partial<Facility> & { clearCoordinates?: boolean }) {
    const response = await api.put(`/api/v1/facilities/${id}`, data)
    return response.data?.data as Facility
  },

  async deleteFacility(id: string) {
    const response = await api.delete(`/api/v1/facilities/${id}`)
    return response.data
  },

  // Facility Policies
  async getPolicies(params?: { search?: string; page?: number; size?: number }) {
    const response = await api.get('/api/v1/facility-policies', { params })
    return response.data?.data as PageResult<FacilityPolicy>
  },

  async getPolicyByFacilityId(facilityId: string) {
    const response = await api.get(`/api/v1/facility-policies/by-facility/${facilityId}`)
    return response.data?.data as FacilityPolicy
  },

  async updatePolicy(id: string, data: Partial<FacilityPolicy>) {
    const response = await api.put(`/api/v1/facility-policies/${id}`, data)
    return response.data?.data as FacilityPolicy
  },

  async createPolicy(data: Partial<FacilityPolicy>) {
    const response = await api.post('/api/v1/facility-policies', data)
    return response.data?.data as FacilityPolicy
  },

  async getPolicyExceptionGrants(policyId: string) {
    const response = await api.get(`/api/v1/facility-policies/${policyId}/exceptions`)
    return response.data?.data as string[]
  },

  async setPolicyExceptionGrant(policyId: string, facilityManagerId: string, granted: boolean) {
    const response = await api.put(`/api/v1/facility-policies/${policyId}/exceptions`, {
      facilityManagerId,
      granted,
    })
    return response.data
  },
}
