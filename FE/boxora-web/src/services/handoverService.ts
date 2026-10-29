import { api } from '../lib/axios'
import { HandoverRecord } from '../types'

export interface HandoverPayload {
  bookingId: string
  requestedUnitCode?: string
  staffId?: string
  recordType?: 'CHECK_IN' | 'RETURN'
  idCardNumber?: string
  identityVerified?: boolean
  firstMonthRentConfirmed?: boolean
  contractConfirmed?: boolean
  earlyCheckInConfirmed?: boolean
  earlyCheckInReason?: string
  rfidCardNumber?: string
  accessPin?: string
  depositSettled?: number
  deductionAmount?: number
  doorConditionPassed?: boolean
  cleanlinessPassed?: boolean
  smartLockPassed?: boolean
  sensorPassed?: boolean
  wallStructurePassed?: boolean
  damageFee?: number
  cleaningFee?: number
  lostCardFee?: number
  overdueDebt?: number
  damageNotes?: string
  refundMethod?: string
  requiresAccountingReview?: boolean
  evidencePhotos?: string[]
  unitCondition?: string
  notes?: string
}

export interface PaymentRecordItem {
  id: string
  transactionId: string
  amount: number
  paymentType: 'DEPOSIT' | 'RENTAL_FEE' | string
  status: 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED' | 'REFUND_PENDING' | string
  paymentMethod: string
  paymentTime: string
  receiptVoucherCode?: string
  referenceCode?: string
  proofDocumentUrl?: string
  collectedByName?: string
  confirmedByName?: string
  confirmedAt?: string
  paymentNotes?: string
}

export interface HandoverPrerequisites {
  bookingId?: string
  bookingCode?: string
  customerName?: string
  customerPhone?: string
  customerEmail?: string
  unitCode?: string
  unitTypeName?: string
  areaSqMeters?: number
  facilityName?: string
  depositSatisfied: boolean
  depositPaid?: number
  requiredDeposit?: number
  depositRemaining?: number
  firstMonthRentSatisfied: boolean
  firstMonthRentPaid?: number
  requiredFirstMonthRent?: number
  firstMonthRentRemaining?: number
  contractSigned: boolean
  contractCode?: string
  contractStatus?: string
  contractSigningMethod?: string
  contractVerificationStatus?: string
  signedDocumentUrl?: string
  contractSignedAt?: string
  paperContractUrl?: string
  paperOriginalLocation?: string
  paperVerifiedByName?: string
  paperVerifiedAt?: string
  identityVerified: boolean
  idCardType?: string
  idCardNumber?: string
  registeredIdCardNumber?: string
  registeredIdCardType?: string
  identityVerifiedByName?: string
  identityVerifiedAt?: string
  checkInTimeMet?: boolean
  checkInTimeStatus?: 'BEFORE_DATE' | 'BEFORE_TIME' | 'ON_TIME' | 'LATE'
  checkInTimeMessage?: string
  expectedCheckInAt?: string
  eligibleForCheckIn: boolean
  eligibleForInspection: boolean
  missingPrerequisites?: string[]
  paymentHistory?: PaymentRecordItem[]
}

export interface ReturnSettlementPreview {
  depositAmount: number
  totalDeductions: number
  netRefundAmount: number
  rentalEndDate: string
  isOverdue: boolean
}

export interface ReturnSettlementResponse {
  handoverRecordId: string
  bookingId: string
  depositPaid: number
  totalDeduction: number
  netRefundAmount: number
  reviewStatus: string
  depositRefundSlaDays: number
  refundTransactionId?: string | null
  checklistAllPassed: boolean
  checklistSummary: string
  evidencePhotoCount: number
  evidencePhotos: string[]
  recordedAt: string
}

export interface PaperContractPayload {
  bookingId: string
  contractCode?: string
  paperContractUrl?: string
  paperOriginalLocation?: string
  notes?: string
}

export interface ManualPaymentPayload {
  bookingId: string
  paymentType: 'DEPOSIT' | 'RENTAL_FEE'
  paymentMethod: 'CASH' | 'BANK_TRANSFER'
  amount: number
  receiptVoucherCode?: string
  referenceCode?: string
  proofDocumentUrl?: string
  notes?: string
}

