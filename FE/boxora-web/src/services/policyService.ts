import { api } from '../lib/axios'
import {
  FacilityPolicy,
  FacilityPolicyCreateRequest,
  FacilityPolicyUpdateRequest,
} from '../types'

export const policyService = {
  /**
   * Lấy danh sách chính sách các cơ sở (phân trang & tìm kiếm).
   */
  async getAll(params?: { search?: string; page?: number; size?: number }): Promise<{ content: FacilityPolicy[] }> {
    const response = await api.get('/api/v1/facility-policies', {
      params: {
        search: params?.search,
        page: params?.page ?? 0,
        size: params?.size ?? 50,
      },
    })
    return response.data?.data || { content: [] }
  },

  /**
   * Lấy chính sách cơ sở theo Policy ID.
   */
  async getById(id: string): Promise<FacilityPolicy> {
    const response = await api.get(`/api/v1/facility-policies/${id}`)
    return response.data?.data
  },

  /**
   * Lấy chính sách theo Facility ID.
   */
  async getByFacilityId(facilityId: string): Promise<FacilityPolicy> {
    const response = await api.get(`/api/v1/facility-policies/by-facility/${facilityId}`)
    return response.data?.data
  },

  /**
   * Tạo mới chính sách cho cơ sở.
   */
  async create(data: FacilityPolicyCreateRequest): Promise<FacilityPolicy> {
    const response = await api.post('/api/v1/facility-policies', data)
    return response.data?.data
  },

  /**
   * Cập nhật chính sách cơ sở.
   */
  async update(id: string, data: FacilityPolicyUpdateRequest): Promise<FacilityPolicy> {
    const response = await api.put(`/api/v1/facility-policies/${id}`, data)
    return response.data?.data
  },

  /**
   * Xóa chính sách cơ sở.
   */
  async delete(id: string): Promise<void> {
    await api.delete(`/api/v1/facility-policies/${id}`)
  },
}
