/**
 * Robust Multi-provider Geocoding Service for Boxora
 * - Primary provider: Photon (Komoot OSM Open Geocoder, fast, supports CORS, high coverage in VN)
 * - Secondary provider: Nominatim (Official OSM)
 * - Automatic Vietnamese address normalization & progressive query fallback
 *   (e.g., "21 Võ Trường Toản, TP. Hồ Chí Minh" -> exact match or fallback to street/ward)
 * - Autocomplete suggestion support
 * - Explicit location source tracking: EXACT, APPROXIMATE, MANUAL, UNVERIFIED
 */

export type GeocodingSource = 'EXACT' | 'APPROXIMATE' | 'MANUAL' | 'UNVERIFIED'

export interface GeocodingResult {
  lat: number
  lng: number
  displayName: string
  source: GeocodingSource
  provider: 'photon' | 'nominatim' | 'manual'
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

const runThrottledRequest = <T>(request: () => Promise<T>, delayMs = 300): Promise<T> => {
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

/**
 * Format a human-readable display address from Photon properties
 */
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
 * Query Photon geocoding API
 */
async function queryPhoton(query: string, limit = 5): Promise<GeocodingResult[]> {
  const url = `${PHOTON_API_URL}?q=${encodeURIComponent(query)}&limit=${limit}&lang=vi`
  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(8000),
  })
  if (!response.ok) throw new Error(`PHOTON_HTTP_${response.status}`)
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
}

/**
 * Query Nominatim as fallback
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
      signal: AbortSignal.timeout(6000),
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
 * e.g., "21 Võ Trường Toản, TP. Hồ Chí Minh" -> "Võ Trường Toản, TP. Hồ Chí Minh"
 */
function stripHouseNumber(address: string): string | null {
  const cleaned = address.trim()
  // Match leading numbers like "21", "21A", "Số 21", "21/3B"
  const stripped = cleaned.replace(/^\s*(?:số\s*)?\d+[a-zA-Z0-9\/\-\.]*\s*,?\s*/i, '').trim()
  return stripped && stripped !== cleaned ? stripped : null
}

/**
 * Geocode an address with progressive fallback:
 * 1. Try full address on Photon
 * 2. If no result, try stripping house number (search street + province)
 * 3. If no result, try Nominatim fallback
 */
export async function geocodeAddress(fullAddress: string, cityHint?: string): Promise<GeocodingResult> {
  const rawQuery = fullAddress.trim()
  if (!rawQuery) throw new Error('ADDRESS_REQUIRED')

  const queryWithCity = cityHint && !rawQuery.toLowerCase().includes(cityHint.toLowerCase())
    ? `${rawQuery}, ${cityHint}`
    : rawQuery

  return runThrottledRequest(async () => {
    // Stage 1: Try exact query on Photon
    try {
      const results = await queryPhoton(queryWithCity, 3)
      if (results.length > 0) {
        return results[0]
      }
    } catch {
      // Continue to fallback
    }

    // Stage 2: Try stripped street query on Photon
    const fallbackStreetQuery = stripHouseNumber(queryWithCity)
    if (fallbackStreetQuery) {
      try {
        const fallbackResults = await queryPhoton(fallbackStreetQuery, 3)
        if (fallbackResults.length > 0) {
          const res = fallbackResults[0]
          return {
            ...res,
            source: 'APPROXIMATE', // Marked as street-level approximate
            confidence: 'Định vị theo trục đường (chưa có số nhà chi tiết)',
          }
        }
      } catch {
        // Continue
      }
    }

    // Stage 3: Try Nominatim
    try {
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
    } catch {
      // Continue
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
        signal: AbortSignal.timeout(5000),
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
  }, 200)
}

/**
 * Friendly error messages in Vietnamese and English
 */
export function getGeocodingErrorMessage(error: unknown): string {
  const code = error instanceof Error ? error.message : ''
  if (code === 'ADDRESS_REQUIRED') return 'Vui lòng nhập địa chỉ trước khi tìm kiếm tọa độ.'
  if (code === 'ADDRESS_NOT_FOUND') return 'Không tìm thấy tọa độ cho địa chỉ này. Hãy kiểm tra lại tên đường, phường/xã hoặc thành phố, hoặc bạn có thể nhập tọa độ thủ công.'
  if (code.includes('TimeoutError') || code.includes('AbortError')) return 'Thời gian tìm kiếm địa chỉ quá lâu. Vui lòng kiểm tra kết nối mạng và thử lại.'
  if (code.startsWith('PHOTON_HTTP_') || code.startsWith('NOMINATIM_HTTP_')) return 'Dịch vụ bản đồ tạm thời gián đoạn. Vui lòng thử lại sau ít phút.'
  return 'Chưa thể tìm kiếm tọa độ lúc này. Vui lòng thử lại hoặc gán tọa độ thủ công.'
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
