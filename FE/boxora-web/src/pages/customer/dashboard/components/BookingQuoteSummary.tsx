import { Alert, Button, DescriptionList, SkeletonText } from '@/components/ui'
import { getApiErrorMessage } from '@/lib/apiError'
import { formatCurrency, formatDate, formatPercent } from '@/lib/format'
import type { PricingQuoteResponse } from '@/services/pricingService'

interface BookingQuoteSummaryProps {
  quote: PricingQuoteResponse | undefined
  isLoading: boolean
  error: unknown
  onRetry: () => void
}

/** Read-only price breakdown, straight from the server quote. */
export function BookingQuoteSummary({ quote, isLoading, error, onRetry }: BookingQuoteSummaryProps) {
  if (error) {
    return (
      <Alert
        tone="danger"
        title="Không tải được báo giá"
        action={
          <Button size="sm" variant="secondary" onClick={onRetry}>
            Thử lại
          </Button>
        }
      >
        {getApiErrorMessage(error, 'Không thể tải báo giá từ máy chủ.')}
      </Alert>
    )
  }
  if (isLoading || !quote) {
    return (
      <div className="rounded-lg border border-line p-4" aria-busy="true">
        <SkeletonText lines={5} />
      </div>
    )
  }

  const discount = quote.discountAmount || 0
  return (
    <div className="rounded-lg border border-line p-4">
      <DescriptionList
        layout="inline"
        items={[
          {
            label: `Tiền thuê ${quote.rentalMonths} tháng × ${formatCurrency(quote.monthlyRate)}`,
            value: <span className="tabular-nums">{formatCurrency(quote.subtotalRentalFee)}</span>,
          },
          {
            label: quote.discountPercentage ? `Chiết khấu kỳ hạn (${formatPercent(quote.discountPercentage)})` : 'Chiết khấu kỳ hạn',
            value: <span className="tabular-nums text-success">{discount > 0 ? `−${formatCurrency(discount)}` : formatCurrency(0)}</span>,
          },
          { label: 'Tiền thuê sau ưu đãi', value: <span className="tabular-nums">{formatCurrency(quote.totalRentalFee)}</span> },
          { label: 'Tiền cọc', value: <span className="tabular-nums">{formatCurrency(quote.depositAmount)}</span> },
          { label: 'Ngày kết thúc dự kiến', value: formatDate(quote.endDate) },
          {
            label: <span className="font-medium text-fg">Tổng giá trị hợp đồng</span>,
            value: <span className="text-base font-semibold tabular-nums">{formatCurrency(quote.totalContractValue)}</span>,
          },
        ]}
      />
    </div>
  )
}
