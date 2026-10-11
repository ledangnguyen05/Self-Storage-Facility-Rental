import { api } from '../lib/axios'
import {
  HandoverPrerequisites,
  HandoverCheckInRequest,
  HandoverRecord,
  ReturnSettlementPreviewResponse,
  ReturnSettlementResponse,
} from '../types'

export const handoverService = {
  /**
   * Đối soát 4 điều kiện tiên quyết trước khi check-in bàn giao (BR-RULE-005):
   * 1. Đủ tiền cọc (Full deposit)
   * 2. Đủ tiền thuê tháng đầu (First month rental fee)
   * 3. Hợp đồng điện tử đã ký qua OTP / DocuSeal (Signed e-contract)
   * 4. Xác minh CCCD / giấy tờ tùy thân gốc (Original identity verification)
   */
  async getCheckInPrerequisites(bookingId: string): Promise<HandoverPrerequisites> {
    const response = await api.get(`/api/v1/handovers/booking/${bookingId}/prerequisites`)
    return response.data?.data
  },

  /**
   * Thực hiện Check-in bàn giao kho vật lý (BR-RULE-005 & BR-RULE-006):
   * Khóa/mở nút bàn giao dựa theo 4 điều kiện, cấp mã PIN SmartLock và chuyển trạng thái kho sang OCCUPIED.
   */
  async checkIn(request: HandoverCheckInRequest): Promise<HandoverRecord> {
    const response = await api.post('/api/v1/handovers/check-in', request)
    return response.data?.data
  },

  /**
   * Xem trước quyết toán tiền cọc, nợ quá hạn và 5 tiêu chí thẩm định trả kho (BR-RULE-013/014/015)
   */
  async getReturnSettlementPreview(bookingId: string): Promise<ReturnSettlementPreviewResponse> {
    const response = await api.get(`/api/v1/handovers/booking/${bookingId}/return-preview`)
    return response.data?.data
  },

  /**
   * Xử lý trả kho và hoàn cọc khi kết thúc hợp đồng (BR-RULE-013/014/015)
   */
  async processReturn(request: HandoverCheckInRequest): Promise<HandoverRecord> {
    const response = await api.post('/api/v1/handovers/return', request)
    return response.data?.data
  },

  /**
   * Nghiệm thu trả kho và quyết toán hoàn cọc chi tiết
   */
  async processReturnSettlement(request: HandoverCheckInRequest): Promise<ReturnSettlementResponse> {
    const response = await api.post('/api/v1/handovers/return-settlement', request)
    return response.data?.data
  },

  /**
   * Lấy lịch sử biên bản bàn giao theo booking ID
   */
  async getByBookingId(bookingId: string): Promise<HandoverRecord[]> {
    const response = await api.get(`/api/v1/handovers/booking/${bookingId}`)
    return response.data?.data || []
  },
}

