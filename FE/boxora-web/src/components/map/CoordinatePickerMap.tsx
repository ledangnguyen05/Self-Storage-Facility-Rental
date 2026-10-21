import { useEffect, useMemo, useRef } from 'react'
import type L from 'leaflet'
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import './map.css'
import { createFacilityIcon } from './mapIcons'
import { MapControls } from './MapControls'
import { DEFAULT_MAP_CENTER, type MapPoint } from './mapTypes'

const TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
const TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>'

export interface CoordinatePickerMapProps {
  /** Current position, or `null` while no coordinates are set. */
  value: MapPoint | null
  /** Called when the user clicks the map or drags the pin. */
  onChange: (point: MapPoint) => void
  heightClassName?: string
}

/**
 * Keeps the view on the pin when the position changes from outside (typing, address lookup). When the pin is removed
 * ("Xóa tọa độ") the view returns to the default city, so an empty picker never keeps showing a street in another country.
 */
function Recenter({ value }: { value: MapPoint | null }) {
  const map = useMap()
  const lat = value?.lat
  const lng = value?.lng
  useEffect(() => {
    if (lat == null || lng == null) {
      map.setView([DEFAULT_MAP_CENTER.lat, DEFAULT_MAP_CENTER.lng], 11)
      return
    }
    // Only move the view when the pin is off-screen or the map is still zoomed out; a click inside the view keeps it steady.
    if (map.getZoom() < 13 || !map.getBounds().contains([lat, lng])) map.setView([lat, lng], 16)
  }, [map, lat, lng])
  return null
}

function ClickToPlace({ onChange }: { onChange: (point: MapPoint) => void }) {
  useMapEvents({
    click: event => onChange({ lat: event.latlng.lat, lng: event.latlng.lng }),
  })
  return null
}

/** Small map preview of a branch position. Click the map or drag the pin to adjust the coordinates. */
export default function CoordinatePickerMap({ value, onChange, heightClassName = 'h-56' }: CoordinatePickerMapProps) {
  const icon = useMemo(() => createFacilityIcon(), [])
  const markerRef = useRef<L.Marker | null>(null)

  return (
    <div className={`isolate overflow-hidden rounded-lg border border-line ${heightClassName}`}>
      <MapContainer
        className="bx-map size-full"
        center={value ? [value.lat, value.lng] : [DEFAULT_MAP_CENTER.lat, DEFAULT_MAP_CENTER.lng]}
        zoom={value ? 16 : 11}
        minZoom={5}
        scrollWheelZoom={false}
        zoomControl={false}
        attributionControl={false}
      >
        <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} maxZoom={19} />
        <MapControls />
        <ClickToPlace onChange={onChange} />
        <Recenter value={value} />
        {value ? (
          <Marker
            position={[value.lat, value.lng]}
            icon={icon}
            draggable
            ref={markerRef}
            title="Kéo để chỉnh vị trí"
            eventHandlers={{
              dragend: () => {
                const position = markerRef.current?.getLatLng()
                if (position) onChange({ lat: position.lat, lng: position.lng })
              },
            }}
          />
        ) : null}
      </MapContainer>
    </div>
  )
}
