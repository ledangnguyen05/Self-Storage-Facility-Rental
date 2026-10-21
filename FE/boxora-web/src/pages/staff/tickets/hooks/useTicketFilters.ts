import { useCallback, useMemo, useState } from 'react'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { usePagination } from '@/hooks/usePagination'
import type { SupportTicketRecord } from '@/services/supportTicketService'
import { ALL } from '../constants'
import { isActiveStatus, isTicketOverdue, matchesPriorityFilter, matchesTicketSearch } from '../ticketUtils'

export interface TicketFilterState {
  search: string
  status: string
  priority: string
  category: string
  overdueOnly: boolean
}

const INITIAL_FILTERS: TicketFilterState = {
  search: '',
  status: ALL,
  priority: ALL,
  category: ALL,
  overdueOnly: false,
}

/** Client-side filters over the loaded queue, plus the pager for the filtered rows. */
export function useTicketFilters(tickets: readonly SupportTicketRecord[]) {
  const [filters, setFilters] = useState<TicketFilterState>(INITIAL_FILTERS)
  const debouncedSearch = useDebouncedValue(filters.search)

  const filtered = useMemo(
    () =>
      tickets.filter(ticket => {
        if (filters.status !== ALL && ticket.status?.toUpperCase() !== filters.status) return false
        if (!matchesPriorityFilter(ticket.priority, filters.priority)) return false
        if (filters.category !== ALL && ticket.category?.toUpperCase() !== filters.category) return false
        if (filters.overdueOnly && !(isTicketOverdue(ticket) && isActiveStatus(ticket.status))) return false
        return matchesTicketSearch(ticket, debouncedSearch)
      }),
    [tickets, filters.status, filters.priority, filters.category, filters.overdueOnly, debouncedSearch]
  )

  const pager = usePagination({ items: filtered })
  const { reset: resetPage } = pager

  const updateFilters = useCallback(
    (patch: Partial<TicketFilterState>) => {
      setFilters(current => ({ ...current, ...patch }))
      resetPage()
    },
    [resetPage]
  )

  const clearFilters = useCallback(() => {
    setFilters(INITIAL_FILTERS)
    resetPage()
  }, [resetPage])

  const hasActiveFilters =
    filters.search.trim() !== '' ||
    filters.status !== ALL ||
    filters.priority !== ALL ||
    filters.category !== ALL ||
    filters.overdueOnly

  return {
    filters,
    updateFilters,
    clearFilters,
    hasActiveFilters,
    filtered,
    pager,
    rows: pager.slice(filtered),
  }
}
