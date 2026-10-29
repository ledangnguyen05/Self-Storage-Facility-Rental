import React, { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Facility } from '../../types'
import { applyVietnamSovereignty, createVietnamTileLayer } from '../../utils/vietnamSovereignty'

interface BoxoraFacilitiesMapProps {
  facilities: Facility[]
  onSelectFacility?: (facility: Facility) => void
  selectedFacilityId?: string | null
}

const createFacilityIcon = (isActive: boolean) =>
  L.divIcon({
    className: 'facility-marker-icon',
    html: `
      <div style="position: relative; width: 38px; height: 46px; display: flex; align-items: center; justify-content: center; cursor: pointer;">
        <div style="
          width: 36px;
          height: 36px;
          background: ${isActive ? 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)' : '#64748b'};
          border: 3px solid #ffffff;
          border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          box-shadow: 0 4px 14px rgba(2, 132, 199, 0.45);
          display: flex;
          align-items: center;
          justify-content: center;
          transition: transform 0.2s ease;
        ">
          <div style="
            width: 12px;
            height: 12px;
            background: #ffffff;
            border-radius: 50%;
            transform: rotate(45deg);
          "></div>
        </div>
      </div>
    `,
    iconSize: [38, 46],
    iconAnchor: [19, 46],
    popupAnchor: [0, -46],
  })

