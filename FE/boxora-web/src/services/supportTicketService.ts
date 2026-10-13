import { api } from '../lib/axios'

export type SupportTicketCategory = 'PIN_CODE' | 'LOCK_ISSUE' | 'FACILITY_DAMAGE' | 'PAYMENT_ISSUE' | 'OTHER'

export interface SupportTicketRecord {
  id: string
  ticketCode: string
  customerId: string
  customerName?: string
  customerPhone?: string
  bookingId?: string
  unitCode?: string
  category: SupportTicketCategory
  title: string
  description: string
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED'
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
  resolutionNote?: string
  createdAt: string
}

export interface CreateSupportTicketRequest {
  customerId?: string
  bookingId?: string
  category: SupportTicketCategory
  title: string
  description: string
  priority?: SupportTicketRecord['priority']
}

export const supportTicketService = {
  async create(request: CreateSupportTicketRequest) {
    const response = await api.post('/api/v1/support-tickets', request)
    return response.data?.data as SupportTicketRecord
  },

  async getQueue() {
    const response = await api.get('/api/v1/support-tickets/queue')
    return response.data?.data as SupportTicketRecord[]
  },

  async resolve(id: string, resolutionNote: string) {
    const response = await api.patch(`/api/v1/support-tickets/${id}/resolve`, undefined, {
      params: { resolutionNote },
    })
    return response.data?.data as SupportTicketRecord
  },
}
