import { useMemo, useState, type ReactNode } from 'react'
import { CalendarX2, RefreshCw, Search, ShieldCheck } from 'lucide-react'
import { Alert, Button, EmptyState, IconButton, Pagination, SearchInput, Tabs } from '@/components/ui'
import { usePagination } from '@/hooks/usePagination'
import { getApiErrorMessage } from '@/lib/apiError'
import type { Booking } from '@/types'
import { BookingCard } from '../components/BookingCard'
import { CardGridSkeleton } from '../components/CardGridSkeleton'
import type { DashboardTab } from '../constants'
import { getBookingNoticeInfo, type BookingNoticeInfo } from '../lib/bookingScenario'
import { matchesSearch } from '../lib/portal'
import type { OpenDialog } from '../types'

/**
 * Filter chips. Every booking belongs to exactly one chip (see `chipOf`), so the chip counts add up to "Tất cả".
 * "Đang trả kho" covers CHECKOUT_REQUESTED and INSPECTED; "Chờ ký hợp đồng" is a paid booking whose contract is unsigned.
 */
const STATUS_FILTERS = [
  'ALL',
  'PENDING_APPROVAL',
  'CONFIRMED',
  'PENDING_PAYMENT',
  'PENDING_SIGNATURE',
  'ACTIVE',
  'RETURNING',
  'COMPLETED',
  'CANCELLED',
  'OVERDUE',
] as const
type StatusFilter = (typeof STATUS_FILTERS)[number]

const FILTER_LABELS: Record<StatusFilter, string> = {
  ALL: 'Tất cả',
  PENDING_APPROVAL: 'Chờ duyệt',
  CONFIRMED: 'Đã xác nhận',
  PENDING_PAYMENT: 'Chờ thanh toán',
  PENDING_SIGNATURE: 'Chờ ký hợp đồng',
  ACTIVE: 'Đang thuê',
  RETURNING: 'Đang trả kho',
  COMPLETED: 'Hoàn tất',
  CANCELLED: 'Đã hủy',
  OVERDUE: 'Quá hạn',
}

const PAGE_SIZES = [10, 20, 50]

const infoOf = (booking: Booking, noticeMap: Map<string, BookingNoticeInfo>) =>
  noticeMap.get(booking.id) ?? getBookingNoticeInfo(booking)

/** The single chip a booking is listed under. */
function chipOf(booking: Booking, noticeMap: Map<string, BookingNoticeInfo>): Exclude<StatusFilter, 'ALL'> | null {
  const status = (booking.status ?? '').toUpperCase()
  if (status === 'CHECKOUT_REQUESTED' || status === 'INSPECTED') return 'RETURNING'
  if (status === 'CONFIRMED' || status === 'PENDING_PAYMENT') {
    if (infoOf(booking, noticeMap).scenario === 'PAID_UNSIGNED') return 'PENDING_SIGNATURE'
    return status
  }
  if (status === 'PENDING_APPROVAL' || status === 'ACTIVE' || status === 'COMPLETED' || status === 'CANCELLED' || status === 'OVERDUE') return status
  return null
}

function matchesFilter(booking: Booking, filter: StatusFilter, noticeMap: Map<string, BookingNoticeInfo>) {
  return filter === 'ALL' || chipOf(booking, noticeMap) === filter
}

interface BookingsTabProps {
  bookings: Booking[]
  isLoading: boolean
  isRefreshing: boolean
  error: unknown
  onRetry: () => void
  noticeMap: Map<string, BookingNoticeInfo>
  onOpenDialog: OpenDialog
  onGoToUnit: (unitCode: string) => void
  onGoToTab: (tab: DashboardTab) => void
}

