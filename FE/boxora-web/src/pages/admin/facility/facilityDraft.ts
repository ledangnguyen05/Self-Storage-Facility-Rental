import type { Facility, FacilityLayoutConfig } from '@/types'
import { DEFAULT_FACILITY_LAYOUT_CONFIG, parseFacilityLayoutConfig } from '@/utils/facilityLayout'

export type FacilityStatusValue = 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE'

/** Form state of the facility editor. Coordinates stay text while typing. */
export interface FacilityDraft {
  name: string
  code: string
  address: string
  city: string
  contactPhone: string
  email: string
  description: string
  status: FacilityStatusValue
  latitude: string
  longitude: string
  layout: FacilityLayoutConfig
}

export type FacilityDraftErrors = Partial<Record<Exclude<keyof FacilityDraft, 'layout'>, string>>

export const blankDraft = (): FacilityDraft => ({
  name: '',
  code: '',
  address: '',
  city: '',
  contactPhone: '',
  email: '',
  description: '',
  status: 'ACTIVE',
  latitude: '',
  longitude: '',
  layout: { ...DEFAULT_FACILITY_LAYOUT_CONFIG },
})

export const toDraft = (facility: Facility): FacilityDraft => ({
  name: facility.name || '',
  code: facility.code || '',
  address: facility.address || '',
  city: facility.city || '',
  contactPhone: facility.contactPhone || '',
  email: facility.email || '',
  description: facility.description || '',
  status: facility.status === 'INACTIVE' || facility.status === 'MAINTENANCE' ? facility.status : 'ACTIVE',
  latitude: facility.latitude == null ? '' : String(facility.latitude),
  longitude: facility.longitude == null ? '' : String(facility.longitude),
  layout: parseFacilityLayoutConfig(facility.layoutConfig),
})

export const SINGLE_LINE_LAYOUT_FIELDS: ReadonlyArray<{ key: keyof FacilityLayoutConfig; label: string }> = [
  { key: 'title', label: 'Tên sơ đồ' },
  { key: 'floor1Name', label: 'Tên tầng 1' },
  { key: 'floor2Name', label: 'Tên tầng 2' },
  { key: 'zoneAName', label: 'Tên phân khu A' },
  { key: 'zoneBName', label: 'Tên phân khu B' },
  { key: 'zoneCName', label: 'Tên phân khu C' },
  { key: 'loadingBayFloor1', label: 'Điểm nhận hàng tầng 1' },
  { key: 'corridorNorth', label: 'Hành lang tầng 1' },
  { key: 'exitFloor1', label: 'Lối thoát tầng 1' },
  { key: 'loadingBayFloor2', label: 'Điểm nhận hàng tầng 2' },
  { key: 'corridorClimate', label: 'Hành lang tầng 2' },
  { key: 'exitFloor2', label: 'Lối thoát tầng 2' },
  { key: 'totalAreaFloor1', label: 'Diện tích tầng 1' },
  { key: 'totalAreaFloor2', label: 'Diện tích tầng 2' },
]

export const ZONE_DESCRIPTION_FIELDS: ReadonlyArray<{ key: keyof FacilityLayoutConfig; label: string }> = [
  { key: 'zoneADesc', label: 'Mô tả phân khu A' },
  { key: 'zoneBDesc', label: 'Mô tả phân khu B' },
  { key: 'zoneCDesc', label: 'Mô tả phân khu C' },
]

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
/** Same rule as the backend: letters, digits, `-`, `_`, `.`; starts with a letter or digit; no spaces or markup. */
const CODE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/

/** Parses a coordinate field: null when empty, NaN when not a number. */
const parseCoordinate = (text: string): number | null => (text.trim() === '' ? null : Number(text.replace(',', '.')))

/** The backend stores 7 decimal places (about 1 cm). */
const COORDINATE_DECIMALS = 7
const roundCoordinate = (value: number | null): number | null => (value === null ? null : Number(value.toFixed(COORDINATE_DECIMALS)))

