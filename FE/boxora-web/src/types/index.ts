export type { PageResult, ApiResponse, ApiErrorBody, FileUploadResponse, RequestOptions } from './api'

export type RoleType = 'ADMIN' | 'FACILITY_MANAGER' | 'BUSINESS_MANAGER' | 'STAFF' | 'CUSTOMER'

export interface User {
  id: string
  username: string
  email: string
  fullName?: string
  phone?: string
  avatar?: string
  role?: {
    id?: string
    name: RoleType
    description?: string
  }
  roleName?: RoleType | string
  roleId?: string
  facilityId?: string
  facilityName?: string
  facilityCode?: string
  isActive?: boolean
  createdAt?: string
  updatedAt?: string
}

export interface Facility {
  id: string
  name: string
  address: string
  city: string
  contactPhone: string
  totalUnits: number
  availableUnits: number
  imageUrl?: string
  code?: string
  openTime?: string
  closeTime?: string
  latitude?: number | null
  longitude?: number | null
  layoutConfig?: string | null
  description?: string
  email?: string
  status?: string
}

export interface FacilityLayoutConfig {
  title: string
  floor1Name: string
  floor2Name: string
  zoneAName: string
  zoneADesc: string
  zoneBName: string
  zoneBDesc: string
  zoneCName: string
  zoneCDesc: string
  loadingBayFloor1: string
  corridorNorth: string
  exitFloor1: string
  loadingBayFloor2: string
  corridorClimate: string
  exitFloor2: string
  totalAreaFloor1: string
  totalAreaFloor2: string
}

export interface UnitType {
  id: string
  typeName: string
  dimensions: string // e.g. "1.5m x 2m x 2.5m"
  areaSqm: number // e.g. 3.0
  basePricePerMonth: number // e.g. 1200000
  depositAmount: number // e.g. 1200000
  description?: string
  suitableFor?: string
  activeUnitsCount?: number
  /** Lowest price listed on an available unit of this type (facility price lists included); null when sold out. */
  lowestListedPrice?: number | null
}

export interface UnitTypePriceAdjustmentRequest {
  newPrice: number
  reason: string
  effectiveFrom?: string
  cascadeToAvailableUnits?: boolean
}

export interface StorageUnitPriceHistory {
  id: string
  storageUnitId?: string
  unitCode?: string
  unitTypeId?: string
  unitTypeName?: string
  oldPrice: number
  newPrice: number
  effectiveFrom: string
  reason: string
  changedById?: string
  changedByName?: string
  createdAt?: string
}

export type UnitStatusType = 'AVAILABLE' | 'RESERVED' | 'OCCUPIED' | 'MAINTENANCE' | 'UNDER_MAINTENANCE' | 'OVERDUE_LOCKED'

export interface StorageUnit {
  id: string
  unitCode: string // e.g. "A-102"
  floorLevel: string // e.g. "Floor 1"
  status: UnitStatusType
  facilityId: string
  facilityName: string
  unitTypeId: string
  unitTypeName: string
  pricePerMonth: number
  depositAmount?: number
  areaSqMeters?: number
  /**
   * Not sent by the backend any more: there is no smart-lock integration yet, so these were invented values
   * ("98%", "SL-<code>"). Kept optional only so older screens still compile; never render them as real data.
   * @deprecated hide the rows that read them.
   */
  batteryLevel?: string
  /** @deprecated see `batteryLevel`. */
  smartLockSerial?: string
  /** @deprecated see `batteryLevel`. */
  lastAccessTime?: string
  /**
   * Tenant fields are only filled for internal roles (staff, managers, admin); anonymous visitors and
   * customers get `undefined`.
   */
  tenantName?: string
  /** Only when a contract exists; never a booking code. */
  contractCode?: string
  contractId?: string
  bookingId?: string
  bookingCode?: string
  startDate?: string
  dueDate?: string
}

export type BookingStatusType =
  | 'PENDING_APPROVAL'
  | 'PENDING_PAYMENT'
  | 'CONFIRMED'
  | 'ACTIVE'
  | 'CHECKOUT_REQUESTED'
  | 'INSPECTED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'OVERDUE'

