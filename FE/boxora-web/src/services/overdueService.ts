import { api } from '../lib/axios'

export interface OverdueSummary {
  asOfDate: string
  totalOverdueContracts: number
  totalOverdueDebt: number
  totalPrincipalDebt: number
  totalLateFees: number
  unverifiedPaymentsAmount: number
  unverifiedPaymentsCount: number
  graceCount: number
  warningCount: number
  pinThresholdCount: number
  sealingThresholdCount: number
  policyUnconfiguredCount: number
  pendingPinRevocationsCount: number
  pendingSealingApprovalsCount: number
}

export interface OverdueContractItem {
  contractId: string
  contractCode: string
  bookingId?: string
  bookingCode?: string
  unitId?: string
  unitCode: string
  facilityId?: string
  facilityName: string
  customerId?: string
  customerName: string
  customerPhone: string
  customerEmail: string
  startDate: string
  dueDate: string
  daysOverdue: number
  principalDebt: number
  dailyLateFee: number
  lateFee: number
  totalDebt: number
  unverifiedAmount: number
  stage: 'GRACE_PERIOD' | 'WARNING' | 'PIN_REVOCATION' | 'SEALING_ELIGIBLE' | 'POLICY_UNCONFIGURED'
  stageLabel: string
  pinStatus: 'PIN_ACTIVE' | 'PIN_ELIGIBLE' | 'PIN_REVOCATION_PENDING' | 'PIN_REVOKED' | 'PIN_REVOCATION_FAILED'
  sealingStatus: 'NONE' | 'SEALING_ELIGIBLE' | 'SEALING_REQUESTED' | 'SEALING_APPROVED' | 'SEALING_IN_PROGRESS' | 'SEALING_COMPLETED' | 'SEALING_REJECTED'
  smartLockOnlineStatus: 'ONLINE' | 'OFFLINE' | 'UNSTABLE'
  smartLockIsMock: boolean
  isDemo: boolean
  hasActivePolicy: boolean
  lastReminderSentAt?: string
  reminderCount: number
}

export interface OverdueContractDetail extends OverdueContractItem {
  depositHeld: number
  feeFormulaExplanation: string
  maskedPin: string
  smartLockLastUnlockedAt?: string
  tempPinGrantedUntil?: string
  tempPinGrantReason?: string
  policyWarning?: string
  payments: Array<{
    paymentId: string
    transactionId: string
    amount: number
    paymentType: string
    status: string
    paymentMethod: string
    paymentTime: string
    receiptVoucherCode?: string
  }>
  reminders: Array<{
    id: string
    channel: string
    templateType: string
    content: string
    sentByName: string
    sentAt: string
    deliveryStatus: string
    notes?: string
  }>
  pinRequests: Array<{
    id: string
    requestCode: string
    reason: string
    status: 'PENDING' | 'SUCCESS_MOCK' | 'SUCCESS_HARDWARE' | 'FAILED_OFFLINE' | 'FAILED_ERROR'
    isMock: boolean
    errorMessage?: string
    retryCount: number
    requestedByName: string
    requestedAt: string
    executedAt?: string
  }>
  sealingDossier?: {
    sealingRecordId: string
    protocolNumber: string
    sealTagNumber: string
    status: string
    requestStatus: string
    reason: string
    sealedAt: string
    sealedByName: string
    witnessName: string
    approvedByName?: string
    approvedAt?: string
    rejectionReason?: string
    inventorySummary?: string
    notes?: string
    items: Array<{
      id: string
      itemName: string
      quantity: number
      conditionStatus?: string
      estimatedValue: number
      notes?: string
    }>
  }
  auditLogs: Array<{
    id: string
    action: string
    performedByName: string
    performedByRole: string
    beforeState?: string
    afterState?: string
    details?: string
    createdAt: string
  }>
}

