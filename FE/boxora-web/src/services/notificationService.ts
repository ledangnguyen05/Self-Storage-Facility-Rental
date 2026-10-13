import { api } from '../lib/axios'

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
  status?: string
  createdAt?: string
}

export interface NotificationPage {
  content: NotificationLog[]
  page: number
  size: number
  totalElements: number
  totalPages: number
  first: boolean
  last: boolean
}

export const notificationService = {
  async getRecent(params: { recipientId: string; page?: number; size?: number }) {
    const response = await api.get('/api/v1/notifications', {
      params: { ...params, page: params.page ?? 0, size: params.size ?? 6 },
    })
    return response.data?.data as NotificationPage
  },
}
