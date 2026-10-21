import { useEffect, useMemo, useRef, type RefObject } from 'react'
import L from 'leaflet'
import { MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import { Navigation } from 'lucide-react'
import 'leaflet/dist/leaflet.css'
import './map.css'
import { Badge, Button } from '@/components/ui'
import { buttonVariants } from '@/components/ui/buttonVariants'
import { buildDirectionsUrl } from '@/data/storageUnitsData'
import { formatNumber } from '@/lib/format'
import { createFacilityIcon, createUserIcon } from './mapIcons'
import { MapControls } from './MapControls'
import { DEFAULT_MAP_CENTER, type MapFacility, type MapPoint } from './mapTypes'

const TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
const TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>'

export interface FacilityMapProps {
  facilities: readonly MapFacility[]
  /** The visitor's position (GPS or a searched address). Shown as a blue dot. */
  userLocation?: (MapPoint & { label?: string }) | null
  selectedId?: string | null
  /**
   * Bump this number to focus the selected branch again (fly to it and re-open its popup), e.g. when the visitor presses
   * "Xem trên bản đồ" twice on the same branch after closing the popup.
   */
  focusRequest?: number
  /** Called from the popup button, e.g. to filter the unit list by this branch. */
  onSelectFacility?: (facilityId: string) => void
  selectLabel?: string
  /** Tailwind height classes of the map box. */
  heightClassName?: string
  ariaLabel?: string
}

/** Fits the view to every pin (and the visitor) whenever the set of points changes. */
function FitToPoints({ points, signature }: { points: MapPoint[]; signature: string }) {
  const map = useMap()
  const pointsRef = useRef(points)
  useEffect(() => {
    pointsRef.current = points
  })
  useEffect(() => {
    const current = pointsRef.current
    if (current.length === 0) return
    if (current.length === 1) {
      map.setView([current[0].lat, current[0].lng], 15)
      return
    }
    map.fitBounds(L.latLngBounds(current.map(point => [point.lat, point.lng] as [number, number])), { padding: [48, 48], maxZoom: 15 })
  }, [map, signature])
  return null
}

/** Mouse wheel only zooms after the map was clicked, so the page keeps scrolling normally. */
function ScrollZoomOnFocus() {
  const map = useMap()
  useEffect(() => {
    map.scrollWheelZoom.disable()
  }, [map])
  useMapEvents({
    click: () => map.scrollWheelZoom.enable(),
    mouseout: () => map.scrollWheelZoom.disable(),
  })
  return null
}

/** Moves the view to the selected branch, then opens its popup (address, availability, "Chỉ đường"). */
function FocusSelected({
  facility,
  focusRequest,
  markers,
}: {
  facility: MapFacility | undefined
  focusRequest: number
  markers: RefObject<Map<string, L.Marker>>
}) {
  const map = useMap()
  const facilityId = facility?.id
  const lat = facility?.lat
  const lng = facility?.lng
  useEffect(() => {
    if (facilityId == null || lat == null || lng == null) return
    const target = L.latLng(lat, lng)
    const zoom = Math.max(map.getZoom(), 14)
    const openPopup = () => markers.current.get(facilityId)?.openPopup()
    // Already looking at the pin: no move event will fire, so open the popup straight away.
    if (map.getZoom() >= zoom && map.getCenter().distanceTo(target) < 1) {
      openPopup()
      return
    }
    map.once('moveend', openPopup)
    map.flyTo(target, zoom, { duration: 0.6 })
    return () => {
      map.off('moveend', openPopup)
    }
  }, [map, markers, facilityId, lat, lng, focusRequest])
  return null
}

function availabilityText(facility: MapFacility): string | null {
  if (facility.availableUnits == null) return null
  if (facility.availableUnits > 0) return `${formatNumber(facility.availableUnits)} kho trống`
  // A branch that has no units yet is not "sold out".
  return facility.totalUnits === 0 ? 'Chưa có kho' : 'Hết kho trống'
}

/**
 * Interactive OpenStreetMap with one pin per branch (Leaflet). Each popup shows the name, address, available units,
 * the distance from the visitor and a "Chỉ đường" link to Google Maps directions.
 */
export default function FacilityMap({
  facilities,
  userLocation = null,
  selectedId = null,
  focusRequest = 0,
  onSelectFacility,
  selectLabel = 'Xem kho trống',
  heightClassName = 'h-80 sm:h-96',
  ariaLabel = 'Bản đồ các cơ sở Boxora',
}: FacilityMapProps) {
  const points = useMemo<MapPoint[]>(() => {
    const list: MapPoint[] = facilities.map(facility => ({ lat: facility.lat, lng: facility.lng }))
    if (userLocation) list.push({ lat: userLocation.lat, lng: userLocation.lng })
    return list
  }, [facilities, userLocation])
  const signature = points.map(point => `${point.lat.toFixed(5)},${point.lng.toFixed(5)}`).join('|')

  const userIcon = useMemo(() => createUserIcon(), [])
  const selected = facilities.find(facility => facility.id === selectedId)
  const markers = useRef<Map<string, L.Marker>>(new Map())

  return (
    <div className={`bx-map-frame isolate overflow-hidden rounded-lg border border-line ${heightClassName}`} role="region" aria-label={ariaLabel}>
      <MapContainer
        className="bx-map size-full"
        center={[DEFAULT_MAP_CENTER.lat, DEFAULT_MAP_CENTER.lng]}
        zoom={11}
        minZoom={5}
        scrollWheelZoom={false}
        zoomControl={false}
        attributionControl={false}
      >
        <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} maxZoom={19} />
        <MapControls />
        <ScrollZoomOnFocus />
        <FitToPoints points={points} signature={signature} />
        <FocusSelected facility={selected} focusRequest={focusRequest} markers={markers} />

        {facilities.map(facility => {
          const availability = availabilityText(facility)
          return (
            <Marker
              key={facility.id}
              position={[facility.lat, facility.lng]}
              icon={createFacilityIcon({
                nearest: facility.isNearest,
                soldOut: facility.availableUnits === 0 && facility.totalUnits !== 0,
                selected: facility.id === selectedId,
              })}
              title={facility.name}
              alt={facility.name}
              keyboard
              ref={instance => {
                if (instance) markers.current.set(facility.id, instance)
                else markers.current.delete(facility.id)
              }}
            >
              <Popup minWidth={220} maxWidth={280}>
                <div className="flex flex-col gap-2">
                  <div>
                    <p className="font-semibold text-fg">{facility.name}</p>
                    {facility.address ? <p className="mt-0.5 text-dense text-fg-muted">{facility.address}</p> : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {facility.isNearest ? <Badge tone="success" size="sm">Gần bạn nhất</Badge> : null}
                    {availability ? (
                      <Badge tone={facility.availableUnits ? 'success' : 'neutral'} size="sm">
                        {availability}
                      </Badge>
                    ) : null}
                    {facility.distanceKm != null ? (
                      <Badge tone="accent" size="sm" icon={Navigation}>
                        <span className="tabular-nums">~{formatNumber(facility.distanceKm, { maximumFractionDigits: 1 })} km</span>
                      </Badge>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <a
                      href={buildDirectionsUrl({ lat: facility.lat, lng: facility.lng }, userLocation)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={buttonVariants({ variant: 'secondary', size: 'sm' })}
                    >
                      Chỉ đường
                    </a>
                    {onSelectFacility ? (
                      <Button size="sm" onClick={() => onSelectFacility(facility.id)}>
                        {selectLabel}
                      </Button>
                    ) : null}
                  </div>
                </div>
              </Popup>
            </Marker>
          )
        })}

        {userLocation ? (
          <Marker position={[userLocation.lat, userLocation.lng]} icon={userIcon} title="Vị trí của bạn" alt="Vị trí của bạn" keyboard={false}>
            <Popup>
              <p className="font-medium text-fg">Vị trí của bạn</p>
              {userLocation.label && userLocation.label !== 'Vị trí hiện tại của bạn' ? (
                <p className="mt-0.5 text-dense text-fg-muted">{userLocation.label}</p>
              ) : null}
            </Popup>
          </Marker>
        ) : null}
      </MapContainer>
    </div>
  )
}
