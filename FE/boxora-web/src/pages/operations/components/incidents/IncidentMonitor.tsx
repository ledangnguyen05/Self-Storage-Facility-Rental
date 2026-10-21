import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCheck, Eye, Siren, Timer, TriangleAlert, Wrench } from 'lucide-react'
import {
  Badge,
  Button,
  Card,
  CardHeader,
  IconButton,
  Pagination,
  Select,
  StatCard,
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableError,
  TableHead,
  TableHeader,
  TableLoading,
  TableRow,
  buttonVariants,
  cn,
} from '@/components/ui'
import {
  TICKET_CATEGORY_OPTIONS,
  TICKET_PRIORITY_OPTIONS,
  TICKET_STATUS_OPTIONS,
  getTicketCategoryMeta,
  getTicketPriorityMeta,
  getTicketStatusMeta,
} from '@/constants/statusMeta'
import { usePagination } from '@/hooks/usePagination'
import { formatNumber, formatPercent } from '@/lib/format'
import type { SupportTicketRecord, SupportTicketStats } from '@/services/supportTicketService'
import type { useIncidentData } from '../../hooks/useIncidentData'
import { SLA_LABEL, getTicketSlaState, ticketCode } from '../../lib/ticketDisplay'
import { IncidentDetailDrawer } from './IncidentDetailDrawer'

export interface IncidentMonitorProps {
  incidents: ReturnType<typeof useIncidentData>
}

interface Filters {
  category: string
  priority: string
  status: string
}

const NO_FILTERS: Filters = { category: '', priority: '', status: '' }
const COLUMN_COUNT = 8

const withAll = (label: string, options: readonly { value: string; label: string }[]) => [{ value: '', label }, ...options]
const CATEGORY_OPTIONS = withAll('Tất cả danh mục', TICKET_CATEGORY_OPTIONS)
const PRIORITY_OPTIONS = withAll('Tất cả mức ưu tiên', TICKET_PRIORITY_OPTIONS)
const STATUS_OPTIONS = withAll('Tất cả trạng thái', TICKET_STATUS_OPTIONS)

/** Legacy CRITICAL tickets are grouped with URGENT. */
const matchesPriority = (ticket: SupportTicketRecord, priority: string): boolean => {
  const value = (ticket.priority ?? '').toUpperCase()
  return priority === 'URGENT' ? value === 'URGENT' || value === 'CRITICAL' : value === priority
}

/** Tickets nobody has picked up yet: new ones plus reopened ones, the same set the "Sự cố đang mở" KPI counts. */
const waitingHint = (stats: Pick<SupportTicketStats, 'openTickets' | 'reopenedTickets'>): string => {
  const waiting = stats.openTickets + stats.reopenedTickets
  return stats.reopenedTickets > 0
    ? `${formatNumber(waiting)} chờ tiếp nhận (gồm ${formatNumber(stats.reopenedTickets)} mở lại)`
    : `${formatNumber(waiting)} chờ tiếp nhận`
}

