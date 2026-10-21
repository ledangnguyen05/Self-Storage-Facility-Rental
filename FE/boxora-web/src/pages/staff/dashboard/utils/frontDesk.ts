import type { Booking, StorageUnit } from '@/types'
import type { SupportTicketRecord } from '@/services/supportTicketService'
import {
  getBookingStatusMeta,
  getShiftMeta,
  getTicketPriorityMeta,
  getTicketStatusMeta,
  getUnitStatusMeta,
  type StatusMeta,
} from '@/constants/statusMeta'
import { parseDate, toLocalISODate } from '@/lib/format'

/* ------------------------------------------------------------------ shift */

export type ShiftCode = 'MORNING' | 'AFTERNOON' | 'NIGHT'

export interface ShiftWindow {
  code: ShiftCode
  label: string
  startHour: number
  endHour: number
  /** `06:00–14:00` */
  range: string
}

/** Front-desk shift hours (the night shift wraps past midnight). */
const SHIFT_HOURS: Record<ShiftCode, readonly [number, number]> = {
  MORNING: [6, 14],
  AFTERNOON: [14, 22],
  NIGHT: [22, 6],
}

const pad2 = (n: number) => String(n).padStart(2, '0')

export function getCurrentShift(now: Date = new Date()): ShiftWindow {
  const hour = now.getHours()
  const code: ShiftCode = hour >= 6 && hour < 14 ? 'MORNING' : hour >= 14 && hour < 22 ? 'AFTERNOON' : 'NIGHT'
  const [startHour, endHour] = SHIFT_HOURS[code]
  return {
    code,
    label: getShiftMeta(code).label,
    startHour,
    endHour,
    range: `${pad2(startHour)}:00–${pad2(endHour)}:00`,
  }
}

function isHourInShift(hour: number, shift: ShiftWindow): boolean {
  return shift.startHour < shift.endHour
    ? hour >= shift.startHour && hour < shift.endHour
    : hour >= shift.startHour || hour < shift.endHour
}

/* ------------------------------------------------------------------ facility */

/**
 * Facility scope for rows the backend already scoped (arrivals, bookings): a row that names another facility is
 * dropped (an admin with the facility switcher on one site), a row that names none is kept. Dropping unlabelled
 * rows is what used to empty the whole front desk.
 */
export function matchesFacility(record: { facilityId?: string | null }, facilityId?: string): boolean {
  if (!facilityId || !record.facilityId) return true
  return record.facilityId === facilityId
}

/* ------------------------------------------------------------------ floors */

/** `Floor 1`, `1`, `T1`, `Tầng 1` → `Tầng 1`; anything else is shown as-is. */
export function formatFloor(value?: string | null): string {
  const text = (value ?? '').trim()
  if (!text) return ''
  const match = /^(?:floor|tầng|tang|t|f)?\s*0*(\d+)$/i.exec(text)
  return match ? `Tầng ${Number(match[1])}` : text
}

function floorSortKey(label: string): number {
  const match = /(\d+)/.exec(label)
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER
}

export function sortFloors(labels: Iterable<string>): string[] {
  return Array.from(new Set(Array.from(labels).filter(Boolean))).sort(
    (a, b) => floorSortKey(a) - floorSortKey(b) || a.localeCompare(b, 'vi'),
  )
}

/* ------------------------------------------------------------------ search */

export function normalizeText(value: string): string {
  return value.trim().toLowerCase()
}

export function matchesQuery(query: string, ...values: Array<string | null | undefined>): boolean {
  const q = normalizeText(query)
  if (!q) return true
  return values.some((value) => (value ?? '').toLowerCase().includes(q))
}

/* ------------------------------------------------------------------ arrivals */

export type ArrivalWindow = 'shift' | 'today' | 'all'
export type ReturnWindow = 'due' | 'all'

export const ARRIVAL_WINDOW_OPTIONS: { value: ArrivalWindow; label: string }[] = [
  { value: 'shift', label: 'Ca hiện tại' },
  { value: 'today', label: 'Đến hạn hôm nay' },
  { value: 'all', label: 'Tất cả lịch hẹn' },
]

export const RETURN_WINDOW_OPTIONS: { value: ReturnWindow; label: string }[] = [
  { value: 'due', label: 'Đến hạn trả' },
  { value: 'all', label: 'Tất cả đang thuê' },
]

export interface ArrivalSchedule {
  /** Local `yyyy-MM-dd`, '' when unknown. */
  date: string
  /** Display time (`HH:mm`) or null when the booking has no time. */
  time: string | null
  hour: number | null
}

const TIME_ONLY = /^(\d{1,2}):(\d{2})/

export function getArrivalSchedule(booking: Booking): ArrivalSchedule {
  const expected = parseDate(booking.expectedCheckInAt ?? null)
  if (expected) {
    return {
      date: toLocalISODate(expected),
      time: `${pad2(expected.getHours())}:${pad2(expected.getMinutes())}`,
      hour: expected.getHours(),
    }
  }
  const date = toLocalISODate(booking.startDate)
  const timeMatch = TIME_ONLY.exec((booking.checkInTime ?? '').trim())
  if (timeMatch) {
    const hour = Number(timeMatch[1])
    return { date, time: `${pad2(hour)}:${timeMatch[2]}`, hour }
  }
  return { date, time: null, hour: null }
}

