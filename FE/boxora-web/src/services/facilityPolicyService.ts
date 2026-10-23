import { api } from '../lib/axios'
import { FacilityPolicy, FacilityPolicyCreateRequest, FacilityPolicyUpdateRequest } from '../types'
import { PageResult } from './userService'

export const facilityPolicyService = {
  /**
   * Lấy danh sách chính sách cơ sở với phân trang và tìm kiếm
   */
  async getAll(params?: {
    search?: string
    page?: number
    size?: number
    sortBy?: string
    sortDir?: 'asc' | 'desc'
  }) {
    const response = await api.get('/api/v1/facility-policies', {
      params: {
        page: params?.page ?? 0,
        size: params?.size ?? 50,
        search: params?.search,
        sortBy: params?.sortBy ?? 'id',
        sortDir: params?.sortDir ?? 'desc',
      },
    })
    return response.data?.data as PageResult<FacilityPolicy>
  },

  /**
   * Lấy chi tiết chính sách theo ID
   */
  async getById(id: string) {
    const response = await api.get(`/api/v1/facility-policies/${id}`)
    return response.data?.data as FacilityPolicy
  },

  /**
   * Lấy chính sách theo facilityId
   */
  async getByFacilityId(facilityId: string) {
    const response = await api.get(`/api/v1/facility-policies/by-facility/${facilityId}`)
    return response.data?.data as FacilityPolicy
  },

  /**
   * Tạo mới chính sách cho cơ sở (Business Manager, Admin)
   */
  async create(data: FacilityPolicyCreateRequest) {
    const response = await api.post('/api/v1/facility-policies', data)
    return response.data?.data as FacilityPolicy
  },

  /**
   * Cập nhật chính sách cơ sở (Business Manager, Admin)
   */
  async update(id: string, data: FacilityPolicyUpdateRequest) {
    const response = await api.put(`/api/v1/facility-policies/${id}`, data)
    return response.data?.data as FacilityPolicy
  },

  /**
   * Xóa chính sách cơ sở (Admin, Business Manager)
   */
  async delete(id: string) {
    const response = await api.delete(`/api/v1/facility-policies/${id}`)
    return response.data
  },
}
