/**
 * Geocoding Service for Boxora (dữ liệu bản đồ thật - OpenStreetMap)
 * - Tìm kiếm: Photon (nhanh, hỗ trợ số nhà) chạy song song với Nominatim, lấy kết quả đến trước.
 * - Tự thu gọn truy vấn (bỏ số nhà / phường) khi không tìm thấy kết quả khớp.
 * - Reverse geocoding: từ tọa độ ghim -> địa chỉ hiển thị.
 * - Chỉ nhận kết quả nằm trong lãnh thổ Việt Nam. Không dùng LLM để đoán tọa độ.
 */

export type GeocodingSource = 'EXACT' | 'APPROXIMATE' | 'MANUAL' | 'UNVERIFIED'

export interface GeocodingResult {
  lat: number
  lng: number
  displayName: string
  source: GeocodingSource
  provider: 'photon' | 'nominatim' | 'manual'
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

// Khung bao Việt Nam (đất liền + đảo chính)
const VN_BBOX = { minLng: 102.1, minLat: 8.3, maxLng: 109.6, maxLat: 23.5 }
// Điểm ưu tiên tìm kiếm (TP.HCM)
const BIAS_POINT = { lat: 10.7769, lng: 106.7009 }

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org'
const PHOTON_BASE = 'https://photon.komoot.io'

export const isInVietnam = (lat: number, lng: number): boolean =>
  Number.isFinite(lat) &&
  Number.isFinite(lng) &&
  lat >= VN_BBOX.minLat &&
  lat <= VN_BBOX.maxLat &&
  lng >= VN_BBOX.minLng &&
  lng <= VN_BBOX.maxLng

const joinUnique = (parts: Array<string | undefined | null>): string => {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of parts) {
    const p = (raw || '').trim()
    if (!p) continue
    const key = p.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(p)
  }
  return out.join(', ')
}

const stripCountry = (q: string): string =>
  q
    .replace(/,?\s*(việt\s*nam|vietnam|viet\s*nam)\s*$/i, '')
    .replace(/\s+/g, ' ')
    .trim()

async function fetchJson(url: string, timeoutMs: number, signal?: AbortSignal): Promise<any> {
  const timeoutSignal = AbortSignal.timeout(timeoutMs)
  const combined =
    signal && typeof (AbortSignal as any).any === 'function'
      ? (AbortSignal as any).any([signal, timeoutSignal])
      : timeoutSignal
  const response = await fetch(url, { headers: { Accept: 'application/json' }, signal: combined })
  if (!response.ok) throw new Error(`HTTP_${response.status}`)
  return response.json()
}

/* ------------------------------ PHOTON ------------------------------ */

function mapPhotonFeature(f: any): GeocodingResult | null {
  const coords = f?.geometry?.coordinates
  if (!Array.isArray(coords) || coords.length < 2) return null
  const [lng, lat] = coords as [number, number]
  if (!isInVietnam(lat, lng)) return null
  const p = f.properties || {}
  if (p.countrycode && String(p.countrycode).toUpperCase() !== 'VN') return null

  const streetLine = p.housenumber
    ? `${p.housenumber} ${p.street || p.name || ''}`.trim()
    : p.street && p.name && p.name !== p.street
    ? `${p.name}, ${p.street}`
    : p.name || p.street
  const displayName =
    joinUnique([streetLine, p.locality, p.district, p.city || p.county, p.state]) || 'Địa điểm tìm thấy'

  const hasHouse = Boolean(p.housenumber)
  return {
    lat,
    lng,
    displayName,
    source: hasHouse ? 'EXACT' : 'APPROXIMATE',
    provider: 'photon',
    type: hasHouse ? 'Số nhà' : p.osm_value || p.type || 'Địa điểm',
    confidence: hasHouse ? 'Chính xác số nhà' : 'Gần đúng',
  }
}

async function searchPhoton(query: string, limit: number, signal?: AbortSignal): Promise<GeocodingResult[]> {
  const bbox = `${VN_BBOX.minLng},${VN_BBOX.minLat},${VN_BBOX.maxLng},${VN_BBOX.maxLat}`
  const url =
    `${PHOTON_BASE}/api/?q=${encodeURIComponent(query)}&limit=${limit}` +
    `&lat=${BIAS_POINT.lat}&lon=${BIAS_POINT.lng}&bbox=${bbox}`
  const data = await fetchJson(url, 5000, signal)
  const features: any[] = Array.isArray(data?.features) ? data.features : []
  return features.map(mapPhotonFeature).filter((r): r is GeocodingResult => r !== null)
}

