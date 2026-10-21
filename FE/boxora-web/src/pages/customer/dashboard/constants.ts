/** Static configuration of the customer portal (no business facts: those live in constants/siteConfig). */

export const DASHBOARD_TAB_VALUES = ['my-units', 'bookings', 'explore', 'contracts', 'support'] as const
export type DashboardTab = (typeof DASHBOARD_TAB_VALUES)[number]

export const isDashboardTab = (value: string | null | undefined): value is DashboardTab =>
  typeof value === 'string' && (DASHBOARD_TAB_VALUES as readonly string[]).includes(value)

/** Booking requests and bookings are refreshed this often while "Kho của tôi" or "Đặt chỗ" is visible. */
export const REQUESTS_POLL_MS = 15_000

export type BookingPackageId = '15d' | '1m' | '3m' | '6m' | '12m' | '24m' | 'custom'

export interface BookingPackage {
  id: BookingPackageId
  label: string
  /** Billed months sent to the pricing quote and the booking. */
  months: number
  /** Calendar days shown to the customer. */
  days: number
  /** Advertised term discount. The pricing quote is the source of the real amount. */
  discountPercent?: number
  hint: string
}

/**
 * The single months / discount table of the booking flow. Short terms are
 * billed as the facility minimum (1 month); custom terms are rounded to months.
 */
export const BOOKING_PACKAGES: readonly BookingPackage[] = [
  { id: '15d', label: '15 ngày', months: 1, days: 15, hint: 'Tính tối thiểu 1 tháng' },
  { id: '1m', label: '1 tháng', months: 1, days: 30, hint: 'Linh hoạt' },
  { id: '3m', label: '3 tháng', months: 3, days: 90, discountPercent: 5, hint: 'Giảm 5%' },
  { id: '6m', label: '6 tháng', months: 6, days: 180, discountPercent: 10, hint: 'Giảm 10%' },
  { id: '12m', label: '12 tháng', months: 12, days: 365, discountPercent: 15, hint: 'Giảm 15%' },
  { id: '24m', label: '24 tháng', months: 24, days: 730, discountPercent: 20, hint: 'Giảm 20%' },
  { id: 'custom', label: 'Tùy chỉnh', months: 1, days: 45, hint: 'Chọn số ngày' },
]

export const CUSTOM_DAYS_MIN = 15
export const CUSTOM_DAYS_MAX = 1825
export const MAX_MONTHS = 60

export interface BookingTerm {
  days: number
  months: number
}

/** Days and billed months of a package (custom: days rounded to whole months, 1–60). */
export function resolveBookingTerm(packageId: BookingPackageId, customDays: number): BookingTerm {
  if (packageId === 'custom') {
    const days = Math.max(CUSTOM_DAYS_MIN, Math.min(CUSTOM_DAYS_MAX, Math.round(customDays) || CUSTOM_DAYS_MIN))
    return { days, months: Math.max(1, Math.min(MAX_MONTHS, Math.round(days / 30))) }
  }
  const pkg = BOOKING_PACKAGES.find(item => item.id === packageId) ?? BOOKING_PACKAGES[1]
  return { days: pkg.days, months: pkg.months }
}

export const CHECK_IN_TIME_OPTIONS = [
  { value: '09:00', label: '09:00' },
  { value: '13:00', label: '13:00' },
  { value: '15:00', label: '15:00' },
]

/** How far ahead a start or check-in date may be booked online. */
export const BOOKING_WINDOW_DAYS = 30

export const RENEWAL_MONTH_OPTIONS = [1, 3, 6, 12] as const

export type UnitSizeFilter = 'all' | 'small' | 'medium' | 'large'

export const UNIT_SIZE_OPTIONS: { value: UnitSizeFilter; label: string }[] = [
  { value: 'all', label: 'Mọi kích thước' },
  { value: 'small', label: 'Nhỏ (đến 5 m²)' },
  { value: 'medium', label: 'Vừa (trên 5 đến 10 m²)' },
  { value: 'large', label: 'Lớn (trên 10 m²)' },
]

/** Units without a known area only appear under "Mọi kích thước". */
export function matchesUnitSize(area: number | null | undefined, filter: UnitSizeFilter): boolean {
  if (filter === 'all') return true
  if (typeof area !== 'number' || !Number.isFinite(area) || area <= 0) return false
  if (filter === 'small') return area <= 5
  if (filter === 'medium') return area > 5 && area <= 10
  return area > 10
}