/** Due today or earlier (still waiting). A booking without a date is treated as due. */
export function isArrivalDue(booking: Booking, today: string): boolean {
  const { date } = getArrivalSchedule(booking)
  return !date || date <= today
}

export function isArrivalInWindow(booking: Booking, window: ArrivalWindow, today: string, shift: ShiftWindow): boolean {
  if (window === 'all') return true
  const schedule = getArrivalSchedule(booking)
  if (schedule.date && schedule.date > today) return false
  if (window === 'today') return true
  // Current shift: earlier days are still pending; today's need a time inside the shift (or no time).
  if (!schedule.date || schedule.date < today || schedule.hour === null) return true
  return isHourInShift(schedule.hour, shift)
}

/* ------------------------------------------------------------------ returns */

export const RETURNABLE_BOOKING_STATUSES = new Set(['ACTIVE', 'CHECKOUT_REQUESTED', 'INSPECTED', 'OVERDUE'])
/** Sent as the `status` filter of GET /bookings so the server returns only rentals that can be returned. */
export const RETURNABLE_STATUS_FILTER = Array.from(RETURNABLE_BOOKING_STATUSES).join(',')
const RETURN_REQUESTED_STATUSES = new Set(['CHECKOUT_REQUESTED', 'INSPECTED', 'OVERDUE', 'OVERDUE_LOCKED'])
const RENTED_UNIT_STATUSES = new Set(['OCCUPIED', 'OVERDUE_LOCKED'])

export interface ReturnQueueItem {
  bookingId: string
  bookingCode: string
  customerName: string
  customerPhone: string
  unitCode: string
  floorLevel: string
  /** Contract end date as sent by the backend ('' when unknown). */
  endDate: string
  /** Raw backend status (booking status, or unit status when only the unit is known). */
  status: string
  statusMeta: StatusMeta
  /** Full booking when the bookings list returned it. */
  booking: Booking | null
}

/**
 * Rentals that can be returned at this facility. Bookings come first; occupied
 * units that carry a booking id fill the gaps (the bookings endpoint is
 * customer-scoped for some roles).
 */
export function buildReturnQueue(bookings: Booking[], units: StorageUnit[], facilityId?: string): ReturnQueueItem[] {
  const floorByUnitCode = new Map(units.map((unit) => [unit.unitCode, unit.floorLevel]))
  const seen = new Set<string>()
  const items: ReturnQueueItem[] = []

  for (const booking of bookings) {
    const status = String(booking?.status ?? '').toUpperCase()
    if (!booking?.id || !RETURNABLE_BOOKING_STATUSES.has(status) || !matchesFacility(booking, facilityId)) continue
    seen.add(booking.id)
    items.push({
      bookingId: booking.id,
      bookingCode: booking.bookingCode ?? '',
      customerName: booking.customerName ?? '',
      customerPhone: booking.customerPhone ?? '',
      unitCode: booking.unitCode ?? '',
      floorLevel: booking.floorLevel ?? floorByUnitCode.get(booking.unitCode) ?? '',
      endDate: booking.endDate ?? '',
      status,
      statusMeta: getBookingStatusMeta(status),
      booking,
    })
  }

  for (const unit of units) {
    const status = String(unit?.status ?? '').toUpperCase()
    if (!unit?.bookingId || seen.has(unit.bookingId) || !RENTED_UNIT_STATUSES.has(status)) continue
    if (facilityId && unit.facilityId && unit.facilityId !== facilityId) continue
    seen.add(unit.bookingId)
    items.push({
      bookingId: unit.bookingId,
      bookingCode: '',
      customerName: unit.tenantName ?? '',
      customerPhone: '',
      unitCode: unit.unitCode ?? '',
      floorLevel: unit.floorLevel ?? '',
      endDate: unit.dueDate ?? '',
      status,
      statusMeta: getUnitStatusMeta(status),
      booking: null,
    })
  }

  return items.sort((a, b) => (toLocalISODate(a.endDate) || '9999').localeCompare(toLocalISODate(b.endDate) || '9999'))
}

export function isReturnDue(item: ReturnQueueItem, today: string): boolean {
  if (RETURN_REQUESTED_STATUSES.has(item.status)) return true
  const end = toLocalISODate(item.endDate)
  return end !== '' && end <= today
}

/** Whole days between the contract end date and today (0 when not overdue or unknown). */
export function getOverdueDays(endDate: string | null | undefined, today: string): number {
  const end = parseDate(toLocalISODate(endDate ?? null))
  const now = parseDate(today)
  if (!end || !now) return 0
  return Math.max(0, Math.round((now.getTime() - end.getTime()) / 86_400_000))
}

/* ------------------------------------------------------------------ tickets */

/** Open = the status meta is a pending tone (OPEN, PENDING, REOPENED → warning; IN_PROGRESS → info). */
export function isTicketOpen(ticket: Pick<SupportTicketRecord, 'status'>): boolean {
  const tone = getTicketStatusMeta(ticket.status).tone
  return tone === 'warning' || tone === 'info'
}

export function isTicketHighPriority(ticket: Pick<SupportTicketRecord, 'priority'>): boolean {
  return getTicketPriorityMeta(ticket.priority).tone === 'danger'
}
