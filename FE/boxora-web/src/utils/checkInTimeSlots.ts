export interface CheckInHourOption {
  value: string
  label: string
}

export interface CheckInPeriodGroup {
  id: 'morning' | 'noon' | 'afternoon' | 'evening' | 'night'
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

export const getPeriodForHour = (hour: string): 'morning' | 'noon' | 'afternoon' | 'evening' | 'night' => {
  const h = parseInt(hour.split(':')[0], 10)
  if (h >= 1 && h <= 10) return 'morning'
  if (h >= 11 && h <= 12) return 'noon'
  if (h >= 13 && h <= 18) return 'afternoon'
  if (h >= 19 && h <= 21) return 'evening'
  return 'night'
}

