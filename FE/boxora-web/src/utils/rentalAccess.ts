import { User } from '../types'
import { bookingService } from '../services/bookingService'
import { contractService } from '../services/contractService'

export interface CustomerRentalRecord {
  unitCode: string
  unitName: string
  contractCode: string
  startDate: string
  isAppConfirmed: boolean
}

const STORAGE_KEY_PREFIX = 'boxora_customer_rentals_'
const NEW_CUSTOMER_KEY_PREFIX = 'boxora_is_new_customer_'
const CUSTOMER_PORTAL_ACCESS_KEY_PREFIX = 'boxora_customer_portal_access_'

const getCustomerIdentityKeys = (user: User): string[] =>
  [user.id, user.username, user.email]
    .filter((key): key is string => Boolean(key))
    .map(key => key === user.email ? key.toLowerCase() : key)

const isMarkedAsNewCustomer = (user: User) =>
  getCustomerIdentityKeys(user).some(key =>
    localStorage.getItem(`${NEW_CUSTOMER_KEY_PREFIX}${key}`) === 'true' ||
    localStorage.getItem(`${NEW_CUSTOMER_KEY_PREFIX}${key.toLowerCase()}`) === 'true'
  )

const getUserRole = (user: User) => user.role?.name || user.roleName

const hasCustomerPortalActivity = (user: User) =>
  getCustomerIdentityKeys(user).some(key =>
    localStorage.getItem(`${CUSTOMER_PORTAL_ACCESS_KEY_PREFIX}${key}`) === 'true'
  )

export const getCustomerRentals = (user: User | null): CustomerRentalRecord[] => {
  if (!user || getUserRole(user) !== 'CUSTOMER') return []
  
  // Check if specifically marked as new account with 0 rentals
  if (isMarkedAsNewCustomer(user)) {
    return []
  }

  // Retrieve existing rentals stored for user id, username or email
  const lookupKeys = [user.id, user.username, user.email].filter(Boolean) as string[]
  for (const key of lookupKeys) {
    const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${key}`)
    if (raw) {
      try {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed) && parsed.length > 0) return parsed
      } catch {
        // fallback
      }
    }
  }

  return []
}

export const lockCustomerPortal = (user: User) => {
  getCustomerIdentityKeys(user).forEach(key => {
    localStorage.removeItem(`${CUSTOMER_PORTAL_ACCESS_KEY_PREFIX}${key}`)
    localStorage.removeItem(`${STORAGE_KEY_PREFIX}${key}`)
    localStorage.setItem(`${NEW_CUSTOMER_KEY_PREFIX}${key}`, 'true')
  })
  window.dispatchEvent(new Event('boxora_rental_updated'))
}

export const checkCustomerPortalAccess = (user: User | null): {
  hasAccess: boolean
  rentals: CustomerRentalRecord[]
  reason?: string
} => {
  if (!user) {
    return { hasAccess: false, rentals: [], reason: 'Chưa đăng nhập' }
  }

  // Staff and Admin roles always have access to their operational portals
  const role = getUserRole(user)
  if (role && role !== 'CUSTOMER') {
    return { hasAccess: true, rentals: [] }
  }

  // Nếu là tài khoản mới chưa từng có kho thuê được xác nhận
  if (isMarkedAsNewCustomer(user)) {
    return {
      hasAccess: false,
      rentals: [],
      reason: 'Quý khách chưa có kho đang thuê trên hệ thống.'
    }
  }

  const rentals = getCustomerRentals(user)
  const hasConfirmedRental =
    Array.isArray(rentals) &&
    rentals.length > 0 &&
    rentals.some((r) => r.isAppConfirmed && r.contractCode && r.unitCode)

  const hasAccess = Boolean(hasConfirmedRental && hasCustomerPortalActivity(user))

  return {
    hasAccess,
    rentals,
    reason: hasAccess
      ? undefined
      : 'Quý khách chưa có kho đang thuê trên hệ thống.',
  }
}

export const unlockCustomerPortal = (user: User) => {
  getCustomerIdentityKeys(user).forEach(key => {
    localStorage.setItem(`${CUSTOMER_PORTAL_ACCESS_KEY_PREFIX}${key}`, 'true')
    localStorage.removeItem(`${NEW_CUSTOMER_KEY_PREFIX}${key}`)
    localStorage.removeItem(`${NEW_CUSTOMER_KEY_PREFIX}${key.toLowerCase()}`)
  })
  window.dispatchEvent(new Event('boxora_rental_updated'))
}

export const activateCustomerRental = (
  userOrId: User | string,
  unitCode: string,
  unitName: string = 'Kho Boxora',
  contractCode?: string
): CustomerRentalRecord[] => {
  const userId = typeof userOrId === 'string' ? userOrId : userOrId.id
  const username = typeof userOrId === 'string' ? '' : userOrId.username
  const email = typeof userOrId === 'string' ? '' : userOrId.email

  // Remove is_new flags
  if (userId) localStorage.removeItem(`boxora_is_new_customer_${userId}`)
  if (username) localStorage.removeItem(`boxora_is_new_customer_${username}`)
  if (email) localStorage.removeItem(`boxora_is_new_customer_${email}`)
  if (email) localStorage.removeItem(`${NEW_CUSTOMER_KEY_PREFIX}${email.toLowerCase()}`)
  
  const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${userId}`)
  let existing: CustomerRentalRecord[] = []
  if (raw) {
    try {
      existing = JSON.parse(raw)
    } catch {
      existing = []
    }
  }

  const newRental: CustomerRentalRecord = {
    unitCode,
    unitName,
    contractCode: contractCode || `CTR-${unitCode.replace(/[^a-zA-Z0-9]/g, '')}`,

    startDate: new Date().toLocaleDateString('vi-VN'),
    isAppConfirmed: true
  }

  const updated = [newRental, ...existing.filter(r => r.unitCode !== unitCode)]
  localStorage.setItem(`${STORAGE_KEY_PREFIX}${userId}`, JSON.stringify(updated))
  if (username) localStorage.setItem(`${STORAGE_KEY_PREFIX}${username}`, JSON.stringify(updated))
  if (email) localStorage.setItem(`${STORAGE_KEY_PREFIX}${email}`, JSON.stringify(updated))

  // Dispatch custom event for real-time reactive UI updates
  window.dispatchEvent(new Event('boxora_rental_updated'))

  return updated
}

