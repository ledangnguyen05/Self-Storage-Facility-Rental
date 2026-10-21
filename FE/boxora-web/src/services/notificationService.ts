import { api } from '../lib/axios'
import type { PageResult, RequestOptions } from '../types'

export interface NotificationLog {
  id: string
  recipientId?: string
  recipientEmail?: string
  recipientName?: string
  facilityId?: string
  facilityName?: string
  channel?: string
  notificationType?: string
  referenceType?: string
  referenceId?: string
  title?: string
  content?: string
  /** SENT, FAILED... Delivery state of the notification (email), not the read state. */
  status?: string
  errorMessage?: string
  createdAt?: string
  /** When the recipient opened it; null/undefined while unread (stored on the server). */
  readAt?: string | null
  read?: boolean
}

export type NotificationPage = PageResult<NotificationLog>

export const notificationService = {
  /** Notifications addressed to the signed-in account, newest first. */
  async getMine(params?: { page?: number; size?: number }, opts?: RequestOptions) {
    const response = await api.get('/api/v1/notifications/mine', {
      params: { page: params?.page ?? 0, size: params?.size ?? 15 },
      signal: opts?.signal,
    })
    return response.data?.data as NotificationPage
  },

  async getUnreadCount(opts?: RequestOptions): Promise<number> {
    const response = await api.get('/api/v1/notifications/mine/unread-count', { signal: opts?.signal })
    return Number(response.data?.data?.unread ?? 0)
  },

  async markRead(id: string) {
    const response = await api.post(`/api/v1/notifications/${id}/read`)
    return response.data?.data as NotificationLog
  },

  async markAllRead(): Promise<number> {
    const response = await api.post('/api/v1/notifications/mine/read-all')
    return Number(response.data?.data?.updated ?? 0)
  },
}
