import React, { createContext, useContext } from 'react'
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import { Button } from './Button'
import { cn } from './cn'
import { EmptyState } from './EmptyState'
import type { IconProp } from './icon'
import { Skeleton } from './Skeleton'

type Density = 'comfortable' | 'compact'
type Align = 'left' | 'center' | 'right'

const TableDensityContext = createContext<Density>('compact')

const alignClasses: Record<Align, string> = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
}

export interface TableProps extends React.TableHTMLAttributes<HTMLTableElement> {
  /** `comfortable` = 40px rows (customer), `compact` = 36px rows (staff/admin). */
  density?: Density
  /** Classes for the scroll container (e.g. `max-h-[480px]` to make the header stick). */
  containerClassName?: string
}

/** Scrolls horizontally inside its parent; the page never scrolls sideways. */
export function Table({ density = 'compact', className, containerClassName, ...props }: TableProps) {
  return (
    <TableDensityContext.Provider value={density}>
      <div data-slot="table-container" className={cn('relative w-full overflow-auto', containerClassName)}>
        <table className={cn('w-full caption-bottom border-separate border-spacing-0 text-sm', className)} {...props} />
      </div>
    </TableDensityContext.Provider>
  )
}

export function TableHeader({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn('sticky top-0 z-10 bg-surface-2', className)} {...props} />
}

export function TableBody({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn('[&>tr:last-child>td]:border-b-0', className)} {...props} />
}

export interface TableRowProps extends React.HTMLAttributes<HTMLTableRowElement> {
  selected?: boolean
}

/** With `onClick` the row is focusable and Enter/Space activate it. */
export function TableRow({ selected = false, onClick, onKeyDown, className, ...props }: TableRowProps) {
  const density = useContext(TableDensityContext)
  const interactive = Boolean(onClick)
  return (
    <tr
      data-state={selected ? 'selected' : undefined}
      aria-selected={selected || undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={onClick}
      onKeyDown={event => {
        onKeyDown?.(event)
        if (!interactive || event.defaultPrevented || event.target !== event.currentTarget) return
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          event.currentTarget.click()
        }
      }}
      className={cn(
        'transition-colors',
        density === 'comfortable' ? 'h-10' : 'h-9',
        'hover:bg-surface-2/60',
        interactive && 'cursor-pointer focus-visible:-outline-offset-2',
        selected && 'bg-accent-subtle hover:bg-accent-subtle',
        className,
      )}
      {...props}
    />
  )
}

export interface TableHeadProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  align?: Align
  /** Renders the header as a sort button. */
  sortable?: boolean
  sortDirection?: 'asc' | 'desc' | false
  onSort?: () => void
}

export function TableHead({ align = 'left', sortable = false, sortDirection = false, onSort, className, children, ...props }: TableHeadProps) {
  const SortIcon = sortDirection === 'asc' ? ArrowUp : sortDirection === 'desc' ? ArrowDown : ArrowUpDown
  return (
    <th
      scope="col"
      aria-sort={sortable ? (sortDirection === 'asc' ? 'ascending' : sortDirection === 'desc' ? 'descending' : 'none') : undefined}
      className={cn(
        'h-9 whitespace-nowrap border-b border-line px-3 align-middle text-xs font-medium text-fg-muted',
        alignClasses[align],
        className,
      )}
      {...props}
    >
      {sortable ? (
        <button
          type="button"
          onClick={onSort}
          className={cn(
            'inline-flex items-center gap-1 rounded-sm transition-colors hover:text-fg',
            align === 'right' && 'flex-row-reverse',
            sortDirection && 'text-fg',
          )}
        >
          {children}
          <SortIcon size={14} strokeWidth={1.75} aria-hidden="true" className={sortDirection ? 'text-fg' : 'text-fg-subtle'} />
        </button>
      ) : (
        children
      )}
    </th>
  )
}

export interface TableCellProps extends React.TdHTMLAttributes<HTMLTableCellElement> {
  align?: Align
  /** Tabular, right-aligned numbers (money, counts). */
  numeric?: boolean
}

export function TableCell({ align, numeric = false, className, ...props }: TableCellProps) {
  const resolvedAlign: Align = align ?? (numeric ? 'right' : 'left')
  return (
    <td
      className={cn(
        'border-b border-line px-3 py-2 align-middle text-fg',
        alignClasses[resolvedAlign],
        numeric && 'whitespace-nowrap tabular-nums',
        className,
      )}
      {...props}
    />
  )
}

export interface TableEmptyProps {
  colSpan: number
  icon?: IconProp
  title?: React.ReactNode
  description?: React.ReactNode
  action?: React.ReactNode
}

export function TableEmpty({ colSpan, icon, title = 'Chưa có dữ liệu', description, action }: TableEmptyProps) {
  return (
    <tr>
      <td colSpan={colSpan} className="border-b-0">
        <EmptyState icon={icon} title={title} description={description} action={action} size="sm" className="py-10" />
      </td>
    </tr>
  )
}

export interface TableLoadingProps {
  colSpan: number
  rows?: number
}

/** Skeleton rows that keep the table height stable while loading. */
export function TableLoading({ colSpan, rows = 5 }: TableLoadingProps) {
  const density = useContext(TableDensityContext)
  return (
    <>
      {Array.from({ length: rows }, (_, rowIndex) => (
        <tr key={rowIndex} aria-hidden="true" className={density === 'comfortable' ? 'h-10' : 'h-9'}>
          {Array.from({ length: colSpan }, (_, cellIndex) => (
            <td key={cellIndex} className="border-b border-line px-3 py-2">
              <Skeleton className={cn('h-3.5', cellIndex === 0 ? 'w-3/4' : 'w-1/2')} />
            </td>
          ))}
        </tr>
      ))}
      <tr className="sr-only">
        <td colSpan={colSpan}>Đang tải dữ liệu</td>
      </tr>
    </>
  )
}

export interface TableErrorProps {
  colSpan: number
  message?: React.ReactNode
  onRetry?: () => void
}

export function TableError({ colSpan, message = 'Không tải được dữ liệu.', onRetry }: TableErrorProps) {
  return (
    <tr>
      <td colSpan={colSpan} className="border-b-0 px-4 py-10 text-center">
        <div role="alert" className="flex flex-col items-center gap-3">
          <p className="text-sm text-fg-muted">{message}</p>
          {onRetry ? (
            <Button variant="secondary" size="sm" onClick={onRetry}>
              Thử lại
            </Button>
          ) : null}
        </div>
      </td>
    </tr>
  )
}
