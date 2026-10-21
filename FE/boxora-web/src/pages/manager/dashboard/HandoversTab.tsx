import { useMemo } from 'react'
import { CalendarCheck, Check, KeyRound, UserPlus, X } from 'lucide-react'
import {
  Alert,
  Badge,
  Button,
  Card,
  CardHeader,
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
import { getBookingStatusMeta } from '@/constants/statusMeta'
import { usePagination } from '@/hooks/usePagination'
import { getApiErrorMessage } from '@/lib/apiError'
import { formatCurrency, formatDate, formatDateTime, parseDate, toLocalISODate, todayISO } from '@/lib/format'
import type { Booking } from '@/types'
import type { ScopedList } from './useManagerDashboardData'

interface HandoversTabProps {
  arrivals: ScopedList<Booking>
  /** Requests waiting for a decision; the card only shows when there are some (or loading them failed). */
  pendingApprovals: ScopedList<Booking>
  activeRentals: ScopedList<Booking>
  onViewBooking: (booking: Booking) => void
  /** Assign the front-desk staff member for a confirmed booking. */
  onAssignReception: (booking: Booking) => void
  /** Approve a pending request (optionally assigning the front-desk staff member). */
  onApproveRequest: (booking: Booking) => void
  onRejectRequest: (booking: Booking) => void
}

const arrivalAt = (booking: Booking) => booking.expectedCheckInAt || booking.startDate

/** Whole calendar days from today to `value` (negative when already past). Null for empty input. */
function daysUntil(value: string | null | undefined): number | null {
  const target = parseDate(value)
  const today = parseDate(todayISO())
  if (!target || !today) return null
  const targetDay = new Date(target.getFullYear(), target.getMonth(), target.getDate())
  return Math.round((targetDay.getTime() - today.getTime()) / (24 * 60 * 60 * 1000))
}

function CustomerCell({ booking }: { booking: Booking }) {
  return (
    <div className="flex min-w-0 flex-col">
      <span className="truncate font-medium text-fg">{booking.customerName || '—'}</span>
      <span className="text-xs tabular-nums text-fg-muted">{booking.customerPhone || '—'}</span>
    </div>
  )
}

function ArrivalsCard({
  list,
  onViewBooking,
  onAssignReception,
}: {
  list: ScopedList<Booking>
  onViewBooking: (booking: Booking) => void
  onAssignReception: (booking: Booking) => void
}) {
  const rows = useMemo(() => [...list.items].sort((a, b) => (arrivalAt(a) ?? '').localeCompare(arrivalAt(b) ?? '')), [list.items])
  const pager = usePagination({ items: rows })
  const today = todayISO()

  return (
    <Card className="overflow-hidden">
      <CardHeader divider title="Lịch hẹn nhận kho" description={`${rows.length} đơn đã giữ chỗ, chờ khách đến bàn giao`} />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Khách hàng</TableHead>
            <TableHead>Mã đặt kho</TableHead>
            <TableHead>Kho</TableHead>
            <TableHead>Ngày nhận</TableHead>
            <TableHead>Trạng thái</TableHead>
            <TableHead>Tiếp đón</TableHead>
            <TableHead align="right">Đã đặt cọc</TableHead>
            <TableHead align="right" className="max-md:sticky max-md:right-0 max-md:bg-surface-2">
              <span className="sr-only">Thao tác</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {list.isLoading ? (
            <TableLoading colSpan={8} />
          ) : list.error ? (
            <TableError
              colSpan={8}
              message={getApiErrorMessage(list.error, 'Không tải được lịch hẹn nhận kho.')}
              onRetry={() => void list.reload()}
            />
          ) : rows.length === 0 ? (
            <TableEmpty
              colSpan={8}
              icon={CalendarCheck}
              title="Chưa có lịch hẹn nhận kho"
              description="Đơn đặt kho đã xác nhận sẽ hiển thị tại đây."
            />
          ) : (
            pager.slice(rows).map((booking) => {
              const status = getBookingStatusMeta(booking.status)
              const isToday = toLocalISODate(arrivalAt(booking)) === today
              return (
                <TableRow key={booking.id}>
                  <TableCell>
                    <CustomerCell booking={booking} />
                  </TableCell>
                  <TableCell className="font-mono text-dense">{booking.bookingCode}</TableCell>
                  <TableCell className="whitespace-nowrap font-mono text-dense">{booking.unitCode || '—'}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    <span className="inline-flex items-center gap-2">
                      {booking.expectedCheckInAt ? formatDateTime(booking.expectedCheckInAt) : formatDate(booking.startDate)}
                      {isToday ? (
                        <Badge tone="accent" size="sm">
                          Hôm nay
                        </Badge>
                      ) : null}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge tone={status.tone} dot>
                      {status.label}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {booking.assignedStaffName ? (
                      <span className="text-dense">{booking.assignedStaffName}</span>
                    ) : (
                      <span className="text-dense text-fg-subtle">Chưa phân công</span>
                    )}
                  </TableCell>
                  <TableCell numeric>{formatCurrency(booking.depositPaid ?? booking.depositAmount)}</TableCell>
                  <TableCell align="right" className="max-md:sticky max-md:right-0 max-md:bg-surface max-md:shadow-[-8px_0_8px_-8px_rgb(0_0_0/0.15)]">
                    <div className="flex items-center justify-end gap-1.5">
                      {booking.status === 'CONFIRMED' ? (
                        <Button size="sm" variant="ghost" leftIcon={UserPlus} onClick={() => onAssignReception(booking)}>
                          {booking.assignedStaffName ? 'Đổi người' : 'Phân công'}
                        </Button>
                      ) : null}
                      <Button size="sm" variant="secondary" onClick={() => onViewBooking(booking)}>
                        Xem hồ sơ
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })
          )}
        </TableBody>
      </Table>
      {rows.length > 10 ? (
        <Pagination
          page={pager.page}
          pageCount={pager.pageCount}
          total={pager.total}
          pageSize={pager.pageSize}
          onPageChange={pager.setPage}
          onPageSizeChange={pager.setPageSize}
        />
      ) : null}
    </Card>
  )
}

function PendingApprovalsCard({
  list,
  onViewBooking,
  onApprove,
  onReject,
}: {
  list: ScopedList<Booking>
  onViewBooking: (booking: Booking) => void
  onApprove: (booking: Booking) => void
  onReject: (booking: Booking) => void
}) {
  const rows = useMemo(() => [...list.items].sort((a, b) => (a.createdAt ?? '').localeCompare(b.createdAt ?? '')), [list.items])
  if (list.isLoading || (!list.error && rows.length === 0)) return null

  return (
    <Card className="overflow-hidden">
      <CardHeader
        divider
        title="Yêu cầu thuê kho chờ duyệt"
        description={`${rows.length} yêu cầu cần quản lý duyệt trước khi khách thanh toán hoặc đến ký tại quầy`}
      />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Khách hàng</TableHead>
            <TableHead>Mã đặt kho</TableHead>
            <TableHead>Kho</TableHead>
            <TableHead>Ngày bắt đầu</TableHead>
            <TableHead>Hình thức ký</TableHead>
            <TableHead>Hạn duyệt</TableHead>
            <TableHead align="right" className="max-md:sticky max-md:right-0 max-md:bg-surface-2">
              <span className="sr-only">Thao tác</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {list.error ? (
            <TableError
              colSpan={7}
              message={getApiErrorMessage(list.error, 'Không tải được yêu cầu chờ duyệt.')}
              onRetry={() => void list.reload()}
            />
          ) : (
            rows.map((booking) => (
              <TableRow key={booking.id}>
                <TableCell>
                  <CustomerCell booking={booking} />
                </TableCell>
                <TableCell className="font-mono text-dense">{booking.bookingCode}</TableCell>
                <TableCell className="whitespace-nowrap font-mono text-dense">{booking.unitCode || '—'}</TableCell>
                <TableCell className="whitespace-nowrap">{formatDate(booking.startDate)}</TableCell>
                <TableCell>{booking.signingMethod === 'IN_PERSON' ? 'Ký tại quầy' : booking.signingMethod === 'ONLINE' ? 'Ký trực tuyến' : '—'}</TableCell>
                <TableCell className="whitespace-nowrap">{booking.paymentExpiresAt ? formatDateTime(booking.paymentExpiresAt) : '—'}</TableCell>
                <TableCell align="right" className="max-md:sticky max-md:right-0 max-md:bg-surface max-md:shadow-[-8px_0_8px_-8px_rgb(0_0_0/0.15)]">
                  <div className="flex items-center justify-end gap-1.5">
                    <Button size="sm" variant="ghost" leftIcon={X} onClick={() => onReject(booking)}>
                      Từ chối
                    </Button>
                    <Button size="sm" variant="secondary" leftIcon={Check} onClick={() => onApprove(booking)}>
                      Duyệt
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => onViewBooking(booking)}>
                      Xem hồ sơ
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </Card>
  )
}

function RentalsCard({ list, onViewBooking }: { list: ScopedList<Booking>; onViewBooking: (booking: Booking) => void }) {
  const rows = useMemo(() => [...list.items].sort((a, b) => (a.endDate ?? '').localeCompare(b.endDate ?? '')), [list.items])
  const pager = usePagination({ items: rows })

  return (
    <Card className="overflow-hidden">
      <CardHeader
        divider
        title="Đang thuê, sắp đến hạn và trả kho"
        description={`${rows.length} đơn đang thuê, quá hạn hoặc đang làm thủ tục trả kho, sắp xếp theo hạn kết thúc`}
      />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Khách hàng</TableHead>
            <TableHead>Mã đặt kho</TableHead>
            <TableHead>Kho</TableHead>
            <TableHead>Hạn kết thúc</TableHead>
            <TableHead>Còn lại</TableHead>
            <TableHead>Trạng thái</TableHead>
            <TableHead align="right">Tiền cọc</TableHead>
            <TableHead align="right" className="max-md:sticky max-md:right-0 max-md:bg-surface-2">
              <span className="sr-only">Thao tác</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {list.isLoading ? (
            <TableLoading colSpan={8} />
          ) : list.error ? (
            <TableError
              colSpan={8}
              message={getApiErrorMessage(list.error, 'Không tải được danh sách đang thuê.')}
              onRetry={() => void list.reload()}
            />
          ) : rows.length === 0 ? (
            <TableEmpty
              colSpan={8}
              icon={KeyRound}
              title="Chưa có đơn đang thuê"
              description="Các đơn đã bàn giao kho sẽ hiển thị tại đây."
            />
          ) : (
            pager.slice(rows).map((booking) => {
              const remaining = daysUntil(booking.endDate)
              const status = getBookingStatusMeta(booking.status)
              return (
                <TableRow key={booking.id}>
                  <TableCell>
                    <CustomerCell booking={booking} />
                  </TableCell>
                  <TableCell className="font-mono text-dense">{booking.bookingCode}</TableCell>
                  <TableCell className="whitespace-nowrap font-mono text-dense">{booking.unitCode || '—'}</TableCell>
                  <TableCell className="whitespace-nowrap">{formatDate(booking.endDate)}</TableCell>
                  <TableCell>
                    {remaining === null ? (
                      '—'
                    ) : remaining < 0 ? (
                      <Badge tone="danger" dot>{`Quá ${-remaining} ngày`}</Badge>
                    ) : remaining === 0 ? (
                      <Badge tone="warning" dot>
                        Hết hạn hôm nay
                      </Badge>
                    ) : (
                      <Badge tone={remaining <= 7 ? 'warning' : 'neutral'} dot>{`Còn ${remaining} ngày`}</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge tone={status.tone}>{status.label}</Badge>
                  </TableCell>
                  <TableCell numeric>{formatCurrency(booking.depositPaid ?? booking.depositAmount)}</TableCell>
                  <TableCell align="right" className="max-md:sticky max-md:right-0 max-md:bg-surface max-md:shadow-[-8px_0_8px_-8px_rgb(0_0_0/0.15)]">
                    <Button size="sm" variant="secondary" onClick={() => onViewBooking(booking)}>
                      Xem hồ sơ
                    </Button>
                  </TableCell>
                </TableRow>
              )
            })
          )}
        </TableBody>
      </Table>
      {rows.length > 10 ? (
        <Pagination
          page={pager.page}
          pageCount={pager.pageCount}
          total={pager.total}
          pageSize={pager.pageSize}
          onPageChange={pager.setPage}
          onPageSizeChange={pager.setPageSize}
        />
      ) : null}
    </Card>
  )
}

/** Handovers and returns: monitoring tables plus the front-desk staff assignment for confirmed arrivals. */
export function HandoversTab({
  arrivals,
  pendingApprovals,
  activeRentals,
  onViewBooking,
  onAssignReception,
  onApproveRequest,
  onRejectRequest,
}: HandoversTabProps) {
  return (
    <div className="flex flex-col gap-6">
      <Alert tone="info">
        Quản lý cơ sở theo dõi tiến độ và phân công nhân viên tiếp đón. Nhân viên quầy đối soát giấy tờ, nghiệm thu kho và cấp mã PIN
        bàn giao.
      </Alert>
      <PendingApprovalsCard list={pendingApprovals} onViewBooking={onViewBooking} onApprove={onApproveRequest} onReject={onRejectRequest} />
      <ArrivalsCard list={arrivals} onViewBooking={onViewBooking} onAssignReception={onAssignReception} />
      <RentalsCard list={activeRentals} onViewBooking={onViewBooking} />
    </div>
  )
}
