import { api } from '../lib/axios'
import { Facility, FacilityPolicy } from '../types'
import { PageResult } from './userService'

export const facilityService = {
  async getFacilities(params?: { search?: string; status?: string; page?: number; size?: number; publicView?: boolean }) {
    const response = await api.get('/api/v1/facilities', { params: { size: 50, ...params } })
    return response.data?.data as PageResult<Facility>
  },

  async getFacilityById(id: string) {
    const response = await api.get(`/api/v1/facilities/${id}`)
    return response.data?.data as Facility
  },

  async uploadFacilityImage(file: File) {
    const endpoints = [
      '/api/v1/facilities/upload-image',
      '/api/v1/storage-units/upload-image',
      '/api/v1/unit-types/upload-image',
      '/api/v1/support-tickets/upload-evidence',
      '/api/v1/refunds/upload-proof',
    ]
    let lastError: unknown = null
    for (const endpoint of endpoints) {
      try {
        const formData = new FormData()
        formData.append('file', file)
        const response = await api.post(endpoint, formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        })
        if (response.data?.data) {
          return response.data.data as { fileUrl: string; fileName: string; fileSize?: number; fileType?: string }
        }
      } catch (err: any) {
        lastError = err
        const status = err?.response?.status
        if (status && status !== 401 && status !== 403 && status !== 404) {
          throw err
        }
      }
    }
    throw lastError || new Error('Không thể tải ảnh cơ sở lên Cloudflare R2')
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
