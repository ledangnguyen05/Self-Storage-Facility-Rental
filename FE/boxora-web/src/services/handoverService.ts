import { api } from '../lib/axios'
import type { Booking, BookingStatusType, FileUploadResponse, HandoverRecord, RentalContract, RequestOptions } from '../types'

export interface HandoverPayload {
  bookingId: string
  staffId?: string
  recordType?: 'CHECK_IN' | 'RETURN'
  /** CCCD or PASSPORT. Defaults to the type verified at the desk. */
  idCardType?: string
  idCardNumber?: string
  identityVerified?: boolean
  firstMonthRentConfirmed?: boolean
  contractConfirmed?: boolean
  rfidCardNumber?: string
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
  /** What was found wrong at the inspection. It never changes where the unit goes: only fees and failed checks do. */
  damageNotes?: string
  /** Why money is deducted from the deposit. Required unless the only deduction is the policy late fee. */
  deductionReason?: string
  /** VNPAY_REFUND, BANK_TRANSFER or CASH. */
  refundMethod?: string
  /** Required by the backend when refundMethod is BANK_TRANSFER. */
  refundBankName?: string
  refundBankAccountNumber?: string
  refundBankAccountName?: string
  requiresAccountingReview?: boolean
  /** Urls returned by `uploadEvidence` (never base64). */
  evidencePhotos?: string[]
  unitCondition?: string
  notes?: string
}

export interface PaymentRecordItem {
  id: string
  transactionId: string
  amount: number
  /** Part of `amount` that is deposit; set on an online BOOKING_PAYMENT, which pays deposit and first month together. */
  depositPortion?: number
  paymentType: 'DEPOSIT' | 'RENTAL_FEE' | 'BOOKING_PAYMENT' | string
  status: 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED' | 'REFUND_PENDING' | string
  paymentMethod: string
  paymentTime: string
  receiptVoucherCode?: string
  referenceCode?: string
  /** Uploaded file url (`/uploads/handover/...`). */
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
  paperContractUrl?: string
  paperOriginalLocation?: string
  paperVerifiedByName?: string
  paperVerifiedAt?: string
  identityVerified: boolean
  idCardType?: string
  /** Null until staff verified the document: it is never prefilled from the customer's phone. */
  idCardNumber?: string | null
  identityVerifiedByName?: string
  identityVerifiedAt?: string
  eligibleForCheckIn: boolean
  eligibleForInspection: boolean
  missingPrerequisites?: string[]
  paymentHistory?: PaymentRecordItem[]
}

/** `GET /handovers/booking/{id}/return-preview` (`ReturnSettlementPreviewResponse`). */
export interface ReturnSettlementPreview {
  bookingId?: string
  bookingCode?: string
  customerName?: string
  customerPhone?: string
  unitCode?: string
  facilityName?: string
  contractCode?: string
  contractStatus?: string
  bookingStatus?: string
  rentalEndDate?: string
  actualReturnDate?: string
  overdueDays?: number
  overdueGraceDays?: number
  depositPaid?: number
  dailyLateFee?: number
  /** The one overdue rule of the facility policy; staff may lower it but never raise it. */
  calculatedOverdueLateFee?: number
  depositRefundSlaDays?: number
  recommendedReviewStatus?: string
  checklistStandardItems?: string[]
}

/** `POST /handovers/return-settlement` (`ReturnSettlementResponse`). */
export interface ReturnSettlementResponse {
  handoverRecordId: string
  bookingId?: string
  bookingCode?: string
  unitCode?: string
  customerName?: string
  staffName?: string
  depositPaid: number
  damageFee?: number
  cleaningFee?: number
  lostCardFee?: number
  overdueDebt?: number
  totalDeduction: number
  netRefundAmount: number
  /** PENDING_ACCOUNTING_REVIEW or AUTO_REFUND_APPROVED. */
  reviewStatus: string
  depositRefundSlaDays?: number
  refundTransactionId?: string | null
  refundRequestId?: string | null
  refundRequestCode?: string | null
  refundMethod?: string
  /** Amount the customer still owes when deductions exceeded the deposit (0 when none). */
  customerDebtAmount?: number
  customerDebtId?: string | null
  checklistAllPassed?: boolean
  checklistSummary?: string
  evidencePhotoCount?: number
  evidencePhotos?: string[]
  recordedAt?: string
  notes?: string
}

