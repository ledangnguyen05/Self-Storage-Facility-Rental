export interface NominatimAddressResult {
  lat: number
  lng: number
  displayName: string
}

interface NominatimSearchResponse {
  lat?: string
  lon?: string
  display_name?: string
}

const NOMINATIM_SEARCH_URL = 'https://nominatim.openstreetmap.org/search'

// Serialize requests from this app instance to stay under Nominatim's public
// service limit. Address lookup only runs after an explicit user search.
let requestQueue: Promise<void> = Promise.resolve()
let nextAllowedRequestAt = 0

const runNominatimRequest = <T>(request: () => Promise<T>): Promise<T> => {
  const queuedRequest = requestQueue.then(async () => {
    const waitMs = Math.max(0, nextAllowedRequestAt - Date.now())
    if (waitMs > 0) await new Promise(resolve => window.setTimeout(resolve, waitMs))
    nextAllowedRequestAt = Date.now() + 1000
    return request()
  })

  requestQueue = queuedRequest.then(() => undefined, () => undefined)
  return queuedRequest
}

/**
 * Nominatim often has the street but not the exact house number or ward ("1 Võ Văn Ngân, Phường Linh Chiểu, Thủ Đức" returns
 * nothing while "Võ Văn Ngân, Thủ Đức" is found). Try the full address first, then progressively looser versions, so the
 * pin lands on the right street instead of the visitor getting an error for a perfectly valid address.
 */
export const geocodeQueryVariants = (address: string): string[] => {
  const full = address.trim().replace(/\s+/g, ' ')
  if (!full) return []
  const segments = full.split(',').map(part => part.trim()).filter(Boolean)
  const withoutHouseNumber = segments.map((part, index) => (index === 0 ? part.replace(/^\d+[A-Za-z]?(?:[/-]\d+[A-Za-z]?)*\s+/, '') : part))
  const withoutWard = withoutHouseNumber.filter(
    (part, index) => index === 0 || !/^(?:phường|xã|thị trấn|p\.|x\.|tt\.)\s*/i.test(part),
  )
  const variants = [full, withoutHouseNumber.join(', '), withoutWard.join(', ')]
  return variants.filter((variant, index) => variant && variants.indexOf(variant) === index)
}

async function searchNominatim(query: string): Promise<NominatimAddressResult | null> {
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
    referrerPolicy: 'strict-origin-when-cross-origin',
    signal: AbortSignal.timeout(10000),
  })
  if (!response.ok) throw new Error(`NOMINATIM_HTTP_${response.status}`)

  const results = await response.json() as NominatimSearchResponse[]
  const result = results[0]
  const lat = Number(result?.lat)
  const lng = Number(result?.lon)
  if (!result?.display_name || !Number.isFinite(lat) || !Number.isFinite(lng)) return null
  return { lat, lng, displayName: result.display_name }
}

export const geocodeAddressWithNominatim = (address: string): Promise<NominatimAddressResult> =>
  runNominatimRequest(async () => {
    const variants = geocodeQueryVariants(address)
    if (variants.length === 0) throw new Error('NOMINATIM_ADDRESS_REQUIRED')

    for (const [index, query] of variants.entries()) {
      // The public service allows one request per second: wait between the looser retries of the same lookup.
      if (index > 0) {
        await new Promise(resolve => window.setTimeout(resolve, 1000))
        nextAllowedRequestAt = Date.now() + 1000
      }
      const found = await searchNominatim(query)
      if (found) return found
    }
    throw new Error('NOMINATIM_ADDRESS_NOT_FOUND')
  })

export const getNominatimErrorMessage = (error: unknown): string => {
  const code = error instanceof Error ? error.message : ''
  // `AbortSignal.timeout` rejects with a DOMException whose *name* is TimeoutError (its message is browser text).
  const name = error instanceof Error ? error.name : ''
  if (code === 'NOMINATIM_ADDRESS_REQUIRED') return 'Nhập địa chỉ để tìm kiếm.'
  if (code === 'NOMINATIM_ADDRESS_NOT_FOUND') return 'Không tìm thấy địa chỉ. Hãy thử nhập thêm phường, quận hoặc thành phố.'
  if (code.startsWith('NOMINATIM_HTTP_')) return 'Chưa thể tìm địa chỉ lúc này. Vui lòng thử lại sau.'
  if (name === 'TimeoutError' || name === 'AbortError' || code === 'TimeoutError' || code === 'AbortError') return 'Tìm địa chỉ quá thời gian. Vui lòng thử lại.'
  return 'Không thể tìm địa chỉ lúc này. Vui lòng kiểm tra mạng và thử lại.'
}
