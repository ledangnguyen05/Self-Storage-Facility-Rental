import { api } from '../lib/axios'
import {
  UnitType,
  UnitTypeCreateRequest,
  UnitTypeUpdateRequest,
  UnitTypePriceAdjustmentRequest,
  StorageUnitPriceHistory,
} from '../types'

export const unitTypeService = {
  /**
   * Lấy danh sách toàn bộ loại kho lưu trữ (kèm số lượng kho hiện hữu).
   */
  async getAll(): Promise<UnitType[]> {
    const response = await api.get('/api/v1/unit-types')
    return response.data?.data || []
  },

  /**
   * Xem chi tiết một loại kho lưu trữ theo ID.
   */
  async getById(id: string): Promise<UnitType> {
    const response = await api.get(`/api/v1/unit-types/${id}`)
    return response.data?.data
  },

  /**
   * Tạo mới loại kho lưu trữ (ADMIN / BUSINESS_MANAGER).
   */
  async create(data: UnitTypeCreateRequest): Promise<UnitType> {
    const response = await api.post('/api/v1/unit-types', data)
    return response.data?.data
  },

  /**
   * Cập nhật thông tin loại kho (nếu đổi đơn giá phải gửi kèm lý do).
   */
  async update(id: string, data: UnitTypeUpdateRequest): Promise<UnitType> {
    const response = await api.put(`/api/v1/unit-types/${id}`, data)
    return response.data?.data
  },

  /**
   * Điều chỉnh đơn giá niêm yết loại kho theo BR-RULE-011.
   */
  async adjustPrice(id: string, data: UnitTypePriceAdjustmentRequest): Promise<UnitType> {
    const response = await api.post(`/api/v1/unit-types/${id}/price-adjustment`, data)
    return response.data?.data
  },

  /**
   * Lấy lịch sử biến động giá của một loại kho.
   */
  async getPriceHistory(id: string): Promise<StorageUnitPriceHistory[]> {
    const response = await api.get(`/api/v1/unit-types/${id}/price-history`)
    return response.data?.data || []
  },

  /**
   * Xóa loại kho (chỉ xóa được khi không có kho nào thuộc loại này).
   */
  async delete(id: string): Promise<void> {
    await api.delete(`/api/v1/unit-types/${id}`)
  },
}
