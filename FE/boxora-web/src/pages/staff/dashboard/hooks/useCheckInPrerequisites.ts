import { useCallback, useState } from 'react'
import { useAsyncData } from '@/hooks/useAsyncData'
import { isRequestCanceled } from '@/lib/apiError'
import { handoverService, type HandoverPrerequisites } from '@/services/handoverService'

/**
 * BR-RULE-005 check-in conditions for one booking, straight from the backend.
 *
 * - cache: switching back to a booking shows its last result while it refreshes;
 * - race guard: results are keyed by booking id and superseded requests are aborted
 *   (useAsyncData), so one booking's data never shows on another;
 * - a failed refresh drops the cached copy so stale "met" conditions are not shown.
 */
export function useCheckInPrerequisites(bookingId: string | null | undefined) {
  const [cache, setCache] = useState<Record<string, HandoverPrerequisites>>({})

  const query = useAsyncData<HandoverPrerequisites | null>(
    async (signal) => {
      if (!bookingId) return null
      try {
        const data = await handoverService.getCheckInPrerequisites(bookingId, { signal })
        if (!signal.aborted) setCache((current) => ({ ...current, [bookingId]: data }))
        return data
      } catch (err) {
        if (!signal.aborted && !isRequestCanceled(err)) {
          setCache((current) => {
            if (!(bookingId in current)) return current
            const next = { ...current }
            delete next[bookingId]
            return next
          })
        }
        throw err
      }
    },
    [bookingId],
    { enabled: Boolean(bookingId), keepPreviousData: false },
  )

  const prerequisites = bookingId ? (cache[bookingId] ?? null) : null

  /** Replaces the cached result, e.g. with the body returned by verify-identity. */
  const setPrerequisites = useCallback(
    (next: HandoverPrerequisites) => {
      if (!bookingId || !next) return
      setCache((current) => ({ ...current, [bookingId]: next }))
    },
    [bookingId],
  )

  return {
    prerequisites,
    error: query.error,
    /** Nothing to show yet: render a skeleton. */
    isLoading: !prerequisites && query.isLoading,
    /** Data on screen while it reloads. */
    isRefreshing: Boolean(prerequisites) && (query.isLoading || query.isRefreshing),
    reload: query.reload,
    setPrerequisites,
  }
}

export type CheckInPrerequisitesState = ReturnType<typeof useCheckInPrerequisites>
