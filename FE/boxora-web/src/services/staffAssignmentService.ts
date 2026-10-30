import { api } from '../lib/axios'
import { getAssignmentWindow, isShiftStarted } from '../constants/shiftConstants'

export { isShiftStarted }

export interface StaffAssignmentCreatePayload {
  staffId: string
  facilityId: string
  assignedDate: string
  shift: 'MORNING' | 'AFTERNOON' | 'NIGHT' | 'FULL_DAY'
  startTime?: string
  endTime?: string
  assignedZone?: string
  roleInShift?: string
  notes?: string
}

export interface StaffAssignmentResponse {
  id: string
  staffId: string
  staffUsername?: string
  staffFullName?: string
  staffEmail?: string
  staffRole?: string
  facilityId: string
  facilityName?: string
  facilityCode?: string
  assignedDate: string
  shift: 'MORNING' | 'AFTERNOON' | 'NIGHT' | 'FULL_DAY'
  startTime?: string
  endTime?: string
  assignedZone?: string
  roleInShift?: string
  status: 'ASSIGNED' | 'CHECKED_IN' | 'COMPLETED' | 'ABSENT' | 'CANCELLED'
  checkedInAt?: string
  checkedOutAt?: string
  checkInNote?: string
  checkOutNote?: string
  assignedById?: string
  assignedByName?: string
  notes?: string
  createdAt?: string
  updatedAt?: string
}

/**
 * Kiểm tra xem nhân viên đã vào ca (CHECKED_IN) nhưng quên ra ca trong ngày làm việc:
 * Sau 23:59:59 của ngày kết thúc ca làm việc mà chưa check-out.
 */
export const isShiftForgottenCheckout = (assignment?: {
  status: string
  assignedDate: string
  startTime?: string | null
  endTime?: string | null
  checkedInAt?: string | null
  checkedOutAt?: string | null
  shift?: string | null
} | null, now = new Date()): boolean => {
  if (!assignment) return false
  if (assignment.status === 'CHECKED_IN' && !assignment.checkedOutAt) {
    const win = getAssignmentWindow(assignment)
    if (win) {
      // Hết ngày của ca trực (23:59:59 ngày kết thúc ca trực)
      const endOfDay = new Date(win.end.getFullYear(), win.end.getMonth(), win.end.getDate(), 23, 59, 59, 999)
      return now.getTime() > endOfDay.getTime()
    }
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    return assignment.assignedDate < todayStr
  }
  return false
}

/**
 * Kiểm tra xem một ca trực có thuộc diện "Không đi làm" (ABSENT) hay không:
 * - Trạng thái đã là ABSENT trong cơ sở dữ liệu
 * - HOẶC chưa check-in và chưa check-out (ASSIGNED) mà thời gian ca trực đã trôi qua
 * - HOẶC đã check-in nhưng quên check-out qua 24h của ngày làm việc đó
 */
export const isShiftAbsent = (assignment?: {
  status: string
  assignedDate: string
  startTime?: string | null
  endTime?: string | null
  checkedInAt?: string | null
  checkedOutAt?: string | null
  shift?: string | null
} | null, now = new Date()): boolean => {
  if (!assignment) return false
  if (assignment.status === 'ABSENT') return true
  if (assignment.status === 'ASSIGNED' && !assignment.checkedInAt && !assignment.checkedOutAt) {
    const win = getAssignmentWindow(assignment)
    if (win) {
      return now.getTime() >= win.end.getTime()
    }
  }
  if (isShiftForgottenCheckout(assignment, now)) {
    return true
  }
  return false
}

/**
 * Tính số giờ làm việc thực tế ghi nhận của ca trực:
 * - Nếu không hoàn thành (ABSENT, CANCELLED, Quên ra ca) => 0.0 giờ
 * - Nếu COMPLETED: Tính theo khoảng thời gian thực tế check-in đến check-out (làm tròn 1 chữ số thập phân)
 */
