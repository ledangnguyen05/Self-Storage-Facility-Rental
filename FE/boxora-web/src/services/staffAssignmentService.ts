import { api } from '../lib/axios'
import type { PageResult, RequestOptions } from '../types'

export type StaffShiftValue = 'MORNING' | 'AFTERNOON' | 'NIGHT' | 'FULL_DAY'

export interface StaffAssignmentCreatePayload {
  staffId: string
  facilityId: string
  assignedDate: string
  shift: StaffShiftValue
  assignedZone?: string
  roleInShift?: string
  notes?: string
}

/** `StaffAssignmentUpdateRequest`: only the fields present are considered; shift, zone and role are locked once the shift started. */
export interface StaffAssignmentUpdatePayload {
  shift?: StaffShiftValue
  /** Empty text clears the zone. */
  assignedZone?: string
  roleInShift?: string
  status?: 'ASSIGNED' | 'CHECKED_IN' | 'COMPLETED' | 'ABSENT'
  notes?: string
}

/** `StaffAssignmentResponse` (field names match the backend DTO). */
export interface StaffAssignmentResponse {
  id: string
  staffId: string
  staffUsername?: string
  staffFullName?: string
  staffEmail?: string
  staffPhone?: string
  staffAvatar?: string
  facilityId: string
  facilityName?: string
  facilityCode?: string
  assignedDate: string
  shift: StaffShiftValue | string
  assignedZone?: string
  roleInShift?: string
  status: string
  assignedById?: string
  assignedByName?: string
  notes?: string
  createdAt?: string
  updatedAt?: string
}

/** Display name of the assigned person: full name, then username. */
export const getAssignmentStaffName = (assignment: Pick<StaffAssignmentResponse, 'staffFullName' | 'staffUsername'>) =>
  assignment.staffFullName || assignment.staffUsername || 'Nhân viên'

export const staffAssignmentService = {
  async createAssignment(data: StaffAssignmentCreatePayload) {
    const response = await api.post('/api/v1/staff-assignments', data)
    return response.data?.data as StaffAssignmentResponse
  },

  /** PUT /staff-assignments/{id}: change shift, zone, notes or status (409 when the shift overlaps another one of the person). */
  async updateAssignment(id: string, data: StaffAssignmentUpdatePayload) {
    const response = await api.put(`/api/v1/staff-assignments/${id}`, data)
    return response.data?.data as StaffAssignmentResponse
  },

  /** Assignments of one day. Without `facilityId`, system-wide roles get every facility. */
  async getDailyBoard(facilityId?: string, date?: string, opts?: RequestOptions) {
    const response = await api.get('/api/v1/staff-assignments/daily-board', {
      params: { facilityId, date },
      signal: opts?.signal,
    })
    return (response.data?.data ?? []) as StaffAssignmentResponse[]
  },

  async getAllAssignments(params?: {
    facilityId?: string
    staffId?: string
    assignedDate?: string
    shift?: string
    status?: string
    page?: number
    size?: number
  }, opts?: RequestOptions) {
    const response = await api.get('/api/v1/staff-assignments', { params, signal: opts?.signal })
    return response.data?.data as PageResult<StaffAssignmentResponse>
  },

  async deleteAssignment(id: string) {
    const response = await api.delete(`/api/v1/staff-assignments/${id}`)
    return response.data
  }
}
