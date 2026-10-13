import { api } from '../lib/axios'

export interface SupportTicketPayload {
  customerId?: string
  bookingId?: string
  category: string
  title: string
  description: string
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT' | string
  imageEvidence?: string
  evidenceUrls?: string[]
}

export interface SupportTicketResponse {
  id: string
  ticketNumber?: string
  category: string
  title: string
  description: string
  status: 'PENDING' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED' | string
  priority: string
  createdAt: string
  updatedAt?: string
  resolutionNote?: string
  evidenceUrls?: string[]
}

export const supportTicketService = {
  async createTicket(data: SupportTicketPayload) {
    const response = await api.post('/api/v1/support-tickets', data)
    return response.data?.data as SupportTicketResponse
  },

  async getQueue() {
    const response = await api.get('/api/v1/support-tickets/queue')
    return response.data?.data as SupportTicketResponse[]
  },

  async getMyTickets(customerId?: string) {
    const response = await api.get('/api/v1/support-tickets/my-tickets', {
      params: customerId ? { customerId } : undefined
    })
    return response.data?.data as SupportTicketResponse[]
  },

  async resolveTicket(id: string, resolutionNote = 'Đã xử lý hiện trường bởi nhân viên trực ca') {
    const response = await api.patch(`/api/v1/support-tickets/${id}/resolve`, null, {
      params: { resolutionNote }
    })
    return response.data?.data as SupportTicketResponse
  },

  async uploadEvidence(file: File) {
    const formData = new FormData()
    formData.append('file', file)
    const response = await api.post('/api/v1/support-tickets/upload-evidence', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
    return response.data?.data
  }
}
