import { normalizeFloor } from '../../../data/floorLabels'
import { UNIT_CATEGORY_LABELS, getUnitTypeLabel, type StorageUnitType, type UnitCategory } from '../../../data/storageUnitsData'
import { formatNumber, toNumber } from '../../../lib/format'
import type { Facility, StorageUnit } from '../../../types'

/** Lowercase, accent-free text with single spaces: the form both queries and haystacks are matched in. */
export const normalizeSearchText = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLocaleLowerCase('vi-VN')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

// The floor normaliser lives in `data/floorLabels` (one spelling rule for every screen); re-exported for the explorer.
export { compareFloorKeys, normalizeFloor, type NormalizedFloor } from '../../../data/floorLabels'

const CLIMATE_WORDS = /\b(climate|cold|cool|lanh|mat|dieu hoa|nhiet)\b/
const MINI_WORDS = /\b(mini|locker)\b/
const BUSINESS_WORDS = /\b(business|commercial|doanh nghiep|enterprise)\b/

/**
 * Buckets a unit into one of the four display categories from its unit type name and area.
 * Same boundaries as the size filter and the option labels: under 3 m² is "Kho nhỏ", 3 to 8 m² is "Kho tiêu chuẩn"
 * (a 3.0 m² unit is standard, not mini), over 8 m² is business.
 */
export function classifyUnit(typeName: string, area?: number): UnitCategory {
  const normalized = normalizeSearchText(typeName)
  if (CLIMATE_WORDS.test(normalized)) return 'special'
  if ((area != null && area < 3) || MINI_WORDS.test(normalized)) return 'mini'
  if ((area != null && area > 8) || BUSINESS_WORDS.test(normalized)) return 'business'
  return 'personal'
}

export interface ExplorerFacility {
  id: string
  name: string
  district: string
  address: string
  coords: { lat: number; lng: number } | null
  contactPhone: string
  /** Rentable units, counted from the units the page loaded (so the number always matches the list). */
  availableUnits: number
  totalUnits: number
}

const isActive = (facility: Facility) => !facility.status || facility.status === 'ACTIVE'

interface UnitCounts {
  total: number
  available: number
}

function countUnitsByFacility(units: StorageUnit[]): Map<string, UnitCounts> {
  const counts = new Map<string, UnitCounts>()
  for (const unit of units) {
    const entry = counts.get(unit.facilityId) ?? { total: 0, available: 0 }
    entry.total += 1
    if (unit.status === 'AVAILABLE') entry.available += 1
    counts.set(unit.facilityId, entry)
  }
  return counts
}

/**
 * Facilities shown in the explorer. Falls back to the facilities that appear
 * on the loaded units when the facility list itself could not be loaded.
 */
export function toExplorerFacilities(facilities: Facility[], units: StorageUnit[]): ExplorerFacility[] {
  const counts = countUnitsByFacility(units)

  if (facilities.length > 0) {
    return facilities.filter(isActive).map(facility => {
      const lat = toNumber(facility.latitude)
      const lng = toNumber(facility.longitude)
      const unitCounts = counts.get(facility.id)
      return {
        id: facility.id,
        name: facility.name,
        district: facility.city || '',
        address: facility.address || '',
        coords: lat != null && lng != null ? { lat, lng } : null,
        contactPhone: facility.contactPhone || '',
        availableUnits: unitCounts?.available ?? toNumber(facility.availableUnits) ?? 0,
        totalUnits: unitCounts?.total ?? toNumber(facility.totalUnits) ?? 0,
      }
    })
  }

  const inferred = new Map<string, ExplorerFacility>()
  for (const unit of units) {
    if (!unit.facilityId || inferred.has(unit.facilityId)) continue
    const unitCounts = counts.get(unit.facilityId)
    inferred.set(unit.facilityId, {
      id: unit.facilityId,
      name: unit.facilityName || '',
      district: '',
      address: '',
      coords: null,
      contactPhone: '',
      availableUnits: unitCounts?.available ?? 0,
      totalUnits: unitCounts?.total ?? 0,
    })
  }
  return [...inferred.values()]
}

/** Maps backend units to the flat explorer model (one pass; every derived field is computed once). */
export function toExplorerUnits(
  units: StorageUnit[],
  facilities: ExplorerFacility[],
  hasFacilityList: boolean,
): StorageUnitType[] {
  const byId = new Map(facilities.map(facility => [facility.id, facility]))
  const visible = hasFacilityList ? units.filter(unit => byId.has(unit.facilityId)) : units

  return visible.map(unit => {
    const facility = byId.get(unit.facilityId)
    const area = toNumber(unit.areaSqMeters) ?? undefined
    const typeName = unit.unitTypeName || ''
    const floor = normalizeFloor(unit.floorLevel)
    const unitCode = unit.unitCode || '—'
    const facilityName = unit.facilityName || facility?.name || ''
    const facilityAddress = facility?.address || ''

    return {
      id: unit.id,
      unitCode,
      name: `Kho ${unitCode}`,
      unitTypeName: typeName ? getUnitTypeLabel(typeName) : undefined,
      category: classifyUnit(typeName, area),
      areaSqMeters: area,
      monthlyPrice: toNumber(unit.pricePerMonth) ?? 0,
      depositAmount: toNumber(unit.depositAmount) ?? undefined,
      status: unit.status,
      isAvailable: unit.status === 'AVAILABLE',
      facilityId: unit.facilityId,
      facilityName,
      facilityAddress,
      floorKey: floor.key,
      floorLabel: floor.label,
      coords: facility?.coords ?? null,
      // The search matches both the English database name and the Vietnamese label
      searchText: normalizeSearchText([unitCode, typeName, getUnitTypeLabel(typeName), facilityName, facilityAddress, floor.label].join(' ')),
    }
  })
}

export function unitTypeLabel(unit: StorageUnitType): string {
  return unit.unitTypeName || UNIT_CATEGORY_LABELS[unit.category]
}

export function formatArea(area?: number): string {
  return area == null ? '—' : `${formatNumber(area, { maximumFractionDigits: 1 })} m²`
}
