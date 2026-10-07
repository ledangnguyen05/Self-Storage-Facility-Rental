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
  description: string
  suitableFor: string
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
