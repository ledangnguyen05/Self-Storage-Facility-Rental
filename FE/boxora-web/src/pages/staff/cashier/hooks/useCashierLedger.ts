import { useCallback, useMemo, useState } from 'react'
import { useToast } from '@/components/ui'
import { useAsyncData } from '@/hooks/useAsyncData'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { usePagination } from '@/hooks/usePagination'
import { downloadCsv, toCsv } from '@/lib/csv'
import { todayISO } from '@/lib/format'
import { paymentService, type PaymentItem } from '@/services/paymentService'
import {
  ALL,
  detectPreset,
  getPresetRange,
  LEDGER_CSV_COLUMNS,
  LEDGER_FETCH_SIZE,
  matchesLedgerSearch,
  matchesMethodFilter,
  matchesStatusFilter,
  matchesTypeFilter,
  summarizeLedger,
  toApiRange,
  type DateRange,
  type RangePreset,
} from '../ledgerUtils'

export interface LedgerFilterState {
  search: string
  method: string
  status: string
  type: string
}

const INITIAL_FILTERS: LedgerFilterState = { search: '', method: ALL, status: ALL, type: ALL }
const NO_PAYMENTS: PaymentItem[] = []

/** GET /payments also reads these; paymentService's own type does not list the date range yet. */
interface LedgerQuery {
  status?: string
  size?: number
  facilityId?: string
  fromDate?: string
  toDate?: string
}

/**
 * Payments ledger for one facility scope and one date range (default: today).
 * The range, facility and page size are sent to the API; search, method, status
 * and type narrow the loaded range on the client. KPIs always cover the whole range.
 */
export function useCashierLedger(facilityId: string | undefined) {
  const toast = useToast()
  const [range, setRange] = useState<DateRange>(() => getPresetRange('today'))
  const [filters, setFilters] = useState<LedgerFilterState>(INITIAL_FILTERS)
  const debouncedSearch = useDebouncedValue(filters.search)

  const query = useAsyncData(
    signal => {
      // `status: undefined` overrides the service default (PAID only) so pending and failed rows show up too.
      const params: LedgerQuery = { size: LEDGER_FETCH_SIZE, status: undefined, facilityId, ...toApiRange(range) }
      return paymentService.getPayments(params, { signal })
    },
    [facilityId, range.from, range.to],
    // Never show another range's totals under the new range's label.
    { keepPreviousData: false }
  )

  const payments = query.data ?? NO_PAYMENTS
  const summary = useMemo(() => summarizeLedger(payments), [payments])

  const filtered = useMemo(
    () =>
      payments.filter(
        payment =>
          matchesMethodFilter(payment.paymentMethod, filters.method) &&
          matchesTypeFilter(payment.paymentType, filters.type) &&
          matchesStatusFilter(payment.status, filters.status) &&
          matchesLedgerSearch(payment, debouncedSearch)
      ),
    [payments, filters.method, filters.type, filters.status, debouncedSearch]
  )

  const pager = usePagination({ items: filtered, initialPageSize: 20 })
  const { reset: resetPage } = pager

  const updateFilters = useCallback(
    (patch: Partial<LedgerFilterState>) => {
      setFilters(current => ({ ...current, ...patch }))
      resetPage()
    },
    [resetPage]
  )

  const clearFilters = useCallback(() => {
    setFilters(INITIAL_FILTERS)
    resetPage()
  }, [resetPage])

  /**
   * Changing one end of the range drags the other end along when they would cross. A typed date after today is
   * pulled back to today: the ledger has nothing to show for the future (the date inputs already carry max=today).
   */
  const updateRange = useCallback(
    (patch: Partial<DateRange>) => {
      setRange(current => {
        const today = todayISO()
        const clamp = (value: string) => (value > today ? today : value)
        const from = clamp(patch.from || current.from)
        const to = clamp(patch.to || current.to)
        if (from === current.from && to === current.to) return current
        if (from <= to) return { from, to }
        return patch.from ? { from, to: from } : { from: to, to }
      })
      resetPage()
    },
    [resetPage]
  )

  const applyPreset = useCallback(
    (preset: RangePreset) => {
      if (preset === 'custom') return
      setRange(getPresetRange(preset))
      resetPage()
    },
    [resetPage]
  )

  const exportCsv = useCallback(() => {
    if (filtered.length === 0) {
      toast.info('Không có giao dịch để xuất', 'Đổi khoảng thời gian hoặc bộ lọc rồi thử lại.')
      return
    }
    downloadCsv(`so-quy_${range.from}_${range.to}`, toCsv(filtered, LEDGER_CSV_COLUMNS))
    toast.success('Đã xuất sổ quỹ', `${filtered.length} giao dịch`)
  }, [filtered, range.from, range.to, toast])

  const hasActiveFilters =
    filters.search.trim() !== '' || filters.method !== ALL || filters.status !== ALL || filters.type !== ALL

  return {
    range,
    preset: detectPreset(range),
    updateRange,
    applyPreset,
    filters,
    updateFilters,
    clearFilters,
    hasActiveFilters,
    payments,
    summary,
    filtered,
    rows: pager.slice(filtered),
    pager,
    isLoading: query.isLoading,
    isRefreshing: query.isRefreshing,
    error: query.error,
    reload: query.reload,
    /** The API returned a full page, so the range probably holds more payments than shown. */
    isTruncated: payments.length >= LEDGER_FETCH_SIZE,
    exportCsv,
  }
}
