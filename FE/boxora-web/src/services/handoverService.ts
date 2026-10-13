import { api } from '../lib/axios'
import { HandoverRecord } from '../types'

export interface HandoverPayload {
  bookingId: string
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

export interface HandoverPrerequisites {
  depositPaid: boolean
  firstMonthRentPaid: boolean
  contractSigned: boolean
  identityVerified: boolean
  canCheckIn: boolean
  bookingCode?: string
  customerName?: string
  unitCode?: string
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

  async checkIn(data: HandoverPayload) {
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
