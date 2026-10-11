import { api } from '../lib/axios'
import {
  BookingCancellationPreview,
  BookingCancelRequest,
  BookingCancelResponse,
  AutoCancelResult,
} from '../types'

export const bookingCancellationService = {
  /**
   * Xem trước thông tin hoàn tiền theo chính sách 3 mốc:
   * - Mốc 1 (>= 48h): Hoàn 100% tiền cọc
   * - Mốc 2 (24h - 48h): Hoàn 50% tiền cọc
   * - Mốc 3 (< 24h hoặc sau check-in): Hoàn 0%
   */
  async getCancellationPreview(bookingId: string): Promise<BookingCancellationPreview> {
    const response = await api.get(`/api/v1/bookings/${bookingId}/cancellation-preview`)
    return response.data?.data
  },

  /**
   * Thực hiện hủy đơn đặt kho: áp dụng hoàn tiền 3 mốc, giải phóng ngăn kho và thu hồi quyền truy cập (PIN/QR).
   */
  async cancelBooking(bookingId: string, request?: BookingCancelRequest): Promise<BookingCancelResponse> {
    const response = await api.post(`/api/v1/bookings/${bookingId}/cancel`, request || {})
    return response.data?.data
  },

  /**
   * Kích hoạt quét thủ công tự động hủy các booking PENDING_PAYMENT quá hạn thanh toán (mặc định 15 phút).
   */
  async triggerAutoCancelProcess(timeoutMinutes: number = 15): Promise<AutoCancelResult> {
    const response = await api.post('/api/v1/cron/auto-cancel-process', null, {
      params: { timeoutMinutes },
    })
    return response.data?.data
  },
}

