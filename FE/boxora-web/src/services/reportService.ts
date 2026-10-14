import { api } from '../lib/axios'
import { RevenueReport, OccupancyReport, OverdueDebtReport } from '../types'

export const reportService = {
  async getRevenueReport(fromDate?: string, toDate?: string, facilityId?: string) {
    const response = await api.get('/api/v1/reports/revenue', {
      params: { fromDate, toDate, facilityId },
    })
    return response.data?.data as RevenueReport
  },

  async getOccupancyReport() {
    const response = await api.get('/api/v1/reports/occupancy')
    return response.data?.data as OccupancyReport
  },

  async getOverdueDebtReport(params?: { facilityId?: string }) {
    const response = await api.get('/api/v1/reports/overdue-debt', { params })
    return response.data?.data as OverdueDebtReport
  },
}
