import { useMemo, useState } from 'react'
import { ChartColumn } from 'lucide-react'
import { Alert, Button, Card, CardContent, CardHeader, EmptyState, Skeleton, cn } from '@/components/ui'
import { formatCurrency, formatNumber } from '@/lib/format'
import { getApiErrorMessage } from '@/lib/apiError'
import type { RevenueTrend } from '@/types'
import { REVENUE_STREAMS, getRevenueStreamLabel, toChartMonths, type RevenueStream } from '../../lib/paymentStats'
import { getChartColor } from './chartColors'
import { StackedBarChart, type BarStream } from './StackedBarChart'

export interface RevenueTrendChartProps {
  /** Monthly revenue of the selected period, already filtered by the server. */
  trend: RevenueTrend | undefined
  isLoading: boolean
  error: unknown
  onRetry: () => void
}

const STREAMS: readonly BarStream[] = REVENUE_STREAMS.map((key, index) => ({
  key,
  label: getRevenueStreamLabel(key),
  colorIndex: index,
}))

/** Monthly money collected, split by payment type, for the selected scope and period. */
export function RevenueTrendChart({ trend, isLoading, error, onRetry }: RevenueTrendChartProps) {
  const [hoverKey, setHoverKey] = useState<string | null>(null)
  // A pinned month belongs to the data it was picked on: a new period or facility starts without one.
  const [pinned, setPinned] = useState<{ trend: RevenueTrend | undefined; key: string } | null>(null)
  const months = useMemo(() => toChartMonths(trend), [trend])
  const pinnedKey = pinned && pinned.trend === trend && months.some(month => month.monthKey === pinned.key) ? pinned.key : null
  const activeKey = hoverKey ?? pinnedKey

  const totals = useMemo(() => {
    const sums = Object.fromEntries(REVENUE_STREAMS.map(key => [key, 0])) as Record<RevenueStream, number>
    for (const month of months) for (const key of REVENUE_STREAMS) sums[key] += month.byStream[key]
    return sums
  }, [months])

  const activeMonth = months.find(month => month.monthKey === activeKey)
  const visibleStreams = STREAMS.filter(stream => totals[stream.key] > 0)
  const refunded = activeMonth ? activeMonth.refunded : (trend?.totalRefunded ?? 0)
  const hasActivity = trend ? trend.totalCollected !== 0 || trend.totalRefunded !== 0 : false

  const description = isLoading
    ? 'Đang tải dữ liệu thanh toán…'
    : trend
      ? `${formatNumber(trend.totalPaymentCount)} giao dịch đã thanh toán, nhóm theo tháng`
      : 'Doanh thu theo tháng trong kỳ đã chọn'

  return (
    <Card className="h-full">
      <CardHeader title="Xu hướng doanh thu" description={description} divider />
      <CardContent className="flex flex-col gap-4">
        {error ? (
          <Alert
            tone="danger"
            title="Không tải được dữ liệu thanh toán"
            action={
              <Button size="sm" variant="secondary" onClick={onRetry}>
                Thử lại
              </Button>
            }
          >
            {getApiErrorMessage(error)}
          </Alert>
        ) : isLoading ? (
          <div className="flex flex-col gap-3" aria-busy="true">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-56 w-full" />
          </div>
        ) : !hasActivity ? (
          <EmptyState icon={ChartColumn} size="sm" title="Chưa có thanh toán trong kỳ" description="Biểu đồ xuất hiện khi có giao dịch đã thanh toán trong phạm vi đang chọn." />
        ) : (
          <>
            <ul className="flex flex-wrap gap-x-5 gap-y-2" aria-label="Chú giải biểu đồ">
              {visibleStreams.map(stream => (
                <li key={stream.key} className="flex items-center gap-2 text-dense text-fg-muted">
                  <span className={cn('size-2.5 rounded-sm', getChartColor(stream.colorIndex).bg)} aria-hidden="true" />
                  <span>{stream.label}</span>
                  <span className="font-medium tabular-nums text-fg">{formatCurrency(activeMonth ? activeMonth.byStream[stream.key] : totals[stream.key])}</span>
                </li>
              ))}
              {refunded > 0 ? (
                <li className="flex items-center gap-2 text-dense text-fg-muted">
                  <span>Đã hoàn khách (không nằm trong cột)</span>
                  <span className="font-medium tabular-nums text-danger">{formatCurrency(refunded)}</span>
                </li>
              ) : null}
            </ul>
            <p className="text-xs text-fg-subtle" aria-live="polite">
              {activeMonth ? `Tháng ${activeMonth.label.slice(1)}` : 'Tổng các tháng đang hiển thị'}.
              <span className="print:hidden"> {pinnedKey ? 'Bấm lại vào cột đó để bỏ chọn.' : 'Bấm vào một cột để xem chi tiết tháng.'}</span>
            </p>
            <StackedBarChart
              months={months}
              streams={STREAMS}
              activeKey={activeKey}
              selectedKey={pinnedKey}
              onActiveChange={setHoverKey}
              onSelect={key => setPinned(current => (current && current.trend === trend && current.key === key ? null : { trend, key }))}
              aria-label="Doanh thu theo tháng"
            />
          </>
        )}
      </CardContent>
    </Card>
  )
}
