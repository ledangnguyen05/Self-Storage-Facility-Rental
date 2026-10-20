/**
 * Robust Multi-provider Geocoding Service for Boxora
 * - Returns list of matches so the user can choose from candidates (like in ganhmuusinh)
 * - Primary provider: Boxora Backend AI Geocoding (/api/v1/geocoding/search)
 * - Secondary provider: Photon (OSM Geocoder)
 * - Tertiary provider: Nominatim (Official OSM)
 */

import { api } from '../lib/axios'

export type GeocodingSource = 'EXACT' | 'APPROXIMATE' | 'MANUAL' | 'UNVERIFIED'

export interface GeocodingResult {
  lat: number
  lng: number
  displayName: string
  source: GeocodingSource
  provider: 'boxora-ai' | 'photon' | 'nominatim' | 'manual'
  type?: string
  confidence?: string
}

export interface GeocodingSuggestion {
  displayName: string
  lat: number
  lng: number
  city?: string
  district?: string
  street?: string
  type?: string
}

const PHOTON_API_URL = 'https://photon.komoot.io/api/'
const NOMINATIM_SEARCH_URL = 'https://nominatim.openstreetmap.org/search'

// Request rate limiter / queue
let requestQueue: Promise<void> = Promise.resolve()
let nextAllowedRequestAt = 0

const runThrottledRequest = <T>(request: () => Promise<T>, delayMs = 150): Promise<T> => {
  const queued = requestQueue.then(async () => {
    const waitMs = Math.max(0, nextAllowedRequestAt - Date.now())
    if (waitMs > 0) await new Promise(r => window.setTimeout(r, waitMs))
    nextAllowedRequestAt = Date.now() + delayMs
    return request()
  })
  requestQueue = queued.then(() => undefined, () => undefined)
  return queued
}

interface PhotonFeature {
  geometry: {
    coordinates: [number, number] // [lng, lat]
  }
  properties: {
    name?: string
    street?: string
    housenumber?: string
    district?: string
    locality?: string
    city?: string
    state?: string
    country?: string
    type?: string
  }
}

const formatPhotonDisplayName = (props: PhotonFeature['properties']): string => {
  const parts: string[] = []
  if (props.name) parts.push(props.name)
  if (props.street && props.street !== props.name) parts.push(props.street)
  if (props.locality) parts.push(props.locality)
  if (props.district && props.district !== props.locality) parts.push(props.district)
  if (props.city) parts.push(props.city)
  else if (props.state) parts.push(props.state)
  return parts.join(', ') || props.name || 'Địa chỉ tìm thấy'
}

/**
 * Stage 1: Query Boxora Backend AI Geocoding
 */
async function queryBoxoraBackendList(query: string, cityHint?: string): Promise<GeocodingResult[]> {
  try {
    const response = await api.post('/api/v1/geocoding/search', {
      query,
      cityHint
    }, { timeout: 6000 })

    const resData = response.data?.data
    if (Array.isArray(resData) && resData.length > 0) {
      return resData.map((item: any) => ({
        lat: Number(item.latitude),
        lng: Number(item.longitude),
        displayName: item.displayName || query,
        source: item.source || 'EXACT',
        provider: 'boxora-ai',
        type: item.confidence || 'Địa điểm',
        confidence: item.confidence || 'Định vị chính xác'
      }))
    } else if (resData && typeof resData.latitude === 'number' && typeof resData.longitude === 'number') {
      return [{
        lat: Number(resData.latitude),
        lng: Number(resData.longitude),
        displayName: resData.displayName || query,
        source: resData.source || 'EXACT',
        provider: 'boxora-ai',
        type: resData.confidence || 'Địa điểm',
        confidence: resData.confidence || 'Định vị chính xác'
      }]
    }
    return []
  } catch {
    return []
  }
}

/**
 * Stage 2: Query Photon geocoding API
 */
async function queryPhoton(query: string, limit = 5): Promise<GeocodingResult[]> {
  try {
    const url = `${PHOTON_API_URL}?q=${encodeURIComponent(query)}&limit=${limit}&lang=vi`
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(3500),
    })
    if (!response.ok) return []
    const data = await response.json() as { features?: PhotonFeature[] }
    const features = data.features || []

    return features.map((f) => {
      const [lng, lat] = f.geometry.coordinates
      const displayName = formatPhotonDisplayName(f.properties)
      const isHouseOrBuilding = f.properties.type === 'house' || Boolean(f.properties.housenumber)
      return {
        lat,
        lng,
        displayName,
        source: isHouseOrBuilding ? 'EXACT' : 'APPROXIMATE',
        provider: 'photon',
        type: f.properties.type || 'street',
      }
    })
  } catch {
    return []
  }
}

/**
 * Stage 3: Query Nominatim OSM as fallback
 */
