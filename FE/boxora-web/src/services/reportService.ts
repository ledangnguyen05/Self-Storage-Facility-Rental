import { api } from '../lib/axios'
import type { OccupancyReport, OverdueDebtReport, PaymentChannelReport, RequestOptions, RevenueReport, RevenueTrend } from '../types'

/** `ALL` and empty ids mean "every facility". */
const toFacilityParam = (facilityId?: string): string | undefined => (facilityId && facilityId !== 'all' && facilityId !== 'ALL' ? facilityId : undefined)

const periodParams = (fromDate?: string, toDate?: string, facilityId?: string) => ({
  fromDate: fromDate || undefined,
  toDate: toDate || undefined,
  facilityId: toFacilityParam(facilityId),
})

export const reportService = {
  /** Net revenue (collected minus refunded) of the period, per facility and for the whole scope. */
  async getRevenueReport(fromDate?: string, toDate?: string, facilityId?: string, opts?: RequestOptions) {
    const response = await api.get('/api/v1/reports/revenue', {
      params: periodParams(fromDate, toDate, facilityId),
      signal: opts?.signal,
    })
    return response.data?.data as RevenueReport
  },

  /** Monthly revenue of the period split by payment type; filtered by the server, so old periods are complete. */
  async getRevenueTrend(fromDate?: string, toDate?: string, facilityId?: string, opts?: RequestOptions) {
    const response = await api.get('/api/v1/reports/revenue-trend', {
      params: periodParams(fromDate, toDate, facilityId),
      signal: opts?.signal,
    })
    return response.data?.data as RevenueTrend
  },

  /** Paid payments of the period grouped by payment channel. */
  async getPaymentChannels(fromDate?: string, toDate?: string, facilityId?: string, opts?: RequestOptions) {
    const response = await api.get('/api/v1/reports/payment-channels', {
      params: periodParams(fromDate, toDate, facilityId),
      signal: opts?.signal,
    })
    return response.data?.data as PaymentChannelReport
  },

  async getOccupancyReport(facilityId?: string, opts?: RequestOptions) {
    const response = await api.get('/api/v1/reports/occupancy', {
      params: { facilityId: toFacilityParam(facilityId) },
      signal: opts?.signal,
    })
    return response.data?.data as OccupancyReport
  },

  async getOverdueDebtReport(params?: { facilityId?: string }, opts?: RequestOptions) {
    const response = await api.get('/api/v1/reports/overdue-debt', {
      params: { facilityId: toFacilityParam(params?.facilityId) },
      signal: opts?.signal,
    })
    return response.data?.data as OverdueDebtReport
  },
}
