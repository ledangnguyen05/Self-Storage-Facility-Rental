import { api } from '../lib/axios'
import {
  SupportTicket,
  SupportTicketCreateRequest,
  FileUploadResult,
} from '../types'

export const supportTicketService = {
  /**
   * Tạo yêu cầu hỗ trợ sự cố mới (kèm URL ảnh bằng chứng imageEvidence)
   */
  async createTicket(request: SupportTicketCreateRequest): Promise<SupportTicket> {
    const response = await api.post('/api/v1/support-tickets', request)
    return response.data?.data
  },

  /**
   * Tải ảnh bằng chứng hiện trường sự cố lên máy chủ
   */
  async uploadEvidence(file: File): Promise<FileUploadResult> {
    const formData = new FormData()
    formData.append('file', file)
    const response = await api.post('/api/v1/support-tickets/upload-evidence', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
    return response.data?.data
  },

  /**
   * Tải danh sách nhiều ảnh bằng chứng
   */
  async uploadEvidences(files: File[]): Promise<FileUploadResult[]> {
    const formData = new FormData()
    files.forEach(f => formData.append('files', f))
    const response = await api.post('/api/v1/support-tickets/upload-evidences', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
    return response.data?.data || []
  },

  /**
   * Lấy hàng đợi ticket cho nhân viên trực ca
   */
  async getQueue(): Promise<SupportTicket[]> {
    const response = await api.get('/api/v1/support-tickets/queue')
    return response.data?.data || []
  },

  /**
   * Lấy danh sách ticket của khách hàng
   */
  async getMyTickets(customerId?: string): Promise<SupportTicket[]> {
    const params = customerId ? { customerId } : {}
    const response = await api.get('/api/v1/support-tickets/my-tickets', { params })
    return response.data?.data || []
  },

  /**
   * Nhân viên hoàn tất xử lý ticket
   */
  async resolveTicket(id: string, resolutionNote?: string): Promise<SupportTicket> {
    const params = resolutionNote ? { resolutionNote } : {}
    const response = await api.patch(`/api/v1/support-tickets/${id}/resolve`, null, { params })
    return response.data?.data
  },
}

