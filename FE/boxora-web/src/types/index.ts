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
  isActive?: boolean
  createdAt?: string
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
  createdAt?: string
  updatedAt?: string
}

export interface UnitTypeCreateRequest {
  typeName: string
  dimensions: string
  areaSqm: number
  basePricePerMonth: number
  depositAmount: number
}

export interface UnitTypeUpdateRequest {
  typeName?: string
  dimensions?: string
  areaSqm?: number
  basePricePerMonth?: number
  depositAmount?: number
  priceChangeReason?: string
}

export interface UnitTypePriceAdjustmentRequest {
  newPrice: number
  effectiveFrom?: string
  reason: string
  cascadeToAvailableUnits?: boolean
}

export type UnitStatusType = 'AVAILABLE' | 'RESERVED' | 'OCCUPIED' | 'MAINTENANCE'

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
}

export type BookingStatusType = 'PENDING_PAYMENT' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED' | 'OVERDUE'

export interface Booking {
  id: string
  bookingCode: string
  customerId: string
  customerName: string
  customerEmail: string
  customerPhone: string
  storageUnitId: string
  unitCode: string
  facilityName: string
  startDate: string
  endDate: string
  rentalMonths: number
  totalRentalFee: number
  depositPaid: number
  status: BookingStatusType
  accessCode: string // e.g. "BX-88219"
  accessPin: string  // e.g. "4920"
  qrAccessToken: string
  handoverTime?: string
  returnTime?: string
}

export interface SupportTicket {
  id: string
  ticketCode: string
  userId: string
  customerName: string
  bookingId?: string
  category: 'UNIT' | 'LOCK' | 'ACCESS_CODE' | 'PAYMENT' | 'STORED_ITEMS' | 'OTHER'
  title: string
  description: string
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED'
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
  resolutionNote?: string
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
  handoverDate?: string
  unitCondition: string
  notes?: string
  recordedAt: string
}

export interface StorageUnitPriceHistory {
  id: string
  storageUnitId: string
  unitCode: string
  facilityId: string
  facilityName: string
  unitTypeId?: string
  unitTypeName?: string
  oldPrice?: number
  newPrice: number
  effectiveFrom: string
  reason: string
  changedById: string
  changedByName: string
  createdAt: string
}

export interface StorageUnitPriceAdjustmentRequest {
  newPrice: number
  effectiveFrom?: string
  reason: string
}

export type StaffShift = 'MORNING' | 'AFTERNOON' | 'NIGHT' | 'FULL_DAY'
export type StaffAssignmentStatus = 'ASSIGNED' | 'CHECKED_IN' | 'COMPLETED' | 'ABSENT'

export interface StaffAssignment {
  id: string
  staffId: string
  staffUsername: string
  staffFullName: string
  staffEmail: string
  facilityId: string
  facilityName: string
  facilityCode: string
  assignedDate: string
  shift: StaffShift
  assignedZone?: string
  roleInShift: string
  status: StaffAssignmentStatus
  assignedById?: string
  assignedByName?: string
  notes?: string
  createdAt: string
  updatedAt: string
}

export interface StaffAssignmentCreateRequest {
  staffId: string
  facilityId: string
  assignedDate: string
  shift: StaffShift
  assignedZone?: string
  roleInShift?: string
  notes?: string
}

export interface StaffAssignmentUpdateRequest {
  shift?: StaffShift
  assignedZone?: string
  roleInShift?: string
  status?: StaffAssignmentStatus
  notes?: string
}

export interface StaffAssignmentStatusUpdateRequest {
  status: StaffAssignmentStatus
  notes?: string
}

export type SealingStatus = 'SEALED' | 'UNSEALED'

export interface SealingRecord {
  id: string
  storageUnitId: string
  unitCode: string
  facilityId: string
  facilityName: string
  contractId?: string
  contractCode?: string
  sealTagNumber: string
  reason: string
  sealedAt: string
  sealedById: string
  sealedByName: string
  witnessId: string
  witnessName: string
  status: SealingStatus
  unsealedAt?: string
  unsealedById?: string
  unsealedByName?: string
  unsealReason?: string
  photoEvidenceUrl?: string
  notes?: string
  createdAt: string
  updatedAt: string
}

export interface UnsealRequest {
  unsealReason: string
  photoEvidenceUrl?: string
  notes?: string
}

export interface OverdueContractDetail {
  contractId: string
  contractCode: string
  customerId?: string
  customerName: string
  customerEmail: string
  storageUnitId?: string
  unitCode: string
  facilityId?: string
  facilityName: string
  endDate: string
  overdueDays: number
  monthlyFee: number
  contractStatus: string
  latePenaltyApplied: boolean
  latePenaltyAmount: number
  pinAccessDisabled: boolean
  unitSealed: boolean
  sealTagNumber?: string
  actionSummary: string
}

export interface OverdueProcessResult {
  executionTime: string
  scannedOverdueContractsCount: number
  latePenaltyCount: number
  pinDisabledCount: number
  sealedUnitsCount: number
  details: OverdueContractDetail[]
}

