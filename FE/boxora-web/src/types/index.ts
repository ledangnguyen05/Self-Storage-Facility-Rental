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
  facilityStatus?: string
  unitTypeId: string
  unitTypeName: string
  pricePerMonth: number
  depositAmount?: number
  imageUrl?: string
  areaSqMeters?: number
  batteryLevel?: string
  smartLockSerial?: string
  lastAccessTime?: string
  tenantName?: string
  contractCode?: string
  contractId?: string
  bookingId?: string
  startDate?: string
  dueDate?: string
}

export type BookingStatusType = 'PENDING_APPROVAL' | 'PENDING_PAYMENT' | 'CONFIRMED' | 'PENDING_SIGNATURE' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED' | 'OVERDUE'

export interface Booking {
  id: string
  bookingCode: string
  customerId: string
  customerName: string
  customerEmail: string
  customerPhone: string
  storageUnitId: string
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
  paymentExpiresAt?: string | null
  holdStartedAt?: string | null
  holdExpiresAt?: string | null
  expectedCheckInAt?: string | null
  checkInTime?: string | null
  paymentStatus?: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | string
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
  identityCardNumber?: string | null
  identityCardType?: string | null
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
  unitReleased: boolean
  cancelledAt: string
  cancellationReason?: string
  message: string
}

