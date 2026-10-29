import { api } from '../lib/axios'
import {
  Booking,
  BookingCancellationPreview,
  BookingCancelResponse,
  BookingRescheduleEligibility,
  BookingRescheduleHistory,
  BookingRescheduleResponse,
} from '../types'
import { PageResult } from './userService'

export interface BookingCreatePayload {
  bookingCode?: string
  storageUnitId?: string
  facilityId?: string
  unitTypeId?: string
  fullName?: string
  phone?: string
  email?: string
  customerName?: string
  customerPhone?: string
  customerEmail?: string
  specialNotes?: string
  initialStatus?: string
  customerId?: string
  startDate: string
  expectedArrivalAt?: string
  requiresManagerApproval?: boolean
  rentalMonths: number
  totalRentalFee?: number
  depositPaid?: number
  depositAmount?: number
  signingMethod?: 'ONLINE' | 'IN_PERSON'
  expectedCheckInAt?: string
  checkInTime?: string
  identityCardNumber?: string
  identityCardType?: string
}

export interface BookingReschedulePayload {
  newStartDate: string
  newExpectedCheckInAt?: string
  newCheckInTime?: string
  reason?: string
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

  async updateUnpaidBooking(id: string, data: BookingCreatePayload) {
    const response = await api.put(`/api/v1/bookings/${id}/unpaid-revision`, data)
    return response.data?.data as Booking
  },

  async invalidateSignedContract(id: string) {
    const response = await api.post(`/api/v1/bookings/${id}/invalidate-signed-contract`)
    return response.data?.data as Booking
  },

  async getMyActive(customerId?: string) {
    const response = await api.get('/api/v1/bookings/my-active', {
      params: customerId ? { customerId } : undefined,
    })
    return (response.data?.data || []) as Booking[]
  },

  async getMyBookings(customerId?: string) {
    const response = await api.get('/api/v1/bookings/my-bookings', {
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

  async decideRequest(id: string, approved: boolean, assignedStaffId?: string, notes?: string) {
    const response = await api.post(`/api/v1/bookings/${id}/decision`, {
      approved,
      assignedStaffId,
      notes,
    })
    return response.data?.data as Booking
  },

  async getUpcomingArrivals(facilityId?: string, params?: { timeframe?: string; fromDate?: string; toDate?: string }) {
    const response = await api.get('/api/v1/bookings/arrivals', {
      params: {
        ...(facilityId ? { facilityId } : {}),
        ...(params?.timeframe ? { timeframe: params.timeframe } : {}),
        ...(params?.fromDate ? { fromDate: params.fromDate } : {}),
        ...(params?.toDate ? { toDate: params.toDate } : {}),
      },
    })
    return (response.data?.data || []) as Booking[]
  },

  async claimCheckInReception(id: string) {
    const response = await api.post(`/api/v1/bookings/${id}/claim-reception`)
    return response.data?.data as Booking
  },

  async getAccessCredentials(id: string) {
    const response = await api.get(`/api/v1/bookings/${id}/access-credentials`)
    return response.data?.data as { accessPin: string; qrAccessToken: string }
  },

  async getAll(params?: { customerId?: string; facilityId?: string; status?: string; page?: number; size?: number }) {
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

  async rescheduleBooking(id: string, payload: BookingReschedulePayload) {
    const response = await api.put(`/api/v1/bookings/${id}/reschedule`, payload)
    return response.data?.data as Booking
  },

  async getRescheduleEligibility(id: string) {
    const response = await api.get(`/api/v1/bookings/${id}/reschedule-eligibility`)
    return response.data?.data as BookingRescheduleEligibility
  },

  async rescheduleBookingDetailed(id: string, payload: BookingReschedulePayload) {
    const response = await api.post(`/api/v1/bookings/${id}/reschedule`, payload)
    return response.data?.data as BookingRescheduleResponse
  },

  async getRescheduleHistory(id: string) {
    const response = await api.get(`/api/v1/bookings/${id}/reschedule-history`)
    return (response.data?.data || []) as BookingRescheduleHistory[]
  },

  async getCancellationPreview(id: string) {
    const response = await api.get(`/api/v1/bookings/${id}/cancellation-preview`)
    return response.data?.data as BookingCancellationPreview
  },

  async cancelBooking(
    idOrCode: string,
    cancellationReasonOrData?: string | {
      cancellationReason?: string
      bankName?: string
      bankAccountNumber?: string
      bankAccountName?: string
    }
  ) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(idOrCode)
    const url = isUuid
      ? `/api/v1/bookings/${idOrCode}/cancel`
      : `/api/v1/bookings/code/${encodeURIComponent(idOrCode)}/cancel`
    const body = typeof cancellationReasonOrData === 'string'
      ? { cancellationReason: cancellationReasonOrData.trim() || undefined }
      : {
          cancellationReason: cancellationReasonOrData?.cancellationReason?.trim() || undefined,
          bankName: cancellationReasonOrData?.bankName?.trim() || undefined,
          bankAccountNumber: cancellationReasonOrData?.bankAccountNumber?.trim() || undefined,
          bankAccountName: cancellationReasonOrData?.bankAccountName?.trim() || undefined,
        }
    const response = await api.post(url, body)
    window.dispatchEvent(new Event('boxora:notifications-refresh'))
    return response.data?.data as BookingCancelResponse
  },

  async confirmBooking(idOrCode: string, notes?: string) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(idOrCode)
    const url = isUuid
      ? `/api/v1/bookings/${idOrCode}/confirm`
      : `/api/v1/bookings/code/${encodeURIComponent(idOrCode)}/confirm`
    const response = await api.post(url, {
      notes: notes?.trim() || undefined,
    })
    window.dispatchEvent(new Event('boxora:notifications-refresh'))
    return response.data?.data as Booking
  },

    async assignUnitAndProvision(idOrCode: string, unitId: string, notes?: string) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(idOrCode)
    const url = isUuid
      ? `/api/v1/bookings/${idOrCode}/assign-unit`
      : `/api/v1/bookings/code/${encodeURIComponent(idOrCode)}/assign-unit`
    const response = await api.post(url, {
      unitId,
      notes,
    })
    window.dispatchEvent(new Event('boxora:notifications-refresh'))
    return response.data?.data as Booking
  },

  async getByBookingCode(code: string) {
    const response = await api.get(`/api/v1/bookings/code/${encodeURIComponent(code)}`)
    return response.data?.data as Booking
  },
}