export interface IdentityVerifyPayload {
  idCardType?: string
  idCardNumber: string
  originalDocumentSeen: boolean
  notes?: string
}

export interface CheckInInspectionPayload {
  bookingId: string
  doorConditionPassed: boolean
  cleanlinessPassed: boolean
  smartLockPassed: boolean
  sensorPassed: boolean
  wallStructurePassed: boolean
  evidencePhotos: string[]
  unitCondition?: string
  notes?: string
}

export const handoverService = {
  async getCheckInPrerequisites(bookingId: string) {
    const response = await api.get(`/api/v1/handovers/booking/${bookingId}/prerequisites`)
    return response.data?.data as HandoverPrerequisites
  },

  async createOrUploadPaperContract(data: PaperContractPayload) {
    const response = await api.post('/api/v1/handovers/contracts/paper', data)
    return response.data?.data
  },

  async verifyPaperContract(bookingId: string, notes?: string) {
    const response = await api.post('/api/v1/handovers/contracts/paper/verify', null, {
      params: { bookingId, notes }
    })
    return response.data?.data
  },

  async recordManualPayment(data: ManualPaymentPayload) {
    const response = await api.post('/api/v1/handovers/payments/manual', data)
    return response.data?.data
  },

  async confirmBankTransferPayment(paymentId: string, notes?: string) {
    const response = await api.post(`/api/v1/handovers/payments/${paymentId}/confirm-bank-transfer`, null, {
      params: { notes }
    })
    return response.data?.data
  },

  async verifyIdentity(bookingId: string, data: IdentityVerifyPayload) {
    const response = await api.post(`/api/v1/handovers/booking/${bookingId}/verify-identity`, {
      ...data,
      bookingId
    })
    return response.data?.data as HandoverPrerequisites
  },

  async completeStep1(bookingId: string) {
    const response = await api.post(`/api/v1/handovers/booking/${bookingId}/complete-step-1`)
    return response.data?.data
  },

  async recordCheckInInspection(data: CheckInInspectionPayload) {
    const response = await api.post('/api/v1/handovers/check-in-inspection', data)
    return response.data?.data as HandoverRecord
  },

  async checkIn(data: HandoverPayload) {
    if (data.recordType === 'RETURN') {
      return this.processReturn(data)
    }
    const response = await api.post('/api/v1/handovers/check-in', data)
    return response.data?.data as HandoverRecord
  },

  async getReturnSettlementPreview(bookingId: string) {
    const response = await api.get(`/api/v1/handovers/booking/${bookingId}/return-preview`)
    return response.data?.data as ReturnSettlementPreview
  },

  async requestCheckout(bookingId: string, notes?: string) {
    const response = await api.post(`/api/v1/handovers/checkout-request/${bookingId}`, null, {
      params: { notes }
    })
    return response.data?.data as HandoverRecord
  },

  async performInspection(data: HandoverPayload) {
    const response = await api.post('/api/v1/handovers/inspection', data)
    return response.data?.data as HandoverRecord
  },

  async processReturn(data: HandoverPayload) {
    const response = await api.post('/api/v1/handovers/return', data)
    return response.data?.data as HandoverRecord
  },

  async processReturnSettlement(data: HandoverPayload) {
    const response = await api.post('/api/v1/handovers/return-settlement', data)
    return response.data?.data as ReturnSettlementResponse
  },

  async getByBookingId(bookingId: string) {
    const response = await api.get(`/api/v1/handovers/booking/${bookingId}`)
    return response.data?.data as HandoverRecord[]
  },

  async sendPinEmail(bookingId: string, customEmail?: string) {
    const response = await api.post(`/api/v1/handovers/booking/${bookingId}/send-pin-email`, null, {
      params: customEmail ? { customEmail } : undefined
    })
    return response.data
  },

  async sendWebNotification(bookingId: string) {
    const response = await api.post(`/api/v1/handovers/booking/${bookingId}/send-web-notification`)
    return response.data?.data
  },

  async uploadHandoverDocument(
    bookingId: string,
    file: File,
    documentType: 'PAPER_CONTRACT' | 'PAYMENT_PROOF' | 'CHECKIN_EVIDENCE' = 'PAPER_CONTRACT'
  ) {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('documentType', documentType)
    const response = await api.post(`/api/v1/handovers/booking/${bookingId}/upload-document`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
    return response.data?.data as {
      fileName: string
      fileUrl: string
      fileType: string
      fileSize: number
      uploadedAt: string
    }
  },

  async assignUnit(bookingId: string, unitCode: string): Promise<HandoverPrerequisites> {
    const response = await api.post(`/api/v1/handovers/booking/${bookingId}/assign-unit`, null, {
      params: { unitCode }
    })
    return response.data?.data as HandoverPrerequisites
  },

  async viewAuthorizedDocument(bookingId: string, fileUrl: string): Promise<string> {
    const response = await api.get(`/api/v1/handovers/booking/${bookingId}/documents/view`, {
      params: { fileUrl },
      responseType: 'blob'
    })
    const contentType = (response.headers['content-type'] as string) || 'application/pdf'
    const blob = new Blob([response.data], { type: contentType })
    return URL.createObjectURL(blob)
  },

  // =========================================================================
  // TOÀN DIỆN: QUY TRÌNH NGHIỆM THU HIỆN TRƯỜNG & TRẢ KHO (WAREHOUSE RETURN)
  // =========================================================================

  async getReturnCases(params?: {
    facilityId?: string
    search?: string
    status?: string
    dateFrom?: string
    dateTo?: string
  }): Promise<ReturnCase[]> {
    const cleanParams: Record<string, any> = {}
    if (params) {
      if (params.facilityId && params.facilityId !== 'ALL' && params.facilityId !== 'undefined' && params.facilityId !== 'null') {
        cleanParams.facilityId = params.facilityId
      }
      if (params.search && params.search.trim()) cleanParams.search = params.search.trim()
      if (params.status && params.status !== 'ALL') cleanParams.status = params.status
      if (params.dateFrom) cleanParams.dateFrom = params.dateFrom
      if (params.dateTo) cleanParams.dateTo = params.dateTo
    }
    const response = await api.get('/api/v1/handovers/returns', { params: cleanParams })
    return (response.data?.data || []) as ReturnCase[]
  },

  async getReturnCaseDetail(bookingId: string): Promise<ReturnCase> {
    const response = await api.get(`/api/v1/handovers/returns/${bookingId}`)
    return response.data?.data as ReturnCase
  },

  async scheduleInspection(bookingId: string, scheduledAt: string, notes?: string): Promise<HandoverRecord> {
    let cleanScheduledAt = scheduledAt
    if (scheduledAt) {
      const trimmed = scheduledAt.trim()
      const vnMatch = trimmed.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s+(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
      if (vnMatch) {
        const [, hour, min, day, month, year] = vnMatch
        cleanScheduledAt = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${hour.padStart(2, '0')}:${min}:00`
      } else {
        const vnMatch2 = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?::\d{2})?$/)
        if (vnMatch2) {
          const [, day, month, year, hour, min] = vnMatch2
          cleanScheduledAt = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${hour.padStart(2, '0')}:${min}:00`
        }
      }
    }
    const response = await api.post(`/api/v1/handovers/returns/${bookingId}/schedule`, null, {
      params: { scheduledAt: cleanScheduledAt, notes }
    })
    return response.data?.data as HandoverRecord
  },

  async startInspection(bookingId: string): Promise<HandoverRecord> {
    const response = await api.post(`/api/v1/handovers/returns/${bookingId}/start-inspection`)
    return response.data?.data as HandoverRecord
  },

  async saveReturnInspection(data: ReturnInspectionPayload): Promise<HandoverRecord> {
    const response = await api.post('/api/v1/handovers/returns/inspection', data)
    return response.data?.data as HandoverRecord
  },

  async calculateSettlement(bookingId: string, data?: Partial<ReturnInspectionPayload>): Promise<ReturnSettlementDetail> {
    const response = await api.post(`/api/v1/handovers/returns/${bookingId}/calculate-settlement`, data || {})
    return response.data?.data as ReturnSettlementDetail
  },

  async submitDeductionsForApproval(bookingId: string, notes?: string): Promise<HandoverRecord> {
    const response = await api.post(`/api/v1/handovers/returns/${bookingId}/submit-approval`, null, {
      params: { notes }
    })
    return response.data?.data as HandoverRecord
  },

  async approveSettlement(
    bookingId: string,
    data: { approvalAction: 'APPROVE' | 'REJECT'; approvedDeductionAmount?: number; notes?: string }
  ): Promise<ReturnSettlementDetail> {
    const response = await api.post(`/api/v1/handovers/returns/${bookingId}/approve-settlement`, data)
    return response.data?.data as ReturnSettlementDetail
  },

  async recordCustomerDispute(bookingId: string, disputeReason: string): Promise<HandoverRecord> {
    const response = await api.post(`/api/v1/handovers/returns/${bookingId}/dispute`, null, {
      params: { disputeReason }
    })
    return response.data?.data as HandoverRecord
  },

  async collectAdditionalPayment(
    bookingId: string,
    data: { additionalPaymentMethod?: string; additionalPaymentTxnRef?: string; notes?: string }
  ): Promise<any> {
    const response = await api.post(`/api/v1/handovers/returns/${bookingId}/collect-additional-payment`, data)
    return response.data?.data
  },

  async executeRefund(
    bookingId: string,
    data: { refundMethod?: string; notes?: string }
  ): Promise<ReturnSettlementDetail> {
    const response = await api.post(`/api/v1/handovers/returns/${bookingId}/execute-refund`, data)
    return response.data?.data as ReturnSettlementDetail
  },

  async confirmPhysicalReturn(bookingId: string, data?: { notes?: string }): Promise<HandoverRecord> {
    const response = await api.post(`/api/v1/handovers/returns/${bookingId}/confirm-physical-return`, data || {})
    return response.data?.data as HandoverRecord
  },

  async revokeAccess(bookingId: string): Promise<HandoverRecord> {
    const response = await api.post(`/api/v1/handovers/returns/${bookingId}/revoke-access`)
    return response.data?.data as HandoverRecord
  },

  async completeReturn(bookingId: string): Promise<ReturnSettlementDetail> {
    const response = await api.post(`/api/v1/handovers/returns/${bookingId}/complete`)
    return response.data?.data as ReturnSettlementDetail
  },

  async confirmSettlement(bookingId: string, data?: { notes?: string }): Promise<ReturnSettlementDetail> {
    const response = await api.post(`/api/v1/handovers/returns/${bookingId}/confirm-settlement`, data || {})
    return response.data?.data as ReturnSettlementDetail
  },

  async submitCustomerDecision(
    bookingId: string,
    data: {
      decision: 'AGREED' | 'DISPUTED'
      disputeReason?: string
      disputeEvidenceUrls?: string[]
      bankName?: string
      bankAccountNumber?: string
      bankAccountName?: string
    }
  ): Promise<ReturnSettlementDetail> {
    const response = await api.post(`/api/v1/handovers/returns/${bookingId}/customer-decision`, data)
    return response.data?.data as ReturnSettlementDetail
  },

  async resolveDispute(
    bookingId: string,
    data: {
      action: 'ADJUST_SETTLEMENT' | 'UPHOLD_SETTLEMENT'
      resolutionNote: string
      doorFee?: number
      cleaningFee?: number
      damageFee?: number
      smartLockFee?: number
      wallStructureFee?: number
      lostCardFee?: number
    }
  ): Promise<ReturnSettlementDetail> {
    const response = await api.post(`/api/v1/handovers/returns/${bookingId}/resolve-dispute`, data)
    return response.data?.data as ReturnSettlementDetail
  },

  async executePayout(
    bookingId: string,
    data: { transactionRef: string; proofDocumentUrl?: string; notes?: string }
  ): Promise<ReturnSettlementDetail> {
    const response = await api.post(`/api/v1/handovers/returns/${bookingId}/payout`, data)
    return response.data?.data as ReturnSettlementDetail
  },
}

export interface ReturnCase {
  id: string
  bookingId: string
  bookingCode: string
  contractCode?: string
  unitCode: string
  customerName: string
  customerPhone?: string
  customerEmail?: string
  facilityId?: string
  facilityName?: string
  requestDate?: string
  expectedReturnDate?: string
  inspectionDate?: string
  reason?: string
  bankName?: string
  bankAccountNumber?: string
  bankAccountName?: string
  depositAmount: number
  outstandingDebt?: number
  cleaningFee?: number
  damageFee?: number
  doorFee?: number
  smartLockFee?: number
  wallStructureFee?: number
  lostCardFee?: number
  totalDeduction?: number
  approvedDeductions?: number
  netRefundAmount?: number
  additionalAmountDue?: number
  status: string
  inspectionStatus: string
  approvalStatus: string
  additionalPaymentStatus?: string
  additionalPaymentTxnRef?: string
  refundStatus?: string
  settlementVersion?: number
  settlementConfirmed?: boolean
  settlementConfirmedByName?: string
  settlementConfirmedAt?: string
  customerDecision?: string
  customerDecisionAt?: string
  disputeEvidenceUrls?: string[]
  disputeResolvedByName?: string
  disputeResolvedAt?: string
  disputeResolutionNote?: string
  refundRequestId?: string
  refundTxnRef?: string
  refundProcessedAt?: string
  inspectorName?: string
  approverName?: string
  approvedAt?: string
  approvalNotes?: string
  completedAt?: string
  historyNotes?: string[]
  disputeReason?: string

  // 7 Checklist Criteria
  doorPassed?: boolean | null
  doorNotes?: string
  doorFeeInput?: number

  cleanlinessPassed?: boolean | null
  cleanlinessNotes?: string
  cleaningFeeInput?: number

  damagePassed?: boolean | null
  damageNotes?: string
  damageFeeInput?: number

  smartLockPassed?: boolean | null
  smartLockNotes?: string
  smartLockFeeInput?: number
  smartLockIssueType?: string

  assetsClearedPassed?: boolean | null
  assetsClearedNotes?: string

  photoUrls?: string[]

  envPassed?: boolean | null
  envNotes?: string

  unitReturnedPhysically?: boolean
  returnedAt?: string
  accessRevoked?: boolean
  accessRevokedAt?: string
  postReturnUnitStatus?: string
}

export interface ReturnSettlementDetail {
  handoverRecordId?: string
  bookingId: string
  bookingCode: string
  unitCode: string
  customerName: string
  depositPaid: number
  damageFee: number
  cleaningFee: number
  lostCardFee: number
  doorFee: number
  smartLockFee: number
  smartLockIssueType?: string
  wallStructureFee: number
  overdueDebt: number
  totalDeduction: number
  approvedDeductions: number
  netRefundAmount: number
  additionalAmountDue: number
  reviewStatus: string
  approvalStatus: string
  approverName?: string
  approvedAt?: string
  approvalNotes?: string
  additionalPaymentStatus?: string
  additionalPaymentTxnRef?: string
  refundStatus?: string
  refundTransactionId?: string
  depositRefundSlaDays: number
  settlementVersion?: number
  settlementConfirmed?: boolean
  settlementConfirmedByName?: string
  settlementConfirmedAt?: string
  customerDecision?: string
  customerDecisionAt?: string
  disputeEvidenceUrls?: string[]
  disputeResolvedByName?: string
  disputeResolvedAt?: string
  disputeResolutionNote?: string
  refundRequestId?: string
  bankName?: string
  bankAccountNumber?: string
  bankAccountName?: string
  checklistAllPassed: boolean
  checklistSummary?: string
  doorConditionPassed?: boolean
  cleanlinessPassed?: boolean
  wallStructurePassed?: boolean
  smartLockPassed?: boolean
  assetsClearedPassed?: boolean
  sensorPassed?: boolean
  unitReturnedPhysically?: boolean
  returnedAt?: string
  accessRevoked?: boolean
  accessRevokedAt?: string
}

export interface ReturnInspectionPayload {
  bookingId: string
  isDraft?: boolean
  doorConditionPassed?: boolean
  doorFee?: number
  doorNotes?: string
  cleanlinessPassed?: boolean
  cleaningFee?: number
  cleanlinessNotes?: string
  wallStructurePassed?: boolean
  damageFee?: number
  damageNotes?: string
  smartLockPassed?: boolean
  smartLockFee?: number
  smartLockNotes?: string
  smartLockIssueType?: string
  assetsClearedPassed?: boolean
  assetsClearedNotes?: string
  sensorPassed?: boolean
  sensorNotes?: string
  lostCardFee?: number
  evidencePhotos?: string[]
  notes?: string
}
