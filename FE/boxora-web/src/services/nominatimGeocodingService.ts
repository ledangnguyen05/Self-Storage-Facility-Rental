/**
 * Robust Multi-provider Geocoding Service for Boxora
 * - Returns list of matches so the user can choose from candidates (like in ganhmuusinh)
 * - Directly calls Boxora Backend AI Geocoding (/api/v1/geocoding/search) with 5s timeout
 * - No global blocking queue, no hanging keystroke requests
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

/**
 * Query Boxora Backend AI Geocoding (proxies Gánh Mưu Sinh & OpenStreetMap Nominatim with sub-second response)
 */
async function queryBoxoraBackendList(query: string, cityHint?: string): Promise<GeocodingResult[]> {
  try {
    const response = await api.post('/api/v1/geocoding/search', {
      query,
      cityHint
    }, { timeout: 3500 })

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
    }
    return []
  } catch (e) {
    console.debug('Backend geocoding request error:', e)
    return []
  }
}

/**
 * Direct client-side Gánh Mưu Sinh Geocoding Proxy (super fast and accurate for VN locations)
 */
async function queryGanhMuuSinhFallback(query: string): Promise<GeocodingResult[]> {
  try {
    const res = await fetch(`https://ganhmuusinh.com/api/v1/geocoding/search?query=${encodeURIComponent(query)}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(3000)
    })
    if (res.ok) {
      const data = await res.json() as { results?: any[] }
      if (Array.isArray(data.results) && data.results.length > 0) {
        return data.results.map((item) => ({
          lat: parseFloat(item.latitude),
          lng: parseFloat(item.longitude),
          displayName: item.display_name,
          source: 'EXACT',
          provider: 'nominatim',
          type: item.type || 'Địa điểm',
          confidence: 'Định vị chính xác'
        }))
      }
    }
  } catch (e) {
    console.debug('Gánh Mưu Sinh geocoding fallback failed:', e)
  }
  return []
}

/**
 * Direct client-side OpenStreetMap Nominatim
 */
async function queryNominatimDirect(query: string, limit = 5): Promise<GeocodingResult[]> {
  try {
    const directUrl = new URL('https://nominatim.openstreetmap.org/search')
    directUrl.searchParams.set('q', query)
    directUrl.searchParams.set('format', 'jsonv2')
    directUrl.searchParams.set('countrycodes', 'vn')
    directUrl.searchParams.set('limit', String(limit))
    directUrl.searchParams.set('addressdetails', '1')

    const res = await fetch(directUrl.toString(), {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(3500)
    })
    if (res.ok) {
      const items = await res.json() as any[]
      if (Array.isArray(items) && items.length > 0) {
        return items.map((item) => ({
          lat: parseFloat(item.lat),
          lng: parseFloat(item.lon),
          displayName: item.display_name,
          source: 'EXACT',
          provider: 'nominatim',
          type: item.type || 'Địa điểm',
          confidence: 'Định vị chính xác'
        }))
      }
    }
  } catch (e) {
    console.debug('Direct Nominatim lookup failed:', e)
  }
  return []
}

/**
 * Fallback to direct client-side Photon only if previous fail
 */
async function queryPhotonFallback(query: string, limit = 5): Promise<GeocodingResult[]> {
  try {
    const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=${limit}&lang=vi`
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(3000),
    })
    if (!response.ok) return []
    const data = await response.json() as { features?: any[] }
    const features = data.features || []

    return features.map((f: any) => {
      const [lng, lat] = f.geometry.coordinates
      const p = f.properties || {}
      const parts: string[] = []
      if (p.name) parts.push(p.name)
      if (p.street && p.street !== p.name) parts.push(p.street)
      if (p.district) parts.push(p.district)
      if (p.city) parts.push(p.city)
      else if (p.state) parts.push(p.state)
      const displayName = parts.join(', ') || p.name || 'Địa chỉ tìm thấy'

      return {
        lat,
        lng,
        displayName,
        source: p.type === 'house' ? 'EXACT' : 'APPROXIMATE',
        provider: 'photon',
        type: p.type || 'street',
      }
    })
  } catch {
    return []
  }
}

/**
 * Search addresses and return candidate list (Gánh Mưu Sinh style)
 */
export async function searchAddressList(fullAddress: string, cityHint?: string): Promise<GeocodingResult[]> {
  const rawQuery = fullAddress.trim()
  if (!rawQuery) return []

  const queryWithCity = cityHint && !rawQuery.toLowerCase().includes(cityHint.toLowerCase())
    ? `${rawQuery}, ${cityHint}`
    : rawQuery

  // 1. First priority: Backend Boxora Geocoding (uses GMS & Nominatim under the hood)
  const backendResults = await queryBoxoraBackendList(queryWithCity, cityHint)
  if (backendResults.length > 0) {
    return backendResults
  }

  // 2. Second priority: Gánh Mưu Sinh public geocoding API
  const gmsResults = await queryGanhMuuSinhFallback(queryWithCity)
  if (gmsResults.length > 0) {
    return gmsResults
  }

  // 3. Third priority: Direct OpenStreetMap Nominatim
  const nominatimResults = await queryNominatimDirect(queryWithCity, 5)
  if (nominatimResults.length > 0) {
    return nominatimResults
  }

  // 4. Fourth priority: Photon
  const photonResults = await queryPhotonFallback(queryWithCity, 5)
  if (photonResults.length > 0) {
    return photonResults
  }

  return []
}

/**
 * Single Geocode address
 */
export async function geocodeAddress(fullAddress: string, cityHint?: string): Promise<GeocodingResult> {
  const list = await searchAddressList(fullAddress, cityHint)
  if (list.length > 0) {
    return list[0]
  }
  throw new Error('ADDRESS_NOT_FOUND')
}

/**
 * Friendly error messages
 */
export function getGeocodingErrorMessage(error: unknown): string {
  const code = error instanceof Error ? error.message : ''
  if (code === 'ADDRESS_REQUIRED') return 'Vui lòng nhập địa chỉ trước khi tìm kiếm tọa độ.'
  if (code === 'ADDRESS_NOT_FOUND') return 'Không tìm thấy tọa độ cho địa chỉ này. Bạn có thể bấm trực tiếp lên bản đồ hoặc kéo ghim.'
  if (code.includes('TimeoutError') || code.includes('AbortError')) return 'Thời gian tìm kiếm địa chỉ quá lâu. Vui lòng thử lại.'
  return 'Chưa thể tìm kiếm tọa độ lúc này. Bạn có thể bấm trực tiếp lên bản đồ để chọn vị trí.'
}

export async function autocompleteAddress(query: string, cityHint?: string): Promise<GeocodingSuggestion[]> {
  const results = await searchAddressList(query, cityHint)
  return results.map(r => ({
    displayName: r.displayName,
    lat: r.lat,
    lng: r.lng,
    type: r.type,
  }))
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
