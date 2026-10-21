import { useMemo } from 'react'
import { useAsyncData } from '@/hooks/useAsyncData'
import { reportService } from '@/services/reportService'
import type { OccupancyFigures, RevenueFigures } from '@/types'
import type { DateRange } from '../lib/dateRange'

/**
 * Report queries for the business-manager dashboard. Every query is scoped by `facilityId` and, when it
 * is about money, by the selected period: both filters are applied by the server, so a long ago period
 * is as complete as the current one.
 */
export function useOperationsReports(facilityId: string | undefined, range: DateRange) {
  const from = range.from || undefined
  const to = range.to || undefined

  const revenue = useAsyncData(signal => reportService.getRevenueReport(from, to, facilityId, { signal }), [from, to, facilityId])
  const trend = useAsyncData(signal => reportService.getRevenueTrend(from, to, facilityId, { signal }), [from, to, facilityId])
  const channels = useAsyncData(signal => reportService.getPaymentChannels(from, to, facilityId, { signal }), [from, to, facilityId])
  const occupancy = useAsyncData(signal => reportService.getOccupancyReport(facilityId, { signal }), [facilityId])
  const debt = useAsyncData(
    signal => reportService.getOverdueDebtReport(facilityId ? { facilityId } : undefined, { signal }),
    [facilityId],
  )

  const scopeRevenue = useMemo<RevenueFigures | null>(() => {
    const report = revenue.data
    if (!report) return null
    if (!facilityId) return report.systemSummary ?? null
    return report.byFacility?.find(item => item.facilityId === facilityId) ?? null
  }, [revenue.data, facilityId])

  const scopeOccupancy = useMemo<OccupancyFigures | undefined>(() => {
    const report = occupancy.data
    if (!report) return undefined
    if (!facilityId) return report.systemSummary
    return report.byFacility?.find(item => item.facilityId === facilityId)
  }, [occupancy.data, facilityId])

  const reloadAll = () =>
    Promise.all([revenue.reload(), trend.reload(), channels.reload(), occupancy.reload(), debt.reload()]).then(() => undefined)

  return { revenue, trend, channels, occupancy, debt, scopeRevenue, scopeOccupancy, reloadAll }
}
