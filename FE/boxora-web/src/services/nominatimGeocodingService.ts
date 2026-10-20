/**
 * Robust Multi-provider Geocoding Service for Boxora
 * - Primary provider: Boxora Backend AI Geocoding (/api/v1/geocoding/search) powered by Gemini & Vietnam admin dataset
 * - Secondary provider: Photon (OSM Geocoder) with short 3.5s timeout
 * - Tertiary provider: Nominatim (Official OSM) with short 3.5s timeout
 * - Automatic Vietnamese address normalization & progressive query fallback
 * - Explicit location source tracking: EXACT, APPROXIMATE, MANUAL, UNVERIFIED
 */

import { api } from '../lib/axios'

export type GeocodingSource = 'EXACT' | 'APPROXIMATE' | 'MANUAL' | 'UNVERIFIED'

export interface GeocodingResult {
  lat: number
  lng: number
  displayName: string
  source: GeocodingSource
  provider: 'boxora-ai' | 'photon' | 'nominatim' | 'manual'
  confidence?: string
}

export interface GeocodingSuggestion {
  displayName: string
  lat: number
  lng: number
  city?: string
  district?: string
  street?: string
}

const PHOTON_API_URL = 'https://photon.komoot.io/api/'
const NOMINATIM_SEARCH_URL = 'https://nominatim.openstreetmap.org/search'

// Request rate limiter / queue
let requestQueue: Promise<void> = Promise.resolve()
let nextAllowedRequestAt = 0

const runThrottledRequest = <T>(request: () => Promise<T>, delayMs = 200): Promise<T> => {
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
async function queryBoxoraBackend(query: string, cityHint?: string): Promise<GeocodingResult | null> {
  try {
    const response = await api.post('/api/v1/geocoding/search', {
      query,
      cityHint
    }, { timeout: 6000 })

    const resData = response.data?.data
    if (resData && typeof resData.latitude === 'number' && typeof resData.longitude === 'number') {
      return {
        lat: Number(resData.latitude),
        lng: Number(resData.longitude),
        displayName: resData.displayName || query,
        source: resData.source || 'EXACT',
        provider: 'boxora-ai',
        confidence: resData.confidence || 'Định vị chính xác'
      }
    }
    return null
  } catch {
    return null
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
      }
    })
  } catch {
    return []
  }
}

/**
 * Stage 3: Query Nominatim OSM as fallback
 */
async function queryNominatim(query: string): Promise<GeocodingResult | null> {
  try {
    const url = new URL(NOMINATIM_SEARCH_URL)
    url.search = new URLSearchParams({
      q: query,
      format: 'jsonv2',
      addressdetails: '1',
      limit: '1',
      countrycodes: 'vn',
    }).toString()

    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'Accept-Language': 'vi',
      },
      signal: AbortSignal.timeout(3500),
    })
    if (!response.ok) return null
    const list = await response.json() as Array<{ lat?: string; lon?: string; display_name?: string; type?: string }>
    const first = list[0]
    if (!first?.lat || !first?.lon) return null
    return {
      lat: Number(first.lat),
      lng: Number(first.lon),
      displayName: first.display_name || query,
      source: first.type === 'house' ? 'EXACT' : 'APPROXIMATE',
      provider: 'nominatim',
    }
  } catch {
    return null
  }
}

/**
 * Strip house number for progressive fallback
 */
function stripHouseNumber(address: string): string | null {
  const cleaned = address.trim()
  const stripped = cleaned.replace(/^\s*(?:số\s*)?\d+[a-zA-Z0-9\/\-\.]*\s*,?\s*/i, '').trim()
  return stripped && stripped !== cleaned ? stripped : null
}

/**
 * Geocode an address with progressive fallback:
 * 1. Backend AI Geocoding (reliable, high-accuracy VN addresses, fast)
 * 2. Photon Geocoder
 * 3. Stripped street on Photon
 * 4. Nominatim fallback
 */
export async function geocodeAddress(fullAddress: string, cityHint?: string): Promise<GeocodingResult> {
  const rawQuery = fullAddress.trim()
  if (!rawQuery) throw new Error('ADDRESS_REQUIRED')

  const queryWithCity = cityHint && !rawQuery.toLowerCase().includes(cityHint.toLowerCase())
    ? `${rawQuery}, ${cityHint}`
    : rawQuery

  return runThrottledRequest(async () => {
    // 1. Try Backend Geocoding
    const backendResult = await queryBoxoraBackend(queryWithCity, cityHint)
    if (backendResult) {
      return backendResult
    }

    // 2. Try Photon
    const photonResults = await queryPhoton(queryWithCity, 3)
    if (photonResults.length > 0) {
      return photonResults[0]
    }

    // 3. Try stripped street query
    const fallbackStreetQuery = stripHouseNumber(queryWithCity)
    if (fallbackStreetQuery) {
      const strippedBackend = await queryBoxoraBackend(fallbackStreetQuery, cityHint)
      if (strippedBackend) {
        return {
          ...strippedBackend,
          source: 'APPROXIMATE',
          confidence: 'Định vị theo trục đường'
        }
      }

      const strippedPhoton = await queryPhoton(fallbackStreetQuery, 3)
      if (strippedPhoton.length > 0) {
        return {
          ...strippedPhoton[0],
          source: 'APPROXIMATE',
          confidence: 'Định vị theo trục đường'
        }
      }
    }

    // 4. Try Nominatim
    const nomResult = await queryNominatim(queryWithCity)
    if (nomResult) return nomResult

    if (fallbackStreetQuery) {
      const nomFallback = await queryNominatim(fallbackStreetQuery)
      if (nomFallback) {
        return {
          ...nomFallback,
          source: 'APPROXIMATE',
          confidence: 'Định vị theo trục đường',
        }
      }
    }

    throw new Error('ADDRESS_NOT_FOUND')
  })
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
  if (code.includes('TimeoutError') || code.includes('AbortError')) return 'Thời gian tìm kiếm địa chỉ quá lâu. Vui lòng kiểm tra kết nối mạng và thử lại.'
  return 'Chưa thể tìm kiếm tọa độ lúc này. Bạn có thể bấm trực tiếp lên bản đồ để chọn vị trí.'
}

// Backward compatibility export with existing code
export const geocodeAddressWithNominatim = async (address: string) => {
  const result = await geocodeAddress(address)
  return {
    lat: result.lat,
    lng: result.lng,
    displayName: result.displayName,
  }
}
export const getNominatimErrorMessage = getGeocodingErrorMessage
