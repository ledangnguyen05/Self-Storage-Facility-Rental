import React from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { formatNumber } from '../../lib/format'
import { IconButton } from './Button'
import { cn } from './cn'

export interface PaginationProps {
  /** 1-based current page (matches `usePagination().page`). */
  page: number
  pageCount: number
  onPageChange: (page: number) => void
  /** Total rows; shows "1–10 / 125" when `pageSize` is also given. */
  total?: number
  pageSize?: number
  /** Shows the page-size select when provided. */
  onPageSizeChange?: (size: number) => void
  pageSizeOptions?: readonly number[]
  disabled?: boolean
  className?: string
}

/**
 * Prev / next pager with "Trang X / Y", the row range and an optional page-size select.
 *
 *   const pager = usePagination({ items: rows })
 *   <Pagination page={pager.page} pageCount={pager.pageCount} total={pager.total}
 *     pageSize={pager.pageSize} onPageChange={pager.setPage} onPageSizeChange={pager.setPageSize} />
 */
export function Pagination({
  page,
  pageCount,
  onPageChange,
  total,
  pageSize,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50, 100],
  disabled = false,
  className,
}: PaginationProps) {
  const safeCount = Math.max(1, pageCount)
  const current = Math.min(Math.max(1, page), safeCount)
  const hasRange = total !== undefined && pageSize !== undefined
  const start = hasRange ? (total === 0 ? 0 : (current - 1) * pageSize + 1) : 0
  const end = hasRange ? Math.min(total, current * pageSize) : 0

  return (
    <nav
      aria-label="Phân trang"
      data-slot="pagination"
      className={cn('flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-dense text-fg-muted', className)}
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {total !== undefined ? (
          <span className="tabular-nums">
            {hasRange ? (
              <>
                <span className="font-medium text-fg">
                  {formatNumber(start)}–{formatNumber(end)}
                </span>{' '}
                trên {formatNumber(total)}
              </>
            ) : (
              <>
                Tổng <span className="font-medium text-fg">{formatNumber(total)}</span>
              </>
            )}
          </span>
        ) : null}
        {onPageSizeChange && pageSize !== undefined ? (
          <label className="flex items-center gap-2">
            <span>Hiển thị</span>
            <select
              value={pageSize}
              disabled={disabled}
              onChange={event => onPageSizeChange(Number(event.target.value))}
              data-slot="select"
              className="h-7 cursor-pointer rounded-md border border-line-strong bg-surface px-1.5 text-dense text-fg shadow-xs outline-none focus:border-accent focus:ring-3 focus:ring-accent/15"
            >
              {pageSizeOptions.map(option => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <span>/ trang</span>
          </label>
        ) : null}
      </div>
      <div className="flex items-center gap-1">
        <IconButton
          icon={ChevronLeft}
          size="sm"
          variant="secondary"
          aria-label="Trang trước"
          disabled={disabled || current <= 1}
          onClick={() => onPageChange(current - 1)}
        />
        <span className="min-w-20 px-1 text-center tabular-nums" aria-live="polite">
          Trang <span className="font-medium text-fg">{current}</span> / {safeCount}
        </span>
        <IconButton
          icon={ChevronRight}
          size="sm"
          variant="secondary"
          aria-label="Trang sau"
          disabled={disabled || current >= safeCount}
          onClick={() => onPageChange(current + 1)}
        />
      </div>
    </nav>
  )
}
