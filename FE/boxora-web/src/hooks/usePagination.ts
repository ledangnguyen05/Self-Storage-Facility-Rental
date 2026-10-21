import { useCallback, useMemo, useState } from 'react'

export const DEFAULT_PAGE_SIZE = 10
export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const

export interface UsePaginationOptions {
  /** Total number of rows (server-side paging). Ignored when `items` is given. */
  total?: number
  /** Full list (client-side paging); `total` becomes `items.length`. */
  items?: readonly unknown[]
  initialPage?: number
  initialPageSize?: number
}

export interface UsePaginationResult {
  /** 1-based current page, always clamped to `[1, pageCount]`. */
  page: number
  pageSize: number
  pageCount: number
  total: number
  /** Index of the first row on the page (0-based), for server requests use `page - 1`. */
  offset: number
  setPage: (page: number) => void
  /** Changes page size and returns to page 1. */
  setPageSize: (size: number) => void
  /** The rows of `list` that belong to the current page. */
  slice: <T>(list: readonly T[]) => T[]
  /** Back to page 1 (call when filters change). */
  reset: () => void
  hasPrevious: boolean
  hasNext: boolean
}

/**
 * Page state for client- or server-side lists. Pairs with `<Pagination>`.
 *
 *   const pager = usePagination({ items: filtered, initialPageSize: 20 })
 *   const rows = pager.slice(filtered)
 */
export function usePagination(options: UsePaginationOptions = {}): UsePaginationResult {
  const { items, initialPage = 1, initialPageSize = DEFAULT_PAGE_SIZE } = options
  const total = Math.max(0, items ? items.length : (options.total ?? 0))

  const [rawPage, setRawPage] = useState(Math.max(1, Math.floor(initialPage)))
  const [pageSize, setPageSizeState] = useState(Math.max(1, Math.floor(initialPageSize)))

  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  // Clamped during render, so a shrinking list (e.g. after filtering) never shows an empty page.
  const page = Math.min(Math.max(1, rawPage), pageCount)

  const setPage = useCallback((next: number) => {
    setRawPage(Number.isFinite(next) ? Math.max(1, Math.floor(next)) : 1)
  }, [])

  const setPageSize = useCallback((size: number) => {
    setPageSizeState(Number.isFinite(size) && size > 0 ? Math.floor(size) : DEFAULT_PAGE_SIZE)
    setRawPage(1)
  }, [])

  const reset = useCallback(() => setRawPage(1), [])

  const offset = (page - 1) * pageSize

  const slice = useCallback(<T,>(list: readonly T[]): T[] => list.slice(offset, offset + pageSize), [offset, pageSize])

  return useMemo(
    () => ({
      page,
      pageSize,
      pageCount,
      total,
      offset,
      setPage,
      setPageSize,
      slice,
      reset,
      hasPrevious: page > 1,
      hasNext: page < pageCount,
    }),
    [page, pageSize, pageCount, total, offset, setPage, setPageSize, slice, reset]
  )
}