/** Read-only incident dashboard: ticket statistics and the latest tickets of the selected scope. */
export function IncidentMonitor({ incidents }: IncidentMonitorProps) {
  const { stats, queue } = incidents
  const [filters, setFilters] = useState<Filters>(NO_FILTERS)
  const [selected, setSelected] = useState<SupportTicketRecord | null>(null)

  const tickets = useMemo(() => queue.data ?? [], [queue.data])
  const filtered = useMemo(
    () =>
      tickets.filter(
        ticket =>
          (!filters.category || ticket.category === filters.category) &&
          (!filters.priority || matchesPriority(ticket, filters.priority)) &&
          (!filters.status || (ticket.status ?? '').toUpperCase() === filters.status),
      ),
    [tickets, filters],
  )
  const pager = usePagination({ items: filtered })
  const rows = pager.slice(filtered)
  const hasFilters = Boolean(filters.category || filters.priority || filters.status)
  // Phones get one card per ticket (the eight columns would hide the status and priority in a sideways scroll).
  const showCards = !queue.isLoading && !queue.error && rows.length > 0

  const updateFilters = (patch: Partial<Filters>) => {
    setFilters(current => ({ ...current, ...patch }))
    pager.reset()
  }

  const statsData = stats.data
  const slaPercent = statsData && Number.isFinite(statsData.slaCompliancePercent) ? formatPercent(statsData.slaCompliancePercent, { fractionDigits: 0 }) : null

  return (
    <Card className="overflow-hidden">
      <CardHeader
        title="Giám sát sự cố"
        description="Tiến độ xử lý và tuân thủ SLA của sự cố tại các cơ sở. Chỉ xem, việc xử lý do nhân viên và quản lý cơ sở thực hiện."
        divider
        actions={
          <Link to="/portal/tickets" className={buttonVariants({ variant: 'secondary', size: 'sm', className: 'print:hidden' })}>
            Mở hàng đợi sự cố
          </Link>
        }
      />

      <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Tổng sự cố" icon={Wrench} loading={stats.isLoading} value={statsData ? formatNumber(statsData.totalTickets) : '—'} hint={stats.error ? 'Không tải được thống kê' : undefined} />
        <StatCard label="Đang xử lý" icon={Timer} tone="info" loading={stats.isLoading} value={statsData ? formatNumber(statsData.inProgressTickets) : '—'} hint={statsData ? waitingHint(statsData) : undefined} />
        <StatCard label="Quá hạn SLA" icon={TriangleAlert} tone="danger" loading={stats.isLoading} value={statsData ? formatNumber(statsData.overdueTickets) : '—'} hint={slaPercent ? `Tuân thủ SLA ${slaPercent}` : undefined} />
        <StatCard label="Đã giải quyết" icon={CheckCheck} tone="success" loading={stats.isLoading} value={statsData ? formatNumber(statsData.resolvedTickets + statsData.closedTickets) : '—'} hint={statsData ? `${formatNumber(statsData.resolvedTickets)} đã xử lý · ${formatNumber(statsData.closedTickets)} đã đóng` : undefined} />
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-line px-4 py-3 print:hidden">
        <Select aria-label="Lọc theo danh mục" size="sm" className="w-48" value={filters.category} onChange={event => updateFilters({ category: event.target.value })} options={CATEGORY_OPTIONS} />
        <Select aria-label="Lọc theo mức ưu tiên" size="sm" className="w-48" value={filters.priority} onChange={event => updateFilters({ priority: event.target.value })} options={PRIORITY_OPTIONS} />
        <Select aria-label="Lọc theo trạng thái" size="sm" className="w-44" value={filters.status} onChange={event => updateFilters({ status: event.target.value })} options={STATUS_OPTIONS} />
        {hasFilters ? (
          <Button variant="link" size="sm" onClick={() => updateFilters(NO_FILTERS)}>
            Xóa bộ lọc
          </Button>
        ) : null}
      </div>

      {showCards ? (
        <ul aria-label="Danh sách sự cố" className="divide-y divide-line md:hidden print:hidden">
          {rows.map(ticket => {
            const priority = getTicketPriorityMeta(ticket.priority)
            const status = getTicketStatusMeta(ticket.status)
            const slaState = getTicketSlaState(ticket)
            return (
              <li key={ticket.id} className="flex flex-col gap-2 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-mono text-xs text-fg-subtle">{ticketCode(ticket)}</div>
                    <div className="font-medium text-fg">{ticket.title}</div>
                    <div className="text-xs text-fg-subtle">{getTicketCategoryMeta(ticket.category).label}</div>
                  </div>
                  <IconButton icon={Eye} size="sm" aria-label={`Xem chi tiết sự cố ${ticketCode(ticket)}`} onClick={() => setSelected(ticket)} />
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge tone={status.tone} dot>
                    {status.label}
                  </Badge>
                  <Badge tone={priority.tone}>{priority.label}</Badge>
                  {slaState === 'overdue' ? (
                    <Badge tone="danger">{SLA_LABEL.overdue}</Badge>
                  ) : slaState === 'late' ? (
                    <Badge tone="warning">{SLA_LABEL.late}</Badge>
                  ) : (
                    <span className="text-xs text-fg-muted">{SLA_LABEL[slaState]}</span>
                  )}
                </div>
                <div className="text-dense text-fg-muted">
                  {ticket.facilityName ?? '—'} · {ticket.unitCode ? `Kho ${ticket.unitCode}` : 'Khu vực chung'}
                </div>
                <div className="text-xs text-fg-subtle">Phụ trách: {ticket.assignedStaffName ?? 'Chưa phân công'}</div>
              </li>
            )
          })}
        </ul>
      ) : null}

      <Table containerClassName={cn(showCards && 'hidden md:block print:block')}>
        <TableHeader>
          <TableRow>
            <TableHead>Mã</TableHead>
            <TableHead>Sự cố</TableHead>
            <TableHead>Cơ sở và vị trí</TableHead>
            <TableHead>Ưu tiên</TableHead>
            <TableHead>Phụ trách</TableHead>
            <TableHead>SLA</TableHead>
            <TableHead>Trạng thái</TableHead>
            <TableHead align="right" className="print:hidden">
              <span className="sr-only">Chi tiết</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {queue.isLoading ? (
            <TableLoading colSpan={COLUMN_COUNT} rows={5} />
          ) : queue.error ? (
            <TableError colSpan={COLUMN_COUNT} onRetry={() => void queue.reload()} />
          ) : rows.length === 0 ? (
            <TableEmpty
              colSpan={COLUMN_COUNT}
              icon={Siren}
              title={hasFilters ? 'Không có sự cố khớp bộ lọc' : 'Chưa có sự cố nào'}
              description={hasFilters ? 'Thử bỏ bớt bộ lọc để xem thêm sự cố.' : 'Sự cố khách và nhân viên báo cáo sẽ xuất hiện ở đây.'}
              action={
                hasFilters ? (
                  <Button variant="secondary" size="sm" onClick={() => updateFilters(NO_FILTERS)}>
                    Xóa bộ lọc
                  </Button>
                ) : undefined
              }
            />
          ) : (
            rows.map(ticket => {
              const priority = getTicketPriorityMeta(ticket.priority)
              const status = getTicketStatusMeta(ticket.status)
              const slaState = getTicketSlaState(ticket)
              return (
                <TableRow key={ticket.id}>
                  <TableCell className="font-mono text-dense">{ticketCode(ticket)}</TableCell>
                  <TableCell className="max-w-72">
                    <div className="truncate font-medium text-fg">{ticket.title}</div>
                    <div className="truncate text-xs text-fg-subtle">{getTicketCategoryMeta(ticket.category).label}</div>
                  </TableCell>
                  <TableCell>
                    <div className="text-fg">{ticket.facilityName ?? '—'}</div>
                    <div className="text-xs text-fg-subtle">{ticket.unitCode ? `Kho ${ticket.unitCode}` : 'Khu vực chung'}</div>
                  </TableCell>
                  <TableCell>
                    <Badge tone={priority.tone}>{priority.label}</Badge>
                  </TableCell>
                  <TableCell className="text-fg-muted">{ticket.assignedStaffName ?? 'Chưa phân công'}</TableCell>
                  <TableCell>
                    {slaState === 'overdue' ? (
                      <Badge tone="danger">{SLA_LABEL.overdue}</Badge>
                    ) : slaState === 'late' ? (
                      <Badge tone="warning">{SLA_LABEL.late}</Badge>
                    ) : (
                      <span className="text-fg-muted">{SLA_LABEL[slaState]}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge tone={status.tone} dot>
                      {status.label}
                    </Badge>
                  </TableCell>
                  <TableCell align="right" className="print:hidden">
                    <IconButton icon={Eye} size="sm" tooltip aria-label={`Xem chi tiết sự cố ${ticketCode(ticket)}`} onClick={() => setSelected(ticket)} />
                  </TableCell>
                </TableRow>
              )
            })
          )}
        </TableBody>
      </Table>
      {filtered.length > 0 ? (
        <div className="border-t border-line px-4 py-3 print:hidden">
          <Pagination page={pager.page} pageCount={pager.pageCount} total={pager.total} pageSize={pager.pageSize} onPageChange={pager.setPage} onPageSizeChange={pager.setPageSize} />
        </div>
      ) : null}

      <IncidentDetailDrawer ticket={selected} onClose={() => setSelected(null)} />
    </Card>
  )
}
