export type BoxoraShiftType = 'MORNING' | 'AFTERNOON' | 'NIGHT' | 'FULL_DAY'

export interface ShiftDefinition {
  type: BoxoraShiftType
  label: string
  shortLabel: string
  startTime: string // "HH:mm"
  endTime: string   // "HH:mm"
  timeRange: string // "06:00 - 14:00"
  isOvernight: boolean
  description: string
}

export const BOXORA_SHIFTS: Record<BoxoraShiftType, ShiftDefinition> = {
  MORNING: {
    type: 'MORNING',
    label: 'Ca Sáng (06:00 - 14:00)',
    shortLabel: 'Ca Sáng',
    startTime: '06:00',
    endTime: '14:00',
    timeRange: '06:00 - 14:00',
    isOvernight: false,
    description: 'Ca sáng đón khách và bàn giao đầu ngày'
  },
  AFTERNOON: {
    type: 'AFTERNOON',
    label: 'Ca Chiều (14:00 - 22:00)',
    shortLabel: 'Ca Chiều',
    startTime: '14:00',
    endTime: '22:00',
    timeRange: '14:00 - 22:00',
    isOvernight: false,
    description: 'Ca chiều vận hành, đón khách và bàn giao ca'
  },
  NIGHT: {
    type: 'NIGHT',
    label: 'Ca Đêm (22:00 - 06:00)',
    shortLabel: 'Ca Đêm',
    startTime: '22:00',
    endTime: '06:00',
    timeRange: '22:00 - 06:00',
    isOvernight: true,
    description: 'Ca đêm trực an ninh, giám sát IoT và khẩn cấp (+1 ngày)'
  },
  FULL_DAY: {
    type: 'FULL_DAY',
    label: 'Cả Ngày (08:00 - 17:00)',
    shortLabel: 'Cả Ngày',
    startTime: '08:00',
    endTime: '17:00',
    timeRange: '08:00 - 17:00',
    isOvernight: false,
    description: 'Ca hành chính toàn ngày'
  }
}

export const STANDARD_SHIFTS_LIST: ShiftDefinition[] = [
  BOXORA_SHIFTS.MORNING,
  BOXORA_SHIFTS.AFTERNOON,
  BOXORA_SHIFTS.NIGHT
]

export interface ShiftWindow {
  start: Date
  end: Date
}

export const getAssignmentWindow = (
  assignment: {
    assignedDate?: string | null
    startTime?: string | null
    endTime?: string | null
    shift?: string | null
  } | null | undefined
): ShiftWindow | null => {
  if (!assignment || !assignment.assignedDate) return null

  let startTime = assignment.startTime
  let endTime = assignment.endTime

  if (!startTime || !endTime) {
    const std = BOXORA_SHIFTS[assignment.shift as BoxoraShiftType]
    if (std) {
      startTime = std.startTime
      endTime = std.endTime
    }
  }

  if (!startTime || !endTime) return null

  const sTime = startTime.length >= 5 ? startTime.slice(0, 5) : startTime
  const eTime = endTime.length >= 5 ? endTime.slice(0, 5) : endTime

  const start = new Date(`${assignment.assignedDate}T${sTime}:00`)
  const end = new Date(`${assignment.assignedDate}T${eTime}:00`)

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null

  // If end time is before or equal to start time, or if shift is explicitly NIGHT, end is next day
  if (end <= start || assignment.shift === 'NIGHT') {
    end.setDate(end.getDate() + 1)
  }

  return { start, end }
}

export const isWithinShiftWindow = (
  assignment: {
    assignedDate?: string | null
    startTime?: string | null
    endTime?: string | null
    shift?: string | null
  } | null | undefined,
  now = new Date()
): boolean => {
  const win = getAssignmentWindow(assignment)
  if (!win) return false
  return now >= win.start && now < win.end
}

export const canCheckInShift = (
  assignment: {
    id?: string
    assignedDate?: string | null
    startTime?: string | null
    endTime?: string | null
    shift?: string | null
    status?: string | null
    checkedInAt?: string | null
  } | null | undefined,
  now = new Date()
): boolean => {
  if (!assignment) return false
  if (assignment.status !== 'ASSIGNED' || Boolean(assignment.checkedInAt)) return false
  return isWithinShiftWindow(assignment, now)
}

export const canCheckOutShift = (
  assignment: {
    status?: string | null
    checkedInAt?: string | null
    checkedOutAt?: string | null
  } | null | undefined
): boolean => {
  if (!assignment) return false
  return assignment.status === 'CHECKED_IN' && Boolean(assignment.checkedInAt) && !assignment.checkedOutAt
}

export const formatShiftLabel = (shift?: string | null): string => {
  if (!shift) return 'Chưa phân ca'
  if (shift === 'MORNING') return 'Ca Sáng'
  if (shift === 'AFTERNOON') return 'Ca Chiều'
  if (shift === 'NIGHT') return 'Ca Đêm'
  if (shift === 'FULL_DAY') return 'Cả Ngày'
  return shift
}

export const formatShiftTimeRange = (
  assignment?: {
    shift?: string | null
    startTime?: string | null
    endTime?: string | null
  } | null
): string => {
  if (!assignment) return ''
  if (assignment.startTime && assignment.endTime) {
    return `${assignment.startTime.slice(0, 5)} - ${assignment.endTime.slice(0, 5)}`
  }
  const std = BOXORA_SHIFTS[assignment.shift as BoxoraShiftType]
  return std ? std.timeRange : ''
}

export const isShiftInPast = (
  assignedDate?: string | null,
  shift?: BoxoraShiftType | string | null,
  now = new Date()
): boolean => {
  if (!assignedDate) return false
  const todayLocal = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  if (assignedDate < todayLocal) return true
  if (assignedDate > todayLocal) return false
  const win = getAssignmentWindow({ assignedDate, shift })
  if (!win) return false
  return now.getTime() >= win.end.getTime()
}

/**
 * Kiểm tra xem một ca trực đã tới giờ bắt đầu hay chưa:
 * Trả về true nếu thời điểm hiện tại >= giờ bắt đầu ca trực (startTime),
 * hoặc ngày làm việc đã nằm trong quá khứ.
 */
export const isShiftStarted = (
  assignment: {
    assignedDate?: string | null
    startTime?: string | null
    endTime?: string | null
    shift?: string | null
  } | null | undefined,
  now = new Date()
): boolean => {
  if (!assignment || !assignment.assignedDate) return false
  const win = getAssignmentWindow(assignment)
  if (!win) {
    const todayLocal = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    return assignment.assignedDate < todayLocal
  }
  return now.getTime() >= win.start.getTime()
}

export const getFirstAvailableShiftForDate = (
  assignedDate: string,
  now = new Date()
): 'MORNING' | 'AFTERNOON' | 'NIGHT' | null => {
  for (const s of STANDARD_SHIFTS_LIST) {
    if (!isShiftInPast(assignedDate, s.type, now)) {
      return s.type as 'MORNING' | 'AFTERNOON' | 'NIGHT'
    }
  }
  return null
}