export const calculateShiftWorkHours = (assignment?: {
  status: string
  assignedDate: string
  startTime?: string | null
  endTime?: string | null
  checkedInAt?: string | null
  checkedOutAt?: string | null
  shift?: string | null
} | null): number => {
  if (!assignment) return 0
  if (isShiftAbsent(assignment)) return 0
  if (assignment.status !== 'COMPLETED') return 0
  if (assignment.checkedInAt && assignment.checkedOutAt) {
    const start = new Date(assignment.checkedInAt).getTime()
    const end = new Date(assignment.checkedOutAt).getTime()
    if (end > start) {
      const diffHours = (end - start) / (1000 * 60 * 60)
      return Math.min(Math.round(diffHours * 10) / 10, 8.0)
    }
  }
  return 8.0
}

export interface ShiftSwapRequest {
  id: string
  assignmentId: string
  assignmentDate?: string
  assignmentShift?: string
  assignedZone?: string
  requesterId: string
  requesterName?: string
  requesterUsername?: string
  requesterEmail?: string
  targetStaffId: string
  targetStaffName?: string
  targetStaffUsername?: string
  targetStaffEmail?: string
  facilityId: string
  facilityName?: string
  facilityCode?: string
  reason: string
  status: 'PENDING' | 'MANAGER_APPROVED' | 'APPROVED' | 'REJECTED' | 'CANCELLED'
  managerNotes?: string
  reviewedById?: string
  reviewedByName?: string
  reviewedAt?: string
  targetStaffRespondedAt?: string
  targetStaffNotes?: string
  createdAt?: string
  updatedAt?: string
}

export interface ShiftHandover {
  id: string
  facilityId: string
  facilityName?: string
  facilityCode?: string
  handoverDate: string
  shift: 'MORNING' | 'AFTERNOON' | 'NIGHT' | 'FULL_DAY'
  targetShift?: 'MORNING' | 'AFTERNOON' | 'NIGHT' | 'FULL_DAY'
  handoverType: 'ROUTINE' | 'EMERGENCY' | 'RESPONSIBILITY_TRANSFER'
  outgoingStaffId: string
  outgoingStaffName?: string
  outgoingStaffUsername?: string
  incomingStaffId?: string
  incomingStaffName?: string
  incomingStaffUsername?: string
  dispatchedById?: string
  dispatchedByName?: string
  dispatchedAt?: string
  outgoingAssignmentId?: string
  incomingAssignmentId?: string
  emergencyReason?: string
  transferScope?: string
  pendingTasks?: string
  pendingTicketsCount: number
  unresolvedBookingsCount: number
  cashInDrawer: number
  cashCounted?: number | null
  cashDiscrepancy?: number | null
  cashDiscrepancyReason?: string | null
  facilityStatusNote?: string
  checklistCompleted: boolean
  notes?: string
  status: 'DRAFT' | 'PENDING_DISPATCH' | 'SUBMITTED' | 'DISCREPANCY' | 'ACKNOWLEDGED' | 'REJECTED' | string
  acknowledgedAt?: string
  createdAt?: string
  updatedAt?: string
}

