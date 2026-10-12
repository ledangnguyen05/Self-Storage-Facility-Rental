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
}
