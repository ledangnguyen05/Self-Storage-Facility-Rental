/** One branch pin on the facility map. */
export interface MapFacility {
  id: string
  name: string
  address: string
  lat: number
  lng: number
  /** Units that can be rented now. `null` when unknown. */
  availableUnits?: number | null
  totalUnits?: number | null
  /** Straight-line distance from the visitor, when a position is known. */
  distanceKm?: number | null
  /** The closest branch to the visitor (highlighted pin). */
  isNearest?: boolean
}

export interface MapPoint {
  lat: number
  lng: number
}

/** Centre of Ho Chi Minh City, used when no branch has a position yet. */
export const DEFAULT_MAP_CENTER: MapPoint = { lat: 10.7769, lng: 106.7009 }