export const staffAssignmentService = {
  // Assignments
  async createAssignment(data: StaffAssignmentCreatePayload) {
    const response = await api.post('/api/v1/staff-assignments', data)
    return response.data?.data as StaffAssignmentResponse
  },

  async updateAssignment(id: string, data: Partial<StaffAssignmentCreatePayload> & { status?: string }) {
    const response = await api.put(`/api/v1/staff-assignments/${id}`, data)
    return response.data?.data as StaffAssignmentResponse
  },

  async deleteAssignment(id: string) {
    const response = await api.delete(`/api/v1/staff-assignments/${id}`)
    return response.data
  },

  async getDailyBoard(facilityId?: string, date?: string) {
    const response = await api.get('/api/v1/staff-assignments/daily-board', {
      params: { facilityId, date }
    })
    return response.data?.data as StaffAssignmentResponse[]
  },

  async getAllAssignments(params?: {
    facilityId?: string
    staffId?: string
    assignedDate?: string
    shift?: string
    status?: string
    fromDate?: string
    toDate?: string
    page?: number
    size?: number
  }) {
    const response = await api.get('/api/v1/staff-assignments', { params })
    return response.data?.data
  },

  // Check-in & Check-out Attendance
  async checkIn(id: string, notes?: string) {
    const response = await api.post(`/api/v1/staff-assignments/${id}/check-in`, { notes })
    return response.data?.data as StaffAssignmentResponse
  },

  async checkOut(id: string, notes?: string) {
    const response = await api.post(`/api/v1/staff-assignments/${id}/check-out`, { notes })
    return response.data?.data as StaffAssignmentResponse
  },

  // Shift Swaps
  async createSwapRequest(data: {
    assignmentId: string
    targetStaffId: string
    reason: string
    targetAssignmentId?: string
  }) {
    const response = await api.post('/api/v1/shift-swaps', data)
    return response.data?.data as ShiftSwapRequest
  },

  async reviewSwapRequest(swapId: string, data: { status: 'APPROVED' | 'REJECTED'; managerNotes?: string }) {
    const response = await api.patch(`/api/v1/shift-swaps/${swapId}/review`, data)
    return response.data?.data as ShiftSwapRequest
  },

  async respondToSwapRequest(swapId: string, data: { accept: boolean; notes?: string }) {
    const response = await api.patch(`/api/v1/shift-swaps/${swapId}/respond`, data)
    return response.data?.data as ShiftSwapRequest
  },

  async cancelSwapRequest(swapId: string) {
    const response = await api.patch(`/api/v1/shift-swaps/${swapId}/cancel`)
    return response.data?.data as ShiftSwapRequest
  },

  async getSwapRequests(params?: {
    facilityId?: string
    status?: string
    staffId?: string
    fromDate?: string
    toDate?: string
    page?: number
    size?: number
  }) {
    const response = await api.get('/api/v1/shift-swaps', { params })
    return response.data?.data
  },

  async getMySwapRequests() {
    const response = await api.get('/api/v1/shift-swaps/my-requests')
    return response.data?.data as ShiftSwapRequest[]
  },

  // Shift Handovers
  async createHandover(data: {
    facilityId: string
    handoverDate: string
    shift: string
    incomingStaffId?: string
    outgoingAssignmentId?: string
    incomingAssignmentId?: string
    pendingTasks?: string
    pendingTicketsCount?: number
    unresolvedBookingsCount?: number
    cashInDrawer?: number
    facilityStatusNote?: string
    checklistCompleted: boolean
    notes?: string
  }) {
    const response = await api.post('/api/v1/shift-handovers', data)
    return response.data?.data as ShiftHandover
  },

  async acknowledgeHandover(id: string, data: { status: 'ACKNOWLEDGED' | 'REJECTED'; notes?: string }) {
    const response = await api.patch(`/api/v1/shift-handovers/${id}/acknowledge`, data)
    return response.data?.data as ShiftHandover
  },

  async dispatchHandover(id: string, data: {
    incomingStaffId: string
    incomingAssignmentId?: string
    notes?: string
  }) {
    const response = await api.patch(`/api/v1/shift-handovers/${id}/dispatch`, data)
    return response.data?.data as ShiftHandover
  },

  async getHandovers(params?: {
    facilityId?: string
    date?: string
    status?: string
    fromDate?: string
    toDate?: string
    page?: number
    size?: number
  }) {
    const response = await api.get('/api/v1/shift-handovers', { params })
    return response.data?.data
  },

  async getRecentFacilityHandovers(facilityId?: string) {
    const response = await api.get('/api/v1/shift-handovers/recent', {
      params: { facilityId }
    })
    return response.data?.data as ShiftHandover[]
  }
}
