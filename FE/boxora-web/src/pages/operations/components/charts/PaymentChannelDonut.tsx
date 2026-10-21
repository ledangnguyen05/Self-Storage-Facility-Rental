import { useMemo } from 'react'
import { PieChart } from 'lucide-react'
import { Alert, Button, Card, CardContent, CardHeader, EmptyState, Skeleton, cn } from '@/components/ui'
import { getApiErrorMessage } from '@/lib/apiError'
import { formatCurrency, formatNumber, formatPercent } from '@/lib/format'
import type { PaymentChannelReport } from '@/types'
import { toChannelSlices } from '../../lib/paymentStats'
import { getChartColor } from './chartColors'
import { DonutChart } from './DonutChart'

export interface PaymentChannelDonutProps {
  /** Paid payments of the selected period grouped by channel, already filtered by the server. */
  report: PaymentChannelReport | undefined
  isLoading: boolean
  error: unknown
  onRetry: () => void
}

/** Share of paid payments per channel (VNPay, bank transfer, MoMo, cash …) in the selected period. */
export function PaymentChannelDonut({ report, isLoading, error, onRetry }: PaymentChannelDonutProps) {
  const channels = useMemo(() => toChannelSlices(report), [report])
  const total = report?.totalCount ?? 0

  return (
    <Card className="h-full">
      <CardHeader title="Kênh thanh toán" description={isLoading ? 'Đang tải…' : `Phân bổ ${formatNumber(total)} giao dịch đã thanh toán trong kỳ`} divider />
      <CardContent className="flex flex-col gap-5">
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
          <div className="flex flex-col items-center gap-4" aria-busy="true">
            <Skeleton className="size-40 rounded-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
          </div>
        ) : total === 0 ? (
          <EmptyState icon={PieChart} size="sm" title="Chưa có giao dịch" description="Kênh thanh toán hiển thị khi có giao dịch đã thanh toán trong kỳ." />
        ) : (
          <>
            <DonutChart
              aria-label="Tỷ trọng giao dịch theo kênh thanh toán"
              segments={channels.map(channel => ({ key: channel.key, value: channel.count, colorIndex: channel.colorIndex }))}
              centerValue={formatNumber(total)}
              centerLabel="giao dịch"
            />
            <ul className="flex flex-col divide-y divide-line">
              {channels.map(channel => (
                <li key={channel.key} className="flex items-center justify-between gap-3 py-2 text-dense">
                  <span className="flex min-w-0 items-center gap-2 text-fg-muted">
                    <span className={cn('size-2.5 shrink-0 rounded-sm', getChartColor(channel.colorIndex).bg)} aria-hidden="true" />
                    <span className="truncate">{channel.label}</span>
                  </span>
                  <span className="shrink-0 text-right tabular-nums text-fg">
                    <span className="font-medium">{formatNumber(channel.count)}</span>
                    <span className="ml-2 text-fg-subtle">{formatPercent((channel.count / total) * 100, { fractionDigits: 1 })}</span>
                    <span className="block text-xs text-fg-subtle">{formatCurrency(channel.amount)}</span>
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  )
}
