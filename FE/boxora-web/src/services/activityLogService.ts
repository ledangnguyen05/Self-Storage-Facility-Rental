import { api } from '../lib/axios'

export interface ActivityLogItem {
  id: string
  facilityId?: string
  userId?: string
  actorName?: string
  logType: string
  action: string
  resourceType?: string
  resourceId?: string
  detail?: string
  oldValue?: string
  newValue?: string
  ipAddress?: string
  status?: string
  isCritical?: boolean
  createdAt: string
}

export interface ActivityLogQueryParams {
  facilityId?: string
  userId?: string
  logType?: string
  action?: string
  status?: string
  isCriticalOnly?: boolean
  resourceType?: string
  resourceId?: string
  fromDate?: string
  toDate?: string
  search?: string
  page?: number
  size?: number
  sortBy?: string
  sortDir?: string
}

export const activityLogService = {
  async getAll(params?: ActivityLogQueryParams) {
    const response = await api.get('/api/v1/activity-logs', { params })
    return response.data?.data
  },

  async getLoginHistory(params?: {
    userId?: string
    facilityId?: string
    status?: string
    fromDate?: string
    toDate?: string
    page?: number
    size?: number
  }) {
    const response = await api.get('/api/v1/activity-logs/login-history', { params })
    return response.data?.data
  },

  async getById(id: string): Promise<ActivityLogItem> {
    const response = await api.get(`/api/v1/activity-logs/${id}`)
    return response.data?.data
  }
}
