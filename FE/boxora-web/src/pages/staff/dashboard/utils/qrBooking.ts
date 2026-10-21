import type { Booking } from '@/types'
import { handoverService } from '@/services/handoverService'
import { getBookingStatusMeta } from '@/constants/statusMeta'
import { getApiErrorMessage, getApiErrorStatus, isRequestCanceled } from '@/lib/apiError'

/** What a booking QR (or a typed code) points at. At least one field is set. */
export interface QrBookingRef {
  bookingId?: string
  bookingCode?: string
}

/** The text the customer app encodes in the check-in QR: `BOXORA-CHECKIN:<bookingCode>`. */
export const CHECK_IN_QR_PREFIX = 'BOXORA-CHECKIN:'

const UUID_PATTERN = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i
const UUID_EXACT = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const CODE_PATTERN = /^#?[A-Za-z0-9][A-Za-z0-9_-]{2,39}$/
/** The access QR a customer gets AFTER check-in (`QR-XXXXXXXX`) is not a booking code. */
const ACCESS_TOKEN_PATTERN = /^QR-[A-Z0-9]{8}$/i

/** Booking statuses that can still be checked in at the desk. */
export const CHECK_IN_STATUSES = new Set(['CONFIRMED', 'PENDING_PAYMENT'])

export function normalizeBookingCode(code: string): string {
  return code.trim().replace(/^#/, '').toUpperCase()
}

function pickString(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim()) return value.trim()
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return undefined
}

function toRef(id: string | undefined, code: string | undefined): QrBookingRef | null {
  const bookingId = id && UUID_EXACT.test(id) ? id : undefined
  const bookingCode = code && CODE_PATTERN.test(code) ? normalizeBookingCode(code) : undefined
  return bookingId || bookingCode ? { bookingId, bookingCode } : null
}

/**
 * Reads a booking reference from a QR payload: `BOXORA-CHECKIN:<code>` (what the customer app shows), JSON
 * (`{ bookingId, bookingCode }`), a URL (`?bookingId=` / `?code=` or a UUID in the path), a bare UUID or a
 * bare booking code. Returns null when nothing usable is found.
 */
export function parseBookingQr(raw: string): QrBookingRef | null {
  let text = raw.trim()
  if (!text) return null

  if (text.slice(0, CHECK_IN_QR_PREFIX.length).toUpperCase() === CHECK_IN_QR_PREFIX) {
    text = text.slice(CHECK_IN_QR_PREFIX.length).trim()
    if (!text) return null
  }

  if (text.startsWith('{')) {
    try {
      const parsed: unknown = JSON.parse(text)
      if (parsed && typeof parsed === 'object') {
        const record = parsed as Record<string, unknown>
        return toRef(pickString(record.bookingId ?? record.id), pickString(record.bookingCode ?? record.code))
      }
    } catch {
      return null
    }
    return null
  }

  if (/^https?:\/\//i.test(text)) {
    try {
      const url = new URL(text)
      const params = url.searchParams
      const id = pickString(params.get('bookingId') ?? params.get('id')) ?? url.pathname.match(UUID_PATTERN)?.[0]
      return toRef(id, pickString(params.get('bookingCode') ?? params.get('code')))
    } catch {
      return null
    }
  }

  if (UUID_EXACT.test(text)) return { bookingId: text }
  return toRef(undefined, text)
}

export type QrResolution =
  | { kind: 'found'; booking: Booking }
  | { kind: 'not-found'; message: string }
  | { kind: 'error'; message: string }

const NOT_FOUND: QrResolution = {
  kind: 'not-found',
  message: 'Không tìm thấy lượt đặt kho khớp với mã này. Kiểm tra lại mã đặt chỗ trong ứng dụng của khách.',
}

function checkInBlockedMessage(booking: Booking): string {
  const status = String(booking.status ?? '').toUpperCase()
  const label = getBookingStatusMeta(status).label
  if (status === 'ACTIVE' || status === 'OVERDUE' || status === 'CHECKOUT_REQUESTED' || status === 'INSPECTED') {
    return `Lượt đặt này đã nhận kho (trạng thái “${label}”). Dùng mục Trả kho nếu khách muốn trả.`
  }
  return `Lượt đặt đang ở trạng thái “${label}”, không thể làm thủ tục nhận kho.`
}

/**
 * Resolves a QR reference against the arrivals list first, then the backend lookup
 * (`GET /handovers/lookup`, scoped to the staff member's facility). Never checks the customer in:
 * the caller opens the workbench.
 */
export async function resolveQrBooking(
  ref: QrBookingRef,
  arrivals: Booking[],
  facilityId: string | undefined,
  signal?: AbortSignal,
): Promise<QrResolution> {
  const local = arrivals.find(
    (booking) =>
      (ref.bookingId && booking.id === ref.bookingId) ||
      (ref.bookingCode && normalizeBookingCode(booking.bookingCode ?? '') === ref.bookingCode),
  )
  if (local) return { kind: 'found', booking: local }

  const query = ref.bookingId ?? ref.bookingCode
  if (!query) return NOT_FOUND
  if (ACCESS_TOKEN_PATTERN.test(query)) {
    return {
      kind: 'error',
      message: 'Đây là mã truy cập kho của khách sau khi đã nhận kho, không phải mã nhận kho. Hãy quét mã đặt chỗ trong mục Đặt kho của khách.',
    }
  }

  try {
    const booking = await handoverService.lookupBooking(query, { signal })
    if (!booking?.id) return NOT_FOUND
    if (facilityId && booking.facilityId && booking.facilityId !== facilityId) {
      return { kind: 'error', message: 'Lượt đặt này thuộc cơ sở khác, không thể nhận kho tại quầy này.' }
    }
    if (!CHECK_IN_STATUSES.has(String(booking.status ?? '').toUpperCase())) {
      return { kind: 'error', message: checkInBlockedMessage(booking) }
    }
    return { kind: 'found', booking }
  } catch (err) {
    if (isRequestCanceled(err)) throw err
    const status = getApiErrorStatus(err)
    if (status === 404) return NOT_FOUND
    if (status === 403) {
      return { kind: 'error', message: 'Lượt đặt này thuộc cơ sở khác, không thể nhận kho tại quầy này.' }
    }
    throw new Error(getApiErrorMessage(err, 'Không tra cứu được lượt đặt. Vui lòng thử lại.'))
  }
}
