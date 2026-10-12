import { api } from '../lib/axios'
import {
  StaffAssignment,
  StaffAssignmentCreateRequest,
  StaffAssignmentUpdateRequest,
  StaffAssignmentStatusUpdateRequest,
  StaffShift,
  StaffAssignmentStatus,
} from '../types'

export interface PageResult<T> {
  content: T[]
  page: number
  size: number
  totalElements: number
  totalPages: number
  first: boolean
  last: boolean
}

export const staffAssignmentService = {
  /**
   * Tạo mới phân công ca trực.
   */
  async createAssignment(data: StaffAssignmentCreateRequest): Promise<StaffAssignment> {
    const response = await api.post('/api/v1/staff-assignments', data)
    return response.data?.data
  },

  /**
   * Cập nhật thông tin phân công ca trực.
   */
  async updateAssignment(id: string, data: StaffAssignmentUpdateRequest): Promise<StaffAssignment> {
    const response = await api.put(`/api/v1/staff-assignments/${id}`, data)
    return response.data?.data
  },

  /**
   * Cập nhật nhanh trạng thái ca trực (Check-in, Hoàn thành, Vắng mặt).
   */
  async updateStatus(id: string, data: StaffAssignmentStatusUpdateRequest): Promise<StaffAssignment> {
    const response = await api.patch(`/api/v1/staff-assignments/${id}/status`, data)
    return response.data?.data
  },

  /**
   * Hủy / xóa phân công ca trực.
   */
  async deleteAssignment(id: string): Promise<void> {
    await api.delete(`/api/v1/staff-assignments/${id}`)
  },

  /**
   * Xem chi tiết một lượt phân công ca trực theo ID.
   */
  async getById(id: string): Promise<StaffAssignment> {
    const response = await api.get(`/api/v1/staff-assignments/${id}`)
    return response.data?.data
  },

  /**
   * Tra cứu danh sách phân công ca trực (bộ lọc theo cơ sở, nhân viên, ngày, ca, trạng thái và phân trang).
   */
  async getAllAssignments(params?: {
    facilityId?: string
    staffId?: string
    assignedDate?: string
    shift?: StaffShift
    status?: StaffAssignmentStatus
    fromDate?: string
    toDate?: string
    page?: number
    size?: number
    sortBy?: string
    sortDir?: string
  }): Promise<PageResult<StaffAssignment>> {
    const response = await api.get('/api/v1/staff-assignments', { params })
    return response.data?.data
  },

  /**
   * Bảng phân công ca trực trong ngày của cơ sở (Daily Task Board - SP2-06).
   */
  async getDailyBoard(facilityId?: string, date?: string): Promise<StaffAssignment[]> {
    const response = await api.get('/api/v1/staff-assignments/daily-board', {
      params: { facilityId, date },
    })
    return response.data?.data || []
  },
}
