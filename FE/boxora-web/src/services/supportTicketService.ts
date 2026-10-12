import { api } from '../lib/axios'
import { SupportTicket } from '../types'

export interface CreateSupportTicketPayload {
  customerId?: string
  bookingId?: string
  category: string
  title: string
  description: string
  priority?: string
  attachmentUrl?: string
}

export const supportTicketService = {
  async createTicket(payload: CreateSupportTicketPayload): Promise<SupportTicket> {
    const response = await api.post('/api/v1/support-tickets', payload)
    return response.data?.data as SupportTicket
  },

  async getMyTickets(customerId?: string): Promise<SupportTicket[]> {
    const response = await api.get('/api/v1/support-tickets/my-tickets', {
      params: customerId ? { customerId } : {},
    })
    return response.data?.data as SupportTicket[]
  },

  async getQueue(): Promise<SupportTicket[]> {
    const response = await api.get('/api/v1/support-tickets/queue')
    return response.data?.data as SupportTicket[]
  },

  async resolveTicket(id: string, resolutionNote?: string): Promise<SupportTicket> {
    const response = await api.patch(`/api/v1/support-tickets/${id}/resolve`, null, {
      params: { resolutionNote },
    })
    return response.data?.data as SupportTicket
  },

  async uploadAttachment(file: File): Promise<string> {
    const formData = new FormData()
    formData.append('file', file)
    const response = await api.post('/api/v1/support-tickets/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
    return response.data?.data?.fileUrl as string
  },
}

