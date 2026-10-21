import { api } from '../lib/axios'
import type { ActivityLog, PageResult, RequestOptions } from '../types'

export const activityLogService = {
  async getAll(params?: {
    userId?: string
    facilityId?: string
    logType?: string
    action?: string
    /** Business area: AUTH, ACCOUNT, FACILITY, BOOKING, PAYMENT, ACCESS, OVERDUE, SUPPORT or REPORT. */
    domain?: string
    status?: string
    isCriticalOnly?: boolean
    /** One resource type, or several separated by commas (case-insensitive). */
    resourceType?: string
    /** Exact record id; pair it with `resourceType` (for example StorageUnit + the unit id). */
    resourceId?: string
    /** Inclusive local dates, yyyy-MM-dd. */
    fromDate?: string
    toDate?: string
    search?: string
    page?: number
    size?: number
    sortBy?: string
    sortDir?: string
  }, opts?: RequestOptions) {
    const response = await api.get('/api/v1/activity-logs', { params, signal: opts?.signal })
    return response.data?.data as PageResult<ActivityLog>
  },

  async getLoginHistory(params?: {
    userId?: string
    facilityId?: string
    status?: string
    fromDate?: string
    toDate?: string
    page?: number
    size?: number
  }, opts?: RequestOptions) {
    const response = await api.get('/api/v1/activity-logs/login-history', { params, signal: opts?.signal })
    return response.data?.data as PageResult<ActivityLog>
  },

  async getById(id: string, opts?: RequestOptions) {
    const response = await api.get(`/api/v1/activity-logs/${id}`, { signal: opts?.signal })
    return response.data?.data as ActivityLog
  },
}
