import { DoorOpen, Clock, KeyRound, Lock, Wrench, type LucideIcon } from 'lucide-react'
import type { ToneWithAccent } from '@/components/ui'
import { getUnitStatusMeta } from '@/constants/statusMeta'
import type { StorageUnit } from '@/types'

/** Unit statuses shown on the floor map, in legend order. `MAINTENANCE` is normalised to `UNDER_MAINTENANCE`. */
export const UNIT_STATUS_KEYS = ['AVAILABLE', 'RESERVED', 'OCCUPIED', 'OVERDUE_LOCKED', 'UNDER_MAINTENANCE'] as const
export type UnitStatusKey = (typeof UNIT_STATUS_KEYS)[number]

export type UnitStatusFilter = 'all' | UnitStatusKey
export type SizeFilter = 'all' | 's' | 'm' | 'l'
export type UnitZone = 'A' | 'B' | 'C'
export type FloorKey = 'floor1' | 'floor2'

export const SIZE_FILTER_OPTIONS: { value: SizeFilter; label: string }[] = [
  { value: 'all', label: 'Mọi diện tích' },
  { value: 's', label: 'Nhỏ (đến 6,5 m²)' },
  { value: 'm', label: 'Vừa (trên 6,5 đến 12 m²)' },
  { value: 'l', label: 'Lớn (trên 12 m²)' },
]

export const UNIT_STATUS_ICON: Record<UnitStatusKey, LucideIcon> = {
  AVAILABLE: DoorOpen,
  RESERVED: Clock,
  OCCUPIED: KeyRound,
  OVERDUE_LOCKED: Lock,
  UNDER_MAINTENANCE: Wrench,
}

/** Tile surface per tone: subtle background with a tone border (DESIGN_SYSTEM §4). */
export const TILE_TONE_CLASS: Record<ToneWithAccent, string> = {
  neutral: 'border-neutral-line bg-neutral-subtle',
  info: 'border-info-line bg-info-subtle',
  success: 'border-success-line bg-success-subtle',
  warning: 'border-warning-line bg-warning-subtle',
  danger: 'border-danger-line bg-danger-subtle',
  accent: 'border-accent-line bg-accent-subtle',
}

export const TONE_TEXT_CLASS: Record<ToneWithAccent, string> = {
  neutral: 'text-neutral',
  info: 'text-info',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
  accent: 'text-accent-text',
}

export const TONE_DOT_CLASS: Record<ToneWithAccent, string> = {
  neutral: 'bg-neutral-solid',
  info: 'bg-info-solid',
  success: 'bg-success-solid',
  warning: 'bg-warning-solid',
  danger: 'bg-danger-solid',
  accent: 'bg-accent',
}

/** Upper-cases the status and folds the legacy `MAINTENANCE` into `UNDER_MAINTENANCE`. */
export function normalizeUnitStatus(status?: string | null): string {
  const value = (status ?? '').toUpperCase()
  return value === 'MAINTENANCE' ? 'UNDER_MAINTENANCE' : value
}

export function isUnitStatusKey(value: string): value is UnitStatusKey {
  return (UNIT_STATUS_KEYS as readonly string[]).includes(value)
}

export function getUnitStatusInfo(unit: Pick<StorageUnit, 'status'>) {
  const key = normalizeUnitStatus(unit.status)
  const meta = getUnitStatusMeta(key)
  return { key, meta, icon: isUnitStatusKey(key) ? UNIT_STATUS_ICON[key] : Lock }
}

export function countByStatus(units: readonly StorageUnit[]): Record<UnitStatusKey, number> {
  const counts: Record<UnitStatusKey, number> = {
    AVAILABLE: 0,
    RESERVED: 0,
    OCCUPIED: 0,
    OVERDUE_LOCKED: 0,
    UNDER_MAINTENANCE: 0,
  }
  for (const unit of units) {
    const key = normalizeUnitStatus(unit.status)
    if (isUnitStatusKey(key)) counts[key] += 1
  }
  return counts
}

/** Physical occupancy: units holding a tenant (rented or locked for debt) over all units. Null when there are no units. */
export function getPhysicalOccupancy(units: readonly StorageUnit[]): number | null {
  if (units.length === 0) return null
  const counts = countByStatus(units)
  return ((counts.OCCUPIED + counts.OVERDUE_LOCKED) / units.length) * 100
}

