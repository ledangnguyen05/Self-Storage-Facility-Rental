import L from 'leaflet'

const PIN_SVG =
  '<svg viewBox="0 0 32 42" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
  '<path class="bx-pin-body" d="M16 1C8 1 2 7.2 2 15c0 10.4 12.4 24.2 13.1 25a1.2 1.2 0 0 0 1.8 0C17.6 39.2 30 25.4 30 15 30 7.2 24 1 16 1Z"/>' +
  '<circle class="bx-pin-dot" cx="16" cy="15" r="5.5"/>' +
  '</svg>'

export interface PinState {
  nearest?: boolean
  soldOut?: boolean
  selected?: boolean
}

/** Branch pin. Colour comes from CSS tokens (`map.css`), so no image files are needed. */
export function createFacilityIcon({ nearest = false, soldOut = false, selected = false }: PinState = {}): L.DivIcon {
  const classes = ['bx-pin']
  if (nearest) classes.push('bx-pin--nearest')
  else if (soldOut) classes.push('bx-pin--soldout')
  if (selected) classes.push('bx-pin--selected')
  return L.divIcon({
    className: classes.join(' '),
    html: PIN_SVG,
    iconSize: [32, 42],
    iconAnchor: [16, 41],
    popupAnchor: [0, -36],
  })
}

/** The visitor's own position. */
export function createUserIcon(): L.DivIcon {
  return L.divIcon({
    className: 'bx-pin',
    html: '<div class="bx-user-dot"></div>',
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  })
}
