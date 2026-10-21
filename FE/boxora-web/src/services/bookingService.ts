import { api } from '../lib/axios'
import { toPageResult } from '../lib/pageResult'
import type {
  Booking,
  BookingCancellationPreview,
  BookingCancelResponse,
  BookingRescheduleEligibility,
  BookingRescheduleHistory,
  BookingRescheduleResponse,
  PageResult,
  RequestOptions,
} from '../types'

export interface BookingCreatePayload {
  storageUnitId: string
  customerId?: string
  startDate: string
  rentalMonths: number
  totalRentalFee?: number
  depositPaid?: number
  signingMethod?: 'ONLINE' | 'IN_PERSON'
  expectedCheckInAt?: string
  checkInTime?: string
}

/** `GET /bookings` filters. The backend scopes the list by role (customer: own; staff / facility manager: their facility). */
export interface BookingListParams {
  customerId?: string
  /** Honoured for business managers and admins; staff and facility managers are always scoped to their facility. */
  facilityId?: string
  /** One status or several (sent comma-separated, e.g. `ACTIVE,OVERDUE`). */
  status?: string | string[]
  /** Booking code, unit code, customer name, phone or email. */
  q?: string
  /** 0-based page. */
  page?: number
  /** Page size (max 200). */
  size?: number
}

/** `POST /bookings/{id}/cancel`. The bank account is optional: it can be added later on the refund. */
export interface BookingCancelPayload {
  cancellationReason?: string
  bankName?: string
  bankAccountNumber?: string
  bankAccountName?: string
}

export interface BookingReschedulePayload {
  newStartDate: string
  newExpectedCheckInAt?: string
  newCheckInTime?: string
  reason?: string
}

/** Normalized `BookingPinResponse`. `pin` and `accessPin` carry the same value. */
export interface BookingPinData {
  bookingId: string
  bookingCode: string
  unitCode: string
  accessPin: string
  pin: string
  pinUpdatedAt?: string
  qrAccessToken?: string
}

interface RawBookingPin {
  bookingId?: string
  bookingCode?: string
  unitCode?: string
  pin?: string
  accessPin?: string
  pinUpdatedAt?: string
  qrAccessToken?: string
}

const normalizePin = (data: RawBookingPin | null | undefined, fallbackBookingId = ''): BookingPinData => {
  const pin = data?.pin || data?.accessPin || ''
  return {
    bookingId: data?.bookingId || fallbackBookingId,
    bookingCode: data?.bookingCode || '',
    unitCode: data?.unitCode || '',
    pin,
    accessPin: pin,
    pinUpdatedAt: data?.pinUpdatedAt,
    qrAccessToken: data?.qrAccessToken,
  }
}

