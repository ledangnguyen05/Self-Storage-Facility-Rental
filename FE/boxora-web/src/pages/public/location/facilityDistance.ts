import { calculateDistanceKm, type GeoPoint } from '../../../data/storageUnitsData'

export interface WithCoords {
  id: string
  coords: GeoPoint | null
}

/** Straight-line distance in km (one decimal), or `null` when either end has no position. */
export function distanceFrom(location: GeoPoint | null | undefined, coords: GeoPoint | null | undefined): number | null {
  if (!location || !coords) return null
  return calculateDistanceKm(location.lat, location.lng, coords.lat, coords.lng)
}

/** The branch closest to `location`; `null` when there is no position or no branch has coordinates. */
export function findNearest<T extends WithCoords>(items: readonly T[], location: GeoPoint | null | undefined): { item: T; distanceKm: number } | null {
  if (!location) return null
  let best: { item: T; distanceKm: number } | null = null
  for (const item of items) {
    const distanceKm = distanceFrom(location, item.coords)
    if (distanceKm == null) continue
    if (!best || distanceKm < best.distanceKm) best = { item, distanceKm }
  }
  return best
}

export const hasAnyCoords = (items: readonly WithCoords[]): boolean => items.some(item => item.coords != null)
