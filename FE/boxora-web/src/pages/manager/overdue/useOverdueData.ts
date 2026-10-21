import { useMemo } from 'react'
import { useAsyncData } from '@/hooks/useAsyncData'
import { overdueService, type OverdueLedger, type OverdueLedgerItem, type OverduePolicyInfo } from '@/services/overdueService'
import { thresholdsFromLedger, type StageThresholds } from './overdueModel'

export interface OverdueData {
  ledger: OverdueLedger | undefined
  items: OverdueLedgerItem[]
  isLoading: boolean
  error: unknown
  /** Policy the backend enforces for the selected facility; null when every facility is listed. */
  policy: OverduePolicyInfo | null
  thresholds: StageThresholds | null
  isRefreshing: boolean
  reload: () => Promise<void>
}

/** Overdue ledger of a facility (or of every facility the caller may see when `facilityId` is undefined). */
export function useOverdueData(facilityId: string | undefined): OverdueData {
  const query = useAsyncData((signal) => overdueService.getLedger(facilityId, { signal }), [facilityId], {
    keepPreviousData: false,
  })
  const items = useMemo(() => query.data?.items ?? [], [query.data])
  const policy = query.data?.policy ?? null
  const thresholds = useMemo(() => (policy ? thresholdsFromLedger(policy) : null), [policy])

  return {
    ledger: query.data,
    items,
    isLoading: query.isLoading || (query.data === undefined && !query.error),
    error: query.error,
    policy,
    thresholds,
    isRefreshing: query.isRefreshing,
    reload: query.reload,
  }
}
