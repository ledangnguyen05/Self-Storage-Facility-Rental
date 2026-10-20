import React, { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import {
  searchAddressList,
  autocompleteAddress,
  getGeocodingErrorMessage,
  GeocodingResult,
  GeocodingSuggestion,
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

const createCustomPinIcon = () =>
  L.divIcon({
    className: 'boxora-map-pin',
    html: `
      <div style="position: relative; width: 36px; height: 44px; display: flex; align-items: center; justify-content: center;">
        <div style="
          width: 34px;
          height: 34px;
          background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%);
          border: 3px solid #ffffff;
          border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          box-shadow: 0 4px 12px rgba(2, 132, 199, 0.45);
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          <div style="
            width: 10px;
            height: 10px;
            background: #ffffff;
            border-radius: 50%;
            transform: rotate(45deg);
          "></div>
        </div>
      </div>
    `,
    iconSize: [36, 44],
    iconAnchor: [18, 44],
    popupAnchor: [0, -44],
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

  const [searchQuery, setSearchQuery] = useState(address)
  const [isSearching, setIsSearching] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [searchResults, setSearchResults] = useState<GeocodingResult[]>([])
  const [suggestions, setSuggestions] = useState<GeocodingSuggestion[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [isLocating, setIsLocating] = useState(false)
  const [locationError, setLocationError] = useState('')

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    setSearchQuery(address)
  }, [address])

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return

    const initialLat = latitude != null && Number.isFinite(latitude) ? latitude : 10.7769
    const initialLng = longitude != null && Number.isFinite(longitude) ? longitude : 106.6953
    const initialZoom = latitude != null && longitude != null ? 16 : 13

    const map = L.map(mapContainerRef.current, {
      zoomControl: false,
      attributionControl: false,
    }).setView([initialLat, initialLng], initialZoom)

    createVietnamTileLayer().addTo(map)
    L.control.zoom({ position: 'topright' }).addTo(map)
    L.control.attribution({ prefix: false, position: 'bottomright' }).addTo(map)
    applyVietnamSovereignty(map)

    // Click anywhere on map to ping/place GPS pin
    map.on('click', (event: L.LeafletMouseEvent) => {
      const lat = Number(event.latlng.lat.toFixed(6))
      const lng = Number(event.latlng.lng.toFixed(6))
      onChangeRef.current(lat, lng)
      setSearchResults([])
    })

    mapInstanceRef.current = map

    return () => {
      map.remove()
      mapInstanceRef.current = null
    }
  }, [])

  // Sync Marker & View when coordinates change
  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map) return

    if (latitude != null && longitude != null && Number.isFinite(latitude) && Number.isFinite(longitude)) {
      if (!markerRef.current) {
        const marker = L.marker([latitude, longitude], {
          icon: createCustomPinIcon(),
          draggable: true,
        }).addTo(map)

        marker.on('dragend', () => {
          const pos = marker.getLatLng()
          if (pos) {
            onChangeRef.current(Number(pos.lat.toFixed(6)), Number(pos.lng.toFixed(6)))
          }
        })

        markerRef.current = marker
      } else {
        markerRef.current.setLatLng([latitude, longitude])
      }

      map.flyTo([latitude, longitude], Math.max(map.getZoom(), 16), { duration: 0.4 })
    } else {
      markerRef.current?.remove()
      markerRef.current = null
    }
  }, [latitude, longitude])

  // Search address handler: fetch list of candidate locations (like in ganhmuusinh)
  const handleSearch = async (event?: React.SyntheticEvent) => {
    if (event) {
      event.preventDefault()
      event.stopPropagation()
    }
    const cleanQuery = searchQuery.trim()
    if (cleanQuery.length < 2) {
      setSearchError('Vui lòng nhập ít nhất 2 ký tự để tìm vị trí.')
      setSearchResults([])
      return
    }

    setIsSearching(true)
    setSearchError('')
    setShowSuggestions(false)
    setSearchResults([])

    try {
      const found = await searchAddressList(cleanQuery)
      setSearchResults(found)

      if (found.length === 0) {
        setSearchError('Không tìm thấy vị trí phù hợp. Bạn có thể nhấp trực tiếp lên bản đồ bên dưới để đặt ghim.')
      } else if (found.length === 1) {
        selectResult(found[0])
      }
    } catch (err) {
      setSearchError(getGeocodingErrorMessage(err))
    } finally {
      setIsSearching(false)
    }
  }

  const selectResult = (result: GeocodingResult) => {
    onChange(Number(result.lat.toFixed(6)), Number(result.lng.toFixed(6)))
    if (onAddressSelect && result.displayName) {
      onAddressSelect(result.displayName)
    }
    setSearchQuery(result.displayName)
    setSearchResults([])
    setSearchError('')
  }

  // Live suggestions while typing
  const handleQueryChange = (val: string) => {
    setSearchQuery(val)
    if (val.trim().length >= 3) {
      autocompleteAddress(val).then((items) => {
        setSuggestions(items)
        setShowSuggestions(items.length > 0)
      })
    } else {
      setSuggestions([])
      setShowSuggestions(false)
    }
  }

  const selectSuggestion = (s: GeocodingSuggestion) => {
    onChange(Number(s.lat.toFixed(6)), Number(s.lng.toFixed(6)))
    if (onAddressSelect) {
      onAddressSelect(s.displayName)
    }
    setSearchQuery(s.displayName)
    setShowSuggestions(false)
    setSuggestions([])
    setSearchError('')
    setSearchResults([])
  }

  // Geolocation (GPS browser with IP fallback)
  const locateCurrent = async () => {
    setIsLocating(true)
    setLocationError('')

    const tryIpFallback = async (reason: string) => {
      try {
        const res = await fetch('https://ipwho.is/', { signal: AbortSignal.timeout(4000) })
        const data = await res.json()
        if (data && data.success && typeof data.latitude === 'number' && typeof data.longitude === 'number') {
          onChange(Number(data.latitude.toFixed(6)), Number(data.longitude.toFixed(6)))
          setLocationError(`Đã lấy vị trí gần đúng theo mạng (${data.city || data.region || 'Việt Nam'}). Bạn có thể kéo ghim để tinh chỉnh.`)
          return true
        }
      } catch {
        // Fallback failed
      }
      setLocationError(reason)
      return false
    }

    if (!navigator.geolocation) {
      await tryIpFallback('Trình duyệt không hỗ trợ GPS trực tiếp.')
      setIsLocating(false)
      return
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(6))
        const lng = Number(pos.coords.longitude.toFixed(6))
        onChange(lat, lng)
        setIsLocating(false)
      },
      async (err) => {
        const reason = err.code === err.PERMISSION_DENIED
          ? 'Chưa được cấp quyền GPS trên trình duyệt.'
          : 'Không thể xác định vị trí qua GPS vệ tinh.'
        await tryIpFallback(reason)
        setIsLocating(false)
      },
      { timeout: 5000, enableHighAccuracy: true }
    )
  }

  const hasPin = latitude != null && longitude != null

  return (
    <div className="space-y-3">
      {/* Search Input Bar (ganhmuusinh style) */}
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
              onChange={(e) => handleQueryChange(e.target.value)}
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

            {/* Dropdown autocomplete suggestions while typing */}
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute left-0 right-0 z-50 mt-1 max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-800">
                {suggestions.map((s, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => selectSuggestion(s)}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-cyan-50 dark:hover:bg-cyan-950/40 border-b border-slate-100 dark:border-slate-700/50 last:border-0 cursor-pointer flex items-center gap-2"
                  >
                    <span className="material-symbols-outlined text-[15px] text-cyan-600 shrink-0">place</span>
                    <span className="truncate flex-1 font-medium text-slate-800 dark:text-slate-200">{s.displayName}</span>
                    <span className="text-[10px] text-slate-400 font-mono shrink-0">
                      {s.lat.toFixed(4)}, {s.lng.toFixed(4)}
                    </span>
                  </button>
                ))}
              </div>
            )}
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

        {/* Search Results List (ganhmuusinh style - hiện danh sách lựa chọn cho user bấm chọn) */}
        {searchResults.length > 0 && (
          <div className="overflow-hidden rounded-xl border border-cyan-200 bg-white shadow-md dark:border-cyan-900/50 dark:bg-slate-800">
            <div className="bg-cyan-50/80 px-3 py-1.5 text-[11px] font-semibold text-cyan-800 dark:bg-cyan-950/60 dark:text-cyan-200 border-b border-cyan-100 dark:border-cyan-900/40 flex items-center justify-between">
              <span>Tìm thấy {searchResults.length} địa điểm phù hợp (bấm để ghim):</span>
              <button
                type="button"
                onClick={() => setSearchResults([])}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs"
              >
                ✕
              </button>
            </div>
            <ul className="max-h-48 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700/60">
              {searchResults.map((result, idx) => (
                <li key={idx}>
                  <button
                    type="button"
                    onClick={() => selectResult(result)}
                    className="w-full text-left px-3.5 py-2.5 text-xs hover:bg-cyan-50/60 dark:hover:bg-cyan-950/40 transition cursor-pointer flex flex-col gap-0.5"
                  >
                    <div className="flex items-center gap-1.5 font-semibold text-slate-800 dark:text-slate-100">
                      <span className="material-symbols-outlined text-[16px] text-cyan-600 shrink-0">location_on</span>
                      <span className="truncate">{result.displayName}</span>
                    </div>
                    {result.type && (
                      <span className="pl-5 text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                        {result.type} • Tọa độ: {result.lat.toFixed(6)}, {result.lng.toFixed(6)}
                      </span>
                    )}
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

      {/* Control Action Line: Instruction + Geolocation + Clear Pin */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-400">
        <div className="flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[16px] text-cyan-600">touch_app</span>
          <span>Bấm trực tiếp lên bản đồ hoặc kéo ghim để điều chỉnh vị trí GPS.</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={locateCurrent}
            disabled={isLocating}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 cursor-pointer"
          >
            <span className={`material-symbols-outlined text-[14px] text-cyan-600 ${isLocating ? 'animate-spin' : ''}`}>
              near_me
            </span>
            <span>{isLocating ? 'Đang lấy vị trí...' : 'Dùng vị trí hiện tại'}</span>
          </button>

          {hasPin && onClear && (
            <button
              type="button"
              onClick={onClear}
              className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[14px]">close</span>
              <span>Xóa ghim</span>
            </button>
          )}
        </div>
      </div>

      {locationError && (
        <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
          <span className="material-symbols-outlined text-[14px]">warning</span>
          {locationError}
        </p>
      )}

      {/* Leaflet Map Frame */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700 shadow-inner">
        <div ref={mapContainerRef} className="h-72 w-full z-0" />

        {/* Selected Coordinates Badge (ganhmuusinh style bottom-left) */}
        {hasPin && (
          <div className="absolute bottom-2 left-2 z-10 rounded-lg bg-white/95 px-2.5 py-1 text-[11px] font-mono font-bold text-slate-800 shadow-md backdrop-blur-xs border border-slate-200 dark:bg-slate-900/95 dark:text-slate-100 dark:border-slate-700">
            Ghim đã chọn: {latitude.toFixed(6)}, {longitude.toFixed(6)}
          </div>
        )}
      </div>
    </div>
  )
}
