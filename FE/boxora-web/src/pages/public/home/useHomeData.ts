import { useMemo } from 'react'
import { SIZE_GUIDE } from '../../../data/homeContent'
import { matchesSizeBucket } from '../../../data/storageUnitsData'
import { useAsyncData } from '../../../hooks/useAsyncData'
import { facilityService } from '../../../services/facilityService'
import { storageUnitService } from '../../../services/storageUnitService'
import type { Facility } from '../../../types'

export interface HomeFacilitySummary {
  facilityCount: number
  availableUnits: number
}

/** Lowest monthly price per size tier id, `null` when no unit type falls in the tier. */
export type TierPrices = Record<string, number | null>

const isActiveFacility = (facility: Facility) => !facility.status || facility.status === 'ACTIVE'

/**
 * Real data for the landing page: public facility list (active branches only, with real `availableUnits` counts and
 * coordinates) and unit types (for the "Giá từ" line of each size tier).
 * Unit types failing is not fatal: prices then show "—".
 */
export function useHomeData() {
  const facilitiesQuery = useAsyncData(signal => facilityService.getPublicFacilities({ signal }), [])

  const unitTypesQuery = useAsyncData(async signal => (await storageUnitService.getUnitTypes({ signal })) ?? [], [])

  const facilities = useMemo(() => (facilitiesQuery.data ?? []).filter(isActiveFacility), [facilitiesQuery.data])

  const summary = useMemo<HomeFacilitySummary | null>(() => {
    if (facilitiesQuery.isLoading || facilitiesQuery.error || facilities.length === 0) return null
    return {
      facilityCount: facilities.length,
      availableUnits: facilities.reduce((sum, facility) => sum + (Number(facility.availableUnits) || 0), 0),
    }
  }, [facilities, facilitiesQuery.error, facilitiesQuery.isLoading])

  const tierPrices = useMemo<TierPrices>(() => {
    const types = unitTypesQuery.data ?? []
    const prices: TierPrices = {}
    for (const tier of SIZE_GUIDE.tiers) {
      // "Giá từ" is the lowest price a visitor can really rent at: the cheapest listed price on a free unit (facility price
      // lists included), or the type's list price when every unit of the tier is taken.
      const priceOf = (type: (typeof types)[number]) => Number(type.lowestListedPrice ?? type.basePricePerMonth)
      const inTier = types.filter(type => matchesSizeBucket(Number(type.areaSqm), tier.bucket) && priceOf(type) > 0)
      prices[tier.id] = inTier.length > 0 ? Math.min(...inTier.map(priceOf)) : null
    }
    return prices
  }, [unitTypesQuery.data])

  return {
    facilities,
    facilitiesLoading: facilitiesQuery.isLoading,
    facilitiesError: facilitiesQuery.error,
    reloadFacilities: facilitiesQuery.reload,
    summary,
    tierPrices,
    tierPricesLoading: unitTypesQuery.isLoading,
  }
}