async function reversePhoton(lat: number, lng: number, signal?: AbortSignal): Promise<string | null> {
  const data = await fetchJson(`${PHOTON_BASE}/reverse?lat=${lat}&lon=${lng}&limit=1`, 5000, signal)
  const f = data?.features?.[0]
  if (!f) return null
  const mapped = mapPhotonFeature({ ...f, geometry: { coordinates: [lng, lat] } })
  return mapped?.displayName || null
}

/* ----------------------------- NOMINATIM ---------------------------- */

function mapNominatimItem(item: any): GeocodingResult | null {
  const lat = Number(item?.lat)
  const lng = Number(item?.lon)
  if (!isInVietnam(lat, lng)) return null
  const a = item.address || {}
  const streetLine = a.house_number ? `${a.house_number} ${a.road || ''}`.trim() : a.road || item.name
  const displayName =
    joinUnique([
      streetLine,
      a.quarter || a.suburb || a.neighbourhood || a.village,
      a.city_district || a.county,
      a.city || a.town || a.state,
    ]) || String(item.display_name || '').replace(/,\s*Việt Nam$/i, '')

  const hasHouse = Boolean(a.house_number)
  return {
    lat,
    lng,
    displayName,
    source: hasHouse ? 'EXACT' : 'APPROXIMATE',
    provider: 'nominatim',
    type: hasHouse ? 'Số nhà' : item.type || 'Địa điểm',
    confidence: hasHouse ? 'Chính xác số nhà' : 'Gần đúng',
  }
}

async function searchNominatim(query: string, limit: number, signal?: AbortSignal): Promise<GeocodingResult[]> {
  const url =
    `${NOMINATIM_BASE}/search?q=${encodeURIComponent(query)}&format=jsonv2&addressdetails=1` +
    `&countrycodes=vn&accept-language=vi&limit=${limit}`
  const data = await fetchJson(url, 6000, signal)
  const list: any[] = Array.isArray(data) ? data : []
  return list.map(mapNominatimItem).filter((r): r is GeocodingResult => r !== null)
}

async function reverseNominatim(lat: number, lng: number, signal?: AbortSignal): Promise<string | null> {
  const data = await fetchJson(
    `${NOMINATIM_BASE}/reverse?lat=${lat}&lon=${lng}&format=jsonv2&addressdetails=1&accept-language=vi&zoom=18`,
    6000,
    signal
  )
  if (!data || data.error) return null
  return mapNominatimItem({ ...data, lat, lon: lng })?.displayName || null
}

/* ------------------------------ HELPERS ----------------------------- */

/** Trả về kết quả đầu tiên có dữ liệu; nếu tất cả đều rỗng/lỗi thì trả []. */
function firstNonEmpty<T>(tasks: Array<Promise<T[]>>): Promise<T[]> {
  return new Promise((resolve) => {
    let pending = tasks.length
    if (pending === 0) return resolve([])
    tasks.forEach((task) => {
      task
        .then((res) => {
          if (res.length > 0) resolve(res)
        })
        .catch(() => undefined)
        .finally(() => {
          pending -= 1
          if (pending === 0) resolve([])
        })
    })
  })
}

