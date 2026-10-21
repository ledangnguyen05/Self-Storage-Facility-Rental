import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { MapFacility } from '../../../components/map/mapTypes'
import type { StorageUnitType } from '../../../data/storageUnitsData'
import { useAsyncData } from '../../../hooks/useAsyncData'
import { usePagination } from '../../../hooks/usePagination'
import { facilityService } from '../../../services/facilityService'
import { storageUnitService } from '../../../services/storageUnitService'
import type { Facility } from '../../../types'
import { distanceFrom, findNearest } from '../location/facilityDistance'
import { useCustomerLocation } from '../location/useCustomerLocation'
import {
  FILTER_PARAM,
  countActiveFilters,
  filterUnits,
  readFilters,
  sortUnits,
  withFilter,
  type FilterKey,
  type UnitFilters,
} from './unitFilters'
import {
  compareFloorKeys,
  normalizeSearchText,
  toExplorerFacilities,
  toExplorerUnits,
  type ExplorerFacility,
} from './unitModel'

const UNIT_PARAM = 'unit'
export const PAGE_SIZE_OPTIONS = [12, 24, 48] as const

export interface FloorOption {
  key: string
  label: string
}

export interface NearestFacility {
  facility: ExplorerFacility
  distanceKm: number
}

/**
 * State of the public "Thuê kho" page: real units and facilities (public scope, so staff see every branch too), filters
 * kept in the URL, the visitor's location, sorting and paging.
 */
