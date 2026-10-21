import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Clock, Siren, TicketCheck, TriangleAlert } from 'lucide-react'
import {
  Badge,
  Card,
  CardHeader,
  Pagination,
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
} from '@/components/ui'
import { getTicketCategoryMeta, getTicketPriorityMeta, getTicketStatusMeta } from '@/constants/statusMeta'
import { usePagination } from '@/hooks/usePagination'
import { getApiErrorMessage } from '@/lib/apiError'
import { formatDateTime, formatNumber, formatPercent } from '@/lib/format'
import type { SupportTicketRecord, SupportTicketStats } from '@/services/supportTicketService'
import { isHighPriority, isOpenTicket } from './ticketModel'
import type { ScopedList } from './useManagerDashboardData'

interface TicketsTabProps {
  tickets: ScopedList<SupportTicketRecord>
  stats: { data: SupportTicketStats | undefined; isLoading: boolean; error: unknown }
}

/** Incident queue for the facility, with KPIs computed from the queue and the ticket stats endpoint. */
export function TicketsTab({ tickets, stats }: TicketsTabProps) {
  const rows = useMemo(
    () =>
      [...tickets.items].sort((a, b) => {
        const openDiff = Number(isOpenTicket(b)) - Number(isOpenTicket(a))
        return openDiff !== 0 ? openDiff : (b.createdAt ?? '').localeCompare(a.createdAt ?? '')
      }),
    [tickets.items],
  )
  const pager = usePagination({ items: rows })

  const openCount = rows.filter(isOpenTicket).length
  const highCount = rows.filter((ticket) => isOpenTicket(ticket) && isHighPriority(ticket)).length
  const hasStats = Boolean(stats.data && stats.data.totalTickets > 0)
  const slaValue =
    hasStats && typeof stats.data?.slaCompliancePercent === 'number'
      ? formatPercent(stats.data.slaCompliancePercent, { fractionDigits: 1 })
      : '—'

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Sự cố đang mở"
          value={formatNumber(openCount)}
          icon={TicketCheck}
          loading={tickets.isLoading}
          hint="Chưa xử lý hoặc đang xử lý"
        />
        <StatCard
          label="Ưu tiên cao"
          value={formatNumber(highCount)}
          icon={Siren}
          tone={highCount > 0 ? 'danger' : 'neutral'}
          loading={tickets.isLoading}
          hint="Cao, khẩn cấp hoặc nghiêm trọng"
        />
        <StatCard
          label="Đúng hạn SLA"
          value={slaValue}
          icon={Clock}
          loading={stats.isLoading}
          hint={
            hasStats && stats.data
              ? `${formatNumber(stats.data.overdueTickets)} quá hạn trên ${formatNumber(stats.data.totalTickets)} sự cố`
              : 'Chưa có sự cố để tính'
          }
        />
      </div>

      <Card className="overflow-hidden">
        <CardHeader
          divider
          title="Hàng đợi sự cố"
          description={`${rows.length} sự cố tại cơ sở`}
          actions={
            <Link to="/portal/tickets" className={buttonVariants({ variant: 'secondary', size: 'sm' })}>
              Mở trang xử lý sự cố
            </Link>
          }
        />
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Mã</TableHead>
              <TableHead>Tiêu đề</TableHead>
              <TableHead>Kho</TableHead>
              <TableHead>Phân loại</TableHead>
              <TableHead>Mức độ</TableHead>
              <TableHead>Trạng thái</TableHead>
              <TableHead>Tạo lúc</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tickets.isLoading ? (
              <TableLoading colSpan={7} />
            ) : tickets.error ? (
              <TableError
                colSpan={7}
                message={getApiErrorMessage(tickets.error, 'Không tải được hàng đợi sự cố.')}
                onRetry={() => void tickets.reload()}
              />
            ) : rows.length === 0 ? (
              <TableEmpty
                colSpan={7}
                icon={TriangleAlert}
                title="Không có sự cố nào"
                description="Sự cố khách hàng báo tại cơ sở sẽ hiển thị tại đây."
              />
            ) : (
              pager.slice(rows).map((ticket) => {
                const priority = getTicketPriorityMeta(ticket.priority)
                const status = getTicketStatusMeta(ticket.status)
                const slaBreached = isOpenTicket(ticket) && Boolean(ticket.isOverdueSla ?? ticket.isOverdue)
                return (
                  <TableRow key={ticket.id}>
                    <TableCell className="font-mono text-dense">
                      {ticket.ticketCode || ticket.ticketNumber || ticket.id.slice(0, 8)}
                    </TableCell>
                    <TableCell className="max-w-xs">
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate font-medium">{ticket.title}</span>
                        {ticket.customerName ? <span className="truncate text-xs text-fg-muted">{ticket.customerName}</span> : null}
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap font-mono text-dense">{ticket.unitCode || 'Chung'}</TableCell>
                    <TableCell>{getTicketCategoryMeta(ticket.category).label}</TableCell>
                    <TableCell>
                      <Badge tone={priority.tone}>{priority.label}</Badge>
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1.5">
                        <Badge tone={status.tone} dot>
                          {status.label}
                        </Badge>
                        {slaBreached ? (
                          <Badge tone="danger" size="sm">
                            Quá hạn SLA
                          </Badge>
                        ) : null}
                      </span>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-fg-muted">{formatDateTime(ticket.createdAt)}</TableCell>
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
    </div>
  )
}