async function queryNominatimList(query: string, limit = 5): Promise<GeocodingResult[]> {
  try {
    const url = new URL(NOMINATIM_SEARCH_URL)
    url.search = new URLSearchParams({
      q: query,
      format: 'jsonv2',
      addressdetails: '1',
      limit: String(limit),
      countrycodes: 'vn',
    }).toString()

    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'Accept-Language': 'vi',
      },
      signal: AbortSignal.timeout(3500),
    })
    if (!response.ok) return []
    const list = await response.json() as Array<{ lat?: string; lon?: string; display_name?: string; type?: string }>
    return (list || []).filter(item => item.lat && item.lon).map(item => ({
      lat: Number(item.lat),
      lng: Number(item.lon),
      displayName: item.display_name || query,
      source: item.type === 'house' ? 'EXACT' : 'APPROXIMATE',
      provider: 'nominatim',
      type: item.type || 'place',
    }))
  } catch {
    return []
  }
}

function stripHouseNumber(address: string): string | null {
  const cleaned = address.trim()
  const stripped = cleaned.replace(/^\s*(?:số\s*)?\d+[a-zA-Z0-9\/\-\.]*\s*,?\s*/i, '').trim()
  return stripped && stripped !== cleaned ? stripped : null
}

/**
 * Search addresses and return a list of candidate results for the user to select
 */
export async function searchAddressList(fullAddress: string, cityHint?: string): Promise<GeocodingResult[]> {
  const rawQuery = fullAddress.trim()
  if (!rawQuery) return []

  const queryWithCity = cityHint && !rawQuery.toLowerCase().includes(cityHint.toLowerCase())
    ? `${rawQuery}, ${cityHint}`
    : rawQuery

  return runThrottledRequest(async () => {
    // 1. Try Backend AI Geocoding (fastest, most accurate for VN addresses)
    const backendResults = await queryBoxoraBackendList(queryWithCity, cityHint)
    if (backendResults.length > 0) {
      return backendResults
    }

    // 2. Try Photon
    const photonResults = await queryPhoton(queryWithCity, 5)
    if (photonResults.length > 0) {
      return photonResults
    }

    // 3. Fallback stripped street query
    const fallbackStreetQuery = stripHouseNumber(queryWithCity)
    if (fallbackStreetQuery) {
      const strippedBackend = await queryBoxoraBackendList(fallbackStreetQuery, cityHint)
      if (strippedBackend.length > 0) {
        return strippedBackend
      }

      const strippedPhoton = await queryPhoton(fallbackStreetQuery, 5)
      if (strippedPhoton.length > 0) {
        return strippedPhoton
      }
    }

    // 4. Try Nominatim
    const nomResults = await queryNominatimList(queryWithCity, 5)
    if (nomResults.length > 0) {
      return nomResults
    }

    return []
  })
}

/**
 * Single Geocode address with progressive fallback
 */
export async function geocodeAddress(fullAddress: string, cityHint?: string): Promise<GeocodingResult> {
  const list = await searchAddressList(fullAddress, cityHint)
  if (list.length > 0) {
    return list[0]
  }
  throw new Error('ADDRESS_NOT_FOUND')
}

/**
 * Autocomplete address suggestions for user typing
 */
export async function autocompleteAddress(query: string, cityHint?: string): Promise<GeocodingSuggestion[]> {
  const trimmed = query.trim()
  if (trimmed.length < 3) return []

  const searchQuery = cityHint && !trimmed.toLowerCase().includes(cityHint.toLowerCase())
    ? `${trimmed}, ${cityHint}`
    : trimmed

  return runThrottledRequest(async () => {
    try {
      const url = `${PHOTON_API_URL}?q=${encodeURIComponent(searchQuery)}&limit=6&lang=vi`
      const response = await fetch(url, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(3000),
      })
      if (!response.ok) return []
      const data = await response.json() as { features?: PhotonFeature[] }
      return (data.features || []).map((f) => ({
        displayName: formatPhotonDisplayName(f.properties),
        lat: f.geometry.coordinates[1],
        lng: f.geometry.coordinates[0],
        city: f.properties.city || f.properties.state,
        district: f.properties.district,
        street: f.properties.street,
        type: f.properties.type,
      }))
    } catch {
      return []
    }
  }, 150)
}

/**
 * Friendly error messages in Vietnamese and English
 */
export function getGeocodingErrorMessage(error: unknown): string {
  const code = error instanceof Error ? error.message : ''
  if (code === 'ADDRESS_REQUIRED') return 'Vui lòng nhập địa chỉ trước khi tìm kiếm tọa độ.'
  if (code === 'ADDRESS_NOT_FOUND') return 'Không tìm thấy tọa độ cho địa chỉ này. Bạn có thể bấm trực tiếp lên bản đồ hoặc kéo ghim.'
  if (code.includes('TimeoutError') || code.includes('AbortError')) return 'Thời gian tìm kiếm địa chỉ quá lâu. Vui lòng thử lại.'
  return 'Chưa thể tìm kiếm tọa độ lúc này. Bạn có thể bấm trực tiếp lên bản đồ để chọn vị trí.'
}

export const geocodeAddressWithNominatim = async (address: string) => {
  const result = await geocodeAddress(address)
  return {
    lat: result.lat,
    lng: result.lng,
    displayName: result.displayName,
  }
}
export const getNominatimErrorMessage = getGeocodingErrorMessage
