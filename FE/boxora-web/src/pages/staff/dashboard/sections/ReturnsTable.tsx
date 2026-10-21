import React from 'react'
import { ChevronRight, Undo2 } from 'lucide-react'
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
import { DEFAULT_PAGE_SIZE, usePagination } from '@/hooks/usePagination'
import { getApiErrorMessage } from '@/lib/apiError'
import { formatDate } from '@/lib/format'
import { formatFloor, getOverdueDays, type ReturnQueueItem } from '../utils/frontDesk'

interface ReturnsTableProps {
  rows: ReturnQueueItem[]
  isLoading: boolean
  error: unknown
  onRetry: () => void
  selectedId?: string
  onSelect: (item: ReturnQueueItem) => void
  today: string
  emptyTitle: string
  emptyDescription: string
  emptyAction?: React.ReactNode
}

const COLUMNS = 6

export function ReturnsTable({
  rows,
  isLoading,
  error,
  onRetry,
  selectedId,
  onSelect,
  today,
  emptyTitle,
  emptyDescription,
  emptyAction,
}: ReturnsTableProps) {
  const pager = usePagination({ items: rows })
  const pageRows = pager.slice(rows)
  // Phones get one card per contract; the table keeps loading, error and empty states.
  const hasRows = !isLoading && !error && rows.length > 0

  return (
    <>
      {hasRows ? (
        <ul className="divide-y divide-line sm:hidden" aria-label="Hợp đồng trả kho">
          {pageRows.map((item) => {
            const overdue = getOverdueDays(item.endDate, today)
            const floor = formatFloor(item.floorLevel)
            return (
              <li key={item.bookingId}>
                <button
                  type="button"
                  onClick={() => onSelect(item)}
                  aria-pressed={item.bookingId === selectedId}
                  className="flex w-full flex-col gap-1.5 px-4 py-3 text-left transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring aria-pressed:bg-accent-subtle"
                >
                  <span className="flex items-start justify-between gap-2">
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-fg">{item.customerName || '—'}</span>
                      <span className="block text-xs tabular-nums text-fg-subtle">{item.customerPhone || '—'}</span>
                    </span>
                    <ChevronRight size={16} strokeWidth={1.75} className="mt-1 shrink-0 text-fg-subtle" aria-hidden="true" />
                  </span>
                  <span className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-fg-muted">
                    <span className="font-mono">{item.bookingCode || '—'}</span>
                    <span className="font-mono text-fg">
                      {item.unitCode || '—'}
                      {floor ? ` · ${floor}` : ''}
                    </span>
                  </span>
                  <span className="flex flex-wrap items-center gap-1.5">
                    <Badge tone={item.statusMeta.tone} size="sm">
                      {item.statusMeta.label}
                    </Badge>
                    <span className="text-xs tabular-nums text-fg-subtle">Hạn trả {formatDate(item.endDate)}</span>
                    {overdue > 0 ? <span className="text-xs text-danger">Quá hạn {overdue} ngày</span> : null}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      ) : null}
      <div className={hasRows ? 'hidden sm:block' : undefined}>
        <Table aria-label="Hợp đồng trả kho">
          <TableHeader>
            <TableRow>
              <TableHead>Khách thuê</TableHead>
              <TableHead>Mã đặt chỗ</TableHead>
              <TableHead>Kho</TableHead>
              <TableHead>Hạn trả</TableHead>
              <TableHead>Trạng thái</TableHead>
              <TableHead align="right">
                <span className="sr-only">Mở</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableLoading colSpan={COLUMNS} rows={4} />
            ) : error ? (
              <TableError colSpan={COLUMNS} message={getApiErrorMessage(error, 'Không tải được hợp đồng đang thuê.')} onRetry={onRetry} />
            ) : rows.length === 0 ? (
              <TableEmpty colSpan={COLUMNS} icon={Undo2} title={emptyTitle} description={emptyDescription} action={emptyAction} />
            ) : (
              pageRows.map((item) => {
                const overdue = getOverdueDays(item.endDate, today)
                const floor = formatFloor(item.floorLevel)
                return (
                  <TableRow key={item.bookingId} selected={item.bookingId === selectedId} onClick={() => onSelect(item)}>
                    <TableCell>
                      <div className="font-medium text-fg">{item.customerName || '—'}</div>
                      <div className="text-xs tabular-nums text-fg-subtle">{item.customerPhone || '—'}</div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap font-mono">{item.bookingCode || '—'}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      <div className="font-mono text-fg">{item.unitCode || '—'}</div>
                      {floor ? <div className="text-xs text-fg-subtle">{floor}</div> : null}
                    </TableCell>
                    <TableCell>
                      <div className="tabular-nums">{formatDate(item.endDate)}</div>
                      {overdue > 0 ? <div className="text-xs text-danger">Quá hạn {overdue} ngày</div> : null}
                    </TableCell>
                    <TableCell>
                      <Badge tone={item.statusMeta.tone} size="sm">
                        {item.statusMeta.label}
                      </Badge>
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
