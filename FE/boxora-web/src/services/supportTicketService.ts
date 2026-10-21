import { api } from '../lib/axios'
import type { FileUploadResponse, RequestOptions } from '../types'

export type SupportTicketCategory =
  | 'PIN_CODE'
  | 'LOCK_ISSUE'
  | 'FACILITY_DAMAGE'
  | 'PAYMENT_ISSUE'
  | 'ACCESS_ISSUE'
  | 'CLEANLINESS_PEST'
  | 'CLIMATE_TEMP'
  | 'OTHER'
  | string

export interface SupportTicketRecord {
  id: string
  ticketCode?: string
  ticketNumber?: string
  customerId?: string
  customerName?: string
  customerPhone?: string
  bookingId?: string
  unitCode?: string
  facilityId?: string
  facilityName?: string
  facilityCode?: string
  assignedStaffId?: string
  assignedStaffName?: string
  assignedStaffPhone?: string
  category: SupportTicketCategory
  title: string
  description: string
  status: 'OPEN' | 'PENDING' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED' | 'REOPENED' | string
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT' | string
  resolutionNote?: string
  imageEvidence?: string
  evidenceUrls?: string[]
  slaDueAt?: string
  isOverdue?: boolean
  isOverdueSla?: boolean
  /** How many times the ticket was reopened (0 when never). */
  reopenCount?: number
  /** Reason of the latest reopen. */
  reopenReason?: string
  resolvedAt?: string
  closedAt?: string
  contactLogCount?: number
  createdAt: string
  updatedAt?: string
}

export type SupportTicketResponse = SupportTicketRecord

export interface CreateSupportTicketRequest {
  customerId?: string
  bookingId?: string
  facilityId?: string
  category: SupportTicketCategory
  title: string
  description: string
  priority?: string
  attachmentUrl?: string
  imageEvidence?: string
  evidenceUrls?: string[]
}

export type SupportTicketPayload = CreateSupportTicketRequest

export interface ContactLogRecord {
  id: string
  ticketId: string
  ticketCode?: string
  contactMethod: 'PHONE' | 'EMAIL' | 'INTERNAL_CHAT' | string
  contactedById?: string
  contactedByName?: string
  targetRole?: string
  contactTarget: string
  summary: string
  result?: string
  createdAt: string
}

export type SupportTicketContactLog = ContactLogRecord

export interface EscalationContact {
  id: string
  fullName: string
  email: string
  phone: string
  role: string
}

export type EscalationContactResponse = EscalationContact

export interface SupportTicketStats {
  totalTickets: number
  openTickets: number
  inProgressTickets: number
  resolvedTickets: number
  closedTickets: number
  reopenedTickets: number
  overdueTickets: number
  overdueSlaTickets?: number
  resolvedOnTimeTickets?: number
  resolvedLateTickets?: number
  /** Share of tickets within SLA (0-100); null when there are no tickets yet. */
  slaCompliancePercent: number | null
  /** Average minutes from creation to resolution; null when nothing has been resolved yet. */
  avgResolutionMinutes: number | null
  countByFacility: Record<string, number>
  countByCategory: Record<string, number>
  countByPriority: Record<string, number>
}

export const supportTicketService = {
  async createTicket(data: CreateSupportTicketRequest) {
    const response = await api.post('/api/v1/support-tickets', data)
    return response.data?.data as SupportTicketRecord
  },

  async getQueue(
    params?: {
      facilityId?: string
      status?: string
      category?: string
      priority?: string
    },
    opts?: RequestOptions
  ) {
    const response = await api.get('/api/v1/support-tickets/queue', { params, signal: opts?.signal })
    return (response.data?.data || []) as SupportTicketRecord[]
  },

  async getTicketById(id: string, opts?: RequestOptions) {
    const response = await api.get(`/api/v1/support-tickets/${id}`, { signal: opts?.signal })
    return response.data?.data as SupportTicketRecord
  },

  async getMyTickets(customerId?: string, opts?: RequestOptions) {
    const response = await api.get('/api/v1/support-tickets/my-tickets', {
      params: customerId ? { customerId } : undefined,
      signal: opts?.signal,
    })
    return (response.data?.data || []) as SupportTicketRecord[]
  },

  async takeTicket(id: string) {
    const response = await api.post(`/api/v1/support-tickets/${id}/take`)
    return response.data?.data as SupportTicketRecord
  },

  /** The manager's note and a changed priority are applied by the backend (the SLA is recalculated). */
  async assignTicket(
    id: string,
    data: string | { assignedStaffId: string; notes?: string; priority?: string }
  ) {
    const payload = typeof data === 'string'
      ? { staffId: data }
      : { staffId: data.assignedStaffId, notes: data.notes, priority: data.priority }
    const response = await api.post(`/api/v1/support-tickets/${id}/assign`, payload)
    return response.data?.data as SupportTicketRecord
  },

  async updateStatus(
    id: string,
    data: {
      status?: string
      note?: string
      priority?: string
      evidenceUrls?: string[]
    }
  ) {
    const response = await api.patch(`/api/v1/support-tickets/${id}/status`, data)
    return response.data?.data as SupportTicketRecord
  },

  /** The backend requires a ticket that is IN_PROGRESS, held by the caller (or a manager), and a non-empty note. */
  async resolveTicket(id: string, resolutionNote: string) {
    const response = await api.patch(`/api/v1/support-tickets/${id}/resolve`, null, {
      params: { resolutionNote },
    })
    return response.data?.data as SupportTicketRecord
  },

  async closeTicket(id: string, note = 'Khách hàng / Quản lý xác nhận đóng ticket') {
    const response = await api.post(`/api/v1/support-tickets/${id}/close`, null, {
      params: { note },
    })
    return response.data?.data as SupportTicketRecord
  },

  async reopenTicket(id: string, reason: string) {
    const response = await api.post(`/api/v1/support-tickets/${id}/reopen`, { reason })
    return response.data?.data as SupportTicketRecord
  },

  async getContactLogs(ticketId: string, opts?: RequestOptions) {
    const response = await api.get(`/api/v1/support-tickets/${ticketId}/contact-logs`, { signal: opts?.signal })
    return (response.data?.data || []) as ContactLogRecord[]
  },

  async recordContactLog(
    ticketId: string,
    data: {
      contactMethod: string
      targetRole?: string
      contactTarget: string
      summary: string
      result?: string
    }
  ) {
    const response = await api.post(`/api/v1/support-tickets/${ticketId}/contact-logs`, data)
    return response.data?.data as ContactLogRecord
  },

  async getEscalationContacts(opts?: RequestOptions) {
    const response = await api.get('/api/v1/support-tickets/escalation-contacts', { signal: opts?.signal })
    return (response.data?.data || []) as EscalationContactResponse[]
  },

  async getStats(facilityId?: string, opts?: RequestOptions) {
    const response = await api.get('/api/v1/support-tickets/stats', {
      params: facilityId ? { facilityId } : undefined,
      signal: opts?.signal,
    })
    return response.data?.data as SupportTicketStats
  },

  /** Uploads one evidence image (JPG, PNG, WEBP, max 10MB). Use `fileUrl` in `evidenceUrls`. */
  async uploadEvidence(file: File): Promise<FileUploadResponse> {
    const formData = new FormData()
    formData.append('file', file)
    const response = await api.post('/api/v1/support-tickets/upload-evidence', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return response.data?.data as FileUploadResponse
  },
}
