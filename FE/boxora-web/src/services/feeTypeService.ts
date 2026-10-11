import { api } from '../lib/axios'
import {
  FeeType,
  FeeTypeCreateRequest,
  FeeTypeUpdateRequest,
  FeeCategory,
} from '../types'

export const feeTypeService = {
  /**
   * Lấy danh sách các loại biểu phí & phụ phí.
   */
  async getAll(params?: { category?: FeeCategory; activeOnly?: boolean }): Promise<FeeType[]> {
    const response = await api.get('/api/v1/fee-types', {
      params: {
        category: params?.category,
        activeOnly: params?.activeOnly ?? false,
      },
    })
    return response.data?.data || []
  },

  /**
   * Xem chi tiết loại phí theo ID.
   */
  async getById(id: string): Promise<FeeType> {
    const response = await api.get(`/api/v1/fee-types/${id}`)
    return response.data?.data
  },

  /**
   * Xem loại phí theo Code.
   */
  async getByCode(code: string): Promise<FeeType> {
    const response = await api.get(`/api/v1/fee-types/by-code/${code}`)
    return response.data?.data
  },

  /**
   * Tạo mới loại phí (ADMIN, BUSINESS_MANAGER).
   */
  async create(data: FeeTypeCreateRequest): Promise<FeeType> {
    const response = await api.post('/api/v1/fee-types', data)
    return response.data?.data
  },

  /**
   * Cập nhật loại phí (ADMIN, BUSINESS_MANAGER).
   */
  async update(id: string, data: FeeTypeUpdateRequest): Promise<FeeType> {
    const response = await api.put(`/api/v1/fee-types/${id}`, data)
    return response.data?.data
  },

  /**
   * Vô hiệu hóa loại phí (ADMIN, BUSINESS_MANAGER).
   */
  async delete(id: string): Promise<void> {
    await api.delete(`/api/v1/fee-types/${id}`)
  },
}