export interface SendReminderPayload {
  channel: 'SMS' | 'EMAIL' | 'CALL' | 'MULTI'
  templateType: 'REMINDER' | 'WARNING' | 'LOCKOUT_NOTICE' | 'SEAL_WARNING'
  content?: string
  notes?: string
}

export interface PinActionPayload {
  reason?: string
  simulateOffline?: boolean
}

export interface PinTempGrantPayload {
  hours: number
  reason: string
}

export interface SealingWorkflowPayload {
  action: 'REQUEST' | 'APPROVE' | 'REJECT' | 'COMPLETE'
  reason?: string
  rejectionReason?: string
  sealTagNumber?: string
  witnessId?: string
  photoEvidenceUrl?: string
  notes?: string
  inventoryItems?: Array<{
    itemName: string
    quantity: number
    conditionStatus?: string
    estimatedValue: number
    notes?: string
  }>
}

export const overdueService = {
  getSummary: async (facilityId?: string): Promise<OverdueSummary> => {
    const res = await api.get('/api/v1/overdue/summary', {
      params: { facilityId: facilityId && facilityId !== 'ALL' ? facilityId : undefined }
    })
    return res.data?.data || res.data
  },

  getContracts: async (params: {
    facilityId?: string
    stage?: string
    minDays?: number
    maxDays?: number
    pinStatus?: string
    sealingStatus?: string
    searchTerm?: string
    isDemo?: boolean
    page?: number
    size?: number
  }) => {
    const res = await api.get('/api/v1/overdue/contracts', {
      params: {
        facilityId: params.facilityId && params.facilityId !== 'ALL' ? params.facilityId : undefined,
        stage: params.stage || undefined,
        minDays: params.minDays,
        maxDays: params.maxDays,
        pinStatus: params.pinStatus || undefined,
        sealingStatus: params.sealingStatus || undefined,
        searchTerm: params.searchTerm || undefined,
        isDemo: params.isDemo,
        page: params.page ?? 0,
        size: params.size ?? 10
      }
    })
    return res.data?.data || res.data
  },

  getContractDetail: async (contractId: string): Promise<OverdueContractDetail> => {
    const res = await api.get(`/api/v1/overdue/contracts/${contractId}`)
    return res.data?.data || res.data
  },

  sendReminder: async (contractId: string, payload: SendReminderPayload): Promise<void> => {
    await api.post(`/api/v1/overdue/contracts/${contractId}/remind`, payload)
  },

  requestPinRevocation: async (contractId: string, payload?: PinActionPayload) => {
    const res = await api.post(`/api/v1/overdue/contracts/${contractId}/pin-revocation/request`, payload || {})
    return res.data?.data || res.data
  },

  executePinRevocation: async (contractId: string, payload?: PinActionPayload) => {
    const res = await api.post(`/api/v1/overdue/contracts/${contractId}/pin-revocation/execute`, payload || {})
    return res.data?.data || res.data
  },

  grantTemporaryPin: async (contractId: string, payload: PinTempGrantPayload): Promise<void> => {
    await api.post(`/api/v1/overdue/contracts/${contractId}/pin-temp-grant`, payload)
  },

  processSealingWorkflow: async (contractId: string, payload: SealingWorkflowPayload): Promise<void> => {
    await api.post(`/api/v1/overdue/contracts/${contractId}/sealing`, payload)
  },

  exportCsv: async (facilityId?: string, stage?: string, searchTerm?: string) => {
    const res = await api.get('/api/v1/overdue/export/csv', {
      params: {
        facilityId: facilityId && facilityId !== 'ALL' ? facilityId : undefined,
        stage: stage || undefined,
        searchTerm: searchTerm || undefined
      },
      responseType: 'blob'
    })
    const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `bao-cao-no-cuoc-qua-han-${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    link.remove()
  },

  // Legacy compatibility
  lockoutContract: async (contractId: string, reason?: string) => {
    const res = await api.post(`/api/v1/overdue/contracts/${contractId}/lockout`, { reason })
    return res.data?.data || res.data
  }
}
