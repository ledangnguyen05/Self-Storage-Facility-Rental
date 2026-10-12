import { api } from '../lib/axios'
import { Booking } from '../types'
import { PageResult } from './userService'

export const bookingService = {
  async getUpcomingArrivals() {
    const response = await api.get('/api/v1/bookings/arrivals')
    return response.data?.data as Booking[]
  },

  async getAll(params?: { customerId?: string; status?: string; page?: number; size?: number }) {
    const response = await api.get('/api/v1/bookings', { params })
    return response.data?.data as PageResult<Booking>
  },

  async getById(id: string) {
    const response = await api.get(`/api/v1/bookings/${id}`)
    return response.data?.data as Booking
  },

  async createBooking(data: {
    storageUnitId: string
    customerId: string
    startDate: string
    rentalMonths: number
  }) {
    const response = await api.post('/api/v1/bookings', data)
    return response.data?.data as Booking
  },

  async getMyActive(customerId?: string) {
    const response = await api.get('/api/v1/bookings/my-active', { params: customerId ? { customerId } : {} })
    return response.data?.data as Booking[]
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