/** Floor number read from `floorLevel` ("Tầng 2", "Floor 2", "Tang 2", "2"); null when it is missing or unreadable. */
export function parseFloorNumber(floorLevel?: string | null): number | null {
  const match = (floorLevel ?? '').match(/\d+/)
  if (!match) return null
  const floor = Number.parseInt(match[0], 10)
  return Number.isFinite(floor) && floor >= 1 ? floor : null
}

/** One display wording for the floor whatever the stored text ("Floor 1", "Tang 1", "Tầng 1" all read "Tầng 1"). */
export function formatUnitFloor(floorLevel?: string | null): string {
  const floor = parseFloorNumber(floorLevel)
  if (floor !== null) return `Tầng ${floor}`
  return (floorLevel ?? '').trim()
}

/** Zone letter spelled in a code such as "D1-A102", "A-201" or "A101"; null when the code carries none. */
function zoneLetterOf(code: string): UnitZone | null {
  const match = code.match(/(?:^|-)([ABC])-?\d+(?:$|-)/) ?? code.match(/^([ABC])-/)
  return match ? (match[1] as UnitZone) : null
}

/** Legacy convention for units that have no floor level: "C" or a 2xx number means the second floor. */
function isSecondFloorByCode(code: string): boolean {
  if (zoneLetterOf(code) === 'C') return true
  if (/-[2-9]\d\d(?:$|-)/.test(code)) return true
  return false
}

/**
 * The floor a unit stands on. The unit's own `floorLevel` is authoritative (a code such as "QA-KT16211-U1" says nothing about
 * the floor); only a unit without a readable floor level falls back to the code convention.
 */
export function getUnitFloor(unit: Pick<StorageUnit, 'unitCode' | 'floorLevel'>): FloorKey {
  const floor = parseFloorNumber(unit.floorLevel)
  if (floor !== null) return floor >= 2 ? 'floor2' : 'floor1'
  return isSecondFloorByCode((unit.unitCode ?? '').toUpperCase()) ? 'floor2' : 'floor1'
}

/** Zone C is the second floor; zones A and B share the first floor. The zone always agrees with the floor. */
export function getUnitZone(unit: Pick<StorageUnit, 'unitCode' | 'floorLevel'>): UnitZone {
  if (getUnitFloor(unit) === 'floor2') return 'C'
  const code = (unit.unitCode ?? '').toUpperCase()
  const letter = zoneLetterOf(code)
  if (letter === 'A' || letter === 'B') return letter
  // No usable letter (or a "C" code recorded on the first floor): split by the trailing number, as the seeded layout does.
  const numbers = code.match(/\d+/g)
  const last = numbers ? Number.parseInt(numbers[numbers.length - 1], 10) : NaN
  return Number.isFinite(last) && last > 106 ? 'B' : 'A'
}

export function compareUnitCodes(a: Pick<StorageUnit, 'unitCode'>, b: Pick<StorageUnit, 'unitCode'>): number {
  return a.unitCode.localeCompare(b.unitCode, undefined, { numeric: true, sensitivity: 'base' })
}

export function matchesSize(area: number | undefined, filter: SizeFilter): boolean {
  if (filter === 'all') return true
  if (typeof area !== 'number' || !Number.isFinite(area)) return false
  if (filter === 's') return area <= 6.5
  if (filter === 'm') return area > 6.5 && area <= 12
  return area > 12
}

export interface UnitFilters {
  query: string
  size: SizeFilter
  status: UnitStatusFilter
}

export function isUnitFiltered(filters: UnitFilters): boolean {
  return filters.query.trim().length > 0 || filters.size !== 'all' || filters.status !== 'all'
}

export function matchesUnitFilters(unit: StorageUnit, filters: UnitFilters): boolean {
  const query = filters.query.trim().toLowerCase()
  if (query) {
    const haystack = [unit.unitCode, unit.tenantName, unit.contractCode, unit.unitTypeName]
    if (!haystack.some((value) => value?.toLowerCase().includes(query))) return false
  }
  if (!matchesSize(unit.areaSqMeters, filters.size)) return false
  if (filters.status !== 'all' && normalizeUnitStatus(unit.status) !== filters.status) return false
  return true
}

/** Maintenance can only be toggled on an empty unit or one already in maintenance. */
export function canToggleMaintenance(unit: Pick<StorageUnit, 'status'>): boolean {
  const key = normalizeUnitStatus(unit.status)
  return key === 'AVAILABLE' || key === 'UNDER_MAINTENANCE'
}
