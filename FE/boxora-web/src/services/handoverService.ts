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
}
