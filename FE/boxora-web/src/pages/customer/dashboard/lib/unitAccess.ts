import { bookingService, type BookingPinData } from '@/services/bookingService'
import { getApiErrorStatus } from '@/lib/apiError'
import type { RentalContract } from '@/types'

/** What the access-PIN endpoints need to find a rented unit. */
export interface UnitAccessTarget {
  bookingId?: string | null
  /** Storage unit UUID (never the unit code). */
  storageUnitId?: string | null
}

export const toAccessTarget = (contract: Pick<RentalContract, 'bookingId' | 'storageUnitId'>): UnitAccessTarget => ({
  bookingId: contract.bookingId,
  storageUnitId: contract.storageUnitId,
})

export const MISSING_ACCESS_TARGET = 'Kho này chưa có thông tin truy cập. Vui lòng liên hệ cơ sở.'

/**
 * Loads the access PIN. The booking endpoint is the primary source; the
 * unit endpoint is used only when the booking has none (404) or is unknown.
 */
export async function fetchUnitAccess(target: UnitAccessTarget, signal?: AbortSignal): Promise<BookingPinData> {
  if (target.bookingId) {
    try {
      return await bookingService.getAccessPin(target.bookingId, { signal })
    } catch (err) {
      if (getApiErrorStatus(err) !== 404 || !target.storageUnitId) throw err
    }
  }
  if (target.storageUnitId) return bookingService.getAccessPinByUnit(target.storageUnitId, { signal })
  throw new Error(MISSING_ACCESS_TARGET)
}

/** Updates the access PIN, falling back to the unit endpoint only on a 404 from the booking endpoint. */
export async function updateUnitAccessPin(target: UnitAccessTarget, newPin: string): Promise<BookingPinData> {
  if (target.bookingId) {
    try {
      return await bookingService.updateAccessPin(target.bookingId, newPin)
    } catch (err) {
      if (getApiErrorStatus(err) !== 404 || !target.storageUnitId) throw err
    }
  }
  if (target.storageUnitId) return bookingService.updateAccessPinByUnit(target.storageUnitId, newPin)
  throw new Error(MISSING_ACCESS_TARGET)
}

/** Six random digits from the platform CSPRNG (a suggestion the customer can accept or edit). */
export function generatePinSuggestion(): string {
  const values = new Uint32Array(1)
  crypto.getRandomValues(values)
  return String(100000 + (values[0] % 900000))
}

export const isValidPin = (pin: string) => /^\d{6}$/.test(pin)
