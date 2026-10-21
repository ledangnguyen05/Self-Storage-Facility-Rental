import { AttributionControl, ZoomControl } from 'react-leaflet'

/** Leaflet's own credit, with a Vietnamese tooltip (the default one is English). Required map credit stays. */
const LEAFLET_CREDIT = '<a href="https://leafletjs.com" target="_blank" rel="noopener noreferrer" title="Thư viện bản đồ tương tác">Leaflet</a>'

/**
 * Zoom buttons and attribution with Vietnamese tooltips. Render inside a `MapContainer` that is created with
 * `zoomControl={false}` and `attributionControl={false}`, so Leaflet does not add its English defaults first.
 */
export function MapControls() {
  return (
    <>
      <ZoomControl position="topleft" zoomInTitle="Phóng to" zoomOutTitle="Thu nhỏ" />
      <AttributionControl position="bottomright" prefix={LEAFLET_CREDIT} />
    </>
  )
}