function dedupe(results: GeocodingResult[]): GeocodingResult[] {
  const seen = new Set<string>()
  return results.filter((r) => {
    const key = `${r.lat.toFixed(4)},${r.lng.toFixed(4)}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/** Sinh các biến thể truy vấn từ chi tiết -> tổng quát (bỏ số nhà, bỏ phường...). */
function buildQueryVariants(raw: string): string[] {
  const base = stripCountry(raw)
  const variants = [base]
  const parts = base.split(',').map((p) => p.trim()).filter(Boolean)

  // Bỏ số nhà ở đầu: "21 Võ Trường Toản" -> "Võ Trường Toản"
  const noHouse = base.replace(/^\s*\d+[\w/-]*\s+/, '')
  if (noHouse !== base && noHouse.length >= 3) variants.push(noHouse)

  // Rút gọn dần phần đuôi
  if (parts.length > 2) variants.push(parts.slice(0, 2).join(', '))
  if (parts.length > 3) variants.push(parts.slice(0, 3).join(', '))

  return Array.from(new Set(variants.filter((v) => v.length >= 2)))
}

const STOP_WORDS = new Set([
  'duong', 'phuong', 'quan', 'huyen', 'xa', 'thi', 'tran', 'thanh', 'pho', 'tp', 'tinh', 'so', 'toa', 'nha',
  'p', 'q', 'tx', 'viet', 'nam', 'vietnam', 'ho', 'chi', 'minh', 'hcm', 'tphcm', 'ngo', 'hem', 'ngach', 'khu',
])

/** Bỏ dấu tiếng Việt, về chữ thường. */
const normalizeText = (s: string): string =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()

/** Các từ khóa chính (tên đường / tòa nhà) của truy vấn, bỏ số và từ phổ biến. */
function significantTokens(query: string): string[] {
  const firstPart = query.split(',')[0] || query
  return normalizeText(firstPart)
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 2 && !/^\d+$/.test(t) && !STOP_WORDS.has(t))
}

/** Điểm liên quan 0..1: tỉ lệ từ khóa chính của truy vấn xuất hiện trong địa chỉ kết quả. */
function relevanceScore(tokens: string[], result: GeocodingResult): number {
  if (tokens.length === 0) return 1
  const haystack = normalizeText(result.displayName)
  const hit = tokens.filter((t) => haystack.includes(t)).length
  return hit / tokens.length
}

/* ------------------------------- PUBLIC ----------------------------- */

/**
 * Tìm danh sách địa điểm (Photon + Nominatim chạy song song, lấy kết quả đến trước).
 * Chỉ nhận kết quả thực sự khớp tên đường / tòa nhà; nếu không khớp thì thử truy vấn tổng quát hơn.
 */
export async function searchAddressList(
  fullAddress: string,
  cityHint?: string,
  signal?: AbortSignal
): Promise<GeocodingResult[]> {
  const rawQuery = fullAddress.trim()
  if (!rawQuery) return []

  const withCity =
    cityHint && !rawQuery.toLowerCase().includes(cityHint.toLowerCase()) ? `${rawQuery}, ${cityHint}` : rawQuery

  const tokens = significantTokens(withCity)
  let bestWeak: GeocodingResult[] = []

  for (const query of buildQueryVariants(withCity)) {
    if (signal?.aborted) return []
    const results = dedupe(
      await firstNonEmpty<GeocodingResult>([searchPhoton(query, 8, signal), searchNominatim(query, 8, signal)])
    )
    if (results.length === 0) continue

    const ranked = results
      .map((r) => ({ r, score: relevanceScore(tokens, r) }))
      .sort((a, b) => b.score - a.score || Number(b.r.source === 'EXACT') - Number(a.r.source === 'EXACT'))

    const good = ranked.filter((x) => x.score >= 0.5).map((x) => x.r)
    if (good.length > 0) return good.slice(0, 6)

    if (bestWeak.length === 0) bestWeak = ranked.map((x) => x.r)
  }
  return bestWeak.slice(0, 6)
}

/**
 * Địa chỉ hiển thị từ tọa độ (reverse geocoding). Trả null nếu không xác định được.
 */
export async function reverseGeocode(lat: number, lng: number, signal?: AbortSignal): Promise<string | null> {
  if (!isInVietnam(lat, lng)) return null
  const res = await firstNonEmpty<string>(
    [reversePhoton(lat, lng, signal), reverseNominatim(lat, lng, signal)].map((t) =>
      t.then((v) => (v ? [v] : []))
    )
  )
  return res[0] || null
}

export async function geocodeAddress(fullAddress: string, cityHint?: string): Promise<GeocodingResult> {
  const list = await searchAddressList(fullAddress, cityHint)
  if (list.length > 0) return list[0]
  throw new Error('ADDRESS_NOT_FOUND')
}

export function getGeocodingErrorMessage(error: unknown): string {
  const code = error instanceof Error ? error.message : ''
  if (code === 'ADDRESS_REQUIRED') return 'Vui lòng nhập địa chỉ trước khi tìm kiếm tọa độ.'
  if (code === 'ADDRESS_NOT_FOUND')
    return 'Không tìm thấy tọa độ cho địa chỉ này. Bạn có thể bấm trực tiếp lên bản đồ hoặc kéo ghim.'
  if (code.includes('TimeoutError') || code.includes('AbortError'))
    return 'Thời gian tìm kiếm địa chỉ quá lâu. Vui lòng thử lại.'
  return 'Chưa thể tìm kiếm tọa độ lúc này. Bạn có thể bấm trực tiếp lên bản đồ để chọn vị trí.'
}

export async function autocompleteAddress(query: string, cityHint?: string): Promise<GeocodingSuggestion[]> {
  const results = await searchAddressList(query, cityHint)
  return results.map((r) => ({
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
