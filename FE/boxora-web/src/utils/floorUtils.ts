import type { Booking, StorageUnit } from '../types/index.ts'

/**
 * Normalizes any raw floor string into a standard floor identifier:
 * - "Tầng 1", "Tầng 2", "Tầng 3" -> "1", "2", "3"
 * - "Floor 1", "Floor 2", "Floor 3" -> "1", "2", "3"
 * - "1", "2", "3" -> "1", "2", "3"
 * - "Tầng Trệt", "Ground", "Trệt" -> "G"
 * - "Tầng Hầm", "Hầm", "B1" -> "B1"
 * - Returns null if raw value is empty, invalid, or undefined
 */
export function extractFloor(floorLevel?: string | null): string | null {
  if (!floorLevel || !floorLevel.trim()) return null
  const trimmed = floorLevel.trim()
  const lower = trimmed.toLowerCase()

  // 1. Ground / Basement keywords check
  if (lower.includes('trệt') || lower.includes('tret') || lower.includes('ground') || lower === 'g') return 'G'
  if (lower.includes('hầm') || lower.includes('ham') || lower.includes('basement') || lower === 'b') return 'B'

  // 2. Look for digits (e.g. "Tầng 1", "Floor 2", "1", "B1")
  const anyDigit = trimmed.match(/\d+/)
  if (anyDigit) {
    if (/b\d+/i.test(trimmed)) {
      const bMatch = trimmed.match(/b\d+/i)
      return bMatch ? bMatch[0].toUpperCase() : anyDigit[0]
    }
    return anyDigit[0]
  }

  // 3. Fallback pattern
  const match = trimmed.match(/(?:tầng|floor|level|fl|t)\s*([^\s]+)/iu)
  if (match && match[1]) {
    return match[1].toUpperCase()
  }

  return trimmed
}

/**
 * Resolves the actual storage unit floor level for a booking following strict priority:
 * 1. Direct from booking.floorLevel (populated from storage_units.floor_level in database)
 * 2. Matching unit by storageUnitId in radarUnits
 * 3. Matching unit by unitCode AND facilityId in radarUnits (guarantees facility isolation)
 * 4. Fallback: Parse standard warehouse unit numbering pattern e.g. TB-A101 -> Floor 1, TD-C204 -> Floor 2
 *    (ONLY if database floorLevel is completely missing)
 */
export function resolveBookingFloor(
  booking: Booking,
  unitMapById?: Map<string, StorageUnit>,
  unitMapByCodeAndFacility?: Map<string, StorageUnit>,
  allowCodeFallback: boolean = false
): string | null {
  // 1. Direct from booking.floorLevel (database truth)
  if (booking.floorLevel) {
    const f = extractFloor(booking.floorLevel)
    if (f) return f
  }

  // 2. Storage unit matched by exact storageUnitId
  if (booking.storageUnitId && unitMapById) {
    const unit = unitMapById.get(booking.storageUnitId)
    if (unit?.floorLevel) {
      const f = extractFloor(unit.floorLevel)
      if (f) return f
    }
  }

  // 3. Storage unit matched by facilityId + unitCode (prevents cross-facility confusion)
  if (booking.unitCode && unitMapByCodeAndFacility) {
    const key = `${booking.facilityId || ''}::${booking.unitCode.trim().toUpperCase()}`
    const unit = unitMapByCodeAndFacility.get(key)
    if (unit?.floorLevel) {
      const f = extractFloor(unit.floorLevel)
      if (f) return f
    }
  }

  // 4. Fallback ONLY if explicitly confirmed by business rules (disabled by default)
  if (allowCodeFallback && booking.unitCode) {
    const code = booking.unitCode.trim().toUpperCase()
    const patternMatch = code.match(/(?:[A-Z0-9]+-)?([A-Z])?([1-9])\d{2}/)
    if (patternMatch && patternMatch[2]) {
      return patternMatch[2]
    }
  }

  return null
}

/**
 * Filters arrivals list based on:
 * - Search query (customerName, customerPhone, bookingCode, unitCode)
 * - Selected floor ('all' or '1', '2', '3', etc.)
 * - Selected shift ('all', 'today', 'current')
 */
export function filterArrivals(
  arrivals: Booking[],
  searchQuery: string,
  selectedFloor: string,
  selectedShiftFilter: 'current' | 'today' | 'all',
  unitMapById: Map<string, StorageUnit>,
  unitMapByCodeAndFacility: Map<string, StorageUnit>,
  currentDateObj: Date = new Date()
): Booking[] {
  return arrivals.filter((b) => {
    // 1. Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      const matchName = (b.customerName || '').toLowerCase().includes(q)
      const matchPhone = (b.customerPhone || '').toLowerCase().includes(q)
      const matchBookingCode = (b.bookingCode || '').toLowerCase().includes(q)
      const matchUnitCode = (b.unitCode || '').toLowerCase().includes(q)
      if (!matchName && !matchPhone && !matchBookingCode && !matchUnitCode) return false
    }

    // 2. Floor filter
    if (selectedFloor !== 'all') {
      const floor = resolveBookingFloor(b, unitMapById, unitMapByCodeAndFacility)
      if (!floor || floor !== selectedFloor) {
        return false
      }
    }

    // 3. Shift filter
    if (selectedShiftFilter === 'today') {
      const todayStr = currentDateObj.toISOString().split('T')[0]
      const bDate = b.expectedCheckInAt ? b.expectedCheckInAt.split('T')[0] : b.startDate
      if (bDate && bDate !== todayStr) return false
    } else if (selectedShiftFilter === 'current') {
      if (b.expectedCheckInAt) {
        const d = new Date(b.expectedCheckInAt)
        if (!isNaN(d.getTime())) {
          const todayStr = currentDateObj.toISOString().split('T')[0]
          const bDate = b.expectedCheckInAt.split('T')[0]
          // If explicitly scheduled for today, verify if it falls in the current operational shift
          if (bDate === todayStr) {
            const h = d.getHours()
            const curH = currentDateObj.getHours()
            const getShift = (hour: number) => (hour >= 6 && hour < 14 ? 1 : hour >= 14 && hour < 22 ? 2 : 3)
            if (getShift(h) !== getShift(curH)) return false
          }
        }
      }
    }

    return true
  })
}

