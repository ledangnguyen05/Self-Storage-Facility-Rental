import { api } from '../lib/axios'

export interface StaffAssignmentCreatePayload {
  staffId: string
  facilityId: string
  assignedDate: string
  shift: 'MORNING' | 'AFTERNOON' | 'NIGHT' | 'FULL_DAY'
  assignedZone?: string
  roleInShift?: string
  notes?: string
}

export interface StaffAssignmentResponse {
  id: string
  staffId: string
  staffName?: string
  staffUsername?: string
  staffAvatar?: string
  facilityId: string
  facilityName?: string
  assignedDate: string
  shift: string
  assignedZone?: string
  roleInShift?: string
  status: string
  notes?: string
}

export const staffAssignmentService = {
  async createAssignment(data: StaffAssignmentCreatePayload) {
    const response = await api.post('/api/v1/staff-assignments', data)
    return response.data?.data as StaffAssignmentResponse
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
    page?: number
    size?: number
  }) {
    const response = await api.get('/api/v1/staff-assignments', { params })
    return response.data?.data
  },

  async deleteAssignment(id: string) {
    const response = await api.delete(`/api/v1/staff-assignments/${id}`)
    return response.data
  }
}

