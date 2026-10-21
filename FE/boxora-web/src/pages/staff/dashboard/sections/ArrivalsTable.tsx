import React from 'react'
import { CalendarCheck, ChevronRight } from 'lucide-react'
import {
  Badge,
  Pagination,
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableError,
  TableHead,
  TableHeader,
  TableLoading,
  TableRow,
} from '@/components/ui'
import { getBookingPaymentStatusMeta, getBookingStatusMeta } from '@/constants/statusMeta'
import { DEFAULT_PAGE_SIZE, usePagination } from '@/hooks/usePagination'
import { getApiErrorMessage } from '@/lib/apiError'
import { formatCurrency, formatDate } from '@/lib/format'
import type { Booking } from '@/types'
import { formatFloor, getArrivalSchedule } from '../utils/frontDesk'

interface ArrivalsTableProps {
  rows: Booking[]
  isLoading: boolean
  error: unknown
  onRetry: () => void
  selectedId?: string
  onSelect: (booking: Booking) => void
  floorByUnitCode: Map<string, string>
  today: string
  emptyTitle: string
  emptyDescription: string
  emptyAction?: React.ReactNode
}

const COLUMNS = 7

export function ArrivalsTable({
  rows,
  isLoading,
  error,
  onRetry,
  selectedId,
  onSelect,
  floorByUnitCode,
  today,
  emptyTitle,
  emptyDescription,
  emptyAction,
}: ArrivalsTableProps) {
  const pager = usePagination({ items: rows })
  const pageRows = pager.slice(rows)
  // Phones get one card per booking (code, unit, status and schedule all readable); the table keeps loading, error and empty states.
  const hasRows = !isLoading && !error && rows.length > 0

  return (
    <>
      {hasRows ? (
        <ul className="divide-y divide-line sm:hidden" aria-label="Lịch nhận kho">
          {pageRows.map((booking) => {
            const schedule = getArrivalSchedule(booking)
            const status = getBookingStatusMeta(booking.status)
            const payment = booking.paymentStatus ? getBookingPaymentStatusMeta(booking.paymentStatus) : null
            const floor = formatFloor(booking.floorLevel || floorByUnitCode.get(booking.unitCode))
            const isLate = Boolean(schedule.date) && schedule.date < today
            return (
              <li key={booking.id}>
                <button
                  type="button"
                  onClick={() => onSelect(booking)}
                  aria-pressed={booking.id === selectedId}
                  className="flex w-full flex-col gap-1.5 px-4 py-3 text-left transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring aria-pressed:bg-accent-subtle"
                >
                  <span className="flex items-start justify-between gap-2">
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-fg">{booking.customerName || '—'}</span>
                      <span className="block text-xs tabular-nums text-fg-subtle">{booking.customerPhone || '—'}</span>
                    </span>
                    <ChevronRight size={16} strokeWidth={1.75} className="mt-1 shrink-0 text-fg-subtle" aria-hidden="true" />
                  </span>
                  <span className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-fg-muted">
                    <span className="font-mono">{booking.bookingCode || '—'}</span>
                    <span className="font-mono text-fg">
                      {booking.unitCode || '—'}
                      {floor ? ` · ${floor}` : ''}
                    </span>
                  </span>
                  <span className="flex flex-wrap items-center gap-1.5">
                    <Badge tone={status.tone} size="sm">
                      {status.label}
                    </Badge>
                    {payment ? (
                      <Badge tone={payment.tone} size="sm" variant="outline">
                        {payment.label}
                      </Badge>
                    ) : null}
                    <span className={isLate ? 'text-xs text-danger' : 'text-xs tabular-nums text-fg-subtle'}>
                      {formatDate(schedule.date || booking.startDate)} · {isLate ? 'Trễ lịch hẹn' : (schedule.time ?? 'Chưa hẹn giờ')}
                    </span>
                  </span>
                  <span className="text-xs tabular-nums text-fg-subtle">
                    Tiền cọc {formatCurrency(booking.depositPaid ?? booking.depositAmount)}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      ) : null}
      <div className={hasRows ? 'hidden sm:block' : undefined}>
        <Table aria-label="Lịch nhận kho">
          <TableHeader>
            <TableRow>
              <TableHead>Khách hàng</TableHead>
              <TableHead>Mã đặt chỗ</TableHead>
              <TableHead>Kho</TableHead>
              <TableHead>Lịch nhận</TableHead>
              <TableHead>Trạng thái</TableHead>
              <TableHead align="right" className="hidden sm:table-cell">
                Tiền cọc
              </TableHead>
              <TableHead align="right">
                <span className="sr-only">Mở</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableLoading colSpan={COLUMNS} rows={4} />
            ) : error ? (
              <TableError colSpan={COLUMNS} message={getApiErrorMessage(error, 'Không tải được lịch nhận kho.')} onRetry={onRetry} />
            ) : rows.length === 0 ? (
              <TableEmpty colSpan={COLUMNS} icon={CalendarCheck} title={emptyTitle} description={emptyDescription} action={emptyAction} />
            ) : (
              pageRows.map((booking) => {
                const schedule = getArrivalSchedule(booking)
                const status = getBookingStatusMeta(booking.status)
                const payment = booking.paymentStatus ? getBookingPaymentStatusMeta(booking.paymentStatus) : null
                const floor = formatFloor(booking.floorLevel || floorByUnitCode.get(booking.unitCode))
                const isLate = Boolean(schedule.date) && schedule.date < today
                return (
                  <TableRow
                    key={booking.id}
                    selected={booking.id === selectedId}
                    onClick={() => onSelect(booking)}
                  >
                    <TableCell>
                      <div className="font-medium text-fg">{booking.customerName || '—'}</div>
                      <div className="text-xs tabular-nums text-fg-subtle">{booking.customerPhone || '—'}</div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap font-mono">{booking.bookingCode || '—'}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      <div className="font-mono text-fg">{booking.unitCode || '—'}</div>
                      {floor ? <div className="text-xs text-fg-subtle">{floor}</div> : null}
                    </TableCell>
                    <TableCell>
                      <div className="tabular-nums">{formatDate(schedule.date || booking.startDate)}</div>
                      <div className={isLate ? 'text-xs text-danger' : 'text-xs tabular-nums text-fg-subtle'}>
                        {isLate ? 'Trễ lịch hẹn' : (schedule.time ?? 'Chưa hẹn giờ')}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        <Badge tone={status.tone} size="sm">
                          {status.label}
                        </Badge>
                        {payment ? (
                          <Badge tone={payment.tone} size="sm" variant="outline">
                            {payment.label}
                          </Badge>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell numeric className="hidden whitespace-nowrap sm:table-cell">
                      {formatCurrency(booking.depositPaid ?? booking.depositAmount)}
                    </TableCell>
                    <TableCell align="right">
                      <ChevronRight size={16} strokeWidth={1.75} className="ml-auto text-fg-subtle" aria-hidden="true" />
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
      {!isLoading && !error && pager.total > DEFAULT_PAGE_SIZE ? (
        <div className="border-t border-line px-4 py-3">
          <Pagination
            page={pager.page}
            pageCount={pager.pageCount}
            total={pager.total}
            pageSize={pager.pageSize}
            onPageChange={pager.setPage}
            onPageSizeChange={pager.setPageSize}
          />
        </div>
      ) : null}
    </>
  )
}
