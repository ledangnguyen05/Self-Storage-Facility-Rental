import {
  isSizeBucket,
  isUnitCategory,
  matchesSizeBucket,
  type SizeBucket,
  type StorageUnitType,
  type UnitCategory,
} from '../../../data/storageUnitsData'

export type PriceBucket = 'under1m5' | '1m5to3m' | '3mto5m' | 'above5m'
export type SortOption = 'price_asc' | 'price_desc' | 'distance' | 'area_desc'
/** `all` shows rented units too (marked as such); `available` keeps only units that can be rented now. */
export type StatusFilter = 'available' | 'all'

export const PRICE_BUCKETS: ReadonlyArray<{ value: PriceBucket; label: string }> = [
  { value: 'under1m5', label: 'Dưới 1,5 triệu / tháng' },
  { value: '1m5to3m', label: '1,5 – 3 triệu / tháng' },
  { value: '3mto5m', label: '3 – 5 triệu / tháng' },
  { value: 'above5m', label: 'Trên 5 triệu / tháng' },
]

export const SORT_OPTIONS: ReadonlyArray<{ value: SortOption; label: string }> = [
  { value: 'price_asc', label: 'Giá thấp đến cao' },
  { value: 'price_desc', label: 'Giá cao đến thấp' },
  { value: 'distance', label: 'Gần bạn nhất' },
  { value: 'area_desc', label: 'Diện tích lớn đến nhỏ' },
]

const isPriceBucket = (value: string | null): value is PriceBucket => PRICE_BUCKETS.some(bucket => bucket.value === value)
const isSortOption = (value: string | null): value is SortOption => SORT_OPTIONS.some(option => option.value === value)

/** Everything the explorer filters on except the free-text query. Lives in the URL, so views are shareable. */
export interface UnitFilters {
  /** Facility id, `''` = all. */
  facility: string
  /** Normalised floor key (see `normalizeFloor`), `''` = all. */
  floor: string
  category: UnitCategory | ''
  size: SizeBucket | ''
  price: PriceBucket | ''
  status: StatusFilter
  sort: SortOption
}

export const DEFAULT_FILTERS: UnitFilters = {
  facility: '',
  floor: '',
  category: '',
  size: '',
  price: '',
  // Rented units stay visible (marked) so visitors see the real inventory; "Còn trống" is one click away.
  status: 'all',
  sort: 'price_asc',
}

export type FilterKey = keyof UnitFilters

/** URL parameter used for each filter (`type` is the category, as linked from the landing page). */
export const FILTER_PARAM: Record<FilterKey, string> = {
  facility: 'facility',
  floor: 'floor',
  category: 'type',
  size: 'size',
  price: 'price',
  status: 'status',
  sort: 'sort',
}

export function readFilters(params: URLSearchParams): UnitFilters {
  const category = params.get(FILTER_PARAM.category)
  const size = params.get(FILTER_PARAM.size)
  const price = params.get(FILTER_PARAM.price)
  const sort = params.get(FILTER_PARAM.sort)
  return {
    facility: params.get(FILTER_PARAM.facility) ?? '',
    floor: params.get(FILTER_PARAM.floor) ?? '',
    category: isUnitCategory(category) ? category : '',
    size: isSizeBucket(size) ? size : '',
    price: isPriceBucket(price) ? price : '',
    status: params.get(FILTER_PARAM.status) === 'available' ? 'available' : DEFAULT_FILTERS.status,
    sort: isSortOption(sort) ? sort : DEFAULT_FILTERS.sort,
  }
}

/** Returns new search params with one filter changed. Default values are removed to keep URLs short. */
export function withFilter(params: URLSearchParams, key: FilterKey, value: string): URLSearchParams {
  const next = new URLSearchParams(params)
  const param = FILTER_PARAM[key]
  if (!value || value === DEFAULT_FILTERS[key]) next.delete(param)
  else next.set(param, value)
  // A floor only makes sense inside one facility.
  if (key === 'facility') next.delete(FILTER_PARAM.floor)
  return next
}

const PRICE_TESTS: Record<PriceBucket, (price: number) => boolean> = {
  under1m5: price => price < 1_500_000,
  '1m5to3m': price => price >= 1_500_000 && price <= 3_000_000,
  '3mto5m': price => price > 3_000_000 && price <= 5_000_000,
  above5m: price => price > 5_000_000,
}

export interface FilterOptions {
  /** Pre-normalised search query (`normalizeSearchText`). */
  query: string
  /** Ignore the status filter (used to count the tabs). */
  ignoreStatus?: boolean
}

/** Applies every filter. `filters.floor` must already be validated against the facility's floors. */
export function filterUnits(units: readonly StorageUnitType[], filters: UnitFilters, options: FilterOptions): StorageUnitType[] {
  const { query, ignoreStatus = false } = options
  return units.filter(unit => {
    if (filters.facility && unit.facilityId !== filters.facility) return false
    if (filters.floor && unit.floorKey !== filters.floor) return false
    if (filters.category && unit.category !== filters.category) return false
    if (filters.size && !matchesSizeBucket(unit.areaSqMeters, filters.size)) return false
    if (filters.price && !PRICE_TESTS[filters.price](unit.monthlyPrice)) return false
    if (!ignoreStatus && filters.status === 'available' && !unit.isAvailable) return false
    if (query && !unit.searchText.includes(query)) return false
    return true
  })
}

const byPrice = (a: StorageUnitType, b: StorageUnitType) => a.monthlyPrice - b.monthlyPrice
const byCode = (a: StorageUnitType, b: StorageUnitType) => a.unitCode.localeCompare(b.unitCode, 'vi', { numeric: true })
const distanceOf = (unit: StorageUnitType) => unit.distanceKm ?? Number.POSITIVE_INFINITY
/** Compares by sign, not subtraction, because Infinity - Infinity is NaN: units without a distance go last and tie. */
const byDistance = (a: StorageUnitType, b: StorageUnitType) => {
  const da = distanceOf(a)
  const db = distanceOf(b)
  return da === db ? 0 : da < db ? -1 : 1
}

/**
 * Rentable units always come first (rented ones follow, marked). Inside each group the chosen sort decides, and every
 * sort falls back to the same tie-breakers: price, then unit code. "Gần bạn nhất" therefore lists the closest branch
 * first, cheapest first within a branch, and keeps the price order for branches without coordinates.
 */
export function sortUnits(units: readonly StorageUnitType[], sort: SortOption): StorageUnitType[] {
  const primary: (a: StorageUnitType, b: StorageUnitType) => number =
    sort === 'distance'
      ? byDistance
      : sort === 'price_desc'
        ? (a, b) => byPrice(b, a)
        : sort === 'area_desc'
          ? (a, b) => (b.areaSqMeters ?? 0) - (a.areaSqMeters ?? 0)
          : byPrice

  return [...units].sort((a, b) => {
    if (a.isAvailable !== b.isAvailable) return a.isAvailable ? -1 : 1
    const main = primary(a, b)
    if (main !== 0) return main
    return byPrice(a, b) || byCode(a, b)
  })
}

/** Number of narrowing filters in use (status and sort are not counted). */
export function countActiveFilters(filters: UnitFilters, query: string, hasLocation: boolean): number {
  return [filters.facility, filters.floor, filters.category, filters.size, filters.price, query.trim(), hasLocation ? 'location' : ''].filter(
    Boolean,
  ).length
}