// ==================== FEE TYPES ====================
export type FeeCategory =
  | 'LATE_PENALTY'
  | 'CLEANING'
  | 'KEY_REPLACEMENT'
  | 'INSURANCE'
  | 'OVERDUE_STORAGE'
  | 'OTHER'

export interface FeeType {
  id: string
  code: string
  name: string
  description?: string
  defaultAmount: number
  feeCategory: FeeCategory
  isRecurring: boolean
  isActive: boolean
  createdAt?: string
  updatedAt?: string
}

export interface FeeTypeCreateRequest {
  code: string
  name: string
  description?: string
  defaultAmount: number
  feeCategory: FeeCategory
  isRecurring?: boolean
  isActive?: boolean
}

export interface FeeTypeUpdateRequest {
  name?: string
  description?: string
  defaultAmount?: number
  feeCategory?: FeeCategory
  isRecurring?: boolean
  isActive?: boolean
}

// ==================== DISCOUNTS & VOUCHERS ====================
export type DiscountType = 'PERCENTAGE' | 'FIXED_AMOUNT' | 'TENURE_CYCLE'

export interface Discount {
  id: string
  code: string
  name: string
  description?: string
  discountType: DiscountType
  discountValue: number
  minRentalMonths: number
  maxDiscountAmount?: number
  startDate: string
  endDate?: string
  usageLimit?: number
  usedCount: number
  facilityId?: string
  facilityName?: string
  isActive: boolean
  isCurrentlyValid?: boolean
  createdAt?: string
  updatedAt?: string
}

export interface DiscountCreateRequest {
  code: string
  name: string
  description?: string
  discountType: DiscountType
  discountValue: number
  minRentalMonths?: number
  maxDiscountAmount?: number
  startDate: string
  endDate?: string
  usageLimit?: number
  facilityId?: string
  isActive?: boolean
}

export interface DiscountUpdateRequest {
  name?: string
  description?: string
  discountType?: DiscountType
  discountValue?: number
  minRentalMonths?: number
  maxDiscountAmount?: number
  startDate?: string
  endDate?: string
  usageLimit?: number
  facilityId?: string
  isActive?: boolean
}

export interface DiscountValidateRequest {
  code: string
  rentalMonths: number
  baseAmount: number
  facilityId?: string
}

export interface DiscountValidateResponse {
  isValid: boolean
  discountId: string
  code: string
  name: string
  discountType: DiscountType
  discountValue: number
  discountAmount: number
  finalAmount: number
  message: string
}

// ==================== FACILITY POLICY ====================
export interface FacilityPolicy {
  id: string
  facilityId: string
  facilityName?: string
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

export interface FacilityPolicyCreateRequest {
  facilityId: string
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

export interface FacilityPolicyUpdateRequest {
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

// ==================== BOOKING CANCELLATION & AUTO-CANCEL ====================
export interface BookingCancellationPreview {
  bookingId: string
  bookingCode: string
  unitCode?: string
  startDate: string
  depositPaid: number
  totalRentalFee: number
  hoursUntilCheckin: number
  milestoneStage: 'STAGE_1_FULL_REFUND' | 'STAGE_2_PARTIAL_REFUND' | 'STAGE_3_NO_REFUND' | 'STAGE_PENDING_NO_PAYMENT' | string
  refundPercentage: number
  refundAmount: number
  penaltyAmount: number
  policyDescription: string
  refundable: boolean
}

export interface BookingCancelRequest {
  cancellationReason?: string
}

export interface BookingCancelResponse {
  bookingId: string
  bookingCode: string
  status: string
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

export interface AutoCancelDetail {
  bookingId: string
  bookingCode: string
  customerEmail?: string
  unitCode?: string
  createdAt: string
  reason: string
}

export interface AutoCancelResult {
  executedAt: string
  scannedCount: number
  cancelledCount: number
  unitsReleasedCount: number
  cancelledBookings: AutoCancelDetail[]
}

// ==================== HANDOVER & CHECK-IN (BR-RULE-005/006) ====================
export interface HandoverPrerequisites {
  bookingId: string
  bookingCode: string
  customerName: string
  customerPhone: string
  unitCode: string
  facilityName: string
  depositSatisfied: boolean
  depositPaid: number
  requiredDeposit: number
  firstMonthRentSatisfied: boolean
  firstMonthRentPaid: number
  requiredFirstMonthRent: number
  contractSigned: boolean
  contractCode?: string
  contractStatus?: string
  identityVerified: boolean
  idCardNumber?: string
  eligibleForCheckIn: boolean
  missingPrerequisites: string[]
}

export interface HandoverCheckInRequest {
  bookingId: string
  staffId?: string
  idCardNumber?: string
  identityVerified?: boolean
  firstMonthRentConfirmed?: boolean
  contractConfirmed?: boolean
  rfidCardNumber?: string
  accessPin?: string
  unitCondition?: string
  notes?: string
}


