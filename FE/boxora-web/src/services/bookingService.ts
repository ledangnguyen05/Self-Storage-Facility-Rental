import { api } from '../lib/axios'
import { Booking } from '../types'
import { PageResult } from './userService'

export const bookingService = {
  async create(data: { storageUnitId: string; customerId?: string; startDate: string; rentalMonths: number; totalRentalFee?: number }) {
    const response = await api.post('/api/v1/bookings', data)
    return response.data?.data as Booking
  },

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

  async getAccessPin(id: string) {
    const response = await api.get(`/api/v1/bookings/${id}/access-pin`)
    return response.data?.data as { bookingId: string; bookingCode: string; unitCode: string; pin: string; pinUpdatedAt?: string }
  },

  async remoteUnlock(id: string) {
    const response = await api.post(`/api/v1/bookings/${id}/remote-unlock`)
    return response.data?.data as Booking
  },
}
