export interface CheckInHourOption {
  value: string
  label: string
}

export type CheckInPeriodId = 'morning' | 'noon' | 'afternoon' | 'evening' | 'night'

export interface CheckInPeriodGroup {
  id: CheckInPeriodId
  name: string
  rangeText: string
  icon: string
  hours: CheckInHourOption[]
}

export const CHECK_IN_PERIOD_GROUPS: CheckInPeriodGroup[] = [
  {
    id: 'morning',
    name: 'Buổi sáng',
    rangeText: '08:00 – 11:30',
    icon: '🌅',
    hours: [
      { value: '08:00', label: '08:00 - Buổi sáng (08:00 – 11:30)' },
      { value: '08:30', label: '08:30 - Buổi sáng (08:00 – 11:30)' },
      { value: '09:00', label: '09:00 - Buổi sáng (08:00 – 11:30)' },
      { value: '09:30', label: '09:30 - Buổi sáng (08:00 – 11:30)' },
      { value: '10:00', label: '10:00 - Buổi sáng (08:00 – 11:30)' },
      { value: '10:30', label: '10:30 - Buổi sáng (08:00 – 11:30)' },
      { value: '11:00', label: '11:00 - Buổi sáng (08:00 – 11:30)' },
    ],
  },
  {
    id: 'noon',
    name: 'Buổi trưa',
    rangeText: '11:30 – 13:30',
    icon: '☀️',
    hours: [
      { value: '11:30', label: '11:30 - Buổi trưa (11:30 – 13:30)' },
      { value: '12:00', label: '12:00 - Buổi trưa (11:30 – 13:30)' },
      { value: '12:30', label: '12:30 - Buổi trưa (11:30 – 13:30)' },
      { value: '13:00', label: '13:00 - Buổi trưa (11:30 – 13:30)' },
    ],
  },
  {
    id: 'afternoon',
    name: 'Buổi chiều',
    rangeText: '13:30 – 17:30',
    icon: '🌤️',
    hours: [
      { value: '13:30', label: '13:30 - Buổi chiều (13:30 – 17:30)' },
      { value: '14:00', label: '14:00 - Buổi chiều (13:30 – 17:30)' },
      { value: '14:30', label: '14:30 - Buổi chiều (13:30 – 17:30)' },
      { value: '15:00', label: '15:00 - Buổi chiều (13:30 – 17:30)' },
      { value: '15:30', label: '15:30 - Buổi chiều (13:30 – 17:30)' },
      { value: '16:00', label: '16:00 - Buổi chiều (13:30 – 17:30)' },
      { value: '16:30', label: '16:30 - Buổi chiều (13:30 – 17:30)' },
      { value: '17:00', label: '17:00 - Buổi chiều (13:30 – 17:30)' },
    ],
  },
  {
    id: 'evening',
    name: 'Buổi tối',
    rangeText: '17:30 – 21:00',
    icon: '🌙',
    hours: [
      { value: '17:30', label: '17:30 - Buổi tối (17:30 – 21:00)' },
      { value: '18:00', label: '18:00 - Buổi tối (17:30 – 21:00)' },
      { value: '18:30', label: '18:30 - Buổi tối (17:30 – 21:00)' },
      { value: '19:00', label: '19:00 - Buổi tối (17:30 – 21:00)' },
      { value: '19:30', label: '19:30 - Buổi tối (17:30 – 21:00)' },
      { value: '20:00', label: '20:00 - Buổi tối (17:30 – 21:00)' },
      { value: '20:30', label: '20:30 - Buổi tối (17:30 – 21:00)' },
    ],
  },
  {
    id: 'night',
    name: 'Ca đêm',
    rangeText: '21:00 – 23:30',
    icon: '🌌',
    hours: [
      { value: '21:00', label: '21:00 - Ca đêm (21:00 – 23:30)' },
      { value: '21:30', label: '21:30 - Ca đêm (21:00 – 23:30)' },
      { value: '22:00', label: '22:00 - Ca đêm (21:00 – 23:30)' },
      { value: '22:30', label: '22:30 - Ca đêm (21:00 – 23:30)' },
      { value: '23:00', label: '23:00 - Ca đêm (21:00 – 23:30)' },
    ],
  },
]

export const CHECK_IN_HOURS_24 = CHECK_IN_PERIOD_GROUPS.flatMap((g) => g.hours)

export const getPeriodForHour = (hour: string): CheckInPeriodId => {
  const parts = hour.split(':')
  const h = parseInt(parts[0], 10)
  const m = parts[1] ? parseInt(parts[1], 10) : 0
  const minutes = h * 60 + m

  if (minutes < 11 * 60 + 30) return 'morning'
  if (minutes < 13 * 60 + 30) return 'noon'
  if (minutes < 17 * 60 + 30) return 'afternoon'
  if (minutes < 21 * 60) return 'evening'
  return 'night'
}

/**
 * Format local Date object to YYYY-MM-DD string
 */
export const formatLocalDate = (date: Date = new Date()): string => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Giờ kết thúc của từng ca đón tiếp (hệ 24h).
 * Sáng kết thúc lúc 11:30 (11.5)
 * Trưa kết thúc lúc 13:30 (13.5)
 * Chiều kết thúc lúc 17:30 (17.5)
 * Tối kết thúc lúc 21:00 (21)
 * Đêm kết thúc lúc 23:30 (23.5)
 */
export const PERIOD_END_HOURS: Record<CheckInPeriodId, number> = {
  morning: 11.5,
  noon: 13.5,
  afternoon: 17.5,
  evening: 21,
  night: 23.5,
}

/**
 * Kiểm tra xem một ca tiếp đón đã qua thời gian tiếp nhận đối với ngày nhận kho đã chọn hay chưa.
 * - Ngày nhận kho trước ngày hôm nay: đã qua (true)
 * - Ngày nhận kho sau ngày hôm nay: chưa qua (false)
 * - Ngày nhận kho là hôm nay: so sánh giờ hiện tại với giờ kết thúc của ca
 */
export const isPeriodInPast = (
  checkInDateStr: string,
  periodId: string,
  refDate: Date = new Date()
): boolean => {
  if (!checkInDateStr) return false
  const todayStr = formatLocalDate(refDate)
  const cleanDate = checkInDateStr.includes('T') ? checkInDateStr.split('T')[0] : checkInDateStr

  if (cleanDate < todayStr) return true
  if (cleanDate > todayStr) return false

  const endHour = PERIOD_END_HOURS[periodId as CheckInPeriodId] ?? 24
  const endMinutes = Math.floor(endHour * 60)
  const currentMinutes = refDate.getHours() * 60 + refDate.getMinutes()

  return currentMinutes >= endMinutes
}

/**
 * Tìm ca tiếp đón hợp lệ đầu tiên (chưa qua giờ) đối với ngày nhận kho đã chọn.
 */
export const getFirstAvailablePeriod = (
  checkInDateStr: string,
  refDate: Date = new Date()
): CheckInPeriodId => {
  for (const group of CHECK_IN_PERIOD_GROUPS) {
    if (!isPeriodInPast(checkInDateStr, group.id, refDate)) {
      return group.id
    }
  }
  return 'morning'
}

/**
 * Kiểm tra xem ngày đã chọn còn ít nhất một ca tiếp đón khả dụng hay không.
 */
export const hasAvailablePeriods = (
  checkInDateStr: string,
  refDate: Date = new Date()
): boolean => {
  return CHECK_IN_PERIOD_GROUPS.some((g) => !isPeriodInPast(checkInDateStr, g.id, refDate))
}
