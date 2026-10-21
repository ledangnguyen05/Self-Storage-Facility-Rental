import { addDays, parseDate, toLocalISODate } from '../../../lib/format'

/** `yyyy-MM-dd` plus whole months, in local time. Returns null when the date is invalid. */
export function addMonthsToISODate(isoDate: string, months: number): Date | null {
  const start = parseDate(isoDate)
  if (!start) return null
  const result = new Date(start.getFullYear(), start.getMonth() + months, start.getDate())
  return Number.isNaN(result.getTime()) ? null : result
}

/** Earliest sensible appointment: tomorrow, or the backend's minimum date when that is later. */
export function getDefaultAppointmentDate(allowedMinDate?: string | null): string {
  const tomorrow = toLocalISODate(addDays(new Date(), 1))
  return allowedMinDate && allowedMinDate > tomorrow ? allowedMinDate : tomorrow
}

/** `yyyy-MM-ddTHH:mm` appointment plus hours, or null when the input is invalid. */
export function addHoursToAppointment(date: string, time: string, hours: number): Date | null {
  const start = parseDate(`${date}T${time}:00`)
  if (!start) return null
  return new Date(start.getTime() + hours * 60 * 60 * 1000)
}