export const bookingService = {
  async createBooking(data: BookingCreatePayload) {
    const response = await api.post('/api/v1/bookings', data)
    return response.data?.data as Booking
  },

  async getMyActive(customerId?: string, opts?: RequestOptions) {
    const response = await api.get('/api/v1/bookings/my-active', {
      params: customerId ? { customerId } : undefined,
      signal: opts?.signal,
    })
    return (response.data?.data || []) as Booking[]
  },

  async getMyBookings(customerId?: string, opts?: RequestOptions) {
    const response = await api.get('/api/v1/bookings/my-bookings', {
      params: customerId ? { customerId } : undefined,
      signal: opts?.signal,
    })
    return (response.data?.data || []) as Booking[]
  },

  async getMyRequests(opts?: RequestOptions) {
    const response = await api.get('/api/v1/bookings/my-requests', { signal: opts?.signal })
    return (response.data?.data || []) as Booking[]
  },

  async getPendingApprovals(opts?: RequestOptions) {
    const response = await api.get('/api/v1/bookings/pending-approval', { signal: opts?.signal })
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

  async getUpcomingArrivals(opts?: RequestOptions) {
    const response = await api.get('/api/v1/bookings/arrivals', { signal: opts?.signal })
    return (response.data?.data || []) as Booking[]
  },

  async getAccessCredentials(id: string, opts?: RequestOptions) {
    const response = await api.get(`/api/v1/bookings/${id}/access-credentials`, { signal: opts?.signal })
    return response.data?.data as { accessPin: string; qrAccessToken: string }
  },

  /** Role-scoped, paged list (`PageResult`, 0-based `page`). PIN and QR are never included. */
  async getAll(params?: BookingListParams, opts?: RequestOptions): Promise<PageResult<Booking>> {
    const { status, q, ...rest } = params ?? {}
    const query = {
      ...rest,
      status: Array.isArray(status) ? status.filter(Boolean).join(',') || undefined : status || undefined,
      q: q?.trim() || undefined,
    }
    const response = await api.get('/api/v1/bookings', { params: query, signal: opts?.signal })
    return toPageResult<Booking>(response.data?.data)
  },

  async getById(id: string, opts?: RequestOptions) {
    const response = await api.get(`/api/v1/bookings/${id}`, { signal: opts?.signal })
    return response.data?.data as Booking
  },

  /** GET /bookings/{id}/access-pin */
  async getAccessPin(id: string, opts?: RequestOptions): Promise<BookingPinData> {
    const response = await api.get(`/api/v1/bookings/${id}/access-pin`, { signal: opts?.signal })
    return normalizePin(response.data?.data as RawBookingPin | undefined, id)
  },

  /** PUT /bookings/{id}/access-pin */
  async updateAccessPin(id: string, newPin: string): Promise<BookingPinData> {
    const response = await api.put(`/api/v1/bookings/${id}/access-pin`, { newPin })
    return normalizePin(response.data?.data as RawBookingPin | undefined, id)
  },

  /** GET /bookings/unit/{unitId}/access-pin — `unitId` is the storage unit UUID, not its code. */
  async getAccessPinByUnit(unitId: string, opts?: RequestOptions): Promise<BookingPinData> {
    const response = await api.get(`/api/v1/bookings/unit/${unitId}/access-pin`, { signal: opts?.signal })
    return normalizePin(response.data?.data as RawBookingPin | undefined)
  },

  /** PUT /bookings/unit/{unitId}/access-pin — `unitId` is the storage unit UUID, not its code. */
  async updateAccessPinByUnit(unitId: string, newPin: string): Promise<BookingPinData> {
    const response = await api.put(`/api/v1/bookings/unit/${unitId}/access-pin`, { newPin })
    return normalizePin(response.data?.data as RawBookingPin | undefined)
  },

  /**
   * Test environment: no smart lock is connected, the backend only records the request
   * (the response message says so). Renewals go through `contractService.requestRenewal`.
   */
  async remoteUnlock(id: string) {
    const response = await api.post(`/api/v1/bookings/${id}/remote-unlock`)
    return { booking: response.data?.data as Booking, message: (response.data?.message as string) || '' }
  },

  async getRescheduleEligibility(id: string, opts?: RequestOptions) {
    const response = await api.get(`/api/v1/bookings/${id}/reschedule-eligibility`, { signal: opts?.signal })
    return response.data?.data as BookingRescheduleEligibility
  },

  /**
   * POST /bookings/{id}/reschedule (the PUT variant is a legacy alias that runs
   * the same logic and returns only the booking).
   */
  async rescheduleBooking(id: string, payload: BookingReschedulePayload) {
    const response = await api.post(`/api/v1/bookings/${id}/reschedule`, payload)
    return response.data?.data as BookingRescheduleResponse
  },

  async getRescheduleHistory(id: string, opts?: RequestOptions) {
    const response = await api.get(`/api/v1/bookings/${id}/reschedule-history`, { signal: opts?.signal })
    return (response.data?.data || []) as BookingRescheduleHistory[]
  },

  async getCancellationPreview(id: string, opts?: RequestOptions) {
    const response = await api.get(`/api/v1/bookings/${id}/cancellation-preview`, { signal: opts?.signal })
    return response.data?.data as BookingCancellationPreview
  },

  async cancelBooking(id: string, payload?: string | BookingCancelPayload) {
    const body: BookingCancelPayload = typeof payload === 'string' || payload === undefined ? { cancellationReason: payload } : payload
    const response = await api.post(`/api/v1/bookings/${id}/cancel`, {
      cancellationReason: body.cancellationReason?.trim() || undefined,
      bankName: body.bankName?.trim() || undefined,
      bankAccountNumber: body.bankAccountNumber?.replace(/\s+/g, '') || undefined,
      bankAccountName: body.bankAccountName?.trim() || undefined,
    })
    return response.data?.data as BookingCancelResponse
  },
}
