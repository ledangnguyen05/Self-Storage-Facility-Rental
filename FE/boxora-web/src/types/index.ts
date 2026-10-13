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
  facilityId?: string
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
  code?: string
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

export type UnitStatusType = 'AVAILABLE' | 'RESERVED' | 'OCCUPIED' | 'MAINTENANCE' | 'UNDER_MAINTENANCE'

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
  dueDate?: string
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
  userFullName?: string
  facilityId?: string
  facilityName?: string
  logType: string
  action: string
  status: 'SUCCESS' | 'FAILURE' | 'WARNING'
  isCritical?: boolean
  resourceType?: string
  resourceId?: string
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

