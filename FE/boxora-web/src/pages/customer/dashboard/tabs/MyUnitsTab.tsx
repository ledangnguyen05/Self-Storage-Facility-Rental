import { useEffect, type ReactNode } from 'react'
import { Package, Search } from 'lucide-react'
import { Alert, Button, EmptyState } from '@/components/ui'
import { getApiErrorMessage } from '@/lib/apiError'
import type { Booking, RentalContract } from '@/types'
import { BookingRequestsCard } from '../components/BookingRequestsCard'
import { CardGridSkeleton } from '../components/CardGridSkeleton'
import { UnitCard } from '../components/UnitCard'
import type { DashboardTab } from '../constants'
import type { UnitPinApi } from '../hooks/useUnitPin'
import type { BookingNoticeInfo } from '../lib/bookingScenario'
import { unitKey } from '../lib/portal'
import { toAccessTarget } from '../lib/unitAccess'
import type { OpenDialog } from '../types'

interface MyUnitsTabProps {
  contracts: RentalContract[]
  contractsLoading: boolean
  contractsError: unknown
  onRetryContracts: () => void
  requests: Booking[]
  requestsError: unknown
  onRetryRequests: () => void
  bookingsById: Map<string, Booking>
  noticeMap: Map<string, BookingNoticeInfo>
  pendingCheckInCount: number
  pins: UnitPinApi
  /** Raw `?unit=` value. */
  highlightedUnit: string | null
  onClearHighlight: () => void
  onOpenDialog: OpenDialog
  onReportIssue: (contract: RentalContract) => void
  onGoToTab: (tab: DashboardTab) => void
  /** Bumped after payments so each card reloads its balance. */
  balanceRefreshKey?: number
}

/** "Kho của tôi": open requests, then one card per held unit with PIN access and a manage menu. */
export function MyUnitsTab({
  contracts,
  contractsLoading,
  contractsError,
  onRetryContracts,
  requests,
  requestsError,
  onRetryRequests,
  bookingsById,
  noticeMap,
  pendingCheckInCount,
  pins,
  highlightedUnit,
  onClearHighlight,
  onOpenDialog,
  onReportIssue,
  onGoToTab,
  balanceRefreshKey = 0,
}: MyUnitsTabProps) {
  const highlightKey = unitKey(highlightedUnit)

  // Bring the deep-linked unit (?unit=) into view once its card is rendered.
  useEffect(() => {
    if (!highlightKey || contractsLoading) return undefined
    const id = window.setTimeout(() => {
      document.getElementById(`unit-card-${highlightKey}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 150)
    return () => window.clearTimeout(id)
  }, [highlightKey, contractsLoading])

  let content: ReactNode
  if (contractsLoading) {
    content = <CardGridSkeleton count={2} />
  } else if (contractsError && contracts.length === 0) {
    content = (
      <Alert
        tone="danger"
        title="Không tải được danh sách kho"
        action={
          <Button size="sm" variant="secondary" onClick={onRetryContracts}>
            Thử lại
          </Button>
        }
      >
        {getApiErrorMessage(contractsError)}
      </Alert>
    )
  } else if (contracts.length === 0) {
    content = (
      <EmptyState
        icon={Package}
        title={pendingCheckInCount > 0 ? 'Chưa có kho đang hoạt động' : 'Bạn chưa thuê kho nào'}
        description={
          pendingCheckInCount > 0
            ? 'Kho bạn đã đặt sẽ hiển thị tại đây kèm mã PIN sau khi cơ sở bàn giao.'
            : 'Tìm kho có kích thước và vị trí phù hợp để bắt đầu.'
        }
        action={
          <div className="flex flex-wrap justify-center gap-2">
            {pendingCheckInCount > 0 ? (
              <Button variant="secondary" onClick={() => onGoToTab('bookings')}>
                Xem đơn đặt chỗ
              </Button>
            ) : null}
            <Button leftIcon={Search} onClick={() => onGoToTab('explore')}>
              Tìm kho trống
            </Button>
          </div>
        }
        className="rounded-lg border border-line bg-surface"
      />
    )
  } else {
    content = (
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {contracts.map(contract => (
          <UnitCard
            key={contract.id}
            contract={contract}
            booking={contract.bookingId ? bookingsById.get(contract.bookingId) : undefined}
            pin={pins.get(contract.id)}
            highlighted={Boolean(highlightKey) && unitKey(contract.unitCode) === highlightKey}
            onClearHighlight={onClearHighlight}
            refreshKey={balanceRefreshKey}
            onRenew={c => onOpenDialog({ type: 'renew', contract: c })}
            onPayOutstanding={c => onOpenDialog({ type: 'pay-outstanding', contract: c })}
            onMoveOut={(c, booking) => onOpenDialog({ type: 'move-out', contract: c, booking })}
            onChangePin={c => onOpenDialog({ type: 'change-pin', contract: c })}
            onViewContract={c => onOpenDialog({ type: 'contract', contract: c })}
            onReschedule={booking => onOpenDialog({ type: 'reschedule', booking })}
            onCancelBooking={booking => onOpenDialog({ type: 'cancel', booking })}
            onReportIssue={onReportIssue}
            onViewPolicy={c => onOpenDialog({ type: 'policy', facilityId: c.facilityId, facilityName: c.facilityName })}
            onTogglePin={c => pins.toggle(c.id, toAccessTarget(c))}
            onRetryPin={c => void pins.retry(c.id, toAccessTarget(c))}
          />
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <BookingRequestsCard
        requests={requests}
        error={requestsError}
        noticeMap={noticeMap}
        onRetry={onRetryRequests}
        onPay={booking => onOpenDialog({ type: 'pay', booking })}
        onViewDetails={booking => onOpenDialog({ type: 'booking-details', booking })}
        onViewAll={() => onGoToTab('bookings')}
      />
      {content}
    </div>
  )
}
