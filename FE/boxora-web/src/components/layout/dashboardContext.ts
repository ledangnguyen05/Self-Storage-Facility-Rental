import { useOutletContext } from 'react-router-dom'
import type { Facility } from '../../types'

/** Value of `selectedFacility` when every facility is in scope. */
export const ALL_FACILITIES = 'ALL'

/**
 * What DashboardLayout passes to every portal page through <Outlet context>.
 * `selectedFacility` is a facility id or ALL_FACILITIES. FACILITY_MANAGER and
 * STAFF are pinned to their assigned facility (`isFacilityScoped`), and
 * /portal/facility-manager always receives a concrete facility id.
 */
export interface DashboardOutletContext {
  selectedFacility: string
  setSelectedFacility: (id: string) => void
  facilities: Facility[]
  isFacilityScoped: boolean
  isLoadingFacilities: boolean
}

const FALLBACK_CONTEXT: DashboardOutletContext = {
  selectedFacility: ALL_FACILITIES,
  setSelectedFacility: () => undefined,
  facilities: [],
  isFacilityScoped: false,
  isLoadingFacilities: false,
}

/** Facility scope for portal pages. Safe to call outside the layout (returns an "all facilities" fallback). */
export function useDashboardContext(): DashboardOutletContext {
  return useOutletContext<DashboardOutletContext | undefined>() ?? FALLBACK_CONTEXT
}
