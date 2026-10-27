import { api } from '../lib/axios'

export type SupportTicketCategory =
  | 'PIN_CODE'
  | 'LOCK_ISSUE'
  | 'FACILITY_DAMAGE'
  | 'PAYMENT_ISSUE'
  | 'ACCESS_ISSUE'
  | 'CLEANLINESS_PEST'
  | 'CLIMATE_TEMP'
  | 'RETURN_REFUND'
  | 'RETURN_EXPIRED'
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
  reopenCount?: number
  reopenReason?: string
  resolvedAt?: string
  closedAt?: string
  contactLogCount?: number
  storageUnitId?: string
  createdByStaffId?: string
  createdByStaffName?: string
  createdByStaffRole?: string
  isStaffRecorded?: boolean
  createdAt?: string
  updatedAt?: string

  // Refund and Bank Transfer fields
  bankName?: string
  bankAccountNumber?: string
  bankAccountName?: string
  refundAmount?: number
  transferProofUrl?: string
  transferTransactionRef?: string
  transferConfirmedAt?: string
  transferConfirmedByName?: string
  fmApprovedAt?: string
  fmApprovedByName?: string
  fmApprovalNote?: string
  refundStatus?: 'NONE' | 'PENDING_FM_APPROVAL' | 'AWAITING_CUSTOMER_BANK_INFO' | 'PENDING_ADMIN_PAYOUT' | 'COMPLETED' | 'REJECTED' | string
}

export type SupportTicketResponse = SupportTicketRecord

export interface CreateSupportTicketRequest {
  customerId?: string
  bookingId?: string
  facilityId?: string
  storageUnitId?: string
  unitCode?: string
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
  slaCompliancePercent: number
  avgResolutionMinutes: number
  countByFacility: Record<string, number>
  countByCategory: Record<string, number>
  countByPriority: Record<string, number>
}

export const supportTicketService = {
  async createTicket(data: CreateSupportTicketRequest) {
    const response = await api.post('/api/v1/support-tickets', data)
    return response.data?.data as SupportTicketRecord
  },

  async create(data: CreateSupportTicketRequest) {
    return this.createTicket(data)
  },

  async getQueue(params?: {
    facilityId?: string
    status?: string
    category?: string
    priority?: string
  }) {
    const response = await api.get('/api/v1/support-tickets/queue', { params })
    return (response.data?.data || []) as SupportTicketRecord[]
  },

  async getTicketById(id: string) {
    const response = await api.get(`/api/v1/support-tickets/${id}`)
    return response.data?.data as SupportTicketRecord
  },

  async getMyTickets(customerId?: string) {
    const response = await api.get('/api/v1/support-tickets/my-tickets', {
      params: customerId ? { customerId } : undefined,
    })
    return (response.data?.data || []) as SupportTicketRecord[]
  },

  async takeTicket(id: string) {
    const response = await api.post(`/api/v1/support-tickets/${id}/take`)
    return response.data?.data as SupportTicketRecord
  },

  async assignTicket(
    id: string,
    data: string | { assignedStaffId: string; notes?: string; priority?: string }
  ) {
    const payload = typeof data === 'string'
      ? { assignedStaffId: data, staffId: data }
      : {
          assignedStaffId: data.assignedStaffId,
          staffId: data.assignedStaffId,
          notes: data.notes,
          priority: data.priority,
        }
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

  async resolveTicket(
    id: string,
    resolutionNote = 'Đã kiểm tra hiện trường và xử lý xong tại chỗ bởi nhân viên'
  ) {
    const response = await api.patch(`/api/v1/support-tickets/${id}/resolve`, null, {
      params: { resolutionNote },
    })
    return response.data?.data as SupportTicketRecord
  },

  async resolve(id: string, resolutionNote: string) {
    return this.resolveTicket(id, resolutionNote)
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

  async approveRefund(id: string, data: { refundAmount: number; note?: string }) {
    const response = await api.post(`/api/v1/support-tickets/${id}/approve-refund`, data)
    return response.data?.data as SupportTicketRecord
  },

  async submitBankInfo(id: string, data: { bankName: string; bankAccountNumber: string; bankAccountName: string; note?: string }) {
    const response = await api.post(`/api/v1/support-tickets/${id}/submit-bank-info`, data)
    return response.data?.data as SupportTicketRecord
  },

  async adminConfirmPayout(id: string, data: { transferTransactionRef: string; transferProofUrl: string; adminNotes?: string }) {
    const response = await api.post(`/api/v1/support-tickets/${id}/admin-confirm-payout`, data)
    return response.data?.data as SupportTicketRecord
  },

  async getContactLogs(ticketId: string) {
    const response = await api.get(`/api/v1/support-tickets/${ticketId}/contact-logs`)
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

  async getEscalationContacts() {
    const response = await api.get('/api/v1/support-tickets/escalation-contacts')
    return (response.data?.data || []) as EscalationContactResponse[]
  },

  async getStats(facilityId?: string) {
    const response = await api.get('/api/v1/support-tickets/stats', {
      params: facilityId ? { facilityId } : undefined,
    })
    return response.data?.data as SupportTicketStats
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
    const result = await this.uploadEvidence(file)
    return (result?.url || result || '') as string
  },
}
