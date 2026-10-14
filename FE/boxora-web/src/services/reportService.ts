import { api } from '../lib/axios'
import { RevenueReport, OccupancyReport, OverdueDebtReport } from '../types'

export const reportService = {
  async getRevenueReport(fromDate?: string, toDate?: string, facilityId?: string) {
    const response = await api.get('/api/v1/reports/revenue', {
      params: {
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
        facilityId: facilityId && facilityId !== 'all' ? facilityId : undefined,
      },
    })
    return response.data?.data as RevenueReport
  },

  async getOccupancyReport(facilityId?: string) {
    const response = await api.get('/api/v1/reports/occupancy', {
      params: {
        facilityId: facilityId && facilityId !== 'all' ? facilityId : undefined,
      },
    })
    return response.data?.data as OccupancyReport
  },

  async getOverdueDebtReport(params?: { facilityId?: string }) {
    const response = await api.get('/api/v1/reports/overdue-debt', {
      params: {
        facilityId: params?.facilityId && params.facilityId !== 'all' ? params.facilityId : undefined,
      },
    })
    return response.data?.data as OverdueDebtReport
  },
}
