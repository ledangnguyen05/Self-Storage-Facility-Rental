import { api } from '../lib/axios'
import { ActivityLog } from '../types'
import { PageResult } from './userService'

export const activityLogService = {
  async getAll(params?: {
    userId?: string
    facilityId?: string
    logType?: string
    action?: string
    status?: string
    isCriticalOnly?: boolean
    resourceType?: string
    search?: string
    fromDate?: string
    toDate?: string
    page?: number
    size?: number
    sortBy?: string
    sortDir?: string
  }) {
    const response = await api.get('/api/v1/activity-logs', { params })
    return response.data?.data as PageResult<ActivityLog>
  },

  async getLoginHistory(params?: {
    userId?: string
    facilityId?: string
    status?: string
    page?: number
    size?: number
  }) {
    const response = await api.get('/api/v1/activity-logs/login-history', { params })
    return response.data?.data as PageResult<ActivityLog>
  },

  async getById(id: string) {
    const response = await api.get(`/api/v1/activity-logs/${id}`)
    return response.data?.data as ActivityLog
  },
}
