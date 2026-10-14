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
}

export interface UnitType {
  id: string
  typeName: string
  dimensions: string // e.g. "1.5m x 2m x 2.5m"
  areaSqm: number // e.g. 3.0
  basePricePerMonth: number // e.g. 1200000
  depositAmount: number // e.g. 1200000
  description: string
  suitableFor: string
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
  areaSqMeters?: number
  batteryLevel?: string
  smartLockSerial?: string
  lastAccessTime?: string
  tenantName?: string
  contractCode?: string
  contractId?: string
  bookingId?: string
  dueDate?: string
}

export type BookingStatusType = 'PENDING_PAYMENT' | 'CONFIRMED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED' | 'OVERDUE'

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
  status: BookingStatusType
  accessCode: string // e.g. "BX-88219"
  accessPin?: string | null
  qrAccessToken?: string | null
  handoverTime?: string
  returnTime?: string
}

export type RentalContractStatus =
  | 'DRAFT'
  | 'PENDING_SIGNATURE'
  | 'ACTIVE'
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
  depositPercent?: number
  lateFeePerDay?: number
  gracePeriodDays?: number
  overdueSealingDays?: number
  overdueAuctionDays?: number
  discount3Months?: number
  discount6Months?: number
  discount12Months?: number
  updatedAt?: string
}

export interface RevenueReport {
  fromDate?: string
  toDate?: string
  totalRevenue?: number
  systemSummary?: {
    totalRevenue: number
    rentalFeeRevenue: number
    depositRevenue: number
    renewalFeeRevenue?: number
    extraChargeRevenue?: number
    paymentCount: number
  }
  byFacility?: Array<{
    facilityId: string
    facilityName: string
    totalRevenue: number
    rentalFeeRevenue: number
    depositRevenue: number
    renewalFeeRevenue?: number
    extraChargeRevenue?: number
    paymentCount?: number
  }>
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
    occupancyRate: number
  }>
}