export interface PaperContractPayload {
  bookingId: string
  contractCode?: string
  /** Url returned by `uploadEvidence`. */
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
  /** Url returned by `uploadEvidence`; required for BANK_TRANSFER. */
  proofDocumentUrl?: string
  notes?: string
}

export interface IdentityVerifyPayload {
  idCardType?: string
  idCardNumber: string
  notes?: string
}

export interface CheckInInspectionPayload {
  bookingId: string
  doorConditionPassed: boolean
  cleanlinessPassed: boolean
  smartLockPassed: boolean
  sensorPassed: boolean
  wallStructurePassed: boolean
  /** Urls returned by `uploadEvidence`; at least two. */
  evidencePhotos: string[]
  unitCondition?: string
  notes?: string
}

export interface CustomerDebt {
  id: string
  customerId?: string
  customerName?: string
  customerPhone?: string
  bookingId?: string
  bookingCode?: string
  unitCode?: string
  facilityId?: string
  facilityName?: string
  amount: number
  reason: string
  status: 'OPEN' | 'COLLECTED' | 'WRITTEN_OFF' | string
  createdByName?: string
  createdAt?: string
  resolvedByName?: string
  resolvedAt?: string
  resolutionNote?: string
}

/** Shape of `GET /handovers/lookup` (`HandoverLookupResponse`, mirrors BookingResponse). */
interface RawLookup {
  id: string
  bookingCode: string
  customerId?: string
  customerName?: string
  customerPhone?: string
  customerEmail?: string
  storageUnitId?: string
  unitCode?: string
  floorLevel?: string
  facilityId?: string
  facilityName?: string
  startDate?: string
  endDate?: string
  rentalMonths?: number
  totalRentalFee?: number
  depositPaid?: number
  depositAmount?: number
  paymentStatus?: string
  status?: string
  expectedCheckInAt?: string | null
  signingMethod?: string
  checkedIn?: boolean
}

const toLookupBooking = (raw: RawLookup): Booking => ({
  id: raw.id,
  bookingCode: raw.bookingCode,
  customerId: raw.customerId ?? '',
  customerName: raw.customerName ?? '',
  customerEmail: raw.customerEmail ?? '',
  customerPhone: raw.customerPhone ?? '',
  storageUnitId: raw.storageUnitId ?? '',
  unitCode: raw.unitCode ?? '',
  facilityId: raw.facilityId,
  facilityName: raw.facilityName ?? '',
  floorLevel: raw.floorLevel,
  startDate: raw.startDate ?? '',
  endDate: raw.endDate ?? '',
  rentalMonths: raw.rentalMonths ?? 0,
  totalRentalFee: raw.totalRentalFee ?? 0,
  depositPaid: raw.depositPaid ?? 0,
  depositAmount: raw.depositAmount,
  paymentStatus: raw.paymentStatus,
  status: (raw.status ?? 'CONFIRMED') as BookingStatusType,
  accessCode: '',
  expectedCheckInAt: raw.expectedCheckInAt ?? null,
  signingMethod: raw.signingMethod === 'IN_PERSON' ? 'IN_PERSON' : 'ONLINE',
})

