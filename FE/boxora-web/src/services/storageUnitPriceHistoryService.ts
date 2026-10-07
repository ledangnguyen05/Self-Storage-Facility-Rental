import { api } from '../lib/axios'
import { StorageUnitPriceHistory, StorageUnitPriceAdjustmentRequest } from '../types'

export interface PageResult<T> {
  content: T[]
  page: number
  size: number
  totalElements: number
  totalPages: number
  first: boolean
  last: boolean
}

export const storageUnitPriceHistoryService = {
  /**
   * Lấy lịch sử biến động giá của một kho lưu trữ cụ thể theo BR-RULE-011.
   */
  async getPriceHistoryByUnit(unitId: string): Promise<StorageUnitPriceHistory[]> {
    const response = await api.get(`/api/v1/storage-units/${unitId}/price-history`)
    return response.data?.data || []
  },

  /**
   * Điều chỉnh đơn giá kho lưu trữ theo BR-RULE-011 (bắt buộc lý do, lưu lịch sử và bảo lưu giá cũ).
   */
  async adjustUnitPrice(
    unitId: string,
    data: StorageUnitPriceAdjustmentRequest
  ): Promise<StorageUnitPriceHistory> {
    const response = await api.post(`/api/v1/storage-units/${unitId}/price-adjustment`, data)
    return response.data?.data
  },

  /**
   * Tra cứu toàn bộ lịch sử giá theo cơ sở / kho với phân trang.
   */
  async getAllPriceHistories(params?: {
    facilityId?: string
    unitId?: string
    page?: number
    size?: number
    sortBy?: string
    sortDir?: string
  }): Promise<PageResult<StorageUnitPriceHistory>> {
    const response = await api.get('/api/v1/price-histories', { params })
    return response.data?.data
  },
}