export const markUserAsNewCustomer = (userId: string, username?: string, email?: string) => {
  if (userId) {
    localStorage.setItem(`${NEW_CUSTOMER_KEY_PREFIX}${userId}`, 'true')
    localStorage.removeItem(`${STORAGE_KEY_PREFIX}${userId}`)
  }
  if (username) {
    localStorage.setItem(`${NEW_CUSTOMER_KEY_PREFIX}${username}`, 'true')
    localStorage.removeItem(`${STORAGE_KEY_PREFIX}${username}`)
  }
  if (email) {
    localStorage.setItem(`${NEW_CUSTOMER_KEY_PREFIX}${email.toLowerCase()}`, 'true')
    localStorage.removeItem(`${STORAGE_KEY_PREFIX}${email}`)
    localStorage.removeItem(`${CUSTOMER_PORTAL_ACCESS_KEY_PREFIX}${email.toLowerCase()}`)
  }
  if (userId) localStorage.removeItem(`${CUSTOMER_PORTAL_ACCESS_KEY_PREFIX}${userId}`)
  if (username) localStorage.removeItem(`${CUSTOMER_PORTAL_ACCESS_KEY_PREFIX}${username}`)
}

export const syncCustomerPortalAccess = async (user: User): Promise<boolean> => {
  if (getUserRole(user) !== 'CUSTOMER') return true

  try {
    const [bookingsResult, contractsResult] = await Promise.allSettled([
      bookingService.getMyBookings(),
      contractService.getMyContracts({ size: 20 })
    ])

    const bookings = bookingsResult.status === 'fulfilled' && Array.isArray(bookingsResult.value)
      ? bookingsResult.value
      : []
    const contracts = contractsResult.status === 'fulfilled' && Array.isArray(contractsResult.value?.content)
      ? contractsResult.value.content
      : []

    // Đã có kho đang thuê: Khi có ít nhất 1 hợp đồng ACTIVE đã gán unit, HOẶC 1 booking đã gán unit (storageUnitId/unitCode) và trạng thái CONFIRMED, READY_FOR_CHECKIN hoặc ACTIVE
    const activeContract = contracts.find(c =>
      (c.status === 'ACTIVE' || c.status === 'PENDING_ACTIVATION') && Boolean(c.unitCode || (c as any).unitId)
    )

    const activeBooking = bookings.find(b => {
      const s = String(b.status || '')
      const hasUnit = Boolean(b.storageUnitId || b.unitCode)
      return hasUnit && ['ACTIVE', 'CONFIRMED', 'READY_FOR_CHECKIN'].includes(s)
    })

    const hasRental = Boolean(activeContract || activeBooking)

    if (hasRental) {
      const unitCode = activeContract?.unitCode || activeBooking?.unitCode || 'UNIT'
      const contractCode = activeContract?.contractCode || activeBooking?.bookingCode
      activateCustomerRental(user, unitCode, 'Kho Boxora', contractCode)
      unlockCustomerPortal(user)
      return true
    } else {
      lockCustomerPortal(user)
      return false
    }
  } catch (err) {
    console.warn('Failed to sync customer portal access with backend:', err)
    return checkCustomerPortalAccess(user).hasAccess
  }
}

export interface CheckInCountdownInfo {
  text: string
  type: 'today' | 'overdue' | 'upcoming'
  diffDays: number
  badgeClass: string
}

export const getCheckInCountdown = (dateString?: string): CheckInCountdownInfo | null => {
  if (!dateString) return null
  const target = new Date(dateString)
  if (isNaN(target.getTime())) return null

  const now = new Date()
  const targetDate = new Date(target.getFullYear(), target.getMonth(), target.getDate())
  const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  const diffMs = targetDate.getTime() - todayDate.getTime()
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) {
    return {
      text: 'Hôm nay',
      type: 'today',
      diffDays: 0,
      badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300'
    }
  } else if (diffDays < 0) {
    const pastDays = Math.abs(diffDays)
    return {
      text: `Quá ${pastDays} ngày`,
      type: 'overdue',
      diffDays,
      badgeClass: 'bg-rose-100 text-rose-800 border-rose-300'
    }
  } else {
    return {
      text: `Sắp tới ${diffDays} ngày`,
      type: 'upcoming',
      diffDays,
      badgeClass: 'bg-blue-100 text-blue-800 border-blue-300'
    }
  }
}
