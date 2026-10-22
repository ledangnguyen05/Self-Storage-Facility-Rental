import { api } from '../lib/axios'
import { HandoverRecord } from '../types'

export interface HandoverPayload {
  bookingId: string
  staffId?: string
  recordType?: 'CHECK_IN' | 'RETURN'
  requestedUnitCode?: string
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

export interface HandoverPrerequisites {
  bookingId?: string
  bookingCode?: string
  customerName?: string
  customerPhone?: string
  unitCode?: string
  facilityName?: string
  depositSatisfied: boolean
  depositPaid?: number
  requiredDeposit?: number
  firstMonthRentSatisfied: boolean
  firstMonthRentPaid?: number
  requiredFirstMonthRent?: number
  contractSigned: boolean
  contractCode?: string
  contractStatus?: string
  identityVerified: boolean
  idCardNumber?: string
  eligibleForCheckIn: boolean
  missingPrerequisites?: string[]
}

export interface ReturnSettlementPreview {
  depositAmount: number
  totalDeductions: number
  netRefundAmount: number
  rentalEndDate: string
  isOverdue: boolean
}

export interface ReturnSettlementResponse {
  handoverId: string
  bookingId: string
  depositSettled: number
  deductionAmount: number
  refundAmount: number
  status: string
  settledAt: string
}

export const handoverService = {
  async getCheckInPrerequisites(bookingId: string) {
    const response = await api.get(`/api/v1/handovers/booking/${bookingId}/prerequisites`)
    return response.data?.data as HandoverPrerequisites
  },

<<<<<<< Updated upstream
  async checkIn(data: HandoverPayload) {
=======
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

  async checkIn(data: HandoverPayload & { requestedUnitCode: string }) {
>>>>>>> Stashed changes
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
}