export const BoxoraFacilitiesMap: React.FC<BoxoraFacilitiesMapProps> = ({
  facilities,
  onSelectFacility,
  selectedFacilityId,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<L.Map | null>(null)
  const markersRef = useRef<Map<string, L.Marker>>(new Map())

  const [activeFacility, setActiveFacility] = useState<Facility | null>(null)

  // Known coordinates for the 4 main Boxora hubs in Ho Chi Minh City if DB coordinates are not yet set
  const KNOWN_BRANCH_COORDS: Record<string, { lat: number; lng: number }> = {
    'HCM-D1': { lat: 10.7735, lng: 106.7032 }, // 123 Nguyen Hue, District 1
    'HCM-D7': { lat: 10.7416, lng: 106.7017 }, // 456 Nguyen Huu Tho, District 7
    'HCM-TD': { lat: 10.8507, lng: 106.7602 }, // 789 Vo Van Ngan, Thu Duc
    'HCM-TB': { lat: 10.8010, lng: 106.6390 }, // 102 Truong Son, Tan Binh
  }

  // Facilities with valid coordinates (or known hub coordinates for display)
  const validFacilities = facilities.map((f) => {
    if (f.latitude != null && f.longitude != null && Number.isFinite(Number(f.latitude)) && Number.isFinite(Number(f.longitude))) {
      return f
    }
    const known = f.code ? KNOWN_BRANCH_COORDS[f.code] : undefined
    if (known) {
      return {
        ...f,
        latitude: known.lat,
        longitude: known.lng,
      }
    }
    return f
  }).filter(
    (f) => f.latitude != null && f.longitude != null && Number.isFinite(Number(f.latitude)) && Number.isFinite(Number(f.longitude))
  )

  useEffect(() => {
    if (!mapContainerRef.current) return

    // Center on Ho Chi Minh City by default
    const map = L.map(mapContainerRef.current, {
      zoomControl: false,
      attributionControl: false,
    }).setView([10.7769, 106.6953], 12)

    createVietnamTileLayer().addTo(map)
    L.control.zoom({ position: 'topright' }).addTo(map)
    L.control.attribution({ prefix: false, position: 'bottomright' }).addTo(map)
    applyVietnamSovereignty(map)

    mapInstanceRef.current = map

    return () => {
      map.remove()
      mapInstanceRef.current = null
    }
  }, [])

  // Update markers
  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map) return

    // Clear old markers
    markersRef.current.forEach((m) => m.remove())
    markersRef.current.clear()

    const bounds = L.latLngBounds([])

    validFacilities.forEach((facility) => {
      const lat = Number(facility.latitude)
      const lng = Number(facility.longitude)
      const isSelected = facility.id === selectedFacilityId

      const marker = L.marker([lat, lng], {
        icon: createFacilityIcon(facility.status === 'ACTIVE'),
      }).addTo(map)

      const popupHtml = `
        <div style="font-family: 'Be Vietnam Pro', sans-serif; min-width: 200px; padding: 4px;">
          <div style="font-size: 10px; font-weight: 800; color: #0284c7; text-transform: uppercase; font-family: 'Be Vietnam Pro', sans-serif;">
            ${facility.code}
          </div>
          <div style="font-size: 13px; font-weight: 700; color: #0f172a; margin-top: 2px;">
            ${facility.name}
          </div>
          <div style="font-size: 11px; color: #475569; margin-top: 4px; line-height: 1.4;">
            ${facility.address}${facility.city ? `, ${facility.city}` : ''}
          </div>
          <div style="margin-top: 6px; display: flex; align-items: center; justify-content: space-between;">
            <span style="
              display: inline-block;
              font-size: 10px;
              font-weight: 700;
              padding: 2px 8px;
              border-radius: 9999px;
              background: ${facility.status === 'ACTIVE' ? '#ecfdf5' : '#f1f5f9'};
              color: ${facility.status === 'ACTIVE' ? '#047857' : '#475569'};
            ">
              ${facility.status === 'ACTIVE' ? 'ĐANG HOẠT ĐỘNG' : facility.status}
            </span>
            <a href="https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}" target="_blank" rel="noreferrer" style="
              font-size: 11px;
              font-weight: 700;
              color: #0284c7;
              text-decoration: underline;
            ">
              Chỉ đường
            </a>
          </div>
        </div>
      `
      marker.bindPopup(popupHtml, { closeButton: false, offset: [0, -32] })

      marker.on('click', () => {
        setActiveFacility(facility)
        onSelectFacility?.(facility)
      })

      markersRef.current.set(facility.id, marker)
      bounds.extend([lat, lng])
    })

    if (validFacilities.length > 0 && bounds.isValid()) {
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 })
    }
  }, [facilities, selectedFacilityId])

  // Focus selected facility if passed
  useEffect(() => {
    if (!selectedFacilityId) return
    const marker = markersRef.current.get(selectedFacilityId)
    const map = mapInstanceRef.current
    if (marker && map) {
      const latlng = marker.getLatLng()
      map.flyTo(latlng, 15, { duration: 0.5 })
      marker.openPopup()
    }
  }, [selectedFacilityId])

  return (
    <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900">
      <div ref={mapContainerRef} className="h-96 w-full sm:h-[480px] z-0" />

      {/* Floating Header Banner */}
      <div className="absolute top-4 left-4 z-10 max-w-sm rounded-2xl bg-white/95 p-3.5 shadow-lg backdrop-blur-md border border-slate-200/80 dark:bg-slate-900/95 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-cyan-700 text-white shadow-sm">
            <span className="material-symbols-outlined text-[17px]">hub</span>
          </span>
          <div>
            <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">Hệ Thống Kho Boxora</h4>
            <p className="text-[10px] text-slate-500 font-medium">Bản đồ vệ tinh &amp; định vị GPS các cơ sở</p>
          </div>
        </div>
      </div>

      {/* Quick Facility Pills Overlay */}
      {validFacilities.length > 0 && (
        <div className="absolute bottom-3 left-3 right-3 z-10 flex gap-2 overflow-x-auto pb-1 sm:left-4 sm:right-auto sm:max-w-xl">
          {validFacilities.map((f) => {
            const isSelected = f.id === (selectedFacilityId || activeFacility?.id)
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => {
                  setActiveFacility(f)
                  onSelectFacility?.(f)
                  const marker = markersRef.current.get(f.id)
                  const map = mapInstanceRef.current
                  if (marker && map) {
                    map.flyTo(marker.getLatLng(), 15, { duration: 0.4 })
                    marker.openPopup()
                  }
                }}
                className={`flex shrink-0 items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-bold transition shadow-md cursor-pointer border backdrop-blur-md ${
                  isSelected
                    ? 'border-cyan-600 bg-cyan-700 text-white shadow-cyan-700/25'
                    : 'border-slate-200 bg-white/90 text-slate-800 hover:bg-white dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-100'
                }`}
              >
                <span className="material-symbols-outlined text-[15px]">location_on</span>
                <span className="truncate max-w-[140px]">{f.name}</span>
                <span className="rounded bg-black/10 dark:bg-white/10 px-1 py-0.5 font-mono text-[9px] uppercase">
                  {f.code}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