/** Coordinates to draw on the preview map, or null while the two fields are not both valid numbers. */
export function parseDraftCoordinates(draft: Pick<FacilityDraft, 'latitude' | 'longitude'>): { lat: number; lng: number } | null {
  const lat = parseCoordinate(draft.latitude)
  const lng = parseCoordinate(draft.longitude)
  if (lat === null || lng === null || !Number.isFinite(lat) || !Number.isFinite(lng)) return null
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null
  return { lat, lng }
}

/** Formats a coordinate the way the fields show it (at most 7 decimals, no trailing zeros). */
export const formatCoordinate = (value: number): string => String(Number(value.toFixed(COORDINATE_DECIMALS)))

/** Rough bounding box of Vietnam. A position outside it is almost always a typo (swapped or mistyped digits). */
export function isOutsideVietnam(point: { lat: number; lng: number }): boolean {
  return point.lat < 8 || point.lat > 24.5 || point.lng < 102 || point.lng > 110
}

export function validateDraft(draft: FacilityDraft): FacilityDraftErrors {
  const errors: FacilityDraftErrors = {}
  const name = draft.name.trim()
  const code = draft.code.trim()
  if (!name) errors.name = 'Nhập tên chi nhánh.'
  else if (name.length < 2) errors.name = 'Tên chi nhánh có ít nhất 2 ký tự.'
  else if (name.length > 150) errors.name = 'Tên chi nhánh tối đa 150 ký tự.'
  else if (/[<>]/.test(name)) errors.name = 'Tên chi nhánh không được chứa ký tự < hoặc >.'
  if (!code) errors.code = 'Nhập mã chi nhánh.'
  else if (code.length < 2) errors.code = 'Mã chi nhánh có ít nhất 2 ký tự.'
  else if (code.length > 30) errors.code = 'Mã chi nhánh tối đa 30 ký tự.'
  else if (!CODE_PATTERN.test(code)) errors.code = 'Mã chi nhánh chỉ gồm chữ cái, chữ số, dấu gạch ngang, gạch dưới hoặc dấu chấm, không có khoảng trắng.'
  if (!draft.address.trim()) errors.address = 'Nhập địa chỉ đầy đủ.'
  if (draft.email.trim() && !EMAIL_PATTERN.test(draft.email.trim())) errors.email = 'Email không hợp lệ.'

  const latitude = parseCoordinate(draft.latitude)
  const longitude = parseCoordinate(draft.longitude)
  if ((latitude === null) !== (longitude === null)) {
    const message = 'Nhập cả vĩ độ và kinh độ, hoặc để trống cả hai.'
    if (latitude === null) errors.latitude = message
    else errors.longitude = message
  }
  if (latitude !== null && (!Number.isFinite(latitude) || latitude < -90 || latitude > 90)) errors.latitude = 'Vĩ độ nằm trong khoảng -90 đến 90.'
  if (longitude !== null && (!Number.isFinite(longitude) || longitude < -180 || longitude > 180)) errors.longitude = 'Kinh độ nằm trong khoảng -180 đến 180.'
  return errors
}

/** Request body for create / update. `clearCoordinates` tells the backend to drop a previously saved position. */
export function toFacilityPayload(draft: FacilityDraft, isEdit: boolean) {
  const latitude = parseCoordinate(draft.latitude)
  const longitude = parseCoordinate(draft.longitude)
  return {
    name: draft.name.trim(),
    code: draft.code.trim().toUpperCase(),
    address: draft.address.trim(),
    city: draft.city.trim(),
    contactPhone: draft.contactPhone.trim(),
    email: draft.email.trim(),
    description: draft.description.trim(),
    status: draft.status,
    latitude: roundCoordinate(latitude),
    longitude: roundCoordinate(longitude),
    layoutConfig: JSON.stringify(draft.layout),
    ...(isEdit ? { clearCoordinates: latitude === null && longitude === null } : {}),
  }
}