export interface BookingRescheduleEligibility {
  bookingId: string
  bookingCode: string
  unitCode: string | null
  unitTypeName?: string | null
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
  | 'EXPIRED'
  | 'TERMINATED'
  | 'CANCELLED'
  | 'OVERDUE'

export interface RentalContract {
  id: string
  contractCode: string
  customerId: string
  customerEmail: string
  customerName?: string
  customerPhone?: string
  identityCardNumber?: string | null
  identityCardType?: string | null
  bookingId?: string
  storageUnitId?: string
  facilityId?: string
  unitCode: string
  facilityName: string
  startDate: string
  endDate: string
  monthlyFee: number
  depositHeld: number
  status: RentalContractStatus
  signedDocumentUrl?: string | null
  docusealSubmissionId?: string | null
  docusealSubmitterSlug?: string | null
  signedAt?: string | null
  signingMethod?: 'ONLINE' | 'IN_PERSON'
  signatureData?: string | null
  unitTypeName?: string | null
  unitPricePerMonth?: number | null
}

export type ContractRenewalStatus =
  | 'PENDING_REVIEW'
  | 'PENDING_SIGNATURE'
  | 'PENDING_PAYMENT'
  | 'COMPLETED'
  | 'REJECTED'
  | 'CANCELLED'

export interface ContractRenewal {
  id: string
  contractId: string
  contractCode: string
  customerId: string
  customerName: string
  customerEmail: string
  facilityId?: string
  facilityName: string
  unitCode: string
  oldEndDate: string
  newEndDate: string
  cycleMonths: number
  renewalFee: number
  status: ContractRenewalStatus
  paymentId?: string
  paymentStatus?: 'PAID' | 'PENDING' | 'FAILED' | 'EXPIRED'
  paymentMethod?: string
  counterAppointmentDate?: string
  counterAppointmentTime?: string
  receiptVoucherCode?: string
  cashierStaffName?: string
  paidAt?: string
  docusealSubmissionId?: number
  docusealSubmitterSlug?: string
  signingUrl?: string
  signedDocumentUrl?: string
  signedAt?: string
  signatureData?: string
  reviewedById?: string
  reviewedByName?: string
  reviewedAt?: string
  rejectionReason?: string
  notes?: string
  assignedStaffId?: string
  assignedStaffName?: string
  assignedStaffEmail?: string
  assignedStaffAt?: string
  identityVerified?: boolean
  identityDocType?: string
  identityNumber?: string
  identityNotes?: string
  unitAudited?: boolean
  unitAuditNotes?: string
  noBlockingIssues?: boolean
  blockingNotes?: string
  termsConfirmed?: boolean
  termsNotes?: string
  paymentConfirmed?: boolean
  handledById?: string
  handledByName?: string
  handledAt?: string
  receptionNotes?: string
  checkInTimeMet?: boolean
  checkInTimeStatus?: 'BEFORE_DATE' | 'BEFORE_TIME' | 'ON_TIME' | 'LATE'
  checkInTimeMessage?: string
  createdAt: string
  updatedAt: string
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

export interface HandoverRecord {
  id: string
  bookingCode: string
  customerName: string
  unitCode: string
  staffName: string
  recordType: 'CHECK_IN' | 'RETURN'
  status?: 'PENDING_CHECKIN' | 'HANDED_OVER' | 'RETURN_INSPECTED'
  accessCode?: string
  accessPin?: string
  rfidCardNumber?: string
  qrAccessToken?: string
  handoverDate?: string
  unitCondition: string
  notes?: string
  recordedAt: string
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
  name: string
  code?: string
  description?: string
  module?: string
  isActive?: boolean
}

export interface RolePermission {
  id: string
  roleId: string
  roleName?: string
  permissionId: string
  permissionName?: string
  permissionCode?: string
  assignedAt?: string
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
  status: 'SUCCESS' | 'FAILURE' | 'WARNING'
  isCritical?: boolean
  resourceType?: string
  resourceId?: string
  description?: string
  details?: string
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
  cancellationFullRefundHours?: number
  cancellationPartialRefundHours?: number
  cancellationPartialRefundPercent?: number
  returnNoticeDays?: number
  depositRefundSlaDays?: number
  dailyLateFee?: number
  overdueGraceDays?: number
  overdueAccessDisableDays?: number
  overdueSealingDays?: number
  // Legacy / UI helper aliases
  depositPercent?: number
  lateFeePerDay?: number
  gracePeriodDays?: number
  overdueAuctionDays?: number
  discount3Months?: number
  discount6Months?: number
  discount12Months?: number
  updatedAt?: string
}


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
}

export interface MonthlyRevenueBreakdown {
  monthKey: string
  label: string
  rentalFee: number
  deposit: number
  renewalFee: number
  extraCharge: number
  total: number
}

export interface RevenueReport {
  fromDate?: string
  toDate?: string
  totalRevenue?: number
  refundedAmount?: number
  monthlyBreakdown?: MonthlyRevenueBreakdown[]
  systemSummary?: {
    totalRevenue: number
    rentalFeeRevenue: number
    depositRevenue: number
    renewalFeeRevenue?: number
    extraChargeRevenue?: number
    bookingPaymentRevenue?: number
    paymentCount: number
    netRevenue?: number
    totalCollected?: number
  }
  byFacility?: Array<{
    facilityId: string
    facilityName: string
    totalRevenue: number
    rentalFeeRevenue: number
    depositRevenue: number
    renewalFeeRevenue?: number
    extraChargeRevenue?: number
    bookingPaymentRevenue?: number
    paymentCount?: number
    netRevenue?: number
    totalCollected?: number
  }>
    monthlyRevenue?: Array<{
      month: string | null
      totalRevenue: number
      rentalFeeRevenue: number
      depositRevenue: number
      renewalFeeRevenue: number
      extraChargeRevenue: number
      bookingPaymentRevenue: number
      paymentCount: number
    }>
    paymentsByMethod?: Array<{
      paymentMethod: string | null
      paymentCount: number
    }>
}

export interface OverdueDebtReport {
  asOfDate?: string
  totalOverdueCount: number
  totalDebtAmount?: number | null
  totalUnpaidRent?: number | null
  totalLateFees?: number | null
  gracePeriodCount: number
  warningCount: number
  accessBlockedCount: number
  eligibleForSealingCount: number
  policyUnconfiguredCount: number
  aging1To3DaysDebt?: number
  aging4To7DaysDebt?: number
  aging8To14DaysDebt?: number
  aging15PlusDaysDebt?: number
  items?: OverdueDebtItem[]
}

export interface OverdueDebtItem {
  contractId?: string | null
  contractCode?: string | null
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
  unpaidRent?: number | null
  dailyLateFee?: number | null
  totalLateFee?: number | null
  totalDebt?: number | null
  debtAmount?: number
  overdueStage?: string
  smartLockStatus?: string
}

export interface OccupancyReport {
  systemSummary?: {
    totalUnits: number
    occupiedUnits: number
    availableUnits: number
    reservedUnits: number
    maintenanceUnits: number
    occupancyRate: number
  }
  byFacility?: Array<{
    facilityId: string
    facilityName: string
    totalUnits: number
    occupiedUnits: number
    availableUnits: number
    reservedUnits: number
    maintenanceUnits: number
    occupancyRate: number
  }>
}
