import { useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { isDashboardTab, type DashboardTab } from '../constants'

/** `null` removes the parameter. */
export type ParamPatch = Record<string, string | null | undefined>

interface UpdateOptions {
  replace?: boolean
}

/**
 * The active tab lives in `?tab=`. Changing it keeps every other parameter
 * (`unit`, `bookingId` …) unless the patch overrides it.
 */
export function useDashboardTab() {
  const [searchParams, setSearchParams] = useSearchParams()
  const rawTab = searchParams.get('tab')
  const tab: DashboardTab = isDashboardTab(rawTab) ? rawTab : 'my-units'

  const updateParams = useCallback(
    (patch: ParamPatch, options: UpdateOptions = {}) => {
      setSearchParams(
        previous => {
          const next = new URLSearchParams(previous)
          for (const [key, value] of Object.entries(patch)) {
            if (value === null || value === undefined || value === '') next.delete(key)
            else next.set(key, value)
          }
          return next
        },
        { replace: options.replace },
      )
    },
    [setSearchParams],
  )

  const setTab = useCallback(
    (next: DashboardTab, patch: ParamPatch = {}) => updateParams({ ...patch, tab: next }),
    [updateParams],
  )

  return { tab, setTab, searchParams, updateParams }
}
