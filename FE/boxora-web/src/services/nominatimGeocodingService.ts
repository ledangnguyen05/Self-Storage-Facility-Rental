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

export const geocodeAddressWithNominatim = (address: string): Promise<NominatimAddressResult> =>
  runNominatimRequest(async () => {
    const query = address.trim()
    if (!query) throw new Error('NOMINATIM_ADDRESS_REQUIRED')

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
    if (!result?.display_name || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      throw new Error('NOMINATIM_ADDRESS_NOT_FOUND')
    }

    return { lat, lng, displayName: result.display_name }
  })

export const getNominatimErrorMessage = (error: unknown): string => {
  const code = error instanceof Error ? error.message : ''
  if (code === 'NOMINATIM_ADDRESS_REQUIRED') return 'Nhập địa chỉ để tìm kiếm.'
  if (code === 'NOMINATIM_ADDRESS_NOT_FOUND') return 'Không tìm thấy địa chỉ. Hãy thử nhập thêm phường, quận hoặc thành phố.'
  if (code.startsWith('NOMINATIM_HTTP_')) return 'Chưa thể tìm địa chỉ lúc này. Vui lòng thử lại sau.'
  if (code === 'TimeoutError' || code === 'AbortError') return 'Tìm địa chỉ quá thời gian. Vui lòng thử lại.'
  return 'Không thể tìm địa chỉ lúc này. Vui lòng kiểm tra mạng và thử lại.'
}