/** "Đặt chỗ": every reservation with its status, scenario notice and next action. */
export function BookingsTab({ bookings, isLoading, isRefreshing, error, onRetry, noticeMap, onOpenDialog, onGoToUnit, onGoToTab }: BookingsTabProps) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL')
  const [search, setSearch] = useState('')

  const counts = useMemo(() => {
    const result = {} as Record<StatusFilter, number>
    for (const filter of STATUS_FILTERS) result[filter] = 0
    for (const booking of bookings) {
      for (const filter of STATUS_FILTERS) if (matchesFilter(booking, filter, noticeMap)) result[filter] += 1
    }
    return result
  }, [bookings, noticeMap])

  const filtered = bookings.filter(
    booking =>
      matchesFilter(booking, statusFilter, noticeMap) &&
      matchesSearch(search, [booking.bookingCode, booking.unitCode, booking.facilityName]),
  )
  const pager = usePagination({ items: filtered, initialPageSize: PAGE_SIZES[0] })
  const rows = pager.slice(filtered)
  const hasFilters = statusFilter !== 'ALL' || search.trim() !== ''

  const changeStatus = (next: StatusFilter) => {
    setStatusFilter(next)
    pager.reset()
  }
  const changeSearch = (next: string) => {
    setSearch(next)
    pager.reset()
  }

  let content: ReactNode
  if (isLoading) {
    content = <CardGridSkeleton count={4} />
  } else if (error && bookings.length === 0) {
    content = (
      <Alert
        tone="danger"
        title="Không tải được đơn đặt chỗ"
        action={
          <Button size="sm" variant="secondary" onClick={onRetry}>
            Thử lại
          </Button>
        }
      >
        {getApiErrorMessage(error)}
      </Alert>
    )
  } else if (filtered.length === 0) {
    content = (
      <EmptyState
        icon={CalendarX2}
        title={hasFilters ? 'Không có đơn phù hợp' : 'Bạn chưa có đơn đặt chỗ'}
        description={hasFilters ? 'Thử xóa bộ lọc hoặc tìm với từ khóa khác.' : 'Chọn một kho trống để đặt giữ chỗ trực tuyến.'}
        action={
          hasFilters ? (
            <Button
              variant="secondary"
              onClick={() => {
                changeStatus('ALL')
                changeSearch('')
              }}
            >
              Xóa bộ lọc
            </Button>
          ) : (
            <Button leftIcon={Search} onClick={() => onGoToTab('explore')}>
              Tìm kho trống
            </Button>
          )
        }
        className="rounded-lg border border-line bg-surface"
      />
    )
  } else {
    content = (
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {rows.map(booking => (
            <BookingCard
              key={booking.id}
              booking={booking}
              info={infoOf(booking, noticeMap)}
              onViewDetails={b => onOpenDialog({ type: 'booking-details', booking: b })}
              onPay={b => onOpenDialog({ type: 'pay', booking: b })}
              onSign={contract => onOpenDialog({ type: 'sign', contract })}
              onReschedule={b => onOpenDialog({ type: 'reschedule', booking: b })}
              onCancel={b => onOpenDialog({ type: 'cancel', booking: b })}
              onGoToUnit={onGoToUnit}
              onViewPolicy={b => onOpenDialog({ type: 'policy', facilityId: b.facilityId, facilityName: b.facilityName })}
            />
          ))}
        </div>
        <Pagination
          page={pager.page}
          pageCount={pager.pageCount}
          total={pager.total}
          pageSize={pager.pageSize}
          onPageChange={pager.setPage}
          onPageSizeChange={pager.setPageSize}
          pageSizeOptions={PAGE_SIZES}
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <SearchInput
          value={search}
          onValueChange={changeSearch}
          placeholder="Tìm mã đặt chỗ, mã kho hoặc cơ sở"
          className="w-full lg:max-w-sm"
        />
        <div className="flex items-center gap-2">
          <Button variant="secondary" leftIcon={ShieldCheck} onClick={() => onOpenDialog({ type: 'policy' })}>
            Chính sách cọc và hủy
          </Button>
          <IconButton icon={RefreshCw} variant="secondary" aria-label="Làm mới" tooltip loading={isRefreshing} onClick={onRetry} />
        </div>
      </div>
      <Tabs
        variant="segmented"
        aria-label="Lọc theo trạng thái"
        value={statusFilter}
        onValueChange={changeStatus}
        items={STATUS_FILTERS.map(filter => ({ value: filter, label: FILTER_LABELS[filter], count: counts[filter] }))}
        className="self-start"
      />
      {content}
    </div>
  )
}
