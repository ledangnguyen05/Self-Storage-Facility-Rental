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
    rangeText: 'Từ 1:00 đến 10:00',
    icon: '🌅',
    hours: [
      { value: '01:00', label: '01:00 - Buổi sáng (Từ 1:00 đến 10:00)' },
      { value: '02:00', label: '02:00 - Buổi sáng (Từ 1:00 đến 10:00)' },
      { value: '03:00', label: '03:00 - Buổi sáng (Từ 1:00 đến 10:00)' },
      { value: '04:00', label: '04:00 - Buổi sáng (Từ 1:00 đến 10:00)' },
      { value: '05:00', label: '05:00 - Buổi sáng (Từ 1:00 đến 10:00)' },
      { value: '06:00', label: '06:00 - Buổi sáng (Từ 1:00 đến 10:00)' },
      { value: '07:00', label: '07:00 - Buổi sáng (Từ 1:00 đến 10:00)' },
      { value: '08:00', label: '08:00 - Buổi sáng (Từ 1:00 đến 10:00)' },
      { value: '09:00', label: '09:00 - Buổi sáng (Từ 1:00 đến 10:00)' },
      { value: '10:00', label: '10:00 - Buổi sáng (Từ 1:00 đến 10:00)' },
    ],
  },
  {
    id: 'noon',
    name: 'Buổi trưa',
    rangeText: 'Khoảng từ 11:00 đến 12:00',
    icon: '☀️',
    hours: [
      { value: '11:00', label: '11:00 - Buổi trưa (Từ 11:00 đến 12:00)' },
      { value: '12:00', label: '12:00 - Buổi trưa (Từ 11:00 đến 12:00)' },
    ],
  },
  {
    id: 'afternoon',
    name: 'Buổi chiều',
    rangeText: 'Từ 13:00 đến 18:00',
    icon: '🌤️',
    hours: [
      { value: '13:00', label: '13:00 - Buổi chiều (Từ 13:00 đến 18:00)' },
      { value: '14:00', label: '14:00 - Buổi chiều (Từ 13:00 đến 18:00)' },
      { value: '15:00', label: '15:00 - Buổi chiều (Từ 13:00 đến 18:00)' },
      { value: '16:00', label: '16:00 - Buổi chiều (Từ 13:00 đến 18:00)' },
      { value: '17:00', label: '17:00 - Buổi chiều (Từ 13:00 đến 18:00)' },
      { value: '18:00', label: '18:00 - Buổi chiều (Từ 13:00 đến 18:00)' },
    ],
  },
  {
    id: 'evening',
    name: 'Buổi tối',
    rangeText: 'Từ 19:00 đến 21:00',
    icon: '🌙',
    hours: [
      { value: '19:00', label: '19:00 - Buổi tối (Từ 19:00 đến 21:00)' },
      { value: '20:00', label: '20:00 - Buổi tối (Từ 19:00 đến 21:00)' },
      { value: '21:00', label: '21:00 - Buổi tối (Từ 19:00 đến 21:00)' },
    ],
  },
  {
    id: 'night',
    name: 'Buổi đêm',
    rangeText: 'Từ 22:00 đến 24:00',
    icon: '🌌',
    hours: [
      { value: '22:00', label: '22:00 - Buổi đêm (Từ 22:00 đến 24:00)' },
      { value: '23:00', label: '23:00 - Buổi đêm (Từ 22:00 đến 24:00)' },
      { value: '00:00', label: '24:00 (00:00) - Buổi đêm (Từ 22:00 đến 24:00)' },
    ],
  },
]

export const CHECK_IN_HOURS_24 = CHECK_IN_PERIOD_GROUPS.flatMap((g) => g.hours)

export const getPeriodForHour = (hour: string): CheckInPeriodId => {
  const h = parseInt(hour.split(':')[0], 10)
  if (h >= 1 && h <= 10) return 'morning'
  if (h >= 11 && h <= 12) return 'noon'
  if (h >= 13 && h <= 18) return 'afternoon'
  if (h >= 19 && h <= 21) return 'evening'
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
 * Sáng kết thúc lúc 10:00
 * Trưa kết thúc lúc 12:00
 * Chiều kết thúc lúc 18:00
 * Tối kết thúc lúc 21:00
 * Đêm kết thúc lúc 24:00 (nửa đêm)
 */
export const PERIOD_END_HOURS: Record<CheckInPeriodId, number> = {
  morning: 10,
  noon: 12,
  afternoon: 18,
  evening: 21,
  night: 24,
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
  const endMinutes = endHour * 60
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
