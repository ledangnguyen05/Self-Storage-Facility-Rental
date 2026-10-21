import { CircleCheck } from 'lucide-react'
import {
  Alert,
  Badge,
  Button,
  EmptyState,
  Skeleton,
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
import { getTicketCategoryMeta, getTicketPriorityMeta, getTicketStatusMeta } from '@/constants/statusMeta'
import { formatDate, formatDateTime } from '@/lib/format'
import { getApiErrorMessage } from '@/lib/apiError'
import type { SupportTicketRecord } from '@/services/supportTicketService'
import type { TicketPermissions } from '../hooks/useTicketPermissions'
import type { TicketActionId } from '../ticketActions'
import { getTicketCode, getUnitLabel, isActiveStatus, isTicketOverdue } from '../ticketUtils'
import { TicketRowActions } from './TicketRowActions'

const COLUMN_COUNT = 7

interface TicketTableProps {
  rows: SupportTicketRecord[]
  isLoading: boolean
  /** Set when the queue failed to load and there is nothing to show. */
  error: unknown
  onRetry: () => void
  hasActiveFilters: boolean
  permissions: TicketPermissions
  takingId: string | null
  onAction: (action: TicketActionId, ticket: SupportTicketRecord) => void
  onOpenDetail: (ticket: SupportTicketRecord) => void
}

/** Where the incident happened: the unit first (what staff look for), the facility as a short second line. */
function Location({ ticket }: { ticket: SupportTicketRecord }) {
  return (
    <>
      <p className="whitespace-nowrap font-mono text-dense text-fg">{getUnitLabel(ticket)}</p>
      {ticket.facilityName ? (
        <p className="max-w-40 truncate text-xs text-fg-muted" title={ticket.facilityName}>
          {ticket.facilityName}
        </p>
      ) : null}
    </>
  )
}

function Assignee({ ticket, permissions }: { ticket: SupportTicketRecord; permissions: TicketPermissions }) {
  return ticket.assignedStaffName ? (
    <span className="text-dense text-fg">
      {ticket.assignedStaffName}
      {permissions.isAssignedToMe(ticket) ? (
        <Badge tone="accent" size="sm" className="ml-1.5">
          Bạn
        </Badge>
      ) : null}
    </span>
  ) : (
    <span className="text-dense text-fg-subtle">Chưa phân công</span>
  )
}

function Deadline({ ticket }: { ticket: SupportTicketRecord }) {
  const overdue = isTicketOverdue(ticket) && isActiveStatus(ticket.status)
  return (
    <>
      <p className="text-dense tabular-nums text-fg">{formatDate(ticket.createdAt)}</p>
      {overdue ? (
        <Badge tone="danger" size="sm" title={`Hạn xử lý ${formatDateTime(ticket.slaDueAt)}`}>
          Quá hạn SLA
        </Badge>
      ) : ticket.slaDueAt && isActiveStatus(ticket.status) ? (
        <p className="text-xs tabular-nums text-fg-subtle">Hạn {formatDateTime(ticket.slaDueAt)}</p>
      ) : null}
    </>
  )
}

/**
 * The ticket queue. From the `md` breakpoint it is a compact table whose actions column stays pinned to the right
 * edge, so "Nhận xử lý" is never scrolled out of view; on phones every ticket is a card with its actions below.
 */
export function TicketTable({
  rows,
  isLoading,
  error,
  onRetry,
  hasActiveFilters,
  permissions,
  takingId,
  onAction,
  onOpenDetail,
}: TicketTableProps) {
  const emptyTitle = hasActiveFilters ? 'Không có ticket phù hợp' : 'Chưa có ticket sự cố'
  const emptyDescription = hasActiveFilters ? 'Thử đổi hoặc xóa bộ lọc để xem thêm ticket.' : 'Các sự cố được ghi nhận sẽ xuất hiện ở đây.'

  return (
    <>
      <div className="hidden md:block">
        <Table aria-label="Danh sách ticket sự cố">
          <TableHeader>
            <TableRow>
              <TableHead>Sự cố</TableHead>
              <TableHead>Vị trí</TableHead>
              <TableHead>Ưu tiên</TableHead>
              <TableHead>Trạng thái</TableHead>
              <TableHead>Phụ trách</TableHead>
              <TableHead>Tạo lúc và SLA</TableHead>
              <TableHead align="right" className="sticky right-0 z-20 bg-surface-2">
                <span className="sr-only">Thao tác</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableLoading colSpan={COLUMN_COUNT} rows={6} />
            ) : error ? (
              <TableError colSpan={COLUMN_COUNT} message={getApiErrorMessage(error, 'Không thể tải danh sách ticket.')} onRetry={onRetry} />
            ) : rows.length === 0 ? (
              <TableEmpty colSpan={COLUMN_COUNT} icon={CircleCheck} title={emptyTitle} description={emptyDescription} />
            ) : (
              rows.map(ticket => {
                const status = getTicketStatusMeta(ticket.status)
                const priority = getTicketPriorityMeta(ticket.priority)
                return (
                  <TableRow key={ticket.id} onClick={() => onOpenDetail(ticket)}>
                    <TableCell className="max-w-72">
                      <p className="flex items-center gap-1.5 whitespace-nowrap font-mono text-xs text-fg-muted">
                        {getTicketCode(ticket)}
                        {ticket.reopenCount ? (
                          <Badge tone="warning" size="sm">
                            Mở lại {ticket.reopenCount} lần
                          </Badge>
                        ) : null}
                      </p>
                      <p className="truncate text-sm font-medium text-fg" title={ticket.title}>
                        {ticket.title}
                      </p>
                      <p className="truncate text-xs text-fg-muted">{getTicketCategoryMeta(ticket.category).label}</p>
                    </TableCell>
                    <TableCell>
                      <Location ticket={ticket} />
                    </TableCell>
                    <TableCell>
                      <Badge tone={priority.tone}>{priority.label}</Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <Badge tone={status.tone} dot>
                        {status.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-36">
                      <Assignee ticket={ticket} permissions={permissions} />
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <Deadline ticket={ticket} />
                    </TableCell>
                    <TableCell align="right" className="sticky right-0 z-10 bg-surface">
                      <TicketRowActions
                        ticket={ticket}
                        permissions={permissions}
                        isTaking={takingId === ticket.id}
                        onAction={onAction}
                        onOpenDetail={onOpenDetail}
                      />
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      <div className="md:hidden">
        {isLoading ? (
          <div className="flex flex-col gap-3 p-4" aria-busy="true">
            {Array.from({ length: 3 }, (_, index) => (
              <Skeleton key={index} className="h-32 w-full" />
            ))}
          </div>
        ) : error ? (
          <div className="p-4">
            <Alert
              tone="danger"
              title="Không thể tải danh sách ticket"
              action={
                <Button size="sm" variant="secondary" onClick={onRetry}>
                  Thử lại
                </Button>
              }
            >
              {getApiErrorMessage(error, 'Không thể tải danh sách ticket.')}
            </Alert>
          </div>
        ) : rows.length === 0 ? (
          <EmptyState icon={CircleCheck} size="sm" title={emptyTitle} description={emptyDescription} />
        ) : (
          <ul className="divide-y divide-line" aria-label="Danh sách ticket sự cố">
            {rows.map(ticket => {
              const status = getTicketStatusMeta(ticket.status)
              const priority = getTicketPriorityMeta(ticket.priority)
              return (
                <li key={ticket.id} className="flex flex-col gap-3 p-4">
                  <button type="button" onClick={() => onOpenDetail(ticket)} className="flex flex-col gap-2 rounded-md text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <span className="font-mono text-xs text-fg-muted">{getTicketCode(ticket)}</span>
                      <Badge tone={priority.tone} size="sm">
                        {priority.label}
                      </Badge>
                      <Badge tone={status.tone} size="sm" dot>
                        {status.label}
                      </Badge>
                      {ticket.reopenCount ? (
                        <Badge tone="warning" size="sm">
                          Mở lại {ticket.reopenCount} lần
                        </Badge>
                      ) : null}
                    </span>
                    <span className="text-sm font-medium text-fg">{ticket.title}</span>
                    <span className="text-xs text-fg-muted">
                      {getTicketCategoryMeta(ticket.category).label} · {getUnitLabel(ticket)}
                      {ticket.facilityName ? ` · ${ticket.facilityName}` : ''}
                    </span>
                    <span className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                      <Assignee ticket={ticket} permissions={permissions} />
                      <span className="text-xs tabular-nums text-fg-subtle">
                        {isTicketOverdue(ticket) && isActiveStatus(ticket.status) ? 'Quá hạn SLA · ' : ''}
                        {formatDate(ticket.createdAt)}
                      </span>
                    </span>
                  </button>
                  <TicketRowActions
                    ticket={ticket}
                    permissions={permissions}
                    isTaking={takingId === ticket.id}
                    onAction={onAction}
                    onOpenDetail={onOpenDetail}
                  />
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </>
  )
}
