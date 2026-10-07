import { api } from '../lib/axios'
import {
  OverdueContractDetail,
  OverdueProcessResult,
  SealingRecord,
  UnsealRequest,
  SealingStatus,
} from '../types'

export interface SealingRecordFilterParams {
  facilityId?: string
  status?: SealingStatus
  page?: number
  size?: number
}

export interface SealingRecordPageResponse {
  content: SealingRecord[]
  pageNumber: number
  pageSize: number
  totalElements: number
  totalPages: number
  last: boolean
}

export const overdueService = {
  /**
   * Kích hoạt quét và xử lý quá hạn (+1 phạt 5%, +3 khóa PIN, +7 niêm phong BR-RULE-012) thủ công.
   */
  async triggerOverdueProcess(referenceDate?: string): Promise<OverdueProcessResult> {
    const response = await api.post('/api/v1/cron/overdue-process', null, {
      params: referenceDate ? { referenceDate } : {},
    })
    return response.data?.data
  },

  /**
   * Lấy danh sách hợp đồng quá hạn kèm chi tiết các mốc vi phạm hiện tại.
   */
  async getOverdueContracts(): Promise<OverdueContractDetail[]> {
    const response = await api.get('/api/v1/overdue/contracts')
    return response.data?.data || []
  },

  /**
   * Lấy danh sách các biên bản niêm phong kho lưu trữ (phân trang, lọc theo chi nhánh/trạng thái).
   */
  async getSealingRecords(params?: SealingRecordFilterParams): Promise<SealingRecordPageResponse> {
    const response = await api.get('/api/v1/sealing-records', {
      params: {
        facilityId: params?.facilityId,
        status: params?.status,
        page: params?.page ?? 0,
        size: params?.size ?? 20,
      },
    })
    return response.data?.data
  },

  /**
   * Xem chi tiết một biên bản niêm phong theo ID.
   */
  async getSealingRecordById(id: string): Promise<SealingRecord> {
    const response = await api.get(`/api/v1/sealing-records/${id}`)
    return response.data?.data
  },

  /**
   * Mở niêm phong kho lưu trữ sau khi xử lý xong công nợ / nộp phạt (BR-RULE-012).
   */
  async unsealUnit(id: string, data: UnsealRequest): Promise<SealingRecord> {
    const response = await api.post(`/api/v1/sealing-records/${id}/unseal`, data)
    return response.data?.data
  },
}