export function useUnitsExplorer() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [query, setQuery] = useState('')

  const filters = useMemo(() => readFilters(searchParams), [searchParams])

  const setFilter = useCallback(
    <K extends FilterKey>(key: K, value: UnitFilters[K]) => {
      setSearchParams(prev => withFilter(prev, key, value), { replace: true })
    },
    [setSearchParams],
  )

  // --- data -----------------------------------------------------------------
  const { data, error, isLoading, reload } = useAsyncData(
    async signal => {
      const [facilityList, units] = await Promise.all([
        // Facilities are optional: units alone are enough to render the list.
        facilityService.getPublicFacilities({ signal }).catch((err: unknown) => {
          if (signal.aborted) throw err
          return [] as Facility[]
        }),
        storageUnitService.getPublicUnits({ signal }),
      ])
      return { facilities: facilityList, units }
    },
    [],
  )

  const facilities = useMemo(() => toExplorerFacilities(data?.facilities ?? [], data?.units ?? []), [data])
  const hasAnyCoords = useMemo(() => facilities.some(facility => facility.coords != null), [facilities])
  const facilitiesWithoutCoords = useMemo(() => facilities.filter(facility => facility.coords == null).length, [facilities])

  // Only jump to the distance sort when it can actually rank something.
  const hasAnyCoordsRef = useRef(hasAnyCoords)
  useEffect(() => {
    hasAnyCoordsRef.current = hasAnyCoords
  }, [hasAnyCoords])
  const customer = useCustomerLocation(() => {
    if (hasAnyCoordsRef.current) setFilter('sort', 'distance')
  })
  const { location, clear: clearLocation } = customer

  const units = useMemo(
    () => toExplorerUnits(data?.units ?? [], facilities, (data?.facilities.length ?? 0) > 0),
    [data, facilities],
  )

  // --- floors of the selected facility ---------------------------------------
  const floorOptions = useMemo<FloorOption[]>(() => {
    const seen = new Map<string, string>()
    for (const unit of units) {
      if (!unit.floorKey || (filters.facility && unit.facilityId !== filters.facility)) continue
      if (!seen.has(unit.floorKey)) seen.set(unit.floorKey, unit.floorLabel)
    }
    return [...seen.entries()]
      .sort(([a], [b]) => compareFloorKeys(a, b))
      .map(([key, label]) => ({ key, label }))
  }, [units, filters.facility])

  // A floor that does not exist in the chosen facility is simply ignored.
  const effectiveFilters = useMemo<UnitFilters>(
    () => (filters.floor && !floorOptions.some(option => option.key === filters.floor) ? { ...filters, floor: '' } : filters),
    [filters, floorOptions],
  )

  // --- distance, filtering, sorting ------------------------------------------
  const nearestFacility = useMemo<NearestFacility | null>(() => {
    const nearest = findNearest(facilities, location)
    return nearest ? { facility: nearest.item, distanceKm: nearest.distanceKm } : null
  }, [facilities, location])

  const unitsWithDistance = useMemo<StorageUnitType[]>(() => {
    if (!location) return units
    return units.map(unit => {
      const distanceKm = distanceFrom(location, unit.coords)
      if (distanceKm == null) return unit
      return { ...unit, distanceKm, isNearest: nearestFacility?.facility.id === unit.facilityId }
    })
  }, [units, location, nearestFacility])

  /** Pins for the map: only branches that have coordinates, with live availability and distance. */
  const mapFacilities = useMemo<MapFacility[]>(
    () =>
      facilities.flatMap(facility =>
        facility.coords
          ? [
              {
                id: facility.id,
                name: facility.name,
                address: facility.address,
                lat: facility.coords.lat,
                lng: facility.coords.lng,
                availableUnits: facility.availableUnits,
                totalUnits: facility.totalUnits,
                distanceKm: distanceFrom(location, facility.coords),
                isNearest: nearestFacility?.facility.id === facility.id,
              },
            ]
          : [],
      ),
    [facilities, location, nearestFacility],
  )

  const normalizedQuery = useMemo(() => normalizeSearchText(query), [query])

  // Counts for the status tabs ignore the status filter itself.
  const matchingAnyStatus = useMemo(
    () => filterUnits(unitsWithDistance, effectiveFilters, { query: normalizedQuery, ignoreStatus: true }),
    [unitsWithDistance, effectiveFilters, normalizedQuery],
  )
  const availableCount = useMemo(() => matchingAnyStatus.filter(unit => unit.isAvailable).length, [matchingAnyStatus])
  const totalCount = matchingAnyStatus.length

  // Distance ranking needs a position AND at least one branch with coordinates; otherwise keep the price order.
  const canSortByDistance = Boolean(location) && hasAnyCoords
  const sort = effectiveFilters.sort === 'distance' && !canSortByDistance ? 'price_asc' : effectiveFilters.sort

  const results = useMemo(() => {
    const visible = effectiveFilters.status === 'available' ? matchingAnyStatus.filter(unit => unit.isAvailable) : matchingAnyStatus
    return sortUnits(visible, sort)
  }, [matchingAnyStatus, effectiveFilters.status, sort])

  // --- paging ----------------------------------------------------------------
  const pager = usePagination({ items: results, initialPageSize: PAGE_SIZE_OPTIONS[0] })
  const resetPage = pager.reset
  const filterSignature = [
    effectiveFilters.facility,
    effectiveFilters.floor,
    effectiveFilters.category,
    effectiveFilters.size,
    effectiveFilters.price,
    effectiveFilters.status,
    sort,
    normalizedQuery,
    location ? 'located' : '',
  ].join('|')
  useEffect(() => {
    resetPage()
  }, [filterSignature, resetPage])

  // --- reset -----------------------------------------------------------------
  const activeFilterCount = countActiveFilters(effectiveFilters, query, Boolean(location))
  const hasActiveFilters = activeFilterCount > 0

  const resetFilters = useCallback(() => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      for (const param of Object.values(FILTER_PARAM)) next.delete(param)
      return next
    }, { replace: true })
    setQuery('')
    clearLocation()
  }, [setSearchParams, clearLocation])

  // --- deep link to a unit (?unit=<id or code>) -----------------------------------
  const unitParam = searchParams.get(UNIT_PARAM)
  const inspectedUnit = useMemo(
    () => (unitParam ? (unitsWithDistance.find(unit => unit.id === unitParam || unit.unitCode === unitParam) ?? null) : null),
    [unitParam, unitsWithDistance],
  )

  const openUnit = useCallback(
    (unit: StorageUnitType) => {
      setSearchParams(prev => {
        const next = new URLSearchParams(prev)
        next.set(UNIT_PARAM, unit.id)
        return next
      })
    },
    [setSearchParams],
  )

  const closeUnit = useCallback(() => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      next.delete(UNIT_PARAM)
      return next
    }, { replace: true })
  }, [setSearchParams])

  return {
    // data
    isLoading,
    error,
    reload,
    facilities,
    mapFacilities,
    hasAnyCoords,
    facilitiesWithoutCoords,
    floorOptions,
    // filters
    filters: { ...effectiveFilters, sort },
    setFilter,
    query,
    setQuery,
    activeFilterCount,
    hasActiveFilters,
    resetFilters,
    // location
    customer,
    nearestFacility,
    canSortByDistance,
    // results
    results,
    pageItems: pager.slice(results),
    pager,
    totalCount,
    availableCount,
    unitCount: units.length,
    // detail
    inspectedUnit,
    openUnit,
    closeUnit,
  }
}

export type UnitsExplorerState = ReturnType<typeof useUnitsExplorer>
