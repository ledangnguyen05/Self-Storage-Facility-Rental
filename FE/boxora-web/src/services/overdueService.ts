import { api } from '../lib/axios'
import { downloadCsv } from '../utils/exportUtils'

export interface OverdueSummary {
  asOfDate: string
  totalOverdueContracts: number
  totalOverdueDebt: number
  totalPrincipalDebt: number
  totalLateFees: number
  totalCustomerRefundAmount?: number
  totalDepositHeld?: number
  unverifiedPaymentsAmount: number
  unverifiedPaymentsCount: number
  graceCount: number
  warningCount: number
  pinThresholdCount: number
  sealingThresholdCount: number
  policyUnconfiguredCount: number
  pendingPinRevocationsCount: number
  pendingSealingApprovalsCount: number
  eligibleLiquidationReleaseCount?: number
  settledCount?: number
}

export interface OverdueContractItem {
  contractId: string
  contractCode: string
  bookingId?: string
  bookingCode?: string
  unitId?: string
  unitCode: string
  unitTypeName?: string
  monthlyFee?: number
  dailyRentalPrice?: number
  lateFeePercentage?: number
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
  customerRefundAmount?: number
  depositHeld?: number
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
  contractStatus?: string
  isSettled?: boolean
  settledAt?: string
  settledByName?: string
}

export interface OverdueContractDetail extends OverdueContractItem {
  depositHeld: number
  feeFormulaExplanation: string
  maskedPin: string
  tempAccessPin?: string
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
    photoEvidenceUrl?: string
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
  channel: 'SMS' | 'EMAIL' | 'CALL' | 'MULTI' | 'WEB'
  templateType: 'REMINDER' | 'WARNING' | 'LOCKOUT_NOTICE' | 'SEAL_WARNING' | 'LIQUIDATION_HOLDING_WARNING' | string
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
  action: 'REQUEST' | 'APPROVE' | 'REJECT' | 'INVENTORY' | 'COMPLETE'
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

export interface OverdueSettlementPayload {
  paymentMethod?: 'CASH' | 'BANK_TRANSFER'
  receiptVoucherCode?: string
  referenceCode?: string
  proofDocumentUrl?: string
  amount?: number
  notes?: string
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

  exportCsv: async (params?: {
    facilityId?: string
    stage?: string
    pinStatus?: string
    sealingStatus?: string
    searchTerm?: string
  } | string, stageArg?: string, searchTermArg?: string) => {
    let facilityId: string | undefined
    let stage: string | undefined
    let pinStatus: string | undefined
    let sealingStatus: string | undefined
    let searchTerm: string | undefined

    if (typeof params === 'object' && params !== null) {
      facilityId = params.facilityId
      stage = params.stage
      pinStatus = params.pinStatus
      sealingStatus = params.sealingStatus
      searchTerm = params.searchTerm
    } else {
      facilityId = params
      stage = stageArg
      searchTerm = searchTermArg
    }

    const res = await api.get('/api/v1/overdue/export/csv', {
      params: {
        facilityId: facilityId && facilityId !== 'ALL' ? facilityId : undefined,
        stage: stage && stage !== 'ALL' ? stage : undefined,
        pinStatus: pinStatus && pinStatus !== 'ALL' ? pinStatus : undefined,
        sealingStatus: sealingStatus && sealingStatus !== 'ALL' ? sealingStatus : undefined,
        searchTerm: searchTerm?.trim() || undefined
      },
      responseType: 'blob',
      skipCache: true,
      skipDedup: true,
    } as any)

    let csvText = ''
    if (res.data instanceof Blob) {
      csvText = await res.data.text()
    } else if (typeof res.data === 'string') {
      csvText = res.data
    } else {
      csvText = new TextDecoder('utf-8').decode(new Uint8Array(res.data))
    }

    downloadCsv(`bao-cao-no-cuoc-qua-han-${new Date().toISOString().slice(0, 10)}.csv`, csvText)
  },

  completeSettlement: async (contractId: string, payload?: OverdueSettlementPayload): Promise<void> => {
    await api.post(`/api/v1/overdue/contracts/${contractId}/complete-settlement`, payload)
  },

  liquidateReleaseStorageUnit: async (contractId: string, payload?: { liquidationAmount?: number; notes?: string }): Promise<void> => {
    await api.post(`/api/v1/overdue/contracts/${contractId}/liquidate-release`, payload)
  },

  // Legacy compatibility
  lockoutContract: async (contractId: string, reason?: string) => {
    const res = await api.post(`/api/v1/overdue/contracts/${contractId}/lockout`, { reason })
    return res.data?.data || res.data
  }
}
