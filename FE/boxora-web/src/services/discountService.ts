import { api } from '../lib/axios'
import {
  Discount,
  DiscountCreateRequest,
  DiscountUpdateRequest,
  DiscountValidateRequest,
  DiscountValidateResponse,
} from '../types'

export const discountService = {
  /**
   * Lấy danh sách tất cả mã ưu đãi / chiết khấu.
   */
  async getAll(params?: { facilityId?: string; activeOnly?: boolean }): Promise<Discount[]> {
    const response = await api.get('/api/v1/discounts', {
      params: {
        facilityId: params?.facilityId,
        activeOnly: params?.activeOnly ?? false,
      },
    })
    return response.data?.data || []
  },

  /**
   * Lấy danh sách các ưu đãi đang có hiệu lực.
   */
  async getActive(facilityId?: string): Promise<Discount[]> {
    const response = await api.get('/api/v1/discounts/active', {
      params: { facilityId },
    })
    return response.data?.data || []
  },

  /**
   * Xem chi tiết ưu đãi theo ID.
   */
  async getById(id: string): Promise<Discount> {
    const response = await api.get(`/api/v1/discounts/${id}`)
    return response.data?.data
  },

  /**
   * Xem ưu đãi theo Code.
   */
  async getByCode(code: string): Promise<Discount> {
    const response = await api.get(`/api/v1/discounts/by-code/${code}`)
    return response.data?.data
  },

  /**
   * Tạo mới chương trình ưu đãi (ADMIN, BUSINESS_MANAGER).
   */
  async create(data: DiscountCreateRequest): Promise<Discount> {
    const response = await api.post('/api/v1/discounts', data)
    return response.data?.data
  },

  /**
   * Cập nhật chương trình ưu đãi (ADMIN, BUSINESS_MANAGER).
   */
  async update(id: string, data: DiscountUpdateRequest): Promise<Discount> {
    const response = await api.put(`/api/v1/discounts/${id}`, data)
    return response.data?.data
  },

  /**
   * Vô hiệu hóa chương trình ưu đãi (ADMIN, BUSINESS_MANAGER).
   */
  async delete(id: string): Promise<void> {
    await api.delete(`/api/v1/discounts/${id}`)
  },

  /**
   * Kiểm tra và tính toán giảm giá khi nhập mã voucher.
   */
  async validateDiscount(data: DiscountValidateRequest): Promise<DiscountValidateResponse> {
    const response = await api.post('/api/v1/discounts/validate', data)
    return response.data?.data
  },
}