export interface Booking {
  id: string
  bookingCode: string
  customerId: string
  customerName: string
  customerEmail: string
  customerPhone: string
  storageUnitId: string
  /** Same value as storageUnitId. */
  unitId?: string
  unitCode: string
  facilityId?: string
  facilityName: string
  floorLevel?: string
  startDate: string
  endDate: string
  rentalMonths: number
  totalRentalFee: number
  depositPaid: number
  depositAmount?: number
  initialPaymentAmount?: number
  /** What is still owed of the initial payment after the payments already received (0 once settled). */
  initialPaymentDue?: number
  paymentExpiresAt?: string | null
  holdStartedAt?: string | null
  holdExpiresAt?: string | null
  expectedCheckInAt?: string | null
  checkInTime?: string | null
  /** REFUND_PENDING / REFUNDED: a cancelled booking whose money is being / has been returned. */
  paymentStatus?: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | 'REFUND_PENDING' | 'REFUNDED' | string
  holdGraceHours?: number
  status: BookingStatusType
  accessCode: string // e.g. "BX-88219"
  accessPin?: string | null
  qrAccessToken?: string | null
  handoverTime?: string
  returnTime?: string
  signingMethod?: 'ONLINE' | 'IN_PERSON'
  assignedStaffId?: string | null
  assignedStaffName?: string | null
  staffAssignmentNotes?: string | null
  cancellationReason?: string | null
  cancelledAt?: string | null
  createdAt?: string | null
}

export interface BookingCancellationPreview {
  bookingId: string
  bookingCode: string
  unitCode?: string
  startDate: string
  checkInDateTime?: string
  depositPaid: number
  totalRentalFee: number
  hoursUntilCheckin: number
  timeRemainingLabel?: string
  milestoneStage: 'STAGE_1_FULL_REFUND' | 'STAGE_2_PARTIAL_REFUND' | 'STAGE_3_NO_REFUND' | 'STAGE_PENDING_NO_PAYMENT' | string
  refundPercentage: number
  refundAmount: number
  penaltyAmount: number
  policyDescription: string
  refundable: boolean
  /** Deposit part refunded by the cancellation milestone. */
  depositRefundAmount?: number
  /** Rent paid in advance for a period that never started (always refunded in full). */
  prepaidRentAmount?: number
  refundSlaDays?: number | null
}

export interface BookingCancelResponse {
  bookingId: string
  bookingCode: string
  status: BookingStatusType
  milestoneStage: string
  refundPercentage: number
  refundAmount: number
  penaltyAmount: number
  refundTransactionId?: string
  refundRequestId?: string
  refundRequestCode?: string
  /** The refund request still needs the customer's bank account. */
  bankInfoMissing?: boolean
  prepaidRentAmount?: number
  refundSlaDays?: number | null
  unitReleased: boolean
  cancelledAt: string
  cancellationReason?: string
  message: string
}

export interface BookingRescheduleEligibility {
  bookingId: string
  bookingCode: string
  unitCode: string | null
  facilityName: string | null
  eligible: boolean
  reasonIfNotEligible: string | null
  restrictions: string[]
  currentAppointmentAt: string
  expectedStartDate: string
  expectedEndDate: string
  rentalMonths: number
  monthlyFee: number
  depositAmount: number
  paymentStatus: string
  contractStatus: string
  contractSigned: boolean
  holdExpiresAt: string | null
  allowedMinDate: string
  allowedMaxDate: string
  facilityOpenTime: string
  facilityCloseTime: string
}

export interface BookingRescheduleHistory {
  id: string
  bookingId: string
  bookingCode: string
  changeType: string
  previousAppointmentAt: string
  requestedAppointmentAt: string
  acceptedAppointmentAt: string
  previousExpectedStartDate: string
  previousExpectedEndDate: string
  newExpectedStartDate: string
  newExpectedEndDate: string
  previousHoldExpiresAt: string | null
  newHoldExpiresAt: string | null
  requesterId: string | null
  requesterName: string
  requesterRole: string
  requestTimestamp: string
  reason: string | null
  processorId: string | null
  processorName: string
  processorRole: string
  processedAt: string
  outcome: string
  rejectionReason: string | null
  previousBookingStatus: string
  resultingBookingStatus: string
  contractAmendmentRequired: boolean
  contractAmendmentNotes: string | null
  createdAt: string
}

