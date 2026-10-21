import { CreditCard } from 'lucide-react'
import { Alert, Badge, Button, Card, CardHeader } from '@/components/ui'
import { getBookingStatusMeta } from '@/constants/statusMeta'
import { getApiErrorMessage } from '@/lib/apiError'
import type { Booking } from '@/types'
import { getBookingNoticeInfo, type BookingNoticeInfo } from '../lib/bookingScenario'
import { formatCheckIn, formatMonths } from '../lib/portal'

const VISIBLE_REQUESTS = 5

interface BookingRequestsCardProps {
  requests: Booking[]
  error: unknown
  noticeMap: Map<string, BookingNoticeInfo>
  onRetry: () => void
  onPay: (booking: Booking) => void
  onViewDetails: (booking: Booking) => void
  onViewAll: () => void
}

/** Open rental requests (`/bookings/my-requests`), refreshed by polling while the tab is visible. */
export function BookingRequestsCard({ requests, error, noticeMap, onRetry, onPay, onViewDetails, onViewAll }: BookingRequestsCardProps) {
  if (error && requests.length === 0) {
    return (
      <Alert
        tone="danger"
        title="Không tải được yêu cầu thuê kho"
        action={
          <Button size="sm" variant="secondary" onClick={onRetry}>
            Thử lại
          </Button>
        }
      >
        {getApiErrorMessage(error)}
      </Alert>
    )
  }
  if (requests.length === 0) return null

  return (
    <Card>
      <CardHeader
        title="Yêu cầu thuê kho"
        description="Trạng thái được cập nhật tự động."
        actions={
          requests.length > VISIBLE_REQUESTS ? (
            <Button variant="link" size="sm" onClick={onViewAll}>
              Xem tất cả
            </Button>
          ) : null
        }
      />
      <ul className="mt-3 divide-y divide-line border-t border-line">
        {requests.slice(0, VISIBLE_REQUESTS).map(request => {
          const meta = getBookingStatusMeta(request.status)
          const info = noticeMap.get(request.id) ?? getBookingNoticeInfo(request)
          return (
            <li key={request.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-fg">
                  <span className="font-mono">Kho {request.unitCode || '—'}</span> · {request.facilityName || '—'}
                </p>
                <p className="text-dense text-fg-muted">
                  <span className="font-mono">{request.bookingCode}</span> · {formatMonths(request.rentalMonths)} · Nhận kho {formatCheckIn(request)}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={meta.tone}>{meta.label}</Badge>
                <Button variant="ghost" size="sm" onClick={() => onViewDetails(request)}>
                  Chi tiết
                </Button>
                {info.canPay ? (
                  <Button size="sm" leftIcon={CreditCard} onClick={() => onPay(request)}>
                    Thanh toán
                  </Button>
                ) : null}
              </div>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}