export const handoverService = {
  async getCheckInPrerequisites(bookingId: string, opts?: RequestOptions) {
    const response = await api.get(`/api/v1/handovers/booking/${bookingId}/prerequisites`, { signal: opts?.signal })
    return response.data?.data as HandoverPrerequisites
  },

  /**
   * Uploads one photo or scan (JPG, PNG, WEBP or PDF, up to 10 MB). Send the returned `fileUrl` in the other
   * handover calls; base64 data is rejected by the backend.
   */
  async uploadEvidence(file: File | Blob, bookingId?: string): Promise<FileUploadResponse> {
    const formData = new FormData()
    formData.append('file', file)
    if (bookingId) formData.append('bookingId', bookingId)
    const response = await api.post('/api/v1/handovers/uploads', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return response.data?.data as FileUploadResponse
  },

  /**
   * Resolves a QR payload (`BOXORA-CHECKIN:<code>`), a booking code or a booking id within the staff member's
   * facility. 404 when nothing matches, 403 when the booking belongs to another facility.
   */
  async lookupBooking(code: string, opts?: RequestOptions): Promise<Booking> {
    const response = await api.get('/api/v1/handovers/lookup', { params: { code }, signal: opts?.signal })
    return toLookupBooking(response.data?.data as RawLookup)
  },

  async createOrUploadPaperContract(data: PaperContractPayload) {
    const response = await api.post('/api/v1/handovers/contracts/paper', data)
    return response.data?.data as RentalContract
  },

  async verifyPaperContract(bookingId: string, notes?: string) {
    const response = await api.post('/api/v1/handovers/contracts/paper/verify', null, {
      params: { bookingId, notes },
    })
    return response.data?.data as RentalContract
  },

  async recordManualPayment(data: ManualPaymentPayload) {
    const response = await api.post('/api/v1/handovers/payments/manual', data)
    return response.data?.data as PaymentRecordItem
  },

  async confirmBankTransferPayment(paymentId: string, notes?: string) {
    const response = await api.post(`/api/v1/handovers/payments/${paymentId}/confirm-bank-transfer`, null, {
      params: { notes },
    })
    return response.data?.data as PaymentRecordItem
  },

  async verifyIdentity(bookingId: string, data: IdentityVerifyPayload) {
    const response = await api.post(`/api/v1/handovers/booking/${bookingId}/verify-identity`, {
      ...data,
      bookingId,
    })
    return response.data?.data as HandoverPrerequisites
  },

  async completeStep1(bookingId: string): Promise<void> {
    await api.post(`/api/v1/handovers/booking/${bookingId}/complete-step-1`)
  },

  async recordCheckInInspection(data: CheckInInspectionPayload) {
    const response = await api.post('/api/v1/handovers/check-in-inspection', data)
    return response.data?.data as HandoverRecord
  },

  /**
   * The response is the only place the plain PIN appears (once). The PIN email is sent in the background after the
   * handover is saved: `emailQueued` says it was handed to the mail queue, `emailError` why it was not (no address,
   * no mail server). Use `sendPinEmail` to resend and learn the real outcome.
   */
  async checkIn(data: HandoverPayload) {
    const response = await api.post('/api/v1/handovers/check-in', data)
    return response.data?.data as HandoverRecord
  },

  async getReturnSettlementPreview(bookingId: string, opts?: RequestOptions) {
    const response = await api.get(`/api/v1/handovers/booking/${bookingId}/return-preview`, { signal: opts?.signal })
    return response.data?.data as ReturnSettlementPreview
  },

  async requestCheckout(bookingId: string, notes?: string) {
    const response = await api.post(`/api/v1/handovers/checkout-request/${bookingId}`, null, {
      params: { notes },
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

  /** History of a booking's handover records. Never contains the PIN. */
  async getByBookingId(bookingId: string, opts?: RequestOptions) {
    const response = await api.get(`/api/v1/handovers/booking/${bookingId}`, { signal: opts?.signal })
    return (response.data?.data ?? []) as HandoverRecord[]
  },

  /** Re-sends the PIN to the email on the customer's profile. Resolves to that address once the mail server accepted it. */
  async sendPinEmail(bookingId: string): Promise<string> {
    const response = await api.post(`/api/v1/handovers/booking/${bookingId}/send-pin-email`)
    return String(response.data?.data ?? '')
  },

  async getCustomerDebts(params?: { facilityId?: string; status?: string }, opts?: RequestOptions) {
    const response = await api.get('/api/v1/handovers/customer-debts', { params, signal: opts?.signal })
    return (response.data?.data ?? []) as CustomerDebt[]
  },

  async resolveCustomerDebt(debtId: string, status: 'COLLECTED' | 'WRITTEN_OFF', note: string) {
    const response = await api.post(`/api/v1/handovers/customer-debts/${debtId}/resolve`, { status, note })
    return response.data?.data as CustomerDebt
  },
}
