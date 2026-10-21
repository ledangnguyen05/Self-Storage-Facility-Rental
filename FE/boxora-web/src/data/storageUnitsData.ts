import type { UnitStatusType } from '../types'

/**
 * Types and constants for the public "Tìm kho" explorer and the unit detail
 * modal. Status stays the backend enum (render it with `getUnitStatusMeta`);
 * nothing here is user-facing copy except the option labels below.
 */

/** Display category of a unit, derived from its unit type name and area. */
export type UnitCategory = 'mini' | 'personal' | 'business' | 'special'

/** Same boundaries as `matchesSizeBucket`: mini is under 3 m², standard is 3 to 8 m² (a 3 m² unit is standard). */
export const UNIT_CATEGORY_OPTIONS: ReadonlyArray<{ value: UnitCategory; label: string }> = [
  { value: 'mini', label: 'Kho nhỏ (locker, dưới 3 m²)' },
  { value: 'personal', label: 'Kho tiêu chuẩn (3 – 8 m²)' },
  { value: 'business', label: 'Kho lớn và doanh nghiệp (trên 8 m²)' },
  { value: 'special', label: 'Kho mát (kiểm soát nhiệt độ)' },
]

export const UNIT_CATEGORY_LABELS: Record<UnitCategory, string> = {
  mini: 'Kho nhỏ',
  personal: 'Kho tiêu chuẩn',
  business: 'Kho lớn / doanh nghiệp',
  special: 'Kho mát',
}

export const isUnitCategory = (value: string | null | undefined): value is UnitCategory =>
  value === 'mini' || value === 'personal' || value === 'business' || value === 'special'

/** Area buckets shared by the home size guide and the explorer filter. */
export type SizeBucket = 'under3' | '3to8' | '8to15' | '15plus'

export const SIZE_BUCKETS: ReadonlyArray<{ value: SizeBucket; label: string }> = [
  { value: 'under3', label: 'Dưới 3 m²' },
  { value: '3to8', label: '3 – 8 m²' },
  { value: '8to15', label: '8 – 15 m²' },
  { value: '15plus', label: 'Trên 15 m²' },
]

export const isSizeBucket = (value: string | null | undefined): value is SizeBucket =>
  SIZE_BUCKETS.some(bucket => bucket.value === value)

/** Whether `area` (m²) falls in `bucket`. Unknown area never matches. */
export function matchesSizeBucket(area: number | null | undefined, bucket: SizeBucket): boolean {
  if (area == null || !Number.isFinite(area)) return false
  switch (bucket) {
    case 'under3':
      return area < 3
    case '3to8':
      return area >= 3 && area <= 8
    case '8to15':
      return area > 8 && area <= 15
    case '15plus':
      return area > 15
  }
}

/** A storage unit prepared for the explorer (flat, pre-normalised, ready to filter and sort). */
export interface StorageUnitType {
  /** Backend id of the unit (used for booking). */
  id: string
  unitCode: string
  /** `Kho TD-A101` */
  name: string
  unitTypeName?: string
  category: UnitCategory
  areaSqMeters?: number
  /** VND per month. */
  monthlyPrice: number
  depositAmount?: number
  /** Backend enum; render with `getUnitStatusMeta`. */
  status: UnitStatusType
  isAvailable: boolean
  facilityId: string
  facilityName: string
  facilityAddress: string
  /** Normalised floor: `'1'`, `'2'`, `'B1'`, or `''` when the backend has none. */
  floorKey: string
  /** `Tầng 1`, `Hầm 1`, or `—`. */
  floorLabel: string
  coords?: { lat: number; lng: number } | null
  distanceKm?: number
  /** True for the units of the branch closest to the visitor. */
  isNearest?: boolean
  /** Accent-free lowercase text the search box matches against (built once per unit). */
  searchText: string
}

/** Google Maps search link for an address or `lat,lng` (opens directions from the user's position). */
export function buildMapsSearchUrl(query: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
}

export interface GeoPoint {
  lat: number
  lng: number
}

/**
 * Google Maps directions link to a branch. Prefers exact `lat,lng`; falls back to the address when the branch has no
 * coordinates. With `origin` (the visitor's position) the route starts there, otherwise Google Maps asks the visitor.
 */
export function buildDirectionsUrl(destination: GeoPoint | string, origin?: GeoPoint | null): string {
  const target = typeof destination === 'string' ? destination : `${destination.lat},${destination.lng}`
  const params = new URLSearchParams({ api: '1', destination: target, travelmode: 'driving' })
  if (origin) params.set('origin', `${origin.lat},${origin.lng}`)
  return `https://www.google.com/maps/dir/?${params.toString()}`
}

/** Vietnamese letters (accented vowels, đ). A unit type name that has one is already a Vietnamese display name. */
const VIETNAMESE_LETTERS = /[\u00C0-\u1EF9]/

/**
 * Display names of the seeded unit types as they were stored in English in older databases. Newer databases carry the
 * Vietnamese names directly (migration V67); those are shown as they are. Unknown names are shown as they are too.
 */
const UNIT_TYPE_LABELS: ReadonlyArray<readonly [RegExp, string]> = [
  [/^(mini|small|personal locker)/i, 'Kho nhỏ (locker cá nhân)'],
  [/^(medium|compact studio)/i, 'Kho vừa (studio gọn)'],
  [/^(standard|large)/i, 'Kho tiêu chuẩn (1 phòng ngủ)'],
  [/^(extra large|commercial)/i, 'Kho lớn (thương mại, doanh nghiệp)'],
  [/^cold storage/i, 'Kho mát (điều hòa 18 – 22 °C)'],
]

export function getUnitTypeLabel(typeName: string | null | undefined): string {
  const name = (typeName ?? '').trim()
  if (!name) return ''
  if (VIETNAMESE_LETTERS.test(name)) return name
  return UNIT_TYPE_LABELS.find(([pattern]) => pattern.test(name))?.[1] ?? name
}

export function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return Math.round(R * c * 10) / 10
}
