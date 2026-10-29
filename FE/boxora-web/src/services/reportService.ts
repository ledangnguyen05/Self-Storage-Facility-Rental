import { api } from '../lib/axios'
import { RevenueReport, OccupancyReport, OverdueDebtReport } from '../types'

const sanitizeFacilityId = (id?: string | null): string | undefined => {
  if (!id) return undefined
  const clean = id.trim()
  if (!clean || clean.toLowerCase() === 'all') return undefined
  return clean
}

export const reportService = {
  async getRevenueReport(fromDate?: string, toDate?: string, facilityId?: string) {
    const response = await api.get('/api/v1/reports/revenue', {
      params: {
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
        facilityId: sanitizeFacilityId(facilityId),
      },
    })
    return response.data?.data as RevenueReport
  },

  async getOccupancyReport(facilityId?: string) {
    const response = await api.get('/api/v1/reports/occupancy', {
      params: {
        facilityId: sanitizeFacilityId(facilityId),
      },
    })
    return response.data?.data as OccupancyReport
  },

  async getOverdueDebtReport(params?: { facilityId?: string }) {
    const response = await api.get('/api/v1/reports/overdue-debt', {
      params: {
        facilityId: sanitizeFacilityId(params?.facilityId),
      },
    })
    return response.data?.data as OverdueDebtReport
  },

  async exportRevenueCsv(fromDate?: string, toDate?: string, facilityId?: string) {
    const response = await api.get('/api/v1/reports/revenue/export', {
      params: {
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
        facilityId: sanitizeFacilityId(facilityId),
      },
      responseType: 'blob',
    })
    return response.data as Blob
  },
}
