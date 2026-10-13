import { User } from '../types'

export interface CustomerRentalRecord {
  unitCode: string
  unitName: string
  contractCode: string
  startDate: string
  isAppConfirmed: boolean
}

const STORAGE_KEY_PREFIX = 'boxora_customer_rentals_'

export const getCustomerRentals = (user: User | null): CustomerRentalRecord[] => {
  if (!user || user.role?.name !== 'CUSTOMER') return []
  
  // Check if specifically marked as new account with 0 rentals
  const isMarkedNew =
    (user.id && localStorage.getItem(`boxora_is_new_customer_${user.id}`) === 'true') ||
    (user.username && localStorage.getItem(`boxora_is_new_customer_${user.username}`) === 'true') ||
    (user.email && localStorage.getItem(`boxora_is_new_customer_${user.email}`) === 'true')

  if (isMarkedNew) {
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
  if (user.role?.name && user.role.name !== 'CUSTOMER') {
    return { hasAccess: true, rentals: [] }
  }

  // Any logged-in customer can access their portal
  const rentals = getCustomerRentals(user)
  return {
    hasAccess: true,
    rentals,
  }
}

export const activateCustomerRental = (
  userOrId: User | string,
  unitCode: string,
  unitName: string = 'Kho Boxora'
): CustomerRentalRecord[] => {
  const userId = typeof userOrId === 'string' ? userOrId : userOrId.id
  const username = typeof userOrId === 'string' ? '' : userOrId.username
  const email = typeof userOrId === 'string' ? '' : userOrId.email

  // Remove is_new flags
  if (userId) localStorage.removeItem(`boxora_is_new_customer_${userId}`)
  if (username) localStorage.removeItem(`boxora_is_new_customer_${username}`)
  if (email) localStorage.removeItem(`boxora_is_new_customer_${email}`)
  
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
    contractCode: `HD-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
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
    localStorage.setItem(`boxora_is_new_customer_${userId}`, 'true')
    localStorage.removeItem(`${STORAGE_KEY_PREFIX}${userId}`)
  }
  if (username) {
    localStorage.setItem(`boxora_is_new_customer_${username}`, 'true')
    localStorage.removeItem(`${STORAGE_KEY_PREFIX}${username}`)
  }
  if (email) {
    localStorage.setItem(`boxora_is_new_customer_${email}`, 'true')
    localStorage.removeItem(`${STORAGE_KEY_PREFIX}${email}`)
  }
}
