import { addDays, toLocalISODate } from '../../../lib/format'

/** Unit being rented, as provided by the page that opens the checkout. */
export interface BookingCheckoutUnit {
  backendId?: string
  code: string
  name: string
  facilityName?: string
  monthlyPrice: number
  depositAmount?: number
  size?: string
  address?: string
}

export type CheckoutStep = 1 | 2 | 3
export type SigningMethod = 'ONLINE' | 'IN_PERSON'
export type PaymentView = 'qr' | 'link'

/** Editable fields of step 1. */
export interface CheckoutForm {
  customerName: string
  customerPhone: string
  startDate: string
  checkInTime: string
  rentalMonths: number
  signingMethod: SigningMethod
}

/** Rental terms offered online. Longer-term discounts are applied by the server quote. */
export const RENTAL_MONTH_OPTIONS = [
  { value: 1, label: '1 tháng' },
  { value: 3, label: '3 tháng' },
  { value: 6, label: '6 tháng' },
  { value: 12, label: '12 tháng' },
  { value: 24, label: '24 tháng' },
]

/** Appointment slots offered when booking. */
export const CHECK_IN_TIME_OPTIONS = [
  { value: '09:00', label: '09:00' },
  { value: '13:00', label: '13:00' },
  { value: '15:00', label: '15:00' },
]

export const DEFAULT_CHECK_IN_TIME = '09:00'

/** Vietnamese mobile (0xxxxxxxxx) or +84xxxxxxxxx after separators are removed. */
export const PHONE_PATTERN = /^(?:0\d{9}|\+84\d{9})$/

export const stripPhoneSeparators = (value: string) => value.replace(/[\s().-]/g, '')

/** `+84901234567` → `0901234567`; other values are returned unchanged. */
export const toLocalPhone = (value: string) => (value.startsWith('+84') ? `0${value.slice(3)}` : value)

export const isSafeHttpUrl = (value: string) => {
  try {
    const protocol = new URL(value).protocol
    return protocol === 'https:' || protocol === 'http:'
  } catch {
    return false
  }
}

/** First bookable slot: the next slot still ahead today, otherwise the first slot tomorrow. */
export function getDefaultAppointment(now: Date = new Date()): { startDate: string; checkInTime: string } {
  const today = toLocalISODate(now)
  const slot = CHECK_IN_TIME_OPTIONS.find(option => new Date(`${today}T${option.value}:00`).getTime() > now.getTime())
  if (slot) return { startDate: today, checkInTime: slot.value }
  return { startDate: toLocalISODate(addDays(now, 1)), checkInTime: DEFAULT_CHECK_IN_TIME }
}

/** True when the `yyyy-MM-dd` + `HH:mm` appointment is not in the future. */
export function isAppointmentPast(date: string, time: string): boolean {
  return new Date(`${date}T${time}:00`).getTime() <= Date.now()
}
