import { api } from '../lib/axios'
import { Booking } from '../types'
import { PageResult } from './userService'

export interface BookingCreatePayload {
  storageUnitId: string
  customerId?: string
  startDate: string
  rentalMonths: number
  totalRentalFee?: number
  depositPaid?: number
}

export interface BookingPinData {
  bookingId: string
  bookingCode?: string
  accessPin: string
  pin?: string
  unitCode?: string
  encryptedAt?: string
  pinUpdatedAt?: string
  qrAccessToken?: string
}

export const bookingService = {
  async create(data: BookingCreatePayload) {
    const response = await api.post('/api/v1/bookings', data)
    return response.data?.data as Booking
  },

  async createBooking(data: BookingCreatePayload) {
    return this.create(data)
  },

  async getMyActive(customerId?: string) {
    const response = await api.get('/api/v1/bookings/my-active', {
      params: customerId ? { customerId } : undefined,
    })
    return (response.data?.data || []) as Booking[]
  },

  async getMyRequests() {
    const response = await api.get('/api/v1/bookings/my-requests')
    return (response.data?.data || []) as Booking[]
  },

  async getPendingApprovals() {
    const response = await api.get('/api/v1/bookings/pending-approval')
    return (response.data?.data || []) as Booking[]
  },

  async decideRequest(id: string, approved: boolean) {
    const response = await api.post(`/api/v1/bookings/${id}/decision`, { approved })
    return response.data?.data as Booking
  },

  async getUpcomingArrivals() {
    const response = await api.get('/api/v1/bookings/arrivals')
    return (response.data?.data || []) as Booking[]
  },

  async getAccessCredentials(id: string) {
    const response = await api.get(`/api/v1/bookings/${id}/access-credentials`)
    return response.data?.data as { accessPin: string; qrAccessToken: string }
  },

  async getAll(params?: { customerId?: string; status?: string; page?: number; size?: number }) {
    const response = await api.get('/api/v1/bookings', { params })
    const data = response.data?.data
    if (Array.isArray(data)) {
      return {
        content: data,
        totalElements: data.length,
        totalPages: 1,
        size: data.length,
        page: 0,
        first: true,
        last: true,
      } as PageResult<Booking>
    }
    return data as PageResult<Booking>
  },

  async getById(id: string) {
    const response = await api.get(`/api/v1/bookings/${id}`)
    return response.data?.data as Booking
  },

  async getAccessPin(id: string) {
    const response = await api.get(`/api/v1/bookings/${id}/access-pin`)
    const data = response.data?.data
    return {
      bookingId: data?.bookingId || id,
      bookingCode: data?.bookingCode || '',
      unitCode: data?.unitCode || '',
      pin: data?.pin || data?.accessPin || '',
      accessPin: data?.accessPin || data?.pin || '',
      pinUpdatedAt: data?.pinUpdatedAt,
      qrAccessToken: data?.qrAccessToken,
    }
  },

  async getBookingPin(id: string) {
    return this.getAccessPin(id)
  },

  async updatePin(id: string, newPin: string) {
    const response = await api.put(`/api/v1/bookings/${id}/access-pin`, { newPin })
    return response.data?.data as BookingPinData
  },

  async updateBookingPin(id: string, newPin: string) {
    return this.updatePin(id, newPin)
  },

  async updatePinByUnit(unitId: string, newPin: string) {
    const response = await api.put(`/api/v1/bookings/unit/${unitId}/access-pin`, { newPin })
    return response.data?.data as BookingPinData
  },

  async getBookingPinByUnit(unitId: string) {
    const response = await api.get(`/api/v1/bookings/unit/${unitId}/access-pin`)
    return response.data?.data as BookingPinData
  },

  async renewBooking(id: string, extraMonths: number = 1) {
    const response = await api.post(`/api/v1/bookings/${id}/renew`, null, {
      params: { extraMonths },
    })
    return response.data?.data as Booking
  },

  async remoteUnlock(id: string) {
    const response = await api.post(`/api/v1/bookings/${id}/remote-unlock`)
    return response.data?.data as Booking
  },
}
