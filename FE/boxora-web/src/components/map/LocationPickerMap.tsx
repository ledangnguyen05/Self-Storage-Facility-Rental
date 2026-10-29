import React, { useCallback, useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import {
  searchAddressList,
  reverseGeocode,
  getGeocodingErrorMessage,
  isInVietnam,
  GeocodingResult,
} from '../../services/nominatimGeocodingService'
import { applyVietnamSovereignty, createVietnamTileLayer } from '../../utils/vietnamSovereignty'

interface LocationPickerMapProps {
  latitude: number | null
  longitude: number | null
  address?: string
  onChange: (lat: number, lng: number) => void
  onAddressSelect?: (address: string) => void
  onClear?: () => void
}

const DEFAULT_CENTER: [number, number] = [10.7769, 106.7009] // TP.HCM
const SUGGEST_DEBOUNCE_MS = 500
const SUGGEST_MIN_CHARS = 3

/**
 * High-visibility SVG pin with animated radar pulse
 */
const createCustomPinIcon = () =>
  L.divIcon({
    className: 'boxora-map-pin',
    html: `
      <div style="position: relative; width: 36px; height: 46px; pointer-events: auto;">
        <div class="boxora-pin-pulse"></div>
        <svg width="36" height="46" viewBox="0 0 36 46" fill="none" xmlns="http://www.w3.org/2000/svg" style="display: block; filter: drop-shadow(0 4px 10px rgba(2, 132, 199, 0.5));">
          <path d="M18 0C8.05888 0 0 8.05888 0 18C0 30.5 18 46 18 46C18 46 36 30.5 36 18C36 8.05888 27.9411 0 18 0Z" fill="url(#boxoraPinGrad)"/>
          <circle cx="18" cy="18" r="8" fill="#ffffff"/>
          <circle cx="18" cy="18" r="4.5" fill="#0284c7"/>
          <defs>
            <linearGradient id="boxoraPinGrad" x1="0" y1="0" x2="36" y2="46" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stop-color="#0284c7"/>
              <stop offset="100%" stop-color="#0369a1"/>
            </linearGradient>
          </defs>
        </svg>
      </div>
    `,
    iconSize: [36, 46],
    iconAnchor: [18, 46],
    popupAnchor: [0, -46],
  })

export const LocationPickerMap: React.FC<LocationPickerMapProps> = ({
  latitude,
  longitude,
  address = '',
  onChange,
  onAddressSelect,
  onClear,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<L.Map | null>(null)
  const markerRef = useRef<L.Marker | null>(null)
  const onChangeRef = useRef(onChange)
  const onAddressSelectRef = useRef(onAddressSelect)
  const searchSeqRef = useRef(0)
  const reverseSeqRef = useRef(0)
  const suppressSuggestRef = useRef(false)
  const searchAbortRef = useRef<AbortController | null>(null)
  const searchQueryRef = useRef(address)

  const [searchQuery, setSearchQuery] = useState(address)
  const [isSearching, setIsSearching] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [searchResults, setSearchResults] = useState<GeocodingResult[]>([])
  const [isLocating, setIsLocating] = useState(false)
  const [locationError, setLocationError] = useState('')
  const [isResolvingAddress, setIsResolvingAddress] = useState(false)

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    onAddressSelectRef.current = onAddressSelect
  }, [onAddressSelect])

  useEffect(() => {
    searchQueryRef.current = searchQuery
  }, [searchQuery])

  /** Đặt chữ trong ô tìm kiếm mà không kích hoạt gợi ý tự động */
  const setQuerySilently = useCallback((value: string) => {
    if (value !== searchQueryRef.current) {
      suppressSuggestRef.current = true
      searchQueryRef.current = value
      setSearchQuery(value)
    }
  }, [])

  useEffect(() => {
    // Đồng bộ ô tìm kiếm khi địa chỉ thay đổi từ bên ngoài
    setQuerySilently(address)
  }, [address, setQuerySilently])

  /** Đặt ghim + di chuyển bản đồ mượt mà */
  const updateMarkerAndMap = useCallback((lat: number, lng: number, zoom?: number) => {
    const map = mapInstanceRef.current
    if (!map) return

    if (!markerRef.current) {
      const marker = L.marker([lat, lng], {
        icon: createCustomPinIcon(),
        draggable: true,
        zIndexOffset: 1000,
      }).addTo(map)

      marker.on('dragend', () => {
        const pos = marker.getLatLng()
        if (pos) {
          const newLat = Number(pos.lat.toFixed(6))
          const newLng = Number(pos.lng.toFixed(6))
          onChangeRef.current(newLat, newLng)
          void resolveAddressFromPin(newLat, newLng)
        }
      })

      markerRef.current = marker
    } else {
      markerRef.current.setLatLng([lat, lng])
      if (!map.hasLayer(markerRef.current)) {
        markerRef.current.addTo(map)
      }
    }

    map.flyTo([lat, lng], zoom ?? Math.max(map.getZoom(), 16), { duration: 0.35 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /** Từ tọa độ ghim -> tự điền địa chỉ hiển thị (reverse geocoding) */
  const resolveAddressFromPin = useCallback(async (lat: number, lng: number) => {
    const seq = ++reverseSeqRef.current
    setIsResolvingAddress(true)
    try {
      const resolved = await reverseGeocode(lat, lng)
      if (seq !== reverseSeqRef.current) return
      if (resolved) {
        setQuerySilently(resolved)
        onAddressSelectRef.current?.(resolved)
      }
    } catch {
      // bỏ qua: người dùng vẫn có thể nhập địa chỉ thủ công
    } finally {
      if (seq === reverseSeqRef.current) setIsResolvingAddress(false)
    }
  }, [setQuerySilently])

  // Khởi tạo bản đồ Leaflet
  useEffect(() => {
    const container = mapContainerRef.current
    if (!container) return

    const hasInitial =
      latitude != null && longitude != null && Number.isFinite(latitude) && Number.isFinite(longitude)
    const initialCenter: [number, number] = hasInitial ? [latitude as number, longitude as number] : DEFAULT_CENTER
    const initialZoom = hasInitial ? 16 : 13

    const map = L.map(container, {
      zoomControl: false,
      attributionControl: false,
    }).setView(initialCenter, initialZoom)

    // Tile Google tiếng Việt; tự chuyển sang OpenStreetMap nếu tile bị chặn / lỗi liên tục
    const primaryTiles = createVietnamTileLayer().addTo(map)
    let tileErrors = 0
    let fallbackAdded = false
    primaryTiles.on('tileerror', () => {
      tileErrors += 1
      if (tileErrors >= 4 && !fallbackAdded) {
        fallbackAdded = true
        map.removeLayer(primaryTiles)
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '© OpenStreetMap contributors',
        }).addTo(map)
      }
    })

    L.control.zoom({ position: 'topright' }).addTo(map)
    L.control.attribution({ prefix: false, position: 'bottomright' }).addTo(map)
    applyVietnamSovereignty(map)

    mapInstanceRef.current = map

    // Khắc phục lỗi bản đồ chỉ hiện một mảng nhỏ: container thay đổi kích thước khi modal/animation hiển thị
    const refreshSize = () => {
      if (mapInstanceRef.current) mapInstanceRef.current.invalidateSize({ animate: false })
    }
    const timers = [50, 200, 500, 1000].map((ms) => window.setTimeout(refreshSize, ms))
    let observer: ResizeObserver | null = null
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(refreshSize)
      observer.observe(container)
    }
    window.addEventListener('resize', refreshSize)

    if (hasInitial) {
      updateMarkerAndMap(latitude as number, longitude as number)
    }

    // Bấm lên bản đồ để đặt ghim
    map.on('click', (event: L.LeafletMouseEvent) => {
      const lat = Number(event.latlng.lat.toFixed(6))
      const lng = Number(event.latlng.lng.toFixed(6))
      updateMarkerAndMap(lat, lng)
      onChangeRef.current(lat, lng)
      void resolveAddressFromPin(lat, lng)
      setSearchResults([])
      setSearchError('')
    })

    return () => {
      timers.forEach((t) => window.clearTimeout(t))
      observer?.disconnect()
      window.removeEventListener('resize', refreshSize)
      searchAbortRef.current?.abort()
      map.remove()
      mapInstanceRef.current = null
      markerRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Đồng bộ ghim khi tọa độ props thay đổi (nhập tay vĩ độ / kinh độ)
  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map) return

    if (latitude != null && longitude != null && Number.isFinite(latitude) && Number.isFinite(longitude)) {
      const current = markerRef.current?.getLatLng()
      const moved = !current || Math.abs(current.lat - latitude) > 1e-6 || Math.abs(current.lng - longitude) > 1e-6
      if (moved) updateMarkerAndMap(latitude, longitude)
    } else {
      markerRef.current?.remove()
      markerRef.current = null
    }
  }, [latitude, longitude, updateMarkerAndMap])

  /** Thực hiện tìm kiếm (dùng cho cả nút Tìm / Enter / gợi ý tự động) */
  const runSearch = useCallback(
    async (query: string, autoPick: boolean) => {
      const clean = query.trim()
      if (clean.length < 2) {
        setSearchError('Vui lòng nhập ít nhất 2 ký tự để tìm vị trí.')
        setSearchResults([])
        return
      }

      searchAbortRef.current?.abort()
      const controller = new AbortController()
      searchAbortRef.current = controller
      const seq = ++searchSeqRef.current

      setIsSearching(true)
      setSearchError('')

      try {
        const found = await searchAddressList(clean, undefined, controller.signal)
        if (seq !== searchSeqRef.current) return
        setSearchResults(found)

        if (found.length === 0) {
          setSearchError('Không tìm thấy vị trí phù hợp. Hãy thử bỏ bớt số nhà/phường hoặc bấm trực tiếp lên bản đồ để đặt ghim.')
        } else if (autoPick && found.length === 1) {
          selectResult(found[0])
        }
      } catch (err) {
        if (seq !== searchSeqRef.current) return
        setSearchError(getGeocodingErrorMessage(err))
      } finally {
        if (seq === searchSeqRef.current) setIsSearching(false)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  // Gợi ý tự động khi gõ (debounce)
  useEffect(() => {
    if (suppressSuggestRef.current) {
      suppressSuggestRef.current = false
      return
    }
    const clean = searchQuery.trim()
    if (clean.length < SUGGEST_MIN_CHARS) {
      setSearchResults([])
      return
    }
    const timer = window.setTimeout(() => {
      void runSearch(clean, false)
    }, SUGGEST_DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [searchQuery, runSearch])

  const handleSearch = async (event?: React.SyntheticEvent) => {
    if (event) {
      event.preventDefault()
      event.stopPropagation()
    }
    // Giữ lại chữ người dùng đã nhập làm địa chỉ hiển thị nếu chưa có địa chỉ nào
    if (searchQuery.trim() && !address.trim()) {
      onAddressSelectRef.current?.(searchQuery.trim())
    }
    await runSearch(searchQuery, true)
  }

  const selectResult = (result: GeocodingResult) => {
    const lat = Number(result.lat.toFixed(6))
    const lng = Number(result.lng.toFixed(6))

    // Hủy mọi reverse-geocode đang chạy để không ghi đè địa chỉ vừa chọn
    reverseSeqRef.current += 1
    setIsResolvingAddress(false)

    updateMarkerAndMap(lat, lng, result.source === 'EXACT' ? 18 : 17)
    onChangeRef.current(lat, lng)

    if (result.displayName) {
      onAddressSelectRef.current?.(result.displayName)
    }
    setQuerySilently(result.displayName)
    setSearchResults([])
    setSearchError('')
  }

  // Vị trí hiện tại: GPS thiết bị (độ chính xác cao), dự phòng theo IP (gần đúng cấp thành phố)
  const locateCurrent = async () => {
    setIsLocating(true)
    setLocationError('')

    const applyPosition = (lat: number, lng: number, zoom: number) => {
      updateMarkerAndMap(lat, lng, zoom)
      onChangeRef.current(lat, lng)
      void resolveAddressFromPin(lat, lng)
    }

    const tryIpFallback = async (reason: string) => {
      try {
        const res = await fetch('https://ipwho.is/', { signal: AbortSignal.timeout(4000) })
        const data = await res.json()
        if (data && data.success && typeof data.latitude === 'number' && typeof data.longitude === 'number') {
          const lat = Number(data.latitude.toFixed(6))
          const lng = Number(data.longitude.toFixed(6))
          if (isInVietnam(lat, lng)) {
            applyPosition(lat, lng, 14)
            setLocationError(
              `${reason} Đã lấy vị trí gần đúng theo mạng (${data.city || data.region || 'Việt Nam'}) — chỉ chính xác cấp thành phố, vui lòng kéo ghim hoặc nhập địa chỉ để chỉnh lại.`
            )
            return true
          }
        }
      } catch {
        // Dự phòng thất bại
      }
      setLocationError(`${reason} Hãy nhập địa chỉ vào ô tìm kiếm hoặc bấm trực tiếp lên bản đồ.`)
      return false
    }

    if (!navigator.geolocation) {
      await tryIpFallback('Trình duyệt không hỗ trợ GPS.')
      setIsLocating(false)
      return
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(6))
        const lng = Number(pos.coords.longitude.toFixed(6))
        const accuracy = Math.round(pos.coords.accuracy || 0)

        if (!isInVietnam(lat, lng)) {
          setLocationError('Vị trí thiết bị nằm ngoài Việt Nam, không thể dùng làm vị trí chi nhánh. Hãy nhập địa chỉ thủ công.')
          setIsLocating(false)
          return
        }

        applyPosition(lat, lng, accuracy > 0 && accuracy <= 100 ? 18 : accuracy <= 1000 ? 16 : 14)
        if (accuracy > 500) {
          setLocationError(
            `Vị trí lấy từ thiết bị có sai số khoảng ${accuracy.toLocaleString('vi-VN')} m (máy tính thường không có GPS thật). Vui lòng kéo ghim hoặc nhập địa chỉ để chỉnh lại.`
          )
        }
        setIsLocating(false)
      },
      async (err) => {
        const reason =
          err.code === err.PERMISSION_DENIED
            ? 'Chưa được cấp quyền vị trí trên trình duyệt.'
            : err.code === err.TIMEOUT
            ? 'Hết thời gian chờ GPS.'
            : 'Không thể xác định vị trí qua GPS.'
        await tryIpFallback(reason)
        setIsLocating(false)
      },
      { timeout: 10000, enableHighAccuracy: true, maximumAge: 0 }
    )
  }

  const handleClear = () => {
    markerRef.current?.remove()
    markerRef.current = null
    if (onClear) {
      onClear()
    }
  }

  const hasPin = latitude != null && longitude != null

  return (
    <div className="space-y-3">
      {/* Search Input Bar */}
      <div className="space-y-2">
        <label className="block text-xs font-semibold text-slate-800 dark:text-slate-200">
          Tìm vị trí trên bản đồ
        </label>
        <div className="flex gap-2">
          <div className="relative min-w-0 flex-1">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-slate-400">
              search
            </span>
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  e.stopPropagation()
                  void handleSearch(e)
                }
              }}
              placeholder="Nhập địa chỉ cơ sở, tên đường, tòa nhà hoặc số nhà..."
              className="w-full rounded-xl border border-slate-300 bg-white pl-9 pr-3 py-2 text-xs text-slate-900 outline-none transition focus:border-cyan-600 focus:ring-2 focus:ring-cyan-600/15 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>

          <button
            type="button"
            onClick={() => void handleSearch()}
            disabled={isSearching}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-cyan-700 px-4 py-2 text-xs font-bold text-white hover:bg-cyan-800 disabled:opacity-50 cursor-pointer shadow-xs transition"
          >
            {isSearching ? (
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            ) : (
              <span className="material-symbols-outlined text-[16px]">search</span>
            )}
            <span>{isSearching ? 'Đang tìm...' : 'Tìm'}</span>
          </button>
        </div>

        {/* Danh sách kết quả: bấm để chọn ghim */}
        {searchResults.length > 0 && (
          <div className="overflow-hidden rounded-xl border border-cyan-200 bg-white shadow-md dark:border-cyan-900/50 dark:bg-slate-800">
            <div className="bg-cyan-50/80 px-3 py-1.5 text-[11px] font-semibold text-cyan-800 dark:bg-cyan-950/60 dark:text-cyan-200 border-b border-cyan-100 dark:border-cyan-900/40 flex items-center justify-between">
              <span>Tìm thấy {searchResults.length} địa điểm phù hợp (bấm để chọn ghim):</span>
              <button
                type="button"
                onClick={() => setSearchResults([])}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs cursor-pointer"
              >
                ✕
              </button>
            </div>
            <ul className="max-h-48 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700/60">
              {searchResults.map((result, idx) => (
                <li key={`${result.lat}-${result.lng}-${idx}`}>
                  <button
                    type="button"
                    onClick={() => selectResult(result)}
                    className="w-full text-left px-3.5 py-2.5 text-xs hover:bg-cyan-50/60 dark:hover:bg-cyan-950/40 transition cursor-pointer flex flex-col gap-0.5"
                  >
                    <div className="flex items-center gap-1.5 font-semibold text-slate-800 dark:text-slate-100">
                      <span className="material-symbols-outlined text-[16px] text-cyan-600 shrink-0">location_on</span>
                      <span className="truncate">{result.displayName}</span>
                    </div>
                    <span className="pl-5 text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                      {result.confidence || result.type} • {result.lat.toFixed(6)}, {result.lng.toFixed(6)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {searchError && (
          <p className="text-xs text-rose-600 dark:text-rose-400 flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px]">info</span>
            {searchError}
          </p>
        )}
      </div>

      {/* Hướng dẫn + Vị trí hiện tại + Xóa ghim */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-400">
        <div className="flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[16px] text-cyan-600">touch_app</span>
          <span>
            Bấm trực tiếp lên bản đồ hoặc kéo ghim để điều chỉnh vị trí GPS.
            {isResolvingAddress && <span className="ml-1 text-cyan-700">Đang lấy địa chỉ từ ghim...</span>}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={locateCurrent}
            disabled={isLocating}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 cursor-pointer disabled:opacity-60"
          >
            <span className={`material-symbols-outlined text-[14px] text-cyan-600 ${isLocating ? 'animate-spin' : ''}`}>
              near_me
            </span>
            <span>{isLocating ? 'Đang lấy vị trí...' : 'Dùng vị trí hiện tại'}</span>
          </button>

          {hasPin && onClear && (
            <button
              type="button"
              onClick={handleClear}
              className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[14px]">close</span>
              <span>Xóa ghim</span>
            </button>
          )}
        </div>
      </div>

      {locationError && (
        <p className="text-xs text-amber-600 dark:text-amber-400 flex items-start gap-1">
          <span className="material-symbols-outlined text-[14px] mt-0.5">warning</span>
          <span>{locationError}</span>
        </p>
      )}

      {/* Leaflet Map Frame */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700 shadow-inner bg-slate-100">
        <div ref={mapContainerRef} className="h-72 w-full z-0" />

        {hasPin && (
          <div className="absolute bottom-2 left-2 z-[400] rounded-lg bg-white/95 px-2.5 py-1 text-[11px] font-mono font-bold text-slate-800 shadow-md backdrop-blur-xs border border-slate-200 dark:bg-slate-900/95 dark:text-slate-100 dark:border-slate-700">
            Ghim đã chọn: {(latitude as number).toFixed(6)}, {(longitude as number).toFixed(6)}
          </div>
        )}
      </div>
    </div>
  )
}
