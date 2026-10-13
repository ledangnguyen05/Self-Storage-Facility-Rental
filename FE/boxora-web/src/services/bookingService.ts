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
  accessPin: string
  unitCode?: string
  encryptedAt?: string
}

export const bookingService = {
  async getUpcomingArrivals() {
    const response = await api.get('/api/v1/bookings/arrivals')
    return response.data?.data as Booking[]
  },

  async getAll(params?: { customerId?: string; status?: string; page?: number; size?: number }) {
    const response = await api.get('/api/v1/bookings', { params })
    return response.data?.data as PageResult<Booking>
  },

  async getMyActive(customerId?: string) {
    const response = await api.get('/api/v1/bookings/my-active', {
      params: customerId ? { customerId } : undefined
    })
    return response.data?.data as Booking[]
  },

  async getById(id: string) {
    const response = await api.get(`/api/v1/bookings/${id}`)
    return response.data?.data as Booking
  },

  async createBooking(data: BookingCreatePayload) {
    const response = await api.post('/api/v1/bookings', data)
    return response.data?.data as Booking
  },

  async getBookingPin(id: string) {
    const response = await api.get(`/api/v1/bookings/${id}/access-pin`)
    return response.data?.data as BookingPinData
  },

  async updateBookingPin(id: string, newPin: string) {
    const response = await api.put(`/api/v1/bookings/${id}/access-pin`, { newPin })
    return response.data?.data as BookingPinData
  },

  async renewBooking(id: string, extraMonths: number = 1) {
    const response = await api.post(`/api/v1/bookings/${id}/renew`, null, {
      params: { extraMonths }
    })
    return response.data?.data as Booking
  },

  async remoteUnlock(id: string) {
    const response = await api.post(`/api/v1/bookings/${id}/remote-unlock`)
    return response.data?.data as Booking
  }
}