export interface BookingRescheduleResponse {
  booking: Booking
  historyRecord: BookingRescheduleHistory
  message: string
}

export type RentalContractStatus =
  | 'DRAFT'
  | 'PENDING_SIGNATURE'
  | 'PENDING_VERIFICATION'
  | 'PENDING_ACTIVATION'
  | 'ACTIVE'
  | 'OVERDUE'
  | 'OVERDUE_LOCKED'
  | 'EXPIRED'
  | 'TERMINATED'
  | 'CANCELLED'

export interface RentalContract {
  id: string
  contractCode: string
  customerId: string
  customerEmail: string
  customerName?: string
  customerPhone?: string
  bookingId?: string
  bookingCode?: string | null
  bookingStatus?: BookingStatusType | null
  /** Months of the booked term. */
  rentalMonths?: number | null
  /** Storage unit UUID (`unitId` is the same value). */
  storageUnitId?: string
  unitId?: string
  facilityId?: string
  unitCode: string
  facilityName: string
  startDate: string
  endDate: string
  /** Discounted monthly rent of the quote. */
  monthlyFee: number
  /** Deposit actually collected. */
  depositHeld: number
  /** Deposit agreed in the booking (quote); can be higher than depositHeld before the counter payment. */
  depositAmount?: number | null
  status: RentalContractStatus
  signedDocumentUrl?: string | null
  docusealSubmissionId?: string | null
  docusealSubmitterSlug?: string | null
  signedAt?: string | null
  /** ELECTRONIC (DocuSeal), ELECTRONIC_TEST (signed in-app, test environment) or PAPER. */
  signingMethod?: 'ELECTRONIC' | 'ELECTRONIC_TEST' | 'PAPER' | 'ONLINE' | 'IN_PERSON' | string
  signatureData?: string | null
  paperVerifiedAt?: string | null
  /** Renewal accepted today (facility renewal window, or the contract is overdue). */
  renewable?: boolean | null
  renewalOpensOn?: string | null
  renewalClosesOn?: string | null
  /** Why renewing is not possible today. */
  renewalBlockedReason?: string | null
  renewalWindowDays?: number | null
  /** Open renewal request (waiting for signature or payment). */
  pendingRenewalId?: string | null
  /** DocuSeal is not configured: contracts are signed in-app (test environment). */
  signingSimulated?: boolean | null
}

export interface SupportTicket {
  id: string
  ticketCode: string
  userId?: string
  customerId?: string
  customerName?: string
  customerPhone?: string
  bookingId?: string
  unitCode?: string
  category: 'UNIT' | 'LOCK' | 'ACCESS_CODE' | 'PAYMENT' | 'STORED_ITEMS' | 'OTHER' | string
  title: string
  description: string
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED' | string
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT' | string
  resolutionNote?: string
  attachmentUrl?: string
  imageEvidence?: string
  createdAt: string
}

/** One handover record (`HandoverResponse`). History reads never carry the PIN. */
export interface HandoverRecord {
  id: string
  bookingId?: string
  bookingCode: string
  customerName: string
  unitCode: string
  staffName: string
  /** CHECK_IN, CHECK_IN_INSPECTION, CHECKOUT_REQUEST, INSPECTION, RETURN (seed data also has CHECK_OUT). */
  recordType: string
  unitCondition: string
  checklistSummary?: string
  checklistAllPassed?: boolean
  /** Uploaded files, as `/uploads/handover/...` urls. */
  evidencePhotos?: string[]
  rfidCardNumber?: string
  depositSettled?: number
  deductionAmount?: number
  refundAmount?: number
  /** PENDING_ACCOUNTING_REVIEW or AUTO_REFUND_APPROVED. */
  reviewStatus?: string
  depositRefundSlaDays?: number
  refundTransactionId?: string
  notes?: string
  recordedAt: string
  /** Only in the check-in response, once. */
  accessPin?: string
  /** Only in the check-in response, once. */
  qrAccessToken?: string
  /** Check-in response only: true when the mail server accepted the PIN email (the check-in itself only queues it). */
  emailSent?: boolean
  /** Check-in response only: the PIN email was queued and is sent right after the handover is saved. */
  emailQueued?: boolean
  /** Check-in response only: why the email was not sent. */
  emailError?: string | null
  inAppNotificationSent?: boolean
}

