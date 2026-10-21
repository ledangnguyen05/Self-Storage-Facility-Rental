import { useCallback, useEffect, useMemo, useState } from 'react'
import { facilityService } from '../../services/facilityService'
import type { Facility, RoleType, User } from '../../types'
import { ALL_FACILITIES } from './dashboardContext'

/** Legacy seed data still says "StoreHub"; the product name is Boxora. */
export const formatFacilityName = (name: string) => name.replace(/StoreHub\s*/gi, 'Boxora ').trim()

export const getFacilityLabel = (facility: Pick<Facility, 'name' | 'code'>) =>
  `${formatFacilityName(facility.name)}${facility.code ? ` (${facility.code})` : ''}`

interface FacilityScopeOptions {
  user: User | null
  role: RoleType | null
  pathname: string
}

interface FetchState {
  key: string
  facilities: Facility[]
  failed: boolean
}

/**
 * Facility scope of the portal shell.
 * - FACILITY_MANAGER and STAFF are pinned to `user.facilityId`.
 * - Other roles pick a facility or ALL; /portal/facility-manager needs a concrete facility.
 * - Facilities are fetched once per signed-in user (not on every navigation).
 */
export function useFacilityScope({ user, role, pathname }: FacilityScopeOptions) {
  const isFacilityScoped = role === 'FACILITY_MANAGER' || role === 'STAFF'
  const assignedFacilityId = isFacilityScoped ? user?.facilityId : undefined
  const assignedFacilityName = user?.facilityName
  const assignedFacilityCode = user?.facilityCode
  const requiresConcreteFacility = pathname.includes('/facility-manager')

  const [reloadToken, setReloadToken] = useState(0)
  const requestKey = `${user?.id ?? 'anonymous'}:${reloadToken}`
  const [fetchState, setFetchState] = useState<FetchState>({ key: '', facilities: [], failed: false })
  const [selected, setSelected] = useState<string>(ALL_FACILITIES)

  useEffect(() => {
    const controller = new AbortController()
    facilityService
      .getFacilities(undefined, { signal: controller.signal })
      .then(result => {
        if (!controller.signal.aborted) setFetchState({ key: requestKey, facilities: result?.content ?? [], failed: false })
      })
      .catch(() => {
        if (!controller.signal.aborted) setFetchState(current => ({ key: requestKey, facilities: current.facilities, failed: true }))
      })
    return () => controller.abort()
  }, [requestKey])

  const isLoadingFacilities = fetchState.key !== requestKey
  const facilitiesError = !isLoadingFacilities && fetchState.failed

  const facilities = useMemo<Facility[]>(() => {
    const list = fetchState.facilities
    if (!assignedFacilityId) return list
    const matched = list.filter(facility => facility.id === assignedFacilityId)
    if (matched.length > 0) return matched
    if (assignedFacilityName) {
      return [
        {
          id: assignedFacilityId,
          name: assignedFacilityName,
          code: assignedFacilityCode || 'FAC',
          address: '',
          city: '',
          contactPhone: '',
          totalUnits: 0,
          availableUnits: 0,
          status: 'ACTIVE',
        },
      ]
    }
    return list
  }, [fetchState.facilities, assignedFacilityId, assignedFacilityName, assignedFacilityCode])

  const isKnown = (id: string) => facilities.some(facility => facility.id === id)

  let selectedFacility: string
  if (assignedFacilityId) {
    selectedFacility = assignedFacilityId
  } else if (requiresConcreteFacility) {
    selectedFacility = selected !== ALL_FACILITIES && isKnown(selected) ? selected : (facilities[0]?.id ?? selected)
  } else {
    selectedFacility = selected === ALL_FACILITIES || isLoadingFacilities || isKnown(selected) ? selected : ALL_FACILITIES
  }

  // The facility-manager page auto-picks the first facility; keep that choice after leaving the page.
  if (!assignedFacilityId && requiresConcreteFacility && selectedFacility !== selected && selectedFacility !== ALL_FACILITIES) {
    setSelected(selectedFacility)
  }

  const setSelectedFacility = useCallback(
    (id: string) => {
      if (assignedFacilityId) return
      setSelected(id || ALL_FACILITIES)
    },
    [assignedFacilityId],
  )

  const reloadFacilities = useCallback(() => setReloadToken(token => token + 1), [])

  const assignedFacility = assignedFacilityId ? facilities.find(facility => facility.id === assignedFacilityId) : undefined
  const assignedFacilityLabel = assignedFacilityName
    ? getFacilityLabel({ name: assignedFacilityName, code: assignedFacilityCode })
    : assignedFacility
      ? getFacilityLabel(assignedFacility)
      : 'Cơ sở được phân công'

  return {
    selectedFacility,
    setSelectedFacility,
    facilities,
    isFacilityScoped,
    isLoadingFacilities,
    facilitiesError,
    reloadFacilities,
    requiresConcreteFacility,
    assignedFacilityLabel,
  }
}
