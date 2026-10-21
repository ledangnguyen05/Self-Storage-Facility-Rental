import { useMemo } from 'react'
import { ALL_FACILITIES, useDashboardContext } from '@/components/layout/dashboardContext'
import { formatFacilityName } from '@/components/layout/useFacilityScope'
import type { Facility } from '@/types'

export interface ManagerFacility {
  /** Concrete facility id, or undefined while the scope is "all facilities". */
  facilityId: string | undefined
  facility: Facility | undefined
  facilityName: string | undefined
  facilities: Facility[]
  isFacilityScoped: boolean
  isLoadingFacilities: boolean
}

/** Facility scope of the manager portal pages, resolved from the dashboard shell. */
export function useManagerFacility(): ManagerFacility {
  const { selectedFacility, facilities, isFacilityScoped, isLoadingFacilities } = useDashboardContext()
  const facilityId = selectedFacility && selectedFacility !== ALL_FACILITIES ? selectedFacility : undefined
  const facility = useMemo(() => (facilityId ? facilities.find((item) => item.id === facilityId) : undefined), [facilities, facilityId])
  return {
    facilityId,
    facility,
    facilityName: facility ? formatFacilityName(facility.name) : undefined,
    facilities,
    isFacilityScoped,
    isLoadingFacilities,
  }
}