export interface Role {
  id: string
  name: RoleType | string
  description?: string
  isActive?: boolean
  createdAt?: string
  permissions?: Permission[]
}

export interface Permission {
  id: string
  /** Unique permission code, e.g. BOOKING_VIEW. */
  name: string
  /** Group shown in the permission matrix (BOOKING, PAYMENT...). */
  permissionGroup: string
  description?: string
  isActive?: boolean
  createdAt?: string
  updatedAt?: string
}

export interface RolePermission {
  id: string
  roleId: string
  roleName?: string
  permissionId: string
  permissionName?: string
  permissionGroup?: string
  /** A revoked assignment is kept for history with isActive = false. */
  isActive?: boolean
  description?: string
  createdAt?: string
  updatedAt?: string
}

export interface ActivityLog {
  id: string
  userId?: string
  username?: string
  userName?: string
  userFullName?: string
  userEmail?: string
  userRole?: string
  emailAttempted?: string
  facilityId?: string
  facilityName?: string
  logType: string
  action: string
  status: 'SUCCESS' | 'FAILED' | 'FAILURE' | 'WARNING'
  isCritical?: boolean
  /** The backend field name for the same flag. */
  critical?: boolean
  resourceType?: string
  resourceId?: string
  description?: string
  details?: string
  /** JSON the backend stored before / after the change (audit rows of edits only). */
  oldValue?: string | null
  newValue?: string | null
  ipAddress?: string
  userAgent?: string
  createdAt: string
}

export interface FacilityPolicy {
  id: string
  facilityId: string
  facilityName?: string
  isActive?: boolean
  depositPercentage?: number
  renewalWindowDays?: number
  minimumRentalMonths?: number
  /** Hours after the appointment time before an unpaid hold is released. */
  holdGraceHours?: number
  /** How many days ahead a unit may be held. */
  maxHoldDays?: number
  cancellationFullRefundHours?: number
  cancellationPartialRefundHours?: number
  cancellationPartialRefundPercent?: number
  returnNoticeDays?: number
  depositRefundSlaDays?: number
  dailyLateFee?: number
  overdueGraceDays?: number
  overdueAccessDisableDays?: number
  overdueSealingDays?: number
  /** Facility price list: per unit type monthly price and 3/6/12-month discounts. Overrides the global price. */
  prices?: FacilityPolicyPrice[]
  updatedAt?: string
}

export interface FacilityPolicyPrice {
  unitTypeId: string
  unitTypeName?: string
  monthlyPrice: number
  discount3MonthPercent: number
  discount6MonthPercent: number
  discount12MonthPercent: number
}

/** Request shape of one price-list row (same fields as the response). */
export type FacilityPolicyPriceInput = Omit<FacilityPolicyPrice, 'unitTypeName'>


export interface FacilityPolicyCreateRequest {
  facilityId: string
  isActive?: boolean
  depositPercentage: number
  renewalWindowDays: number
  cancellationFullRefundHours: number
  cancellationPartialRefundHours: number
  cancellationPartialRefundPercent: number
  returnNoticeDays: number
  depositRefundSlaDays: number
  dailyLateFee: number
  overdueGraceDays: number
  overdueAccessDisableDays: number
  overdueSealingDays: number
  minimumRentalMonths: number
  holdGraceHours?: number
  maxHoldDays?: number
  prices?: FacilityPolicyPriceInput[]
}

export interface FacilityPolicyUpdateRequest {
  isActive?: boolean
  depositPercentage?: number
  renewalWindowDays?: number
  cancellationFullRefundHours?: number
  cancellationPartialRefundHours?: number
  cancellationPartialRefundPercent?: number
  returnNoticeDays?: number
  depositRefundSlaDays?: number
  dailyLateFee?: number
  overdueGraceDays?: number
  overdueAccessDisableDays?: number
  overdueSealingDays?: number
  minimumRentalMonths?: number
  holdGraceHours?: number
  maxHoldDays?: number
  /** Sending a list (even empty) replaces the whole price list; omit to keep it. */
  prices?: FacilityPolicyPriceInput[]
}

