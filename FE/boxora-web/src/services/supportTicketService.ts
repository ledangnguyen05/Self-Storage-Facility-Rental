import { api } from '../lib/axios'

export type SupportTicketCategory = 'PIN_CODE' | 'LOCK_ISSUE' | 'FACILITY_DAMAGE' | 'PAYMENT_ISSUE' | 'OTHER' | string

export interface SupportTicketRecord {
  id: string
  ticketCode?: string
  ticketNumber?: string
  customerId?: string
  customerName?: string
  customerPhone?: string
  bookingId?: string
  unitCode?: string
  category: SupportTicketCategory
  title: string
  description: string
  status: 'OPEN' | 'PENDING' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED' | string
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT' | string
  resolutionNote?: string
  createdAt: string
  updatedAt?: string
  evidenceUrls?: string[]
}

export type SupportTicketResponse = SupportTicketRecord

export interface CreateSupportTicketRequest {
  customerId?: string
  bookingId?: string
  category: SupportTicketCategory
  title: string
  description: string
  priority?: string
  attachmentUrl?: string
  imageEvidence?: string
  evidenceUrls?: string[]
}

export type SupportTicketPayload = CreateSupportTicketRequest

export const supportTicketService = {
  async createTicket(data: CreateSupportTicketRequest) {
    const response = await api.post('/api/v1/support-tickets', data)
    return response.data?.data as SupportTicketRecord
  },

  async create(data: CreateSupportTicketRequest) {
    return this.createTicket(data)
  },

  async getQueue() {
    const response = await api.get('/api/v1/support-tickets/queue')
    return (response.data?.data || []) as SupportTicketRecord[]
  },

  async getMyTickets(customerId?: string) {
    try {
      const response = await api.get('/api/v1/support-tickets/my-tickets', {
        params: customerId ? { customerId } : undefined,
      })
      return (response.data?.data || []) as SupportTicketRecord[]
    } catch {
      try {
        const fallback = await api.get('/api/v1/support-tickets/my', {
          params: customerId ? { customerId } : undefined,
        })
        return (fallback.data?.data || []) as SupportTicketRecord[]
      } catch {
        return []
      }
    }
  },

  async resolveTicket(id: string, resolutionNote = 'Đã xử lý hiện trường bởi nhân viên trực ca') {
    const response = await api.patch(`/api/v1/support-tickets/${id}/resolve`, null, {
      params: { resolutionNote },
    })
    return response.data?.data as SupportTicketRecord
  },

  async resolve(id: string, resolutionNote: string) {
    return this.resolveTicket(id, resolutionNote)
  },

  async uploadEvidence(file: File) {
    const formData = new FormData()
    formData.append('file', file)
    const response = await api.post('/api/v1/support-tickets/upload-evidence', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return response.data?.data
  },

  async uploadAttachment(file: File): Promise<string> {
    try {
      const result = await this.uploadEvidence(file)
      return (result?.url || result || '') as string
    } catch {
      return URL.createObjectURL(file)
    }
  },
}
