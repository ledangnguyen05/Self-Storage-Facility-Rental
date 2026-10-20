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
 * - Selected shift / timeframe ('current' | 'today' | 'past' | 'future' | 'all')
 * - Optional fromDateStr / toDateStr ('YYYY-MM-DD')
 */
export type AppointmentStatusFilter = 'ALL' | 'PENDING' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED'

export function filterArrivals(
  arrivals: Booking[],
  searchQuery: string,
  selectedFloor: string,
  selectedShiftFilter: 'current' | 'today' | 'past' | 'future' | 'all',
  unitMapById: Map<string, StorageUnit>,
  unitMapByCodeAndFacility: Map<string, StorageUnit>,
  currentDateObj: Date = new Date(),
  fromDateStr?: string,
  toDateStr?: string,
  statusFilter: AppointmentStatusFilter = 'ALL'
): Booking[] {
  const todayStr = `${currentDateObj.getFullYear()}-${String(currentDateObj.getMonth() + 1).padStart(2, '0')}-${String(currentDateObj.getDate()).padStart(2, '0')}`

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

    // Determine target check-in date
    const checkInDateTime = b.expectedCheckInAt ? new Date(b.expectedCheckInAt) : (b.startDate ? new Date(b.startDate) : null)
    const bDateStr = checkInDateTime && !isNaN(checkInDateTime.getTime())
      ? `${checkInDateTime.getFullYear()}-${String(checkInDateTime.getMonth() + 1).padStart(2, '0')}-${String(checkInDateTime.getDate()).padStart(2, '0')}`
      : (b.startDate || '')

    // 3. Appointment Status filter (Áp dụng trước để bảo toàn kết quả khi nhân viên chủ động lọc theo tab)
    if (statusFilter && statusFilter !== 'ALL') {
      if (statusFilter === 'PENDING') {
        const isPending = b.status === 'CONFIRMED' || b.status === 'PENDING_PAYMENT' || b.status === 'PENDING_APPROVAL' || b.status === 'PENDING_SIGNATURE'
        if (!isPending) return false
      } else if (statusFilter === 'ACTIVE') {
        if (b.status !== 'ACTIVE') return false
      } else if (statusFilter === 'COMPLETED') {
        if (b.status !== 'COMPLETED') return false
      } else if (statusFilter === 'CANCELLED') {
        if (b.status !== 'CANCELLED') return false
      }
    }

    // 4. Custom date range filter (fromDate / toDate)
    if (fromDateStr && bDateStr && bDateStr < fromDateStr) {
      return false
    }
    if (toDateStr && bDateStr && bDateStr > toDateStr) {
      return false
    }

    // 5. Timeframe / Shift filter (Backend đã lọc danh sách theo timeframe khi gọi API)
    // Khi nhân viên đang xem tab "Đã bàn giao" hoặc "Đã hoàn tất", hoặc đơn đã được bàn giao (ACTIVE):
    // Giữ lại để nhân viên kiểm tra hồ sơ và bàn giao thành công trong ca, không bị loại bỏ do lệch giờ hẹn.
    if (statusFilter === 'ACTIVE' || statusFilter === 'COMPLETED') {
      return true
    }

    if (selectedShiftFilter === 'today') {
      if (bDateStr && bDateStr !== todayStr && b.status !== 'ACTIVE' && b.status !== 'COMPLETED') {
        return false
      }
    } else if (selectedShiftFilter === 'past') {
      if (bDateStr && bDateStr >= todayStr && b.status !== 'COMPLETED') return false
    } else if (selectedShiftFilter === 'future') {
      if (bDateStr && bDateStr <= todayStr) return false
    } else if (selectedShiftFilter === 'current') {
      // Trong ca làm việc: Giữ lại tất cả các đơn đã bàn giao (ACTIVE) hoặc hoàn tất để nhân viên xem hồ sơ tiếp nhận
      // Chỉ kiểm tra giờ hẹn với các đơn đang chờ đến lượt (PENDING)
      if (b.status !== 'ACTIVE' && b.status !== 'COMPLETED') {
        if (bDateStr && bDateStr !== todayStr) {
          // Nếu đơn hẹn trước đó nhưng chưa check-in (trễ hẹn), vẫn hiển thị cho ca trực để đón tiếp
          const isPendingLate = b.status === 'CONFIRMED' || b.status === 'PENDING_PAYMENT'
          if (!isPendingLate) return false
        }
        if (checkInDateTime && !isNaN(checkInDateTime.getTime())) {
          const getShift = (hour: number) => (hour >= 6 && hour < 14 ? 1 : hour >= 14 && hour < 22 ? 2 : 3)
          const currentShift = getShift(currentDateObj.getHours())
          const appointmentShift = getShift(checkInDateTime.getHours())
          const isPendingOrWaiting = b.status === 'CONFIRMED' || b.status === 'PENDING_PAYMENT' || b.status === 'PENDING_APPROVAL' || b.status === 'PENDING_SIGNATURE'
          if (appointmentShift !== currentShift && !(appointmentShift < currentShift && isPendingOrWaiting)) {
            return false
          }
        }
      }
    }

    return true
  })
}