/**
 * Revenue of one scope. `totalRevenue` is net cash (collected minus refunded). The four stream fields add up to
 * `collectedAmount`: online booking payments are already split into deposit and first rent by the server.
 */
export interface RevenueFigures {
  totalRevenue: number
  collectedAmount: number
  refundedAmount: number
  /** Refunds still waiting to be paid out; not subtracted from `totalRevenue`. */
  pendingRefundAmount: number
  rentalFeeRevenue: number
  depositRevenue: number
  renewalFeeRevenue: number
  extraChargeRevenue: number
  /** Number of paid payments. */
  paymentCount: number
}

export interface RevenueReport {
  fromDate?: string
  toDate?: string
  systemSummary?: RevenueFigures
  byFacility?: Array<
    RevenueFigures & {
      /** Null for payments that cannot be traced to a facility. */
      facilityId: string | null
      facilityName: string | null
    }
  >
}

export type RevenueStreamKey = 'BOOKING_PAYMENT' | 'DEPOSIT' | 'RENTAL_FEE' | 'RENEWAL_FEE' | 'EXTRA_CHARGE'

export interface MonthlyRevenue {
  /** `yyyy-MM` */
  month: string
  collectedAmount: number
  refundedAmount: number
  netAmount: number
  paymentCount: number
  collectedByType: Record<RevenueStreamKey, number>
}

/** GET /reports/revenue-trend: continuous months of the selected period, filtered on the server. */
export interface RevenueTrend {
  fromDate?: string | null
  toDate?: string | null
  months: MonthlyRevenue[]
  totalCollected: number
  totalRefunded: number
  totalNet: number
  totalPaymentCount: number
}

/** GET /reports/payment-channels: paid payments of the selected period grouped by method. */
export interface PaymentChannelReport {
  fromDate?: string | null
  toDate?: string | null
  totalCount: number
  totalAmount: number
  channels: Array<{ method: string; count: number; amount: number }>
}

export interface OverdueDebtReport {
  asOfDate?: string
  totalOverdueCount: number
  totalDebtAmount: number
  totalUnpaidRent: number
  totalLateFees: number
  gracePeriodCount: number
  warningCount: number
  accessBlockedCount: number
  eligibleForSealingCount: number
  aging1To3DaysDebt?: number
  aging4To7DaysDebt?: number
  aging8To14DaysDebt?: number
  aging15PlusDaysDebt?: number
  /** Debt of items still inside the grace window (counted in `totalDebtAmount`, not in `delinquentDebtAmount`). */
  gracePeriodDebt?: number
  /** Items past the grace window. */
  delinquentCount?: number
  /** `totalDebtAmount` minus `gracePeriodDebt`: the figure to show as "nợ quá hạn". */
  delinquentDebtAmount?: number
  /** Units that are really locked (sealed, locked or PIN revoked), not just due for locking. */
  lockedUnitCount?: number
  items?: OverdueDebtItem[]
}

export interface OverdueDebtItem {
  contractId: string
  contractCode: string
  bookingId?: string
  bookingCode?: string
  customerId?: string
  customerName?: string
  customerPhone?: string
  customerEmail?: string
  unitId?: string
  unitCode: string
  facilityId?: string
  facilityName?: string
  startDate?: string
  dueDate?: string
  daysOverdue: number
  unpaidRent: number
  dailyLateFee: number
  totalLateFee: number
  totalDebt: number
  debtAmount?: number
  /** Already paid for the overdue period and subtracted from `unpaidRent` / `totalLateFee`. */
  paidAmount?: number
  overdueStage?: string
  smartLockStatus?: string
  contractStatus?: string
  unitStatus?: string
  /** The unit is really locked for non-payment. */
  locked?: boolean
}

/** Unit buckets add up: occupied + available + reserved + maintenance = total. `occupiedUnits` includes `lockedUnits`. */
export interface OccupancyFigures {
  totalUnits: number
  occupiedUnits: number
  /** Occupied units that are locked for overdue payment. */
  lockedUnits: number
  availableUnits: number
  reservedUnits: number
  maintenanceUnits: number
  /** Percentage, 0-100. */
  occupancyRate: number
}

export interface OccupancyReport {
  systemSummary?: OccupancyFigures
  byFacility?: Array<OccupancyFigures & { facilityId: string; facilityName: string }>
}
