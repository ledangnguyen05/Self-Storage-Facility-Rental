import { api } from '../lib/axios'
import {
  CancellationPolicyDetail,
  PolicyConfirmationPayload,
  PolicyConfirmationResult,
  PolicyConfirmationStatus,
} from '../types'

export const cancellationPolicyService = {
  /**
   * Lấy chi tiết điều khoản hủy hợp đồng & hoàn tiền theo cơ sở
   */
  async getCancellationPolicyByFacility(facilityId: string): Promise<CancellationPolicyDetail> {
    const res = await api.get(`/api/v1/cancellation-policy/by-facility/${facilityId}`)
    return res.data?.data
  },

  /**
   * Lấy chi tiết điều khoản hủy hợp đồng & hoàn tiền theo đơn đặt kho
   */
  async getCancellationPolicyByBooking(bookingId: string): Promise<CancellationPolicyDetail> {
    const res = await api.get(`/api/v1/cancellation-policy/booking/${bookingId}`)
    return res.data?.data
  },

  /**
   * Khách hàng xác nhận đồng ý với điều khoản hủy hợp đồng & hoàn tiền
   */
  async confirmCancellationPolicy(payload: PolicyConfirmationPayload): Promise<PolicyConfirmationResult> {
    const res = await api.post('/api/v1/cancellation-policy/confirm', payload)
    return res.data?.data
  },

  /**
   * Kiểm tra trạng thái xác nhận điều khoản hủy của đơn đặt kho
   */
  async getPolicyConfirmationStatus(bookingId: string): Promise<PolicyConfirmationStatus> {
    const res = await api.get(`/api/v1/cancellation-policy/confirmation-status/${bookingId}`)
    return res.data?.data
  },
}
