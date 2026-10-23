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

  // Customer must have signed contract and confirmed IoT code on system

  const rentals = getCustomerRentals(user)
  const hasConfirmedIoT =
    Array.isArray(rentals) &&
    rentals.length > 0 &&
    rentals.some((r) => r.isAppConfirmed && r.contractCode)

  return {
    hasAccess: hasConfirmedIoT,
    rentals,
    reason: hasConfirmedIoT
      ? undefined
      : 'Quý khách chưa có buồng kho thuê được ký hợp đồng và kích hoạt mã IoT trên hệ thống.',
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

export const syncCustomerPortalAccess = async (user: User) => {
  if (getUserRole(user) !== 'CUSTOMER') return true

  const [bookingsResult, requestsResult, contractsResult] = await Promise.allSettled([
    bookingService.getMyBookings(),
    bookingService.getMyRequests(),
    contractService.getMyContracts({ size: 1 })
  ])

  const bookings = bookingsResult.status === 'fulfilled' ? bookingsResult.value : null
  const requests = requestsResult.status === 'fulfilled' ? requestsResult.value : null
  const contracts = contractsResult.status === 'fulfilled' ? contractsResult.value.content : null
  const hasBookingOrRental = Boolean(bookings?.length || requests?.length || contracts?.length)

  if (hasBookingOrRental) {
    unlockCustomerPortal(user)
    return true
  }

  // Only accounts marked during registration start in search. Existing
  // accounts without rental activity can still open the portal's empty state.
  // An existing local access marker also protects the portal route if the API
  // is temporarily unavailable.
  return hasCustomerPortalActivity(user) || !isMarkedAsNewCustomer(user)
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
